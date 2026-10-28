"use client";

import React, { useEffect, useState } from "react";
import { formatMoney } from "@/lib/decimal";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Printer, Download, Calendar, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { BrandPageLoader } from "@/components/ui/loader";
import { useAuth } from "@/context/AuthContext";
import { ReportPrintHeader } from "@/components/reports/ReportPrintHeader";
import { ReportPrintFooter } from "@/components/reports/ReportPrintFooter";

export default function DailyReportPage() {
  const { activeCompany, user } = useAuth();
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
        <div className="print-report-sheet space-y-6 print:space-y-2">
          {/* Printable Official Header */}
          <ReportPrintHeader
            title="Daily Day-End Closing Report"
            subtitle="Sales, Inward Goods, Receipts, Expenses & Stock Reconciliation"
            reportDate={new Date(report.date).toLocaleDateString("en-GB", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
            company={activeCompany}
            userName={user?.name}
            badgeText="Day-End Audit"
          />

          {/* Financial Totals 5-Column Grid */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 print:border print:border-slate-300 print:p-1.5 print:shadow-none print:break-inside-avoid">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 text-xs print:gap-1.5">
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800 print:p-1.5 print:bg-white print:border print:border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase font-bold print:text-[8.5px] print:text-slate-600">Sales Revenue</span>
                <span className="text-base font-bold text-slate-900 dark:text-white tabular-nums print:text-xs">
                  {formatMoney(report.financialSummary.salesRevenue)}
                </span>
                <span className="block text-[10px] text-slate-500 mt-0.5 print:text-[8px]">
                  {report.sales.count} invoices
                  {(() => {
                    const totalUnits = (report.sales.items || []).reduce((sum: number, s: any) => {
                      return sum + (s.items || []).reduce((isum: number, it: any) => isum + Number(it.quantity || 0), 0);
                    }, 0);
                    return totalUnits > 0 ? ` • ${totalUnits} units sold` : "";
                  })()}
                </span>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800 print:p-1.5 print:bg-white print:border print:border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase font-bold print:text-[8.5px] print:text-slate-600">Purchases Total</span>
                <span className="text-base font-bold text-indigo-600 tabular-nums print:text-xs">
                  {formatMoney(report.financialSummary.totalPurchases || report.purchases.total)}
                </span>
                <span className="block text-[10px] text-slate-500 mt-0.5 print:text-[8px]">
                  {report.purchases.count} vendor bills
                  {(() => {
                    const totalUnits = (report.purchases.items || []).reduce((sum: number, p: any) => {
                      return sum + (p.items || []).reduce((isum: number, it: any) => isum + Number(it.quantity || 0), 0);
                    }, 0);
                    return totalUnits > 0 ? ` • ${totalUnits} units inward` : "";
                  })()}
                </span>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800 print:p-1.5 print:bg-white print:border print:border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase font-bold print:text-[8.5px] print:text-slate-600">Money Received</span>
                <span className="text-base font-bold text-emerald-600 tabular-nums print:text-xs">
                  {formatMoney(report.financialSummary.totalMoneyReceived)}
                </span>
                <span className="block text-[10px] text-slate-500 mt-0.5 print:text-[8px]">Cash & bank collections</span>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800 print:p-1.5 print:bg-white print:border print:border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase font-bold print:text-[8.5px] print:text-slate-600">Money Disbursed</span>
                <span className="text-base font-bold text-rose-600 tabular-nums print:text-xs">
                  {formatMoney(report.financialSummary.totalMoneyPaid + report.financialSummary.totalExpenses)}
                </span>
                <span className="block text-[10px] text-slate-500 mt-0.5 print:text-[8px]">Vendors & daily expenses</span>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800 col-span-2 sm:col-span-1 print:p-1.5 print:bg-white print:border print:border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase font-bold print:text-[8.5px] print:text-slate-600">Net Cash Movement</span>
                <span
                  className={`text-base font-bold tabular-nums print:text-xs ${
                    report.financialSummary.netCashMovement >= 0 ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {formatMoney(report.financialSummary.netCashMovement)}
                </span>
                <span className="block text-[10px] text-slate-500 mt-0.5 print:text-[8px]">Net day cash delta</span>
              </div>
            </div>
          </div>

          {/* Section 1: Sales Summary with Products & Item Counts */}
          <Card className="print:border print:border-slate-300 print:shadow-none print:break-inside-avoid print:p-1.5">
            <CardHeader className="flex flex-row items-center justify-between pb-3 print:pb-1 print:border-b print:border-slate-300">
              <div>
                <CardTitle className="text-base font-bold print:text-xs">1. Sales Invoices Issued Today (فروخت رجسٹر)</CardTitle>
                <p className="text-[11px] text-slate-500 mt-0.5 print:text-[8.5px] print:mt-0">
                  Itemized product breakdown with quantities, customer information, and receivables
                </p>
              </div>
              <div className="text-right">
                <span className="font-bold text-sm text-blue-600 block print:text-xs">{formatMoney(report.sales.total)}</span>
                <span className="text-[10px] font-semibold text-slate-500 print:text-[8px]">
                  {(() => {
                    const totalUnits = (report.sales.items || []).reduce((sum: number, s: any) => {
                      return sum + (s.items || []).reduce((isum: number, it: any) => isum + Number(it.quantity || 0), 0);
                    }, 0);
                    return totalUnits > 0 ? `${totalUnits} units sold across ${report.sales.count} invoices` : `${report.sales.count} invoices`;
                  })()}
                </span>
              </div>
            </CardHeader>
            <CardContent className="print:p-0">
              {report.sales.items.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-3 px-2 print:py-1 print:text-[9px]">No sales transactions on this date.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse print:text-[9.5px]">
                    <thead className="border-b text-[10px] font-bold uppercase text-slate-400 print:text-black print:border-slate-400">
                      <tr>
                        <th className="pb-2 print:pb-1">Invoice #</th>
                        <th className="pb-2 print:pb-1">Customer</th>
                        <th className="pb-2 print:pb-1">Products & Quantities Sold (اشیاء و تعداد)</th>
                        <th className="pb-2 print:pb-1 text-right">Invoice Total</th>
                        <th className="pb-2 print:pb-1 text-right">Paid Today</th>
                        <th className="pb-2 print:pb-1 text-right">Receivable</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-slate-200">
                      {report.sales.items.map((s: any) => {
                        const lineItems = s.items || [];
                        const lineQty = lineItems.reduce((sum: number, it: any) => sum + Number(it.quantity || 0), 0);
                        const itemsSummary = lineItems.length > 0
                          ? lineItems.map((it: any) => `${Number(it.quantity)}x ${it.productName || it.name}`).join(", ")
                          : (s.narration || "General Items");

                        return (
                          <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                            <td className="py-2.5 print:py-1 font-mono font-semibold text-blue-600 align-top">{s.invoiceNumber}</td>
                            <td className="py-2.5 print:py-1 font-medium align-top">
                              <span className="text-slate-900 dark:text-white font-semibold">{s.customerName}</span>
                              {s.customerPhone && <span className="block text-[10px] text-slate-400 font-mono print:text-[8px]">{s.customerPhone}</span>}
                            </td>
                            <td className="py-2.5 print:py-1 align-top">
                              <div className="flex flex-col gap-1 max-w-md">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {lineQty > 0 && (
                                    <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900 print:border-none print:p-0 print:text-[8.5px]">
                                      📦 {lineQty} {lineQty === 1 ? "unit" : "units"} ({lineItems.length} {lineItems.length === 1 ? "item" : "items"})
                                    </span>
                                  )}
                                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 print:text-[9px]">
                                    {itemsSummary}
                                  </span>
                                </div>
                                {s.narration && s.narration !== itemsSummary && (
                                  <span className="text-[10px] text-slate-500 italic block print:text-[8px]">
                                    {s.narration}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 print:py-1 text-right font-bold tabular-nums align-top">{formatMoney(s.totalAmount)}</td>
                            <td className="py-2.5 print:py-1 text-right text-emerald-600 tabular-nums align-top">{formatMoney(s.paidAmount)}</td>
                            <td className="py-2.5 print:py-1 text-right text-rose-600 tabular-nums align-top">{formatMoney(s.remainingAmount)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="border-t-2 border-slate-900 text-[11px] font-bold text-slate-900 bg-slate-50/70 print:bg-transparent">
                      <tr>
                        <td className="py-2 px-1 font-mono font-bold" colSpan={2}>
                          TOTAL SALES ({report.sales.count} Invoices)
                        </td>
                        <td className="py-2 text-blue-700 font-bold">
                          {(() => {
                            const totalUnits = (report.sales.items || []).reduce((sum: number, s: any) => {
                              return sum + (s.items || []).reduce((isum: number, it: any) => isum + Number(it.quantity || 0), 0);
                            }, 0);
                            return totalUnits > 0 ? `📦 Total ${totalUnits} units sold` : "—";
                          })()}
                        </td>
                        <td className="py-2 text-right font-black tabular-nums">
                          {formatMoney(report.sales.total)}
                        </td>
                        <td className="py-2 text-right text-emerald-700 font-black tabular-nums">
                          {formatMoney(
                            (report.sales.items || []).reduce((acc: number, s: any) => acc + Number(s.paidAmount || 0), 0)
                          )}
                        </td>
                        <td className="py-2 text-right text-rose-700 font-black tabular-nums">
                          {formatMoney(
                            (report.sales.items || []).reduce((acc: number, s: any) => acc + Number(s.remainingAmount || 0), 0)
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 2: Purchases Summary with Products & Item Counts */}
          <Card className="print:border print:border-slate-300 print:shadow-none print:break-inside-avoid print:p-1.5">
            <CardHeader className="flex flex-row items-center justify-between pb-3 print:pb-1 print:border-b print:border-slate-300">
              <div>
                <CardTitle className="text-base font-bold print:text-xs">2. Purchases & Vendor Bills Today (خریداری رجسٹر)</CardTitle>
                <p className="text-[11px] text-slate-500 mt-0.5 print:text-[8.5px] print:mt-0">
                  Inward stock procurement breakdown with product items and vendor dues
                </p>
              </div>
              <div className="text-right">
                <span className="font-bold text-sm text-indigo-600 block print:text-xs">{formatMoney(report.purchases.total)}</span>
                <span className="text-[10px] font-semibold text-slate-500 print:text-[8px]">
                  {(() => {
                    const totalUnits = (report.purchases.items || []).reduce((sum: number, p: any) => {
                      return sum + (p.items || []).reduce((isum: number, it: any) => isum + Number(it.quantity || 0), 0);
                    }, 0);
                    return totalUnits > 0 ? `${totalUnits} units inward across ${report.purchases.count} bills` : `${report.purchases.count} bills`;
                  })()}
                </span>
              </div>
            </CardHeader>
            <CardContent className="print:p-0">
              {report.purchases.items.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-3 px-2 print:py-1 print:text-[9px]">No purchases recorded on this date.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse print:text-[9.5px]">
                    <thead className="border-b text-[10px] font-bold uppercase text-slate-400 print:text-black print:border-slate-400">
                      <tr>
                        <th className="pb-2 print:pb-1">Purchase #</th>
                        <th className="pb-2 print:pb-1">Supplier / Vendor</th>
                        <th className="pb-2 print:pb-1">Products & Quantities Inward (خریداری اشیاء و تعداد)</th>
                        <th className="pb-2 print:pb-1 text-right">Bill Total</th>
                        <th className="pb-2 print:pb-1 text-right">Paid Amount</th>
                        <th className="pb-2 print:pb-1 text-right">Payable Balance</th>
                        <th className="pb-2 print:pb-1 text-right">Payment Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-slate-200">
                      {report.purchases.items.map((p: any) => {
                        const lineItems = p.items || [];
                        const lineQty = lineItems.reduce((sum: number, it: any) => sum + Number(it.quantity || 0), 0);
                        const itemsSummary = lineItems.length > 0
                          ? lineItems.map((it: any) => `${Number(it.quantity)}x ${it.productName || it.name}`).join(", ")
                          : (p.notes || "General Inventory");

                        return (
                          <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                            <td className="py-2.5 print:py-1 font-mono font-semibold text-indigo-600 align-top">{p.purchaseNumber}</td>
                            <td className="py-2.5 print:py-1 font-medium align-top">
                              <span className="text-slate-900 dark:text-white font-semibold">{p.supplierName || p.supplier?.name || "Vendor"}</span>
                            </td>
                            <td className="py-2.5 print:py-1 align-top">
                              <div className="flex flex-col gap-1 max-w-md">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {lineQty > 0 && (
                                    <span className="inline-flex items-center gap-1 rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900 print:border-none print:p-0 print:text-[8.5px]">
                                      📦 {lineQty} {lineQty === 1 ? "unit" : "units"} ({lineItems.length} {lineItems.length === 1 ? "item" : "items"})
                                    </span>
                                  )}
                                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 print:text-[9px]">
                                    {itemsSummary}
                                  </span>
                                </div>
                                {p.notes && p.notes !== itemsSummary && (
                                  <span className="text-[10px] text-slate-500 italic block print:text-[8px]">
                                    {p.notes}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 print:py-1 text-right font-bold tabular-nums align-top">{formatMoney(p.totalAmount)}</td>
                            <td className="py-2.5 print:py-1 text-right text-emerald-600 tabular-nums align-top">{formatMoney(p.paidAmount)}</td>
                            <td className="py-2.5 print:py-1 text-right text-rose-600 tabular-nums align-top">{formatMoney(p.remainingAmount)}</td>
                            <td className="py-2.5 print:py-1 text-right font-semibold align-top">
                              <span
                                className={`rounded px-2 py-0.5 text-[10px] print:px-1 print:py-0 print:text-[8.5px] ${
                                  p.paymentStatus === "PAID"
                                    ? "bg-emerald-100 text-emerald-800 print:bg-transparent print:border print:border-emerald-700"
                                    : p.paymentStatus === "PARTIAL"
                                    ? "bg-amber-100 text-amber-800 print:bg-transparent print:border print:border-amber-700"
                                    : "bg-rose-100 text-rose-800 print:bg-transparent print:border print:border-rose-700"
                                }`}
                              >
                                {p.paymentStatus}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="border-t-2 border-slate-900 text-[11px] font-bold text-slate-900 bg-slate-50/70 print:bg-transparent">
                      <tr>
                        <td className="py-2 px-1 font-mono font-bold" colSpan={2}>
                          TOTAL PURCHASES ({report.purchases.count} Bills)
                        </td>
                        <td className="py-2 text-indigo-700 font-bold">
                          {(() => {
                            const totalUnits = (report.purchases.items || []).reduce((sum: number, p: any) => {
                              return sum + (p.items || []).reduce((isum: number, it: any) => isum + Number(it.quantity || 0), 0);
                            }, 0);
                            return totalUnits > 0 ? `📦 Total ${totalUnits} units inward` : "—";
                          })()}
                        </td>
                        <td className="py-2 text-right font-black tabular-nums">
                          {formatMoney(report.purchases.total)}
                        </td>
                        <td className="py-2 text-right text-emerald-700 font-black tabular-nums">
                          {formatMoney(
                            (report.purchases.items || []).reduce((acc: number, p: any) => acc + Number(p.paidAmount || 0), 0)
                          )}
                        </td>
                        <td className="py-2 text-right text-rose-700 font-black tabular-nums">
                          {formatMoney(
                            (report.purchases.items || []).reduce((acc: number, p: any) => acc + Number(p.remainingAmount || 0), 0)
                          )}
                        </td>
                        <td className="py-2 text-right font-bold text-slate-700">
                          {report.purchases.count > 0 ? "POSTED" : "—"}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 3: Receipts & Disbursements */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 print:gap-2">
            <Card className="print:border print:border-slate-300 print:shadow-none print:break-inside-avoid print:p-1.5">
              <CardHeader className="flex flex-row items-center justify-between pb-3 print:pb-1 print:border-b print:border-slate-300">
                <CardTitle className="text-base font-bold print:text-xs">3. Money Received Today (وصولیاں)</CardTitle>
                <span className="font-bold text-xs text-emerald-600 tabular-nums print:text-[11px]">{formatMoney(report.receipts.total)}</span>
              </CardHeader>
              <CardContent className="print:p-0">
                {report.receipts.items.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-3 px-2 print:py-1 print:text-[9px]">No customer receipts logged.</p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-slate-200 text-xs print:text-[9.5px]">
                    {report.receipts.items.map((r: any) => {
                      const matchedSale = (report.sales.items || []).find(
                        (s: any) => s.invoiceNumber === r.referenceNumber || (r.allocations && r.allocations.some((al: any) => al.sale?.invoiceNumber === s.invoiceNumber))
                      );
                      const saleItems = matchedSale?.items || (r.allocations?.[0]?.sale?.items) || [];
                      const saleItemSummary = saleItems.length > 0
                        ? `${saleItems.reduce((acc: number, it: any) => acc + Number(it.quantity || 0), 0)} units (${saleItems.map((it: any) => `${Number(it.quantity)}x ${it.productName || it.name}`).slice(0, 2).join(", ")}${saleItems.length > 2 ? "..." : ""})`
                        : "";

                      return (
                        <div key={r.id} className="flex justify-between py-2.5 px-2 print:py-1 print:px-1">
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white print:text-[9.5px]">{r.partyName}</p>
                            <p className="text-[10px] text-slate-500 print:text-[8px]">
                              <span className="font-medium text-slate-700 dark:text-slate-300">{r.paymentMethod}</span>
                              {" • "}
                              <span className="font-mono text-blue-600 dark:text-blue-400">{r.referenceNumber || "Direct"}</span>
                            </p>
                            {saleItemSummary && (
                              <p className="text-[10px] text-blue-700 dark:text-blue-300 font-semibold mt-0.5 print:text-[8px]">
                                📦 For: {saleItemSummary}
                              </p>
                            )}
                            {r.notes && !saleItemSummary && (
                              <p className="text-[10px] text-slate-400 italic mt-0.5 print:text-[8px]">{r.notes}</p>
                            )}
                          </div>
                          <p className="font-bold text-emerald-600 tabular-nums print:text-[9.5px]">{formatMoney(r.amount)}</p>
                        </div>
                      );
                    })}
                    <div className="flex justify-between py-2 px-2 print:py-1 print:px-1 bg-slate-50/70 print:bg-transparent border-t-2 border-slate-900 font-bold text-[11px] print:text-[9.5px] text-slate-900">
                      <span>TOTAL RECEIPTS</span>
                      <span className="text-emerald-700 font-black tabular-nums">{formatMoney(report.receipts.total)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="print:border print:border-slate-300 print:shadow-none print:break-inside-avoid print:p-1.5">
              <CardHeader className="flex flex-row items-center justify-between pb-3 print:pb-1 print:border-b print:border-slate-300">
                <CardTitle className="text-base font-bold print:text-xs">4. Money Paid & Expenses (ادائیگیاں)</CardTitle>
                <span className="font-bold text-xs text-rose-600 tabular-nums print:text-[11px]">
                  {formatMoney(report.disbursements.total + report.expenses.total)}
                </span>
              </CardHeader>
              <CardContent className="print:p-0">
                <div className="space-y-2 print:space-y-0.5 text-xs print:text-[9.5px] divide-y divide-slate-100 dark:divide-slate-800 print:divide-slate-200">
                  {report.expenses.items.map((exp: any) => (
                    <div key={exp.id} className="flex justify-between py-2 px-2 print:py-1 print:px-1">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white print:text-[9.5px]">
                          <span className="text-rose-600 font-bold mr-1">[{exp.category?.name || "Expense"}]</span>
                          {exp.description}
                        </p>
                        <p className="text-[10px] text-slate-500 print:text-[8px]">
                          Paid via <span className="font-medium text-slate-700 dark:text-slate-300">{exp.paymentMethod || "CASH"}</span>
                          {exp.paidTo ? ` • Paid to: ${exp.paidTo}` : ""}
                        </p>
                      </div>
                      <p className="font-bold text-rose-600 tabular-nums print:text-[9.5px]">-{formatMoney(exp.amount)}</p>
                    </div>
                  ))}
                  {report.disbursements.items.map((d: any) => {
                    const matchedPurchase = (report.purchases.items || []).find(
                      (p: any) => p.purchaseNumber === d.referenceNumber || (d.allocations && d.allocations.some((al: any) => al.purchase?.purchaseNumber === p.purchaseNumber))
                    );
                    const purchaseItems = matchedPurchase?.items || (d.allocations?.[0]?.purchase?.items) || [];
                    const purchaseItemSummary = purchaseItems.length > 0
                      ? `${purchaseItems.reduce((acc: number, it: any) => acc + Number(it.quantity || 0), 0)} units (${purchaseItems.map((it: any) => `${Number(it.quantity)}x ${it.productName || it.name}`).slice(0, 2).join(", ")}${purchaseItems.length > 2 ? "..." : ""})`
                      : "";

                    return (
                      <div key={d.id} className="flex justify-between py-2 px-2 print:py-1 print:px-1">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white print:text-[9.5px]">Vendor: {d.partyName}</p>
                          <p className="text-[10px] text-slate-500 print:text-[8px]">
                            <span className="font-medium text-slate-700 dark:text-slate-300">{d.paymentMethod}</span>
                            {" • "}
                            <span className="font-mono text-indigo-600 dark:text-indigo-400">{d.referenceNumber || "Supplier Bill"}</span>
                          </p>
                          {purchaseItemSummary && (
                            <p className="text-[10px] text-indigo-700 dark:text-indigo-300 font-semibold mt-0.5 print:text-[8px]">
                              📦 For: {purchaseItemSummary}
                            </p>
                          )}
                        </div>
                        <p className="font-bold text-rose-600 tabular-nums print:text-[9.5px]">-{formatMoney(d.amount)}</p>
                      </div>
                    );
                  })}
                  {report.expenses.items.length === 0 && report.disbursements.items.length === 0 && (
                    <p className="text-xs text-slate-400 italic py-3 px-2 print:py-1 print:text-[9px]">No disbursements or expenses recorded.</p>
                  )}
                  <div className="flex justify-between py-2 px-2 print:py-1 print:px-1 bg-slate-50/70 print:bg-transparent border-t-2 border-slate-900 font-bold text-[11px] print:text-[9.5px] text-slate-900">
                    <span>TOTAL DISBURSED & EXPENSES</span>
                    <span className="text-rose-700 font-black tabular-nums">-{formatMoney(report.disbursements.total + report.expenses.total)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Section 5: Stock Movements Today */}
          <Card className={`print:border print:border-slate-300 print:shadow-none print:break-inside-avoid print:p-1.5 ${report.stockMovements.length === 0 ? "print:hidden" : ""}`}>
            <CardHeader className="pb-3 print:pb-1 print:border-b print:border-slate-300">
              <CardTitle className="text-base font-bold print:text-xs">5. Inventory Movements Logged Today (اسٹاک حرکت رجسٹر)</CardTitle>
            </CardHeader>
            <CardContent className="print:p-0">
              {report.stockMovements.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-3 px-2 print:py-1 print:text-[9px]">No inventory movements recorded on this date.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse print:text-[9.5px]">
                    <thead className="border-b text-[10px] font-bold uppercase text-slate-400 print:text-black print:border-slate-400">
                      <tr>
                        <th className="pb-2 print:pb-1">Time</th>
                        <th className="pb-2 print:pb-1">Product Name</th>
                        <th className="pb-2 print:pb-1">Movement Type</th>
                        <th className="pb-2 print:pb-1 text-center">Quantity Delta</th>
                        <th className="pb-2 print:pb-1">Reference / Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-slate-200">
                      {report.stockMovements.map((m: any) => (
                        <tr key={m.id}>
                          <td className="py-2 print:py-1 text-slate-400 print:text-slate-600">{new Date(m.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                          <td className="py-2 print:py-1 font-semibold text-slate-900 dark:text-white">{m.product?.name}</td>
                          <td className="py-2 print:py-1">
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold dark:bg-slate-800 print:bg-transparent print:border print:border-slate-300 print:px-1 print:py-0 print:text-[8.5px]">
                              {m.type}
                            </span>
                          </td>
                          <td className="py-2 print:py-1 text-center font-bold tabular-nums">
                            {["STOCK_IN", "PURCHASE", "OPENING", "SALE_RETURN"].includes(m.type) ? "+" : "-"}
                            {m.quantity}
                          </td>
                          <td className="py-2 print:py-1 text-slate-500">{m.notes || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-slate-900 text-[11px] font-bold text-slate-900 bg-slate-50/70 print:bg-transparent">
                      <tr>
                        <td colSpan={3} className="py-2 print:py-1 px-1 font-bold">TOTAL STOCK ENTRIES TODAY</td>
                        <td className="py-2 print:py-1 text-center font-black tabular-nums">{report.stockMovements.length} logged</td>
                        <td className="py-2 print:py-1 text-slate-500 font-normal">Reconciled with inventory warehouse</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Printable Official Signatures & System Footer */}
          <ReportPrintFooter notes="Daily business closing statement audited and balanced across sales, counter receipts, vendor disbursements, operational expenses, and physical stock movement." />

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
