import { describe, it, expect, beforeEach } from "vitest";
import { STANDARD_ACCOUNTS, ACCOUNT_URDU_NAMES } from "@/services/accountingService";
import {
  fallbackStore,
  storeEnsureStandardAccounts,
  storeCreateAccount,
  makeCompanyAccounts,
} from "@/lib/fallbackStore";
import { GET as getAccounting, POST as createAccountHandler } from "@/app/api/accounting/accounts/route";
import { NextRequest } from "next/server";

describe("Comprehensive Chart of Accounts & Custom Heads Suite", () => {
  const testBizId = "biz-coa-test-101";

  beforeEach(() => {
    // Clean any prior test data for isolated testing
    fallbackStore.accounts = fallbackStore.accounts.filter((a) => a.businessId !== testBizId);
    fallbackStore.cashBankAccounts = fallbackStore.cashBankAccounts.filter((cb) => cb.businessId !== testBizId);
  });

  it("1. Verifies all standard Pakistan business accounting heads exist in STANDARD_ACCOUNTS", () => {
    const codes = Object.keys(STANDARD_ACCOUNTS);

    // Capital & Equity heads
    expect(codes).toContain("3010"); // Owner's Capital
    expect(STANDARD_ACCOUNTS["3010"].type).toBe("EQUITY");
    expect(STANDARD_ACCOUNTS["3010"].subType).toBe("Capital");
    expect(ACCOUNT_URDU_NAMES["3010"]).toBeDefined();

    expect(codes).toContain("3020"); // Owner's Drawings
    expect(STANDARD_ACCOUNTS["3020"].type).toBe("EQUITY");

    expect(codes).toContain("3100"); // Retained Earnings / Opening Capital
    expect(STANDARD_ACCOUNTS["3100"].type).toBe("EQUITY");

    // Cash & Bank heads
    expect(codes).toContain("1010"); // Cash in Hand
    expect(STANDARD_ACCOUNTS["1010"].type).toBe("ASSET");
    expect(codes).toContain("1020"); // Main Bank Account
    expect(STANDARD_ACCOUNTS["1020"].type).toBe("ASSET");
    expect(codes).toContain("1030"); // Petty Cash
    expect(STANDARD_ACCOUNTS["1030"].type).toBe("ASSET");

    // Receivables, Inventory & Assets
    expect(codes).toContain("1100"); // Accounts Receivable
    expect(codes).toContain("1200"); // Merchandise Inventory
    expect(codes).toContain("1510"); // Furniture & Fixtures
    expect(codes).toContain("1520"); // Vehicles

    // Liabilities & Payables
    expect(codes).toContain("2010"); // Accounts Payable
    expect(STANDARD_ACCOUNTS["2010"].type).toBe("LIABILITY");
    expect(codes).toContain("2100"); // Tax / VAT Payable
    expect(codes).toContain("2510"); // Long-Term Bank Loan

    // Revenue & COGS
    expect(codes).toContain("4010"); // Sales Revenue
    expect(codes).toContain("4020"); // Sales Returns
    expect(codes).toContain("5010"); // Cost of Goods Sold
    expect(codes).toContain("5020"); // Inventory Shrinkage

    // Standard Business Expenses
    expect(codes).toContain("6010"); // Rent Expense
    expect(codes).toContain("6020"); // Salaries & Wages
    expect(codes).toContain("6030"); // Electricity & Utilities
    expect(codes).toContain("6040"); // Internet & Mobile
    expect(codes).toContain("6050"); // Transport & Fuel
    expect(codes).toContain("6060"); // Repairs & Maintenance
    expect(codes).toContain("6070"); // Office Supplies
    expect(codes).toContain("6080"); // Marketing & Advertising
    expect(codes).toContain("6090"); // Bank Fees & Charges
    expect(codes).toContain("6990"); // Miscellaneous Expenses

    expect(codes.length).toBeGreaterThanOrEqual(28);
  });

  it("2. Verifies storeEnsureStandardAccounts auto-provisions all heads for existing & new businesses", () => {
    // Initially no accounts exist for testBizId
    const initialAccounts = fallbackStore.accounts.filter((a) => a.businessId === testBizId);
    expect(initialAccounts.length).toBe(0);

    // Call storeEnsureStandardAccounts
    storeEnsureStandardAccounts(testBizId);

    const seededAccounts = fallbackStore.accounts.filter((a) => a.businessId === testBizId);
    expect(seededAccounts.length).toBeGreaterThanOrEqual(28);

    // Capital, Bank, and Expense heads exist
    const capital = seededAccounts.find((a) => a.code === "3010");
    const bank = seededAccounts.find((a) => a.code === "1020");
    const rent = seededAccounts.find((a) => a.code === "6010");

    expect(capital).toBeDefined();
    expect(capital?.name).toBe("Owner's Capital");
    expect(bank).toBeDefined();
    expect(bank?.name).toBe("Main Bank Account");
    expect(rent).toBeDefined();
    expect(rent?.name).toBe("Rent Expense");

    // Idempotency check: calling again does not duplicate accounts
    storeEnsureStandardAccounts(testBizId);
    const recheckedAccounts = fallbackStore.accounts.filter((a) => a.businessId === testBizId);
    expect(recheckedAccounts.length).toBe(seededAccounts.length);
  });

  it("3. Successfully creates a custom account and provisions CashBankAccount if Bank/Cash subType", () => {
    storeEnsureStandardAccounts(testBizId);

    const customAccount = storeCreateAccount({
      businessId: testBizId,
      code: "1025",
      name: "Meezan Bank Islamic Corporate",
      type: "ASSET",
      subType: "Bank",
      balance: 150000,
      notes: "Corporate Branch Clifton Karachi",
    });

    expect(customAccount).toBeDefined();
    expect(customAccount.code).toBe("1025");
    expect(customAccount.name).toBe("Meezan Bank Islamic Corporate");
    expect(customAccount.balance).toBe(150000);

    // Verifies account is in fallbackStore.accounts
    const inStore = fallbackStore.accounts.find((a) => a.businessId === testBizId && a.code === "1025");
    expect(inStore).toBeDefined();
    expect(inStore?.name).toBe("Meezan Bank Islamic Corporate");

    // Verifies CashBankAccount was auto-provisioned
    const cashBankInStore = fallbackStore.cashBankAccounts.find(
      (cb) => cb.businessId === testBizId && cb.name === "Meezan Bank Islamic Corporate"
    );
    expect(cashBankInStore).toBeDefined();
    expect(cashBankInStore?.type).toBe("BANK");
    expect(cashBankInStore?.balance).toBe(150000);

    // Duplicate code must throw error
    expect(() => {
      storeCreateAccount({
        businessId: testBizId,
        code: "1025",
        name: "Duplicate Bank",
        type: "ASSET",
      });
    }).toThrow(/already exists/);
  });

  it("4. Verifies /api/accounting/accounts GET endpoint returns standard accounts", async () => {
    const getReq = new NextRequest("http://localhost:3000/api/accounting/accounts", {
      headers: { "x-business-id": testBizId },
    });
    const getRes = await getAccounting(getReq);
    const getJson = await getRes.json();

    expect(getRes.status).toBe(200);
    expect(getJson.success).toBe(true);
    expect(Array.isArray(getJson.data)).toBe(true);
    expect(getJson.data.length).toBeGreaterThanOrEqual(28);
  }, 30000);

  it("5. Verifies /api/accounting/accounts POST creates custom account", async () => {
    const postReq = new NextRequest("http://localhost:3000/api/accounting/accounts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-business-id": testBizId,
      },
      body: JSON.stringify({
        code: "6095",
        name: "Generator Fuel & Maintenance",
        type: "EXPENSE",
        subType: "Maintenance",
        balance: 0,
        notes: "Backup power fuel expenses",
      }),
    });

    const postRes = await createAccountHandler(postReq);
    const postJson = await postRes.json();

    expect(postRes.status).toBe(200);
    expect(postJson.success).toBe(true);
    expect(postJson.data.code).toBe("6095");
    expect(postJson.data.name).toBe("Generator Fuel & Maintenance");
    expect(postJson.data.type).toBe("EXPENSE");
  }, 30000);

  it("6. Verifies /api/accounting/accounts POST rejects invalid account payload", async () => {
    const invalidReq = new NextRequest("http://localhost:3000/api/accounting/accounts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-business-id": testBizId,
      },
      body: JSON.stringify({
        code: "",
        name: "",
        type: "INVALID_TYPE",
      }),
    });

    const invalidRes = await createAccountHandler(invalidReq);
    const invalidJson = await invalidRes.json();
    expect(invalidRes.status).toBe(400);
    expect(invalidJson.success).toBe(false);
  }, 30000);
});
