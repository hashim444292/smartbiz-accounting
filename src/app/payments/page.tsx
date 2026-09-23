"use client";

import React, { useEffect, useState } from "react";
import { formatMoney } from "@/lib/decimal";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Search, ShieldCheck, Building2, UserCheck, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { TableRowsSkeleton } from "@/components/ui/loader";
import { useAuth } from "@/context/AuthContext";

export default function PaymentsPage() {
  const { user, activeCompany, branches, selectedBranch, activeBranchId, isBranchLocked } = useAuth();

  const [payments, setPayments] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<"ALL" | "RECEIPT" | "DISBURSEMENT" | "TRANSFER">("ALL");
  const [search, setSearch] = useState("");

  // Modals
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showDisburseModal, setShowDisburseModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);

  // Form State
  const [partyId, setPartyId] = useState("");
  const [amount, setAmount] = useState(0);
  const [accountId, setAccountId] = useState("");
  const [targetAccountId, setTargetAccountId] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentBranchId, setPaymentBranchId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Compute effective branch: if user is staff locked to a branch, strictly use that; otherwise active branch or null
  const effectiveBranch = isBranchLocked ? user?.branchId : (selectedBranch?.id || activeBranchId || null);

  // Filter accounts strictly by the selected operating branch in the modal (or universal accounts)
  const modalAccounts = accounts.filter((a) => {
    if (paymentBranchId) {
      return !a.branchId || a.branchId === paymentBranchId;
    }
    return true;
  });

  // Whenever the modal's operating branch changes, auto-select a valid account from that branch
  useEffect(() => {
    if (modalAccounts.length > 0) {
      const isAccValid = modalAccounts.some((a) => a.id === accountId);
      if (!isAccValid) {
        setAccountId(modalAccounts[0].id);
      }
      const isTargetValid = modalAccounts.some((a) => a.id === targetAccountId);
      if (!isTargetValid && modalAccounts.length > 1) {
        setTargetAccountId(modalAccounts[1].id);
      }
    }
  }, [paymentBranchId, accounts]);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (activeCompany?.id) headers["x-business-id"] = activeCompany.id;
      if (effectiveBranch) headers["x-branch-id"] = effectiveBranch;

      const query = effectiveBranch ? `?branchId=${effectiveBranch}` : "?branchId=all";

      const [payRes, custRes, supRes, expRes] = await Promise.all([
        fetch(`/api/payments${query}`, { headers }),
        fetch("/api/customers", { headers }),
        fetch("/api/suppliers", { headers }),
        fetch(`/api/expenses${query}`, { headers }),
      ]);
      const payJson = await payRes.json();
      const custJson = await custRes.json();
      const supJson = await supRes.json();
      const expJson = await expRes.json();

      if (payJson.success) setPayments(payJson.data);
      if (custJson.success) setCustomers(custJson.data);
      if (supJson.success) setSuppliers(supJson.data);

      const rawAccounts = (payJson.accounts && payJson.accounts.length > 0)
        ? payJson.accounts
        : (expJson.data?.accounts || []);

      if (rawAccounts.length > 0) {
        setAccounts(rawAccounts);
        const branchForAcc = isBranchLocked ? user?.branchId : (paymentBranchId || effectiveBranch);
        const filtered = rawAccounts.filter((a: any) => !branchForAcc || !a.branchId || a.branchId === branchForAcc);
        if (filtered.length > 0) {
          setAccountId(filtered[0].id);
          if (filtered.length > 1) {
            setTargetAccountId(filtered[1].id);
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
    const branchToUse = isBranchLocked ? (user?.branchId || "") : (selectedBranch?.id || activeBranchId || (branches[0]?.id || ""));
    setPaymentBranchId(branchToUse);
  }, [activeCompany?.id, activeBranchId, isBranchLocked, user?.branchId, selectedBranch?.id]);

  const openReceiptModal = () => {
    if (customers.length > 0) setPartyId(customers[0].id);
    const branchToUse = isBranchLocked ? (user?.branchId || "") : (selectedBranch?.id || activeBranchId || (branches[0]?.id || ""));
    setPaymentBranchId(branchToUse);
    setShowReceiptModal(true);
  };

  const openDisburseModal = () => {
    if (suppliers.length > 0) setPartyId(suppliers[0].id);
    const branchToUse = isBranchLocked ? (user?.branchId || "") : (selectedBranch?.id || activeBranchId || (branches[0]?.id || ""));
    setPaymentBranchId(branchToUse);
    setShowDisburseModal(true);
  };

  const openTransferModal = () => {
    const branchToUse = isBranchLocked ? (user?.branchId || "") : (selectedBranch?.id || activeBranchId || (branches[0]?.id || ""));
    setPaymentBranchId(branchToUse);
    setShowTransferModal(true);
  };

  const handleCreateReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (activeCompany?.id) headers["x-business-id"] = activeCompany.id;
      if (effectiveBranch) headers["x-branch-id"] = effectiveBranch;

      const effectiveCreateBranch = isBranchLocked ? user?.branchId : (paymentBranchId || effectiveBranch || null);

      const res = await fetch("/api/payments", {
        method: "POST",
        headers,
        body: JSON.stringify({
          type: "RECEIPT",
          customerId: partyId,
          amount,
          accountId,
          referenceNumber,
          notes,
          branchId: effectiveCreateBranch,
          createdById: user?.userId,
          createdByName: user?.name,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowReceiptModal(false);
        setAmount(0);
        fetchPayments();
      } else {
        alert(json.error);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateDisburse = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (activeCompany?.id) headers["x-business-id"] = activeCompany.id;
      if (effectiveBranch) headers["x-branch-id"] = effectiveBranch;

      const effectiveCreateBranch = isBranchLocked ? user?.branchId : (paymentBranchId || effectiveBranch || null);

      const res = await fetch("/api/payments", {
        method: "POST",
        headers,
        body: JSON.stringify({
          type: "DISBURSEMENT",
          supplierId: partyId,
          amount,
          accountId,
          referenceNumber,
          notes,
          branchId: effectiveCreateBranch,
          createdById: user?.userId,
          createdByName: user?.name,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowDisburseModal(false);
        setAmount(0);
        fetchPayments();
      } else {
        alert(json.error);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (activeCompany?.id) headers["x-business-id"] = activeCompany.id;
      if (effectiveBranch) headers["x-branch-id"] = effectiveBranch;

      const effectiveCreateBranch = isBranchLocked ? user?.branchId : (paymentBranchId || effectiveBranch || null);

      const res = await fetch("/api/payments/transfer", {
        method: "POST",
        headers,
        body: JSON.stringify({
          fromAccountId: accountId,
          toAccountId: targetAccountId,
          amount,
          referenceNumber,
          notes,
          branchId: effectiveCreateBranch,
          createdById: user?.userId,
          createdByName: user?.name,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowTransferModal(false);
        setAmount(0);
        fetchPayments();
      } else {
        alert(json.error);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const safePayments = Array.isArray(payments) ? payments : [];

  const filtered = safePayments.filter((p) => {
    const matchesType = filterType === "ALL" || p.type === filterType;
    if (!matchesType) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const party = (p.partyName || p.customer?.name || p.supplier?.name || "").toLowerCase();
    const ref = (p.referenceNumber || "").toLowerCase();
    const memo = (p.notes || "").toLowerCase();
    const creator = (p.createdByName || p.createdBy?.name || "").toLowerCase();
    const br = (p.branch?.name || p.branchName || "").toLowerCase();
    return party.includes(q) || ref.includes(q) || memo.includes(q) || creator.includes(q) || br.includes(q);
  });

  const totalReceipts = safePayments
    .filter((p) => p.type === "RECEIPT")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const totalDisbursements = safePayments
    .filter((p) => p.type === "DISBURSEMENT")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const netCashFlow = totalReceipts - totalDisbursements;

  return (
    <div className="space-y-5">
      {/* Top Banner & Action Buttons */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Payments & Cash Movements</h2>
            <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-300">
              Audit Tracked
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Full accountability: who received or paid cash, when, and from which branch
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="success"
            size="sm"
            onClick={openReceiptModal}
          >
            <ArrowDownLeft className="h-4 w-4 mr-1" /> Money Received
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={openDisburseModal}
          >
            <ArrowUpRight className="h-4 w-4 mr-1" /> Money Paid
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={openTransferModal}
          >
            <ArrowLeftRight className="h-4 w-4 mr-1" /> Transfer Funds
          </Button>
        </div>
      </div>

      {/* Active Branch Scope Indicator Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-[#111827]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Active Outlet View (موجودہ برانچ):</span>
              {isBranchLocked ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-bold text-amber-900 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-200">
                  🏢 {user?.branchName || branches.find((b) => b.id === user?.branchId)?.name || "Assigned Branch"} (مخصوص کھاتہ / Locked)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-900 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-200">
                  🏢 {selectedBranch ? `${selectedBranch.name} (${selectedBranch.code})` : "🌐 Consolidated (All Outlets / تمام برانچز کا مجموعہ)"}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {isBranchLocked
                ? "آپ کے اکاؤنٹ کو سختی سے آپ کی مخصوص برانچ تک محدود کیا گیا ہے۔ دوسرے آؤٹ لیٹس کا ڈیٹا اور کیش ڈراور مکمل پوشیدہ ہے۔"
                : "بطور Owner آپ اوپر ہیڈر سے کسی بھی وقت برانچ تبدیل کر سکتے ہیں یا تمام آؤٹ لیٹس کا اکٹھا کھاتہ دیکھ سکتے ہیں۔"}
            </p>
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3.5 dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Total Money Received</span>
            <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
            +{formatMoney(totalReceipts)}
          </p>
          <span className="text-[10px] text-emerald-600/80">From customer collections & sales</span>
        </div>

        <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-3.5 dark:border-rose-900/50 dark:bg-rose-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-800 dark:text-rose-300">Total Money Paid Out</span>
            <TrendingDown className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          </div>
          <p className="mt-1 text-lg font-bold text-rose-700 dark:text-rose-400 tabular-nums">
            -{formatMoney(totalDisbursements)}
          </p>
          <span className="text-[10px] text-rose-600/80">To suppliers, purchases & vendors</span>
        </div>

        <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3.5 dark:border-blue-900/50 dark:bg-blue-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-800 dark:text-blue-300">Net Movement Balance</span>
            <Wallet className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <p className={`mt-1 text-lg font-bold tabular-nums ${netCashFlow >= 0 ? "text-blue-700 dark:text-blue-400" : "text-amber-600 dark:text-amber-400"}`}>
            {netCashFlow >= 0 ? "+" : ""}{formatMoney(netCashFlow)}
          </p>
          <span className="text-[10px] text-blue-600/80">Net cash & bank flow</span>
        </div>
      </div>

      {/* Payments Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Party / Account</th>
                <th className="px-4 py-3">Payment Account</th>
                <th className="px-4 py-3">Branch (برانچ)</th>
                <th className="px-4 py-3">Handled By (کس نے کیا)</th>
                <th className="px-4 py-3">Ref / Memo</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <TableRowsSkeleton rows={6} cols={8} />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-slate-400">
                    No payment records found matching criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const isReceipt = p.type === "RECEIPT";
                  const isDisburse = p.type === "DISBURSEMENT";
                  const branchName = p.branch?.name || p.branchName || "Main Branch / Head Office";
                  const creatorName = p.createdByName || p.createdBy?.name || "Muhammad Hanif";

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-mono text-[11px]">{new Date(p.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <Badge variant={isReceipt ? "success" : isDisburse ? "danger" : "default"}>
                          {p.type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                        {p.partyName || p.customer?.name || p.supplier?.name || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {p.account?.name || "Cash"}
                        {p.targetAccount && ` → ${p.targetAccount.name}`}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          <Building2 className="h-3 w-3 text-slate-400" />
                          {branchName}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 uppercase">
                            {creatorName.charAt(0)}
                          </div>
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {creatorName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{p.referenceNumber || p.notes || "—"}</td>
                      <td
                        className={`px-4 py-3 text-right font-bold tabular-nums ${
                          isReceipt ? "text-emerald-600" : isDisburse ? "text-rose-600" : "text-blue-600"
                        }`}
                      >
                        {isReceipt ? "+" : isDisburse ? "-" : ""}
                        {formatMoney(p.amount)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Receipt Modal */}
      <Modal isOpen={showReceiptModal} onClose={() => setShowReceiptModal(false)} title="Record Customer Receipt">
        <form onSubmit={handleCreateReceipt} className="space-y-4">
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-3 text-xs text-indigo-950 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white uppercase">
                  {user?.name?.charAt(0) || "U"}
                </span>
                <div>
                  <span className="font-bold">{user?.name || "Logged User"}</span>
                  <span className="text-[11px] text-indigo-600 dark:text-indigo-400 ml-1.5 font-medium">({user?.role?.replace("_", " ") || "Admin"})</span>
                  <div className="text-[10px] text-indigo-700/80 dark:text-indigo-300">Receiving Cashier / Account Handler</div>
                </div>
              </div>
              <span className="rounded-md bg-white/80 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium border border-indigo-200 dark:border-indigo-800">
                🏢 {branches.find((b) => b.id === paymentBranchId)?.name || selectedBranch?.name || user?.branchName || "Main Branch"}
              </span>
            </div>
          </div>

          {isBranchLocked ? (
            <div className="flex items-center justify-between rounded-xl border border-amber-200/90 bg-amber-50/80 p-2.5 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
              <span className="font-semibold text-amber-900 dark:text-amber-300">
                Receiving Outlet (مخصوص برانچ):
              </span>
              <span className="font-bold flex items-center gap-1.5">
                🏢 {user?.branchName || branches.find((b) => b.id === user?.branchId)?.name || "Your Outlet"}
                <span className="rounded bg-amber-200/90 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 dark:bg-amber-900 dark:text-amber-100">
                  LOCKED
                </span>
              </span>
            </div>
          ) : branches.length > 1 ? (
            <div>
              <Select
                label="Receiving Branch (برانچ جہاں کیش جمع ہوا)"
                value={paymentBranchId}
                onChange={(e) => setPaymentBranchId(e.target.value)}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    🏢 {b.name} ({b.code})
                  </option>
                ))}
              </Select>
              <p className="text-[10px] text-slate-500 mt-1 italic">
                💡 منتخب برانچ کے کیش ڈراور اور اکاؤنٹس خودکار طور پر نیچے فلٹر ہو جائیں گے۔
              </p>
            </div>
          ) : null}

          <Select label="Customer" value={partyId} onChange={(e) => setPartyId(e.target.value)} required>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} (Receivable Due: {formatMoney(c.currentBalance)})
              </option>
            ))}
          </Select>
          <Input
            label="Amount Received (Rs)"
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            required
          />
          <Select label="Deposit Into Account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {modalAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} {a.branchName ? `[${a.branchName}]` : ""} (Balance: {formatMoney(a.balance)})
              </option>
            ))}
          </Select>
          <Input label="Cheque / Transfer Ref #" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} />
          <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="pt-3 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowReceiptModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="success" isLoading={submitting}>
              Post Receipt
            </Button>
          </div>
        </form>
      </Modal>

      {/* Record Disbursement Modal */}
      <Modal isOpen={showDisburseModal} onClose={() => setShowDisburseModal(false)} title="Record Supplier Disbursement">
        <form onSubmit={handleCreateDisburse} className="space-y-4">
          <div className="rounded-xl border border-rose-100 bg-rose-50/70 p-3 text-xs text-rose-950 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-600 text-[11px] font-bold text-white uppercase">
                  {user?.name?.charAt(0) || "U"}
                </span>
                <div>
                  <span className="font-bold">{user?.name || "Logged User"}</span>
                  <span className="text-[11px] text-rose-600 dark:text-rose-400 ml-1.5 font-medium">({user?.role?.replace("_", " ") || "Admin"})</span>
                  <div className="text-[10px] text-rose-700/80 dark:text-rose-300">Disbursing Officer / Payee Handler</div>
                </div>
              </div>
              <span className="rounded-md bg-white/80 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium border border-rose-200 dark:border-rose-800">
                🏢 {branches.find((b) => b.id === paymentBranchId)?.name || selectedBranch?.name || user?.branchName || "Main Branch"}
              </span>
            </div>
          </div>

          {isBranchLocked ? (
            <div className="flex items-center justify-between rounded-xl border border-amber-200/90 bg-amber-50/80 p-2.5 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
              <span className="font-semibold text-amber-900 dark:text-amber-300">
                Disbursing Outlet (مخصوص برانچ):
              </span>
              <span className="font-bold flex items-center gap-1.5">
                🏢 {user?.branchName || branches.find((b) => b.id === user?.branchId)?.name || "Your Outlet"}
                <span className="rounded bg-amber-200/90 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 dark:bg-amber-900 dark:text-amber-100">
                  LOCKED
                </span>
              </span>
            </div>
          ) : branches.length > 1 ? (
            <div>
              <Select
                label="Disbursing Branch (برانچ جہاں سے کیش دیا گیا)"
                value={paymentBranchId}
                onChange={(e) => setPaymentBranchId(e.target.value)}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    🏢 {b.name} ({b.code})
                  </option>
                ))}
              </Select>
              <p className="text-[10px] text-slate-500 mt-1 italic">
                💡 منتخب برانچ کے کیش ڈراور اور اکاؤنٹس خودکار طور پر نیچے فلٹر ہو جائیں گے۔
              </p>
            </div>
          ) : null}

          <Select label="Supplier" value={partyId} onChange={(e) => setPartyId(e.target.value)} required>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} (Payable Due: {formatMoney(s.currentBalance)})
              </option>
            ))}
          </Select>
          <Input
            label="Amount Disbursed (Rs)"
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            required
          />
          <Select label="Disburse From Account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {modalAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} {a.branchName ? `[${a.branchName}]` : ""} (Balance: {formatMoney(a.balance)})
              </option>
            ))}
          </Select>
          <Input label="Cheque / Transfer Ref #" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} />
          <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="pt-3 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowDisburseModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" isLoading={submitting}>
              Post Disbursement
            </Button>
          </div>
        </form>
      </Modal>

      {/* Transfer Modal */}
      <Modal isOpen={showTransferModal} onClose={() => setShowTransferModal(false)} title="Transfer Between Accounts">
        <form onSubmit={handleCreateTransfer} className="space-y-4">
          <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-xs text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white uppercase">
                  {user?.name?.charAt(0) || "U"}
                </span>
                <div>
                  <span className="font-bold">{user?.name || "Logged User"}</span>
                  <span className="text-[11px] text-blue-600 dark:text-blue-400 ml-1.5 font-medium">({user?.role?.replace("_", " ") || "Admin"})</span>
                  <div className="text-[10px] text-blue-700/80 dark:text-blue-300">Authorized Transfer Initiator</div>
                </div>
              </div>
              <span className="rounded-md bg-white/80 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium border border-blue-200 dark:border-blue-800">
                🏢 {branches.find((b) => b.id === paymentBranchId)?.name || selectedBranch?.name || user?.branchName || "Main Branch"}
              </span>
            </div>
          </div>

          {isBranchLocked ? (
            <div className="flex items-center justify-between rounded-xl border border-amber-200/90 bg-amber-50/80 p-2.5 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
              <span className="font-semibold text-amber-900 dark:text-amber-300">
                Operating Outlet (مخصوص برانچ):
              </span>
              <span className="font-bold flex items-center gap-1.5">
                🏢 {user?.branchName || branches.find((b) => b.id === user?.branchId)?.name || "Your Outlet"}
                <span className="rounded bg-amber-200/90 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 dark:bg-amber-900 dark:text-amber-100">
                  LOCKED
                </span>
              </span>
            </div>
          ) : branches.length > 1 ? (
            <Select
              label="Operating Branch (برانچ)"
              value={paymentBranchId}
              onChange={(e) => setPaymentBranchId(e.target.value)}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  🏢 {b.name} ({b.code})
                </option>
              ))}
            </Select>
          ) : null}

          <Select label="From Account" value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
            {modalAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} {a.branchName ? `[${a.branchName}]` : ""} (Balance: {formatMoney(a.balance)})
              </option>
            ))}
          </Select>
          <Select label="To Account" value={targetAccountId} onChange={(e) => setTargetAccountId(e.target.value)} required>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} {a.branchName ? `[${a.branchName}]` : ""} (Balance: {formatMoney(a.balance)})
              </option>
            ))}
          </Select>
          <Input
            label="Transfer Amount (Rs)"
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            required
          />
          <Input label="Transfer Notes / Ref" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="pt-3 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowTransferModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              Execute Transfer
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
