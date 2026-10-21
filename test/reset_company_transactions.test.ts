import { describe, it, expect } from "vitest";
import { POST } from "../src/app/api/admin/companies/reset-transactions/route";
import { fallbackStore } from "../src/lib/fallbackStore";

describe("Admin Company Transactions Reset Suite", () => {
  it("should reset sales, payment allocations, customer balances in fallback store", async () => {
    const testBizId = "biz-reset-test-99";

    // Setup initial dummy data in fallback store
    fallbackStore.companies.push({
      id: testBizId,
      name: "Adeel Textile Mills",
    } as any);

    fallbackStore.sales.push({
      id: "sale-reset-1",
      businessId: testBizId,
      invoiceNumber: "INV-2026-0001",
      totalAmount: 50000,
      items: [
        {
          id: "item-reset-1",
          productName: "Cotton Yarn 20s",
        },
      ],
    } as any);

    fallbackStore.customers.push({
      id: "cust-reset-1",
      businessId: testBizId,
      name: "Test Customer A",
      currentBalance: 50000,
    } as any);

    // Call POST handler
    const req = new Request("http://localhost:3000/api/admin/companies/reset-transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId: testBizId,
        businessName: "Adeel Textile Mills",
      }),
    });

    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.company.name).toBe("Adeel Textile Mills");

    // Verify fallbackStore state for this business
    const remainingSales = fallbackStore.sales.filter((s) => s.businessId === testBizId);
    expect(remainingSales.length).toBe(0);

    const cust = fallbackStore.customers.find((c) => c.id === "cust-reset-1");
    expect(cust?.currentBalance).toBe(0);

    // Verify company itself is not deleted
    const biz = fallbackStore.companies.find((b) => b.id === testBizId);
    expect(biz).toBeDefined();
    expect(biz?.name).toBe("Adeel Textile Mills");
  });

  it("should reject reset request without businessId or businessName", async () => {
    const req = new Request("http://localhost:3000/api/admin/companies/reset-transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("businessId or businessName is required");
  });
});
