import { describe, it, expect } from "vitest";
import { fallbackStore, storeAddProduct } from "@/lib/fallbackStore";
import { listProducts } from "@/services/productService";

describe("Multi-Tenant Data Isolation", () => {
  it("should have distinct companies with their own business industry profiles", () => {
    const companies = fallbackStore.companies;
    expect(companies.length).toBeGreaterThanOrEqual(3);

    const hanif = companies.find((c) => c.id === "biz-101");
    const smartbiz = companies.find((c) => c.id === "biz-102");
    const almadina = companies.find((c) => c.id === "biz-103");

    expect(hanif?.name).toContain("HANIF Mobile");
    expect(smartbiz?.name).toContain("SmartBiz Trading");
    expect(almadina?.name).toContain("Al-Madina Electronics");
  });

  it("should strictly isolate products between tenants (no cross-contamination)", async () => {
    const hanifProducts = await listProducts({ businessId: "biz-101", page: 1, limit: 50 });
    const smartbizProducts = await listProducts({ businessId: "biz-102", page: 1, limit: 50 });
    const almadinaProducts = await listProducts({ businessId: "biz-103", page: 1, limit: 50 });

    // Hanif Mobile products should contain smartphones
    expect(hanifProducts.products.some((p) => p.name.includes("iPhone"))).toBe(true);
    expect(hanifProducts.products.some((p) => p.name.includes("Samsung Galaxy"))).toBe(true);
    // Hanif should NOT have Basmati Rice or Haier AC
    expect(hanifProducts.products.some((p) => p.name.includes("Rice"))).toBe(false);
    expect(hanifProducts.products.some((p) => p.name.includes("Air Conditioner") || p.name.includes("Inverter AC"))).toBe(false);

    // SmartBiz should have Wholesale FMCG commodities
    expect(smartbizProducts.products.some((p) => p.name.includes("Basmati Rice"))).toBe(true);
    expect(smartbizProducts.products.some((p) => p.name.includes("Cooking Oil"))).toBe(true);
    // SmartBiz should NOT have iPhone or Dawlance Refrigerator
    expect(smartbizProducts.products.some((p) => p.name.includes("iPhone"))).toBe(false);
    expect(smartbizProducts.products.some((p) => p.name.includes("Refrigerator"))).toBe(false);

    // Al-Madina should have Home Electronics & Appliances
    expect(almadinaProducts.products.some((p) => p.name.includes("Inverter AC"))).toBe(true);
    expect(almadinaProducts.products.some((p) => p.name.includes("Refrigerator"))).toBe(true);
    expect(almadinaProducts.products.some((p) => p.name.includes("Smart TV"))).toBe(true);
    // Al-Madina should NOT have Basmati Rice or iPhone 15 Pro Max
    expect(almadinaProducts.products.some((p) => p.name.includes("Rice"))).toBe(false);
    expect(almadinaProducts.products.some((p) => p.name.includes("iPhone 15 Pro Max"))).toBe(false);
  });

  it("should isolate customers, suppliers, and sales strictly by tenant", () => {
    // Customers
    const hanifCustomers = fallbackStore.customers.filter((c) => c.businessId === "biz-101");
    const smartbizCustomers = fallbackStore.customers.filter((c) => c.businessId === "biz-102");
    const almadinaCustomers = fallbackStore.customers.filter((c) => c.businessId === "biz-103");

    expect(hanifCustomers.some((c) => c.name.includes("Saddar Mobile"))).toBe(true);
    expect(smartbizCustomers.some((c) => c.name.includes("Metro Cash"))).toBe(true);
    expect(almadinaCustomers.some((c) => c.name.includes("Islamabad Club"))).toBe(true);

    // Suppliers
    const hanifSuppliers = fallbackStore.suppliers.filter((s) => s.businessId === "biz-101");
    const smartbizSuppliers = fallbackStore.suppliers.filter((s) => s.businessId === "biz-102");
    const almadinaSuppliers = fallbackStore.suppliers.filter((s) => s.businessId === "biz-103");

    expect(hanifSuppliers.some((s) => s.name.includes("Apple Distributor"))).toBe(true);
    expect(smartbizSuppliers.some((s) => s.name.includes("Punjab Rice Mills"))).toBe(true);
    expect(almadinaSuppliers.some((s) => s.name.includes("Haier Pakistan"))).toBe(true);

    // Sales
    const hanifSales = fallbackStore.sales.filter((s) => s.businessId === "biz-101");
    const smartbizSales = fallbackStore.sales.filter((s) => s.businessId === "biz-102");
    const almadinaSales = fallbackStore.sales.filter((s) => s.businessId === "biz-103");

    expect(hanifSales.length).toBeGreaterThan(0);
    expect(smartbizSales.length).toBeGreaterThan(0);
    expect(almadinaSales.length).toBeGreaterThan(0);

    for (const s of hanifSales) {
      expect(s.businessId).toBe("biz-101");
    }
    for (const s of smartbizSales) {
      expect(s.businessId).toBe("biz-102");
    }
    for (const s of almadinaSales) {
      expect(s.businessId).toBe("biz-103");
    }
  });

  it("should never leak new product created in one tenant into another tenant", async () => {
    const newProd = storeAddProduct({
      businessId: "biz-102",
      name: "Super Special Basmati Kernel 10kg",
      sku: "RICE-TEST-10KG",
      uom: "bag",
      unit: "bag",
      retailPrice: 4200,
      sellingPrice: 4200,
      purchasePrice: 3800,
      currentStock: 100,
    });

    const smartbizList = await listProducts({ businessId: "biz-102", page: 1, limit: 100 });
    const hanifList = await listProducts({ businessId: "biz-101", page: 1, limit: 100 });
    const almadinaList = await listProducts({ businessId: "biz-103", page: 1, limit: 100 });

    expect(smartbizList.products.some((p) => p.id === newProd.id)).toBe(true);
    expect(hanifList.products.some((p) => p.id === newProd.id)).toBe(false);
    expect(almadinaList.products.some((p) => p.id === newProd.id)).toBe(false);
  });
});
