import { NextRequest, NextResponse } from "next/server";
import { getActiveBusinessId, getActiveBranchId } from "@/lib/businessHelper";
import { getFbrComplianceOverview } from "@/services/fbrService";
import { fallbackStore, storeGetBranches } from "@/lib/fallbackStore";
import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/decimal";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const businessId = await getActiveBusinessId(req);
    const { branchId: activeBranchId, isLockedToBranch } = await getActiveBranchId(req);
    const { searchParams } = new URL(req.url);

    const fbrOverview = await getFbrComplianceOverview(businessId);

    // Retrieve general accounting metrics
    let allSales: any[] = [];
    let allPurchases: any[] = [];
    let allExpenses: any[] = [];
    let products: any[] = [];
    let customers: any[] = [];
    let suppliers: any[] = [];
    let branches: any[] = [];
    let cashBankAccounts: any[] = [];

    try {
      [allSales, allPurchases, allExpenses, products, customers, suppliers, branches, cashBankAccounts] = await Promise.all([
        prisma.sale.findMany({ where: { businessId }, include: { items: true }, orderBy: { date: "desc" } }),
        prisma.purchase.findMany({ where: { businessId } }),
        prisma.expense.findMany({ where: { businessId } }),
        prisma.product.findMany({ where: { businessId } }),
        prisma.customer.findMany({ where: { businessId, isActive: true } }),
        prisma.supplier.findMany({ where: { businessId, isActive: true } }),
        prisma.branch.findMany({ where: { businessId, isActive: true }, orderBy: { name: "asc" } }),
        prisma.cashBankAccount.findMany({ where: { businessId, isActive: true } }),
      ]);
    } catch {
      allSales = fallbackStore.sales.filter((s) => s.businessId === businessId);
      allPurchases = fallbackStore.purchases.filter((p) => p.businessId === businessId);
      allExpenses = fallbackStore.expenses.filter((e) => e.businessId === businessId);
      products = fallbackStore.products.filter((p) => p.businessId === businessId);
      customers = fallbackStore.customers.filter((c) => c.businessId === businessId);
      suppliers = fallbackStore.suppliers.filter((s) => s.businessId === businessId);
      branches = storeGetBranches(businessId);
      cashBankAccounts = fallbackStore.cashBankAccounts.filter((a) => a.businessId === businessId);
    }

    // Build quick product cost lookup map for calculating accurate Cost of Goods Sold (COGS)
    const productCostMap = new Map<string, number>();
    for (const p of products) {
      const cost = Number(p.averageCost || p.purchasePrice || p.costPrice || 0);
      productCostMap.set(p.id, cost);
    }

    // Helper to calculate accurate Cost of Goods Sold (COGS) from sold line items
    const calculateSalesCogs = (salesList: any[]) => {
      let cogs = 0;
      for (const s of salesList) {
        for (const it of s.items || []) {
          let itemCost = Number(it.costPrice || 0);
          if (itemCost <= 0 && it.productId) {
            itemCost = productCostMap.get(it.productId) || 0;
          }
          cogs += Number(it.quantity || 0) * itemCost;
        }
      }
      return cogs;
    };

    // Compute consolidated branch breakdown
    const totalAllSales = allSales.reduce((acc, s) => acc + Number(s.totalAmount || 0), 0);
    const branchBreakdown = branches.map((b) => {
      const bSales = allSales.filter((s) => s.branchId === b.id);
      const bPurchases = allPurchases.filter((p) => p.branchId === b.id);
      const bExpenses = allExpenses.filter((e) => e.branchId === b.id);

      const sTotal = bSales.reduce((acc, s) => acc + Number(s.totalAmount || 0), 0);
      const pTotal = bPurchases.reduce((acc, p) => acc + Number(p.totalAmount || 0), 0);
      const eTotal = bExpenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);
      const bCogs = calculateSalesCogs(bSales);
      const profit = sTotal - bCogs - eTotal;

      return {
        id: b.id,
        name: b.name,
        code: b.code,
        city: b.city,
        managerName: b.managerName,
        totalSales: round2(sTotal),
        totalPurchases: round2(pTotal),
        totalExpenses: round2(eTotal),
        totalCogs: round2(bCogs),
        netProfit: round2(profit),
        salesSharePercent: totalAllSales > 0 ? round2((sTotal / totalAllSales) * 100) : 0,
      };
    });

    // Apply active branch filter if user selected or is locked to a branch
    const sales = activeBranchId ? allSales.filter((s) => s.branchId === activeBranchId) : allSales;
    const purchases = activeBranchId ? allPurchases.filter((p) => p.branchId === activeBranchId) : allPurchases;
    const expenses = activeBranchId ? allExpenses.filter((e) => e.branchId === activeBranchId) : allExpenses;

    const totalGrossSales = sales.reduce((acc, s) => acc + Number(s.totalAmount || 0), 0);
    const totalPurchases = purchases.reduce((acc, p) => acc + Number(p.totalAmount || 0), 0);
    const totalExpenses = expenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);
    const totalCogs = calculateSalesCogs(sales);
    const grossProfit = totalGrossSales - totalCogs;
    const netProfit = grossProfit - totalExpenses;
    const totalReceivables = customers.reduce((acc, c) => acc + Number(c.currentBalance || 0), 0);
    const totalPayables = suppliers.reduce((acc, s) => acc + Number(s.currentBalance || 0), 0);
    const totalInventoryValue = products.reduce((acc, p) => acc + Number(p.currentStock || 0) * Number(p.averageCost || p.purchasePrice || 0), 0);

    const cashBalance = cashBankAccounts.filter((a) => a.type === "CASH").reduce((sum, a) => sum + Number(a.balance || 0), 0);
    const bankBalance = cashBankAccounts.filter((a) => a.type === "BANK").reduce((sum, a) => sum + Number(a.balance || 0), 0);

    const lowStockAlerts = products
      .filter((p) => Number(p.currentStock || 0) <= Number(p.minStockLevel || 1))
      .map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        stock: Number(p.currentStock || 0),
        min: Number(p.minStockLevel || 1),
      }));

    // Generate real monthly revenue trend based on actual data only (no dummy data)
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyTrends: { month: string; sales: number; tax: number; fbrCompliant: number }[] = [];
    const curr = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(curr.getFullYear(), curr.getMonth() - i, 1);
      const mIdx = d.getMonth();
      const y = d.getFullYear();
      const mLabel = i === 0 ? `${monthNames[mIdx]} (Current)` : monthNames[mIdx];

      const mSales = sales.filter((s) => {
        if (!s.date) return false;
        const sd = new Date(s.date);
        return sd.getFullYear() === y && sd.getMonth() === mIdx;
      });

      const sTotal = mSales.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);
      const tTotal = mSales.reduce((sum, s) => sum + Number((s.salesTax || 0) + (s.furtherTax || 0) + (s.extraTax || 0)), 0);
      const fbrTotal = mSales
        .filter((s) => s.fbrInvoiceNumber || s.fbrStatus === "VALID" || s.fbrStatus === "VERIFIED" || s.fbrStatus === "SUBMITTED")
        .reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);

      monthlyTrends.push({
        month: mLabel,
        sales: round2(sTotal).toNumber(),
        tax: round2(tTotal).toNumber(),
        fbrCompliant: round2(fbrTotal).toNumber(),
      });
    }

    // Calculate Payment Reminders for Overdue & Upcoming Receivables & Payables
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const nowMidnight = new Date(todayStr).getTime();

    const reminders: any[] = [];
    for (const s of sales.filter((s) => Number(s.remainingAmount || 0) > 0 && s.paymentStatus !== "PAID")) {
      const custBal = customers.find((c) => c.id === s.customerId)?.currentBalance || 0;
      if (s.customerId && Number(custBal) <= 0) continue;

      let dueObj = s.dueDate ? new Date(s.dueDate) : new Date(new Date(s.date).getTime() + 7 * 86400000);
      const dueStr = dueObj.toISOString().slice(0, 10);
      const dueMidnight = new Date(dueStr).getTime();
      const diffDays = Math.round((nowMidnight - dueMidnight) / 86400000);

      reminders.push({
        id: s.id,
        type: "RECEIVABLE",
        referenceNumber: s.invoiceNumber,
        partyId: s.customerId,
        partyName: s.customerName || "Customer",
        partyPhone: s.customer?.phone || null,
        remainingAmount: Number(s.remainingAmount),
        dueDate: dueStr,
        daysOverdue: Math.max(0, diffDays),
        urgency: diffDays > 0 ? "OVERDUE" : (diffDays === 0 ? "DUE_TODAY" : "UPCOMING"),
      });
    }

    for (const p of purchases.filter((p) => Number(p.remainingAmount || 0) > 0 && p.paymentStatus !== "PAID")) {
      const supBal = suppliers.find((s) => s.id === p.supplierId)?.currentBalance || 0;
      if (p.supplierId && Number(supBal) <= 0) continue;

      let dueObj = p.dueDate ? new Date(p.dueDate) : new Date(new Date(p.date).getTime() + 7 * 86400000);
      const dueStr = dueObj.toISOString().slice(0, 10);
      const dueMidnight = new Date(dueStr).getTime();
      const diffDays = Math.round((nowMidnight - dueMidnight) / 86400000);

      reminders.push({
        id: p.id,
        type: "PAYABLE",
        referenceNumber: p.purchaseNumber,
        partyId: p.supplierId,
        partyName: p.supplierName || "Supplier",
        partyPhone: p.supplier?.phone || null,
        remainingAmount: Number(p.remainingAmount),
        dueDate: dueStr,
        daysOverdue: Math.max(0, diffDays),
        urgency: diffDays > 0 ? "OVERDUE" : (diffDays === 0 ? "DUE_TODAY" : "UPCOMING"),
      });
    }

    reminders.sort((a, b) => {
      const order: Record<string, number> = { OVERDUE: 0, DUE_TODAY: 1, UPCOMING: 2 };
      if (order[a.urgency] !== order[b.urgency]) return order[a.urgency] - order[b.urgency];
      if (a.urgency === "OVERDUE") return b.daysOverdue - a.daysOverdue;
      return a.dueDate.localeCompare(b.dueDate);
    });

    const overdueCount = reminders.filter((r) => r.urgency === "OVERDUE").length;
    const dueTodayCount = reminders.filter((r) => r.urgency === "DUE_TODAY").length;
    const totalOverdueReceivables = reminders
      .filter((r) => r.type === "RECEIVABLE" && (r.urgency === "OVERDUE" || r.urgency === "DUE_TODAY"))
      .reduce((sum, r) => sum + r.remainingAmount, 0);
    const totalOverduePayables = reminders
      .filter((r) => r.type === "PAYABLE" && (r.urgency === "OVERDUE" || r.urgency === "DUE_TODAY"))
      .reduce((sum, r) => sum + r.remainingAmount, 0);

    const paymentReminders = {
      overdueCount,
      dueTodayCount,
      upcomingCount: reminders.filter((r) => r.urgency === "UPCOMING").length,
      totalOverdueReceivables: round2(totalOverdueReceivables),
      totalOverduePayables: round2(totalOverduePayables),
      reminders: reminders.slice(0, 15),
    };

    const activeBranch = branches.find((b) => b.id === activeBranchId);

    return NextResponse.json({
      success: true,
      data: {
        // Multi-Branch Metadata
        activeBranchId: activeBranchId || null,
        activeBranchName: activeBranch?.name || null,
        isLockedToBranch,
        branchesCount: branches.length,
        branchBreakdown,

        // Executive FBR & Tax Metrics
        netSales: fbrOverview.totalNetSales,
        taxCollected: fbrOverview.totalTaxCollected,
        salesTax: fbrOverview.totalSalesTax,
        furtherTax: fbrOverview.totalFurtherTax,
        extraTax: fbrOverview.totalExtraTax,
        pendingFbr: fbrOverview.pendingFbr,
        successfulFbr: fbrOverview.successFbr,
        failedFbr: fbrOverview.failedFbr,
        complianceScore: fbrOverview.complianceScore,
        complianceIssues: fbrOverview.complianceIssues,
        recentInvoices: sales.slice(0, 10),
        monthlyTrends,

        // Core Accounting Metrics
        totalGrossSales: round2(totalGrossSales),
        totalPurchases: round2(totalPurchases),
        totalExpenses: round2(totalExpenses),
        totalCogs: round2(totalCogs),
        grossProfit: round2(grossProfit),
        netProfit: round2(netProfit),
        totalReceivables: round2(totalReceivables),
        totalPayables: round2(totalPayables),
        totalInventoryValue: round2(totalInventoryValue),
        cashBalance: round2(cashBalance),
        bankBalance: round2(bankBalance),
        lowStockCount: lowStockAlerts.length,
        lowStockAlerts,

        // Overdue & Promised Payment Reminders
        paymentReminders,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
