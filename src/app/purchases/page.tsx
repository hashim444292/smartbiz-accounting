"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/decimal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Search, Eye, Download, UploadCloud, FileSpreadsheet, Pencil } from "lucide-react";
import { TableRowsSkeleton } from "@/components/ui/loader";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Edit Purchase State & User Tracking
  const [editingPurchase, setEditingPurchase] = useState<any | null>(null);
  const [editSupplierName, setEditSupplierName] = useState("");
  const [editPaymentStatus, setEditPaymentStatus] = useState<"PAID" | "PARTIAL" | "UNPAID">("PAID");
  const [editPaidAmount, setEditPaidAmount] = useState<number>(0);
  const [editNotes, setEditNotes] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const fetchPurchases = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/purchases");
      const json = await res.json();
      if (json.success) setPurchases(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, []);

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
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{p.supplierName}</td>
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
                      <button
                        onClick={() => openEditModal(p)}
                        className="rounded-lg p-1.5 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-800 dark:hover:bg-indigo-950/40"
                        title="Edit Purchase Bill"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
