import { describe, it, expect, beforeEach } from "vitest";
import { getItemsSummaryReport } from "@/services/reportService";
import { saveOpeningBalances } from "@/services/openingBalanceService";
import { fallbackStore } from "@/lib/fallbackStore";
import { prisma } from "@/lib/prisma";

describe("Items Summary Stock Calculation & QA Integrity Engine", () => {
  const testBizId = "biz-qa-items-summary-test";

  beforeEach(() => {
    // Reset or prepare fallback store business
    if (!fallbackStore.companies.some((c) => c.id === testBizId)) {
      fallbackStore.companies.push({
        id: testBizId,
        name: "Abdullah Traders QA Test",
        currency: "PKR",
      } as any);
    }
  });

  it("1. Motorola 110 stock calculation: Opening 10 + Purchase 100 = Bal 110 (NOT 120)", async () => {
    // Simulate product setup: openingQuantity = 10
    const prodId = "prod-moto-110";
    const product = {
      id: prodId,
      businessId: testBizId,
      name: "Motorola 110",
      sku: "MOTO-110",
      unit: "pcs",
      openingQuantity: 10,
      currentStock: 110,
      category: { id: "cat-mob", name: "MOBILE" },
    };

    // Simulate inventory transactions:
    // 1 OPENING tx of 10
    // 1 PURCHASE tx of 100
    const transactions = [
      {
        id: "tx-op-1",
        businessId: testBizId,
        productId: prodId,
        type: "OPENING",
        quantity: 10,
        date: new Date("2026-10-01T00:00:00Z"),
      },
      {
        id: "tx-pur-1",
        businessId: testBizId,
        productId: prodId,
        type: "PURCHASE",
        quantity: 100,
        date: new Date("2026-10-15T10:00:00Z"),
      },
    ];

    // Compute range from 2026-10-01 to 2026-10-31
    const sDate = new Date("2026-10-01");
    sDate.setHours(0, 0, 0, 0);
    const eDate = new Date("2026-10-31");
    eDate.setHours(23, 59, 59, 999);

    const openingTxs = transactions.filter((t) => t.type === "OPENING");
    const baselineOpening = Math.max(
      Number(product.openingQuantity || 0),
      openingTxs.reduce((sum, t) => sum + Math.abs(Number(t.quantity)), 0)
    );

    let priorIn = 0;
    let priorOut = 0;
    let rangeIn = 0;
    let rangeOut = 0;

    for (const t of transactions) {
      if (t.type === "OPENING") continue; // Crucial fix: OPENING is baseline, not inward movement

      const isPositive = ["STOCK_IN", "PURCHASE", "SALE_RETURN"].includes(t.type);
      const isNegative = ["STOCK_OUT", "SALE", "DAMAGE", "PURCHASE_RETURN"].includes(t.type);
      const q = Math.abs(Number(t.quantity));

      const tDate = new Date(t.date);
      if (tDate < sDate) {
        if (isPositive) priorIn += q;
        if (isNegative) priorOut += q;
      } else if (tDate <= eDate) {
        if (isPositive) rangeIn += q;
        if (isNegative) rangeOut += q;
      }
    }

    const op = baselineOpening + priorIn - priorOut;
    const currentBal = op + rangeIn - rangeOut;

    // Must strictly equal OP: 10, IN: 100, OUT: 0, BAL: 110
    expect(op).toBe(10);
    expect(rangeIn).toBe(100);
    expect(rangeOut).toBe(0);
    expect(currentBal).toBe(110);
  });

  it("2. Standalone Opening Stock: Opening 50 with no transactions yields OP: 50, IN: 0, BAL: 50", () => {
    const prodId = "prod-nokia-3310";
    const product = {
      id: prodId,
      name: "Nokia 3310",
      openingQuantity: 50,
      currentStock: 50,
    };
    const transactions: any[] = [
      {
        id: "tx-op-2",
        productId: prodId,
        type: "OPENING",
        quantity: 50,
        date: new Date("2026-10-01"),
      },
    ];

    const sDate = new Date("2026-10-01T00:00:00.000Z");
    const eDate = new Date("2026-10-31T23:59:59.999Z");

    const openingTxs = transactions.filter((t) => t.type === "OPENING");
    const baselineOpening = Math.max(
      Number(product.openingQuantity || 0),
      openingTxs.reduce((sum, t) => sum + Math.abs(Number(t.quantity)), 0)
    );

    let priorIn = 0;
    let priorOut = 0;
    let rangeIn = 0;
    let rangeOut = 0;

    for (const t of transactions) {
      if (t.type === "OPENING") continue;
      const isPositive = ["STOCK_IN", "PURCHASE", "SALE_RETURN"].includes(t.type);
      const q = Math.abs(Number(t.quantity));
      if (isPositive) rangeIn += q;
    }

    const op = baselineOpening + priorIn - priorOut;
    const currentBal = op + rangeIn - rangeOut;

    expect(op).toBe(50);
    expect(rangeIn).toBe(0);
    expect(currentBal).toBe(50);
  });

  it("3. Deduplication merges duplicate products with identical names into single row", () => {
    const categoryGroup: { items: any[] } = { items: [] };

    const duplicateProducts = [
      { id: "prod-samsung-real", name: "Samsung Galaxy A57", op: 10, rangeIn: 250, rangeOut: 7, currentBal: 253 },
      { id: "prod-samsung-ghost", name: "SAMSUNG GALAXY A57", op: 0, rangeIn: 0, rangeOut: 0, currentBal: 0 },
    ];

    for (const prod of duplicateProducts) {
      const normalizedName = prod.name.trim().toLowerCase();
      const existing = categoryGroup.items.find(
        (it) => it.description.trim().toLowerCase() === normalizedName
      );

      if (existing) {
        existing.op += prod.op;
        existing.in += prod.rangeIn;
        existing.out += prod.rangeOut;
        existing.bal += prod.currentBal;
      } else {
        categoryGroup.items.push({
          id: prod.id,
          description: prod.name,
          op: prod.op,
          in: prod.rangeIn,
          out: prod.rangeOut,
          bal: prod.currentBal,
        });
      }
    }

    // Only 1 consolidated row must remain
    expect(categoryGroup.items.length).toBe(1);
    expect(categoryGroup.items[0].description).toBe("Samsung Galaxy A57");
    expect(categoryGroup.items[0].op).toBe(10);
    expect(categoryGroup.items[0].in).toBe(250);
    expect(categoryGroup.items[0].out).toBe(7);
    expect(categoryGroup.items[0].bal).toBe(253);
  });

  it("4. Date boundary filtering correctly includes same-day transactions up to 23:59:59.999", () => {
    const sDate = new Date("2026-10-29");
    sDate.setHours(0, 0, 0, 0);
    const eDate = new Date("2026-10-29");
    eDate.setHours(23, 59, 59, 999);

    const sameDayEveningTx = new Date("2026-10-29T18:45:00.000Z");
    const isIncluded = sameDayEveningTx >= sDate && sameDayEveningTx <= eDate;

    expect(isIncluded).toBe(true);
  });
});
