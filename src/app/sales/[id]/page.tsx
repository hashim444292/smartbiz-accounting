"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { formatMoney } from "@/lib/decimal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Printer, RotateCcw } from "lucide-react";
import { BrandPageLoader } from "@/components/ui/loader";

export default function SaleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [sale, setSale] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSale() {
      try {
        const res = await fetch(`/api/sales/${params.id}`);
        const json = await res.json();
        if (json.success) {
          setSale(json.data);
        } else {
          // fallback to list
          const listRes = await fetch(`/api/sales`);
          const listJson = await listRes.json();
          if (listJson.success) {
            const found = listJson.data.find((s: any) => s.id === params.id);
            setSale(found);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    if (params.id) fetchSale();
  }, [params.id]);

  if (loading) {
    return (
      <BrandPageLoader
        message="Loading Invoice Details..."
        submessage="Retrieving customer ledger, line items, taxes, and FBR QR certificate..."
      />
    );
  }

  if (!sale) {
    return (
      <div className="p-8 text-center text-xs text-rose-500">
        Invoice not found. <Link href="/sales" className="underline">Go back to sales</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Top Controls (Hidden on Print) */}
      <div className="flex items-center justify-between print:hidden">
        <Link
          href="/sales"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Sales</span>
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5 mr-1" />
            Print Invoice
          </Button>
        </div>
      </div>

      {/* Edited Warning Banner */}
      {sale.isEdited && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200 shadow-xs">
          <div className="flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-amber-950 dark:text-amber-100">
                  Edited Invoice Notice (ترمیم شدہ انوائس)
                </span>
                <span className="rounded-md bg-amber-200/80 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:bg-amber-900/80 dark:text-amber-200">
                  Edited {sale.editCount || 1} time{sale.editCount > 1 ? "s" : ""}
                </span>
              </div>
              <p className="text-amber-800 dark:text-amber-300">
                This invoice was modified after initial issuance. <strong>Last edited by:</strong> {sale.updatedByName || "Staff"} on {sale.updatedAt ? new Date(sale.updatedAt).toLocaleString() : "Recently"}.
              </p>
              {sale.editReason && (
                <p className="rounded-lg bg-amber-100/70 p-2 text-xs italic text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                  <strong>Reason for modification:</strong> &ldquo;{sale.editReason}&rdquo;
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Invoice Document Box */}
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 print:border-none print:shadow-none print:p-0">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 pb-6 dark:border-slate-800">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-blue-600">SmartBiz</h1>
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">Trading & Distribution</p>
            <p className="text-[11px] text-slate-500">Suite 402, Trade Tower, Karachi</p>
            <p className="text-[11px] text-slate-500">Phone: +92 300 1234567</p>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-1.5 flex-wrap">
              <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                SALE INVOICE
              </span>
              {sale.isEdited && (
                <span className="rounded-lg bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  ✏️ EDITED
                </span>
              )}
            </div>
            <p className="mt-2 text-base font-bold text-slate-900 dark:text-white">{sale.invoiceNumber}</p>
            <p className="text-xs text-slate-500">Date: {new Date(sale.date).toLocaleDateString()}</p>
            <div className="mt-1">
              <Badge variant={sale.paymentStatus === "PAID" ? "success" : sale.paymentStatus === "PARTIAL" ? "warning" : "danger"}>
                {sale.paymentStatus}
              </Badge>
            </div>
          </div>
        </div>

        {/* Bill To */}
        <div className="py-6 border-b border-slate-100 dark:border-slate-800">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Billed To:</p>
          <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{sale.customerName}</p>
          {sale.customer?.phone && <p className="text-xs text-slate-500">Phone: {sale.customer.phone}</p>}
          {sale.customer?.address && <p className="text-xs text-slate-500">{sale.customer.address}</p>}
        </div>

        {/* Items Table */}
        <div className="py-6">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500 dark:border-slate-800">
              <tr>
                <th className="pb-2">Item Description</th>
                <th className="pb-2 text-center">Qty</th>
                <th className="pb-2 text-right">Unit Price</th>
                <th className="pb-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sale.items?.map((item: any, i: number) => (
                <tr key={i}>
                  <td className="py-3 pr-2">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{item.productName}</p>
                    {item.sku && <p className="text-[10px] text-slate-400">SKU: {item.sku}</p>}
                  </td>
                  <td className="py-3 px-2 text-center tabular-nums">{item.quantity}</td>
                  <td className="py-3 px-2 text-right tabular-nums">{formatMoney(item.unitPrice)}</td>
                  <td className="py-3 pl-2 text-right font-bold text-slate-900 dark:text-white tabular-nums">
                    {formatMoney(item.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="border-t border-slate-200 pt-4 space-y-2 text-xs dark:border-slate-800">
          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <span>Subtotal</span>
            <span className="font-semibold tabular-nums">{formatMoney(sale.subtotal)}</span>
          </div>
          {Number(sale.discountAmount) > 0 && (
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Discount</span>
              <span className="tabular-nums">-{formatMoney(sale.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold text-slate-900 dark:text-white pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>Grand Total</span>
            <span className="text-blue-600 dark:text-blue-400 tabular-nums">{formatMoney(sale.totalAmount)}</span>
          </div>
          <div className="flex justify-between text-emerald-600 font-semibold">
            <span>Amount Paid ({sale.paymentMethod})</span>
            <span className="tabular-nums">{formatMoney(sale.paidAmount)}</span>
          </div>
          <div className="flex justify-between text-rose-600 font-bold">
            <span>Remaining Balance Due</span>
            <span className="tabular-nums">{formatMoney(sale.remainingAmount)}</span>
          </div>
        </div>

        {/* Notes */}
        {sale.notes && (
          <div className="mt-6 rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
            <span className="font-semibold">Notes: </span>
            {sale.notes}
          </div>
        )}

        {/* User Attribution & Audit Trail Footer */}
        <div className="mt-8 rounded-xl border border-slate-100 bg-slate-50/70 p-4 text-xs dark:border-slate-800 dark:bg-slate-800/40">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Generated / Created By:</p>
              <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                {sale.createdByName || "System Admin"}
              </p>
              <p className="text-[10px] text-slate-400">{new Date(sale.date).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Branch Location:</p>
              <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                {sale.branch?.name || "Main Branch"}
              </p>
              <p className="text-[10px] text-slate-400">Code: {sale.branch?.code || "HQ"}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Audit Status:</p>
              <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 flex items-center gap-1">
                {sale.isEdited ? (
                  <span className="text-amber-600 font-bold">
                    ✏️ Edited ({sale.editCount || 1}x)
                  </span>
                ) : (
                  <span className="text-emerald-600 font-semibold">
                    ✓ Original (Unmodified)
                  </span>
                )}
              </p>
              {sale.isEdited && sale.updatedByName && (
                <p className="text-[10px] text-slate-500">By {sale.updatedByName}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
