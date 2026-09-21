"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Printer, Download, ArrowLeft, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { formatMoney } from "@/lib/decimal";
import { BrandPageLoader, TableSkeleton } from "@/components/ui/loader";

export default function ReceivablesSummaryPage() {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reports/receivables-summary");
      const json = await res.json();
      if (json.success) setReport(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (!report) return;
    let csv = "A/C CODE,A/C NAME,DEBIT AMT,CREDIT AMT,TELEPHONE #\n";
    for (const it of report.items) {
      csv += `"${it.acCode}","${it.acName}",${it.debitAmt.toFixed(2)},${it.creditAmt.toFixed(2)},"${it.telephone}"\n`;
    }
    csv += `"TOTALS: ${report.totals.count}","TOTALS",${report.totals.totalDebit.toFixed(2)},${report.totals.totalCredit.toFixed(2)},""\n`;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Accounts_Receivables_Summary.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatPrintDate = (isoStr?: string) => {
    const d = isoStr ? new Date(isoStr) : new Date();
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const seconds = String(d.getSeconds()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds} ${ampm}`;
  };

  const formatAmt = (num: number) => {
    if (!num || num === 0) return "";
    return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  if (loading && !report) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto pb-12">
        <BrandPageLoader
          message="Loading Receivables Summary..."
          submessage="Auditing customer ledger balances, outstanding credit invoices, and overdue aging..."
        />
        <TableSkeleton rows={6} cols={5} />
      </div>
    );
  }

  const filteredItems = report?.items.filter((it: any) => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return it.acName.toLowerCase().includes(s) || it.acCode.toLowerCase().includes(s) || (it.telephone && it.telephone.includes(s));
  }) || [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Screen Controls (Hidden during print) */}
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
              Accounts Receivables Summary
            </h2>
            <p className="text-xs text-slate-500">Customer account balances, debits, credits, and contact directory</p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search party or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-48 rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <Button variant="outline" size="sm" onClick={fetchReport} title="Refresh">
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
          </Button>
          <Button size="sm" onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Printer className="h-3.5 w-3.5 mr-1" /> Print Sheet
          </Button>
        </div>
      </div>

      {loading || !report ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 dark:border-slate-800 dark:bg-slate-900 shadow-sm">
          <BrandPageLoader
            message="Compiling Accounts Receivables..."
            submessage="Reconciling customer ledger balances, pending debits, and credit terms..."
          />
        </div>
      ) : (
        /* Printable Document Container (Matches Client Physical Sheet) */
        <div className="bg-white text-slate-900 p-8 rounded-xl border border-slate-200 shadow-sm print:border-none print:shadow-none print:p-0 font-sans">
          {/* Header */}
          <div className="flex justify-between items-start text-xs border-b border-slate-200 pb-2 mb-2">
            <div>
              <p className="text-[11px] text-slate-500">Printing Date/Time: {formatPrintDate(report.printingTime)}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-slate-500">Page No: 1</p>
            </div>
          </div>

          <div className="mb-4">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 uppercase">
              {report.businessName || "HANIF"}
            </h1>
            <h2 className="text-sm font-semibold tracking-wide text-slate-800 uppercase mt-0.5">
              ACCOUNTS RECEIVABLES SUMMARY
            </h2>
          </div>

          {/* Table */}
          <div className="w-full">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-t border-b border-slate-400 text-[11px] font-bold text-slate-900">
                  <th className="py-1.5 pr-3 uppercase tracking-wider font-semibold w-24">A/C CODE</th>
                  <th className="py-1.5 px-3 uppercase tracking-wider font-semibold">A/C NAME</th>
                  <th className="py-1.5 px-3 text-right uppercase tracking-wider font-semibold w-32">DEBIT AMT.</th>
                  <th className="py-1.5 px-3 text-right uppercase tracking-wider font-semibold w-32">CREDIT AMT.</th>
                  <th className="py-1.5 pl-3 text-right uppercase tracking-wider font-semibold w-32">TELEPHONE #</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item: any) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/70 text-[11px] transition-colors"
                  >
                    <td className="py-1 pr-3 font-mono font-medium text-slate-700 uppercase">
                      {item.acCode}
                    </td>
                    <td className="py-1 px-3 font-semibold text-slate-900 uppercase">
                      {item.acName}
                    </td>
                    <td className="py-1 px-3 text-right tabular-nums text-slate-900">
                      {formatAmt(item.debitAmt)}
                    </td>
                    <td className="py-1 px-3 text-right tabular-nums text-emerald-700">
                      {formatAmt(item.creditAmt)}
                    </td>
                    <td className="py-1 pl-3 text-right font-mono text-slate-600 text-[10px]">
                      {item.telephone}
                    </td>
                  </tr>
                ))}

                {/* Totals Row */}
                <tr className="border-t-2 border-b-2 border-slate-900 font-bold text-xs text-slate-900 bg-slate-50 print:bg-transparent">
                  <td className="py-2 pr-3 uppercase">
                    TOTALS: {report.totals.count}
                  </td>
                  <td className="py-2 px-3"></td>
                  <td className="py-2 px-3 text-right tabular-nums font-bold">
                    {formatAmt(report.totals.totalDebit)}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums font-bold text-emerald-700">
                    {formatAmt(report.totals.totalCredit)}
                  </td>
                  <td className="py-2 pl-3 text-right font-semibold text-blue-700">
                    Net: {formatMoney(report.totals.netReceivable)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
