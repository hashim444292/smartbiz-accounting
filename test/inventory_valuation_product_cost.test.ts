import { describe, it, expect, beforeEach } from "vitest";
import { getProductEffectiveCost } from "@/lib/accountingConstants";
import { createProduct, listProducts } from "@/services/productService";
import { fallbackStore } from "@/lib/fallbackStore";
import Decimal from "decimal.js";

describe("Inventory Valuation & Product Cost Resolution Engine", () => {
  const testBizId = "biz-inv-cost-test-1";

  beforeEach(() => {
    if (!fallbackStore.companies.some((c) => c.id === testBizId)) {
      fallbackStore.companies.push({
        id: testBizId,
        name: "Abdullah Traders Test",
        currency: "PKR",
      } as any);
    }
  });

  it("1. getProductEffectiveCost correctly extracts positive averageCost and avoids 0.00 string truthy trap", () => {
    // String "0.00" must NOT be treated as truthy; it must fall back to purchasePrice 28,000
    const oppoProductWithStringZero = {
      name: "oppo A7",
      averageCost: "0.00",
      purchasePrice: "28000.00",
      currentStock: "16.00",
    };
    expect(getProductEffectiveCost(oppoProductWithStringZero)).toBe(28000);

    // Number 0 must fall back to purchasePrice
    const oppoProductWithNumericZero = {
      name: "oppo A7",
      averageCost: 0,
      purchasePrice: 28000,
      currentStock: 16,
    };
    expect(getProductEffectiveCost(oppoProductWithNumericZero)).toBe(28000);

    // Decimal(0) must fall back to purchasePrice
    const oppoProductWithDecimalZero = {
      name: "oppo A7",
      averageCost: new Decimal(0),
      purchasePrice: new Decimal(28000),
      currentStock: new Decimal(16),
    };
    expect(getProductEffectiveCost(oppoProductWithDecimalZero)).toBe(28000);

    // Positive averageCost (e.g. Samsung Galaxy A57 with blended cost Rs 33,928.57) must be preserved
    const samsungBlended = {
      name: "Samsung Galaxy A57",
      averageCost: "33928.57",
      purchasePrice: "30000.00",
      currentStock: 253,
    };
    expect(getProductEffectiveCost(samsungBlended)).toBe(33928.57);
  });

  it("2. getProductEffectiveCost gracefully falls back through purchasePrice, openingCost, and costPrice", () => {
    // Only openingCost provided
    const openingOnly = {
      name: "Old Stock Item",
      averageCost: 0,
      purchasePrice: 0,
      openingCost: 15000,
    };
    expect(getProductEffectiveCost(openingOnly)).toBe(15000);

    // Only costPrice provided
    const costPriceOnly = {
      name: "Legacy Item",
      averageCost: null,
      purchasePrice: null,
      openingCost: 0,
      costPrice: 9500,
    };
    expect(getProductEffectiveCost(costPriceOnly)).toBe(9500);

    // Empty product
    expect(getProductEffectiveCost(null)).toBe(0);
    expect(getProductEffectiveCost({})).toBe(0);
  });

  it("3. Inventory table valuation calculation evaluates oppo A7 to Rs 448,000 instead of Rs 0", () => {
    const oppoA7 = {
      id: "prod-oppo-a7",
      name: "oppo A7",
      sku: "SKU-246206",
      currentStock: 16,
      averageCost: "0.00",
      purchasePrice: 28000,
      sellingPrice: 30000,
    };

    const unitCost = getProductEffectiveCost(oppoA7);
    const lineValuation = Number(oppoA7.currentStock) * unitCost;

    expect(unitCost).toBe(28000);
    expect(lineValuation).toBe(448000); // 16 pcs * Rs 28,000 = Rs 448,000
  });

  it("4. createProduct initializes averageCost and openingCost directly from purchasePrice", async () => {
    const { product } = await createProduct({
      businessId: testBizId,
      name: "vivo y20",
      purchasePrice: 32000,
      sellingPrice: 35000,
      openingQuantity: 8,
      hsCode: "8517.13",
    });

    expect(product.name).toBe("vivo y20");
    expect(Number(product.purchasePrice)).toBe(32000);
    expect(Number(product.averageCost)).toBe(32000);
    expect(Number(product.openingCost)).toBe(32000);
  });

  it("5. listProducts maps and auto-heals products with 0 averageCost to their purchasePrice", async () => {
    // Add a raw product directly into fallbackStore with averageCost: 0
    fallbackStore.products.push({
      id: "prod-samsung-a07",
      businessId: testBizId,
      name: "Samsung A07",
      sku: "SKU-246208",
      currentStock: 2,
      averageCost: 0,
      purchasePrice: 55000,
      sellingPrice: 60000,
      status: "ACTIVE",
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);

    const result = await listProducts({
      businessId: testBizId,
      page: 1,
      limit: 50,
    });

    const samsungA07 = result.products.find((p: any) => p.name === "Samsung A07");
    expect(samsungA07).toBeDefined();
    expect(Number(samsungA07?.averageCost)).toBe(55000);
  });
});
