"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Package,
  ArrowLeft,
  Edit2,
  Archive,
  RotateCcw,
  ShieldCheck,
  History,
  Receipt,
  CheckCircle2,
  Clock,
  Layers,
  Percent,
} from "lucide-react";
import { BrandPageLoader } from "@/components/ui/loader";

export default function ProductDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params?.id as string;

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadProduct = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/products/${productId}`);
      const data = await res.json();
      if (data.success) {
        setProduct(data.data);
      }
    } catch (err) {
      console.error("Failed to load product details:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (productId) loadProduct();
  }, [productId]);

  const handleArchiveToggle = async () => {
    const isArchived = product?.status === "ARCHIVED" || product?.isActive === false;
    const endpoint = isArchived
      ? `/api/products/${productId}?action=restore`
      : `/api/products/${productId}`;

    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setActionSuccess(isArchived ? "Product restored to active" : "Product archived");
        setTimeout(() => setActionSuccess(null), 3000);
        loadProduct();
      }
    } catch (err) {
      console.error("Archive toggle error:", err);
    }
  };

  if (loading) {
    return (
      <BrandPageLoader
        message="Loading Product Information..."
        submessage="Retrieving inventory balances, valuation, HS code compliance, and movements ledger..."
      />
    );
  }

  if (!product) {
    return (
      <div className="py-20 text-center text-xs text-rose-400">
        Product not found or has been removed.
      </div>
    );
  }

  const isArchived = product.status === "ARCHIVED" || product.isActive === false;

  return (
    <div className="space-y-6 pb-20 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <Link
            href="/products"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Products</span>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">
              {product.name}
            </h1>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                isArchived
                  ? "bg-slate-100 text-slate-600 border border-slate-300"
                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
              }`}
            >
              {isArchived ? "ARCHIVED" : "ACTIVE"}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            SKU: <span className="font-mono font-medium text-slate-700">{product.sku || "N/A"}</span> • Code:{" "}
            <span className="font-mono font-medium text-slate-700">{product.productCode || "N/A"}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/products/${productId}/edit`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-50 shadow-xs transition"
          >
            <Edit2 className="h-3.5 w-3.5" />
            <span>Edit Product</span>
          </Link>

          <button
            onClick={handleArchiveToggle}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
              isArchived
                ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                : "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
            }`}
          >
            {isArchived ? <RotateCcw className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
            <span>{isArchived ? "Restore Product" : "Archive Product"}</span>
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* 4 Cards Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* HS Code */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider">
            HS Code (Harmonized System)
          </span>
          <p className="mt-1 text-xl font-bold font-mono text-indigo-600">
            {product.hsCode || "None"}
          </p>
          <span className="text-[10px] text-slate-400 mt-1 block">
            Custom Product Classification
          </span>
        </div>

        {/* Retail Selling Price */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider">
            Retail Selling Price
          </span>
          <p className="mt-1 text-xl font-bold font-mono text-slate-900">
            Rs {Number(product.sellingPrice || product.retailPrice || 0).toLocaleString()}
          </p>
          <span className="text-[10px] text-slate-400 mt-1 block">
            Wholesale: Rs {Number(product.wholesalePrice || 0).toLocaleString()}
          </span>
        </div>

        {/* Sales Tax Rate */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider">
            Sales Tax (FBR Rate)
          </span>
          <p className="mt-1 text-xl font-bold font-mono text-emerald-600">
            {product.salesTax ? `${product.salesTax}%` : "18.00%"}
          </p>
          <span className="text-[10px] text-slate-400 mt-1 block">
            Further Tax: {product.furtherTax || 0}% • Extra: {product.extraTax || 0}%
          </span>
        </div>

        {/* Stock on Hand */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider">
            Current Stock Level
          </span>
          <p className="mt-1 text-xl font-bold font-mono text-slate-900">
            {Number(product.currentStock || 0)} {product.uom || product.unit || "pcs"}
          </p>
          <span className="text-[10px] text-slate-400 mt-1 block">
            Avg Cost: Rs {Number(product.averageCost || product.purchasePrice || 0).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Product Information & Tax Configuration */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
            Specifications & Classification
          </h2>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Category</span>
              <span className="font-semibold text-slate-900">
                {product.category?.name || "Unassigned"}
              </span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Brand</span>
              <span className="text-slate-900">{product.brand || "—"}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Barcode</span>
              <span className="font-mono text-slate-700">{product.barcode || "—"}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Unit of Measure</span>
              <span className="text-slate-900 font-semibold uppercase">{product.uom || product.unit || "pcs"}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Tax Profile</span>
              <span className="text-indigo-600 font-semibold">{product.taxProfile || "Standard 18%"}</span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-slate-500">Description</span>
              <span className="text-slate-700 text-right max-w-xs">{product.description || "None provided"}</span>
            </div>
          </div>
        </div>

        {/* Right: Sales & Invoice Usage History */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Linked Sales Invoices
            </h2>
            <Receipt className="h-4 w-4 text-indigo-600" />
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {(!product.saleItems || product.saleItems.length === 0) ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No recorded sales for this item yet.
              </div>
            ) : (
              product.saleItems.map((si: any) => (
                <div
                  key={si.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                >
                  <div>
                    <span className="font-mono font-bold text-slate-900">
                      {si.sale?.invoiceNumber || "Invoice"}
                    </span>
                    <p className="text-[11px] text-slate-500">
                      {si.sale?.customerName || "Customer"} • {new Date(si.sale?.date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-emerald-700">
                      Rs {Number(si.lineTotal || 0).toLocaleString()}
                    </span>
                    <p className="text-[10px] text-slate-500">
                      Qty: {Number(si.quantity || 1)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Batch Purchase & Cost Evolution History */}
      {product.costHistory && product.costHistory.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Batch Purchase & Cost Evolution History
              </h2>
            </div>
            <span className="text-[11px] text-slate-400">
              {product.costHistory.length} Cost Records
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase font-bold text-slate-500">
                <tr>
                  <th className="py-2.5 px-3">Date / Bill #</th>
                  <th className="py-2.5 px-3 text-right">Inward Qty</th>
                  <th className="py-2.5 px-3 text-right">Previous Cost</th>
                  <th className="py-2.5 px-3 text-right">New Buying Cost</th>
                  <th className="py-2.5 px-3 text-right">Blended WAC</th>
                  <th className="py-2.5 px-3 text-right">Selling Price</th>
                  <th className="py-2.5 px-3 text-right">Batch Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {product.costHistory.map((ch: any, cIdx: number) => {
                  const newCost = Number(ch.newPurchaseCost || ch.previousCost || 0);
                  const prevCost = Number(ch.previousCost || newCost);
                  const sell = Number(ch.newSellingPrice || ch.sellingPrice || 0);
                  const margin = sell > 0 ? ((sell - newCost) / sell) * 100 : 0;
                  const costDiff = newCost - prevCost;

                  return (
                    <tr key={cIdx} className="hover:bg-slate-50/60 transition">
                      <td className="py-2.5 px-3 font-sans">
                        <span className="font-bold text-slate-900">{ch.purchaseNumber || "PUR-INIT"}</span>
                        <span className="block text-[10px] text-slate-400">
                          {new Date(ch.date).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                        {Number(ch.quantity || 1)} {product.uom || "pcs"}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-500">
                        Rs {prevCost.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold">
                        <span className={costDiff > 0 ? "text-amber-700" : costDiff < 0 ? "text-emerald-700" : "text-slate-900"}>
                          Rs {newCost.toLocaleString()}
                        </span>
                        {costDiff !== 0 && (
                          <span className={`block text-[9px] ${costDiff > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                            {costDiff > 0 ? `+Rs ${costDiff.toLocaleString()}` : `-Rs ${Math.abs(costDiff).toLocaleString()}`}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-blue-700">
                        Rs {Math.round(Number(ch.newAverageCost || newCost)).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                        Rs {sell.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          margin >= 15 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-700"
                        }`}>
                          {margin.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Audit History Log */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Immutable Product Audit History
            </h2>
          </div>
          <span className="text-[11px] text-slate-400">
            {product.audits?.length || 0} Events Recorded
          </span>
        </div>

        <div className="space-y-2">
          {(!product.audits || product.audits.length === 0) ? (
            <div className="py-6 text-center text-xs text-slate-400">
              No modifications recorded in the audit log for this item.
            </div>
          ) : (
            product.audits.map((a: any) => (
              <div
                key={a.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-indigo-700 uppercase tracking-wide">
                      {a.action}
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="text-[11px] text-slate-600">{a.userName || "System"}</span>
                  </div>
                  <p className="text-[11px] text-slate-700 mt-0.5">{a.notes}</p>
                </div>
                <div className="text-right font-mono text-[10px] text-slate-400">
                  {new Date(a.createdAt).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
