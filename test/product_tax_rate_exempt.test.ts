import { describe, it, expect, beforeEach } from "vitest";
import { createProduct, updateProduct } from "@/services/productService";
import { fallbackStore } from "@/lib/fallbackStore";

describe("Product 0% Exempt Tax Profile & Sales Tax Calculation Suite", () => {
  const testBusinessId = "biz-test-tax-01";

  beforeEach(() => {
    fallbackStore.products = fallbackStore.products.filter(
      (p) => p.businessId !== testBusinessId
    );
  });

  it("should create product with Exempt 0% tax profile and automatically default salesTax to 0.00", async () => {
    const { product } = await createProduct({
      businessId: testBusinessId,
      name: "Samsung A57 (Exempt Test)",
      sku: "SAM-A57-01",
      hsCode: "8517.13",
      taxProfile: "Exempt 0%",
      retailPrice: 43500,
      purchasePrice: 38000,
    });

    expect(product.taxProfile).toBe("Exempt 0%");
    expect(Number(product.salesTax)).toBe(0);
  });

  it("should not override salesTax of 0 with 18 when explicitly provided", async () => {
    const { product } = await createProduct({
      businessId: testBusinessId,
      name: "Nokia 105 (Explicit 0%)",
      sku: "NOK-105-01",
      hsCode: "8517.13",
      taxProfile: "Exempt 0%",
      salesTax: 0,
      retailPrice: 1500,
      purchasePrice: 1200,
    });

    expect(Number(product.salesTax)).toBe(0);
  });

  it("should default salesTax to 18.00 when Standard 18% profile is selected without explicit salesTax", async () => {
    const { product } = await createProduct({
      businessId: testBusinessId,
      name: "Standard Tax Product",
      sku: "STD-PROD-01",
      hsCode: "8517.13",
      taxProfile: "Standard 18%",
      retailPrice: 5000,
    });

    expect(product.taxProfile).toBe("Standard 18%");
    expect(Number(product.salesTax)).toBe(18);
  });

  it("should update product tax rate to 0 when modified to Exempt 0%", async () => {
    const { product } = await createProduct({
      businessId: testBusinessId,
      name: "Switching Tax Product",
      sku: "SW-01",
      hsCode: "8517.13",
      taxProfile: "Standard 18%",
      salesTax: 18,
      retailPrice: 10000,
    });

    expect(Number(product.salesTax)).toBe(18);

    const updated = await updateProduct(product.id, {
      taxProfile: "Exempt 0%",
      salesTax: 0,
    });

    expect(updated.taxProfile).toBe("Exempt 0%");
    expect(Number(updated.salesTax)).toBe(0);
  });
});
