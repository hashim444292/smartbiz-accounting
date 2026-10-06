"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/decimal";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ArrowLeft, Printer, CalendarRange, TrendingUp, ShoppingBag, Receipt } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { BrandPageLoader } from "@/components/ui/loader";
import { useAuth } from "@/context/AuthContext";

export default function WeeklyReportPage() {
  const { activeCompany } = useAuth();
  const [weeklyTrend, setWeeklyTrend] = useState<any[]>([]);
  const [weeklySales, setWeeklySales] = useState<number>(0);
  const [weeklyPurchases, setWeeklyPurchases] = useState<number>(0);
  const [weeklyExpenses, setWeeklyExpenses] = useState<number>(0);
  const [invoiceCount, setInvoiceCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadWeeklyData() {
      setLoading(true);
      try {
        const headers: Record<string, string> = {};
        if (activeCompany?.id) headers["x-business-id"] = activeCompany.id;

        const [salesRes, purchasesRes, expensesRes] = await Promise.all([
          fetch("/api/sales", { headers }).then((r) => r.json()).catch(() => ({ data: [] })),
          fetch("/api/purchases", { headers }).then((r) => r.json()).catch(() => ({ data: [] })),
          fetch("/api/expenses", { headers }).then((r) => r.json()).catch(() => ({ data: [] })),
        ]);

        const salesList = Array.isArray(salesRes?.data) ? salesRes.data : [];
        const purchasesList = Array.isArray(purchasesRes?.data) ? purchasesRes.data : [];
        const expensesList = Array.isArray(expensesRes?.data) ? expensesRes.data : [];

        // Build 7-day slots (last 7 days from today)
        const daysMap: Record<string, { day: string; dateStr: string; sales: number; purchases: number; expenses: number }> = {};
        const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const today = new Date();

        for (let i = 6; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          const dateStr = d.toISOString().slice(0, 10);
          const dayLabel = `${dayNames[d.getDay()]} (${d.getDate()}/${d.getMonth() + 1})`;
          daysMap[dateStr] = { day: dayLabel, dateStr, sales: 0, purchases: 0, expenses: 0 };
        }

        let totSales = 0;
        let totPurchases = 0;
        let totExpenses = 0;
        let invCount = 0;

        salesList.forEach((s: any) => {
          const sDate = (s.date ? new Date(s.date) : new Date()).toISOString().slice(0, 10);
          if (daysMap[sDate]) {
            const amt = Number(s.totalAmount || 0);
            daysMap[sDate].sales += amt;
            totSales += amt;
            invCount++;
          }
        });

        purchasesList.forEach((p: any) => {
          const pDate = (p.date ? new Date(p.date) : new Date()).toISOString().slice(0, 10);
          if (daysMap[pDate]) {
            const amt = Number(p.totalAmount || 0);
            daysMap[pDate].purchases += amt;
            totPurchases += amt;
          }
        });

        expensesList.forEach((e: any) => {
          const eDate = (e.date ? new Date(e.date) : new Date()).toISOString().slice(0, 10);
          if (daysMap[eDate]) {
            const amt = Number(e.amount || 0);
            daysMap[eDate].expenses += amt;
            totExpenses += amt;
          }
        });

        setWeeklyTrend(Object.values(daysMap));
        setWeeklySales(totSales);
        setWeeklyPurchases(totPurchases);
        setWeeklyExpenses(totExpenses);
        setInvoiceCount(invCount);
      } catch (err) {
        console.error("Failed to load weekly trends:", err);
      } finally {
        setLoading(false);
      }
    }
    loadWeeklyData();
  }, [activeCompany?.id]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <BrandPageLoader
          message="Loading Weekly Performance Summary..."
          submessage="Aggregating 7-day revenue trends, day-by-day sales velocity, and inventory movement..."
        />
      </div>
    );
  }

  const estimatedProfit = Math.max(0, weeklySales - weeklyPurchases - weeklyExpenses);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/reports"
            className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 dark:border-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Weekly Business Summary</h2>
            <p className="text-xs text-slate-500">Day-by-day 7-day turnover, purchases, cash flow, and rankings</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5 mr-1" /> Print Report
          </Button>
        </div>
      </div>

      {/* Printable Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 print:border-none print:p-0">
        <div className="flex justify-between items-center border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Weekly Sales & Turnover Performance</h1>
            <p className="text-xs text-slate-500">{activeCompany?.name || "SmartBiz Enterprise"} • 7-Day Performance Audit</p>
          </div>
          <div className="text-right">
            <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
              LAST 7 DAYS
            </span>
          </div>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-xs pt-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-slate-400 uppercase font-bold text-[10px]">Weekly Turnover (Sales)</p>
            <p className="text-lg font-bold text-blue-600 mt-1">{formatMoney(weeklySales)}</p>
            <span className="text-[10px] text-slate-500 block mt-0.5">{invoiceCount} invoices issued</span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-slate-400 uppercase font-bold text-[10px]">Weekly Purchases</p>
            <p className="text-lg font-bold text-indigo-600 mt-1">{formatMoney(weeklyPurchases)}</p>
            <span className="text-[10px] text-slate-500 block mt-0.5">Inventory restocking</span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-slate-400 uppercase font-bold text-[10px]">Weekly Overhead (Expenses)</p>
            <p className="text-lg font-bold text-rose-600 mt-1">{formatMoney(weeklyExpenses)}</p>
            <span className="text-[10px] text-slate-500 block mt-0.5">Operating utilities</span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-slate-400 uppercase font-bold text-[10px]">Net Surplus / Margins</p>
            <p className="text-lg font-bold text-emerald-600 mt-1">{formatMoney(estimatedProfit)}</p>
            <span className="text-[10px] text-emerald-600 block mt-0.5">Turnover net margin</span>
          </div>
        </div>
      </div>

      {/* Weekly Chart */}
      <Card className="print:break-inside-avoid">
        <CardHeader>
          <CardTitle>Daily Turnover & Outflow for Past 7 Days</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyTrend} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  formatter={(val: any) => [formatMoney(val), "Amount"]}
                  contentStyle={{ backgroundColor: "#0f172a", border: "none", borderRadius: "8px", color: "#fff", fontSize: "12px" }}
                />
                <Bar dataKey="sales" name="Sales Revenue" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar dataKey="purchases" name="Stock Inflow" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Overheads" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
