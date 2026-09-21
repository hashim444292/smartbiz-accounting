"use client";

import React, { useEffect, useState } from "react";
import { formatMoney } from "@/lib/decimal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Plus, Search, User, Phone, Mail, MapPin, ArrowRight } from "lucide-react";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  // Form
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [openingBalance, setOpeningBalance] = useState(0);
  const [creditLimit, setCreditLimit] = useState(50000);
  const [submitting, setSubmitting] = useState(false);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/customers");
      const json = await res.json();
      if (json.success) setCustomers(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          businessName,
          phone,
          email,
          address,
          openingBalance,
          creditLimit,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowAddModal(false);
        setName("");
        setBusinessName("");
        setPhone("");
        fetchCustomers();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.businessName && c.businessName.toLowerCase().includes(search.toLowerCase())) ||
      (c.phone && c.phone.includes(search))
  );

  const totalReceivables = customers.reduce((acc, c) => acc + Number(c.currentBalance), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Customer Receivables & Accounts</h2>
          <p className="text-xs text-slate-500">
            Total Outstanding Receivables:{" "}
            <span className="font-bold text-rose-600 dark:text-rose-400">{formatMoney(totalReceivables)}</span>
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Customer
        </Button>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search customer by name, business, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-slate-50 pl-9 pr-3 py-1.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
      </div>

      {/* Customers Cards / Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Customer Name</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3 text-right">Credit Limit</th>
                <th className="px-4 py-3 text-right">Current Receivable</th>
                <th className="px-4 py-3 text-right">Ledger</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="px-4 py-3.5"><div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded-md" /></td>
                    <td className="px-4 py-3.5"><div className="h-4 w-24 bg-slate-100 dark:bg-slate-800/60 rounded" /></td>
                    <td className="px-4 py-3.5"><div className="h-4 w-20 bg-slate-100 dark:bg-slate-800/60 rounded" /></td>
                    <td className="px-4 py-3.5 text-right"><div className="h-4 w-16 bg-slate-100 dark:bg-slate-800/60 rounded ml-auto" /></td>
                    <td className="px-4 py-3.5 text-right"><div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded ml-auto" /></td>
                    <td className="px-4 py-3.5 text-right"><div className="h-7 w-20 bg-slate-100 dark:bg-slate-800 rounded-lg ml-auto" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-slate-400">
                    No customers registered yet. Click "Add Customer" to create an account.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      <div>{c.name}</div>
                      {c.businessName && <div className="text-[11px] font-normal text-slate-500">{c.businessName}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {c.phone && <div className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-400"><Phone className="h-3 w-3 text-slate-400" />{c.phone}</div>}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-500">{c.address || "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{c.creditLimit ? formatMoney(c.creditLimit) : "No limit"}</td>
                    <td className="px-4 py-3 text-right font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                      {formatMoney(c.currentBalance)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelectedCustomer(c)}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                      >
                        <span>Statement</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Customer Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Register Customer Account">
        <form onSubmit={handleCreateCustomer} className="space-y-3.5">
          <Input label="Customer / Contact Person" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input label="Company / Business Name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+92 300 ..." />
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Input label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Opening Balance (Receivable)"
              type="number"
              step="0.01"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)}
            />
            <Input
              label="Credit Limit (Rs)"
              type="number"
              step="0.01"
              value={creditLimit}
              onChange={(e) => setCreditLimit(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="pt-3 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              Save Customer
            </Button>
          </div>
        </form>
      </Modal>

      {/* Customer Statement / Ledger Modal */}
      <Modal
        isOpen={!!selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
        title={`Customer Statement: ${selectedCustomer?.name}`}
        description="Recent invoices, receipts, and running account balance"
      >
        <div className="space-y-4 text-xs">
          <div className="flex justify-between rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800">
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-200">{selectedCustomer?.businessName || selectedCustomer?.name}</p>
              <p className="text-slate-500 mt-0.5">{selectedCustomer?.phone}</p>
            </div>
            <div className="text-right">
              <p className="text-slate-500">Current Balance</p>
              <p className="text-base font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                {formatMoney(selectedCustomer?.currentBalance)}
              </p>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-2">Recent Sales & Invoices</h4>
            {selectedCustomer?.sales && selectedCustomer.sales.length > 0 ? (
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:border-slate-800">
                {selectedCustomer.sales.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between p-2.5">
                    <div>
                      <span className="font-semibold text-blue-600">{s.invoiceNumber}</span>
                      <span className="text-slate-400 ml-2">{new Date(s.date).toLocaleDateString()}</span>
                    </div>
                    <div className="text-right tabular-nums">
                      <span className="font-bold text-slate-900 dark:text-white">{formatMoney(s.totalAmount)}</span>
                      <span className="text-slate-400 ml-2">(Unpaid: {formatMoney(s.remainingAmount)})</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 italic">No recent sales records for this party.</p>
            )}
          </div>

          <div className="pt-3 flex justify-end">
            <Button variant="secondary" size="sm" onClick={() => setSelectedCustomer(null)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
