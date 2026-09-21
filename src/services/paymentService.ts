import { prisma } from "@/lib/prisma";
import { Decimal, round2, toDecimal } from "@/lib/decimal";
import { PaymentType, PartyType, Prisma } from "@prisma/client";
import { createJournalEntry, assertPeriodOpen } from "./accountingService";

export interface RecordCustomerPaymentInput {
  businessId: string;
  customerId: string;
  amount: Decimal.Value;
  paymentMethod?: string;
  accountId: string;
  referenceNumber?: string;
  notes?: string;
  saleId?: string;
  allocations?: Array<{ saleId: string; amount: Decimal.Value }>;
  createdById?: string;
  date?: Date;
}

export interface RecordSupplierPaymentInput {
  businessId: string;
  supplierId: string;
  amount: Decimal.Value;
  paymentMethod?: string;
  accountId: string;
  referenceNumber?: string;
  notes?: string;
  allocations?: Array<{ purchaseId: string; amount: Decimal.Value }>;
  createdById?: string;
  date?: Date;
}

export interface TransferFundsInput {
  businessId: string;
  fromAccountId: string;
  toAccountId: string;
  amount: Decimal.Value;
  notes?: string;
  referenceNumber?: string;
  createdById?: string;
  date?: Date;
}

/**
 * Records a customer payment received against receivables and invoices.
 */
export async function recordCustomerPayment(input: RecordCustomerPaymentInput) {
  return await prisma.$transaction(async (tx) => {
    const { businessId, customerId, accountId, referenceNumber, notes, createdById } = input;
    const date = input.date || new Date();
    await assertPeriodOpen(tx, businessId, date);

    const paymentAmount = round2(input.amount);
    if (paymentAmount.lte(0)) {
      throw new Error("Payment amount must be greater than zero.");
    }

    const customer = await tx.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new Error("Customer not found.");

    const bankAccount = await tx.cashBankAccount.findUnique({ where: { id: accountId } });
    if (!bankAccount) throw new Error("Cash/Bank account not found.");

    // 1. Create Payment record
    const payment = await tx.payment.create({
      data: {
        businessId,
        type: "RECEIPT",
        date,
        partyType: "CUSTOMER",
        customerId,
        partyName: customer.name,
        amount: paymentAmount.toNumber(),
        paymentMethod: input.paymentMethod || "CASH",
        accountId,
        referenceNumber,
        notes,
        createdById,
      },
    });

    // 2. Handle invoice allocations (Explicit, Single Sale, or FIFO Auto-Allocation)
    let allocationsToProcess: Array<{ saleId: string; amount: Decimal.Value }> = input.allocations
      ? [...input.allocations]
      : [];

    if (allocationsToProcess.length === 0) {
      if (input.saleId) {
        allocationsToProcess.push({ saleId: input.saleId, amount: paymentAmount });
      } else {
        // Automatically allocate payment to oldest unpaid / partial sales (FIFO)
        const openSales = await tx.sale.findMany({
          where: {
            customerId,
            businessId,
            paymentStatus: { in: ["UNPAID", "PARTIAL"] },
          },
          orderBy: { date: "asc" },
        });

        let availableCash = paymentAmount;
        for (const s of openSales) {
          if (availableCash.lte(0)) break;
          const rem = toDecimal(s.remainingAmount);
          if (rem.lte(0)) continue;
          const allocAmt = Decimal.min(availableCash, rem);
          allocationsToProcess.push({ saleId: s.id, amount: allocAmt });
          availableCash = availableCash.sub(allocAmt);
        }
      }
    }

    if (allocationsToProcess.length > 0) {
      let allocatedTotal = new Decimal(0);

      for (const alloc of allocationsToProcess) {
        const allocAmt = round2(alloc.amount);
        if (allocAmt.lte(0)) continue;

        const sale = await tx.sale.findUnique({ where: { id: alloc.saleId } });
        if (!sale) throw new Error(`Sale #${alloc.saleId} not found.`);

        const currentPaid = toDecimal(sale.paidAmount);
        const currentRemaining = toDecimal(sale.remainingAmount);

        if (allocAmt.gt(currentRemaining)) {
          throw new Error(
            `Allocated amount (${allocAmt}) exceeds remaining balance (${currentRemaining}) on sale #${sale.invoiceNumber}.`
          );
        }

        const newPaid = currentPaid.add(allocAmt);
        const newRemaining = Decimal.max(0, currentRemaining.sub(allocAmt));
        const status = newRemaining.isZero() ? "PAID" : "PARTIAL";

        await tx.sale.update({
          where: { id: sale.id },
          data: {
            paidAmount: newPaid.toNumber(),
            remainingAmount: newRemaining.toNumber(),
            paymentStatus: status,
          },
        });

        await tx.paymentAllocation.create({
          data: {
            paymentId: payment.id,
            saleId: sale.id,
            amount: allocAmt.toNumber(),
          },
        });

        allocatedTotal = allocatedTotal.add(allocAmt);
      }

      if (allocatedTotal.gt(paymentAmount)) {
        throw new Error("Total allocated amount exceeds the total payment received.");
      }
    }

    // 3. Update customer running balance (reduces receivable)
    const newCustBal = Decimal.max(0, toDecimal(customer.currentBalance).sub(paymentAmount));
    await tx.customer.update({
      where: { id: customerId },
      data: { currentBalance: newCustBal.toNumber() },
    });

    // 4. Update Cash/Bank account balance (increases cash/bank)
    const newBankBal = toDecimal(bankAccount.balance).add(paymentAmount);
    await tx.cashBankAccount.update({
      where: { id: accountId },
      data: { balance: newBankBal.toNumber() },
    });

    // 5. Balanced Journal Entry
    // Debit Cash/Bank
    // Credit Accounts Receivable (1100)
    await createJournalEntry(tx, {
      businessId,
      date,
      description: `Payment received from ${customer.name} (${referenceNumber || "Receipt"})`,
      referenceType: "PAYMENT",
      referenceId: payment.id,
      createdById,
      lines: [
        {
          accountCode: bankAccount.type === "BANK" ? "1020" : "1010",
          debit: paymentAmount,
          credit: new Decimal(0),
          description: `Received in ${bankAccount.name}`,
        },
        {
          accountCode: "1100", // Accounts Receivable
          debit: new Decimal(0),
          credit: paymentAmount,
          description: `Payment by ${customer.name}`,
        },
      ],
    });

    // 6. Audit Log
    await tx.auditLog.create({
      data: {
        businessId,
        userId: createdById || null,
        action: "CUSTOMER_PAYMENT",
        entity: "Payment",
        entityId: payment.id,
        details: JSON.stringify({
          customerName: customer.name,
          amount: paymentAmount.toString(),
          accountName: bankAccount.name,
        }),
      },
    });

    return payment;
  });
}

