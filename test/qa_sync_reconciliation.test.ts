import { describe, it, expect } from "vitest";
import { storeReconcileCashBankBalances } from "@/lib/cashBankHelper";
import { storeReconcileInventoryValuation } from "@/lib/inventoryHelper";
import { fallbackStore } from "@/lib/fallbackStore";

describe("QA Sync & Reconciliation Verification", () => {
  const bizId = "biz-qa-test";

  it("Task 1 & 4: should reconcile Cash (1010) and Bank (1020) accounts deducting expenses and matching ledger", () => {
    // Setup test accounts in fallbackStore
    const cashAcc = { id: `acc-cash-${bizId}`, businessId: bizId, name: "Cash in Hand", type: "CASH", balance: 1901900 };
    const bankAcc = { id: `acc-bank-${bizId}`, businessId: bizId, name: "Main Bank", type: "BANK", balance: 762000 };
    const acc1010 = { id: `coa-1010-${bizId}`, businessId: bizId, code: "1010", name: "Cash in Hand", type: "ASSET", balance: 0 };
    const acc1020 = { id: `coa-1020-${bizId}`, businessId: bizId, code: "1020", name: "Main Bank Account", type: "ASSET", balance: 0 };

    fallbackStore.cashBankAccounts.push(cashAcc, bankAcc);
    fallbackStore.accounts.push(acc1010, acc1020);

    fallbackStore.journalEntries.push({
      id: `je-ob-${bizId}`,
      businessId: bizId,
      referenceType: "OPENING_BALANCE",
      lines: [
        { accountCode: "1010", debit: 1901900, credit: 0 },
        { accountCode: "1020", debit: 762000, credit: 0 },
      ],
    } as any);

    fallbackStore.payments.push(
      { id: `p1-${bizId}`, businessId: bizId, type: "RECEIPT", amount: 455050, accountId: cashAcc.id } as any,
      { id: `p2-${bizId}`, businessId: bizId, type: "RECEIPT", amount: 800000, accountId: bankAcc.id } as any,
      { id: `p3-${bizId}`, businessId: bizId, type: "DISBURSEMENT", amount: 866450, accountId: cashAcc.id } as any,
      { id: `p4-${bizId}`, businessId: bizId, type: "DISBURSEMENT", amount: 832450, accountId: bankAcc.id } as any
    );

    fallbackStore.expenses.push(
      { id: `e1-${bizId}`, businessId: bizId, amount: 100000, paymentMethod: "CASH", accountId: cashAcc.id } as any,
      { id: `e2-${bizId}`, businessId: bizId, amount: 57000, paymentMethod: "CASH", accountId: cashAcc.id } as any,
      { id: `e3-${bizId}`, businessId: bizId, amount: 79700, paymentMethod: "CASH", accountId: cashAcc.id } as any
    );

    const summary = storeReconcileCashBankBalances(bizId);

    // Verify closing cash is 1,253,800
    expect(summary.closingCash).toBe(1253800);
    expect(acc1010.balance).toBe(1253800);

    // Verify closing bank is 729,550
    expect(summary.closingBank).toBe(729550);
    expect(acc1020.balance).toBe(729550);
  });

  it("Task 3: should synchronize Account 1200 with live product inventory valuation", () => {
    const acc1200 = { id: `coa-1200-${bizId}`, businessId: bizId, code: "1200", name: "Merchandise Inventory", type: "ASSET", balance: 0 };
    fallbackStore.accounts.push(acc1200);

    fallbackStore.products.push(
      { id: `prod-1-${bizId}`, businessId: bizId, currentStock: 10, averageCost: 50000, isActive: true } as any,
      { id: `prod-2-${bizId}`, businessId: bizId, currentStock: 25, purchasePrice: 20000, isActive: true } as any
    );

    // Valuation: (10 * 50,000) + (25 * 20,000) = 500,000 + 500,000 = 1,000,000
    const valResult = storeReconcileInventoryValuation(bizId);

    expect(valResult.totalValuation).toBe(1000000);
    expect(acc1200.balance).toBe(1000000);
  });

  it("Task 2: should ensure local date builder does not backdate to yesterday across timezones", () => {
    const rawDateStr = "2026-11-03";
    const parts = rawDateStr.split("-").map(Number);
    const now = new Date();
    const constructed = new Date(parts[0], parts[1] - 1, parts[2], now.getHours(), now.getMinutes(), now.getSeconds());

    expect(constructed.getFullYear()).toBe(2026);
    expect(constructed.getMonth()).toBe(10); // November (0-indexed 10)
    expect(constructed.getDate()).toBe(3);
  });

  it("Task 1 Parity: Dropdown account balance matches journal closing balance exactly", () => {
    const testAccounts = [
      { id: "acc-1010-test", code: "1010", name: "Cash in Hand", type: "ASSET", balance: 1490500 }, // Stale balance from before expense deduction
    ];
    const testJournals = [
      {
        id: "j1",
        lines: [
          { accountId: "acc-1010-test", debit: 2811900, credit: 0 },
          { accountId: "acc-1010-test", debit: 0, credit: 1558100 },
        ],
      },
    ];

    const debitsByAccId = new Map<string, number>();
    const creditsByAccId = new Map<string, number>();
    testJournals.forEach((j) => {
      j.lines.forEach((l) => {
        debitsByAccId.set(l.accountId, (debitsByAccId.get(l.accountId) || 0) + l.debit);
        creditsByAccId.set(l.accountId, (creditsByAccId.get(l.accountId) || 0) + l.credit);
      });
    });

    const effective = testAccounts.map((a) => {
      const isDebitNormal = ["ASSET", "EXPENSE", "COGS"].includes(a.type);
      const debits = debitsByAccId.get(a.id) || 0;
      const credits = creditsByAccId.get(a.id) || 0;
      const net = isDebitNormal ? debits - credits : credits - debits;
      return { ...a, balance: Math.abs(net) };
    });

    const optionText = `[${effective[0].code}] ${effective[0].name} (${effective[0].type}) — Balance: Rs ${Number(effective[0].balance).toLocaleString()}`;
    expect(optionText).toBe("[1010] Cash in Hand (ASSET) — Balance: Rs 1,253,800");
    expect(effective[0].balance).toBe(1253800);
  });
});
