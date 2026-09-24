import { prisma } from "@/lib/prisma";
import { Decimal, round2, round4, toDecimal, calculateLineTotal } from "@/lib/decimal";
import { PaymentStatus, Prisma } from "@prisma/client";
import { recordStockMovement } from "./inventoryService";
import { createJournalEntry, assertPeriodOpen } from "./accountingService";
import { createSafeAuditLog } from "@/lib/auditHelper";

export interface PurchaseItemInput {
  productId: string;
  quantity: Decimal.Value;
  unitCost: Decimal.Value;
  discount?: Decimal.Value;
  taxRate?: Decimal.Value;
  newSellingPrice?: Decimal.Value;
  updateCatalogPrice?: boolean;
}

export interface CreatePurchaseInput {
  businessId: string;
  purchaseNumber?: string;
  date?: Date;
  supplierId?: string | null;
  supplierName: string;
  items: PurchaseItemInput[];
  overallDiscount?: Decimal.Value;
  paidAmount?: Decimal.Value;
  paymentMethod?: string;
  accountId?: string | null;
  notes?: string;
  createdById?: string;
  createdByName?: string;
}

export async function getNextPurchaseNumber(
  tx: Prisma.TransactionClient,
  businessId: string,
  prefix = "PUR-"
): Promise<string> {
  const count = await tx.purchase.count({
    where: { businessId },
  });
  const year = new Date().getFullYear();
  return `${prefix}${year}-${String(count + 1).padStart(5, "0")}`;
}