/**
 * Records a supplier payment disbursement against payables and purchase invoices.
 */
export async function recordSupplierPayment(input: RecordSupplierPaymentInput) {
  return await prisma.$transaction(async (tx) => {
    const { businessId, supplierId, accountId, referenceNumber, notes, createdById } = input;
    const date = input.date || new Date();
    await assertPeriodOpen(tx, businessId, date);

    const paymentAmount = round2(input.amount);
    if (paymentAmount.lte(0)) {
      throw new Error("Payment amount must be greater than zero.");
    }

    const supplier = await tx.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) throw new Error("Supplier not found.");

    const bankAccount = await tx.cashBankAccount.findUnique({ where: { id: accountId } });
    if (!bankAccount) throw new Error("Cash/Bank account not found.");

    // 1. Create Payment record
    const payment = await tx.payment.create({
      data: {
        businessId,
        type: "DISBURSEMENT",
        date,
        partyType: "SUPPLIER",
        supplierId,
        partyName: supplier.name,
        amount: paymentAmount.toNumber(),
        paymentMethod: input.paymentMethod || "CASH",
        accountId,
        referenceNumber,
        notes,
        createdById,
      },
    });

    // 2. Handle purchase invoice allocations
    if (input.allocations && input.allocations.length > 0) {
      let allocatedTotal = new Decimal(0);

      for (const alloc of input.allocations) {
        const allocAmt = round2(alloc.amount);
        if (allocAmt.lte(0)) continue;

        const purchase = await tx.purchase.findUnique({ where: { id: alloc.purchaseId } });
        if (!purchase) throw new Error(`Purchase #${alloc.purchaseId} not found.`);

        const currentPaid = toDecimal(purchase.paidAmount);
        const currentRemaining = toDecimal(purchase.remainingAmount);

        if (allocAmt.gt(currentRemaining)) {
          throw new Error(
            `Allocated amount (${allocAmt}) exceeds remaining payable (${currentRemaining}) on purchase #${purchase.purchaseNumber}.`
          );
        }

        const newPaid = currentPaid.add(allocAmt);
        const newRemaining = Decimal.max(0, currentRemaining.sub(allocAmt));
        const status = newRemaining.isZero() ? "PAID" : "PARTIAL";

        await tx.purchase.update({
          where: { id: purchase.id },
          data: {
            paidAmount: newPaid.toNumber(),
            remainingAmount: newRemaining.toNumber(),
            paymentStatus: status,
          },
        });

        await tx.paymentAllocation.create({
          data: {
            paymentId: payment.id,
            purchaseId: purchase.id,
            amount: allocAmt.toNumber(),
          },
        });

        allocatedTotal = allocatedTotal.add(allocAmt);
      }

      if (allocatedTotal.gt(paymentAmount)) {
        throw new Error("Total allocated amount exceeds the total payment disbursed.");
      }
    }

    // 3. Update supplier running balance (reduces payable)
    const newSuppBal = Decimal.max(0, toDecimal(supplier.currentBalance).sub(paymentAmount));
    await tx.supplier.update({
      where: { id: supplierId },
      data: { currentBalance: newSuppBal.toNumber() },
    });

    // 4. Update Cash/Bank account balance (decreases cash/bank)
    const newBankBal = toDecimal(bankAccount.balance).sub(paymentAmount);
    await tx.cashBankAccount.update({
      where: { id: accountId },
      data: { balance: newBankBal.toNumber() },
    });

    // 5. Balanced Journal Entry
    // Debit Accounts Payable (2010)
    // Credit Cash/Bank
    await createJournalEntry(tx, {
      businessId,
      date,
      description: `Payment to ${supplier.name} (${referenceNumber || "Disbursement"})`,
      referenceType: "PAYMENT",
      referenceId: payment.id,
      createdById,
      lines: [
        {
          accountCode: "2010", // Accounts Payable
          debit: paymentAmount,
          credit: new Decimal(0),
          description: `Disbursement to ${supplier.name}`,
        },
        {
          accountCode: bankAccount.type === "BANK" ? "1020" : "1010",
          debit: new Decimal(0),
          credit: paymentAmount,
          description: `Paid from ${bankAccount.name}`,
        },
      ],
    });

    // 6. Audit Log
    await tx.auditLog.create({
      data: {
        businessId,
        userId: createdById || null,
        action: "SUPPLIER_PAYMENT",
        entity: "Payment",
        entityId: payment.id,
        details: JSON.stringify({
          supplierName: supplier.name,
          amount: paymentAmount.toString(),
          accountName: bankAccount.name,
        }),
      },
    });

    return payment;
  });
}

