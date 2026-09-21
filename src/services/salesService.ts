import { prisma } from "@/lib/prisma";
import { Decimal, round2, round4, toDecimal, calculateLineTotal } from "@/lib/decimal";
import { PaymentStatus, TransactionStatus, Prisma } from "@prisma/client";
import { recordStockMovement } from "./inventoryService";
import { createJournalEntry, assertPeriodOpen } from "./accountingService";

export interface SaleItemInput {
  productId: string;
  quantity: Decimal.Value;
  unitPrice: Decimal.Value;
  discount?: Decimal.Value;
  taxRate?: Decimal.Value;
  hsCode?: string;
}

export interface CreateSaleInput {
  businessId: string;
  invoiceNumber?: string;
  date?: Date;
  customerId?: string | null;
  customerName: string;
  items: SaleItemInput[];
  overallDiscount?: Decimal.Value;
  paidAmount?: Decimal.Value;
  paymentMethod?: string;
  accountId?: string | null;
  notes?: string;
  createdById?: string;
  customerPhone?: string;
  salesTax?: Decimal.Value;
  furtherTax?: Decimal.Value;
  extraTax?: Decimal.Value;
  posFee?: Decimal.Value;
  fbrStatus?: string;
  fbrInvoiceNumber?: string;
  fbrQrCode?: string;
}

/**
 * Generates the next sequential invoice number
 */
export async function getNextInvoiceNumber(
  tx: Prisma.TransactionClient,
  businessId: string,
  prefix = "INV-"
): Promise<string> {
  const count = await tx.sale.count({
    where: { businessId },
  });
  const year = new Date().getFullYear();
  return `${prefix}${year}-${String(count + 1).padStart(5, "0")}`;
}

/**
 * Creates and posts a Sale transaction atomically with inventory stock deduction,
 * customer ledger update, cash/bank update, balanced journal entries, and audit logging.
 */
