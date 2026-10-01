import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveBusinessId, getActiveBranchId } from "@/lib/businessHelper";
import { round2 } from "@/lib/decimal";

export const dynamic = "force-dynamic";

export interface ReminderItem {
  id: string;
  type: "RECEIVABLE" | "PAYABLE";
  referenceNumber: string;
  partyId: string | null;
  partyName: string;
  partyPhone?: string | null;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  date: string;
  dueDate: string;
  daysOverdue: number;
  urgency: "OVERDUE" | "DUE_TODAY" | "UPCOMING";
  paymentStatus: string;
  branchName?: string | null;
}

export async function GET(req: NextRequest) {
  try {
    const businessId = await getActiveBusinessId(req);
    const { branchId } = await getActiveBranchId(req);

    const whereSales: any = {
      businessId,
      remainingAmount: { gt: 0 },
      paymentStatus: { not: "PAID" },
    };
    if (branchId) whereSales.branchId = branchId;

    const wherePurchases: any = {
      businessId,
      remainingAmount: { gt: 0 },
      paymentStatus: { not: "PAID" },
    };
    if (branchId) wherePurchases.branchId = branchId;

    const [unpaidSales, unpaidPurchases] = await Promise.all([
      prisma.sale.findMany({
        where: whereSales,
        include: { customer: true, branch: true },
        orderBy: { date: "asc" },
      }),
      prisma.purchase.findMany({
        where: wherePurchases,
        include: { supplier: true, branch: true },
        orderBy: { date: "asc" },
      }),
    ]);

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const nowMidnight = new Date(todayStr).getTime();

    const reminders: ReminderItem[] = [];

    // Process Sales (Receivables from Customers)
    for (const s of unpaidSales) {
      // If customer has 0 or negative balance, they don't owe money
      if (s.customer && Number(s.customer.currentBalance || 0) <= 0) continue;

      let dueObj = s.dueDate ? new Date(s.dueDate) : new Date(new Date(s.date).getTime() + 7 * 86400000);
      const dueStr = dueObj.toISOString().slice(0, 10);
      const dueMidnight = new Date(dueStr).getTime();

      const diffDays = Math.round((nowMidnight - dueMidnight) / 86400000);
      let urgency: "OVERDUE" | "DUE_TODAY" | "UPCOMING" = "UPCOMING";
      if (diffDays > 0) {
        urgency = "OVERDUE";
      } else if (diffDays === 0) {
        urgency = "DUE_TODAY";
      }

      reminders.push({
        id: s.id,
        type: "RECEIVABLE",
        referenceNumber: s.invoiceNumber,
        partyId: s.customerId || null,
        partyName: s.customerName || "Customer",
        partyPhone: s.customer?.phone || null,
        totalAmount: Number(s.totalAmount),
        paidAmount: Number(s.paidAmount),
        remainingAmount: Number(s.remainingAmount),
        date: s.date.toISOString(),
        dueDate: dueStr,
        daysOverdue: Math.max(0, diffDays),
        urgency,
        paymentStatus: s.paymentStatus,
        branchName: s.branch?.name || null,
      });
    }

    // Process Purchases (Payables to Suppliers)
    for (const p of unpaidPurchases) {
      if (p.supplier && Number(p.supplier.currentBalance || 0) <= 0) continue;

      let dueObj = p.dueDate ? new Date(p.dueDate) : new Date(new Date(p.date).getTime() + 7 * 86400000);
      const dueStr = dueObj.toISOString().slice(0, 10);
      const dueMidnight = new Date(dueStr).getTime();

      const diffDays = Math.round((nowMidnight - dueMidnight) / 86400000);
      let urgency: "OVERDUE" | "DUE_TODAY" | "UPCOMING" = "UPCOMING";
      if (diffDays > 0) {
        urgency = "OVERDUE";
      } else if (diffDays === 0) {
        urgency = "DUE_TODAY";
      }

      reminders.push({
        id: p.id,
        type: "PAYABLE",
        referenceNumber: p.purchaseNumber,
        partyId: p.supplierId || null,
        partyName: p.supplierName || "Supplier",
        partyPhone: p.supplier?.phone || null,
        totalAmount: Number(p.totalAmount),
        paidAmount: Number(p.paidAmount),
        remainingAmount: Number(p.remainingAmount),
        date: p.date.toISOString(),
        dueDate: dueStr,
        daysOverdue: Math.max(0, diffDays),
        urgency,
        paymentStatus: p.paymentStatus,
        branchName: p.branch?.name || null,
      });
    }

    // Sort: OVERDUE first (most overdue first), then DUE_TODAY, then UPCOMING
    reminders.sort((a, b) => {
      const order = { OVERDUE: 0, DUE_TODAY: 1, UPCOMING: 2 };
      if (order[a.urgency] !== order[b.urgency]) {
        return order[a.urgency] - order[b.urgency];
      }
      if (a.urgency === "OVERDUE") {
        return b.daysOverdue - a.daysOverdue;
      }
      return a.dueDate.localeCompare(b.dueDate);
    });

    const overdueCount = reminders.filter((r) => r.urgency === "OVERDUE").length;
    const dueTodayCount = reminders.filter((r) => r.urgency === "DUE_TODAY").length;
    const upcomingCount = reminders.filter((r) => r.urgency === "UPCOMING").length;

    const totalOverdueReceivables = reminders
      .filter((r) => r.type === "RECEIVABLE" && (r.urgency === "OVERDUE" || r.urgency === "DUE_TODAY"))
      .reduce((sum, r) => sum + r.remainingAmount, 0);

    const totalOverduePayables = reminders
      .filter((r) => r.type === "PAYABLE" && (r.urgency === "OVERDUE" || r.urgency === "DUE_TODAY"))
      .reduce((sum, r) => sum + r.remainingAmount, 0);

    return NextResponse.json({
      success: true,
      data: {
        overdueCount,
        dueTodayCount,
        upcomingCount,
        totalOverdueReceivables: round2(totalOverdueReceivables),
        totalOverduePayables: round2(totalOverduePayables),
        reminders,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
