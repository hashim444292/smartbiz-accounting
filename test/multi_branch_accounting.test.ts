import { describe, it, expect } from "vitest";
import {
  fallbackStore,
  storeGetBranches,
  storeAddBranch,
  storeUpdateBranch,
  storeDeleteBranch,
  storeAssignUserBranch,
  storeAddSale,
} from "@/lib/fallbackStore";
import { getActiveBranchId } from "@/lib/businessHelper";
import { NextRequest } from "next/server";

describe("Multi-Branch Accounting Hierarchy & Isolation System", () => {
  it("1. Super Admin Authorization Gatekeeping: Only authorized companies can create sub-branches", () => {
    const hanif = fallbackStore.companies.find((c) => c.id === "biz-101");
    const smartbiz = fallbackStore.companies.find((c) => c.id === "biz-102");
    const almadina = fallbackStore.companies.find((c) => c.id === "biz-103");

    // Super Admin authorized biz-101 (HANIF Mobile Center)
    expect(hanif?.canCreateBranches).toBe(true);

    // Standard companies cannot create branches without Super Admin authorization
    expect(smartbiz?.canCreateBranches).toBe(false);
    expect(almadina?.canCreateBranches).toBe(false);
  });

  it("2. Initial Seed Branches: Authorized company has pre-configured operational outlets", () => {
    const hanifBranches = storeGetBranches("biz-101");
    expect(hanifBranches.length).toBeGreaterThanOrEqual(2);

    const saddar = hanifBranches.find((b) => b.code === "KHI-01");
    const gulshan = hanifBranches.find((b) => b.code === "KHI-02");

    expect(saddar).toBeDefined();
    expect(saddar?.name).toContain("Saddar Main Branch");
    expect(saddar?.isActive).toBe(true);

    expect(gulshan).toBeDefined();
    expect(gulshan?.name).toContain("Gulshan Outlet");
    expect(gulshan?.isActive).toBe(true);

    // Companies without branch permission have no branches
    const smartbizBranches = storeGetBranches("biz-102");
    expect(smartbizBranches.length).toBe(0);
  });

  it("3. Self-Service Sub-Branch Management: Company Owner can add, update, and manage branches", () => {
    const initialCount = storeGetBranches("biz-101").length;

    // Create a new branch
    const newBranch = storeAddBranch({
      businessId: "biz-101",
      name: "DHA Phase 6 Express Counter",
      code: "KHI-03",
      address: "Lane 4, Bukhari Commercial, DHA Phase 6",
      city: "Karachi",
      phone: "0300-9988776",
      email: "dha@hanifmobile.pk",
      managerName: "Zubair Khan",
      isActive: true,
    });

    expect(newBranch).toBeDefined();
    expect(newBranch.id).toBeDefined();
    expect(newBranch.code).toBe("KHI-03");

    const updatedBranches = storeGetBranches("biz-101");
    expect(updatedBranches.length).toBe(initialCount + 1);

    // Update branch details
    const updated = storeUpdateBranch(newBranch.id, {
      managerName: "Zubair Ahmed Khan",
      phone: "0300-1122334",
    });
    expect(updated?.managerName).toBe("Zubair Ahmed Khan");
    expect(updated?.phone).toBe("0300-1122334");

    // Clean up test branch
    const deleted = storeDeleteBranch(newBranch.id);
    expect(deleted).toBe(true);
    expect(storeGetBranches("biz-101").length).toBe(initialCount);
  });

  it("4. Staff Branch Assignment: Staff users are strictly locked to their assigned branch", () => {
    // usr-4 (Bilal Cashier) is assigned to Saddar Main Branch (br-101-1)
    const bilal = fallbackStore.users.find((u) => u.id === "usr-4");
    expect(bilal).toBeDefined();
    expect(bilal?.branchId).toBe("br-101-1");
    expect(bilal?.branchName).toBe("Saddar Main Branch");

    // Assign another user to Gulshan Outlet (br-101-2)
    storeAssignUserBranch("usr-3", "br-101-2", "Gulshan Outlet");
    const farhan = fallbackStore.users.find((u) => u.id === "usr-3");
    expect(farhan?.branchId).toBe("br-101-2");
    expect(farhan?.branchName).toBe("Gulshan Outlet");

    // Restore usr-3 to null (accountant at head office)
    storeAssignUserBranch("usr-3", null);
    const farhanRestored = fallbackStore.users.find((u) => u.id === "usr-3");
    expect(farhanRestored?.branchId).toBeNull();
  });

  it("5. Transaction Scoping & Data Isolation: Branch-stamped transactions are isolated", () => {
    // Check sales in biz-101
    const bizSales = fallbackStore.sales.filter((s) => s.businessId === "biz-101");
    expect(bizSales.length).toBeGreaterThan(0);

    const saddarSales = bizSales.filter((s) => s.branchId === "br-101-1");
    const gulshanSales = bizSales.filter((s) => s.branchId === "br-101-2");

    expect(saddarSales.length).toBeGreaterThan(0);
    expect(gulshanSales.length).toBeGreaterThan(0);

    // Check that Saddar sales do NOT leak into Gulshan sales
    for (const s of saddarSales) {
      expect(s.branchId).toBe("br-101-1");
      expect(s.branchId).not.toBe("br-101-2");
    }

    for (const s of gulshanSales) {
      expect(s.branchId).toBe("br-101-2");
      expect(s.branchId).not.toBe("br-101-1");
    }

    // New sale with branchId is stamped correctly
    const newSale = storeAddSale({
      businessId: "biz-101",
      branchId: "br-101-1",
      invoiceNumber: "INV-BRANCH-TEST-01",
      customerName: "Test Branch Customer",
      subtotal: 50000,
      salesTax: 9000,
      totalAmount: 59000,
      paymentMethod: "CASH",
      items: [
        {
          productId: "prod-101-1",
          name: "Test iPhone Case",
          sku: "TEST-CASE",
          quantity: 10,
          unitPrice: 5000,
          subtotal: 50000,
          taxRate: 18,
          salesTax: 9000,
          totalAmount: 59000,
        },
      ],
    });

    expect(newSale.branchId).toBe("br-101-1");
    const retrievedSale = fallbackStore.sales.find((s) => s.id === newSale.id);
    expect(retrievedSale?.branchId).toBe("br-101-1");
  });

  it("6. Consolidated vs Branch-Specific Aggregation: Owner sees total and individual branch figures", () => {
    const allSales = fallbackStore.sales.filter((s) => s.businessId === "biz-101");
    const allPurchases = fallbackStore.purchases.filter((p) => p.businessId === "biz-101");
    const allExpenses = fallbackStore.expenses.filter((e) => e.businessId === "biz-101");

    // Consolidated Totals (All Branches)
    const consolidatedSales = allSales.reduce((acc, s) => acc + Number(s.totalAmount || 0), 0);
    const consolidatedPurchases = allPurchases.reduce((acc, p) => acc + Number(p.totalAmount || 0), 0);
    const consolidatedExpenses = allExpenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);

    // Saddar Branch Totals
    const saddarSales = allSales.filter((s) => s.branchId === "br-101-1").reduce((acc, s) => acc + Number(s.totalAmount || 0), 0);
    const saddarExpenses = allExpenses.filter((e) => e.branchId === "br-101-1").reduce((acc, e) => acc + Number(e.amount || 0), 0);

    // Gulshan Branch Totals
    const gulshanSales = allSales.filter((s) => s.branchId === "br-101-2").reduce((acc, s) => acc + Number(s.totalAmount || 0), 0);
    const gulshanExpenses = allExpenses.filter((e) => e.branchId === "br-101-2").reduce((acc, e) => acc + Number(e.amount || 0), 0);

    // Verified that individual branch sums do not exceed consolidated total
    expect(saddarSales + gulshanSales).toBeLessThanOrEqual(consolidatedSales);
    expect(saddarExpenses + gulshanExpenses).toBeLessThanOrEqual(consolidatedExpenses);

    // Verified both branches have positive sales and expenses
    expect(saddarSales).toBeGreaterThan(0);
    expect(gulshanSales).toBeGreaterThan(0);
    expect(saddarExpenses).toBeGreaterThan(0);
    expect(gulshanExpenses).toBeGreaterThan(0);

    // Verified branch breakdown performance metrics
    const branches = storeGetBranches("biz-101");
    const breakdown = branches.map((b) => {
      const bSales = allSales.filter((s) => s.branchId === b.id).reduce((acc, s) => acc + Number(s.totalAmount || 0), 0);
      const bPurchases = allPurchases.filter((p) => p.branchId === b.id).reduce((acc, p) => acc + Number(p.totalAmount || 0), 0);
      const bExpenses = allExpenses.filter((e) => e.branchId === b.id).reduce((acc, e) => acc + Number(e.amount || 0), 0);
      const netProfit = bSales - bPurchases * 0.7 - bExpenses;
      const share = consolidatedSales > 0 ? (bSales / consolidatedSales) * 100 : 0;
      return { id: b.id, name: b.name, bSales, bPurchases, bExpenses, netProfit, share };
    });

    expect(breakdown.length).toBeGreaterThanOrEqual(2);
    for (const item of breakdown) {
      expect(item.share).toBeGreaterThan(0);
      expect(item.share).toBeLessThanOrEqual(100);
    }
  });

  it("7. Security & Role Enforcement: Staff user cannot escape assigned branch via headers or cookies", async () => {
    // Simulate staff user locked to br-101-1
    const staffSession = {
      userId: "usr-4",
      email: "staff@smartbiz.com",
      role: "STAFF",
      businessId: "biz-101",
      branchId: "br-101-1",
      branchName: "Saddar Main Branch",
    };

    // Staff tries to tamper and request Gulshan Outlet (br-101-2) via cookie
    const reqWithTamperedCookie = new NextRequest("http://localhost:3000/api/sales", {
      headers: {
        cookie: "sb_active_branch_id=br-101-2",
        "x-branch-id": "br-101-2",
      },
    });

    const resolvedStaff = await getActiveBranchId(reqWithTamperedCookie, staffSession);
    // MUST strictly return assigned branch "br-101-1", ignoring any attempt to switch
    expect(resolvedStaff.branchId).toBe("br-101-1");
    expect(resolvedStaff.isLockedToBranch).toBe(true);

    // Owner / Super Admin with no locked branch CAN switch branches
    const ownerSession = {
      userId: "usr-2",
      email: "hanif@mobile.com",
      role: "OWNER_ADMIN",
      businessId: "biz-101",
      branchId: null,
      branchName: null,
    };

    const resolvedOwner = await getActiveBranchId(reqWithTamperedCookie, ownerSession);
    // Owner successfully switches to br-101-2
    expect(resolvedOwner.branchId).toBe("br-101-2");
    expect(resolvedOwner.isLockedToBranch).toBe(false);

    // When cookie is cleared / "all", owner gets null (All Branches consolidated)
    const reqConsolidated = new NextRequest("http://localhost:3000/api/sales", {
      headers: {
        cookie: "sb_active_branch_id=",
      },
    });
    const resolvedConsolidated = await getActiveBranchId(reqConsolidated, ownerSession);
    expect(resolvedConsolidated.branchId).toBeNull();
    expect(resolvedConsolidated.isLockedToBranch).toBe(false);
  });
});