export async function createAndPostSale(input: CreateSaleInput) {
  return await prisma.$transaction(async (tx) => {
    const {
      businessId,
      customerId,
      customerName,
      items,
      overallDiscount = 0,
      paymentMethod = "CASH",
      accountId,
      notes,
      createdById,
    } = input;

    const date = input.date || new Date();
    await assertPeriodOpen(tx, businessId, date);

    if (!items || items.length === 0) {
      throw new Error("A sale must contain at least one item.");
    }

    const invoiceNumber = input.invoiceNumber || (await getNextInvoiceNumber(tx, businessId));

    // 1. Calculate line items totals, taxes, and costs
    let subtotal = new Decimal(0);
    let totalTax = new Decimal(0);
    let totalDiscount = toDecimal(overallDiscount);
    let totalCOGS = new Decimal(0);

    const processedItems: Array<{
      productId: string;
      productName: string;
      sku: string | null;
      hsCode: string | null;
      quantity: Decimal;
      unitPrice: Decimal;
      discount: Decimal;
      taxRate: Decimal;
      taxAmount: Decimal;
      lineTotal: Decimal;
      costPrice: Decimal;
    }> = [];

    for (const item of items) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
      });
      if (!product) {
        throw new Error(`Product with ID ${item.productId} not found.`);
      }

      const q = round4(item.quantity);
      const p = round2(item.unitPrice);
      const d = round2(item.discount || 0);
      const tr = round2(item.taxRate || 0);

      const calc = calculateLineTotal(q, p, d, tr);
      const costPrice = toDecimal(product.averageCost);
      const lineCost = round2(q.mul(costPrice));

      subtotal = subtotal.add(calc.subtotal);
      totalTax = totalTax.add(calc.taxAmount);
      totalDiscount = totalDiscount.add(d);
      totalCOGS = totalCOGS.add(lineCost);

      processedItems.push({
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        hsCode: item.hsCode || product.hsCode || "8517.13",
        quantity: q,
        unitPrice: p,
        discount: d,
        taxRate: tr,
        taxAmount: calc.taxAmount,
        lineTotal: calc.lineTotal,
        costPrice,
      });
    }

    // Grand Total: (subtotal - overallDiscount) + taxes + posFee
    const posFee = toDecimal(input.posFee || 0);
    const salesTaxVal = input.salesTax !== undefined ? toDecimal(input.salesTax) : totalTax;
    const furtherTaxVal = toDecimal(input.furtherTax || 0);
    const extraTaxVal = toDecimal(input.extraTax || 0);

    const calculatedTax = salesTaxVal.add(furtherTaxVal).add(extraTaxVal);
    const baseAfterDiscount = Decimal.max(0, subtotal.sub(toDecimal(overallDiscount)));
    const totalAmount = round2(baseAfterDiscount.add(calculatedTax).add(posFee));
    const paidAmount = round2(input.paidAmount !== undefined ? input.paidAmount : totalAmount);
    const remainingAmount = round2(Decimal.max(0, totalAmount.sub(paidAmount)));

    let paymentStatus: PaymentStatus = "UNPAID";
    if (paidAmount.gte(totalAmount) && totalAmount.gt(0)) {
      paymentStatus = "PAID";
    } else if (paidAmount.gt(0)) {
      paymentStatus = "PARTIAL";
    }

    const isFbrDirect = input.fbrStatus === "SUCCESS";
    const fbrInvNumber = isFbrDirect ? (input.fbrInvoiceNumber || `FBR-POS-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`) : null;
    const fbrQr = isFbrDirect ? (input.fbrQrCode || `https://e.fbr.gov.pk/verify?inv=${encodeURIComponent(fbrInvNumber!)}&pos=POS-101&amt=${totalAmount.toNumber()}`) : null;

    // 2. Create the Sale record
    const sale = await tx.sale.create({
      data: {
        businessId,
        invoiceNumber,
        date,
        customerId: customerId || null,
        customerName,
        subtotal: subtotal.toNumber(),
        discountAmount: totalDiscount.toNumber(),
        taxAmount: calculatedTax.toNumber(),
        salesTax: salesTaxVal.toNumber(),
        furtherTax: furtherTaxVal.toNumber(),
        extraTax: extraTaxVal.toNumber(),
        totalAmount: totalAmount.toNumber(),
        paidAmount: paidAmount.toNumber(),
        remainingAmount: remainingAmount.toNumber(),
        paymentStatus,
        paymentMethod,
        notes,
        status: "POSTED",
        fbrStatus: input.fbrStatus || "PENDING",
        fbrInvoiceNumber: fbrInvNumber,
        fbrQrCode: fbrQr,
        createdById,
        items: {
          create: processedItems.map((pi) => ({
            productId: pi.productId,
            productName: pi.productName,
            sku: pi.sku,
            hsCode: pi.hsCode,
            quantity: pi.quantity.toNumber(),
            unitPrice: pi.unitPrice.toNumber(),
            discount: pi.discount.toNumber(),
            taxRate: pi.taxRate.toNumber(),
            taxAmount: pi.taxAmount.toNumber(),
            lineTotal: pi.lineTotal.toNumber(),
            costPrice: pi.costPrice.toNumber(),
          })),
        },
      },
      include: {
        items: true,
      },
    });

    // 3. Deduct inventory for each item sold
    for (const pi of processedItems) {
      await recordStockMovement(tx, {
        businessId,
        productId: pi.productId,
        type: "SALE",
        quantity: pi.quantity,
        unitCost: pi.costPrice,
        referenceType: "SALE",
        referenceId: sale.id,
        notes: `Sale invoice #${invoiceNumber}`,
        date,
      });
    }

    // 4. Update Customer receivable balance
    let effectiveCustomerId = customerId;
    if (customerId && remainingAmount.gt(0)) {
      const customer = await tx.customer.findUnique({ where: { id: customerId } });
      if (customer) {
        const newBalance = toDecimal(customer.currentBalance).add(remainingAmount);
        await tx.customer.update({
          where: { id: customerId },
          data: { currentBalance: newBalance.toNumber() },
        });
      }
    } else if (!customerId && remainingAmount.gt(0) && customerName && !customerName.toLowerCase().startsWith("walk in (walk in)")) {
      let existingCust = await tx.customer.findFirst({
        where: { businessId, name: customerName },
      });
      if (!existingCust) {
        existingCust = await tx.customer.create({
          data: {
            businessId,
            name: customerName,
            phone: input.customerPhone || null,
            currentBalance: remainingAmount.toNumber(),
          },
        });
      } else {
        await tx.customer.update({
          where: { id: existingCust.id },
          data: {
            currentBalance: toDecimal(existingCust.currentBalance).add(remainingAmount).toNumber(),
            ...(input.customerPhone && !existingCust.phone ? { phone: input.customerPhone } : {}),
          },
        });
      }
      effectiveCustomerId = existingCust.id;
      await tx.sale.update({
        where: { id: sale.id },
        data: { customerId: existingCust.id },
      });
    }

    // 5. Update Cash/Bank account balance if payment was received
    let targetCashBankAccountId = accountId;
    if (paidAmount.gt(0)) {
      let cashBank = targetCashBankAccountId
        ? await tx.cashBankAccount.findUnique({ where: { id: targetCashBankAccountId } })
        : await tx.cashBankAccount.findFirst({
            where: { businessId, isDefault: true, isActive: true },
          });

      if (!cashBank) {
        // Find any active cash account or create default
        cashBank = await tx.cashBankAccount.findFirst({
          where: { businessId, type: "CASH", isActive: true },
        });
      }

      if (cashBank) {
        targetCashBankAccountId = cashBank.id;
        const newBal = toDecimal(cashBank.balance).add(paidAmount);
        await tx.cashBankAccount.update({
          where: { id: cashBank.id },
          data: { balance: newBal.toNumber() },
        });

        // Record a payment receipt linked to this sale
        await tx.payment.create({
          data: {
            businessId,
            type: "RECEIPT",
            date,
            partyType: "CUSTOMER",
            customerId: effectiveCustomerId || null,
            partyName: customerName,
            amount: paidAmount.toNumber(),
            paymentMethod,
            accountId: cashBank.id,
            referenceNumber: invoiceNumber,
            notes: `Payment received against sale ${invoiceNumber}`,
            createdById,
            allocations: {
              create: {
                saleId: sale.id,
                amount: paidAmount.toNumber(),
              },
            },
          },
        });
      }
    }

    // 6. Create Balanced Double-Entry Journal Entry
    // Revenue entry:
    // Debit Cash/Bank (for paid amount)
    // Debit Accounts Receivable (for remaining amount)
    // Credit Sales Revenue (for total amount)
    const journalLines: Array<{ accountCode: string; debit: Decimal; credit: Decimal; description?: string }> = [];

    if (paidAmount.gt(0)) {
      journalLines.push({
        accountCode: paymentMethod === "BANK" ? "1020" : "1010",
        debit: paidAmount,
        credit: new Decimal(0),
        description: `Payment received for ${invoiceNumber}`,
      });
    }

    if (remainingAmount.gt(0)) {
      journalLines.push({
        accountCode: "1100", // Accounts Receivable
        debit: remainingAmount,
        credit: new Decimal(0),
        description: `Receivable from ${customerName} for ${invoiceNumber}`,
      });
    }

    journalLines.push({
      accountCode: "4010", // Sales Revenue
      debit: new Decimal(0),
      credit: totalAmount,
      description: `Sales revenue for ${invoiceNumber}`,
    });

    await createJournalEntry(tx, {
      businessId,
      date,
      description: `Sale Invoice #${invoiceNumber} to ${customerName}`,
      referenceType: "SALE",
      referenceId: sale.id,
      createdById,
      lines: journalLines,
    });

    // Perpetual Inventory Cost of Goods Sold Entry:
    // Debit COGS (5010)
    // Credit Merchandise Inventory (1200)
    if (totalCOGS.gt(0)) {
      await createJournalEntry(tx, {
        businessId,
        date,
        description: `COGS for Sale Invoice #${invoiceNumber}`,
        referenceType: "SALE",
        referenceId: sale.id,
        createdById,
        lines: [
          { accountCode: "5010", debit: totalCOGS, credit: new Decimal(0), description: "Cost of Goods Sold" },
          { accountCode: "1200", debit: new Decimal(0), credit: totalCOGS, description: "Inventory reduction for sale" },
        ],
      });
    }

    // 7. Audit Log
    await tx.auditLog.create({
      data: {
        businessId,
        userId: createdById || null,
        action: "CREATE_SALE",
        entity: "Sale",
        entityId: sale.id,
        details: JSON.stringify({
          invoiceNumber,
          customerName,
          totalAmount: totalAmount.toString(),
          paidAmount: paidAmount.toString(),
          itemCount: processedItems.length,
        }),
      },
    });

    return sale;
  });
}

