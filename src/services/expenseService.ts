import { prisma } from "@/lib/prisma";
import { Decimal, round2, toDecimal } from "@/lib/decimal";
import { createJournalEntry, assertPeriodOpen } from "./accountingService";
import { createSafeAuditLog } from "@/lib/auditHelper";

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
    const date = input.date ? (input.date instanceof Date ? input.date : new Date(input.date)) : new Date();
    await assertPeriodOpen(tx, businessId, date);

    const amount = round2(input.amount);
    if (amount.lte(0)) {
      throw new Error("Expense amount must be greater than zero.");
    }

    let category = categoryId ? await tx.expenseCategory.findUnique({ where: { id: categoryId } }) : null;
    if (!category) {
      category = await tx.expenseCategory.findFirst({ where: { businessId } });
    }
    if (!category) {
      category = await tx.expenseCategory.create({
        data: { businessId, name: "General Expense", isDefault: true },
      });
    }

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

    if (!targetCashBank) {
      targetCashBank = await tx.cashBankAccount.findFirst({
        where: { businessId },
      });
    }

    if (!targetCashBank) {
      targetCashBank = await tx.cashBankAccount.create({
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

    // 1. Create Expense record
    const expense = await tx.expense.create({
      data: {
        businessId,
        categoryId: category.id,
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
    // Find or map account code to specific Chart of Accounts head
    const cleanCategoryName = (category.name || "").split("(")[0].trim().toLowerCase();

    const categoryCodeMap: Record<string, string> = {
      rent: "6010",
      salar: "6020",
      wage: "6020",
      electr: "6030",
      utilit: "6030",
      internet: "6040",
      mobile: "6040",
      phone: "6040",
      transport: "6050",
      fuel: "6050",
      travel: "6050",
      repair: "6060",
      maint: "6060",
      suppl: "6070",
      station: "6070",
      market: "6080",
      advertis: "6080",
      bank: "6090",
      fee: "6090",
      legal: "6100",
      audit: "6100",
      prof: "6100",
      misc: "6990",
    };

    let targetCode: string | null = null;
    for (const [kw, code] of Object.entries(categoryCodeMap)) {
      if (cleanCategoryName.includes(kw)) {
        targetCode = code;
        break;
      }
    }

    let expenseAccount = null;
    if (targetCode) {
      expenseAccount = await tx.account.findFirst({
        where: { businessId, code: targetCode },
      });
    }

    if (!expenseAccount) {
      expenseAccount = await tx.account.findFirst({
        where: {
          businessId,
          type: "EXPENSE",
          name: { contains: cleanCategoryName, mode: "insensitive" },
        },
      });
    }

    const accountCode = expenseAccount ? expenseAccount.code : "6990"; // default to Miscellaneous Expense

    const paidToInfo = paidTo ? ` (Paid to: ${paidTo})` : "";
    await createJournalEntry(tx, {
      businessId,
      date,
      description: `Expense: ${description} (${category.name})${paidToInfo}`,
      referenceType: "EXPENSE",
      referenceId: expense.id,
      createdById,
      lines: [
        {
          accountCode,
          debit: amount,
          credit: new Decimal(0),
          description: `${category.name}: ${description}${paidToInfo}`,
        },
        {
          accountCode: targetCashBank?.type === "BANK" ? "1020" : "1010",
          debit: new Decimal(0),
          credit: amount,
          description: `Disbursement from ${targetCashBank?.name || paymentMethod} for ${description}`,
        },
      ],
    });

    // 4. Audit Log
    await createSafeAuditLog(tx, {
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
    });

    return expense;
  });
}
