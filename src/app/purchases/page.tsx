"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/decimal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Search, Eye, Download, UploadCloud, FileSpreadsheet } from "lucide-react";
import { TableRowsSkeleton } from "@/components/ui/loader";

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchPurchases = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/purchases");
      const json = await res.json();
      if (json.success) setPurchases(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, []);

  const exportPurchasesCsv = () => {
    if (purchases.length === 0) {
      alert("No purchase bills available to export.");
      return;
    }
    const headers = [
      "Purchase Number",
      "Date",
      "Supplier Name",
      "Total Amount",
      "Paid Amount",
      "Payable Balance",
      "Payment Status",
      "Payment Method",
      "Items Count",
    ];
    const rows = purchases.map((p) => [
      `"${p.purchaseNumber || ""}"`,
      `"${new Date(p.date).toISOString().slice(0, 10)}"`,
      `"${(p.supplierName || "").replace(/"/g, '""')}"`,
      Number(p.totalAmount || 0),
      Number(p.paidAmount || 0),
      Number(p.remainingAmount || 0),
      `"${p.paymentStatus || "UNPAID"}"`,
      `"${p.paymentMethod || "CASH"}"`,
      p.items?.length || 1,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `purchase_bills_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filtered = purchases.filter(
    (p) =>
      p.purchaseNumber?.toLowerCase().includes(search.toLowerCase()) ||
      p.supplierName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Purchases & Inward Stock</h2>
          <p className="text-xs text-slate-500">Manage supplier bills, inward stock additions, and payables</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Download / Export CSV */}
          <button
            onClick={exportPurchasesCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            title="Export all purchase bills to CSV file"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          {/* Bulk Import CSV */}
          <Link
            href="/purchases/import"
            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-2 text-xs font-semibold text-indigo-700 shadow-xs hover:bg-indigo-100 transition dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-300"
          >
            <UploadCloud className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Bulk Import (CSV)</span>
          </Link>

          {/* Add Purchase (Primary Button) */}
          <Link href="/purchases/create">
            <Button variant="primary" size="md" className="gap-1.5 shadow-sm">
              <Plus className="h-4 w-4" />
              <span>Add Purchase</span>
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by purchase # or supplier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-slate-50 pl-9 pr-3 py-1.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Purchase #</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3 text-right">Total Cost</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-right">Payable Balance</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <TableRowsSkeleton rows={6} cols={7} />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-slate-400">
                    No purchase bills found. Click "Record Purchase Bill" to add incoming stock.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-semibold text-blue-600 dark:text-blue-400">
                      {p.purchaseNumber}
                    </td>
                    <td className="px-4 py-3">{new Date(p.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{p.supplierName}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white tabular-nums">
                      {formatMoney(p.totalAmount)}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-600 font-semibold tabular-nums">
                      {formatMoney(p.paidAmount)}
                    </td>
                    <td className="px-4 py-3 text-right text-rose-600 font-semibold tabular-nums">
                      {formatMoney(p.remainingAmount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={p.paymentStatus === "PAID" ? "success" : p.paymentStatus === "PARTIAL" ? "warning" : "danger"}>
                        {p.paymentStatus}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
