"use client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/decimal";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, RefreshCw, Calendar, TrendingUp, TrendingDown, DollarSign, Package } from "lucide-react";
import { BrandPageLoader } from "@/components/ui/loader";
import { useAuth } from "@/context/AuthContext";
import { ReportPrintHeader } from "@/components/reports/ReportPrintHeader";
import { ReportPrintFooter } from "@/components/reports/ReportPrintFooter";

type DatePreset = "TODAY" | "THIS_WEEK" | "THIS_MONTH" | "LAST_MONTH" | "LAST_30_DAYS" | "YTD" | "ALL_TIME" | "CUSTOM";

export default function ProfitLossPage() {
  const { activeCompany, user } = useAuth();

  const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const getMonthStartStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  };

  const [preset, setPreset] = useState<DatePreset>("THIS_MONTH");
  const [startDate, setStartDate] = useState(getMonthStartStr());
  const [endDate, setEndDate] = useState(getTodayStr());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const applyPreset = (p: DatePreset) => {
    setPreset(p);
    const d = new Date();
    const todayStr = getTodayStr();

    if (p === "TODAY") {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (p === "THIS_WEEK") {
      const dayOfWeek = d.getDay();
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(d);
      monday.setDate(d.getDate() - diffToMonday);
      const monStr = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
      setStartDate(monStr);
      setEndDate(todayStr);
    } else if (p === "THIS_MONTH") {
      setStartDate(getMonthStartStr());
      setEndDate(todayStr);
    } else if (p === "LAST_MONTH") {
      const firstOfLastMonth = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      const lastOfLastMonth = new Date(d.getFullYear(), d.getMonth(), 0);
      const startStr = `${firstOfLastMonth.getFullYear()}-${String(firstOfLastMonth.getMonth() + 1).padStart(2, "0")}-01`;
      const endStr = `${lastOfLastMonth.getFullYear()}-${String(lastOfLastMonth.getMonth() + 1).padStart(2, "0")}-${String(lastOfLastMonth.getDate()).padStart(2, "0")}`;
      setStartDate(startStr);
      setEndDate(endStr);
    } else if (p === "LAST_30_DAYS") {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(d.getDate() - 30);
      const startStr = `${thirtyDaysAgo.getFullYear()}-${String(thirtyDaysAgo.getMonth() + 1).padStart(2, "0")}-${String(thirtyDaysAgo.getDate()).padStart(2, "0")}`;
      setStartDate(startStr);
      setEndDate(todayStr);
    } else if (p === "YTD") {
      setStartDate(`${d.getFullYear()}-01-01`);
      setEndDate(todayStr);
    } else if (p === "ALL_TIME") {
      setStartDate("2020-01-01");
      setEndDate(todayStr);
    }
  };

  const fetchPL = useCallback(async (start = startDate, end = endDate) => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/reports/profit-loss?startDate=${start}&endDate=${end}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        const fallbackRes = await fetch("/api/dashboard");
        const fallbackJson = await fallbackRes.json();
        if (fallbackJson.success) setData(fallbackJson.data);
      }
    } catch (err) {
      console.error("Failed to load Profit & Loss report:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchPL(startDate, endDate);
  }, [startDate, endDate, fetchPL]);

  const handleCustomDateChange = (type: "start" | "end", val: string) => {
    setPreset("CUSTOM");
    if (type === "start") setStartDate(val);
    if (type === "end") setEndDate(val);
  };

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

  const grossSales = Number(data?.grossSales ?? data?.totalGrossSales ?? data?.totalSales ?? 0);
  const salesReturns = Number(data?.salesReturns ?? 0);
  const netSales = Number(data?.netSales ?? (grossSales - salesReturns));
  const cogs = Number(data?.cogs ?? data?.totalCogs ?? 0);
  const inventoryLoss = Number(data?.inventoryLoss ?? 0);
  const totalCostOfSales = Number(data?.totalCostOfSales ?? (cogs + inventoryLoss));
  const grossProfit = Number(data?.grossProfit ?? (netSales - totalCostOfSales));
  const grossMarginPercent = Number(data?.grossMarginPercent ?? (netSales > 0 ? (grossProfit / netSales) * 100 : 0));
  const expenses = Number(data?.expenses ?? data?.totalExpenses ?? 0);
  const netProfit = Number(data?.netProfit ?? (grossProfit - expenses));
  const netMarginPercent = Number(data?.netMarginPercent ?? (netSales > 0 ? (netProfit / netSales) * 100 : 0));
  const expenseCategories: any[] = data?.expenseCategories || [];
  const periodLabel = data?.periodLabel || `${startDate} to ${endDate}`;
  const salesCount = data?.salesCount ?? 0;
  const unitsSold = data?.unitsSold ?? 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Top Controls & Navigation (Hidden on Print) */}
      <div className="space-y-4 print:hidden">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/reports"
              className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 dark:border-slate-800"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Profit & Loss Statement</h2>
              <p className="text-xs text-slate-500">Income, Cost of Goods Sold, and Net Operating Income (نفع و نقصان گوشوارہ)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchPL(startDate, endDate)}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 text-xs font-semibold"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-indigo-600" : ""}`} />
              <span>{isRefreshing ? "Calculating..." : "Refresh"}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()} className="font-semibold">
              <Printer className="h-3.5 w-3.5 mr-1" /> Print Statement
            </Button>
          </div>
        </div>

        {/* Date Filter & Preset Controls */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
          {/* Preset Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <span className="text-slate-400 font-semibold mr-1 shrink-0 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> Range:
            </span>
            {[
              { id: "TODAY", label: "Today (آج)" },
              { id: "THIS_WEEK", label: "This Week (اس ہفتے)" },
              { id: "THIS_MONTH", label: "This Month (اس ماہ)" },
              { id: "LAST_MONTH", label: "Last Month (گزشتہ ماہ)" },
              { id: "LAST_30_DAYS", label: "Last 30 Days" },
              { id: "YTD", label: "Year to Date (YTD)" },
              { id: "ALL_TIME", label: "All Time (اب تک)" },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id as DatePreset)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${
                  preset === p.id
                    ? "bg-indigo-600 text-white shadow-2xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center flex-wrap gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <label className="text-slate-500 font-medium">From (شروع):</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => handleCustomDateChange("start", e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-slate-500 font-medium">To (اختتام):</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => handleCustomDateChange("end", e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => fetchPL(startDate, endDate)}
                className="h-7 text-xs px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
              >
                Apply Range
              </Button>
            </div>

            <div className="text-xs text-slate-500 font-medium">
              Active Period: <span className="font-bold text-slate-800 dark:text-slate-200">{periodLabel}</span>
            </div>
          </div>
        </div>

        {/* Executive KPI Summary Cards (Screen View) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Net Sales Revenue</span>
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-lg font-black text-slate-900 dark:text-white mt-1 tabular-nums">
              {formatMoney(netSales)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {salesCount} sale{salesCount === 1 ? "" : "s"} • {unitsSold} units sold
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Cost of Sales (COGS)</span>
              <Package className="h-4 w-4 text-blue-600" />
            </div>
            <div className="text-lg font-black text-slate-900 dark:text-white mt-1 tabular-nums">
              {formatMoney(totalCostOfSales)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              COGS: {formatMoney(cogs)} {inventoryLoss > 0 && `• Loss: ${formatMoney(inventoryLoss)}`}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Operating Expenses</span>
              <TrendingDown className="h-4 w-4 text-rose-500" />
            </div>
            <div className="text-lg font-black text-slate-900 dark:text-white mt-1 tabular-nums text-rose-600">
              {formatMoney(expenses)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {expenseCategories.length} categories recorded
            </div>
          </div>

          <div className={`rounded-xl border p-3 shadow-2xs ${
            netProfit >= 0
              ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/60 dark:bg-emerald-950/20"
              : "border-rose-200 bg-rose-50/50 dark:border-rose-900/60 dark:bg-rose-950/20"
          }`}>
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className={netProfit >= 0 ? "text-emerald-800 dark:text-emerald-300" : "text-rose-800 dark:text-rose-300"}>
                Net Profit / (Loss)
              </span>
              <TrendingUp className={`h-4 w-4 ${netProfit >= 0 ? "text-emerald-600" : "text-rose-600 rotate-180"}`} />
            </div>
            <div className={`text-lg font-black mt-1 tabular-nums ${netProfit >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>
              {formatMoney(netProfit)}
            </div>
            <div className="text-[10px] font-bold mt-0.5 opacity-80">
              Margin: {netMarginPercent.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* STATUTORY PROFIT & LOSS STATEMENT SHEET (Printable Document) */}
      {/* ========================================================================= */}
      <div className="print-report-sheet rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 lg:p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 print:border print:border-slate-300 print:p-2 print:shadow-none print:break-inside-avoid">
        {/* Printable Official Header */}
        <ReportPrintHeader
          title="Statement of Profit & Loss (P&L)"
          subtitle="Statement of Comprehensive Operational Income, Cost of Goods Sold & Margins"
          reportDate={`Reporting Period: ${periodLabel}`}
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
                <span className="font-semibold tabular-nums">{formatMoney(grossSales)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Less: Sales Returns & Allowances (واپسی مال)</span>
                <span className="tabular-nums">-{formatMoney(salesReturns)}</span>
              </div>
              <div className="flex justify-between font-bold pt-1 print:pt-0.5 text-slate-900 dark:text-slate-100 border-t border-slate-100 dark:border-slate-800">
                <span>Net Sales Revenue (خالص فروخت)</span>
                <span className="tabular-nums text-emerald-600 dark:text-emerald-400 font-black">{formatMoney(netSales)}</span>
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
              {inventoryLoss > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Inventory Shrinkage, Loss & Damage (نقصان / چوری / خرابی)</span>
                  <span className="font-semibold tabular-nums">-{formatMoney(inventoryLoss)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600 font-semibold pt-1 border-t border-slate-100 dark:border-slate-800">
                <span>Total Cost of Sales</span>
                <span className="tabular-nums text-slate-800 dark:text-slate-200">-{formatMoney(totalCostOfSales)}</span>
              </div>
              <div className="flex justify-between font-bold pt-2 print:pt-1 text-sm print:text-xs text-blue-600 dark:text-blue-400">
                <span>GROSS PROFIT (Margin: {grossMarginPercent.toFixed(1)}%)</span>
                <span className="tabular-nums font-black">{formatMoney(grossProfit)}</span>
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
                <div className="flex justify-between text-slate-500">
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
            <div className="space-y-0.5">
              <span className="text-slate-900 dark:text-white block">NET OPERATING PROFIT / (LOSS)</span>
              <span className="text-[11px] font-normal text-slate-500 block">
                Period: {periodLabel} (Net Margin: {netMarginPercent.toFixed(1)}%)
              </span>
            </div>
            <span className={`text-base sm:text-lg print:text-sm tabular-nums font-black ${netProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {formatMoney(netProfit)}
            </span>
          </div>

          {/* Printable Official Signatures & System Footer */}
          <ReportPrintFooter notes="Income statement prepared in accordance with standard Pakistan accounting standards." />
        </div>
      </div>
    </div>
  );
}
