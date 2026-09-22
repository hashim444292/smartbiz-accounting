import { prisma } from "@/lib/prisma";
import { Decimal, round2, toDecimal } from "@/lib/decimal";
import { createJournalEntry, assertPeriodOpen } from "./accountingService";

export interface CreateExpenseInput {
  businessId: string;
  categoryId: string;
  amount: Decimal.Value;
  description: string;
  paymentMethod?: string;
  accountId?: string | null;
  paidTo?: string;
  receiptUrl?: string;
  notes?: string;
  createdById?: string;
  createdByName?: string;
  branchId?: string | null;
  date?: Date;
}

export async function createAndPostExpense(input: CreateExpenseInput) {
  return await prisma.$transaction(async (tx) => {
    const { businessId, categoryId, description, paymentMethod = "CASH", accountId, paidTo, receiptUrl, notes, createdById, createdByName, branchId } = input;
    const date = input.date || new Date();
    await assertPeriodOpen(tx, businessId, date);

    const amount = round2(input.amount);
    if (amount.lte(0)) {
      throw new Error("Expense amount must be greater than zero.");
    }

    const category = await tx.expenseCategory.findUnique({ where: { id: categoryId } });
    if (!category) throw new Error("Expense category not found.");

    // Resolve cash/bank account
    let targetCashBank = accountId
      ? await tx.cashBankAccount.findUnique({ where: { id: accountId } })
      : await tx.cashBankAccount.findFirst({
          where: { businessId, isDefault: true, isActive: true },
        });

    if (!targetCashBank) {
      targetCashBank = await tx.cashBankAccount.findFirst({
        where: { businessId, type: "CASH", isActive: true },
      });
    }

    // 1. Create Expense record
    const expense = await tx.expense.create({
      data: {
        businessId,
        categoryId,
        date,
        description,
        amount: amount.toNumber(),
        paymentMethod,
        accountId: targetCashBank?.id || null,
        paidTo,
        receiptUrl,
        branchId: branchId || null,
        createdById,
        createdByName,
      },
      include: {
        category: true,
      },
    });

    // 2. Reduce Cash/Bank account balance
    if (targetCashBank) {
      const newBal = toDecimal(targetCashBank.balance).sub(amount);
      await tx.cashBankAccount.update({
        where: { id: targetCashBank.id },
        data: { balance: newBal.toNumber() },
      });
    }

    // 3. Balanced Journal Entry
    // Find or map account code
    // Check if there is an account matching category name or use general operating expense
    const expenseAccount = await tx.account.findFirst({
      where: {
        businessId,
        type: "EXPENSE",
        name: { contains: category.name, mode: "insensitive" },
      },
    });

    const accountCode = expenseAccount ? expenseAccount.code : "6990"; // default to Miscellaneous Expense

    await createJournalEntry(tx, {
      businessId,
      date,
      description: `Expense: ${category.name} - ${description}`,
      referenceType: "EXPENSE",
      referenceId: expense.id,
      createdById,
      lines: [
        {
          accountCode,
          debit: amount,
          credit: new Decimal(0),
          description: `${category.name}: ${description}`,
        },
        {
          accountCode: targetCashBank?.type === "BANK" ? "1020" : "1010",
          debit: new Decimal(0),
          credit: amount,
          description: `Paid via ${targetCashBank?.name || paymentMethod}`,
        },
      ],
    });

    // 4. Audit Log
    await tx.auditLog.create({
      data: {
        businessId,
        userId: createdById || null,
        userName: createdByName || null,
        branchId: branchId || null,
        action: "CREATE_EXPENSE",
        entity: "Expense",
        entityId: expense.id,
        details: JSON.stringify({
          category: category.name,
          amount: amount.toString(),
          paidTo,
        }),
      },
    });

    return expense;
  });
}
