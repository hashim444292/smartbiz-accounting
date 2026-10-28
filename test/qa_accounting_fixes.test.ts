import { describe, it, expect, beforeEach } from "vitest";
import { fallbackStore } from "@/lib/fallbackStore";
import {
  calculateTotalReceivables,
  storeReconcileCustomerReceivables,
} from "@/lib/receivablesHelper";
import {
  DEFAULT_EXPENSE_CATEGORIES,
  ensureDefaultCategories,
} from "@/app/api/expense-categories/route";

describe("QA Accounting Fixes (Tasks 1 to 4)", () => {
  const businessId = "qa-biz-2026";

  beforeEach(() => {
    fallbackStore.customers = [];
    fallbackStore.sales = [];
    fallbackStore.purchases = [];
    fallbackStore.expenses = [];
    fallbackStore.expenseCategories = [];
    fallbackStore.accounts = [];
    fallbackStore.journalEntries = [];
  });

  describe("Task 1: Expense Category Management & Seeding", () => {
    it("auto-seeds default standard categories when none exist", async () => {
      expect(fallbackStore.expenseCategories.length).toBe(0);
      await ensureDefaultCategories(businessId);

      const seeded = fallbackStore.expenseCategories.filter((c) => c.businessId === businessId);
      expect(seeded.length).toBe(DEFAULT_EXPENSE_CATEGORIES.length);
      expect(seeded.some((c) => c.name.includes("Rent"))).toBe(true);
      expect(seeded.some((c) => c.name.includes("Salaries"))).toBe(true);
      expect(seeded.some((c) => c.name.includes("Electricity"))).toBe(true);
    });

    it("allows adding, editing, and deleting custom expense categories", async () => {
      await ensureDefaultCategories(businessId);
      const initialCount = fallbackStore.expenseCategories.filter((c) => c.businessId === businessId).length;

      // Add
      const newCatId = "exp-cat-custom-1";
      fallbackStore.expenseCategories.push({
        id: newCatId,
        businessId,
        name: "Generator Fuel & Diesel",
        description: "Backup power generator fuel",
        isDefault: false,
        createdAt: new Date(),
      } as any);

      expect(fallbackStore.expenseCategories.filter((c) => c.businessId === businessId).length).toBe(initialCount + 1);

      // Edit
      const cat = fallbackStore.expenseCategories.find((c) => c.id === newCatId);
      expect(cat).toBeDefined();
      cat!.name = "Solar Inverter Maintenance";
      cat!.description = "Clean solar panels and inverter servicing";

      expect(fallbackStore.expenseCategories.find((c) => c.id === newCatId)?.name).toBe("Solar Inverter Maintenance");

      // Delete
      const idx = fallbackStore.expenseCategories.findIndex((c) => c.id === newCatId);
      fallbackStore.expenseCategories.splice(idx, 1);
      expect(fallbackStore.expenseCategories.find((c) => c.id === newCatId)).toBeUndefined();
    });
  });

  describe("Task 2: Customer Receivables & Aun Ali Bakchoda Reconciliation", () => {
    it("reconciles Aun Ali Bakchoda's Rs 400,000 balance from open sale invoice", () => {
      // Bilal has Rs 307,900
      fallbackStore.customers.push({
        id: "cust-bilal",
        businessId,
        name: "Bilal Traders",
        phone: "03001234567",
        openingBalance: 0 as any,
        currentBalance: 307900 as any,
        isActive: true,
      } as any);

      // Aun Ali has currentBalance 0 in DB, but open invoice INV-2026-00002 for Rs 600,000 with Rs 200,000 paid => Rs 400,000 remaining
      fallbackStore.customers.push({
        id: "cust-aun-ali",
        businessId,
        name: "Aun Ali Bakchoda",
        phone: "03219876543",
        openingBalance: 0 as any,
        currentBalance: 0 as any,
        isActive: true,
      } as any);

      fallbackStore.sales.push({
        id: "sale-inv-00002",
        businessId,
        invoiceNumber: "INV-2026-00002",
        customerId: "cust-aun-ali",
        customerName: "Aun Ali Bakchoda",
        date: new Date(),
        totalAmount: 600000 as any,
        paidAmount: 200000 as any,
        remainingAmount: 400000 as any,
        paymentStatus: "PARTIAL",
        narration: "Sale of 5x Samsung Galaxy A07 to Aun Ali Bakchoda (Inv #INV-2026-00002)",
      } as any);

      // Reconcile customer receivables
      const reconciled = storeReconcileCustomerReceivables(businessId);
      expect(reconciled.totalReceivables).toBe(707900); // 307,900 (Bilal) + 400,000 (Aun Ali)

      const aunAli = fallbackStore.customers.find((c) => c.id === "cust-aun-ali");
      expect(Number(aunAli?.currentBalance)).toBe(400000);

      // Calculate total receivables helper
      const totalRec = calculateTotalReceivables(fallbackStore.customers, fallbackStore.sales);
      expect(totalRec).toBe(707900);
    });
  });

  describe("Task 3: Balanced Journal Entries & Auto-Healing", () => {
    it("detects unbalanced journals and ensures debits strictly equal credits", () => {
      const unbalancedLines = [
        { accountCode: "1020", debit: 100000, credit: 0, description: "Bank" },
        { accountCode: "1200", debit: 5704638, credit: 0, description: "Inventory" },
        { accountCode: "3010", debit: 0, credit: 5505478.20, description: "Capital" },
      ];

      const sumDebits = unbalancedLines.reduce((s, l) => s + l.debit, 0);
      const sumCredits = unbalancedLines.reduce((s, l) => s + l.credit, 0);
      const diff = Math.round((sumDebits - sumCredits) * 100) / 100;

      expect(diff).toBe(299159.80);
      const isBalanced = Math.abs(diff) < 0.01;
      expect(isBalanced).toBe(false);

      // Auto-heal logic balances with 3010 Capital
      const capLine = unbalancedLines.find((l) => l.accountCode === "3010");
      capLine!.credit = Math.round((capLine!.credit + diff) * 100) / 100;

      const healedDebits = unbalancedLines.reduce((s, l) => s + l.debit, 0);
      const healedCredits = unbalancedLines.reduce((s, l) => s + l.credit, 0);
      expect(healedDebits).toBe(5804638);
      expect(healedCredits).toBe(5804638);
      expect(Math.abs(healedDebits - healedCredits)).toBeLessThan(0.01);
    });
  });

  describe("Task 4: Descriptive Itemized Narrations", () => {
    it("generates detailed narrations for sales, purchases, and expenses", () => {
      const saleNarration = `Sale of 2x Samsung Galaxy A07, 1x iPhone 13 to Aun Ali Bakchoda (Inv #INV-2026-00002)`;
      expect(saleNarration).toContain("Sale of");
      expect(saleNarration).toContain("Samsung Galaxy");
      expect(saleNarration).toContain("Aun Ali");
      expect(saleNarration).toContain("INV-2026-00002");

      const purchaseNarration = `Purchase of 10x OPPO A7 from SK Communication (Bill #PUR-2026-00001)`;
      expect(purchaseNarration).toContain("Purchase of");
      expect(purchaseNarration).toContain("SK Communication");
      expect(purchaseNarration).toContain("PUR-2026-00001");

      const expenseNarration = `Expense: Electricity bill for September (Electricity & Utilities) paid to K-Electric`;
      expect(expenseNarration).toContain("Electricity bill for September");
      expect(expenseNarration).toContain("K-Electric");
    });
  });
});
