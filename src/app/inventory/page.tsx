"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/decimal";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, AlertTriangle, ArrowUpDown, Download, Package, Plus, Flame, X, CheckCircle2, ExternalLink } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { TableRowsSkeleton } from "@/components/ui/loader";
import { smartFetch, invalidateCache, useAutoSync } from "@/lib/clientCache";
import { getProductEffectiveCost } from "@/lib/accountingConstants";

export default function InventoryPage() {
  const { user, activeCompany, branches, selectedBranch, activeBranchId, isBranchLocked } = useAuth();
  const { t } = useLanguage();

  const [products, setProducts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"PRODUCTS" | "ALERTS" | "MOVEMENTS">("PRODUCTS");

  // Stock Damage, Theft & Loss Modal State
  const [showDamageModal, setShowDamageModal] = useState(false);
  const [damageProductId, setDamageProductId] = useState("");
  const [damageQty, setDamageQty] = useState<number | "">("");
  const [damageReason, setDamageReason] = useState<"DAMAGE" | "WRITE_OFF" | "EXPIRY" | "PHYSICAL_COUNT" | "OTHER">("DAMAGE");
  const [damageNotes, setDamageNotes] = useState("");
  const [damageDate, setDamageDate] = useState(new Date().toISOString().split("T")[0]);
  const [damageSubmitting, setDamageSubmitting] = useState(false);
  const [damageSuccessMsg, setDamageSuccessMsg] = useState("");
  const [damageErrorMsg, setDamageErrorMsg] = useState("");

  const openDamageModal = (productId = "") => {
    setDamageProductId(productId);
    setDamageQty("");
    setDamageReason("DAMAGE");
    setDamageNotes("");
    setDamageDate(new Date().toISOString().split("T")[0]);
    setDamageErrorMsg("");
    setDamageSuccessMsg("");
    setShowDamageModal(true);
  };

  const fetchProducts = async (skipCache = false, isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (activeCompany?.id) headers["x-business-id"] = activeCompany.id;
      const branchToPass = isBranchLocked ? user?.branchId : activeBranchId;
      if (branchToPass) headers["x-branch-id"] = branchToPass;

      const json = await smartFetch("/api/products?limit=1000", {
        headers,
        ttlMs: skipCache ? 0 : 5000,
        skipCache,
      });
      const list = json.products || json.data || [];
      setProducts(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error("Failed to load products:", e);
      setProducts([]);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  const fetchTransactions = async (skipCache = false, isSilent = false) => {
    if (!isSilent) setTxLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (activeCompany?.id) headers["x-business-id"] = activeCompany.id;
      const branchToPass = isBranchLocked ? user?.branchId : activeBranchId;
      if (branchToPass) headers["x-branch-id"] = branchToPass;

      const json = await smartFetch("/api/inventory/transactions", {
        headers,
        ttlMs: skipCache ? 0 : 5000,
        skipCache,
      });
      setTransactions(Array.isArray(json.data) ? json.data : []);
    } catch (e) {
      console.error("Failed to load inventory transactions:", e);
      setTransactions([]);
    } finally {
      if (!isSilent) setTxLoading(false);
    }
  };

  const [totalReceivables, setTotalReceivables] = useState<number>(0);
  const [totalPayables, setTotalPayables] = useState<number>(0);

  const fetchAccountsSummary = async (skipCache = false) => {
    try {
      const headers: Record<string, string> = {};
      if (activeCompany?.id) headers["x-business-id"] = activeCompany.id;
      const res = await smartFetch("/api/dashboard", {
        headers,
        ttlMs: skipCache ? 0 : 5000,
        skipCache,
      });
      if (res?.success && res?.data) {
        setTotalReceivables(Number(res.data.totalReceivables || 0));
        setTotalPayables(Number(res.data.totalPayables || 0));
      }
    } catch {}
  };

  useEffect(() => {
    fetchProducts(true);
    fetchAccountsSummary(true);
  }, [activeCompany?.id, activeBranchId, isBranchLocked, user?.branchId]);

  // Real-time silent auto-sync across tabs & mutations: immediately update inventory & payables on purchase/sale
  useAutoSync((opts) => {
    const isSilent = opts?.silent ?? true;
    fetchProducts(true, isSilent);
    fetchAccountsSummary(true);
    if (activeTab === "MOVEMENTS") {
      fetchTransactions(true, isSilent);
    }
  });

  // SMART LAZY LOAD: Only hit transactions endpoint when user opens the MOVEMENTS tab
  useEffect(() => {
    if (activeTab === "MOVEMENTS") {
      fetchTransactions(true);
    }
  }, [activeTab, activeCompany?.id, activeBranchId]);

  const safeProducts = useMemo(() => (Array.isArray(products) ? products : []), [products]);

  const filtered = useMemo(() => {
    if (!search.trim()) return safeProducts;
    const q = search.toLowerCase();
    return safeProducts.filter(
      (p) =>
        p?.name?.toLowerCase().includes(q) ||
        (p?.sku && p.sku.toLowerCase().includes(q)) ||
        (p?.barcode && p.barcode.toLowerCase().includes(q))
    );
  }, [safeProducts, search]);

  const lowStock = useMemo(
    () => safeProducts.filter((p) => Number(p?.currentStock || 0) <= Number(p?.minStockLevel || 0)),
    [safeProducts]
  );

  const totalValuation = useMemo(
    () =>
      safeProducts.reduce(
        (acc, p) => acc + Number(p?.currentStock || 0) * getProductEffectiveCost(p),
        0
      ),
    [safeProducts]
  );

  const filteredTransactions = useMemo(() => {
    if (!search.trim()) return transactions;
    const q = search.toLowerCase();
    return transactions.filter((t) => {
      const prodName = (t.product?.name || t.productName || "").toLowerCase();
      const notes = (t.notes || "").toLowerCase();
      const reason = (t.reason || "").toLowerCase();
      const creator = (t.createdByName || "").toLowerCase();
      const br = (t.branch?.name || t.branchName || "").toLowerCase();
      return prodName.includes(q) || notes.includes(q) || reason.includes(q) || creator.includes(q) || br.includes(q);
    });
  }, [transactions, search]);

  const exportCSV = () => {
    const headers = "Product Name,SKU,Barcode,Current Stock,Unit,Average Cost,Selling Price,Total Valuation\n";
    const rows = safeProducts
      .map((p) => {
        const unitCost = getProductEffectiveCost(p);
        const currentStockNum = Number(p.currentStock || 0);
        return `"${p.name || ""}","${p.sku || ""}","${p.barcode || ""}",${currentStockNum},"${p.unit || p.uom || "pcs"}",${unitCost},${p.sellingPrice || 0},${
          currentStockNum * unitCost
        }`;
      })
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const selectedDamageProduct = useMemo(
    () => safeProducts.find((p) => p.id === damageProductId),
    [safeProducts, damageProductId]
  );
  const damageUnitCost = selectedDamageProduct ? getProductEffectiveCost(selectedDamageProduct) : 0;
  const currentDamageStock = Number(selectedDamageProduct?.currentStock || 0);
  const damageQtyNum = Number(damageQty || 0);
  const damageTotalLoss = damageQtyNum * damageUnitCost;
  const damageNewStock = Math.max(0, currentDamageStock - damageQtyNum);

  const handleRecordDamage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!damageProductId) {
      setDamageErrorMsg("Please select a product.");
      return;
    }
    const qty = Number(damageQty);
    if (!qty || qty <= 0) {
      setDamageErrorMsg("Please enter a valid quantity greater than zero.");
      return;
    }
    const prod = safeProducts.find((p) => p.id === damageProductId);
    if (prod && qty > Number(prod.currentStock || 0)) {
      setDamageErrorMsg(`Deduct quantity (${qty}) cannot exceed current stock (${prod.currentStock}).`);
      return;
    }

    setDamageSubmitting(true);
    setDamageErrorMsg("");
    setDamageSuccessMsg("");

    try {
      const res = await fetch("/api/products/adjust", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(activeCompany?.id ? { "x-business-id": activeCompany.id } : {}),
          ...(activeBranchId ? { "x-branch-id": activeBranchId } : {}),
        },
        body: JSON.stringify({
          productId: damageProductId,
          deductQuantity: qty,
          reason: damageReason,
          notes: damageNotes || `${damageReason === "DAMAGE" ? "Broken / Damaged stock" : damageReason === "EXPIRY" ? "Expired goods" : damageReason === "WRITE_OFF" ? "Stolen / Lost inventory" : "Stock write-down"} recorded by user`,
          date: damageDate ? new Date(damageDate) : new Date(),
          branchId: activeBranchId || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setDamageSuccessMsg(`Successfully recorded loss of ${qty} units. Stock reduced and financial loss debited to Account 5020.`);
        invalidateCache("/api/products");
        invalidateCache("/api/inventory/transactions");
        invalidateCache("/api/dashboard");
        fetchProducts(true);
        fetchTransactions(true);
        setTimeout(() => {
          setShowDamageModal(false);
          setDamageSuccessMsg("");
        }, 1600);
      } else {
        setDamageErrorMsg(json.error || "Failed to record stock damage.");
      }
    } catch (err: any) {
      setDamageErrorMsg(err.message || "Network error");
    } finally {
      setDamageSubmitting(false);
    }
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => openDamageModal("")}
            className="border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/40"
            title={t("Record Damaged, Broken or Stolen Stock", "خراب، ٹوٹ پھوٹ یا چوری شدہ اسٹاک درج کریں")}
          >
            <Flame className="h-3.5 w-3.5 mr-1 text-rose-600" />
            <span>Record Damage & Loss</span>
          </Button>
          <Link href="/accounting?tab=LEDGER&type=ACCOUNT&code=5020">
            <Button
              variant="outline"
              size="sm"
              className="border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              title={t("View Stock Loss General Ledger (Account 5020)", "اسٹاک نقصان جنرل لیجر دیکھیں")}
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1 text-slate-500" />
              <span>{t("Loss Ledger (5020)", "نقصان لیجر (5020)")}</span>
            </Button>
          </Link>
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
                ) : filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-xs text-slate-400">
                      No stock movement transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((t) => {
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
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300 max-w-sm">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                                {t.notes || (t.reason ? `Reason: ${t.reason}` : "—")}
                              </span>
                              {isDamage && (
                                <Link
                                  href="/accounting?tab=LEDGER&type=ACCOUNT&code=5020"
                                  className="text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:underline inline-flex items-center gap-1 mt-0.5"
                                >
                                  <span>View in Account 5020 Ledger</span>
                                  <ExternalLink className="h-2.5 w-2.5" />
                                </Link>
                              )}
                            </div>
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
                    const unitCost = getProductEffectiveCost(p);

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
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openDamageModal(p.id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50/70 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 transition dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
                              title={t("Record Damage, Breakage, Theft or Stock Loss", "نقصان، ٹوٹ پھوٹ یا چوری کا اندراج")}
                            >
                              <AlertTriangle className="h-3 w-3 text-rose-600" />
                              <span>Loss / Damage</span>
                            </button>
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
                          </div>
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

      {/* ── STOCK DAMAGE & LOSS WRITE-OFF MODAL ── */}
      {showDamageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl bg-rose-100 p-2 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                  <Flame className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {t("Record Stock Damage / Loss", "اسٹاک نقصان / خرابی کا اندراج")}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {t("Deduct broken, stolen or expired goods and record loss in ledger", "خراب یا چوری شدہ مال منہا کریں اور کھاتے میں نقصان درج کریں")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDamageModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleRecordDamage} className="mt-4 space-y-4">
              {/* Product Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t("Select Product", "پروڈکٹ منتخب کریں")} <span className="text-rose-500">*</span>
                </label>
                <select
                  value={damageProductId}
                  onChange={(e) => setDamageProductId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  required
                >
                  <option value="">-- {t("Choose Product", "پروڈکٹ منتخب کریں")} --</option>
                  {safeProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Stock: {Number(p.currentStock || 0)} {p.unit || "pcs"} • Cost: Rs {getProductEffectiveCost(p).toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity to Deduct */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t("Loss Quantity (Minus)", "نقصان کی تعداد")} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={currentDamageStock > 0 ? currentDamageStock : 99999}
                    step="any"
                    value={damageQty}
                    onChange={(e) => setDamageQty(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="e.g. 2"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    required
                  />
                  {selectedDamageProduct && (
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      Available Stock: <strong>{currentDamageStock} {selectedDamageProduct.unit || "pcs"}</strong>
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t("Loss Reason / Category", "نقصان کی وجہ")}
                  </label>
                  <select
                    value={damageReason}
                    onChange={(e: any) => setDamageReason(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="DAMAGE">💥 Broken / Damaged (ٹوٹ پھوٹ یا خرابی)</option>
                    <option value="WRITE_OFF">🕵️ Theft / Stolen (چوری ہو گیا)</option>
                    <option value="EXPIRY">⏳ Expired (ایکسپائر ہو گیا)</option>
                    <option value="WRITE_OFF">❓ Lost / Missing (گمشدہ / کمی)</option>
                    <option value="PHYSICAL_COUNT">📋 Physical Audit Discrepancy (آڈٹ کمی)</option>
                    <option value="OTHER">📝 Other Reason (دیگر وجہ)</option>
                  </select>
                </div>
              </div>

              {/* Date & Remarks */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t("Incident / Entry Date", "تاریخ")}
                  </label>
                  <input
                    type="date"
                    value={damageDate}
                    onChange={(e) => setDamageDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t("Detailed Notes / Reason", "تفصیل")}
                  </label>
                  <input
                    type="text"
                    value={damageNotes}
                    onChange={(e) => setDamageNotes(e.target.value)}
                    placeholder={t("e.g. Dropped in transit, water leakage", "مثلاً گر کر ٹوٹ گیا، چوری")}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              {/* Live Financial & Stock Impact Preview Card */}
              {selectedDamageProduct && damageQtyNum > 0 && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-3.5 text-xs text-rose-950 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
                  <div className="flex items-center justify-between font-bold mb-1">
                    <span>{t("Financial Loss Valuation:", "مالی نقصان کی مالیت:")}</span>
                    <span className="text-sm font-extrabold text-rose-700 dark:text-rose-400 font-mono">
                      Rs {damageTotalLoss.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-[11px] text-rose-800/90 dark:text-rose-300 space-y-0.5">
                    <div>
                      • Stock: <strong>{currentDamageStock}</strong> → <strong className="text-rose-700 font-bold">{damageNewStock} {selectedDamageProduct.unit || "pcs"}</strong> (-{damageQtyNum} deducted)
                    </div>
                    <div>
                      • Accounting: <strong>Debit Account 5020 (Inventory Shrinkage & Loss)</strong> | <strong>Credit Account 1200 (Inventory Asset)</strong>
                    </div>
                  </div>
                </div>
              )}

              {damageErrorMsg && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300">
                  {damageErrorMsg}
                </div>
              )}

              {damageSuccessMsg && (
                <div className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-xs font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>{damageSuccessMsg}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDamageModal(false)}
                  disabled={damageSubmitting}
                >
                  {t("Cancel", "منسوخ")}
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={damageSubmitting}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
                >
                  {damageSubmitting ? (
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>{t("Recording...", "ریکارڈ ہو رہا ہے...")}</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Flame className="h-3.5 w-3.5 mr-0.5" />
                      <span>{t("Record Loss & Deduct Stock", "نقصان درج اور اسٹاک منہا کریں")}</span>
                    </span>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
