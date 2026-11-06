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
  Truck,
  Building2,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

export interface ReturnPurchaseItemRow {
  itemId: string;
  productId: string;
  productName: string;
  sku?: string;
  unitCost: number;
  taxRate: number;
  purchasedQuantity: number;
  alreadyReturned: number;
  remainingQuantity: number;
}

interface PurchaseReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchase: any | null;
  onSuccess: (result: any) => void;
}

export function PurchaseReturnModal({
  isOpen,
  onClose,
  purchase,
  onSuccess,
}: PurchaseReturnModalProps) {
  const { t, language } = useLanguage();
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>({});
  const [reasonCategory, setReasonCategory] = useState("DEFECTIVE");
  const [customNotes, setCustomNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Normalize purchase items and calculate returnable limits
  const itemRows: ReturnPurchaseItemRow[] = useMemo(() => {
    if (!purchase || !Array.isArray(purchase.items)) return [];
    return purchase.items.map((it: any) => {
      const purchasedQty = Number(it.quantity || 0);
      const retQty = Number(it.returnedQuantity || 0);
      const remQty = Math.max(0, purchasedQty - retQty);
      return {
        itemId: it.id || it.productId,
        productId: it.productId,
        productName: it.productName || it.product?.name || "Product",
        sku: it.sku || it.product?.sku || "",
        unitCost: Number(it.unitCost || 0),
        taxRate: Number(it.taxRate || 0),
        purchasedQuantity: purchasedQty,
        alreadyReturned: retQty,
        remainingQuantity: remQty,
      };
    });
  }, [purchase]);

  // Reset state on modal open
  useEffect(() => {
    if (isOpen && purchase) {
      setError(null);
      setReasonCategory("DEFECTIVE");
      setCustomNotes("");

      const initialQtys: Record<string, number> = {};
      for (const row of itemRows) {
        initialQtys[row.itemId] = row.remainingQuantity;
      }
      setReturnQtys(initialQtys);
    }
  }, [isOpen, purchase, itemRows]);

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
    payableReduction,
    cashRefund,
    isFullBillReturn,
  } = useMemo(() => {
    let units = 0;
    let selectedCount = 0;
    let returnAmt = 0;
    let allRemainingSelected = itemRows.length > 0;

    for (const row of itemRows) {
      const q = returnQtys[row.itemId] || 0;
      if (q > 0) {
        units += q;
        selectedCount += 1;
        const lineTotal = q * row.unitCost * (1 + (row.taxRate || 0) / 100);
        returnAmt += lineTotal;
      }
      if (q !== row.remainingQuantity) {
        allRemainingSelected = false;
      }
    }

    const currentRem = Number(purchase?.remainingAmount || 0);
    const payRed = Math.min(currentRem, returnAmt);
    const cashRef = Math.max(0, returnAmt - payRed);

    return {
      totalUnitsReturning: units,
      selectedItemsCount: selectedCount,
      totalReturnAmount: returnAmt,
      payableReduction: payRed,
      cashRefund: cashRef,
      isFullBillReturn: allRemainingSelected && units > 0,
    };
  }, [itemRows, returnQtys, purchase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchase) return;

    if (totalUnitsReturning <= 0) {
      setError(
        language === "ur"
          ? "براہ کرم واپسی کے لیے کم از کم ایک آئٹم کی مقدار منتخب کریں۔"
          : "Please specify at least one item quantity to return."
      );
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const itemsPayload = itemRows
        .filter((row) => (returnQtys[row.itemId] || 0) > 0)
        .map((row) => ({
          itemId: row.itemId,
          productId: row.productId,
          quantity: returnQtys[row.itemId],
        }));

      const categoryLabels: Record<string, string> = {
        DEFECTIVE: "Defective / Damaged items (نقص یا خراب مال)",
        WRONG_ITEM: "Wrong merchandise delivered (غلط مال موصول ہوا)",
        QUALITY_ISSUE: "Poor / Substandard quality (معیار کا مسئلہ)",
        OVERSTOCK: "Excess / Overstock quantity (زیادہ سامان)",
        PRICE_MISMATCH: "Rate / Billing discrepancy (قیمت کا فرق)",
        EXPIRY: "Expired or near expiry (میعاد ختم یا قریب)",
        OTHER: "Other reason (دیگر وجوہات)",
      };

      const finalReason = customNotes.trim()
        ? `${categoryLabels[reasonCategory] || reasonCategory}: ${customNotes.trim()}`
        : categoryLabels[reasonCategory] || "Vendor merchandise return";

      const res = await fetch(`/api/purchases/${purchase.id}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: finalReason,
          items: itemsPayload,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to process purchase return");
      }

      onSuccess(json.data);
      onClose();
    } catch (err: any) {
      console.error("Purchase return error:", err);
      setError(err.message || "Failed to process return. Please check inventory stock.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !purchase) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {t("Debit Note / Purchase Return", "مال کی واپسی و ڈیبٹ نوٹ")}
                </h3>
                <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                  {purchase.purchaseNumber}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t("Supplier:", "سپلائر:")}{" "}
                <strong className="text-slate-700 dark:text-slate-200">{purchase.supplierName}</strong> •{" "}
                {new Date(purchase.date).toLocaleDateString()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {/* Return Reason & Notes */}
          <div className="rounded-xl border border-slate-200/80 p-3.5 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/30 space-y-3">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              {t("Reason for Return to Supplier", "سپلائر کو مال واپسی کی وجہ")}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                value={reasonCategory}
                onChange={(e) => setReasonCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                <option value="DEFECTIVE">{t("💥 Defective / Damaged items", "💥 نقص یا خراب مال")}</option>
                <option value="WRONG_ITEM">{t("📦 Wrong merchandise delivered", "📦 غلط مال موصول ہوا")}</option>
                <option value="QUALITY_ISSUE">{t("⚠️ Poor / Substandard quality", "⚠️ معیار غیر تسلی بخش")}</option>
                <option value="OVERSTOCK">{t("📊 Excess / Overstock quantity", "📊 زیادہ سامان")}</option>
                <option value="PRICE_MISMATCH">{t("💵 Rate / Billing discrepancy", "💵 قیمت کا فرق")}</option>
                <option value="EXPIRY">{t("⏳ Expired or near expiry", "⏳ میعاد ختم یا قریب")}</option>
                <option value="OTHER">{t("📝 Other reason", "📝 دیگر وجوہات")}</option>
              </select>
              <input
                type="text"
                placeholder={t("Additional remarks / debit memo...", "اضافی تفصیل یا وینڈر ریمارکس...")}
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Itemized Selection Table */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  {t("Select Items to Return", "واپسی کے لیے آئٹمز منتخب کریں")}
                </span>
                <span className="text-xs text-slate-400">({itemRows.length} items on bill)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="rounded-md bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 transition"
                >
                  {t("Select All", "تمام واپس کریں")}
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 transition"
                >
                  {t("Clear All", "خالی کریں")}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-3 py-2.5">Item Description</th>
                    <th className="px-3 py-2.5 text-center">Received</th>
                    <th className="px-3 py-2.5 text-center">Already Ret.</th>
                    <th className="px-3 py-2.5 text-center">Available Ret.</th>
                    <th className="px-3 py-2.5 text-center min-w-[140px]">Returning Qty</th>
                    <th className="px-3 py-2.5 text-right">Unit Cost</th>
                    <th className="px-3 py-2.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  {itemRows.map((row) => {
                    const currentQty = returnQtys[row.itemId] || 0;
                    const isSelected = currentQty > 0;
                    const isFullyReturned = row.remainingQuantity === 0;
                    const lineReturnAmt = currentQty * row.unitCost * (1 + (row.taxRate || 0) / 100);

                    return (
                      <tr
                        key={row.itemId}
                        className={`transition-colors ${
                          isFullyReturned
                            ? "bg-slate-50/50 opacity-60 dark:bg-slate-900/50"
                            : isSelected
                            ? "bg-amber-50/40 dark:bg-amber-950/20"
                            : "hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
                        }`}
                      >
                        <td className="px-3 py-2.5 font-medium text-slate-900 dark:text-white">
                          <div className="font-bold">{row.productName}</div>
                          {row.sku && <div className="text-[10px] text-slate-400">SKU: {row.sku}</div>}
                        </td>
                        <td className="px-3 py-2.5 text-center tabular-nums text-slate-600 dark:text-slate-300">
                          {row.purchasedQuantity}
                        </td>
                        <td className="px-3 py-2.5 text-center tabular-nums text-slate-400">
                          {row.alreadyReturned > 0 ? (
                            <span className="font-bold text-rose-600 dark:text-rose-400">
                              {row.alreadyReturned}
                            </span>
                          ) : (
                            "0"
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center tabular-nums font-bold text-slate-700 dark:text-slate-300">
                          {row.remainingQuantity}
                        </td>
                        <td className="px-3 py-2.5">
                          {isFullyReturned ? (
                            <span className="text-[11px] text-slate-400 italic block text-center">
                              Fully Returned
                            </span>
                          ) : (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleQtyChange(row.itemId, currentQty - 1, row.remainingQuantity)}
                                disabled={currentQty <= 0}
                                className="h-7 w-7 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 flex items-center justify-center transition"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <input
                                type="number"
                                min={0}
                                max={row.remainingQuantity}
                                step="any"
                                value={currentQty || ""}
                                onChange={(e) =>
                                  handleQtyChange(row.itemId, parseFloat(e.target.value) || 0, row.remainingQuantity)
                                }
                                placeholder="0"
                                className="w-16 h-7 rounded-lg border border-slate-300 bg-white text-center text-xs font-black text-slate-900 shadow-2xs focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                              />
                              <button
                                type="button"
                                onClick={() => handleQtyChange(row.itemId, currentQty + 1, row.remainingQuantity)}
                                disabled={currentQty >= row.remainingQuantity}
                                className="h-7 w-7 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 flex items-center justify-center transition"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-600 dark:text-slate-300">
                          Rs {row.unitCost.toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                          Rs {lineReturnAmt.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 4-Card Live Financial Impact Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
              <span className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300 block">
                {t("Total Return Value", "کل واپسی مالیت")}
              </span>
              <span className="text-base sm:text-lg font-black font-mono text-amber-950 dark:text-amber-100 mt-1 block">
                Rs {totalReturnAmount.toLocaleString()}
              </span>
              <span className="text-[10px] text-amber-700/80 dark:text-amber-400 mt-0.5 block">
                {totalUnitsReturning} units ({selectedItemsCount} items)
              </span>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300 block">
                {t("Payable Reduction", "قرض میں کمی (ڈیبٹ نوٹ)")}
              </span>
              <span className="text-base sm:text-lg font-black font-mono text-emerald-950 dark:text-emerald-100 mt-1 block">
                -Rs {payableReduction.toLocaleString()}
              </span>
              <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400 mt-0.5 block">
                Debit Note applied
              </span>
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-900/50 dark:bg-blue-950/20">
              <span className="text-[10px] font-bold uppercase text-blue-700 dark:text-blue-300 block">
                {t("Cash/Bank Refund", "نقد / بینک واپسی")}
              </span>
              <span className="text-base sm:text-lg font-black font-mono text-blue-950 dark:text-blue-100 mt-1 block">
                +Rs {cashRefund.toLocaleString()}
              </span>
              <span className="text-[10px] text-blue-700/80 dark:text-blue-400 mt-0.5 block">
                {cashRefund > 0 ? "Received from vendor" : "No refund needed"}
              </span>
            </div>

            <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3 dark:border-rose-900/50 dark:bg-rose-950/20">
              <span className="text-[10px] font-bold uppercase text-rose-700 dark:text-rose-300 block">
                {t("Stock Deduction", "انوینٹری کمی")}
              </span>
              <span className="text-base sm:text-lg font-black font-mono text-rose-950 dark:text-rose-100 mt-1 block">
                -{totalUnitsReturning} Units
              </span>
              <span className="text-[10px] text-rose-700/80 dark:text-rose-400 mt-0.5 block">
                Outward to supplier
              </span>
            </div>
          </div>

          {/* Double Entry Accounting Preview */}
          <div className="rounded-xl border border-slate-200/90 p-3 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/50 text-[11px] space-y-1.5">
            <div className="font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>{t("Balanced Double-Entry Journal Preview:", "ڈبل انٹری کھاتہ:")}</span>
              <span className="text-[10px] text-slate-400 font-mono">
                {isFullBillReturn ? "Full Return" : "Partial Debit Note"}
              </span>
            </div>
            <div className="font-mono space-y-1 text-slate-600 dark:text-slate-400">
              {payableReduction > 0 && (
                <div className="flex justify-between">
                  <span>Debit: 2010 Accounts Payable (سپلائر کے واجبات میں کمی)</span>
                  <span className="font-bold text-slate-900 dark:text-slate-200">
                    Rs {payableReduction.toLocaleString()}
                  </span>
                </div>
              )}
              {cashRefund > 0 && (
                <div className="flex justify-between">
                  <span>
                    Debit: {purchase.paymentMethod === "BANK" ? "1020 Bank Account" : "1010 Cash in Hand"} (نقد رقم
                    واپسی)
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-200">
                    Rs {cashRefund.toLocaleString()}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Credit: 1200 Merchandise Inventory (تجارتی مال میں کمی)</span>
                <span className="font-bold text-slate-900 dark:text-slate-200">
                  Rs {totalReturnAmount.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 shrink-0">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            {t("Cancel", "منسوخ")}
          </Button>

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || totalUnitsReturning <= 0}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold gap-2 shadow-sm"
          >
            {submitting ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>{t("Processing Return...", "واپسی ریکارڈ ہو رہی ہے...")}</span>
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4" />
                <span>
                  {t(
                    `Issue Debit Note (Rs ${totalReturnAmount.toLocaleString()})`,
                    `ڈیبٹ نوٹ جاری کریں (Rs ${totalReturnAmount.toLocaleString()})`
                  )}
                </span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