export async function createAndPostPurchase(input: CreatePurchaseInput) {
  return await prisma.$transaction(async (tx) => {
    const {
      businessId,
      supplierId,
      supplierName,
      items,
      overallDiscount = 0,
      paymentMethod = "CASH",
      accountId,
      notes,
      createdById,
      createdByName,
    } = input;

    const date = input.date ? (input.date instanceof Date ? input.date : new Date(input.date)) : new Date();
    await assertPeriodOpen(tx, businessId, date);

    if (!items || items.length === 0) {
      throw new Error("A purchase must contain at least one item.");
    }

    const purchaseNumber = input.purchaseNumber || (await getNextPurchaseNumber(tx, businessId));

    let subtotal = new Decimal(0);
    let totalTax = new Decimal(0);
    let totalDiscount = toDecimal(overallDiscount);

    const processedItems: Array<{
      productId: string;
      productName: string;
      sku: string | null;
      quantity: Decimal;
      unitCost: Decimal;
      discount: Decimal;
      taxRate: Decimal;
      taxAmount: Decimal;
      lineTotal: Decimal;
    }> = [];

    for (const item of items) {
      let product = item.productId && item.productId !== "__custom__" ? await tx.product.findUnique({
        where: { id: item.productId },
      }) : null;

      if (!product && (item as any).productName) {
        product = await tx.product.findFirst({
          where: { businessId, name: { equals: (item as any).productName.trim(), mode: "insensitive" } },
        });
      }

      if (!product && (item as any).productName) {
        const defaultCat = await tx.category.findFirst({ where: { businessId } });
        product = await tx.product.create({
          data: {
            businessId,
            name: (item as any).productName.trim(),
            sku: item.productId && item.productId !== "__custom__" && !item.productId.startsWith("prod-") ? item.productId : `SKU-${Date.now().toString().slice(-6)}`,
            purchasePrice: Number(item.unitCost || 0),
            sellingPrice: Number((item as any).newSellingPrice || (Number(item.unitCost || 0) * 1.25)),
            currentStock: 0,
            categoryId: defaultCat?.id || null,
            unit: "pcs",
          },
        });
      }

      if (!product) {
        throw new Error(`Product '${(item as any).productName || item.productId}' not found in catalog.`);
      }

      const q = round4(item.quantity);
      const c = round2(item.unitCost ?? (item as any).purchasePrice ?? (item as any).price ?? 0);
      const d = round2(item.discount || 0);
      const tr = round2(item.taxRate || 0);

      const calc = calculateLineTotal(q, c, d, tr);

      subtotal = subtotal.add(calc.subtotal);
      totalTax = totalTax.add(calc.taxAmount);
      totalDiscount = totalDiscount.add(d);

      processedItems.push({
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        quantity: q,
        unitCost: c,
        discount: d,
        taxRate: tr,
        taxAmount: calc.taxAmount,
        lineTotal: calc.lineTotal,
      });
    }

    const baseAfterDiscount = Decimal.max(0, subtotal.sub(toDecimal(overallDiscount)));
    const totalAmount = round2(baseAfterDiscount.add(totalTax));
    const paidAmount = round2(input.paidAmount || 0);
    const remainingAmount = round2(Decimal.max(0, totalAmount.sub(paidAmount)));

    let paymentStatus: PaymentStatus = "UNPAID";
    if (paidAmount.gte(totalAmount) && totalAmount.gt(0)) {
      paymentStatus = "PAID";
    } else if (paidAmount.gt(0)) {
      paymentStatus = "PARTIAL";
    }

    // Validate supplier exists in DB before using as foreign key
    let validSupplierId: string | null = null;
    let resolvedSupplierName: string = (supplierName || "").trim();
    if (supplierId) {
      const supExists = await tx.supplier.findUnique({ where: { id: supplierId } });
      if (supExists) {
        validSupplierId = supplierId;
        if (!resolvedSupplierName) {
          resolvedSupplierName = supExists.name;
        }
      }
    }
    if (!resolvedSupplierName) {
      resolvedSupplierName = "General Supplier";
    }

    // 1. Create Purchase record
    const purchase = await tx.purchase.create({
      data: {
        businessId,
        purchaseNumber,
        date,
        supplierId: validSupplierId,
        supplierName: resolvedSupplierName,
        subtotal: subtotal.toNumber(),
        discountAmount: totalDiscount.toNumber(),
        taxAmount: totalTax.toNumber(),
        totalAmount: totalAmount.toNumber(),
        paidAmount: paidAmount.toNumber(),
        remainingAmount: remainingAmount.toNumber(),
        paymentStatus,
        paymentMethod,
        notes,
        createdById,
        createdByName,
        items: {
          create: processedItems.map((pi) => ({
            productId: pi.productId,
            productName: pi.productName,
            sku: pi.sku,
            quantity: pi.quantity.toNumber(),
            unitCost: pi.unitCost.toNumber(),
            discount: pi.discount.toNumber(),
            taxRate: pi.taxRate.toNumber(),
            taxAmount: pi.taxAmount.toNumber(),
            lineTotal: pi.lineTotal.toNumber(),
          })),
        },
      },
      include: { items: true },
    });

    // 2. Increase Inventory and update Weighted Average Cost
    for (let i = 0; i < processedItems.length; i++) {
      const pi = processedItems[i];
      const rawItem = items[i];
      await recordStockMovement(tx, {
        businessId,
        productId: pi.productId,
        type: "PURCHASE",
        quantity: pi.quantity,
        unitCost: pi.unitCost,
        referenceType: "PURCHASE",
        referenceId: purchase.id,
        notes: `Purchase invoice #${purchaseNumber} from ${supplierName}`,
        date,
      });

      const updateData: any = {
        purchasePrice: pi.unitCost.toNumber(),
      };
      if (rawItem?.updateCatalogPrice && rawItem?.newSellingPrice && Number(rawItem.newSellingPrice) > 0) {
        updateData.sellingPrice = Number(rawItem.newSellingPrice);
        updateData.retailPrice = Number(rawItem.newSellingPrice);
      }
      await tx.product.update({
        where: { id: pi.productId },
        data: updateData,
      });
    }

    // 3. Update Supplier balance (credit purchase)
    if (supplierId && remainingAmount.gt(0)) {
      const supplier = await tx.supplier.findUnique({ where: { id: supplierId } });
      if (supplier) {
        const newBal = toDecimal(supplier.currentBalance).add(remainingAmount);
        await tx.supplier.update({
          where: { id: supplierId },
          data: { currentBalance: newBal.toNumber() },
        });
      }
    }

    // 4. Update Cash/Bank account if paid at time of purchase
    if (paidAmount.gt(0)) {
      let cashBank = accountId
        ? await tx.cashBankAccount.findUnique({ where: { id: accountId } })
        : await tx.cashBankAccount.findFirst({
            where: { businessId, isDefault: true, isActive: true },
          });

      if (!cashBank) {
        cashBank = await tx.cashBankAccount.findFirst({
          where: { businessId, type: "CASH", isActive: true },
        });
      }

      if (!cashBank) {
        cashBank = await tx.cashBankAccount.findFirst({
          where: { businessId },
        });
      }

      if (!cashBank) {
        cashBank = await tx.cashBankAccount.create({
          data: {
            businessId,
            name: "Cash in Hand",
            type: "CASH",
            balance: 0,
            isDefault: true,
            isActive: true,
          },
        });
      }

      if (cashBank) {
        const newBal = toDecimal(cashBank.balance).sub(paidAmount);
        await tx.cashBankAccount.update({
          where: { id: cashBank.id },
          data: { balance: newBal.toNumber() },
        });

        // Record a payment disbursement linked to this purchase
        await tx.payment.create({
          data: {
            businessId,
            type: "DISBURSEMENT",
            date,
            partyType: "SUPPLIER",
            supplierId: supplierId || null,
            partyName: supplierName,
            amount: paidAmount.toNumber(),
            paymentMethod,
            accountId: cashBank.id,
            referenceNumber: purchaseNumber,
            notes: `Payment made for purchase ${purchaseNumber}`,
            createdById,
            allocations: {
              create: {
                purchaseId: purchase.id,
                amount: paidAmount.toNumber(),
              },
            },
          },
        });
      }
    }

    // 5. Balanced Double-Entry Journal Entry
    // Debit Merchandise Inventory (1200) for totalAmount
    // Credit Cash/Bank (1010/1020) for paidAmount
    // Credit Accounts Payable (2010) for remainingAmount
    const journalLines: Array<{ accountCode: string; debit: Decimal; credit: Decimal; description?: string }> = [
      {
        accountCode: "1200",
        debit: totalAmount,
        credit: new Decimal(0),
        description: `Purchased goods on #${purchaseNumber}`,
      },
    ];

    if (paidAmount.gt(0)) {
      journalLines.push({
        accountCode: paymentMethod === "BANK" ? "1020" : "1010",
        debit: new Decimal(0),
        credit: paidAmount,
        description: `Payment for purchase #${purchaseNumber}`,
      });
    }

    if (remainingAmount.gt(0)) {
      journalLines.push({
        accountCode: "2010", // Accounts Payable
        debit: new Decimal(0),
        credit: remainingAmount,
        description: `Payable to ${supplierName} for #${purchaseNumber}`,
      });
    }

    await createJournalEntry(tx, {
      businessId,
      date,
      description: `Purchase Invoice #${purchaseNumber} from ${supplierName}`,
      referenceType: "PURCHASE",
      referenceId: purchase.id,
      createdById,
      lines: journalLines,
    });

    // 6. Audit Log
    await createSafeAuditLog(tx, {
      businessId,
      userId: createdById || null,
      userName: createdByName || null,
      branchId: purchase.branchId,
      action: "CREATE_PURCHASE",
      entity: "Purchase",
      entityId: purchase.id,
      details: JSON.stringify({
        purchaseNumber,
        supplierName,
        totalAmount: totalAmount.toString(),
        paidAmount: paidAmount.toString(),
      }),
    });

    return purchase;
  });
}
