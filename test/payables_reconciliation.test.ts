import { describe, it, expect, beforeEach } from "vitest";
import { fallbackStore, storeEnsureStandardAccounts } from "@/lib/fallbackStore";
import { GET as getDashboardRoute } from "@/app/api/dashboard/route";
import { GET as getSuppliersRoute } from "@/app/api/suppliers/route";
import { GET as getAccountingRoute } from "@/app/api/accounting/route";
import { GET as getMonthlyClosingRoute } from "@/app/api/reports/monthly-closing/route";
import { calculateTotalPayables, storeReconcileSupplierPayables } from "@/lib/payablesHelper";
import { NextRequest } from "next/server";

describe("Payables Reconciliation & Auto-Heal Engine", () => {
  const businessId = "biz-abdullah-traders";

  const getTestBills = () => [
    {
      id: "pur-2026-00005",
      businessId,
      purchaseNumber: "PUR-2026-00005",
      supplierId: null, // initially unlinked
      supplierName: "SK Communication",
      totalAmount: 4950000,
      paidAmount: 0,
      remainingAmount: 4950000,
      paymentStatus: "UNPAID",
      paymentMethod: "CASH",
      date: "2026-10-25T10:00:00.000Z",
      status: "POSTED",
      items: [],
    },
    {
      id: "pur-2026-00004",
      businessId,
      purchaseNumber: "PUR-2026-00004",
      supplierId: null,
      supplierName: "SK Communication",
      totalAmount: 727600,
      paidAmount: 400000,
      remainingAmount: 327600,
      paymentStatus: "PARTIAL",
      paymentMethod: "BANK",
      date: "2026-10-24T10:00:00.000Z",
      status: "POSTED",
      items: [],
    },
    {
      id: "pur-2026-00003",
      businessId,
      purchaseNumber: "PUR-2026-00003",
      supplierId: null,
      supplierName: "SK Communication",
      totalAmount: 2507400,
      paidAmount: 2507400,
      remainingAmount: 0,
      paymentStatus: "PAID",
      paymentMethod: "BANK",
      date: "2026-10-23T10:00:00.000Z",
      status: "POSTED",
      items: [],
    },
    {
      id: "pur-2026-00002",
      businessId,
      purchaseNumber: "PUR-2026-00002",
      supplierId: null,
      supplierName: "SK Communication",
      totalAmount: 4400000,
      paidAmount: 0,
      remainingAmount: 4400000,
      paymentStatus: "UNPAID",
      paymentMethod: "CASH",
      date: "2026-10-22T10:00:00.000Z",
      status: "POSTED",
      items: [],
    },
    {
      id: "pur-2026-00001",
      businessId,
      purchaseNumber: "PUR-2026-00001",
      supplierId: null,
      supplierName: "SK Communication",
      totalAmount: 3000000,
      paidAmount: 0,
      remainingAmount: 3000000,
      paymentStatus: "UNPAID",
      paymentMethod: "CASH",
      date: "2026-10-21T10:00:00.000Z",
      status: "POSTED",
      items: [],
    },
  ];

  beforeEach(() => {
    // Reset test company in fallbackStore
    const compIdx = fallbackStore.companies.findIndex((c) => c.id === businessId);
    if (compIdx >= 0) fallbackStore.companies.splice(compIdx, 1);

    fallbackStore.companies.push({
      id: businessId,
      name: "Abdullah Traders",
      packageType: "FULL_SUITE",
      enabledModules: ["sales", "purchases", "inventory", "accounting", "reports"],
    });

    storeEnsureStandardAccounts(businessId);

    // Remove existing purchases, suppliers, accounts for this test biz
    fallbackStore.purchases = fallbackStore.purchases.filter((p) => p.businessId !== businessId);
    fallbackStore.suppliers = fallbackStore.suppliers.filter((s) => s.businessId !== businessId);
    fallbackStore.journalEntries = fallbackStore.journalEntries.filter(
      (j: any) => j.businessId !== businessId
    );

    // Seed test bills
    fallbackStore.purchases.push(...(getTestBills() as any));
  });

  it("should accurately reconcile Rs 12,677,600 payable across open purchase bills even if supplier was unlinked", async () => {
    const bills = getTestBills();
    // Expected total remaining: 4950000 + 327600 + 0 + 4400000 + 3000000 = 12677600
    const expectedRemaining = 12677600;

    // 1. Test calculation utility
    const calcPayables = calculateTotalPayables([], bills);
    expect(calcPayables).toBe(expectedRemaining);

    // 2. Test storeReconcileSupplierPayables
    const recon = storeReconcileSupplierPayables(businessId);
    expect(recon.totalPayables).toBe(expectedRemaining);
    expect(recon.supplierCount).toBe(1);

    // Verify supplier record exists in fallbackStore.suppliers
    const sup = fallbackStore.suppliers.find(
      (s) => s.businessId === businessId && s.name.toLowerCase() === "sk communication"
    );
    expect(sup).toBeDefined();
    expect(sup?.currentBalance).toBe(expectedRemaining);

    // Verify purchase bills got linked to supplier
    const p1 = fallbackStore.purchases.find((p) => p.id === "pur-2026-00005");
    expect(p1?.supplierId).toBe(sup?.id);

    // Verify Account 2010 (Accounts Payable) has balance 12677600
    const acc2010 = fallbackStore.accounts.find(
      (a) => a.businessId === businessId && a.code === "2010"
    );
    expect(acc2010).toBeDefined();
    expect(acc2010?.balance).toBe(expectedRemaining);

    // Verify journal entries exist for the purchases
    const purJournals = fallbackStore.journalEntries.filter(
      (j: any) => j.businessId === businessId && j.referenceType === "PURCHASE"
    );
    expect(purJournals.length).toBeGreaterThanOrEqual(4); // 4 open bills
  });

  it("should return totalPayables = 12,677,600 on GET /api/dashboard", async () => {
    const req = new NextRequest("http://localhost:3000/api/dashboard", {
      headers: { "x-business-id": businessId },
    });

    const res = await getDashboardRoute(req);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.totalPayables).toBe(12677600);
  });

  it("should return SK Communication with currentBalance = 12,677,600 on GET /api/suppliers", async () => {
    const req = new NextRequest("http://localhost:3000/api/suppliers", {
      headers: { "x-business-id": businessId },
    });

    const res = await getSuppliersRoute(req);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    const skSup = json.data.find((s: any) => s.name === "SK Communication");
    expect(skSup).toBeDefined();
    expect(skSup.currentBalance).toBe(12677600);
  });

  it("should return Account 2010 and purchases on GET /api/accounting", async () => {
    const req = new NextRequest("http://localhost:3000/api/accounting", {
      headers: { "x-business-id": businessId },
    });

    const res = await getAccountingRoute(req);
    const json = await res.json();

    expect(json.success).toBe(true);
    const acc2010 = json.data.accounts.find((a: any) => a.code === "2010");
    expect(acc2010).toBeDefined();
    expect(acc2010.balance).toBe(12677600);
    expect(json.data.purchases.length).toBe(5);
  });

  it("should return payables.total = 12,677,600 on GET /api/reports/monthly-closing", async () => {
    const req = new NextRequest("http://localhost:3000/api/reports/monthly-closing?year=2026&month=10", {
      headers: { "x-business-id": businessId },
    });

    const res = await getMonthlyClosingRoute(req);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.payables.total).toBe(12677600);
  });
});
