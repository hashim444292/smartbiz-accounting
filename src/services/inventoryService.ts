import { Decimal, round2, round4, toDecimal, calculateWeightedAverageCost } from "@/lib/decimal";
import { Prisma, InventoryTxType, AdjustmentReason } from "@prisma/client";
import { assertPeriodOpen, createJournalEntry } from "./accountingService";

export class InsufficientStockError extends Error {
  constructor(productName: string, available: string, requested: string) {
    super(`Insufficient stock for "${productName}". Available: ${available}, Requested: ${requested}.`);
    this.name = "InsufficientStockError";
  }
}

/**
 * Records an inventory stock movement and updates the product's running stock and average cost.
 */
export async function recordStockMovement(
  tx: Prisma.TransactionClient,
  params: {
    businessId: string;
    productId: string;
    type: InventoryTxType;
    quantity: Decimal.Value;
    unitCost?: Decimal.Value;
    referenceType?: string;
    referenceId?: string;
    notes?: string;
    date?: Date;
  }
) {
  const { businessId, productId, type, referenceType, referenceId, notes } = params;
  const date = params.date || new Date();
  const qty = round4(params.quantity);

  if (qty.lte(0)) {
    throw new Error("Movement quantity must be greater than zero.");
  }

  // Ensure period is open
  await assertPeriodOpen(tx, businessId, date);

  const product = await tx.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    throw new Error(`Product with ID ${productId} not found.`);
  }

  const business = await tx.business.findUnique({
    where: { id: businessId },
  });

  const isIncoming = ["OPENING", "STOCK_IN", "PURCHASE", "SALE_RETURN"].includes(type);
  const currentStock = toDecimal(product.currentStock);
  const currentAvgCost = toDecimal(product.averageCost);
  const movementUnitCost = params.unitCost ? round2(params.unitCost) : currentAvgCost;
  const totalCost = round2(qty.mul(movementUnitCost));

  let newStock: Decimal;
  let newAvgCost = currentAvgCost;

  if (isIncoming) {
    newStock = currentStock.add(qty);
    // Recalculate Weighted Average Cost on incoming purchases/stock-ins
    newAvgCost = calculateWeightedAverageCost(currentStock, currentAvgCost, qty, movementUnitCost);
  } else {
    newStock = currentStock.sub(qty);
    // Check negative stock policy
    if (newStock.lt(0) && !business?.negativeStockPolicy) {
      throw new InsufficientStockError(
        product.name,
        currentStock.toString(),
        qty.toString()
      );
    }
  }

  // 1. Create the inventory transaction record
  const movement = await tx.inventoryTransaction.create({
    data: {
      businessId,
      productId,
      type,
      quantity: qty.toNumber(),
      unitCost: movementUnitCost.toNumber(),
      totalCost: totalCost.toNumber(),
      referenceType,
      referenceId,
      notes,
      date,
    },
  });

  // 2. Update product master running stock and WAC
  await tx.product.update({
    where: { id: productId },
    data: {
      currentStock: newStock.toNumber(),
      averageCost: newAvgCost.toNumber(),
    },
  });

  return { movement, newStock, newAvgCost };
}

/**
 * Re-audits and computes closing stock from the entire transaction history.
 */
export async function auditProductStockFromLedger(
  tx: Prisma.TransactionClient,
  productId: string
): Promise<{ calculatedStock: Decimal; currentRecordedStock: Decimal; isConsistent: boolean }> {
  const product = await tx.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error("Product not found");

  const movements = await tx.inventoryTransaction.findMany({
    where: { productId },
    orderBy: { date: "asc" },
  });

  let runningStock = new Decimal(0);

  for (const m of movements) {
    const q = toDecimal(m.quantity);
    if (["OPENING", "STOCK_IN", "PURCHASE", "SALE_RETURN"].includes(m.type)) {
      runningStock = runningStock.add(q);
    } else if (["STOCK_OUT", "SALE", "PURCHASE_RETURN", "DAMAGE"].includes(m.type)) {
      runningStock = runningStock.sub(q);
    } else if (m.type === "ADJUSTMENT") {
      // adjustments store net movement
      runningStock = runningStock.add(q);
    }
  }

  runningStock = round4(runningStock);
  const currentRecordedStock = toDecimal(product.currentStock);
  const isConsistent = runningStock.eq(currentRecordedStock);

  return {
    calculatedStock: runningStock,
    currentRecordedStock,
    isConsistent,
  };
}

