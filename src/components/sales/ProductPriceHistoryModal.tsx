"use client";

import React, { useState, useEffect } from "react";
import {
  Tag,
  ShoppingBag,
  TrendingUp,
  TrendingDown,
  Clock,
  User,
  Building,
  Check,
  X,
  History,
  Sparkles,
  ArrowRight,
  Loader2,
  Receipt,
  FileText,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ProductPriceHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId?: string;
  productName?: string;
  customerId?: string;
  customerName?: string;
  initialTab?: "PURCHASE" | "SALE";
  onSelectPrice: (price: number) => void;
}

export default function ProductPriceHistoryModal({
  isOpen,
  onClose,
  productId = "",
  productName = "",
  customerId,
  customerName,
  initialTab = "SALE",
  onSelectPrice,
}: ProductPriceHistoryModalProps) {
  const [activeTab, setActiveTab] = useState<"PURCHASE" | "SALE">(initialTab);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    isGeneral?: boolean;
    product?: any;
    lastCustomerSales?: any[];
    recentGeneralSales?: any[];
    recentPurchases?: any[];
    recentBills?: any[];
    recentInvoices?: any[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sync initial tab when opened
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Keyboard shortcut listener inside modal: F1 switches to Purchase, F2 switches to Sale
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        setActiveTab("PURCHASE");
      } else if (e.key === "F2") {
        e.preventDefault();
        setActiveTab("SALE");
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    setError(null);

    const targetId = productId && productId.trim() !== "" ? productId.trim() : "recent";
    const query = customerId ? `?customerId=${encodeURIComponent(customerId)}` : "";
    fetch(`/api/products/${targetId}/price-history${query}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setData(json);
        } else {
          setError(json.error || "Failed to load rate history");
        }
      })
      .catch((err) => setError(err.message || "Failed to load rate history"))
      .finally(() => setLoading(false));
  }, [isOpen, productId, customerId]);

  if (!isOpen) return null;

  const product = data?.product;
  const isProductSelected = Boolean(product && product.id);
  const costPrice = product?.costPrice || 0;
  const standardPrice = product?.sellingPrice || 0;
  const customerSales = data?.lastCustomerSales || [];
  const generalSales = data?.recentGeneralSales || [];
  const productPurchases = data?.recentPurchases || [];
  const recentBills = data?.recentBills || [];
  const recentInvoices = data?.recentInvoices || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        isProductSelected
          ? `Rate & Bill Intelligence: ${productName || product?.name || "Product"}`
          : "Recent Bills & Invoice History (حالیہ بلز اور انوائسز)"
      }
      maxWidth="2xl"
    >
      <div className="space-y-4 p-1">
        {/* Tab Switcher: F1 (Purchases) vs F2 (Sales) */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setActiveTab("PURCHASE")}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                activeTab === "PURCHASE"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              <span>Purchase Bills [F1] (خریداری بلز)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("SALE")}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                activeTab === "SALE"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <Receipt className="h-3.5 w-3.5" />
              <span>Sale Invoices [F2] (فروخت انوائسز)</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center gap-2">
            <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">
              Tip: Press F1 or F2 to switch
            </span>
          </div>
        </div>

        {/* Product Meta Header (if a product is active) */}
        {isProductSelected && (
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Tag className="h-4 w-4 text-blue-600" />
                  <span>{productName || product?.name}</span>
                  {product?.sku && (
                    <span className="text-[11px] font-mono font-semibold text-slate-500 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded">
                      {product.sku}
                    </span>
                  )}
                </h4>
                {customerName && (
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Viewing rates for customer: <strong className="text-slate-800 dark:text-slate-200">{customerName}</strong>
                  </p>
                )}
              </div>

              {/* KPI Badges */}
              <div className="flex items-center gap-2">
                <div className="bg-white dark:bg-slate-900 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                  <div className="text-[9px] font-bold text-slate-400 uppercase">Current Cost</div>
                  <div className="text-xs font-black text-rose-600 dark:text-rose-400">
                    Rs. {Number(costPrice).toLocaleString()}
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                  <div className="text-[9px] font-bold text-slate-400 uppercase">Standard Rate</div>
                  <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                    Rs. {Number(standardPrice).toLocaleString()}
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                  <div className="text-[9px] font-bold text-slate-400 uppercase">Stock</div>
                  <div className="text-xs font-black text-slate-800 dark:text-slate-200">
                    {product?.currentStock ?? 0} {product?.uom || "pcs"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading / Error States */}
        {loading && (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <p className="text-xs font-semibold">Fetching rates and billing history...</p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {/* ============================================================== */}
            {/* TAB 1: PURCHASE BILLS HISTORY [F1] */}
            {/* ============================================================== */}
            {activeTab === "PURCHASE" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <ShoppingBag className="h-3.5 w-3.5 text-blue-600" />
                    <span>
                      {isProductSelected
                        ? `Purchase Bills for "${productName || product?.name}"`
                        : "Recent 5 Purchase Bills (حالیہ خریداری بلز)"}
                    </span>
                  </h4>
                </div>

                {isProductSelected ? (
                  // Product-specific purchase history
                  productPurchases.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                      No purchase bill history recorded for this specific item yet.
                    </div>
                  ) : (
                    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-2xs">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100/80 dark:bg-slate-800 text-[10px] font-bold uppercase text-slate-500 border-b border-slate-200 dark:border-slate-700">
                          <tr>
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3">Bill #</th>
                            <th className="py-2.5 px-3">Supplier / Party</th>
                            <th className="py-2.5 px-2 text-center">Qty Bought</th>
                            <th className="py-2.5 px-3 text-right">Unit Cost</th>
                            <th className="py-2.5 px-3 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {productPurchases.map((pi: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                              <td className="py-2.5 px-3 text-slate-500 font-mono">{pi.date || "—"}</td>
                              <td className="py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300">
                                {pi.billNumber}
                              </td>
                              <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                                {pi.supplierName}
                              </td>
                              <td className="py-2.5 px-2 text-center font-bold text-slate-700 dark:text-slate-300">
                                {pi.quantity}
                              </td>
                              <td className="py-2.5 px-3 text-right font-black text-rose-600 dark:text-rose-400">
                                Rs. {Number(pi.unitPrice).toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => {
                                    onSelectPrice(pi.unitPrice);
                                    onClose();
                                  }}
                                  className="h-6 text-[11px] px-2.5 py-0 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-bold"
                                >
                                  Use Cost
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                ) : (
                  // General Recent 5 Purchase Bills
                  recentBills.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                      No purchase bills recorded yet.
                    </div>
                  ) : (
                    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-2xs">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100/80 dark:bg-slate-800 text-[10px] font-bold uppercase text-slate-500 border-b border-slate-200 dark:border-slate-700">
                          <tr>
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3">Bill #</th>
                            <th className="py-2.5 px-3">Supplier Name</th>
                            <th className="py-2.5 px-3">Items Summary</th>
                            <th className="py-2.5 px-3 text-right">Total Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {recentBills.map((b: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                              <td className="py-2.5 px-3 text-slate-500 font-mono">{b.date || "—"}</td>
                              <td className="py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300">
                                {b.billNumber}
                              </td>
                              <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                                {b.supplierName}
                              </td>
                              <td className="py-2.5 px-3 text-slate-500 truncate max-w-[200px]" title={b.itemsSummary}>
                                {b.itemsSummary || "—"}
                              </td>
                              <td className="py-2.5 px-3 text-right font-black text-slate-900 dark:text-white">
                                Rs. {Number(b.totalAmount).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                )}
              </div>
            )}

            {/* ============================================================== */}
            {/* TAB 2: SALE INVOICES HISTORY [F2] */}
            {/* ============================================================== */}
            {activeTab === "SALE" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Receipt className="h-3.5 w-3.5 text-purple-600" />
                    <span>
                      {isProductSelected
                        ? `Sales Invoices for "${productName || product?.name}"`
                        : "Recent 5 Sales Invoices (حالیہ سیل انوائسز)"}
                    </span>
                  </h4>
                </div>

                {isProductSelected ? (
                  // Product-specific sales history (Customer + Market)
                  <div className="space-y-3">
                    {/* Customer-specific rates */}
                    {customerId && (
                      <div>
                        <div className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400 mb-1.5 flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span>Last Sold Rates to {customerName || "Selected Customer"}:</span>
                        </div>
                        {customerSales.length === 0 ? (
                          <p className="text-[11px] text-slate-400 italic bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg border border-dashed border-slate-200 dark:border-slate-700">
                            No previous sales found for this customer.
                          </p>
                        ) : (
                          <div className="border border-indigo-100 dark:border-indigo-950/60 rounded-xl overflow-hidden">
                            <table className="w-full text-xs text-left">
                              <thead className="bg-indigo-50/60 dark:bg-indigo-950/40 text-[10px] font-bold uppercase text-indigo-900 dark:text-indigo-300">
                                <tr>
                                  <th className="py-2 px-3">Date</th>
                                  <th className="py-2 px-3">Invoice #</th>
                                  <th className="py-2 px-2 text-center">Qty</th>
                                  <th className="py-2 px-3 text-right">Sold Rate</th>
                                  <th className="py-2 px-3 text-center">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-indigo-50 dark:divide-slate-800">
                                {customerSales.map((cs: any, idx: number) => (
                                  <tr key={idx} className="hover:bg-indigo-50/30">
                                    <td className="py-2 px-3 text-slate-500 font-mono">{cs.date}</td>
                                    <td className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-300">
                                      {cs.invoiceNumber}
                                    </td>
                                    <td className="py-2 px-2 text-center font-bold">{cs.quantity}</td>
                                    <td className="py-2 px-3 text-right font-black text-emerald-600">
                                      Rs. {Number(cs.unitPrice).toLocaleString()}
                                    </td>
                                    <td className="py-2 px-3 text-center">
                                      <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => {
                                          onSelectPrice(cs.unitPrice);
                                          onClose();
                                        }}
                                        className="h-6 text-[11px] px-2.5 py-0 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                                      >
                                        Use Rate
                                      </Button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Market / All customers rates */}
                    <div>
                      <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                        <TrendingUp className="h-3 w-3 text-purple-600" />
                        <span>Recent Market Rates (All Customers):</span>
                      </div>
                      {generalSales.length === 0 ? (
                        <p className="text-[11px] text-slate-400 italic bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                          No recent sales recorded for this product yet.
                        </p>
                      ) : (
                        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-2xs">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-slate-100/80 dark:bg-slate-800 text-[10px] font-bold uppercase text-slate-500">
                              <tr>
                                <th className="py-2 px-3">Date</th>
                                <th className="py-2 px-3">Invoice #</th>
                                <th className="py-2 px-3">Party / Customer</th>
                                <th className="py-2 px-2 text-center">Qty</th>
                                <th className="py-2 px-3 text-right">Sold Rate</th>
                                <th className="py-2 px-3 text-center">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {generalSales.map((gs: any, idx: number) => (
                                <tr key={idx} className="hover:bg-slate-50/60">
                                  <td className="py-2 px-3 text-slate-500 font-mono">{gs.date}</td>
                                  <td className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-300">
                                    {gs.invoiceNumber}
                                  </td>
                                  <td className="py-2 px-3 font-medium text-slate-900 dark:text-white">
                                    {gs.customerName}
                                  </td>
                                  <td className="py-2 px-2 text-center font-bold">{gs.quantity}</td>
                                  <td className="py-2 px-3 text-right font-black text-purple-600 dark:text-purple-400">
                                    Rs. {Number(gs.unitPrice).toLocaleString()}
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={() => {
                                        onSelectPrice(gs.unitPrice);
                                        onClose();
                                      }}
                                      className="h-6 text-[11px] px-2.5 py-0 bg-purple-600 hover:bg-purple-700 text-white font-bold"
                                    >
                                      Use Rate
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  // General Recent 5 Sales Invoices
                  recentInvoices.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                      No sales invoices recorded yet.
                    </div>
                  ) : (
                    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-2xs">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100/80 dark:bg-slate-800 text-[10px] font-bold uppercase text-slate-500 border-b border-slate-200 dark:border-slate-700">
                          <tr>
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3">Invoice #</th>
                            <th className="py-2.5 px-3">Customer Name</th>
                            <th className="py-2.5 px-3">Items Summary</th>
                            <th className="py-2.5 px-3 text-right">Total Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {recentInvoices.map((inv: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                              <td className="py-2.5 px-3 text-slate-500 font-mono">{inv.date || "—"}</td>
                              <td className="py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300">
                                {inv.invoiceNumber}
                              </td>
                              <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                                {inv.customerName}
                              </td>
                              <td className="py-2.5 px-3 text-slate-500 truncate max-w-[200px]" title={inv.itemsSummary}>
                                {inv.itemsSummary || "—"}
                              </td>
                              <td className="py-2.5 px-3 text-right font-black text-slate-900 dark:text-white">
                                Rs. {Number(inv.totalAmount).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                )}
              </div>
            )}
          </>
        )}

        <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="secondary" size="sm" onClick={onClose} className="text-xs">
            Close (بند کریں)
          </Button>
        </div>
      </div>
    </Modal>
  );
}
