"use client";

import React, { useEffect, useState } from "react";
import { formatMoney } from "@/lib/decimal";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Printer, Download, Calendar, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { BrandPageLoader } from "@/components/ui/loader";

export default function DailyReportPage() {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchDaily = async (targetDate: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/daily?date=${targetDate}`);
      const json = await res.json();
      if (json.success) setReport(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDaily(date);
  }, [date]);

  if (loading && !report) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <BrandPageLoader
          message="Compiling Daily Business Report..."
          submessage="Summarizing day transactions, counter cash receipts, inventory movements, and expenses..."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Controls (Hidden on Print) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/reports"
            className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 dark:border-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Daily Business Report</h2>
            <p className="text-xs text-slate-500">Itemized day closing for cash, stock, sales, and expenses</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5 mr-1" /> Print Report
          </Button>
        </div>
      </div>

      {loading || !report ? (
        <div className="p-12 text-center text-xs text-slate-400">Loading daily report...</div>
      ) : (
        <div className="space-y-6 print:space-y-4">
          {/* Printable Header */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 print:border-none print:p-0">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4 dark:border-slate-800">
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">Daily Operational Summary</h1>
                <p className="text-xs text-slate-500">SmartBiz Trading & Distribution • Karachi, Pakistan</p>
              </div>
              <div className="text-right">
                <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                  DATE: {new Date(report.date).toLocaleDateString("en-GB", { dateStyle: "full" })}
                </span>
              </div>
            </div>

            {/* Financial Totals 5-Column Grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 pt-4 text-xs">
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Sales Revenue</span>
                <span className="text-base font-bold text-slate-900 dark:text-white tabular-nums">
                  {formatMoney(report.financialSummary.salesRevenue)}
                </span>
                <span className="block text-[10px] text-slate-500 mt-0.5">{report.sales.count} invoices issued</span>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Purchases Total</span>
                <span className="text-base font-bold text-indigo-600 tabular-nums">
                  {formatMoney(report.financialSummary.totalPurchases || report.purchases.total)}
                </span>
                <span className="block text-[10px] text-slate-500 mt-0.5">{report.purchases.count} vendor bills</span>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Money Received</span>
                <span className="text-base font-bold text-emerald-600 tabular-nums">
                  {formatMoney(report.financialSummary.totalMoneyReceived)}
                </span>
                <span className="block text-[10px] text-slate-500 mt-0.5">Cash & bank collections</span>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Money Disbursed</span>
                <span className="text-base font-bold text-rose-600 tabular-nums">
                  {formatMoney(report.financialSummary.totalMoneyPaid + report.financialSummary.totalExpenses)}
                </span>
                <span className="block text-[10px] text-slate-500 mt-0.5">Vendors & daily expenses</span>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800 col-span-2 sm:col-span-1">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Net Cash Movement</span>
                <span
                  className={`text-base font-bold tabular-nums ${
                    report.financialSummary.netCashMovement >= 0 ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {formatMoney(report.financialSummary.netCashMovement)}
                </span>
                <span className="block text-[10px] text-slate-500 mt-0.5">Net day cash delta</span>
              </div>
            </div>
          </div>

          {/* Section 1: Sales Summary */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle>1. Sales Invoices Issued Today</CardTitle>
              <span className="font-bold text-xs text-blue-600">{formatMoney(report.sales.total)}</span>
            </CardHeader>
            <CardContent>
              {report.sales.items.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No sales transactions on this date.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b text-[10px] font-bold uppercase text-slate-400">
                      <tr>
                        <th className="pb-2">Invoice #</th>
                        <th className="pb-2">Customer</th>
                        <th className="pb-2 text-right">Invoice Total</th>
                        <th className="pb-2 text-right">Paid Today</th>
                        <th className="pb-2 text-right">Receivable</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {report.sales.items.map((s: any) => (
                        <tr key={s.id}>
                          <td className="py-2 font-mono font-semibold text-blue-600">{s.invoiceNumber}</td>
                          <td className="py-2 font-medium">{s.customerName}</td>
                          <td className="py-2 text-right font-bold tabular-nums">{formatMoney(s.totalAmount)}</td>
                          <td className="py-2 text-right text-emerald-600 tabular-nums">{formatMoney(s.paidAmount)}</td>
                          <td className="py-2 text-right text-rose-600 tabular-nums">{formatMoney(s.remainingAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 2: Purchases Summary (Newly Added as Requested) */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle>2. Purchases & Vendor Bills Today</CardTitle>
              <span className="font-bold text-xs text-indigo-600">{formatMoney(report.purchases.total)}</span>
            </CardHeader>
            <CardContent>
              {report.purchases.items.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No purchases recorded on this date.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b text-[10px] font-bold uppercase text-slate-400">
                      <tr>
                        <th className="pb-2">Purchase #</th>
                        <th className="pb-2">Supplier / Vendor</th>
                        <th className="pb-2 text-right">Bill Total</th>
                        <th className="pb-2 text-right">Paid Amount</th>
                        <th className="pb-2 text-right">Payable Balance</th>
                        <th className="pb-2 text-right">Payment Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {report.purchases.items.map((p: any) => (
                        <tr key={p.id}>
                          <td className="py-2 font-mono font-semibold text-indigo-600">{p.purchaseNumber}</td>
                          <td className="py-2 font-medium">{p.supplierName || p.supplier?.name || "Vendor"}</td>
                          <td className="py-2 text-right font-bold tabular-nums">{formatMoney(p.totalAmount)}</td>
                          <td className="py-2 text-right text-emerald-600 tabular-nums">{formatMoney(p.paidAmount)}</td>
                          <td className="py-2 text-right text-rose-600 tabular-nums">{formatMoney(p.remainingAmount)}</td>
                          <td className="py-2 text-right font-semibold">
                            <span
                              className={`rounded px-2 py-0.5 text-[10px] ${
                                p.paymentStatus === "PAID"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : p.paymentStatus === "PARTIAL"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-rose-100 text-rose-800"
                              }`}
                            >
                              {p.paymentStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 3: Receipts & Disbursements */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle>3. Money Received Today</CardTitle>
                <span className="font-bold text-xs text-emerald-600">{formatMoney(report.receipts.total)}</span>
              </CardHeader>
              <CardContent>
                {report.receipts.items.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No customer receipts logged.</p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {report.receipts.items.map((r: any) => (
                      <div key={r.id} className="flex justify-between py-2">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">{r.partyName}</p>
                          <p className="text-[10px] text-slate-400">{r.paymentMethod} • {r.referenceNumber || "Direct"}</p>
                        </div>
                        <p className="font-bold text-emerald-600 tabular-nums">{formatMoney(r.amount)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle>4. Money Paid & Expenses Today</CardTitle>
                <span className="font-bold text-xs text-rose-600">
                  {formatMoney(report.disbursements.total + report.expenses.total)}
                </span>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-xs">
                  {report.expenses.items.map((exp: any) => (
                    <div key={exp.id} className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">{exp.category?.name}: {exp.description}</p>
                        <p className="text-[10px] text-slate-400">Paid to: {exp.paidTo || "Vendor"}</p>
                      </div>
                      <p className="font-bold text-rose-600 tabular-nums">-{formatMoney(exp.amount)}</p>
                    </div>
                  ))}
                  {report.disbursements.items.map((d: any) => (
                    <div key={d.id} className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">Vendor: {d.partyName}</p>
                        <p className="text-[10px] text-slate-400">Supplier bill payment</p>
                      </div>
                      <p className="font-bold text-rose-600 tabular-nums">-{formatMoney(d.amount)}</p>
                    </div>
                  ))}
                  {report.expenses.items.length === 0 && report.disbursements.items.length === 0 && (
                    <p className="text-xs text-slate-400 italic">No disbursements or expenses recorded.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Section 5: Stock Movements Today */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>5. Inventory Movements Logged Today</CardTitle>
            </CardHeader>
            <CardContent>
              {report.stockMovements.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No inventory movements recorded on this date.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b text-[10px] font-bold uppercase text-slate-400">
                      <tr>
                        <th className="pb-2">Time</th>
                        <th className="pb-2">Product Name</th>
                        <th className="pb-2">Movement Type</th>
                        <th className="pb-2 text-center">Quantity Delta</th>
                        <th className="pb-2">Reference / Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {report.stockMovements.map((m: any) => (
                        <tr key={m.id}>
                          <td className="py-2 text-slate-400">{new Date(m.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                          <td className="py-2 font-semibold text-slate-900 dark:text-white">{m.product?.name}</td>
                          <td className="py-2">
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold dark:bg-slate-800">
                              {m.type}
                            </span>
                          </td>
                          <td className="py-2 text-center font-bold tabular-nums">
                            {["STOCK_IN", "PURCHASE", "OPENING", "SALE_RETURN"].includes(m.type) ? "+" : "-"}
                            {m.quantity}
                          </td>
                          <td className="py-2 text-slate-500">{m.notes || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 6: Client Reports Quick Access (Receivables & Payables & Stock Summary) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 print:hidden">
            <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900 dark:bg-blue-950/40">
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-200">
                Accounts Receivables
              </h4>
              <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-1">
                Client summary matching Image 2 with customer codes, debits, credits, and phone numbers.
              </p>
              <Link
                href="/reports/receivables-summary"
                className="mt-3 inline-block rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
              >
                View Receivables Summary →
              </Link>
            </div>

            <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-900 dark:bg-indigo-950/40">
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-200">
                Accounts Payables
              </h4>
              <p className="text-[11px] text-indigo-700 dark:text-indigo-300 mt-1">
                Supplier balances summary with vendor codes, payable balances, and contact details.
              </p>
              <Link
                href="/reports/payables-summary"
                className="mt-3 inline-block rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                View Payables Summary →
              </Link>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-200">
                Items Summary (Stock)
              </h4>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-1">
                Printable inventory sheet matching Image 1 with Opening, In, Out, and Balance.
              </p>
              <Link
                href="/reports/items-summary"
                className="mt-3 inline-block rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                View Items Summary →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
