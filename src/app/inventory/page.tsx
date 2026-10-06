"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/decimal";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, AlertTriangle, ArrowUpDown, Download, Package, Plus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { TableRowsSkeleton } from "@/components/ui/loader";
import { smartFetch, invalidateCache } from "@/lib/clientCache";

export default function InventoryPage() {
  const { user, activeCompany, branches, selectedBranch, activeBranchId, isBranchLocked } = useAuth();
  const { t } = useLanguage();

  const [products, setProducts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"PRODUCTS" | "ALERTS" | "MOVEMENTS">("PRODUCTS");

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (activeCompany?.id) headers["x-business-id"] = activeCompany.id;
      const branchToPass = isBranchLocked ? user?.branchId : activeBranchId;
      if (branchToPass) headers["x-branch-id"] = branchToPass;

      const json = await smartFetch("/api/products?limit=1000", { headers, ttlMs: 20000 });
      const list = json.products || json.data || [];
      setProducts(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error("Failed to load products:", e);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    setTxLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (activeCompany?.id) headers["x-business-id"] = activeCompany.id;
      const branchToPass = isBranchLocked ? user?.branchId : activeBranchId;
      if (branchToPass) headers["x-branch-id"] = branchToPass;

      const json = await smartFetch("/api/inventory/transactions", { headers, ttlMs: 20000 });
      setTransactions(Array.isArray(json.data) ? json.data : []);
    } catch (e) {
      console.error("Failed to load inventory transactions:", e);
      setTransactions([]);
    } finally {
      setTxLoading(false);
    }
  };

  const [totalReceivables, setTotalReceivables] = useState<number>(0);
  const [totalPayables, setTotalPayables] = useState<number>(0);

  const fetchAccountsSummary = async () => {
    try {
      const headers: Record<string, string> = {};
      if (activeCompany?.id) headers["x-business-id"] = activeCompany.id;
      const res = await smartFetch("/api/dashboard", { headers, ttlMs: 30000 });
      if (res?.success && res?.data) {
        setTotalReceivables(Number(res.data.totalReceivables || 0));
        setTotalPayables(Number(res.data.totalPayables || 0));
      }
    } catch {}
  };

  useEffect(() => {
    fetchProducts();
    fetchAccountsSummary();
  }, [activeCompany?.id, activeBranchId, isBranchLocked, user?.branchId]);

  // SMART LAZY LOAD: Only hit transactions endpoint when user opens the MOVEMENTS tab
  useEffect(() => {
    if (activeTab === "MOVEMENTS") {
      fetchTransactions();
    }
  }, [activeTab, activeCompany?.id, activeBranchId]);

  const safeProducts = Array.isArray(products) ? products : [];

  const filtered = safeProducts.filter(
    (p) =>
      p?.name?.toLowerCase().includes(search.toLowerCase()) ||
      (p?.sku && p.sku.toLowerCase().includes(search.toLowerCase())) ||
      (p?.barcode && p.barcode.toLowerCase().includes(search.toLowerCase()))
  );

  const lowStock = safeProducts.filter((p) => Number(p?.currentStock || 0) <= Number(p?.minStockLevel || 0));
  const totalValuation = safeProducts.reduce(
    (acc, p) => acc + (Number(p?.currentStock || 0) * Number(p?.averageCost || p?.purchasePrice || 0)),
    0
  );

  const exportCSV = () => {
    const headers = "Product Name,SKU,Barcode,Current Stock,Unit,Average Cost,Selling Price,Total Valuation\n";
    const rows = safeProducts
      .map(
        (p) =>
          `"${p.name || ""}","${p.sku || ""}","${p.barcode || ""}",${p.currentStock || 0},"${p.unit || p.uom || "pcs"}",${p.averageCost || p.purchasePrice || 0},${p.sellingPrice || 0},${
            Number(p.currentStock || 0) * Number(p.averageCost || p.purchasePrice || 0)
          }`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Products & Inventory Ledger
            </h2>
            <span className="rounded-md bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[11px] font-bold text-indigo-700 dark:bg-indigo-950/50 dark:border-indigo-800 dark:text-indigo-300">
              {activeCompany?.name || "Active Company"}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Total Inventory Value: <span className="font-bold text-blue-600 dark:text-blue-400">{formatMoney(totalValuation)}</span> across{" "}
            {safeProducts.length} products
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/products/create">
            <Button variant="primary" size="sm">
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Inventory
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-3.5 w-3.5 mr-1" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stock & Accounts Totals Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-2xs dark:border-indigo-900/40 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Inventories Valuation</span>
            <span className="rounded-lg bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">📦</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-indigo-950 dark:text-white font-mono">
              {formatMoney(totalValuation)}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Live inventory across {safeProducts.length} items</p>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-2xs dark:border-emerald-900/40 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Customer Receivables</span>
            <span className="rounded-lg bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">📥</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-emerald-950 dark:text-white font-mono">
              {formatMoney(totalReceivables)}
            </span>
          </div>
          <Link href="/customers" className="mt-1 inline-block text-[11px] text-emerald-600 hover:underline">
            View customer ledgers →
          </Link>
        </div>

        <div className="rounded-2xl border border-rose-100 bg-white p-4 shadow-2xs dark:border-rose-900/40 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Supplier Payables</span>
            <span className="rounded-lg bg-rose-50 p-2 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">📤</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-rose-950 dark:text-white font-mono">
              {formatMoney(totalPayables)}
            </span>
          </div>
          <Link href="/suppliers" className="mt-1 inline-block text-[11px] text-rose-600 hover:underline">
            View supplier dues →
          </Link>
        </div>
      </div>

      {/* Tabs & Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("PRODUCTS")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === "PRODUCTS"
                ? "bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-400"
            }`}
          >
            All Products ({safeProducts.length})
          </button>
          <button
            onClick={() => setActiveTab("ALERTS")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTab === "ALERTS"
                ? "bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-400"
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            <span>Low Stock Alerts ({lowStock.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("MOVEMENTS")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTab === "MOVEMENTS"
                ? "bg-purple-50 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-400"
            }`}
          >
            <ArrowUpDown className="h-3.5 w-3.5 text-purple-500" />
            <span>Stock Movements & Audit ({transactions.length})</span>
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, SKU, barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-slate-50 pl-9 pr-3 py-1.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
      </div>

      {/* Products & Movements Tables */}
      {activeTab === "MOVEMENTS" ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Product Name</th>
                  <th className="px-4 py-3 text-center">Movement Type</th>
                  <th className="px-4 py-3 text-center">Quantity</th>
                  <th className="px-4 py-3">{t("Branch", "برانچ")}</th>
                  <th className="px-4 py-3">Adjusted / Handled By</th>
                  <th className="px-4 py-3">Reason & Audit Memo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {txLoading ? (
                  <TableRowsSkeleton rows={6} cols={7} />
                ) : transactions.filter((t) => {
                    if (!search.trim()) return true;
                    const q = search.toLowerCase();
                    const prodName = (t.product?.name || t.productName || "").toLowerCase();
                    const notes = (t.notes || "").toLowerCase();
                    const reason = (t.reason || "").toLowerCase();
                    const creator = (t.createdByName || "").toLowerCase();
                    const br = (t.branch?.name || t.branchName || "").toLowerCase();
                    return prodName.includes(q) || notes.includes(q) || reason.includes(q) || creator.includes(q) || br.includes(q);
                  }).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-xs text-slate-400">
                      No stock movement transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  transactions
                    .filter((t) => {
                      if (!search.trim()) return true;
                      const q = search.toLowerCase();
                      const prodName = (t.product?.name || t.productName || "").toLowerCase();
                      const notes = (t.notes || "").toLowerCase();
                      const reason = (t.reason || "").toLowerCase();
                      const creator = (t.createdByName || "").toLowerCase();
                      const br = (t.branch?.name || t.branchName || "").toLowerCase();
                      return prodName.includes(q) || notes.includes(q) || reason.includes(q) || creator.includes(q) || br.includes(q);
                    })
                    .map((t) => {
                      const isPositive = Number(t.quantity || 0) > 0;
                      const isAdj = t.type === "ADJUSTMENT";
                      const isDamage = t.type === "DAMAGE";
                      const isSale = t.type === "SALE";
                      const isPurchase = t.type === "PURCHASE" || t.type === "STOCK_IN";
                      const branchName = t.branch?.name || t.branchName || "Main Warehouse";
                      const creatorName = t.createdByName || "Muhammad Hanif";

                      return (
                        <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                            {new Date(t.date || t.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                            {t.product?.name || t.productName || "Product"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge
                              variant={
                                isAdj ? "default" : isDamage ? "danger" : isPurchase ? "success" : isSale ? "secondary" : "default"
                              }
                            >
                              {t.type}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-center font-bold">
                            <span
                              className={`rounded-md px-2 py-0.5 text-xs ${
                                isPositive
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                  : "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                              }`}
                            >
                              {isPositive ? "+" : ""}
                              {Number(t.quantity || 0)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              <Package className="h-3 w-3 text-slate-400" />
                              {branchName}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 uppercase">
                                {creatorName.charAt(0)}
                              </div>
                              <span className="font-medium text-slate-800 dark:text-slate-200">
                                {creatorName}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-500 max-w-xs truncate" title={t.notes || "—"}>
                            {t.notes || (t.reason ? `Reason: ${t.reason}` : "—")}
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Product Name</th>
                  <th className="px-4 py-3">SKU / Barcode</th>
                  <th className="px-4 py-3 text-center">In Stock</th>
                  <th className="px-4 py-3 text-right">Avg Cost</th>
                  <th className="px-4 py-3 text-right">Selling Price</th>
                  <th className="px-4 py-3 text-right">Total Valuation</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Inward / Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <TableRowsSkeleton rows={6} cols={8} />
                ) : (activeTab === "ALERTS" ? lowStock : filtered).length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-xs text-slate-400">
                      No products found matching the criteria.
                    </td>
                  </tr>
                ) : (
                  (activeTab === "ALERTS" ? lowStock : filtered).map((p) => {
                    const currentStockNum = Number(p.currentStock || 0);
                    const minStockNum = Number(p.minStockLevel || 0);
                    const isLow = currentStockNum <= minStockNum;
                    const unitCost = Number(p.averageCost || p.purchasePrice || 0);

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{p.name}</td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                          {p.sku || p.barcode || "—"}
                        </td>
                        <td className="px-4 py-3 text-center font-bold">
                          <span
                            className={`rounded-md px-2 py-0.5 text-xs ${
                              isLow
                                ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                                : "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                            }`}
                          >
                            {currentStockNum} {p.unit || p.uom || "pcs"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatMoney(unitCost)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white tabular-nums">
                          {formatMoney(p.sellingPrice || p.retailPrice || 0)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                          {formatMoney(currentStockNum * unitCost)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={isLow ? "danger" : "success"}>
                            {isLow ? "Low Stock" : "In Stock"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/purchases/create?productId=${p.id}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs font-semibold hover:bg-indigo-50 hover:text-indigo-700 transition"
                              title={t("Inward / Buy stock via verified Purchase Bill", "پرچیز بل کے ذریعے اسٹاک خریدیں")}
                            >
                              <Plus className="h-3.5 w-3.5 mr-1 text-indigo-600" />
                              Purchase Bill
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
