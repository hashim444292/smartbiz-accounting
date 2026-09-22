"use client";

import React, { useEffect, useState } from "react";
import { formatMoney } from "@/lib/decimal";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Receipt, Tag, Download, Pencil, Trash2 } from "lucide-react";
import { TableRowsSkeleton } from "@/components/ui/loader";

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State (New Expense)
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [accountId, setAccountId] = useState("");
  const [paidTo, setPaidTo] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [submitting, setSubmitting] = useState(false);

  // Edit Expense State
  const [editingExpense, setEditingExpense] = useState<any | null>(null);
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAmount, setEditAmount] = useState(0);
  const [editPaidTo, setEditPaidTo] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/expenses");
      const json = await res.json();
      if (json.success) {
        setExpenses(json.data.expenses);
        setCategories(json.data.categories);
        setAccounts(json.data.accounts);
        if (json.data.categories.length > 0) setCategoryId(json.data.categories[0].id);
        if (json.data.accounts.length > 0) setAccountId(json.data.accounts[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId,
          description,
          amount,
          paymentMethod,
          accountId,
          paidTo,
          notes,
          date: new Date(date),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowAddModal(false);
        setDescription("");
        setAmount(0);
        setPaidTo("");
        fetchExpenses();
      } else {
        alert(json.error);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (exp: any) => {
    setEditingExpense(exp);
    setEditCategoryId(exp.categoryId || "");
    setEditDescription(exp.description || "");
    setEditAmount(Number(exp.amount || 0));
    setEditPaidTo(exp.paidTo || "");
    setEditNotes(exp.notes || "");
    setEditReason("");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;
    if (!editReason.trim()) {
      alert("Please provide an edit reason (ترمیم کی وجہ درج کرنا لازمی ہے).");
      return;
    }
    setEditSaving(true);
    try {
      const res = await fetch(`/api/expenses/${editingExpense.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: editCategoryId,
          description: editDescription,
          amount: editAmount,
          paidTo: editPaidTo,
          notes: editNotes,
          editReason: editReason.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        alert("Expense voucher updated. Audit trail recorded.");
        setEditingExpense(null);
        fetchExpenses();
      } else {
        alert(json.error || "Failed to update expense");
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteExpense = async (id: string, description: string) => {
    const reason = prompt(`Are you sure you want to delete expense "${description}"? Enter reason for audit record:`);
    if (!reason) return;
    try {
      const res = await fetch(`/api/expenses/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (json.success) {
        alert("Expense deleted and logged in audit trail.");
        fetchExpenses();
      } else {
        alert(json.error || "Failed to delete expense");
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filtered = expenses.filter((e) => {
    const matchesSearch =
      e.description.toLowerCase().includes(search.toLowerCase()) ||
      (e.paidTo && e.paidTo.toLowerCase().includes(search.toLowerCase())) ||
      e.category?.name.toLowerCase().includes(search.toLowerCase());
    const matchesCat = categoryFilter === "ALL" || e.categoryId === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const totalExpenses = filtered.reduce((acc, e) => acc + Number(e.amount), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Operating Expenses Tracker</h2>
          <p className="text-xs text-slate-500">
            Total Filtered Expenses: <span className="font-bold text-rose-600">{formatMoney(totalExpenses)}</span>
          </p>
        </div>
        <Button variant="danger" size="sm" onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Expense
        </Button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by description or recipient..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-slate-50 pl-9 pr-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Category:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Created By (بنایا گیا)</th>
                <th className="px-4 py-3">Paid To</th>
                <th className="px-4 py-3">Paid From</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <TableRowsSkeleton rows={6} cols={8} />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-slate-400">
                    No expense records found. Click "Add Expense" to record daily business overhead.
                  </td>
                </tr>
              ) : (
                filtered.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3">{new Date(exp.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                        {exp.category?.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      <div className="flex flex-col gap-1 items-start">
                        <span>{exp.description}</span>
                        {exp.isEdited && (
                          <span
                            className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 cursor-help"
                            title={`⚠️ Edited expense voucher (${exp.editCount || 1}x)\nLast edited by: ${exp.updatedByName || "User"}\nReason: ${exp.editReason || "Modified"}\nDate: ${exp.updatedAt ? new Date(exp.updatedAt).toLocaleString() : ""}`}
                          >
                            <span>✏️ Edited</span>
                            {(exp.editCount || 1) > 1 && <span className="text-[9px]">({exp.editCount}x)</span>}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                          {(exp.createdByName || "A").slice(0, 1).toUpperCase()}
                        </div>
                        <div className="leading-tight">
                          <p className="text-xs font-semibold text-slate-900 dark:text-white">
                            {exp.createdByName || "System Admin"}
                          </p>
                          {exp.isEdited && (
                            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                              ✏️ {exp.updatedByName || "Admin"}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{exp.paidTo || "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{exp.account?.name || exp.paymentMethod}</td>
                    <td className="px-4 py-3 text-right font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                      {formatMoney(exp.amount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(exp)}
                          className="rounded-lg p-1.5 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-800 dark:hover:bg-indigo-950/40"
                          title="Edit Expense Voucher"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(exp.id, exp.description)}
                          className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40"
                          title="Delete Expense (Audit Logged)"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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

      {/* Add Expense Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Record Daily Expense">
        <form onSubmit={handleCreateExpense} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Expense Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
            <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <Input label="Description / Purpose" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Electricity bill for September" required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Amount (Rs)" type="number" step="0.01" value={amount} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} required />
            <Input label="Paid To" value={paidTo} onChange={(e) => setPaidTo(e.target.value)} placeholder="e.g. K-Electric / Landlord" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Payment Method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="CASH">Cash in Hand</option>
              <option value="BANK">Bank Account</option>
            </Select>
            <Select label="Paid From Account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name} (Bal: {formatMoney(a.balance)})</option>
              ))}
            </Select>
          </div>
          <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional voucher notes..." />
          <div className="pt-3 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" isLoading={submitting}>
              Post Expense
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Expense Modal with Audit Logging */}
      {editingExpense && (
        <Modal
          isOpen={!!editingExpense}
          onClose={() => setEditingExpense(null)}
          title={`Edit Expense Voucher`}
        >
          <form onSubmit={handleSaveEdit} className="space-y-4">
            {/* Creator Attribution Info Card */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/50">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Original Creator (بنایا گیا بذریعہ):</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {editingExpense.createdByName || "System Admin"}
                </span>
              </div>
              {editingExpense.isEdited && (
                <div className="mt-1 flex items-center justify-between text-amber-700 dark:text-amber-300">
                  <span>Previous Edit ({editingExpense.editCount || 1}x):</span>
                  <span className="font-medium">
                    By {editingExpense.updatedByName || "Staff"}
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Expense Category"
                value={editCategoryId}
                onChange={(e) => setEditCategoryId(e.target.value)}
                required
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
              <Input
                label="Amount (Rs)"
                type="number"
                step="0.01"
                value={editAmount}
                onChange={(e) => setEditAmount(parseFloat(e.target.value) || 0)}
                required
              />
            </div>

            <Input
              label="Description / Purpose"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="e.g. Utility bills"
              required
            />

            <Input
              label="Paid To (Beneficiary)"
              value={editPaidTo}
              onChange={(e) => setEditPaidTo(e.target.value)}
              placeholder="e.g. Vendor / Service Person"
            />

            <Input
              label="Notes"
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Additional explanation..."
            />

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
                placeholder="e.g. Amount correction / updated receipt details..."
                rows={2}
                required
                className="w-full rounded-lg border border-amber-300 bg-white p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-slate-900 dark:text-white dark:border-amber-700"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditingExpense(null)}
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
