"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/decimal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Search,
  Eye,
  Download,
  UploadCloud,
  FileSpreadsheet,
  Pencil,
  Building2,
  Printer,
  Package,
  CheckCircle2,
  Receipt,
  FileText,
} from "lucide-react";
import { TableRowsSkeleton } from "@/components/ui/loader";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { smartFetch, invalidateCache } from "@/lib/clientCache";

export default function PurchasesPage() {
  const { user, activeCompany, branches, selectedBranch, activeBranchId, isBranchLocked } = useAuth();
  const effectiveBranch = isBranchLocked ? user?.branchId : (selectedBranch?.id || activeBranchId || null);

  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Inspect / View Bill Slip State
  const [viewingPurchase, setViewingPurchase] = useState<any | null>(null);

  // Edit Purchase State & User Tracking
  const [editingPurchase, setEditingPurchase] = useState<any | null>(null);
  const [editSupplierName, setEditSupplierName] = useState("");
  const [editPaymentStatus, setEditPaymentStatus] = useState<"PAID" | "PARTIAL" | "UNPAID">("PAID");
  const [editPaidAmount, setEditPaidAmount] = useState<number>(0);
  const [editNotes, setEditNotes] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const printPurchaseSlip = (p: any) => {
    if (!p) return;
    const companyName = activeCompany?.name || "SmartBiz Accounting";
    const branchName =
      p.branch?.name ||
      (effectiveBranch
        ? branches.find((b) => b.id === effectiveBranch)?.name
        : "Main Warehouse / Central Store");

    const printWindow = window.open("", "_blank", "width=850,height=900");
    if (!printWindow) {
      alert("Please allow popups to print the purchase bill slip.");
      return;
    }

    const itemsRows = (p.items || [])
      .map(
        (it: any, i: number) => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px; text-align: center; color: #64748b; font-size: 12px;">${i + 1}</td>
          <td style="padding: 10px;">
            <div style="font-weight: 700; color: #0f172a; font-size: 13px;">${it.productName || "Product Item"}</div>
            ${it.sku ? `<div style="font-size: 11px; color: #64748b;">SKU / Code: ${it.sku}</div>` : ""}
          </td>
          <td style="padding: 10px; text-align: center; font-weight: 700; font-size: 13px; color: #0f172a;">
            ${Number(it.quantity || 0).toLocaleString()}
          </td>
          <td style="padding: 10px; text-align: right; font-size: 12px; color: #334155;">
            Rs ${Number(it.unitCost || 0).toLocaleString()}
          </td>
          <td style="padding: 10px; text-align: right; font-weight: 700; font-size: 13px; color: #0f172a;">
            Rs ${Number(it.lineTotal || 0).toLocaleString()}
          </td>
          <td style="padding: 10px; text-align: center;">
            <div style="width: 18px; height: 18px; border: 1.5px solid #94a3b8; border-radius: 4px; margin: 0 auto;"></div>
          </td>
        </tr>
      `
      )
      .join("");

    const statusBg =
      p.paymentStatus === "PAID" ? "#f0fdf4" : p.paymentStatus === "PARTIAL" ? "#fffbeb" : "#fef2f2";
    const statusColor =
      p.paymentStatus === "PAID" ? "#15803d" : p.paymentStatus === "PARTIAL" ? "#b45309" : "#b91c1c";

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Purchase Inward Slip - ${p.purchaseNumber}</title>
          <style>
            @page { size: A4; margin: 15mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 24px; font-size: 12px; line-height: 1.4; }
            .header-bar { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start; }
            .company-name { font-size: 22px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; letter-spacing: -0.5px; }
            .doc-tag { font-size: 13px; font-weight: 700; color: #475569; text-transform: uppercase; margin-top: 2px; }
            .badge { display: inline-block; padding: 3px 8px; border-radius: 6px; font-weight: 700; font-size: 11px; text-transform: uppercase; border: 1px solid; }
            .info-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th { background: #f1f5f9; color: #334155; font-weight: 700; text-transform: uppercase; font-size: 11px; padding: 8px 10px; border-bottom: 2px solid #cbd5e1; }
            .summary-box { width: 340px; margin-left: auto; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; padding: 12px 16px; margin-bottom: 30px; }
            .summary-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
            .total-row { display: flex; justify-content: space-between; padding: 8px 0; border-top: 1.5px solid #cbd5e1; border-bottom: 1.5px solid #cbd5e1; margin: 6px 0; font-size: 14px; font-weight: 800; }
            .sign-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; margin-top: 40px; padding-top: 20px; }
            .sign-block { border-top: 1.5px solid #94a3b8; text-align: center; padding-top: 6px; font-size: 11px; font-weight: 600; color: #475569; }
          </style>
        </head>
        <body>
          <div class="header-bar">
            <div>
              <div class="company-name">${companyName}</div>
              <div style="font-size: 12px; color: #475569; margin-top: 2px;">📍 Branch / Outlet: ${branchName}</div>
              <div class="doc-tag">INWARD GOODS RECEIVING NOTE & PURCHASE BILL (خریداری و وصولی بل)</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 17px; font-weight: 800; color: #0f172a;">${p.purchaseNumber}</div>
              <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Date: ${new Date(p.date).toLocaleDateString()}</div>
              <div style="margin-top: 6px;">
                <span class="badge" style="background: ${statusBg}; color: ${statusColor}; border-color: ${statusColor};">
                  ${p.paymentStatus}
                </span>
              </div>
            </div>
          </div>

          <div class="info-grid">
            <div>
              <div style="color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase;">Supplier Details (سپلائر)</div>
              <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 2px;">${p.supplierName}</div>
              ${p.supplier?.phone ? `<div style="color: #475569; margin-top: 2px;">📞 Phone: ${p.supplier.phone}</div>` : ""}
              ${p.supplier?.address ? `<div style="color: #475569; margin-top: 2px;">🏢 Address: ${p.supplier.address}</div>` : ""}
            </div>
            <div style="text-align: right;">
              <div style="color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase;">Record Details (ریکارڈ اندراج)</div>
              <div style="margin-top: 2px;"><strong>Entered By:</strong> ${p.createdByName || "System Admin"}</div>
              <div style="margin-top: 2px;"><strong>Payment Method:</strong> ${p.paymentMethod || "CASH"}</div>
              ${p.notes ? `<div style="margin-top: 2px; color: #475569; font-style: italic;"><strong>Notes:</strong> ${p.notes}</div>` : ""}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 35px; text-align: center;">#</th>
                <th style="text-align: left;">Item Description & Catalog SKU</th>
                <th style="width: 100px; text-align: center;">Qty Received (تعداد)</th>
                <th style="width: 120px; text-align: right;">Unit Cost (لاگت)</th>
                <th style="width: 130px; text-align: right;">Line Total (کل رقم)</th>
                <th style="width: 80px; text-align: center;">Stock Tally</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows || `<tr><td colspan="6" style="padding: 16px; text-align: center; color: #94a3b8;">No line item records.</td></tr>`}
            </tbody>
          </table>

          <div class="summary-box">
            <div class="summary-row">
              <span style="color: #64748b;">Subtotal:</span>
              <span style="font-weight: 600;">Rs ${Number(p.subtotal || p.totalAmount || 0).toLocaleString()}</span>
            </div>
            ${Number(p.discountAmount || 0) > 0 ? `
            <div class="summary-row">
              <span style="color: #64748b;">Overall Discount:</span>
              <span style="color: #16a34a; font-weight: 600;">- Rs ${Number(p.discountAmount).toLocaleString()}</span>
            </div>` : ""}
            ${Number(p.taxAmount || 0) > 0 ? `
            <div class="summary-row">
              <span style="color: #64748b;">Tax:</span>
              <span style="font-weight: 600;">+ Rs ${Number(p.taxAmount).toLocaleString()}</span>
            </div>` : ""}
            <div class="total-row">
              <span>Total Bill (کل خریداری بل):</span>
              <span>Rs ${Number(p.totalAmount || 0).toLocaleString()}</span>
            </div>
            <div class="summary-row" style="color: #15803d; font-weight: 700;">
              <span>Amount Paid (ادا شدہ رقم):</span>
              <span>Rs ${Number(p.paidAmount || 0).toLocaleString()}</span>
            </div>
            <div class="summary-row" style="color: #b91c1c; font-weight: 700;">
              <span>Remaining Payable (بقیہ واجب الادا):</span>
              <span>Rs ${Number(p.remainingAmount || 0).toLocaleString()}</span>
            </div>
          </div>

          <div class="sign-grid">
            <div class="sign-block">
              Physical Stock Tallied & Received By<br />
              <span style="font-size: 10px; font-weight: normal; color: #64748b;">(گودام / دکان انچارج دستخط)</span>
            </div>
            <div class="sign-block">
              Accounting & Purchase Entry Verified<br />
              <span style="font-size: 10px; font-weight: normal; color: #64748b;">(اکاؤنٹس مہر و دستخط)</span>
            </div>
            <div class="sign-block">
              Authorized Signatory<br />
              <span style="font-size: 10px; font-weight: normal; color: #64748b;">(مالک / مینیجر دستخط)</span>
            </div>
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const fetchPurchases = async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (activeCompany?.id) headers["x-business-id"] = activeCompany.id;
      if (effectiveBranch) headers["x-branch-id"] = effectiveBranch;
      const query = effectiveBranch ? `?branchId=${effectiveBranch}` : "?branchId=all";

      const json = await smartFetch(`/api/purchases${query}`, { headers, ttlMs: 20000 });
      if (json.success) setPurchases(json.data);
    } catch (err) {
      console.error("Failed to load purchases:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, [activeCompany?.id, effectiveBranch]);

  const openEditModal = (purchase: any) => {
    setEditingPurchase(purchase);
    setEditSupplierName(purchase.supplierName || "");
    setEditPaymentStatus(purchase.paymentStatus || "PAID");
    setEditPaidAmount(Number(purchase.paidAmount || 0));
    setEditNotes(purchase.notes || "");
    setEditReason("");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPurchase) return;
    if (!editReason.trim()) {
      alert("Please provide an edit reason (ترمیم کی وجہ درج کرنا لازمی ہے).");
      return;
    }
    setEditSaving(true);
    try {
      const res = await fetch(`/api/purchases/${editingPurchase.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierName: editSupplierName,
          paidAmount: editPaidAmount,
          paymentStatus: editPaymentStatus,
          notes: editNotes,
          editReason: editReason.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        alert("Purchase bill updated successfully. Audit trail recorded.");
        setEditingPurchase(null);
        invalidateCache("/api/purchases");
        invalidateCache("/api/dashboard");
        fetchPurchases();
      } else {
        alert(json.error || "Failed to update purchase bill");
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setEditSaving(false);
    }
  };

  const exportPurchasesCsv = () => {
    if (purchases.length === 0) {
      alert("No purchase bills available to export.");
      return;
    }
    const headers = [
      "Purchase Number",
      "Date",
      "Supplier Name",
      "Total Amount",
      "Paid Amount",
      "Payable Balance",
      "Payment Status",
      "Payment Method",
      "Items Count",
    ];
    const rows = purchases.map((p) => [
      `"${p.purchaseNumber || ""}"`,
      `"${new Date(p.date).toISOString().slice(0, 10)}"`,
      `"${(p.supplierName || "").replace(/"/g, '""')}"`,
      Number(p.totalAmount || 0),
      Number(p.paidAmount || 0),
      Number(p.remainingAmount || 0),
      `"${p.paymentStatus || "UNPAID"}"`,
      `"${p.paymentMethod || "CASH"}"`,
      p.items?.length || 1,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `purchase_bills_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filtered = purchases.filter(
    (p) =>
      p.purchaseNumber?.toLowerCase().includes(search.toLowerCase()) ||
      p.supplierName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Purchases & Inward Stock</h2>
          <p className="text-xs text-slate-500">Manage supplier bills, inward stock additions, and payables</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Download / Export CSV */}
          <button
            onClick={exportPurchasesCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            title="Export all purchase bills to CSV file"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          {/* Bulk Import CSV */}
          <Link
            href="/purchases/import"
            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-2 text-xs font-semibold text-indigo-700 shadow-xs hover:bg-indigo-100 transition dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-300"
          >
            <UploadCloud className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Bulk Import (CSV)</span>
          </Link>

          {/* Add Purchase (Primary Button) */}
          <Link href="/purchases/create">
            <Button variant="primary" size="md" className="gap-1.5 shadow-sm">
              <Plus className="h-4 w-4" />
              <span>Add Purchase</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Active Branch Scope Indicator Banner */}
      <div className="flex items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-2.5 text-xs text-indigo-950 dark:border-indigo-900/50 dark:bg-indigo-950/20 dark:text-indigo-200">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <span>
            Current Outlet Scope:{" "}
            <strong>
              {isBranchLocked
                ? `${user?.branchName || "Assigned Outlet"} (Fixed Staff Access)`
                : effectiveBranch
                ? branches.find((b) => b.id === effectiveBranch)?.name || "Filtered Outlet"
                : "All Outlets (Consolidated Master View)"}
            </strong>
          </span>
        </div>
        {isBranchLocked ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
            🔒 Branch Restricted
          </span>
        ) : (
          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300">
            👑 Owner Multi-Outlet View
          </span>
        )}
      </div>

      {/* Financial Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold text-slate-500">Total Purchase Bills (کل انوائسز)</p>
          <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white tabular-nums">
            {purchases.length}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Recorded inward purchase bills</p>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 shadow-xs dark:border-blue-900/40 dark:bg-blue-950/20">
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">Total Purchases Value (کل خریداری)</p>
          <p className="mt-1 text-2xl font-black text-blue-900 dark:text-blue-100 tabular-nums">
            {formatMoney(purchases.reduce((acc, p) => acc + Number(p.totalAmount || 0), 0))}
          </p>
          <p className="text-[11px] text-blue-600/70 dark:text-blue-400 mt-0.5">Gross purchased merchandise</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 shadow-xs dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Total Paid (ادا شدہ رقم)</p>
          <p className="mt-1 text-2xl font-black text-emerald-900 dark:text-emerald-100 tabular-nums">
            {formatMoney(purchases.reduce((acc, p) => acc + Number(p.paidAmount || 0), 0))}
          </p>
          <p className="text-[11px] text-emerald-600/70 dark:text-emerald-400 mt-0.5">Settled to suppliers</p>
        </div>
        <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4 shadow-xs dark:border-rose-900/40 dark:bg-rose-950/20">
          <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">Remaining Payables (بقیہ واجب الادا)</p>
          <p className="mt-1 text-2xl font-black text-rose-900 dark:text-rose-100 tabular-nums">
            {formatMoney(purchases.reduce((acc, p) => acc + Number(p.remainingAmount || 0), 0))}
          </p>
          <p className="text-[11px] text-rose-600/70 dark:text-rose-400 mt-0.5">Outstanding supplier balances</p>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by purchase # or supplier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-slate-50 pl-9 pr-3 py-1.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Purchase #</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Created By (بنایا گیا)</th>
                <th className="px-4 py-3 text-right">Total Cost</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-right">Payable Balance</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <TableRowsSkeleton rows={6} cols={9} />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-xs text-slate-400">
                    No purchase bills found. Click "Record Purchase Bill" to add incoming stock.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-semibold text-blue-600 dark:text-blue-400">
                      <div className="flex flex-col gap-1 items-start">
                        <span>{p.purchaseNumber}</span>
                        {p.isEdited && (
                          <span
                            className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 cursor-help"
                            title={`⚠️ Edited purchase bill (${p.editCount || 1}x)\nLast edited by: ${p.updatedByName || "User"}\nReason: ${p.editReason || "Modified"}\nDate: ${p.updatedAt ? new Date(p.updatedAt).toLocaleString() : ""}`}
                          >
                            <span>✏️ Edited</span>
                            {(p.editCount || 1) > 1 && <span className="text-[9px]">({p.editCount}x)</span>}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">{new Date(p.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                      <div>{p.supplierName}</div>
                      {p.branch?.name && (
                        <span className="inline-block mt-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                          📍 {p.branch.name}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                          {(p.createdByName || "A").slice(0, 1).toUpperCase()}
                        </div>
                        <div className="leading-tight">
                          <p className="text-xs font-semibold text-slate-900 dark:text-white">
                            {p.createdByName || "System Admin"}
                          </p>
                          {p.isEdited && (
                            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                              ✏️ {p.updatedByName || "Admin"}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white tabular-nums">
                      {formatMoney(p.totalAmount)}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-600 font-semibold tabular-nums">
                      {formatMoney(p.paidAmount)}
                    </td>
                    <td className="px-4 py-3 text-right text-rose-600 font-semibold tabular-nums">
                      {formatMoney(p.remainingAmount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={p.paymentStatus === "PAID" ? "success" : p.paymentStatus === "PARTIAL" ? "warning" : "danger"}>
                        {p.paymentStatus}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setViewingPurchase(p)}
                          className="flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/60 transition-colors"
                          title="Inspect Bill Slip & Tally Inventory (بل دیکھیں اور اسٹاک ٹیلی کریں)"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>View Slip</span>
                        </button>
                        <button
                          onClick={() => openEditModal(p)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:text-slate-400 transition-colors"
                          title="Edit Purchase Bill"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Purchase Inward Slip & Physical Inventory Tally Modal */}
      {viewingPurchase && (
        <Modal
          isOpen={!!viewingPurchase}
          onClose={() => setViewingPurchase(null)}
          title={`Purchase Bill Slip #${viewingPurchase.purchaseNumber}`}
          description="Inward stock goods receiving note, inventory tally breakdown, and supplier payment ledger."
          maxWidth="4xl"
        >
          <div className="space-y-6">
            {/* Top Action Ribbon */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/60">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    {activeCompany?.name || "Business"} — {viewingPurchase.purchaseNumber}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Recorded on {new Date(viewingPurchase.date).toLocaleDateString()} by {viewingPurchase.createdByName || "Staff"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => printPurchaseSlip(viewingPurchase)}
                  className="gap-1.5 shadow-sm"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print Bill Slip (پرنٹ کریں)</span>
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const p = viewingPurchase;
                    setViewingPurchase(null);
                    openEditModal(p);
                  }}
                  className="gap-1.5"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span>Edit Bill</span>
                </Button>
              </div>
            </div>

            {/* Bill & Supplier Meta Card */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800 dark:bg-slate-900">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Supplier / Vendor (سپلائر):</span>
                <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                  {viewingPurchase.supplierName}
                </p>
                {viewingPurchase.supplier?.phone && (
                  <p className="text-xs text-slate-500 mt-0.5">📞 Phone: {viewingPurchase.supplier.phone}</p>
                )}
                {viewingPurchase.supplier?.address && (
                  <p className="text-xs text-slate-500 mt-0.5">🏢 Address: {viewingPurchase.supplier.address}</p>
                )}
              </div>
              <div className="sm:text-right space-y-1">
                <div className="flex sm:justify-end items-center gap-2">
                  <span className="text-xs text-slate-500">Payment Status:</span>
                  <Badge variant={viewingPurchase.paymentStatus === "PAID" ? "success" : viewingPurchase.paymentStatus === "PARTIAL" ? "warning" : "danger"}>
                    {viewingPurchase.paymentStatus}
                  </Badge>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  <span className="text-slate-400">Receiving Branch:</span>{" "}
                  <strong>{viewingPurchase.branch?.name || (effectiveBranch ? branches.find((b) => b.id === effectiveBranch)?.name : "Main Warehouse")}</strong>
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  <span className="text-slate-400">Payment Method:</span>{" "}
                  <strong>{viewingPurchase.paymentMethod || "CASH"}</strong>
                </p>
              </div>
            </div>

            {/* Items Tally Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-indigo-500" />
                  <span>Itemized Inward Stock Received (اسٹاک وصولی تفصیلات)</span>
                </h4>
                <span className="text-[11px] text-slate-400">
                  {viewingPurchase.items?.length || 0} Line Items
                </span>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-3 py-2.5 text-center w-10">#</th>
                      <th className="px-3 py-2.5">Product Description & SKU</th>
                      <th className="px-3 py-2.5 text-center">Qty Inwarded (تعداد)</th>
                      <th className="px-3 py-2.5 text-right">Unit Cost (لاگت)</th>
                      <th className="px-3 py-2.5 text-right">Line Total (کل رقم)</th>
                      <th className="px-3 py-2.5 text-center">Stock Tally (تصدیق)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {viewingPurchase.items && viewingPurchase.items.length > 0 ? (
                      viewingPurchase.items.map((it: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="px-3 py-2.5 text-center text-slate-400 font-medium">{idx + 1}</td>
                          <td className="px-3 py-2.5">
                            <p className="font-semibold text-slate-900 dark:text-white">{it.productName}</p>
                            {it.sku && <p className="text-[10px] text-slate-400">SKU: {it.sku}</p>}
                          </td>
                          <td className="px-3 py-2.5 text-center font-bold text-slate-900 dark:text-white tabular-nums">
                            {Number(it.quantity || 0).toLocaleString()}
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-600 dark:text-slate-300 tabular-nums">
                            {formatMoney(it.unitCost)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold text-slate-900 dark:text-white tabular-nums">
                            {formatMoney(it.lineTotal)}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Verified</span>
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-xs text-slate-400">
                          No line items recorded for this purchase.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Settlement Breakdown */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-lg bg-white p-3 border border-slate-200/80 dark:bg-slate-900 dark:border-slate-800">
                  <p className="text-[11px] font-bold uppercase text-slate-400">Total Purchase Bill (کل خریداری)</p>
                  <p className="mt-1 text-xl font-black text-slate-900 dark:text-white tabular-nums">
                    {formatMoney(viewingPurchase.totalAmount)}
                  </p>
                </div>
                <div className="rounded-lg bg-emerald-50 p-3 border border-emerald-200/80 dark:bg-emerald-950/30 dark:border-emerald-900/50">
                  <p className="text-[11px] font-bold uppercase text-emerald-700 dark:text-emerald-300">Amount Paid (ادا شدہ رقم)</p>
                  <p className="mt-1 text-xl font-black text-emerald-900 dark:text-emerald-100 tabular-nums">
                    {formatMoney(viewingPurchase.paidAmount)}
                  </p>
                </div>
                <div className="rounded-lg bg-rose-50 p-3 border border-rose-200/80 dark:bg-rose-950/30 dark:border-rose-900/50">
                  <p className="text-[11px] font-bold uppercase text-rose-700 dark:text-rose-300">Remaining Balance (واجب الادا)</p>
                  <p className="mt-1 text-xl font-black text-rose-900 dark:text-rose-100 tabular-nums">
                    {formatMoney(viewingPurchase.remainingAmount)}
                  </p>
                </div>
              </div>
              {viewingPurchase.notes && (
                <p className="mt-3 text-xs text-slate-500 italic bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                  <strong>Notes / Remarks:</strong> {viewingPurchase.notes}
                </p>
              )}
            </div>

            {/* Warehouse Tally / Sign-off Footer */}
            <div className="grid grid-cols-2 gap-4 border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-slate-800">
              <div className="rounded-lg border border-dashed border-slate-300 p-3 text-center dark:border-slate-700">
                <p className="font-semibold text-slate-700 dark:text-slate-300">Physical Stock Tallied By:</p>
                <p className="text-[11px] text-slate-400 mt-4 border-t border-slate-200 pt-1 dark:border-slate-700">
                  Store / Warehouse Incharge Signature
                </p>
              </div>
              <div className="rounded-lg border border-dashed border-slate-300 p-3 text-center dark:border-slate-700">
                <p className="font-semibold text-slate-700 dark:text-slate-300">Accounts & Ledger Verified By:</p>
                <p className="text-[11px] text-slate-400 mt-4 border-t border-slate-200 pt-1 dark:border-slate-700">
                  Manager / Finance Signature
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setViewingPurchase(null)}>
                Close (بند کریں)
              </Button>
              <Button variant="primary" onClick={() => printPurchaseSlip(viewingPurchase)} className="gap-1.5 shadow-sm">
                <Printer className="h-3.5 w-3.5" />
                <span>Print Slip (انوائس سلپ پرنٹ کریں)</span>
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Purchase Bill Modal */}
      {editingPurchase && (
        <Modal
          isOpen={!!editingPurchase}
          onClose={() => setEditingPurchase(null)}
          title={`Edit Purchase Bill #${editingPurchase.purchaseNumber}`}
        >
          <form onSubmit={handleSaveEdit} className="space-y-4">
            {/* Creator Attribution Info Card */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/50">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Original Creator (بنایا گیا بذریعہ):</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {editingPurchase.createdByName || "System Admin"}
                </span>
              </div>
              {editingPurchase.isEdited && (
                <div className="mt-1 flex items-center justify-between text-amber-700 dark:text-amber-300">
                  <span>Previous Edit ({editingPurchase.editCount || 1}x):</span>
                  <span className="font-medium">
                    By {editingPurchase.updatedByName || "Staff"}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Supplier Name
              </label>
              <Input
                value={editSupplierName}
                onChange={(e) => setEditSupplierName(e.target.value)}
                placeholder="Supplier Name"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Status
                </label>
                <select
                  value={editPaymentStatus}
                  onChange={(e) => setEditPaymentStatus(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="PAID">PAID (مکمل ادا)</option>
                  <option value="PARTIAL">PARTIAL (جزوی ادا)</option>
                  <option value="UNPAID">UNPAID (ادھار / واجب الادا)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Paid Amount (Rs)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={editPaidAmount}
                  onChange={(e) => setEditPaidAmount(Number(e.target.value) || 0)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Purchase Notes
              </label>
              <Input
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Additional notes / inward batch notes..."
              />
            </div>

            {/* Required Audit Reason */}
            <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-3 dark:border-amber-800 dark:bg-amber-950/40">
              <label className="block text-xs font-bold text-amber-900 dark:text-amber-200 mb-1">
                Reason for Editing (ترمیم کی وجہ درج کرنا لازمی ہے) *
              </label>
              <p className="text-[11px] text-amber-700 dark:text-amber-400 mb-1.5">
                This modification will be permanently logged in the software Audit Trail along with your name.
              </p>
              <textarea
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="e.g. Corrected invoice payment balance / adjusted notes..."
                rows={2}
                required
                className="w-full rounded-lg border border-amber-300 bg-white p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-slate-900 dark:text-white dark:border-amber-700"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditingPurchase(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={editSaving}
              >
                Save Changes (ترمیم محفوظ کریں)
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
