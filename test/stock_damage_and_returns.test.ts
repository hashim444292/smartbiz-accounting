import { describe, it, expect, beforeEach } from "vitest";
import { fallbackStore, storeAdjustStock } from "@/lib/fallbackStore";
import { NextRequest } from "next/server";
import { GET as getProfitLoss } from "@/app/api/reports/profit-loss/route";

describe("Stock Damage, Sales Returns & Custom Date P&L Suite", () => {
  const businessId = "biz-101";

  beforeEach(() => {
    // Ensure clean fallbackStore testing environment
    if (!fallbackStore.sales) fallbackStore.sales = [];
    if (!fallbackStore.inventoryTransactions) fallbackStore.inventoryTransactions = [];
    if (!fallbackStore.expenses) fallbackStore.expenses = [];
  });

  it("Task 1: storeAdjustStock correctly records DAMAGE, deducts quantity, and creates double-entry journal (5020 vs 1200)", () => {
    // Find or seed a product in biz-101
    const product = fallbackStore.products.find((p) => p.businessId === businessId);
    expect(product).toBeDefined();

    const initialStock = Number(product?.currentStock || 10);
    const deductQty = 2;

    const result = storeAdjustStock(
      {
        productId: product!.id,
        deductQuantity: deductQty,
        reason: "DAMAGE",
        notes: "Broken screen during transit",
        businessId: product!.businessId || businessId,
      },
      { userId: "usr-1", name: "Admin Tester" }
    );

    expect(result.newStock).toBe(initialStock - deductQty);
    expect(result.product.currentStock).toBe(initialStock - deductQty);

    // Verify inventory transaction was recorded
    const damageTx = fallbackStore.inventoryTransactions.find(
      (tx) => tx.productId === product!.id && tx.type === "DAMAGE"
    );
    expect(damageTx).toBeDefined();
    expect(Math.abs(Number(damageTx?.quantity))).toBe(deductQty);

    // Verify journal entry debited 5020 and credited 1200
    const journalEntry = fallbackStore.journalEntries?.find(
      (je) => je.referenceId === damageTx?.id
    );
    expect(journalEntry).toBeDefined();
    expect(journalEntry?.lines).toHaveLength(2);

    const debitLine = journalEntry?.lines.find((l: any) => l.accountCode === "5020");
    const creditLine = journalEntry?.lines.find((l: any) => l.accountCode === "1200");
    expect(debitLine).toBeDefined();
    expect(debitLine?.debit).toBeGreaterThan(0);
    expect(creditLine).toBeDefined();
    expect(creditLine?.credit).toBe(debitLine?.debit);
  });

  it("Task 3: /api/reports/profit-loss accepts custom date range and calculates sales, returns, COGS, damage losses, and net profit", async () => {
    const today = new Date().toISOString().split("T")[0];
    const req = new NextRequest(`http://localhost:3000/api/reports/profit-loss?startDate=${today}&endDate=${today}`, {
      headers: {
        "x-business-id": businessId,
      },
    });

    const res = await getProfitLoss(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toBeDefined();
    expect(json.data.startDate).toBe(today);
    expect(json.data.endDate).toBe(today);
    expect(typeof json.data.grossSales).toBe("number");
    expect(typeof json.data.salesReturns).toBe("number");
    expect(typeof json.data.netSales).toBe("number");
    expect(typeof json.data.cogs).toBe("number");
    expect(typeof json.data.inventoryLoss).toBe("number");
    expect(typeof json.data.totalCostOfSales).toBe("number");
    expect(typeof json.data.grossProfit).toBe("number");
    expect(typeof json.data.expenses).toBe("number");
    expect(typeof json.data.netProfit).toBe("number");
    expect(Array.isArray(json.data.expenseCategories)).toBe(true);
  });

  it("Task 4: performStockAdjustment correctly executes stock decrease (diff < 0), updates product stock and creates journal entry", async () => {
    const { performStockAdjustment } = await import("@/services/inventoryService");
    let updatedProductStock: number | null = null;
    let createdMovement: any = null;
    let createdJournal: any = null;

    const mockProduct = {
      id: "prod-test-damage",
      businessId,
      name: "Samsung A55",
      unit: "pcs",
      currentStock: 20,
      averageCost: 5000,
    };

    const mockAccounts: Record<string, any> = {
      "5020": { id: "acc-5020", code: "5020", name: "Inventory Shrinkage & Loss" },
      "1200": { id: "acc-1200", code: "1200", name: "Merchandise Inventory" },
    };

    const mockTx: any = {
      product: {
        findUnique: () => Promise.resolve(mockProduct),
        update: ({ data }: any) => {
          updatedProductStock = data.currentStock;
          return Promise.resolve({ ...mockProduct, currentStock: data.currentStock });
        },
      },
      stockAdjustment: {
        create: () => Promise.resolve({ id: "adj-test-1" }),
      },
      inventoryTransaction: {
        create: ({ data }: any) => {
          createdMovement = data;
          return Promise.resolve({ id: "itx-test-1", ...data });
        },
      },
      business: {
        findUnique: () => Promise.resolve({ id: businessId, negativeStockPolicy: true }),
      },
      accountingPeriod: {
        findUnique: () => Promise.resolve({ status: "OPEN" }),
      },
      account: {
        findUnique: ({ where }: any) => {
          const code = where?.businessId_code?.code;
          return Promise.resolve(mockAccounts[code] || null);
        },
        create: ({ data }: any) => Promise.resolve({ id: `acc-${data.code}`, ...data }),
        update: () => Promise.resolve({}),
      },
      entryNumberCounter: {
        upsert: () => Promise.resolve({ lastNumber: 1 }),
      },
      journalEntry: {
        findMany: () => Promise.resolve([]),
        findFirst: () => Promise.resolve(null),
        create: ({ data }: any) => {
          createdJournal = data;
          return Promise.resolve({ id: "je-test-1", ...data });
        },
      },
      auditLog: {
        create: () => Promise.resolve({ id: "audit-1" }),
      },
    };

    const res = await performStockAdjustment(mockTx, {
      businessId,
      productId: "prod-test-damage",
      targetStock: 17, // deducting 3 units
      reason: "DAMAGE",
      notes: "Broken screen",
      createdById: "usr-1",
      createdByName: "Admin",
    });

    expect(res.status).toBe("ADJUSTED");
    expect((res as any).newStock?.toNumber()).toBe(17);
    expect(updatedProductStock).toBe(17);
    expect(createdMovement).toBeDefined();
    expect(createdMovement.type).toBe("DAMAGE");
    expect(createdMovement.quantity).toBe(3);
    expect(createdJournal).toBeDefined();
  });
});
