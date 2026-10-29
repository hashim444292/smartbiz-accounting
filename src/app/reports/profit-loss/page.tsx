"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/decimal";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ArrowLeft, Printer, TrendingUp } from "lucide-react";
import { BrandPageLoader } from "@/components/ui/loader";
import { useAuth } from "@/context/AuthContext";
import { ReportPrintHeader } from "@/components/reports/ReportPrintHeader";
import { ReportPrintFooter } from "@/components/reports/ReportPrintFooter";

export default function ProfitLossPage() {
  const { activeCompany, user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPL() {
      try {
        const res = await fetch("/api/dashboard");
        const json = await res.json();
        if (json.success) setData(json.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchPL();
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <BrandPageLoader
          message="Generating Profit & Loss Statement..."
          submessage="Aggregating sales revenue, Cost of Goods Sold (COGS), and operating expenses..."
        />
      </div>
    );
  }

  const salesRevenue = Number(data?.totalGrossSales ?? data?.totalSales ?? 0);
  const cogs = Number(data?.totalCogs ?? (data?.totalPurchases ?? 0));
  const grossProfit = Number(data?.grossProfit ?? (salesRevenue - cogs));
  const expenses = Number(data?.totalExpenses ?? 0);
  const netProfit = Number(data?.netProfit ?? (grossProfit - expenses));
  const expenseCategories: any[] = data?.expenseCategories || [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/reports"
            className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 dark:border-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Profit & Loss Statement</h2>
            <p className="text-xs text-slate-500">Income, Cost of Goods Sold, and Net Operating Income</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="h-3.5 w-3.5 mr-1" /> Print Statement
        </Button>
      </div>

      <div className="print-report-sheet rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 lg:p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 print:border print:border-slate-300 print:p-2 print:shadow-none print:break-inside-avoid">
        {/* Printable Official Header */}
        <ReportPrintHeader
          title="Statement of Profit & Loss (P&L)"
          subtitle="Statement of Comprehensive Operational Income, Cost of Goods Sold & Margins"
          reportDate={`Current Fiscal Period (As of ${new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric", day: "numeric" })})`}
          company={activeCompany}
          userName={user?.name}
          badgeText="Income Statement"
        />

        <div className="py-4 print:py-1 space-y-6 print:space-y-2 text-xs print:text-[9.5px]">
          {/* Revenue */}
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white uppercase text-[11px] print:text-[10px] mb-2 print:mb-1 tracking-wider">
              1. Operating Revenue (آمدنی)
            </h3>
            <div className="space-y-2 print:space-y-1 border-b border-slate-100 pb-3 print:pb-1.5 dark:border-slate-800 print:border-slate-300">
              <div className="flex justify-between">
                <span>Gross Merchandise Sales</span>
                <span className="font-semibold tabular-nums">{formatMoney(salesRevenue)}</span>
              </div>
              <div className="flex justify-between text-slate-400 print:text-slate-500">
                <span>Less: Sales Returns & Discounts</span>
                <span className="tabular-nums">Rs 0.00</span>
              </div>
              <div className="flex justify-between font-bold pt-1 print:pt-0.5 text-slate-800 dark:text-slate-200">
                <span>Net Sales Revenue</span>
                <span className="tabular-nums">{formatMoney(salesRevenue)}</span>
              </div>
            </div>
          </div>

          {/* COGS */}
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white uppercase text-[11px] print:text-[10px] mb-2 print:mb-1 tracking-wider">
              2. Cost of Goods Sold (COGS - اشیاء لاگت)
            </h3>
            <div className="space-y-2 print:space-y-1 border-b border-slate-100 pb-3 print:pb-1.5 dark:border-slate-800 print:border-slate-300">
              <div className="flex justify-between">
                <span>Cost of Inventory Sold (Weighted Average Cost)</span>
                <span className="font-semibold tabular-nums">-{formatMoney(cogs)}</span>
              </div>
              <div className="flex justify-between font-bold pt-2 print:pt-1 text-sm print:text-xs text-blue-600 dark:text-blue-400">
                <span>GROSS PROFIT (Margin: {salesRevenue > 0 ? ((grossProfit / salesRevenue) * 100).toFixed(1) : "0.0"}%)</span>
                <span className="tabular-nums">{formatMoney(grossProfit)}</span>
              </div>
            </div>
          </div>

          {/* Operating Expenses */}
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white uppercase text-[11px] print:text-[10px] mb-2 print:mb-1 tracking-wider">
              3. Operating Expenses (کاروباری اخراجات)
            </h3>
            <div className="space-y-2 print:space-y-1 border-b border-slate-100 pb-3 print:pb-1.5 dark:border-slate-800 print:border-slate-300">
              {expenseCategories.length > 0 ? (
                expenseCategories.map((cat: any) => (
                  <div key={cat.name} className="flex justify-between items-center text-slate-700 dark:text-slate-300 py-0.5">
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {cat.name}
                      {cat.count > 1 && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal ml-1.5">
                          ({cat.count} expenses)
                        </span>
                      )}
                    </span>
                    <span className="tabular-nums font-semibold">{formatMoney(cat.amount)}</span>
                  </div>
                ))
              ) : (
                <div className="flex justify-between">
                  <span>General Operating & Administrative Expenses</span>
                  <span className="tabular-nums">{formatMoney(expenses)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold pt-2 print:pt-1 text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-800 print:border-slate-300 mt-1">
                <span>Total Operating Expenses</span>
                <span className="tabular-nums text-rose-600 font-bold">-{formatMoney(expenses)}</span>
              </div>
            </div>
          </div>

          {/* Net Profit */}
          <div className="rounded-xl bg-slate-50 p-4 print:p-2 dark:bg-slate-800/60 flex justify-between items-center text-sm print:text-xs font-black print:bg-transparent print:border-t-2 print:border-b-2 print:border-slate-900 print:rounded-none">
            <span className="text-slate-900 dark:text-white">NET OPERATING PROFIT / (LOSS)</span>
            <span className={`text-base print:text-sm tabular-nums ${netProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{formatMoney(netProfit)}</span>
          </div>

          {/* Printable Official Signatures & System Footer */}
          <ReportPrintFooter notes="Income statement prepared in accordance with standard Pakistan accounting standards." />
        </div>
      </div>
    </div>
  );
}
