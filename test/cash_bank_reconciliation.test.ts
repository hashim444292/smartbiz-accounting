import { describe, it, expect } from "vitest";
import { calculateCashBankSummary, storeReconcileCashBankBalances } from "@/lib/cashBankHelper";
import { fallbackStore } from "@/lib/fallbackStore";

describe("Cash & Bank Auto-Reconciliation Engine", () => {
  it("should accurately compute opening balance, net movement, and closing balance", () => {
    const mockAccounts = [
      { id: "acc-cash-1", name: "Cash in Hand", type: "CASH", balance: 1901900 },
      { id: "acc-bank-1", name: "Main Bank Account", type: "BANK", balance: 762000 },
    ];

    const mockOpeningJournal = {
      lines: [
        { accountCode: "1010", debit: 1901900, credit: 0 },
        { accountCode: "1020", debit: 762000, credit: 0 },
      ],
    };

    const mockPayments = [
      // Receipts (+910,000)
      { id: "pay-1", type: "RECEIPT", amount: 140000, accountId: "acc-cash-1" },
      { id: "pay-2", type: "RECEIPT", amount: 300000, accountId: "acc-cash-1" },
      { id: "pay-3", type: "RECEIPT", amount: 270000, accountId: "acc-cash-1" },
      { id: "pay-4", type: "RECEIPT", amount: 200000, accountId: "acc-cash-1" },
      // Disbursements (-1,198,900)
      { id: "pay-5", type: "DISBURSEMENT", amount: 100000, accountId: "acc-cash-1" },
      { id: "pay-6", type: "DISBURSEMENT", amount: 200000, accountId: "acc-cash-1" },
      { id: "pay-7", type: "DISBURSEMENT", amount: 227500, accountId: "acc-bank-1" },
      { id: "pay-8", type: "DISBURSEMENT", amount: 250000, accountId: "acc-cash-1" },
      { id: "pay-9", type: "DISBURSEMENT", amount: 250000, accountId: "acc-cash-1" },
      { id: "pay-10", type: "DISBURSEMENT", amount: 171400, accountId: "acc-cash-1" },
    ];

    const result = calculateCashBankSummary(mockAccounts, mockPayments, mockOpeningJournal);

    // 1. Opening liquid funds
    expect(result.openingCash).toBe(1901900);
    expect(result.openingBank).toBe(762000);
    expect(result.openingTotal).toBe(2663900);

    // 2. Operational receipts and disbursements
    expect(result.totalReceipts).toBe(910000);
    expect(result.totalDisbursements).toBe(1198900);

    // 3. Net movement is -288,900
    expect(result.netMovement).toBe(-288900);

    // 4. Adjusted Closing Total must be exactly openingTotal + netMovement = 2,375,000
    expect(result.closingTotal).toBe(2375000);

    // 5. Individual account closing balances
    // Cash: 1,901,900 + 910,000 - 971,400 = 1,840,500
    expect(result.closingCash).toBe(1840500);
    // Bank: 762,000 - 227,500 = 534,500
    expect(result.closingBank).toBe(534500);

    // Sum of individual closing balances equals closingTotal
    expect(result.closingCash + result.closingBank).toBe(2375000);
  });

  it("should handle contra deposit from cash to bank accurately", () => {
    const mockAccounts = [
      { id: "cash-1", name: "Cash in Hand", type: "CASH", balance: 500000 },
      { id: "bank-1", name: "Bank Account", type: "BANK", balance: 500000 },
    ];

    const mockPayments = [
      { id: "contra-1", type: "CONTRA", amount: 100000, accountId: "cash-1", targetAccountId: "bank-1" },
    ];

    const result = calculateCashBankSummary(mockAccounts, mockPayments);

    expect(result.closingCash).toBe(400000);
    expect(result.closingBank).toBe(600000);
    expect(result.closingTotal).toBe(1000000);
  });
});
