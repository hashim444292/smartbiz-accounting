import { NextRequest, NextResponse } from "next/server";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { getDailyReport } from "@/services/reportService";
import { fallbackStore } from "@/lib/fallbackStore";
import { round2 } from "@/lib/decimal";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const businessId = await getActiveBusinessId(req);
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");
    const targetDate = dateParam ? new Date(dateParam) : new Date();

    const report = await getDailyReport(businessId, targetDate);
    return NextResponse.json({ success: true, data: report });
  } catch (error: any) {
    const businessId = await getActiveBusinessId(req);
    const sales = fallbackStore.sales.filter((s) => s.businessId === businessId);
    const purchases = fallbackStore.purchases.filter((p) => p.businessId === businessId);
    const receipts = fallbackStore.payments.filter((p) => p.businessId === businessId && p.type === "RECEIPT");
    const disbursements = fallbackStore.payments.filter((p) => p.businessId === businessId && p.type === "DISBURSEMENT");
    const expenses = fallbackStore.expenses.filter((e) => e.businessId === businessId);

    const totalSales = sales.reduce((a, s) => a + s.totalAmount, 0);
    const cashSales = sales.filter((s) => s.paymentStatus === "PAID").reduce((a, s) => a + s.totalAmount, 0);
    const creditSales = totalSales - cashSales;
    const paidSales = sales.reduce((a, s) => a + s.paidAmount, 0);
    const receivableSales = sales.reduce((a, s) => a + s.remainingAmount, 0);

    const totalPurchases = purchases.reduce((a, p) => a + p.totalAmount, 0);
    const cashPurchases = purchases.filter((p) => p.paymentStatus === "PAID").reduce((a, p) => a + p.totalAmount, 0);
    const creditPurchases = totalPurchases - cashPurchases;
    const paidPurchases = purchases.reduce((a, p) => a + p.paidAmount, 0);
    const payablePurchases = purchases.reduce((a, p) => a + p.remainingAmount, 0);

    const totalMoneyReceived = receipts.reduce((a, r) => a + r.amount, 0);
    const totalMoneyPaid = disbursements.reduce((a, d) => a + d.amount, 0);
    const totalExpenses = expenses.reduce((a, e) => a + e.amount, 0);
    const netCashMovement = totalMoneyReceived - (totalMoneyPaid + totalExpenses);
    const grossProfit = totalSales * 0.35;
    const netProfit = grossProfit - totalExpenses;

    const fallbackReport = {
      date: new Date().toISOString(),
      sales: {
        count: sales.length,
        total: totalSales,
        cash: cashSales,
        credit: creditSales,
        paid: paidSales,
        receivable: receivableSales,
        items: sales,
      },
      purchases: {
        count: purchases.length,
        total: totalPurchases,
        cash: cashPurchases,
        credit: creditPurchases,
        paid: paidPurchases,
        payable: payablePurchases,
        items: purchases,
      },
      receipts: {
        total: totalMoneyReceived,
        items: receipts,
      },
      disbursements: {
        total: totalMoneyPaid,
        items: disbursements,
      },
      expenses: {
        total: totalExpenses,
        items: expenses,
      },
      stockMovements: fallbackStore.inventoryTransactions,
      financialSummary: {
        totalMoneyReceived,
        totalMoneyPaid,
        totalExpenses,
        netCashMovement,
        salesRevenue: totalSales,
        totalPurchases,
        grossProfit,
        netProfit,
      },
    };

    return NextResponse.json({ success: true, data: fallbackReport, fallback: true });
  }
}
