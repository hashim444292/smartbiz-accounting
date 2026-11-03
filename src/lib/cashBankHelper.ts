import { PrismaClient } from "@prisma/client";
import { fallbackStore } from "@/lib/fallbackStore";
import { Decimal, round2, toDecimal } from "@/lib/decimal";

export interface CashBankReconciliationResult {
  openingCash: number;
  openingBank: number;
  openingTotal: number;
  totalReceipts: number;
  totalDisbursements: number;
  totalExpenses: number;
  cashExpenses?: number;
  bankExpenses?: number;
  netMovement: number;
  closingCash: number;
  closingBank: number;
  closingTotal: number;
  accounts: Array<{
    id: string;
    name: string;
    type: string;
    accountNumber?: string | null;
    bankName?: string | null;
    openingBalance: number;
    receipts: number;
    disbursements: number;
    expenses?: number;
    balance: number;
  }>;
}

/**
 * Universal calculation of Cash & Bank balances adjusted with opening balances and net flow.
 */
export function calculateCashBankSummary(
  accounts: any[] = [],
  payments: any[] = [],
  openingJournal: any = null,
  expenses: any[] = []
): CashBankReconciliationResult {
  let openingCash = 0;
  let openingBank = 0;

  // 1. Extract true Opening Balances from Opening Balance Journal Entry if present
  if (openingJournal && Array.isArray(openingJournal.lines)) {
    for (const l of openingJournal.lines) {
      const code = String(l.account?.code || l.accountCode || "");
      const dr = Number(l.debit || 0);
      if (code === "1010" || code === "1030") {
        openingCash += dr;
      } else if (code === "1020" || code.startsWith("102")) {
        openingBank += dr;
      }
    }
  }

  // Fallback to account balances if no opening journal entry exists
  if (openingCash === 0 && openingBank === 0) {
    accounts.forEach((a) => {
      const bal = Number(a.openingBalance ?? a.balance ?? 0);
      if (a.type === "BANK") openingBank += bal;
      else openingCash += bal;
    });
  }

  const openingTotal = round2(openingCash + openingBank).toNumber();

  // 2. Compute non-opening operational receipts and disbursements
  let totalReceipts = 0;
  let totalDisbursements = 0;
  let cashReceipts = 0;
  let cashDisbursements = 0;
  let bankReceipts = 0;
  let bankDisbursements = 0;

  const validPayments = Array.isArray(payments) ? payments : [];

  for (const p of validPayments) {
    const amt = Number(p.amount || 0);
    if (amt <= 0) continue;

    const accId = p.accountId;
    const targetAccId = p.targetAccountId;
    const acc = accounts.find((a) => a.id === accId);
    const targetAcc = targetAccId ? accounts.find((a) => a.id === targetAccId) : null;
    const isBank = acc?.type === "BANK";

    if (p.type === "RECEIPT") {
      totalReceipts += amt;
      if (isBank) bankReceipts += amt;
      else cashReceipts += amt;
    } else if (p.type === "DISBURSEMENT") {
      totalDisbursements += amt;
      if (isBank) bankDisbursements += amt;
      else cashDisbursements += amt;
    } else if (p.type === "TRANSFER" || p.type === "CONTRA") {
      // Source account decreases
      if (isBank) bankDisbursements += amt;
      else cashDisbursements += amt;

      // Target account increases
      if (targetAcc?.type === "BANK") bankReceipts += amt;
      else cashReceipts += amt;
    }
  }

  // 3. Compute non-payment direct expenses (if any)
  let totalExpenses = 0;
  let cashExpenses = 0;
  let bankExpenses = 0;

  for (const e of expenses || []) {
    const amt = Number(e.amount || 0);
    if (amt <= 0) continue;
    totalExpenses += amt;
    const method = String(e.paymentMethod || "").toUpperCase();
    if (method === "BANK" || method === "ONLINE" || method === "CHEQUE") {
      bankExpenses += amt;
    } else {
      cashExpenses += amt;
    }
  }

  const netMovement = round2(totalReceipts - totalDisbursements - totalExpenses).toNumber();
  const closingCash = round2(openingCash + cashReceipts - cashDisbursements - cashExpenses).toNumber();
  const closingBank = round2(openingBank + bankReceipts - bankDisbursements - bankExpenses).toNumber();
  const closingTotal = round2(openingTotal + netMovement).toNumber();

  // Map individual account closing balances
  const reconciledAccounts = accounts.map((a) => {
    const isBank = a.type === "BANK";
    const accOpening = isBank
      ? (openingBank / Math.max(1, accounts.filter((x) => x.type === "BANK").length))
      : (openingCash / Math.max(1, accounts.filter((x) => x.type === "CASH").length));

    let accReceipts = 0;
    let accDisbursements = 0;
    let accExpenses = 0;

    for (const p of validPayments) {
      const amt = Number(p.amount || 0);
      if (p.accountId === a.id) {
        if (p.type === "RECEIPT") accReceipts += amt;
        else if (p.type === "DISBURSEMENT" || p.type === "TRANSFER" || p.type === "CONTRA") {
          accDisbursements += amt;
        }
      }
      if (p.targetAccountId === a.id) {
        accReceipts += amt;
      }
    }

    for (const e of expenses || []) {
      const amt = Number(e.amount || 0);
      if (amt <= 0) continue;
      if (e.accountId === a.id) {
        accExpenses += amt;
      } else if (!e.accountId) {
        const method = String(e.paymentMethod || "").toUpperCase();
        const matchesBank = (method === "BANK" || method === "ONLINE" || method === "CHEQUE") && a.type === "BANK";
        const matchesCash = !(method === "BANK" || method === "ONLINE" || method === "CHEQUE") && a.type === "CASH";
        if (matchesBank || matchesCash) {
          const matchCount = accounts.filter((x) => x.type === a.type).length || 1;
          accExpenses += amt / matchCount;
        }
      }
    }

    const calculatedBal = round2(accOpening + accReceipts - accDisbursements - accExpenses).toNumber();

    return {
      id: a.id,
      name: a.name,
      type: a.type,
      accountNumber: a.accountNumber || null,
      bankName: a.bankName || null,
      openingBalance: round2(accOpening).toNumber(),
      receipts: round2(accReceipts).toNumber(),
      disbursements: round2(accDisbursements).toNumber(),
      expenses: round2(accExpenses).toNumber(),
      balance: calculatedBal,
    };
  });

  return {
    openingCash: round2(openingCash).toNumber(),
    openingBank: round2(openingBank).toNumber(),
    openingTotal,
    totalReceipts: round2(totalReceipts).toNumber(),
    totalDisbursements: round2(totalDisbursements).toNumber(),
    totalExpenses: round2(totalExpenses).toNumber(),
    cashExpenses: round2(cashExpenses).toNumber(),
    bankExpenses: round2(bankExpenses).toNumber(),
    netMovement,
    closingCash,
    closingBank,
    closingTotal,
    accounts: reconciledAccounts,
  };
}