/**
 * Reverses a posted sale (Sales Return / Cancellation)
 */
export async function reverseSale(
  saleId: string,
  reason: string,
  userId?: string
) {
  return await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({
      where: { id: saleId },
      include: { items: true },
    });

    if (!sale) throw new Error("Sale not found.");
    if (sale.status === "CANCELLED") throw new Error("Sale is already cancelled.");

    await assertPeriodOpen(tx, sale.businessId, new Date());

    // 1. Mark sale as CANCELLED
    await tx.sale.update({
      where: { id: saleId },
      data: { status: "CANCELLED", notes: `${sale.notes || ""}\n[REVERSED]: ${reason}` },
    });

    // 2. Restock items via SALE_RETURN
    let totalCOGSReversal = new Decimal(0);
    for (const item of sale.items) {
      const q = toDecimal(item.quantity);
      const cost = toDecimal(item.costPrice);
      totalCOGSReversal = totalCOGSReversal.add(q.mul(cost));

      await recordStockMovement(tx, {
        businessId: sale.businessId,
        productId: item.productId,
        type: "SALE_RETURN",
        quantity: q,
        unitCost: cost,
        referenceType: "SALE_RETURN",
        referenceId: sale.id,
        notes: `Reversal of sale #${sale.invoiceNumber}: ${reason}`,
      });
    }

    // 3. Rebalance customer receivables if remaining amount was unpaid
    const remaining = toDecimal(sale.remainingAmount);
    if (sale.customerId && remaining.gt(0)) {
      const customer = await tx.customer.findUnique({ where: { id: sale.customerId } });
      if (customer) {
        const newBal = Decimal.max(0, toDecimal(customer.currentBalance).sub(remaining));
        await tx.customer.update({
          where: { id: sale.customerId },
          data: { currentBalance: newBal.toNumber() },
        });
      }
    }

    // 4. Reverse Journal Entries
    const paid = toDecimal(sale.paidAmount);
    const total = toDecimal(sale.totalAmount);
    const revLines: Array<{ accountCode: string; debit: Decimal; credit: Decimal }> = [];

    revLines.push({ accountCode: "4020", debit: total, credit: new Decimal(0) }); // Sales Returns
    if (paid.gt(0)) {
      revLines.push({ accountCode: "1010", debit: new Decimal(0), credit: paid });
    }
    if (remaining.gt(0)) {
      revLines.push({ accountCode: "1100", debit: new Decimal(0), credit: remaining });
    }

    await createJournalEntry(tx, {
      businessId: sale.businessId,
      date: new Date(),
      description: `Reversal of Sale Invoice #${sale.invoiceNumber} (${reason})`,
      referenceType: "SALE_RETURN",
      referenceId: sale.id,
      createdById: userId,
      lines: revLines,
    });

    if (totalCOGSReversal.gt(0)) {
      await createJournalEntry(tx, {
        businessId: sale.businessId,
        date: new Date(),
        description: `COGS Reversal for #${sale.invoiceNumber}`,
        referenceType: "SALE_RETURN",
        referenceId: sale.id,
        createdById: userId,
        lines: [
          { accountCode: "1200", debit: totalCOGSReversal, credit: new Decimal(0) },
          { accountCode: "5010", debit: new Decimal(0), credit: totalCOGSReversal },
        ],
      });
    }

    // 5. Audit Log
    await tx.auditLog.create({
      data: {
        businessId: sale.businessId,
        userId: userId || null,
        action: "REVERSE_SALE",
        entity: "Sale",
        entityId: sale.id,
        details: JSON.stringify({ invoiceNumber: sale.invoiceNumber, reason }),
      },
    });

    return { status: "REVERSED", saleId };
  });
}
