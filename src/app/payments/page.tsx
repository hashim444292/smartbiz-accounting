"use client";

import React, { useEffect, useState } from "react";
import { formatMoney } from "@/lib/decimal";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Plus, Search } from "lucide-react";
import { TableRowsSkeleton } from "@/components/ui/loader";

export default function PaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<"ALL" | "RECEIPT" | "DISBURSEMENT" | "TRANSFER">("ALL");

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
  const [submitting, setSubmitting] = useState(false);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const [payRes, custRes, supRes, expRes] = await Promise.all([
        fetch("/api/payments"),
        fetch("/api/customers"),
        fetch("/api/suppliers"),
        fetch("/api/expenses"),
      ]);
      const payJson = await payRes.json();
      const custJson = await custRes.json();
      const supJson = await supRes.json();
      const expJson = await expRes.json();

      if (payJson.success) setPayments(payJson.data);
      if (custJson.success) setCustomers(custJson.data);
      if (supJson.success) setSuppliers(supJson.data);
      if (expJson.success && expJson.data.accounts) {
        setAccounts(expJson.data.accounts);
        if (expJson.data.accounts.length > 0) {
          setAccountId(expJson.data.accounts[0].id);
          if (expJson.data.accounts.length > 1) {
            setTargetAccountId(expJson.data.accounts[1].id);
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
  }, []);

  const handleCreateReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "RECEIPT",
          customerId: partyId,
          amount,
          accountId,
          referenceNumber,
          notes,
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
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "DISBURSEMENT",
          supplierId: partyId,
          amount,
          accountId,
          referenceNumber,
          notes,
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
      const res = await fetch("/api/payments/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromAccountId: accountId,
          toAccountId: targetAccountId,
          amount,
          referenceNumber,
          notes,
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

  const filtered = payments.filter((p) => filterType === "ALL" || p.type === filterType);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Payments & Cash Movements</h2>
          <p className="text-xs text-slate-500">Record customer receipts, vendor disbursements, and bank transfers</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="success"
            size="sm"
            onClick={() => {
              if (customers.length > 0) setPartyId(customers[0].id);
              setShowReceiptModal(true);
            }}
          >
            <ArrowDownLeft className="h-4 w-4 mr-1" /> Money Received
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              if (suppliers.length > 0) setPartyId(suppliers[0].id);
              setShowDisburseModal(true);
            }}
          >
            <ArrowUpRight className="h-4 w-4 mr-1" /> Money Paid
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowTransferModal(true)}>
            <ArrowLeftRight className="h-4 w-4 mr-1" /> Transfer Funds
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {(["ALL", "RECEIPT", "DISBURSEMENT", "TRANSFER"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              filterType === t
                ? "bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-400"
            }`}
          >
            {t === "ALL" ? "All Transactions" : t === "RECEIPT" ? "Customer Receipts" : t === "DISBURSEMENT" ? "Vendor Payments" : "Account Transfers"}
          </button>
        ))}
      </div>

      {/* Payments Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Party / Account</th>
                <th className="px-4 py-3">Payment Account</th>
                <th className="px-4 py-3">Ref / Memo</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <TableRowsSkeleton rows={6} cols={6} />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-slate-400">
                    No payment records found.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const isReceipt = p.type === "RECEIPT";
                  const isDisburse = p.type === "DISBURSEMENT";
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3">{new Date(p.date).toLocaleDateString()}</td>
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
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} (Balance: {formatMoney(a.balance)})
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
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} (Balance: {formatMoney(a.balance)})
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
          <Select label="From Account" value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} (Balance: {formatMoney(a.balance)})
              </option>
            ))}
          </Select>
          <Select label="To Account" value={targetAccountId} onChange={(e) => setTargetAccountId(e.target.value)} required>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} (Balance: {formatMoney(a.balance)})
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
