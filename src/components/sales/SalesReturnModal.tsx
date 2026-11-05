"use client";

import React, { useState, useEffect, useMemo } from "react";
import { formatMoney } from "@/lib/decimal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  RotateCcw,
  X,
  AlertTriangle,
  CheckCircle2,
  Package,
  Layers,
  ArrowRight,
  DollarSign,
  Plus,
  Minus,
  RefreshCw,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

export interface ReturnItemRow {
  itemId: string;
  productId: string;
  productName: string;
  sku?: string;
  unitPrice: number;
  taxRate: number;
  costPrice: number;
  soldQuantity: number;
  alreadyReturned: number;
  remainingQuantity: number;
}

interface SalesReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: any | null;
  onSuccess: (result: any) => void;
}

export function SalesReturnModal({
  isOpen,
  onClose,
  sale,
  onSuccess,
}: SalesReturnModalProps) {
  const { t, language } = useLanguage();
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>({});
  const [reasonCategory, setReasonCategory] = useState("CUSTOMER_RETURN");
  const [customNotes, setCustomNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Normalize sale items and calculate returnable limits
  const itemRows: ReturnItemRow[] = useMemo(() => {
    if (!sale || !Array.isArray(sale.items)) return [];
    return sale.items.map((it: any) => {
      const soldQty = Number(it.quantity || 0);
      const retQty = Number(it.returnedQuantity || 0);
      const remQty = Math.max(0, soldQty - retQty);
      return {
        itemId: it.id || it.productId,
        productId: it.productId,
        productName: it.productName || it.product?.name || "Product",
        sku: it.sku || it.product?.sku || "",
        unitPrice: Number(it.unitPrice || 0),
        taxRate: Number(it.taxRate || 0),
        costPrice: Number(it.costPrice || it.product?.averageCost || 0),
        soldQuantity: soldQty,
        alreadyReturned: retQty,
        remainingQuantity: remQty,
      };
    });
  }, [sale]);

  // Reset state on modal open
  useEffect(() => {
    if (isOpen && sale) {
      setError(null);
      setReasonCategory("CUSTOMER_RETURN");
      setCustomNotes("");

      // Default: If only 1 item, select full remaining; if multiple, preset all to remaining for easy adjustment
      const initialQtys: Record<string, number> = {};
      for (const row of itemRows) {
        initialQtys[row.itemId] = row.remainingQuantity;
      }
      setReturnQtys(initialQtys);
    }
  }, [isOpen, sale, itemRows]);

  if (!isOpen || !sale) return null;

  const handleQtyChange = (itemId: string, newQty: number, maxQty: number) => {
    const clamped = Math.max(0, Math.min(maxQty, Math.round(newQty * 10000) / 10000));
    setReturnQtys((prev) => ({ ...prev, [itemId]: clamped }));
  };

  const handleSelectAll = () => {
    const all: Record<string, number> = {};
    for (const row of itemRows) {
      all[row.itemId] = row.remainingQuantity;
    }
    setReturnQtys(all);
  };

  const handleClearAll = () => {
    const empty: Record<string, number> = {};
    for (const row of itemRows) {
      empty[row.itemId] = 0;
    }
    setReturnQtys(empty);
  };

  // Compute live financial totals for the selected return quantities
  const {
    totalUnitsReturning,
    selectedItemsCount,
    totalReturnAmount,
    totalCogsReversal,
    isFullInvoiceReturn,
    receivableReduction,
    cashRefund,
  } = useMemo(() => {
    let units = 0;
    let selectedCount = 0;
    let returnAmt = 0;
    let cogsRev = 0;
    let allRemainingSelected = itemRows.length > 0;

    for (const row of itemRows) {
      const q = returnQtys[row.itemId] || 0;
      if (q > 0) {
        units += q;
        selectedCount += 1;
        const lineTotal = q * row.unitPrice * (1 + row.taxRate / 100);
        returnAmt += lineTotal;
        cogsRev += q * row.costPrice;
      }
      if (q !== row.remainingQuantity) {
        allRemainingSelected = false;
      }
    }

    const currentRem = Number(sale.remainingAmount || 0);
    const recRed = Math.min(currentRem, returnAmt);
    const cashRef = Math.max(0, returnAmt - recRed);

    return {
      totalUnitsReturning: units,
      selectedItemsCount: selectedCount,
      totalReturnAmount: returnAmt,
      totalCogsReversal: cogsRev,
      isFullInvoiceReturn: allRemainingSelected && units > 0,
      receivableReduction: recRed,
      cashRefund: cashRef,
    };
  }, [itemRows, returnQtys, sale]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalUnitsReturning <= 0) {
      setError(
        language === "ur"
          ? "براہ کرم واپسی کے لیے کم از کم ایک پروڈکٹ کی تعداد منتخب کریں۔"
          : "Please select at least one product quantity to return."
      );
      return;
    }

    const itemsPayload = itemRows
      .filter((r) => (returnQtys[r.itemId] || 0) > 0)
      .map((r) => ({
        itemId: r.itemId,
        productId: r.productId,
        quantity: returnQtys[r.itemId],
      }));

    const reasonLabel =
      reasonCategory === "CUSTOMER_RETURN"
        ? "Customer Return / Preference (گاہک کی واپسی)"
        : reasonCategory === "DEFECTIVE"
        ? "Defective / Damaged Item (خراب یا ٹوٹا مال)"
        : reasonCategory === "WRONG_ITEM"
        ? "Wrong Item Dispatched (غلط مال پہنچ گیا)"
        : reasonCategory === "ORDER_CANCELLED"
        ? "Order Cancelled (آرڈر کینسل)"
        : "Other Return (دیگر وجوہات)";

    const fullReason = customNotes.trim() ? `${reasonLabel} - ${customNotes.trim()}` : reasonLabel;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/sales/${sale.id}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: fullReason,
          items: itemsPayload,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to process sales return.");
      }

      onSuccess(json);
      onClose();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred while returning sale.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div
        className="relative w-full max-w-4xl bg-white dark:bg-[#0F172A] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-6 transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                  {language === "ur" ? "سیل واپسی و اسٹاک بحالی" : "Sales Return & Restocking"}
                </h2>
                <Badge
                  variant={isFullInvoiceReturn ? "danger" : "warning"}
                  className="text-[11px] font-bold px-2 py-0.5"
                >
                  {isFullInvoiceReturn
                    ? language === "ur"
                      ? "مکمل واپسی (Full Return)"
                      : "Full Return"
                    : language === "ur"
                    ? "جزوی واپسی (Partial Return)"
                    : "Partial Return"}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Invoice #{sale.invoiceNumber} • {sale.customerName || "Customer"} • {new Date(sale.date).toLocaleDateString()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick Notice */}
          <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 text-xs text-indigo-900 dark:text-indigo-200 flex items-start gap-2.5">
            <Layers className="h-4 w-4 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">
                {language === "ur"
                  ? "اشیاء اور تعداد منتخب کریں جو گاہک نے واپس کی ہیں:"
                  : "Select the specific products and quantities being returned:"}
              </p>
              <p className="text-[11px] text-indigo-700 dark:text-indigo-300 mt-0.5">
                {language === "ur"
                  ? "واپس کی جانے والی اشیاء فوری طور پر گودام میں بحال ہو جائیں گی، سیلز ریٹرن جنرل واؤچر بن جائے گا، اور کسٹمر کے کھاتے میں واجبات کم کر دیے جائیں گے۔"
                  : "Returned items will be immediately restocked into inventory, a Sales Returns voucher (Account 4020) posted, and receivables or cash adjusted automatically."}
              </p>
            </div>
          </div>

          {/* Item Selection Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                {language === "ur" ? "انوائس پروڈکٹس لسٹ" : "Invoice Items Selection"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                >
                  {language === "ur" ? "سب شامل کریں" : "Select All"}
                </button>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 hover:underline"
                >
                  {language === "ur" ? "صفر کریں" : "Clear All"}
                </button>
              </div>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden overflow-x-auto shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                    <th className="py-2.5 px-3">Product Name</th>
                    <th className="py-2.5 px-3 text-right">Unit Price</th>
                    <th className="py-2.5 px-3 text-center">Sold</th>
                    <th className="py-2.5 px-3 text-center">Already Ret.</th>
                    <th className="py-2.5 px-3 text-center">Returnable</th>
                    <th className="py-2.5 px-3 text-center min-w-[140px]">Return Quantity</th>
                    <th className="py-2.5 px-3 text-right">Return Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 bg-white dark:bg-[#0F172A]">
                  {itemRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-400">
                        No items found on this invoice.
                      </td>
                    </tr>
                  ) : (
                    itemRows.map((row) => {
                      const qty = returnQtys[row.itemId] || 0;
                      const isSelected = qty > 0;
                      const lineVal = qty * row.unitPrice * (1 + row.taxRate / 100);
                      const isFullyReturned = row.remainingQuantity === 0;

                      return (
                        <tr
                          key={row.itemId}
                          className={`transition ${
                            isSelected
                              ? "bg-rose-50/40 dark:bg-rose-950/20"
                              : isFullyReturned
                              ? "opacity-50 bg-slate-50/30"
                              : "hover:bg-slate-50/60 dark:hover:bg-slate-900/40"
                          }`}
                        >
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">
                              {row.productName}
                            </div>
                            {row.sku && (
                              <div className="text-[10px] text-slate-400 font-mono">
                                SKU: {row.sku}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium text-slate-700 dark:text-slate-300">
                            Rs {formatMoney(row.unitPrice)}
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-600 dark:text-slate-400">
                            {row.soldQuantity}
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-400">
                            {row.alreadyReturned > 0 ? (
                              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                {row.alreadyReturned}
                              </span>
                            ) : (
                              "0"
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <Badge
                              variant={row.remainingQuantity > 0 ? "outline" : "danger"}
                              className="text-[10px] px-1.5 py-0.5"
                            >
                              {row.remainingQuantity}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {isFullyReturned ? (
                              <span className="text-[11px] text-rose-500 font-semibold">
                                Fully Returned
                              </span>
                            ) : (
                              <div className="inline-flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-0.5 shadow-2xs">
                                <button
                                  type="button"
                                  onClick={() => handleQtyChange(row.itemId, qty - 1, row.remainingQuantity)}
                                  disabled={qty <= 0}
                                  className="h-6 w-6 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded disabled:opacity-30 transition"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <input
                                  type="number"
                                  min={0}
                                  max={row.remainingQuantity}
                                  step="any"
                                  value={qty}
                                  onChange={(e) =>
                                    handleQtyChange(
                                      row.itemId,
                                      parseFloat(e.target.value) || 0,
                                      row.remainingQuantity
                                    )
                                  }
                                  className="w-14 text-center font-bold text-xs bg-transparent border-0 focus:ring-0 text-slate-900 dark:text-slate-100 p-0"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleQtyChange(row.itemId, qty + 1, row.remainingQuantity)}
                                  disabled={qty >= row.remainingQuantity}
                                  className="h-6 w-6 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded disabled:opacity-30 transition"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100">
                            {qty > 0 ? `Rs ${formatMoney(lineVal)}` : "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Reason & Notes Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {language === "ur" ? "واپسی کی وجہ (Reason)" : "Return Reason"}
              </label>
              <select
                value={reasonCategory}
                onChange={(e) => setReasonCategory(e.target.value)}
                className="w-full text-xs rounded-xl border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 py-2 px-3 shadow-2xs focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
              >
                <option value="CUSTOMER_RETURN">Customer Return / Preference (گاہک کی واپسی)</option>
                <option value="DEFECTIVE">Defective / Damaged Item (خراب یا ٹوٹا ہوا مال)</option>
                <option value="WRONG_ITEM">Wrong Item Dispatched (غلط پروڈکٹ پہنچ گیا)</option>
                <option value="ORDER_CANCELLED">Order Cancelled (آرڈر کینسل)</option>
                <option value="OTHER">Other / Mutual Agreement (دیگر باہمی رضامندی)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {language === "ur" ? "تفصیل / ریمارکس (Optional)" : "Additional Notes (Optional)"}
              </label>
              <input
                type="text"
                placeholder={language === "ur" ? "اضافی تفصیل درج کریں..." : "e.g. 1 unit damaged during transit..."}
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                className="w-full text-xs rounded-xl border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 py-2 px-3 shadow-2xs focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
              />
            </div>
          </div>

          {/* Live Financial Impact Summary */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>{language === "ur" ? "مالی اثرات و کھاتہ جات سمری" : "Financial Impact & Ledger Summary"}</span>
              <span className="text-[11px] font-semibold text-slate-500 lowercase">
                {selectedItemsCount} items • {totalUnitsReturning} units selected
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-2.5 rounded-lg bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-500 font-semibold block">Total Return Value</span>
                <span className="text-sm font-bold text-rose-600 dark:text-rose-400">
                  Rs {formatMoney(totalReturnAmount)}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-500 font-semibold block">Receivables Reduction</span>
                <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                  Rs {formatMoney(receivableReduction)}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-500 font-semibold block">Cash/Bank Refund</span>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  Rs {formatMoney(cashRefund)}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-500 font-semibold block">COGS Value Restocked</span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  Rs {formatMoney(totalCogsReversal)}
                </span>
              </div>
            </div>

            {/* Double-Entry Journal Preview */}
            <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 font-mono space-y-1">
              <div className="flex justify-between">
                <span>[Dr] 4020 Sales Returns & Allowances</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  Rs {formatMoney(totalReturnAmount)}
                </span>
              </div>
              {receivableReduction > 0 && (
                <div className="flex justify-between pl-4 text-amber-700 dark:text-amber-400">
                  <span>[Cr] 1100 Customer Receivables (کھاتہ واجبات کمی)</span>
                  <span>Rs {formatMoney(receivableReduction)}</span>
                </div>
              )}
              {cashRefund > 0 && (
                <div className="flex justify-between pl-4 text-blue-700 dark:text-blue-400">
                  <span>[Cr] {sale.paymentMethod === "BANK" ? "1020 Main Bank" : "1010 Cash in Hand"} (رقم واپسی)</span>
                  <span>Rs {formatMoney(cashRefund)}</span>
                </div>
              )}
              {totalCogsReversal > 0 && (
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400 border-t border-slate-200/50 dark:border-slate-800/80 pt-1">
                  <span>[Dr] 1200 Inventory (اسٹاک بحالی) / [Cr] 5010 COGS</span>
                  <span>Rs {formatMoney(totalCogsReversal)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={submitting}
              className="text-slate-600 dark:text-slate-300"
            >
              {language === "ur" ? "منسوخ" : "Cancel"}
            </Button>

            <Button
              type="submit"
              size="sm"
              disabled={submitting || totalUnitsReturning <= 0}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold flex items-center gap-2 shadow-sm"
            >
              {submitting ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>{language === "ur" ? "واپسی جاری ہے..." : "Processing Return..."}</span>
                </>
              ) : (
                <>
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>
                    {isFullInvoiceReturn
                      ? language === "ur"
                        ? "مکمل سیل واپس کریں"
                        : "Confirm Full Return"
                      : language === "ur"
                      ? `جزوی سیل واپس کریں (${totalUnitsReturning} اشیاء)`
                      : `Confirm Partial Return (${totalUnitsReturning} units)`}
                  </span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