/**
 * Reconciles and synchronizes CashBankAccount and Account (1010, 1020) balances
 * in PostgreSQL with opening snapshot and subsequent transactions.
 */
export async function reconcileCashBankBalances(
  prismaClient: PrismaClient | typeof import("@/lib/prisma").prisma,
  businessId: string
): Promise<CashBankReconciliationResult> {
  if (!businessId) {
    return {
      openingCash: 0,
      openingBank: 0,
      openingTotal: 0,
      totalReceipts: 0,
      totalDisbursements: 0,
      totalExpenses: 0,
      netMovement: 0,
      closingCash: 0,
      closingBank: 0,
      closingTotal: 0,
      accounts: [],
    };
  }

  try {
    const [accounts, payments, openingJournal, expenses] = await Promise.all([
      prismaClient.cashBankAccount.findMany({
        where: { businessId, isActive: true },
        orderBy: { createdAt: "asc" },
      }),
      prismaClient.payment.findMany({
        where: { businessId },
        orderBy: { date: "asc" },
      }),
      prismaClient.journalEntry.findFirst({
        where: { businessId, referenceType: "OPENING_BALANCE" },
        include: { lines: { include: { account: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prismaClient.expense.findMany({
        where: { businessId },
      }),
    ]);

    const summary = calculateCashBankSummary(accounts, payments, openingJournal, expenses);

    // Synchronize CashBankAccount balances in PostgreSQL
    for (const acc of summary.accounts) {
      await prismaClient.cashBankAccount.update({
        where: { id: acc.id },
        data: { balance: acc.balance },
      }).catch(() => null);
    }

    // Synchronize Account 1010 and 1020 running balances in Chart of Accounts
    const acc1010 = await prismaClient.account.findUnique({
      where: { businessId_code: { businessId, code: "1010" } },
    });
    if (acc1010) {
      await prismaClient.account.update({
        where: { id: acc1010.id },
        data: { balance: summary.closingCash },
      }).catch(() => null);
    }

    const acc1020 = await prismaClient.account.findUnique({
      where: { businessId_code: { businessId, code: "1020" } },
    });
    if (acc1020) {
      await prismaClient.account.update({
        where: { id: acc1020.id },
        data: { balance: summary.closingBank },
      }).catch(() => null);
    }

    return summary;
  } catch (error) {
    console.error("reconcileCashBankBalances error:", error);
    return storeReconcileCashBankBalances(businessId);
  }
}

/**
 * In-memory fallback reconciliation for testing / fallbackStore.
 */
export function storeReconcileCashBankBalances(businessId: string): CashBankReconciliationResult {
  const accounts = fallbackStore.cashBankAccounts.filter((a) => a.businessId === businessId);
  const payments = fallbackStore.payments.filter((p) => p.businessId === businessId);
  const openingJournal = fallbackStore.journalEntries.find(
    (j) => j.businessId === businessId && j.referenceType === "OPENING_BALANCE"
  );
  const expenses = fallbackStore.expenses.filter((e) => e.businessId === businessId);

  const summary = calculateCashBankSummary(accounts, payments, openingJournal, expenses);

  // Update fallbackStore accounts
  summary.accounts.forEach((acc) => {
    const stored = fallbackStore.cashBankAccounts.find((a) => a.id === acc.id);
    if (stored) stored.balance = acc.balance;
  });

  const acc1010 = fallbackStore.accounts.find((a) => a.businessId === businessId && a.code === "1010");
  if (acc1010) acc1010.balance = summary.closingCash;

  const acc1020 = fallbackStore.accounts.find((a) => a.businessId === businessId && a.code === "1020");
  if (acc1020) acc1020.balance = summary.closingBank;

  return summary;
}
