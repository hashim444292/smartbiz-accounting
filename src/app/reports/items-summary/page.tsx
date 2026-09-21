"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Printer, Download, ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import { BrandPageLoader, TableSkeleton } from "@/components/ui/loader";

export default function ItemsSummaryPage() {
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/items-summary?start=${startDate}&end=${endDate}`);
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
  }, [startDate, endDate]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (!report) return;
    let csv = "CATEGORY,DESCRIPTION,OP,IN,OUT,BAL\n";
    for (const cat of report.categories) {
      for (const it of cat.items) {
        csv += `"${cat.name}","${it.description}",${it.op},${it.in},${it.out},${it.bal}\n`;
      }
      csv += `"${cat.name} TOTAL","TOTAL: ${cat.totals.count}",${cat.totals.op},${cat.totals.in},${cat.totals.out},${cat.totals.bal}\n`;
    }
    csv += `"GRAND TOTAL","TOTAL: ${report.grandTotal.totalItems}",${report.grandTotal.op},${report.grandTotal.in},${report.grandTotal.out},${report.grandTotal.bal}\n`;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Items_Summary_${startDate}_to_${endDate}.csv`);
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

  const formatDateDisplay = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  };

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
              Items Summary Report
            </h2>
            <p className="text-xs text-slate-500">Opening, stock in, stock out, and closing balance by category</p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <div className="flex items-center gap-1.5 text-xs">
            <label className="text-slate-500 font-medium">From:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <label className="text-slate-500 font-medium">To:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <Button variant="outline" size="sm" onClick={fetchReport} title="Refresh Data">
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
            message="Compiling Item Movement Summary..."
            submessage="Calculating opening, incoming, outgoing and closing stock balances by category..."
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
              ITEMS SUMMARY
            </h2>
            <p className="text-xs font-medium text-slate-700 mt-0.5">
              FROM {formatDateDisplay(startDate)} TO {formatDateDisplay(endDate)}
            </p>
          </div>

          {/* Table */}
          <div className="w-full">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-t border-b border-slate-400 text-[11px] font-bold text-slate-900">
                  <th className="py-1.5 pr-4 uppercase tracking-wider font-semibold">DESCRIPTION</th>
                  <th className="py-1.5 px-3 text-right uppercase tracking-wider font-semibold w-16">OP.</th>
                  <th className="py-1.5 px-3 text-right uppercase tracking-wider font-semibold w-16">IN</th>
                  <th className="py-1.5 px-3 text-right uppercase tracking-wider font-semibold w-16">OUT</th>
                  <th className="py-1.5 pl-3 text-right uppercase tracking-wider font-semibold w-20">BAL.</th>
                </tr>
              </thead>
              <tbody>
                {report.categories.map((category: any) => (
                  <React.Fragment key={category.name}>
                    {/* Category Title Row */}
                    <tr className="bg-slate-50/50 print:bg-transparent">
                      <td colSpan={5} className="pt-3 pb-1 font-bold text-[11px] italic text-slate-900 uppercase tracking-wide">
                        {category.name}
                      </td>
                    </tr>

                    {/* Product Rows */}
                    {category.items.map((item: any) => (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50/70 border-b border-slate-100 text-[11px] transition-colors"
                      >
                        <td className="py-1 pr-4 font-mono font-normal text-slate-800 uppercase">
                          {item.description}
                        </td>
                        <td className="py-1 px-3 text-right tabular-nums text-slate-700">{item.op}</td>
                        <td className="py-1 px-3 text-right tabular-nums text-slate-700">{item.in}</td>
                        <td className="py-1 px-3 text-right tabular-nums text-slate-700">{item.out}</td>
                        <td className="py-1 pl-3 text-right tabular-nums font-semibold text-slate-900">{item.bal}</td>
                      </tr>
                    ))}

                    {/* Category Subtotal Row */}
                    <tr className="border-t border-b border-slate-300 font-bold text-[11px] text-slate-900">
                      <td className="py-1.5 pr-4 uppercase">
                        TOTAL: {category.totals.count}
                      </td>
                      <td className="py-1.5 px-3 text-right tabular-nums">{category.totals.op}</td>
                      <td className="py-1.5 px-3 text-right tabular-nums">{category.totals.in}</td>
                      <td className="py-1.5 px-3 text-right tabular-nums">{category.totals.out}</td>
                      <td className="py-1.5 pl-3 text-right tabular-nums">{category.totals.bal}</td>
                    </tr>
                  </React.Fragment>
                ))}

                {/* Grand Total Row */}
                <tr className="border-t-2 border-b-2 border-slate-900 font-black text-xs text-slate-900 bg-slate-100/50 print:bg-transparent">
                  <td className="py-2 pr-4 uppercase tracking-wider">
                    TOTAL: {report.grandTotal.totalItems}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums">{report.grandTotal.op}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{report.grandTotal.in}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{report.grandTotal.out}</td>
                  <td className="py-2 pl-3 text-right tabular-nums text-blue-700 font-black">{report.grandTotal.bal}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