/**
 * Transfers funds between cash and bank accounts.
 */
export async function transferFunds(input: TransferFundsInput) {
  return await prisma.$transaction(async (tx) => {
    const { businessId, fromAccountId, toAccountId, referenceNumber, notes, createdById } = input;
    const date = input.date || new Date();
    await assertPeriodOpen(tx, businessId, date);

    if (fromAccountId === toAccountId) {
      throw new Error("Source and destination accounts must be different.");
    }

    const amount = round2(input.amount);
    if (amount.lte(0)) {
      throw new Error("Transfer amount must be greater than zero.");
    }

    const fromAcc = await tx.cashBankAccount.findUnique({ where: { id: fromAccountId } });
    const toAcc = await tx.cashBankAccount.findUnique({ where: { id: toAccountId } });

    if (!fromAcc || !toAcc) throw new Error("Source or destination account not found.");

    // Update balances
    const newFromBal = toDecimal(fromAcc.balance).sub(amount);
    const newToBal = toDecimal(toAcc.balance).add(amount);

    await tx.cashBankAccount.update({
      where: { id: fromAccountId },
      data: { balance: newFromBal.toNumber() },
    });

    await tx.cashBankAccount.update({
      where: { id: toAccountId },
      data: { balance: newToBal.toNumber() },
    });

    // Create payment transfer record
    const payment = await tx.payment.create({
      data: {
        businessId,
        type: "TRANSFER",
        date,
        partyType: "OTHER",
        partyName: `Transfer: ${fromAcc.name} -> ${toAcc.name}`,
        amount: amount.toNumber(),
        paymentMethod: "TRANSFER",
        accountId: fromAccountId,
        targetAccountId: toAccountId,
        referenceNumber,
        notes,
        createdById,
      },
    });

    // Journal Entry: Debit Destination Account, Credit Source Account
    await createJournalEntry(tx, {
      businessId,
      date,
      description: `Transfer from ${fromAcc.name} to ${toAcc.name}`,
      referenceType: "TRANSFER",
      referenceId: payment.id,
      createdById,
      lines: [
        {
          accountCode: toAcc.type === "BANK" ? "1020" : "1010",
          debit: amount,
          credit: new Decimal(0),
          description: `Transfer into ${toAcc.name}`,
        },
        {
          accountCode: fromAcc.type === "BANK" ? "1020" : "1010",
          debit: new Decimal(0),
          credit: amount,
          description: `Transfer out of ${fromAcc.name}`,
        },
      ],
    });

    return payment;
  });
}
