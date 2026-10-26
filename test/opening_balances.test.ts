import { describe, it, expect, beforeEach } from "vitest";
import { GET, POST } from "../src/app/api/accounting/opening-balances/route";
import { fallbackStore } from "../src/lib/fallbackStore";

describe("Opening Balances, Capital Assignment & Double-Entry Setup Suite", () => {
  const testBizId = "biz-ob-test-01";

  beforeEach(() => {
    // Reset or prepare test business in fallbackStore
    const existingBiz = fallbackStore.companies.find((c) => c.id === testBizId);
    if (!existingBiz) {
      fallbackStore.companies.push({
        id: testBizId,
        name: "Metro Trading Corp",
        packageType: "FULL_SUITE",
      } as any);
    }
  });

  it("should calculate totals and return initial state for a company", async () => {
    const req = new Request("http://localhost:3000/api/accounting/opening-balances", {
      headers: { "x-business-id": testBizId },
    });

    const res = await GET(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.summary).toBeDefined();
    expect(body.data.summary.isBalanced).toBe(true);
  });

  it("should reject unbalanced opening balance posting with a clear error", async () => {
    const unbalancedPayload = {
      asOfDate: "2026-07-01",
      capital: {
        amount: 100000, // Capital: 100,000
      },
      cashBank: [
        { name: "Cash in Hand", type: "CASH", balance: 50000 }, // Asset: 50,000 (Mismatch with 100,000)
      ],
      inventory: [],
      customers: [],
      suppliers: [],
    };

    const req = new Request("http://localhost:3000/api/accounting/opening-balances", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-business-id": testBizId,
      },
      body: JSON.stringify(unbalancedPayload),
    });

    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toContain("must be mathematically balanced");
  });

  it("should successfully post balanced opening balances across Capital, Cash, Stock, Receivables & Payables", async () => {
    // Assets: Cash (50,000) + Bank (150,000) + Stock (200,000) + Receivables (100,000) = 500,000
    // Liabilities: Payables (150,000)
    // Capital: 350,000
    // Assets (500,000) == Liabilities (150,000) + Capital (350,000)
    const balancedPayload = {
      asOfDate: "2026-07-01",
      capital: {
        amount: 350000,
        notes: "Founder Initial Capital Investment",
      },
      cashBank: [
        { name: "Cash Drawer", type: "CASH", balance: 50000 },
        { name: "Meezan Bank Current", type: "BANK", accountNumber: "01020304050", balance: 150000 },
      ],
      inventory: [
        { name: "Cotton Fabric Roll", sku: "SKU-COT-01", quantity: 100, unitCost: 2000 }, // 200,000
      ],
      customers: [
        { name: "Al-Rehman Traders", phone: "03001234567", balance: 100000 }, // 100,000
      ],
      suppliers: [
        { name: "National Yarn Mills", phone: "03219876543", balance: 150000 }, // 150,000
      ],
    };

    const req = new Request("http://localhost:3000/api/accounting/opening-balances", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-business-id": testBizId,
      },
      body: JSON.stringify(balancedPayload),
    });

    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.summary.totalAssets).toBe(500000);
    expect(body.data.summary.totalLiabilities).toBe(150000);
    expect(body.data.summary.capitalAmount).toBe(350000);
    expect(body.data.summary.isBalanced).toBe(true);

    // Verify updates in fallbackStore
    const cust = fallbackStore.customers.find((c) => c.businessId === testBizId && c.name === "Al-Rehman Traders");
    expect(cust).toBeDefined();
    expect(cust?.openingBalance).toBe(100000);
    expect(cust?.currentBalance).toBe(100000);

    const sup = fallbackStore.suppliers.find((s) => s.businessId === testBizId && s.name === "National Yarn Mills");
    expect(sup).toBeDefined();
    expect(sup?.openingBalance).toBe(150000);
    expect(sup?.currentBalance).toBe(150000);

    const prod = fallbackStore.products.find((p) => p.businessId === testBizId && p.name === "Cotton Fabric Roll");
    expect(prod).toBeDefined();
    expect(prod?.currentStock).toBe(100);
    expect(prod?.purchasePrice).toBe(2000);

    const capAcc = fallbackStore.accounts.find((a) => a.businessId === testBizId && a.code === "3010");
    expect(capAcc).toBeDefined();
    expect(capAcc?.balance).toBe(350000);
  });

  it("should reject opening balance access for companies on FBR_INVOICING_ONLY package", async () => {
    const fbrBizId = "biz-di-only-99";
    fallbackStore.companies.push({
      id: fbrBizId,
      name: "Adeel Digital Invoicing Client",
      packageType: "FBR_INVOICING_ONLY",
    } as any);

    const req = new Request("http://localhost:3000/api/accounting/opening-balances", {
      headers: { "x-business-id": fbrBizId },
    });

    const res = await GET(req as any);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toContain("FBR Digital Invoicing Only mode");
  });
});
