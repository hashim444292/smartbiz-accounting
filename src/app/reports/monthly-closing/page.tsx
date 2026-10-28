"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/decimal";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Lock,
  Unlock,
  AlertTriangle,
  Printer,
  ArrowLeft,
  CheckCircle2,
  TrendingUp,
  Scale,
  Wallet,
  Package,
} from "lucide-react";
import { BrandPageLoader } from "@/components/ui/loader";
import { useAuth } from "@/context/AuthContext";
import { ReportPrintHeader } from "@/components/reports/ReportPrintHeader";
import { ReportPrintFooter } from "@/components/reports/ReportPrintFooter";

export default function MonthlyClosingPage() {
  const { activeCompany, user } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [report, setReport] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [locking, setLocking] = useState(false);

  const fetchClosing = async (y: number, m: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/monthly-closing?year=${y}&month=${m}`);
      const json = await res.json();
      if (json.success) setReport(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClosing(year, month);
  }, [year, month]);

  const handleClosePeriod = async () => {
    if (!confirm(`Are you sure you want to CLOSE and LOCK ${report?.periodName}? Transactions in this period will become read-only.`)) {
      return;
    }
    setLocking(true);
    try {
      const res = await fetch("/api/reports/monthly-closing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CLOSE",
          year,
          month,
          notes: "Monthly closing finalized by business owner.",
        }),
      });
      const json = await res.json();
      if (json.success) {
        alert("Accounting period closed successfully.");
        fetchClosing(year, month);
      } else {
        alert(json.error);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLocking(false);
    }
  };

  const handleReopenPeriod = async () => {
    const reason = prompt("Enter justification to REOPEN this closed accounting period:");
    if (!reason) return;
    setLocking(true);
    try {
      const res = await fetch("/api/reports/monthly-closing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REOPEN",
          year,
          month,
          reason,
        }),
      });
      const json = await res.json();
      if (json.success) {
        alert("Accounting period reopened.");
        fetchClosing(year, month);
      } else {
        alert(json.error);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLocking(false);
    }
  };

  if (loading && !report) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <BrandPageLoader
          message="Loading Monthly Accounting Closing..."
          submessage="Auditing trial balance debits and credits, checking period lock status, and generating audit trail..."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header & Period Selectors */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/reports"
            className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 dark:border-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Monthly Business Closing Report
            </h2>
            <p className="text-xs text-slate-500">
              Audit reconciliations, inventory valuation, P&L, balance sheet, and period controls
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {new Date(2000, m - 1).toLocaleString("default", { month: "long" })}
              </option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5 mr-1" /> Print
          </Button>
        </div>
      </div>

      {loading || !report ? (
        <div className="p-12 text-center text-xs text-slate-400">Compiling monthly financial statements...</div>
      ) : (
        <div className="print-report-sheet space-y-6 print:space-y-4">
          {/* Printable Official Corporate Header */}
          <ReportPrintHeader
            title="Monthly Business Closing & Audit Report"
            subtitle="Comprehensive Financial Statements, Product Performance & General Ledger Reconciliations"
            reportDate={`${new Date(year, month - 1).toLocaleString("default", { month: "long" })} ${year}`}
            periodLabel={`01/${String(month).padStart(2, "0")}/${year} TO ${new Date(year, month, 0).getDate()}/${String(month).padStart(2, "0")}/${year}`}
            company={activeCompany}
            userName={user?.name}
            badgeText={report.isClosed ? "PERIOD CLOSED & LOCKED" : "ACTIVE OPEN PERIOD"}
          />

          {/* Status & Period Control Banner (Interactive screen only) */}
          <div
            className={`flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl p-5 border shadow-sm print:hidden ${
              report.isClosed
                ? "bg-slate-900 text-white border-slate-800"
                : "bg-blue-50/80 border-blue-200 text-blue-900 dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-100"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`rounded-xl p-2.5 ${
                  report.isClosed ? "bg-slate-800 text-rose-400" : "bg-blue-600 text-white"
                }`}
              >
                {report.isClosed ? <Lock className="h-6 w-6" /> : <Unlock className="h-6 w-6" />}
              </div>
              <div>
                <h3 className="text-base font-bold">
                  {report.periodName} • {report.isClosed ? "CLOSED & LOCKED" : "ACTIVE OPEN PERIOD"}
                </h3>
                <p className="text-xs opacity-80 mt-0.5">
                  {report.isClosed
                    ? `Closed on ${new Date(report.closedAt).toLocaleDateString()}. Transactions in this period are locked.`
                    : "Pre-closing checks passed. Ready for month-end reconciliation."}
                </p>
              </div>
            </div>

            <div className="print:hidden">
              {report.isClosed ? (
                <Button variant="outline" size="sm" onClick={handleReopenPeriod} isLoading={locking}>
                  <Unlock className="h-3.5 w-3.5 mr-1" /> Reopen Month
                </Button>
              ) : (
                <Button variant="danger" size="sm" onClick={handleClosePeriod} isLoading={locking}>
                  <Lock className="h-3.5 w-3.5 mr-1" /> Close Month & Lock Records
                </Button>
              )}
            </div>
          </div>

          {/* Pre-Closing Warnings (Interactive screen only) */}
          {report.warnings && report.warnings.length > 0 && !report.isClosed && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50/75 p-4 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300 print:hidden">
              <div className="flex items-center gap-2 font-bold mb-1.5">
                <AlertTriangle className="h-4 w-4" />
                <span>Pre-Closing Audit Notices:</span>
              </div>
              <ul className="list-disc list-inside space-y-1">
                {report.warnings.map((w: string, i: number) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Section A & B: Sales & Purchases Comparison */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle>A. Monthly Sales Performance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 text-xs">
                <div className="flex justify-between font-bold text-sm text-slate-900 dark:text-white">
                  <span>Gross Sales ({report.sales.invoiceCount} invoices)</span>
                  <span className="text-blue-600 tabular-nums">{formatMoney(report.sales.total)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Cash Sales Received</span>
                  <span className="tabular-nums font-semibold text-emerald-600">{formatMoney(report.sales.cash)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Credit Sales (Receivables)</span>
                  <span className="tabular-nums font-semibold text-rose-600">{formatMoney(report.sales.credit)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Cost of Goods Sold (COGS)</span>
                  <span className="tabular-nums font-semibold">-{formatMoney(report.sales.cogs)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-2 font-bold text-emerald-600">
                  <span>Gross Profit</span>
                  <span className="tabular-nums">{formatMoney(report.sales.grossProfit)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle>B. Monthly Inward Purchases</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 text-xs">
                <div className="flex justify-between font-bold text-sm text-slate-900 dark:text-white">
                  <span>Total Purchases ({report.purchases.invoiceCount} bills)</span>
                  <span className="text-indigo-600 tabular-nums">{formatMoney(report.purchases.total)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Cash Paid Immediately</span>
                  <span className="tabular-nums font-semibold">{formatMoney(report.purchases.cash)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Credit Purchases (Payables)</span>
                  <span className="tabular-nums font-semibold text-rose-600">{formatMoney(report.purchases.credit)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-2 text-slate-500">
                  <span>Net Stock Inventory Added</span>
                  <span className="tabular-nums font-semibold">{formatMoney(report.purchases.total)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Section C, D, & H: Receivables, Payables, and Stock Closing */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase text-slate-500">C. Customer Receivables</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold text-rose-600 tabular-nums">
                  {formatMoney(report.receivables.total)}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">Outstanding across {report.receivables.count} customers</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase text-slate-500">D. Supplier Payables</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold text-rose-600 tabular-nums">
                  {formatMoney(report.payables.total)}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">Due to {report.payables.count} registered suppliers</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase text-slate-500">H. Inventory Closing Value</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold text-blue-600 tabular-nums">
                  {formatMoney(report.inventory.totalValue)}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">{report.inventory.productCount} active catalog items</p>
              </CardContent>
            </Card>
          </div>

          {/* Section E: Itemized Product Sales Performance List */}
          {report.sales.byProduct && report.sales.byProduct.length > 0 && (
            <Card className="print:border print:border-slate-300 print:shadow-none print:break-inside-avoid">
              <CardHeader className="flex flex-row items-center justify-between pb-3 print:pb-2 print:border-b print:border-slate-300">
                <div>
                  <CardTitle className="text-base font-bold">E. Itemized Product Sales Performance (ماہانہ اشیاء فروخت رجسٹر)</CardTitle>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Product-wise sold quantities, sales revenue, and volume distribution
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-sm text-blue-600 block">
                    {formatMoney(report.sales.total)}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500">
                    {report.sales.byProduct.reduce((acc: number, p: any) => acc + Number(p.quantity || 0), 0)} units total
                  </span>
                </div>
              </CardHeader>
              <CardContent className="print:p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="border-b text-[10px] font-bold uppercase text-slate-400 print:text-black print:border-slate-400">
                      <tr>
                        <th className="pb-2 w-10">#</th>
                        <th className="pb-2">Product Description (اشیاء تفصیل)</th>
                        <th className="pb-2 text-right">Units Sold (تعداد)</th>
                        <th className="pb-2 text-right">Sales Revenue (رقم)</th>
                        <th className="pb-2 text-right w-24">% Contribution</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-slate-200">
                      {report.sales.byProduct.map((p: any, idx: number) => {
                        const pct = report.sales.total > 0 ? ((p.total / report.sales.total) * 100).toFixed(1) : "0.0";
                        return (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                            <td className="py-2 text-slate-400 font-mono">{idx + 1}</td>
                            <td className="py-2 font-semibold text-slate-900 dark:text-white">
                              {p.name}
                            </td>
                            <td className="py-2 text-right font-bold text-blue-600 tabular-nums">
                              {p.quantity} units
                            </td>
                            <td className="py-2 text-right font-bold tabular-nums">
                              {formatMoney(p.total)}
                            </td>
                            <td className="py-2 text-right text-slate-500 font-mono text-[11px]">
                              {pct}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="border-t-2 border-slate-900 text-[11px] font-bold text-slate-900 bg-slate-50/70 print:bg-transparent">
                      <tr>
                        <td colSpan={2} className="py-2 px-1 font-bold font-mono">
                          TOTAL PRODUCT SALES ({report.sales.byProduct.length} Items)
                        </td>
                        <td className="py-2 text-right text-blue-700 font-black tabular-nums">
                          {report.sales.byProduct.reduce((acc: number, p: any) => acc + Number(p.quantity || 0), 0)} units
                        </td>
                        <td className="py-2 text-right font-black tabular-nums">
                          {formatMoney(report.sales.total)}
                        </td>
                        <td className="py-2 text-right font-bold text-slate-700">100.0%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Section F: Customer Sales Breakdown List */}
          {report.sales.byCustomer && report.sales.byCustomer.length > 0 && (
            <Card className="print:border print:border-slate-300 print:shadow-none print:break-inside-avoid">
              <CardHeader className="flex flex-row items-center justify-between pb-3 print:pb-2 print:border-b print:border-slate-300">
                <div>
                  <CardTitle className="text-base font-bold">F. Customer Sales Turnover Distribution (کسٹمرز فروخت سمری)</CardTitle>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Account receivables turnover and invoice count per client
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-sm text-emerald-600 block">
                    {formatMoney(report.sales.total)}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500">
                    {report.sales.byCustomer.length} active clients
                  </span>
                </div>
              </CardHeader>
              <CardContent className="print:p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="border-b text-[10px] font-bold uppercase text-slate-400 print:text-black print:border-slate-400">
                      <tr>
                        <th className="pb-2 w-10">#</th>
                        <th className="pb-2">Customer / Client (گاہک کا نام)</th>
                        <th className="pb-2 text-center">Invoices Count</th>
                        <th className="pb-2 text-right">Total Billed Revenue (رقم)</th>
                        <th className="pb-2 text-right w-24">% of Sales</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-slate-200">
                      {report.sales.byCustomer.map((c: any, idx: number) => {
                        const pct = report.sales.total > 0 ? ((c.total / report.sales.total) * 100).toFixed(1) : "0.0";
                        return (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                            <td className="py-2 text-slate-400 font-mono">{idx + 1}</td>
                            <td className="py-2 font-semibold text-slate-900 dark:text-white">
                              {c.name}
                            </td>
                            <td className="py-2 text-center font-bold text-slate-700 dark:text-slate-300">
                              {c.count} invoices
                            </td>
                            <td className="py-2 text-right font-bold tabular-nums">
                              {formatMoney(c.total)}
                            </td>
                            <td className="py-2 text-right text-slate-500 font-mono text-[11px]">
                              {pct}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="border-t-2 border-slate-900 text-[11px] font-bold text-slate-900 bg-slate-50/70 print:bg-transparent">
                      <tr>
                        <td colSpan={2} className="py-2 px-1 font-bold font-mono">
                          TOTAL CLIENTS BILLED ({report.sales.byCustomer.length} Accounts)
                        </td>
                        <td className="py-2 text-center font-black">
                          {report.sales.byCustomer.reduce((acc: number, c: any) => acc + Number(c.count || 0), 0)} invoices
                        </td>
                        <td className="py-2 text-right font-black tabular-nums">
                          {formatMoney(report.sales.total)}
                        </td>
                        <td className="py-2 text-right font-bold text-slate-700">100.0%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Section G: Monthly Overhead Expenses */}
          <Card className="print:border print:border-slate-300 print:shadow-none print:break-inside-avoid">
            <CardHeader className="pb-3 border-b border-slate-100 print:pb-2 print:border-slate-300">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-base font-bold">G. Operating Overhead Expenses Breakdown (تفصیلی اخراجات رجسٹر)</CardTitle>
                  <p className="text-[11px] text-slate-500 mt-0.5">Utility bills, salaries, rent, maintenance and overhead expenses</p>
                </div>
                <span className="font-bold text-sm text-rose-600 tabular-nums">
                  Total: {formatMoney(report.expenses.total)}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 print:p-0">
              {report.expenses.categories?.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-3 px-2">No expenses recorded for this month.</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs print:hidden">
                    {report.expenses.categories.map((cat: any, i: number) => (
                      <div key={i} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                        <p className="font-semibold text-slate-900 dark:text-white">{cat.name}</p>
                        <p className="text-sm font-bold text-rose-600 tabular-nums mt-1">{formatMoney(cat.total)}</p>
                        <p className="text-[10px] text-slate-400">{cat.percentage}% of total expenses</p>
                      </div>
                    ))}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="border-b text-[10px] font-bold uppercase text-slate-400 print:text-black print:border-slate-400">
                        <tr>
                          <th className="pb-2 w-10">#</th>
                          <th className="pb-2">Expense Category / Head (کھاتہ اخراجات)</th>
                          <th className="pb-2 text-center">Vouchers Count</th>
                          <th className="pb-2 text-right">Amount Spent (رقم)</th>
                          <th className="pb-2 text-right w-24">% of Overheads</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-slate-200">
                        {report.expenses.categories.map((cat: any, i: number) => (
                          <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                            <td className="py-2 text-slate-400 font-mono">{i + 1}</td>
                            <td className="py-2 font-semibold text-slate-900 dark:text-white">{cat.name}</td>
                            <td className="py-2 text-center font-bold text-slate-700 dark:text-slate-300">{cat.count} vouchers</td>
                            <td className="py-2 text-right font-bold text-rose-600 tabular-nums">{formatMoney(cat.total)}</td>
                            <td className="py-2 text-right text-slate-500 font-mono text-[11px]">{cat.percentage}%</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t-2 border-slate-900 text-[11px] font-bold text-slate-900 bg-slate-50/70 print:bg-transparent">
                        <tr>
                          <td colSpan={2} className="py-2 px-1 font-bold font-mono">TOTAL OPERATING EXPENSES</td>
                          <td className="py-2 text-center font-black">
                            {report.expenses.categories.reduce((acc: number, c: any) => acc + Number(c.count || 0), 0)} vouchers
                          </td>
                          <td className="py-2 text-right font-black text-rose-700 tabular-nums">{formatMoney(report.expenses.total)}</td>
                          <td className="py-2 text-right font-bold text-slate-700">100.0%</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Section I: Profit & Loss Final Statement */}
          <Card className="border-2 border-slate-900/10 dark:border-slate-800 print:border print:border-slate-300 print:shadow-none print:break-inside-avoid">
            <CardHeader className="pb-3 border-b border-slate-200 print:pb-2 print:border-slate-300">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                <CardTitle className="text-base font-bold">I. Month-End Profit & Loss Formal Statement (آمدنی و اخراجات گوشوارہ)</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-xs print:p-0">
              <div className="flex justify-between font-medium py-1">
                <span>Gross Sales Turnover</span>
                <span className="tabular-nums font-bold">{formatMoney(report.profitAndLoss.netSales)}</span>
              </div>
              <div className="flex justify-between font-medium text-slate-500 py-1">
                <span>Less: Cost of Goods Sold (COGS)</span>
                <span className="tabular-nums font-semibold text-rose-600">-{formatMoney(report.profitAndLoss.cogs)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm border-t border-slate-200 pt-2 pb-1">
                <span>Gross Profit Margin ({report.profitAndLoss.grossMargin}%)</span>
                <span className="text-blue-600 tabular-nums">{formatMoney(report.profitAndLoss.grossProfit)}</span>
              </div>
              <div className="flex justify-between font-medium text-slate-500 py-1">
                <span>Less: Operating Overhead Expenses</span>
                <span className="tabular-nums text-rose-600 font-semibold">-{formatMoney(report.profitAndLoss.expenses)}</span>
              </div>
              <div className="flex justify-between font-black text-base border-t-2 border-slate-900 dark:border-white pt-2.5 pb-1">
                <span>NET PROFIT / (LOSS) FOR THE PERIOD</span>
                <span
                  className={`tabular-nums ${
                    report.profitAndLoss.netProfit >= 0 ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {formatMoney(report.profitAndLoss.netProfit)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Section K: Cash & Bank Reconciliation */}
          <Card className="print:border print:border-slate-300 print:shadow-none print:break-inside-avoid">
            <CardHeader className="pb-3 border-b border-slate-100 print:pb-2 print:border-slate-300">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-blue-600" />
                <CardTitle className="text-base font-bold">K. Liquid Cash & Bank Position at Month Close (نقدی و بینک سمری)</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-xs print:p-0 print:border-t print:border-slate-200">
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800 print:bg-transparent print:border-r print:border-slate-200 print:p-2">
                <p className="text-slate-400 uppercase text-[10px] font-bold">Total Cash Received</p>
                <p className="text-sm font-bold text-emerald-600 tabular-nums mt-1">
                  {formatMoney(report.cashFlow.cashReceived)}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800 print:bg-transparent print:border-r print:border-slate-200 print:p-2">
                <p className="text-slate-400 uppercase text-[10px] font-bold">Total Bank Deposits</p>
                <p className="text-sm font-bold text-emerald-600 tabular-nums mt-1">
                  {formatMoney(report.cashFlow.bankReceived)}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800 print:bg-transparent print:border-r print:border-slate-200 print:p-2">
                <p className="text-slate-400 uppercase text-[10px] font-bold">Closing Physical Cash</p>
                <p className="text-base font-bold text-slate-900 dark:text-white tabular-nums mt-1">
                  {formatMoney(report.cashFlow.closingCash)}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800 print:bg-transparent print:p-2">
                <p className="text-slate-400 uppercase text-[10px] font-bold">Closing Bank Balance</p>
                <p className="text-base font-bold text-blue-600 tabular-nums mt-1">
                  {formatMoney(report.cashFlow.closingBank)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Printable Official Signatures & System Footer */}
          <ReportPrintFooter notes="Monthly business closing statement and ledger reconciliation approved by management." />
        </div>
      )}
    </div>
  );
}
