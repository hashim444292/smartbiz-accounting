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
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ProductPriceHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  customerId?: string;
  customerName?: string;
  onSelectPrice: (price: number) => void;
}

export default function ProductPriceHistoryModal({
  isOpen,
  onClose,
  productId,
  productName,
  customerId,
  customerName,
  onSelectPrice,
}: ProductPriceHistoryModalProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    product?: any;
    lastCustomerSales?: any[];
    recentGeneralSales?: any[];
    recentPurchases?: any[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !productId) return;

    setLoading(true);
    setError(null);

    const query = customerId ? `?customerId=${encodeURIComponent(customerId)}` : "";
    fetch(`/api/products/${productId}/price-history${query}`)
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
  const costPrice = product?.costPrice || 0;
  const standardPrice = product?.sellingPrice || 0;
  const customerSales = data?.lastCustomerSales || [];
  const generalSales = data?.recentGeneralSales || [];
  const purchases = data?.recentPurchases || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Price & Rate Intelligence (قیمت اور ریٹ ہسٹری)"
      maxWidth="2xl"
    >
      <div className="space-y-5 p-1">
        {/* Product Header & Top Metrics */}
        <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Tag className="h-4 w-4 text-blue-600" />
                <span>{productName}</span>
                {product?.sku && (
                  <span className="text-xs font-mono font-semibold text-slate-500 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded">
                    {product.sku}
                  </span>
                )}
              </h3>
              {customerName && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Checking rate history for customer: <strong className="text-blue-600 dark:text-blue-400">{customerName}</strong>
                </p>
              )}
            </div>
            <Badge variant="outline" className="text-[11px] font-mono bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300">
              Shortcut: [F2]
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Purchase Cost (خرید)</span>
              <span className="text-sm sm:text-base font-black text-rose-600 dark:text-rose-400">
                Rs. {costPrice ? costPrice.toLocaleString() : "0"}
              </span>
            </div>
            <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Catalog Price (معیاری ریٹ)</span>
              <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                Rs. {standardPrice ? standardPrice.toLocaleString() : "0"}
              </span>
              {standardPrice > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectPrice(standardPrice);
                    onClose();
                  }}
                  className="mt-1 block mx-auto text-[10px] text-blue-600 hover:underline font-semibold"
                >
                  Apply Rate
                </button>
              )}
            </div>
            <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current Stock (اسٹاک)</span>
              <span className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400">
                {product?.currentStock ?? 0} {product?.uom || "PCS"}
              </span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span>Fetching purchase cost & customer rate history...</span>
          </div>
        ) : error ? (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
            ⚠️ {error}
          </div>
        ) : (
          <div className="space-y-4">
            {/* 1. Customer-Specific Sales History */}
            {customerName && (
              <div className="border border-blue-200 dark:border-blue-900/60 rounded-2xl p-3.5 bg-blue-50/40 dark:bg-blue-950/20">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-black text-blue-900 dark:text-blue-300 flex items-center gap-1.5 uppercase tracking-wider">
                    <User className="h-3.5 w-3.5" />
                    <span>Previous Rates for {customerName}</span>
                  </h4>
                  <span className="text-[10px] text-blue-700 dark:text-blue-400 font-semibold">
                    {customerSales.length} past record{customerSales.length === 1 ? "" : "s"}
                  </span>
                </div>

                {customerSales.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-2">
                    No previous sales found for this customer with this item.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {customerSales.map((sale: any, idx: number) => {
                      const isBelowCost = costPrice > 0 && sale.unitPrice < costPrice;
                      return (
                        <div
                          key={idx}
                          className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-blue-100 dark:border-blue-900/40 flex items-center justify-between text-xs hover:border-blue-300 transition"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-[11px] font-bold text-slate-500">
                              {sale.invoiceNumber}
                            </span>
                            <span className="text-slate-400 text-[11px]">{sale.date}</span>
                            <span className="text-slate-600 dark:text-slate-300 font-medium">
                              Qty: <strong>{sale.quantity}</strong>
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <span className="font-black text-sm text-slate-900 dark:text-white">
                                Rs. {sale.unitPrice.toLocaleString()}
                              </span>
                              {isBelowCost && (
                                <span className="block text-[9px] text-rose-500 font-bold">
                                  Loss: Rs. {(costPrice - sale.unitPrice).toLocaleString()}
                                </span>
                              )}
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => {
                                onSelectPrice(sale.unitPrice);
                                onClose();
                              }}
                              className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg px-2.5 shadow-xs"
                            >
                              Use This Rate
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 2. Recent General Sales Across All Parties */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 bg-white dark:bg-slate-900">
              <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                <History className="h-3.5 w-3.5 text-slate-500" />
                <span>Recent Market Sales (عام فروخت کی تاریخ)</span>
              </h4>

              {generalSales.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-2">No recent sales records for this item.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] font-bold uppercase text-slate-400">
                      <tr>
                        <th className="py-1.5 px-2">Invoice</th>
                        <th className="py-1.5 px-2">Date</th>
                        <th className="py-1.5 px-2">Customer</th>
                        <th className="py-1.5 px-2 text-center">Qty</th>
                        <th className="py-1.5 px-2 text-right">Sold Rate</th>
                        <th className="py-1.5 px-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {generalSales.map((s: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          <td className="py-2 px-2 font-mono font-bold text-slate-600 dark:text-slate-300">
                            {s.invoiceNumber}
                          </td>
                          <td className="py-2 px-2 text-slate-400">{s.date}</td>
                          <td className="py-2 px-2 font-medium text-slate-800 dark:text-slate-200 truncate max-w-[140px]">
                            {s.customerName}
                          </td>
                          <td className="py-2 px-2 text-center font-semibold text-slate-600 dark:text-slate-300">
                            {s.quantity}
                          </td>
                          <td className="py-2 px-2 text-right font-black text-slate-900 dark:text-white">
                            Rs. {s.unitPrice.toLocaleString()}
                          </td>
                          <td className="py-2 px-2 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                onSelectPrice(s.unitPrice);
                                onClose();
                              }}
                              className="text-[11px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline"
                            >
                              Apply
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 3. Last Purchase History from Suppliers */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 bg-white dark:bg-slate-900">
              <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                <ShoppingBag className="h-3.5 w-3.5 text-rose-500" />
                <span>Supplier Purchase History (خریداری بلز)</span>
              </h4>

              {purchases.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-2">No purchase records found for this item.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] font-bold uppercase text-slate-400">
                      <tr>
                        <th className="py-1.5 px-2">Bill #</th>
                        <th className="py-1.5 px-2">Date</th>
                        <th className="py-1.5 px-2">Supplier</th>
                        <th className="py-1.5 px-2 text-center">Qty Purchased</th>
                        <th className="py-1.5 px-2 text-right">Cost Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {purchases.map((p: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          <td className="py-2 px-2 font-mono font-bold text-slate-600 dark:text-slate-300">
                            {p.billNumber}
                          </td>
                          <td className="py-2 px-2 text-slate-400">{p.date}</td>
                          <td className="py-2 px-2 font-medium text-slate-800 dark:text-slate-200 truncate max-w-[140px]">
                            {p.supplierName}
                          </td>
                          <td className="py-2 px-2 text-center font-semibold text-slate-600 dark:text-slate-300">
                            {p.quantity}
                          </td>
                          <td className="py-2 px-2 text-right font-black text-rose-600 dark:text-rose-400">
                            Rs. {p.unitPrice.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="rounded-xl text-xs">
            Close (بند کریں)
          </Button>
        </div>
      </div>
    </Modal>
  );
}
