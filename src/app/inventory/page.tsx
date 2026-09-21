"use client";

import React, { useEffect, useState } from "react";
import { formatMoney } from "@/lib/decimal";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Sliders, AlertTriangle, ArrowUpDown, Download, Package } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { TableRowsSkeleton } from "@/components/ui/loader";

export default function InventoryPage() {
  const { activeCompany } = useAuth();

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"PRODUCTS" | "ALERTS">("PRODUCTS");

  // Modals
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  // Adjustment Form
  const [targetStock, setTargetStock] = useState(0);
  const [adjustReason, setAdjustReason] = useState("PHYSICAL_COUNT");
  const [adjustNotes, setAdjustNotes] = useState("");

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (activeCompany?.id) {
        headers["x-business-id"] = activeCompany.id;
      }

      const res = await fetch("/api/products?limit=1000", { headers });
      const json = await res.json();
      const list = json.products || json.data || [];
      setProducts(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error(e);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [activeCompany?.id]);


  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setSubmitting(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (activeCompany?.id) headers["x-business-id"] = activeCompany.id;

      const res = await fetch("/api/products/adjust", {
        method: "POST",
        headers,
        body: JSON.stringify({
          productId: selectedProduct.id,
          targetStock,
          reason: adjustReason,
          notes: adjustNotes,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowAdjustModal(false);
        fetchProducts();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

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
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-3.5 w-3.5 mr-1" />
            Export CSV
          </Button>
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

      {/* Products Table */}
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
                <th className="px-4 py-3 text-right">Actions</th>
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedProduct(p);
                            setTargetStock(Number(p.currentStock || 0));
                            setShowAdjustModal(true);
                          }}
                        >
                          <Sliders className="h-3.5 w-3.5 mr-1" />
                          Adjust Stock
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>


      {/* Stock Adjustment Modal */}
      <Modal
        isOpen={showAdjustModal}
        onClose={() => setShowAdjustModal(false)}
        title={`Adjust Stock: ${selectedProduct?.name || "Product"}`}
        description="Adjust quantity for physical audit discrepancy, damage, or breakage"
      >
        <form onSubmit={handleAdjustSubmit} className="space-y-4">
          <div className="rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800">
            <p>
              Current Recorded Stock: <span className="font-bold">{selectedProduct?.currentStock ?? 0} {selectedProduct?.unit || selectedProduct?.uom || "pcs"}</span>
            </p>
            <p className="text-slate-500 mt-0.5">
              Average Cost: {formatMoney(selectedProduct?.averageCost || selectedProduct?.purchasePrice || 0)}
            </p>
          </div>

          <Input
            label="Verified Physical Count / Target Stock"
            type="number"
            value={targetStock}
            onChange={(e) => setTargetStock(parseFloat(e.target.value) || 0)}
            required
          />

          <Select
            label="Adjustment Reason"
            value={adjustReason}
            onChange={(e) => setAdjustReason(e.target.value)}
          >
            <option value="PHYSICAL_COUNT">Physical Audit Count Discrepancy</option>
            <option value="DAMAGE">Damaged / Broken Goods</option>
            <option value="EXPIRY">Expired Product Write-off</option>
            <option value="WRITE_OFF">General Inventory Loss</option>
            <option value="OTHER">Other Adjustment</option>
          </Select>

          <Input
            label="Reason Details / Audit Notes"
            value={adjustNotes}
            onChange={(e) => setAdjustNotes(e.target.value)}
            placeholder="e.g. Month-end physical verification count"
          />

          <div className="pt-3 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowAdjustModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              Apply Stock Adjustment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
