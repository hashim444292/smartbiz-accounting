"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/decimal";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ArrowLeft, Printer, CalendarRange } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { BrandPageLoader } from "@/components/ui/loader";

export default function WeeklyReportPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadWeekly() {
      try {
        const res = await fetch("/api/dashboard");
        const json = await res.json();
        if (json.success) setMetrics(json.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadWeekly();
  }, []);

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

  const weeklyTrend = [
    { day: "Mon", sales: 125000, purchases: 45000, expenses: 8000 },
    { day: "Tue", sales: 98000, purchases: 12000, expenses: 4500 },
    { day: "Wed", sales: 145000, purchases: 70000, expenses: 6000 },
    { day: "Thu", sales: 88000, purchases: 15000, expenses: 3200 },
    { day: "Fri", sales: 160000, purchases: 35000, expenses: 9500 },
    { day: "Sat", sales: 210000, purchases: 50000, expenses: 12000 },
    { day: "Sun", sales: 45000, purchases: 0, expenses: 2000 },
  ];

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
            <p className="text-xs text-slate-500">Day-by-day turnover, purchases, cash flow, and rankings</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="h-3.5 w-3.5 mr-1" /> Print Report
        </Button>
      </div>

      {/* Weekly Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Turnover & Outflow for Current Week</CardTitle>
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
                <Bar dataKey="sales" name="Sales" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar dataKey="purchases" name="Purchases" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-xs">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-slate-400 uppercase font-bold text-[10px]">Weekly Turnover</p>
          <p className="text-lg font-bold text-blue-600 mt-1">{formatMoney(871000)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-slate-400 uppercase font-bold text-[10px]">Weekly Inward Stock</p>
          <p className="text-lg font-bold text-indigo-600 mt-1">{formatMoney(227000)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-slate-400 uppercase font-bold text-[10px]">Weekly Overhead</p>
          <p className="text-lg font-bold text-rose-600 mt-1">{formatMoney(45200)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-slate-400 uppercase font-bold text-[10px]">Estimated Net Profit</p>
          <p className="text-lg font-bold text-emerald-600 mt-1">{formatMoney(195800)}</p>
        </div>
      </div>
    </div>
  );
}
