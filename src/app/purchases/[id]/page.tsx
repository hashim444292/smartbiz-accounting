"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { formatMoney } from "@/lib/decimal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Package, CheckCircle2, Building2, Receipt } from "lucide-react";
import { BrandPageLoader } from "@/components/ui/loader";
import { useAuth } from "@/context/AuthContext";

export default function PurchaseDetailPage() {
  const params = useParams();
  const { activeCompany } = useAuth();
  const [purchase, setPurchase] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPurchase() {
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
    }
    if (params.id) fetchPurchase();
  }, [params.id]);

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
          <Button variant="primary" size="sm" onClick={() => window.print()} className="gap-1.5 shadow-sm">
            <Printer className="h-3.5 w-3.5" />
            <span>Print Bill Slip (پرنٹ واؤچر)</span>
          </Button>
        </div>
      </div>

      {/* Edited Warning Banner */}
      {purchase.isEdited && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200 shadow-xs print:hidden">
          <div className="flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-amber-950 dark:text-amber-100">
                  Edited Purchase Bill Notice (ترمیم شدہ خریداری انوائس)
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
            <p className="text-[11px] font-urdu text-slate-400">سامان کی خریداری اور انوینٹری وصولی رسید</p>
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
              Supplier / Vendor (سپلائر):
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
              <span>Inward Stock Items (اسٹاک آئٹمز اور تعداد)</span>
            </h3>
            <span className="text-xs text-slate-400">
              {purchase.items?.length || 0} line items
            </span>
          </div>

          <table className="w-full text-left text-xs">
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
              {purchase.items?.map((item: any, i: number) => (
                <tr key={i}>
                  <td className="py-3 text-center text-slate-400">{i + 1}</td>
                  <td className="py-3 pr-2">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      {item.productName}
                    </p>
                    {item.sku && <p className="text-[10px] text-slate-400">SKU: {item.sku}</p>}
                  </td>
                  <td className="py-3 px-2 text-center font-bold text-slate-900 dark:text-white tabular-nums">
                    {Number(item.quantity || 0).toLocaleString()}
                  </td>
                  <td className="py-3 px-2 text-right tabular-nums text-slate-600 dark:text-slate-300">
                    {formatMoney(item.unitCost)}
                  </td>
                  <td className="py-3 pl-2 text-right font-bold text-slate-900 dark:text-white tabular-nums">
                    {formatMoney(item.lineTotal)}
                  </td>
                  <td className="py-3 text-center">
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Verified</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
          <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-900 dark:border-slate-800 dark:text-white">
            <span>Total Bill (کل خریداری بل):</span>
            <span className="tabular-nums">{formatMoney(purchase.totalAmount)}</span>
          </div>
          <div className="flex justify-between text-emerald-600 font-semibold">
            <span>Amount Paid (ادا شدہ):</span>
            <span className="tabular-nums">{formatMoney(purchase.paidAmount)}</span>
          </div>
          <div className="flex justify-between text-rose-600 font-bold border-t border-slate-100 pt-1 dark:border-slate-800">
            <span>Remaining Payable (بقیہ واجب الادا):</span>
            <span className="tabular-nums">{formatMoney(purchase.remainingAmount)}</span>
          </div>
        </div>

        {/* Physical Stock Signatures */}
        <div className="grid grid-cols-3 gap-6 border-t border-slate-200 mt-10 pt-6 text-xs text-slate-500 dark:border-slate-800">
          <div className="border-t border-slate-300 pt-2 text-center dark:border-slate-700">
            <p className="font-semibold text-slate-700 dark:text-slate-300">
              Stock Received & Tallied By
            </p>
            <p className="text-[10px] text-slate-400">(گودام / دکان انچارج دستخط)</p>
          </div>
          <div className="border-t border-slate-300 pt-2 text-center dark:border-slate-700">
            <p className="font-semibold text-slate-700 dark:text-slate-300">
              Accounts Verification
            </p>
            <p className="text-[10px] text-slate-400">(اکاؤنٹس مہر و دستخط)</p>
          </div>
          <div className="border-t border-slate-300 pt-2 text-center dark:border-slate-700">
            <p className="font-semibold text-slate-700 dark:text-slate-300">Authorized Manager</p>
            <p className="text-[10px] text-slate-400">(مجاز اتھارٹی)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
