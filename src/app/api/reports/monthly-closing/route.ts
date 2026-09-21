import { NextRequest, NextResponse } from "next/server";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { getMonthlyClosingReport, closeAccountingPeriod, reopenAccountingPeriod } from "@/services/reportService";
import { fallbackStore } from "@/lib/fallbackStore";
import { round2 } from "@/lib/decimal";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const businessId = await getActiveBusinessId();
    const { searchParams } = new URL(req.url);
    const now = new Date();
    const year = parseInt(searchParams.get("year") || String(now.getFullYear()));
    const month = parseInt(searchParams.get("month") || String(now.getMonth() + 1));

    const report = await getMonthlyClosingReport(businessId, year, month);
    return NextResponse.json({ success: true, data: report });
  } catch (error: any) {
    const now = new Date();
    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get("year") || String(now.getFullYear()));
    const month = parseInt(searchParams.get("month") || String(now.getMonth() + 1));

    const period = fallbackStore.accountingPeriods.find((p) => p.year === year && p.month === month);
    const totalSales = fallbackStore.sales.reduce((a, s) => a + s.totalAmount, 0);
    const totalPurchases = fallbackStore.purchases.reduce((a, p) => a + p.totalAmount, 0);
    const totalExpenses = fallbackStore.expenses.reduce((a, e) => a + e.amount, 0);
    const cogs = totalSales * 0.65;
    const grossProfit = totalSales - cogs;
    const netProfit = grossProfit - totalExpenses;

    const totalReceivables = fallbackStore.customers.reduce((a, c) => a + c.currentBalance, 0);
    const totalPayables = fallbackStore.suppliers.reduce((a, s) => a + s.currentBalance, 0);

    const cash = fallbackStore.cashBankAccounts.find((a) => a.type === "CASH")?.balance || 50000;
    const bank = fallbackStore.cashBankAccounts.find((a) => a.type === "BANK")?.balance || 250000;

    const fallbackReport = {
      year,
      month,
      periodName: period?.name || `${new Date(year, month - 1).toLocaleString("default", { month: "long" })} ${year}`,
      isClosed: period?.isClosed || false,
      closedAt: period?.closedAt,
      sales: {
        total: totalSales,
        invoiceCount: fallbackStore.sales.length,
        cash: fallbackStore.sales.filter((s) => s.paymentStatus === "PAID").reduce((a, s) => a + s.totalAmount, 0),
        credit: fallbackStore.sales.filter((s) => s.paymentStatus !== "PAID").reduce((a, s) => a + s.totalAmount, 0),
        discounts: 0,
        taxes: 0,
        cogs,
        grossProfit,
        byProduct: fallbackStore.products.map((p) => ({ name: p.name, quantity: 5, total: p.sellingPrice * 5 })),
        byCustomer: fallbackStore.customers.map((c) => ({ name: c.name, count: 1, total: 25000 })),
      },
      purchases: {
        total: totalPurchases,
        invoiceCount: fallbackStore.purchases.length,
        cash: totalPurchases,
        credit: 0,
      },
      receivables: {
        total: totalReceivables,
        count: fallbackStore.customers.length,
      },
      payables: {
        total: totalPayables,
        count: fallbackStore.suppliers.length,
      },
      cashFlow: {
        cashReceived: 10000,
        bankReceived: 0,
        cashPaid: 3000,
        bankPaid: 27000,
        netCash: 7000,
        netBank: -27000,
        closingCash: cash,
        closingBank: bank,
      },
      expenses: {
        total: totalExpenses,
        categories: fallbackStore.expenseCategories.map((c) => ({
          category: c.name,
          total: c.name === "Electricity" ? 3000 : 0,
          count: c.name === "Electricity" ? 1 : 0,
        })),
      },
      inventory: {
        totalValue: fallbackStore.products.reduce((a, p) => a + p.currentStock * p.averageCost, 0),
        productCount: fallbackStore.products.length,
        lowStockItems: fallbackStore.products.filter((p) => p.currentStock <= p.minStockLevel),
      },
      profitAndLoss: {
        netSales: totalSales,
        cogs,
        grossProfit,
        grossMargin: totalSales > 0 ? (grossProfit / totalSales) * 100 : 0,
        expenses: totalExpenses,
        netProfit,
      },
      warnings: [],
    };

    return NextResponse.json({ success: true, data: fallbackReport, fallback: true });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, year, month, notes, reason, userId = "admin" } = body;

  try {
    const businessId = await getActiveBusinessId();

    if (action === "CLOSE") {
      const period = await closeAccountingPeriod(businessId, year, month, userId, notes);
      return NextResponse.json({ success: true, data: period });
    } else if (action === "REOPEN") {
      const period = await reopenAccountingPeriod(businessId, year, month, userId, reason || "Reopened by owner");
      return NextResponse.json({ success: true, data: period });
    } else {
      return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
    }
  } catch (error: any) {
    if (error.message?.includes("Can't reach database server") || error.code === "P1001" || !process.env.DATABASE_URL) {
      let period = fallbackStore.accountingPeriods.find((p) => p.year === year && p.month === month);
      if (!period) {
        period = {
          id: `ap-${year}-${String(month).padStart(2, "0")}`,
          year,
          month,
          name: `${new Date(year, month - 1).toLocaleString("default", { month: "long" })} ${year}`,
          isClosed: action === "CLOSE",
          closedAt: action === "CLOSE" ? new Date().toISOString() : null,
        };
        fallbackStore.accountingPeriods.push(period);
      } else {
        period.isClosed = action === "CLOSE";
        period.closedAt = action === "CLOSE" ? new Date().toISOString() : null;
      }
      return NextResponse.json({ success: true, data: period, fallback: true });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