/**
 * Performs a physical or damage stock adjustment with corresponding journal entries.
 */
export async function performStockAdjustment(
  tx: Prisma.TransactionClient,
  params: {
    businessId: string;
    productId: string;
    targetStock: Decimal.Value;
    reason: AdjustmentReason;
    notes?: string;
    createdById?: string;
    date?: Date;
  }
) {
  const { businessId, productId, reason, notes, createdById } = params;
  const date = params.date || new Date();
  const target = round4(params.targetStock);

  const product = await tx.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error("Product not found");

  const current = toDecimal(product.currentStock);
  const diff = target.sub(current);

  if (diff.isZero()) {
    return { status: "NO_CHANGE", currentStock: current };
  }

  const avgCost = toDecimal(product.averageCost);
  const absDiff = diff.abs();
  const totalCost = round2(absDiff.mul(avgCost));

  // Save stock adjustment log
  const adjustmentRecord = await tx.stockAdjustment.create({
    data: {
      businessId,
      reason,
      notes: notes || `Stock adjusted from ${current} to ${target}. Diff: ${diff}`,
      createdById,
      date,
    },
  });

  if (diff.gt(0)) {
    // Stock Increase
    await recordStockMovement(tx, {
      businessId,
      productId,
      type: "STOCK_IN",
      quantity: diff,
      unitCost: avgCost,
      referenceType: "ADJUSTMENT",
      referenceId: adjustmentRecord.id,
      notes: `Adjustment gain (${reason}): ${notes || ""}`,
      date,
    });

    // Journal Entry: Debit Merchandise Inventory, Credit Other Income
    if (totalCost.gt(0)) {
      await createJournalEntry(tx, {
        businessId,
        date,
        description: `Inventory Adjustment Gain for ${product.name} (+${diff} ${product.unit})`,
        referenceType: "ADJUSTMENT",
        referenceId: adjustmentRecord.id,
        createdById,
        lines: [
          { accountCode: "1200", debit: totalCost, credit: 0, description: "Inventory Gain" },
          { accountCode: "4100", debit: 0, credit: totalCost, description: "Stock Gain / Other Income" },
        ],
      });
    }
  } else {
    // Stock Decrease (Shrinkage, Damage, Loss)
    await recordStockMovement(tx, {
      businessId,
      productId,
      type: reason === "DAMAGE" ? "DAMAGE" : "STOCK_OUT",
      quantity: absDiff,
      unitCost: avgCost,
      referenceType: "ADJUSTMENT",
      referenceId: adjustmentRecord.id,
      notes: `Adjustment loss (${reason}): ${notes || ""}`,
      date,
    });

    // Journal Entry: Debit Inventory Loss, Credit Merchandise Inventory
    if (totalCost.gt(0)) {
      await createJournalEntry(tx, {
        businessId,
        date,
        description: `Inventory Shrinkage/Loss for ${product.name} (-${absDiff} ${product.unit})`,
        referenceType: "ADJUSTMENT",
        referenceId: adjustmentRecord.id,
        createdById,
        lines: [
          { accountCode: "5020", debit: totalCost, credit: 0, description: "Inventory Shrinkage & Loss" },
          { accountCode: "1200", debit: 0, credit: totalCost, description: "Merchandise Inventory Write-down" },
        ],
      });
    }
  }

  return { status: "ADJUSTED", previousStock: current, newStock: target, diff };
}
