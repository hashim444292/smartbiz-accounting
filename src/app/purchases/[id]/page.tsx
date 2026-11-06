"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { formatMoney } from "@/lib/decimal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Package, CheckCircle2, Building2, Receipt, RotateCcw } from "lucide-react";
import { BrandPageLoader } from "@/components/ui/loader";
import { PurchaseReturnModal } from "@/components/purchases/PurchaseReturnModal";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

export default function PurchaseDetailPage() {
  const params = useParams();
  const { activeCompany } = useAuth();
  const { t, language } = useLanguage();
  const [purchase, setPurchase] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);

  const fetchPurchase = async () => {
    try {
      const res = await fetch(`/api/purchases/${params.id}`);
      const json = await res.json();
      if (json.success) {
        setPurchase(json.data);
      } else {
        // fallback to main purchases list
        const listRes = await fetch(`/api/purchases`);
        const listJson = await listRes.json();
        if (listJson.success) {
          const found = listJson.data.find(
            (p: any) => p.id === params.id || p.purchaseNumber === params.id
          );
          setPurchase(found);
        }
      }
    } catch (err) {
      console.error("Failed to load purchase:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params.id) fetchPurchase();
  }, [params.id]);

  const handleReturnSuccess = () => {
    fetchPurchase();
  };

  if (loading) {
    return (
      <BrandPageLoader
        message="Loading Purchase Bill Slip..."
        submessage="Retrieving inward items, supplier accounts, and warehouse receiving ledger..."
      />
    );
  }

  if (!purchase) {
    return (
      <div className="max-w-2xl mx-auto p-12 text-center text-xs text-rose-500 space-y-3">
        <p className="text-base font-bold">Purchase Bill Not Found</p>
        <p>The requested purchase bill could not be found or has been removed.</p>
        <Link href="/purchases" className="inline-block text-blue-600 underline font-semibold mt-2">
          ← Back to Purchases & Inward Bills
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Top Controls (Hidden on Print) */}
      <div className="flex items-center justify-between print:hidden">
        <Link
          href="/purchases"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Purchases</span>
        </Link>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={purchase.isAllReturned || purchase.hasReturnableItems === false}
            onClick={() => setIsReturnModalOpen(true)}
            className="gap-1.5 border-amber-300 text-amber-800 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 shadow-sm"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>{t("Return Items / Debit Note", "مال واپس کریں / ڈیبٹ نوٹ")}</span>
          </Button>
          <Button variant="primary" size="sm" onClick={() => window.print()} className="gap-1.5 shadow-sm">
            <Printer className="h-3.5 w-3.5" />
            <span>{t("Print Bill Slip", "پرنٹ واؤچر")}</span>
          </Button>
        </div>
      </div>

      {/* Return Notice Banner */}
      {purchase.totalReturnedAmount && Number(purchase.totalReturnedAmount) > 0 && (
        <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-xs text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200 shadow-xs print:hidden">
          <div className="flex items-start gap-3">
            <span className="text-xl">↺</span>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-rose-950 dark:text-rose-100">
                  {purchase.isAllReturned
                    ? t("Purchase Bill Fully Returned Notice", "مکمل واپس شدہ خریداری انوائس")
                    : t("Partial Purchase Return Notice", "ترمیم و جزوی واپسی شدہ خریداری بل")}
                </span>
                <span className="rounded-md bg-rose-200/80 px-2 py-0.5 text-[10px] font-bold text-rose-900 dark:bg-rose-900/80 dark:text-rose-200">
                  -Rs {Number(purchase.totalReturnedAmount || 0).toLocaleString()} Returned
                </span>
              </div>
              <p className="text-rose-800 dark:text-rose-300">
                Merchandise worth <strong>Rs {Number(purchase.totalReturnedAmount || 0).toLocaleString()}</strong> was returned to {purchase.supplierName}. Physical inventory and supplier payable balances have been updated.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Edited Warning Banner */}
      {purchase.isEdited && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200 shadow-xs print:hidden">
          <div className="flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-amber-950 dark:text-amber-100">
                  {t("Edited Purchase Bill Notice", "ترمیم شدہ خریداری انوائس")}
                </span>
                <span className="rounded-md bg-amber-200/80 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:bg-amber-900/80 dark:text-amber-200">
                  Edited {purchase.editCount || 1} time{purchase.editCount > 1 ? "s" : ""}
                </span>
              </div>
              <p className="text-amber-800 dark:text-amber-300">
                This purchase record was modified after initial inward recording.{" "}
                <strong>Last edited by:</strong> {purchase.updatedByName || "Staff"} on{" "}
                {purchase.updatedAt ? new Date(purchase.updatedAt).toLocaleString() : "Recently"}.
              </p>
              {purchase.editReason && (
                <p className="rounded-lg bg-amber-100/70 p-2 text-xs italic text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                  <strong>Reason for modification:</strong> &ldquo;{purchase.editReason}&rdquo;
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Purchase Document Box */}
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 print:border-none print:shadow-none print:p-0">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 pb-6 dark:border-slate-800">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-blue-600">
              {activeCompany?.name || "SmartBiz"}
            </h1>
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              📍 Branch: {purchase.branch?.name || "Main Warehouse / Central Store"}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              INWARD GOODS RECEIVING NOTE & PURCHASE BILL
            </p>
            {language === "ur" && (
              <p className="text-[11px] font-urdu text-slate-400">سامان کی خریداری اور انوینٹری وصولی رسید</p>
            )}
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-1.5 flex-wrap">
              <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                PURCHASE BILL
              </span>
              {purchase.isEdited && (
                <span className="rounded-lg bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  ✏️ EDITED
                </span>
              )}
            </div>
            <p className="mt-2 text-base font-bold text-slate-900 dark:text-white">
              {purchase.purchaseNumber}
            </p>
            <p className="text-xs text-slate-500">
              Date: {new Date(purchase.date).toLocaleDateString()}
            </p>
            <div className="mt-1">
              <Badge
                variant={
                  purchase.paymentStatus === "PAID"
                    ? "success"
                    : purchase.paymentStatus === "PARTIAL"
                    ? "warning"
                    : "danger"
                }
              >
                {purchase.paymentStatus}
              </Badge>
            </div>
          </div>
        </div>

        {/* Supplier & Entry Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-6 border-b border-slate-100 dark:border-slate-800">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {t("Supplier / Vendor", "سپلائر")}:
            </p>
            <p className="text-base font-bold text-slate-900 dark:text-white mt-1">
              {purchase.supplierName}
            </p>
            {purchase.supplier?.phone && (
              <p className="text-xs text-slate-500 mt-0.5">📞 Phone: {purchase.supplier.phone}</p>
            )}
            {purchase.supplier?.address && (
              <p className="text-xs text-slate-500 mt-0.5">🏢 Address: {purchase.supplier.address}</p>
            )}
          </div>
          <div className="sm:text-right space-y-1">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              <span className="text-slate-400">Entered By:</span>{" "}
              <strong>{purchase.createdByName || "System Admin"}</strong>
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              <span className="text-slate-400">Payment Mode:</span>{" "}
              <strong>{purchase.paymentMethod || "CASH"}</strong>
            </p>
            {purchase.notes && (
              <p className="text-xs text-slate-500 italic mt-1">
                <strong>Notes:</strong> {purchase.notes}
              </p>
            )}
          </div>
        </div>

        {/* Itemized Table */}
        <div className="py-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Package className="h-4 w-4 text-indigo-500" />
              <span>{t("Inward Stock Items", "اسٹاک آئٹمز اور تعداد")}</span>
            </h3>
            <span className="text-xs text-slate-400">
              {purchase.items?.length || 0} line items
            </span>
          </div>

          <div className="overflow-x-auto -mx-2 sm:mx-0 px-2 sm:px-0">
            <table className="w-full text-left text-xs min-w-[560px]">
              <thead className="border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500 dark:border-slate-800">
                <tr>
                  <th className="pb-2 w-10 text-center">#</th>
                  <th className="pb-2">Item Description & Catalog Code</th>
                  <th className="pb-2 text-center">Qty Received</th>
                  <th className="pb-2 text-right">Unit Cost</th>
                  <th className="pb-2 text-right">Line Total</th>
                  <th className="pb-2 text-center w-24">Tally</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {purchase.items?.map((item: any, i: number) => {
                  const qty = Number(item.quantity || 0);
                  const returnedQty = Number(item.returnedQuantity || 0);
                  const remainingQty =
                    item.remainingQuantity !== undefined
                      ? Number(item.remainingQuantity)
                      : Math.max(0, qty - returnedQty);
                  const unitCost = Number(item.unitCost || 0);
                  const lineTotal = Number(item.lineTotal || qty * unitCost);
                  const effectiveUom =
                    item.product?.uom || item.product?.unit || item.uom || "PCS";

                  return (
                    <tr key={i}>
                      <td className="py-3 text-center text-slate-400">{i + 1}</td>
                      <td className="py-3 pr-2">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">
                          {item.productName}
                        </p>
                        {item.sku && <p className="text-[10px] text-slate-400">SKU: {item.sku}</p>}
                        {returnedQty > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900 px-1.5 py-0.5 rounded border border-rose-200 mt-1">
                            ↺ {returnedQty} {effectiveUom} Returned to Vendor ({remainingQty} kept)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-center font-bold text-slate-900 dark:text-white tabular-nums">
                        {returnedQty > 0 ? (
                          <div>
                            <div className="text-emerald-700 dark:text-emerald-300 font-bold">
                              {remainingQty.toLocaleString()}{" "}
                              <span className="text-[10px] uppercase">{effectiveUom}</span>{" "}
                              <span className="text-[10px] text-emerald-600 font-semibold">(kept)</span>
                            </div>
                            <div className="text-[10px] text-slate-400 line-through">
                              {qty.toLocaleString()} {effectiveUom}
                            </div>
                            <div className="text-[10px] text-rose-600 font-semibold">
                              (-{returnedQty} ret)
                            </div>
                          </div>
                        ) : (
                          <div>
                            <span>{qty.toLocaleString()}</span>{" "}
                            <span className="text-[10px] text-slate-500 font-semibold uppercase">
                              {effectiveUom}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right tabular-nums text-slate-600 dark:text-slate-300">
                        {formatMoney(unitCost)}
                      </td>
                      <td className="py-3 pl-2 text-right font-bold text-slate-900 dark:text-white tabular-nums">
                        {returnedQty > 0 ? (
                          <div>
                            <div className="text-emerald-700 dark:text-emerald-300 font-bold">
                              {formatMoney(Math.max(0, (qty - returnedQty) * unitCost))}
                            </div>
                            <div className="text-[10px] text-slate-400 line-through">
                              {formatMoney(lineTotal)}
                            </div>
                            <div className="text-[9px] text-rose-600 font-semibold">
                              (-{formatMoney(returnedQty * unitCost)})
                            </div>
                          </div>
                        ) : (
                          formatMoney(lineTotal)
                        )}
                      </td>
                      <td className="py-3 text-center">
                        {returnedQty >= qty ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                            <span>Returned</span>
                          </span>
                        ) : returnedQty > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <span>Part. Ret</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Verified</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {purchase.items && purchase.items.length > 0 && (
                <tfoot className="border-t-2 border-slate-200 dark:border-slate-700 font-semibold text-xs text-slate-700 dark:text-slate-300 bg-slate-50/70 dark:bg-slate-800/50">
                  <tr>
                    <td colSpan={2} className="py-2.5 px-3 text-right uppercase tracking-wider font-bold">
                      {language === "ur" ? "کل تعداد (ٹوٹل پیسز):" : "Stock Piece Summary:"}
                    </td>
                    <td className="py-2.5 px-2 text-center font-bold tabular-nums">
                      <div className="text-emerald-700 dark:text-emerald-300 font-bold">
                        {purchase.items.reduce(
                          (acc: number, it: any) =>
                            acc +
                            (it.remainingQuantity !== undefined
                              ? Number(it.remainingQuantity)
                              : Math.max(0, Number(it.quantity || 0) - Number(it.returnedQuantity || 0))),
                          0
                        )}{" "}
                        <span className="text-[10px] uppercase">Kept</span>
                      </div>
                      {purchase.items.some((it: any) => Number(it.returnedQuantity || 0) > 0) && (
                        <div className="text-[10px] text-slate-400">
                          (Orig: {purchase.items.reduce((acc: number, it: any) => acc + Number(it.quantity || 0), 0)} | Ret: -
                          {purchase.items.reduce((acc: number, it: any) => acc + Number(it.returnedQuantity || 0), 0)})
                        </div>
                      )}
                    </td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Totals & Settlement */}
        <div className="border-t border-slate-200 pt-4 space-y-2 text-xs dark:border-slate-800 max-w-sm ml-auto">
          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <span>Subtotal:</span>
            <span className="font-semibold tabular-nums">
              {formatMoney(purchase.subtotal || purchase.totalAmount)}
            </span>
          </div>
          {Number(purchase.discountAmount) > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>Overall Discount:</span>
              <span className="font-semibold tabular-nums">
                - {formatMoney(purchase.discountAmount)}
              </span>
            </div>
          )}
          {Number(purchase.taxAmount) > 0 && (
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Tax:</span>
              <span className="font-semibold tabular-nums">
                + {formatMoney(purchase.taxAmount)}
              </span>
            </div>
          )}
          {Number(purchase.totalReturnedAmount || 0) > 0 && (
            <>
              <div className="flex justify-between text-rose-600 font-semibold">
                <span>{t("Merchandise Returned / وینڈر مال واپسی", "وینڈر مال واپسی")}:</span>
                <span className="tabular-nums">- {formatMoney(purchase.totalReturnedAmount)}</span>
              </div>
              <div className="flex justify-between text-slate-400 text-xs">
                <span>{t("Gross Purchase Total", "ابتدائی بل")}:</span>
                <span className="tabular-nums line-through">{formatMoney(purchase.totalAmount)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-900 dark:border-slate-800 dark:text-white">
            <span>
              {Number(purchase.totalReturnedAmount || 0) > 0
                ? t("Net Purchase Total", "خالص بل (وینڈر واجب)")
                : t("Total Bill", "کل خریداری بل")}:
            </span>
            <span className="tabular-nums">
              {formatMoney(
                Math.max(
                  0,
                  Number(purchase.totalAmount) - Number(purchase.totalReturnedAmount || 0)
                )
              )}
            </span>
          </div>
          <div className="flex justify-between text-emerald-600 font-semibold">
            <span>{t("Amount Paid", "ادا شدہ")}:</span>
            <span className="tabular-nums">{formatMoney(purchase.paidAmount)}</span>
          </div>
          <div className="flex justify-between text-rose-600 font-bold border-t border-slate-100 pt-1 dark:border-slate-800">
            <span>{t("Remaining Payable", "بقیہ واجب الادا")}:</span>
            <span className="tabular-nums">{formatMoney(purchase.remainingAmount)}</span>
          </div>
        </div>

        {/* Debit Note & Purchase Return History Audit Card */}
        {purchase.returnHistory && purchase.returnHistory.length > 0 && (
          <div className="border border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20 rounded-xl p-4 mt-6 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-amber-200/60 dark:border-amber-900/40 mb-3 font-bold text-amber-900 dark:text-amber-200">
              <div className="flex items-center gap-1.5">
                <RotateCcw className="h-4 w-4 text-amber-600" />
                <span>{t("Debit Note & Return Record", "ڈیبٹ نوٹ اور وینڈر مال واپسی ریکارڈ")}</span>
              </div>
              <span className="font-mono text-xs text-amber-800 dark:text-amber-300">
                Total Returned: {formatMoney(purchase.totalReturnedAmount || 0)}
              </span>
            </div>
            <div className="space-y-2">
              {purchase.returnHistory.map((hist: any, hIdx: number) => (
                <div
                  key={hIdx}
                  className="bg-white/80 dark:bg-slate-900/80 p-3 rounded-lg border border-amber-100 dark:border-amber-900/30 text-slate-700 dark:text-slate-300 space-y-1.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {new Date(hist.returnedAt || hist.date).toLocaleString()}
                      </span>
                      {hist.reason && (
                        <span className="text-slate-500 ml-2">
                          Reason:{" "}
                          <strong className="text-amber-800 dark:text-amber-300">
                            {hist.reason}
                          </strong>
                        </span>
                      )}
                    </div>
                    <div className="font-mono font-bold text-rose-600">
                      Returned Value: {formatMoney(hist.totalReturnedAmount || 0)}
                    </div>
                  </div>
                  {hist.items && hist.items.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-[10px]">
                      {hist.items.map((it: any, itIdx: number) => (
                        <span
                          key={itIdx}
                          className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-mono text-slate-700 dark:text-slate-300"
                        >
                          {it.productName || `Item #${itIdx + 1}`}: -{it.quantity} @{" "}
                          {formatMoney(it.unitCost)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Physical Stock Signatures */}
        <div className="grid grid-cols-3 gap-6 border-t border-slate-200 mt-10 pt-6 text-xs text-slate-500 dark:border-slate-800">
          <div className="border-t border-slate-300 pt-2 text-center dark:border-slate-700">
            <p className="font-semibold text-slate-700 dark:text-slate-300">
              Stock Received & Tallied By
            </p>
            {language === "ur" && (
              <p className="text-[10px] text-slate-400">(گودام / دکان انچارج دستخط)</p>
            )}
          </div>
          <div className="border-t border-slate-300 pt-2 text-center dark:border-slate-700">
            <p className="font-semibold text-slate-700 dark:text-slate-300">
              Accounts Verification
            </p>
            {language === "ur" && (
              <p className="text-[10px] text-slate-400">(اکاؤنٹس مہر و دستخط)</p>
            )}
          </div>
          <div className="border-t border-slate-300 pt-2 text-center dark:border-slate-700">
            <p className="font-semibold text-slate-700 dark:text-slate-300">Authorized Manager</p>
            {language === "ur" && (
              <p className="text-[10px] text-slate-400">(مجاز اتھارٹی)</p>
            )}
          </div>
        </div>
      </div>

      {/* Purchase Return / Debit Note Modal */}
      {isReturnModalOpen && purchase && (
        <PurchaseReturnModal
          isOpen={isReturnModalOpen}
          onClose={() => setIsReturnModalOpen(false)}
          purchase={purchase}
          onSuccess={handleReturnSuccess}
        />
      )}
    </div>
  );
}
