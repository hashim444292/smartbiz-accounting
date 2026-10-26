import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "../src/app/api/payments/transfer/route";
import { fallbackStore, storeTransferFunds } from "../src/lib/fallbackStore";
import { numberToWords } from "../src/lib/numberToWords";

describe("Cash Sales Deposit & Contra Journal Voucher Engine", () => {
  const testBizId = "biz-deposit-test-01";
  const cashAccId = "cba-cash-test-01";
  const bankAccId = "cba-bank-test-01";

  beforeEach(() => {
    // Reset/seed accounts in fallbackStore
    fallbackStore.cashBankAccounts = fallbackStore.cashBankAccounts.filter(
      (a) => a.id !== cashAccId && a.id !== bankAccId
    );

    fallbackStore.cashBankAccounts.push(
      {
        id: cashAccId,
        businessId: testBizId,
        name: "Shop Cash Drawer (Counter 1)",
        type: "CASH",
        balance: 100000,
        isActive: true,
      } as any,
      {
        id: bankAccId,
        businessId: testBizId,
        name: "Meezan Bank Current A/C",
        type: "BANK",
        accountNumber: "01020304050",
        balance: 250000,
        isActive: true,
      } as any
    );
  });

  describe("numberToWords Currency Formatter", () => {
    it("should format currency amounts into correct Pakistani words", () => {
      expect(numberToWords(0)).toBe("Rupees Zero Only");
      expect(numberToWords(50000)).toBe("Rupees Fifty Thousand Only");
      expect(numberToWords(2500)).toBe("Rupees Two Thousand Five Hundred Only");
      expect(numberToWords(1250000)).toBe("Rupees Twelve Lac Fifty Thousand Only");
      expect(numberToWords(10000000)).toBe("Rupees One Crore Only");
    });
  });

  describe("storeTransferFunds with Cash Deposit", () => {
    it("should process cash deposit, update balances, and generate a balanced Contra Journal Voucher", () => {
      const depositAmount = 45000;
      const initialCashBal = 100000;
      const initialBankBal = 250000;

      const result = storeTransferFunds(
        {
          businessId: testBizId,
          fromAccountId: cashAccId,
          toAccountId: bankAccId,
          amount: depositAmount,
          transferType: "CASH_DEPOSIT",
          referenceNumber: "DEP-SLIP-771",
          depositorName: "Muhammad Hanif (Manager)",
          notes: "Daily cash sales deposited into Meezan Bank",
        },
        { userId: "usr-test", name: "Muhammad Hanif" }
      );

      // Check payment record
      expect(result.id).toBeDefined();
      expect(result.type).toBe("TRANSFER");
      expect(result.paymentMethod).toBe("CASH_DEPOSIT");
      expect(result.amount).toBe(depositAmount);
      expect(result.partyName).toContain("Cash Deposit");

      // Verify account balance updates
      const updatedCash = fallbackStore.cashBankAccounts.find((a) => a.id === cashAccId);
      const updatedBank = fallbackStore.cashBankAccounts.find((a) => a.id === bankAccId);
      expect(updatedCash?.balance).toBe(initialCashBal - depositAmount);
      expect(updatedBank?.balance).toBe(initialBankBal + depositAmount);

      // Verify Contra Journal Entry
      expect(result.journalEntry).toBeDefined();
      expect(result.journalEntry.entryNumber).toMatch(/^CV-\d{4}-\d+/);
      expect(result.journalEntry.referenceType).toBe("CONTRA");
      expect(result.journalEntry.isBalanced).toBe(true);
      expect(result.journalEntry.depositorName).toBe("Muhammad Hanif (Manager)");

      // Verify Journal Lines: Debit Bank, Credit Cash
      const lines = result.journalEntry.lines;
      expect(lines).toHaveLength(2);

      const debitLine = lines.find((l: any) => l.debit > 0);
      const creditLine = lines.find((l: any) => l.credit > 0);

      expect(debitLine).toBeDefined();
      expect(debitLine.account.code).toBe("1020");
      expect(debitLine.account.name).toBe("Meezan Bank Current A/C");
      expect(debitLine.debit).toBe(depositAmount);

      expect(creditLine).toBeDefined();
      expect(creditLine.account.code).toBe("1010");
      expect(creditLine.account.name).toBe("Shop Cash Drawer (Counter 1)");
      expect(creditLine.credit).toBe(depositAmount);
    });

    it("should throw error if source cash account has insufficient funds", () => {
      expect(() => {
        storeTransferFunds({
          businessId: testBizId,
          fromAccountId: cashAccId,
          toAccountId: bankAccId,
          amount: 9999999, // Exceeds balance of 100,000
          transferType: "CASH_DEPOSIT",
        });
      }).toThrowError("Insufficient funds in source account.");
    });
  });

  describe("API Route POST /api/payments/transfer with Cash Deposit", () => {
    it("should handle cash deposit via POST and return journal voucher payload", async () => {
      const payload = {
        fromAccountId: cashAccId,
        toAccountId: bankAccId,
        amount: 30000,
        transferType: "CASH_DEPOSIT",
        referenceNumber: "DEP-90812",
        description: "Counter cash sales collection transferred to bank",
        depositorName: "Adeel Ahmed",
      };

      const req = new Request("http://localhost:3000/api/payments/transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-business-id": testBizId,
        },
        body: JSON.stringify(payload),
      });

      const res = await POST(req as any);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.journalEntry).toBeDefined();
      expect(body.data.journalEntry.referenceType).toBe("CONTRA");
      expect(body.data.journalEntry.entryNumber).toBeDefined();
      expect(body.data.journalEntry.lines).toHaveLength(2);
    });
  });
});
