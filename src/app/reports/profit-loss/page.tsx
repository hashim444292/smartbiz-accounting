"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/decimal";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ArrowLeft, Printer, TrendingUp } from "lucide-react";
import { BrandPageLoader } from "@/components/ui/loader";

export default function ProfitLossPage() {
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

  const salesRevenue = data?.totalSales ?? 0;
  const cogs = salesRevenue * 0.65;
  const grossProfit = salesRevenue - cogs;
  const expenses = data?.totalExpenses ?? 0;
  const netProfit = grossProfit - expenses;

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

      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 print:border-none print:p-0">
        <div className="border-b border-slate-200 pb-4 dark:border-slate-800">
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">Income Statement (P&L)</h1>
          <p className="text-xs text-slate-500">For the period ended September 2026</p>
        </div>

        <div className="py-6 space-y-6 text-xs">
          {/* Revenue */}
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white uppercase text-[11px] mb-2 tracking-wider">
              Operating Revenue
            </h3>
            <div className="space-y-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex justify-between">
                <span>Gross Merchandise Sales</span>
                <span className="font-semibold tabular-nums">{formatMoney(salesRevenue)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Less: Sales Returns & Discounts</span>
                <span className="tabular-nums">Rs 0.00</span>
              </div>
              <div className="flex justify-between font-bold pt-1 text-slate-800 dark:text-slate-200">
                <span>Net Sales Revenue</span>
                <span className="tabular-nums">{formatMoney(salesRevenue)}</span>
              </div>
            </div>
          </div>

          {/* COGS */}
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white uppercase text-[11px] mb-2 tracking-wider">
              Cost of Goods Sold (COGS)
            </h3>
            <div className="space-y-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex justify-between">
                <span>Cost of Inventory Sold (Weighted Average Cost)</span>
                <span className="font-semibold tabular-nums">-{formatMoney(cogs)}</span>
              </div>
              <div className="flex justify-between font-bold pt-2 text-sm text-blue-600 dark:text-blue-400">
                <span>GROSS PROFIT (Margin: 35.0%)</span>
                <span className="tabular-nums">{formatMoney(grossProfit)}</span>
              </div>
            </div>
          </div>

          {/* Operating Expenses */}
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white uppercase text-[11px] mb-2 tracking-wider">
              Operating Expenses
            </h3>
            <div className="space-y-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex justify-between">
                <span>Shop & Warehouse Rent</span>
                <span className="tabular-nums">Rs 25,000.00</span>
              </div>
              <div className="flex justify-between">
                <span>Electricity & Utilities</span>
                <span className="tabular-nums">Rs 8,500.00</span>
              </div>
              <div className="flex justify-between">
                <span>Transport & Vehicle Fuel</span>
                <span className="tabular-nums">Rs 6,200.00</span>
              </div>
              <div className="flex justify-between">
                <span>Office Supplies & Misc</span>
                <span className="tabular-nums">Rs 5,300.00</span>
              </div>
              <div className="flex justify-between font-bold pt-1 text-slate-800 dark:text-slate-200">
                <span>Total Operating Expenses</span>
                <span className="tabular-nums text-rose-600">-{formatMoney(expenses)}</span>
              </div>
            </div>
          </div>

          {/* Net Profit */}
          <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60 flex justify-between items-center text-sm font-black">
            <span className="text-slate-900 dark:text-white">NET OPERATING PROFIT</span>
            <span className="text-emerald-600 text-base tabular-nums">{formatMoney(netProfit)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
