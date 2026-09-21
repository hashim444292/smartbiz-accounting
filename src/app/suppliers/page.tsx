"use client";

import React, { useEffect, useState } from "react";
import { formatMoney } from "@/lib/decimal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Plus, Search, Building2, Phone, Mail, ArrowRight } from "lucide-react";
import { TableRowsSkeleton } from "@/components/ui/loader";

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);

  // Form
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [openingBalance, setOpeningBalance] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/suppliers");
      const json = await res.json();
      if (json.success) setSuppliers(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          businessName,
          phone,
          email,
          address,
          openingBalance,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowAddModal(false);
        setName("");
        setBusinessName("");
        setPhone("");
        fetchSuppliers();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.businessName && s.businessName.toLowerCase().includes(search.toLowerCase())) ||
      (s.phone && s.phone.includes(search))
  );

  const totalPayables = suppliers.reduce((acc, s) => acc + Number(s.currentBalance), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Supplier Payables & Vendors</h2>
          <p className="text-xs text-slate-500">
            Total Outstanding Payables:{" "}
            <span className="font-bold text-rose-600 dark:text-rose-400">{formatMoney(totalPayables)}</span>
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Supplier
        </Button>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search supplier by name or business..."
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
                <th className="px-4 py-3">Supplier Name</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3 text-right">Current Payable</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <TableRowsSkeleton rows={6} cols={5} />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-slate-400">
                    No suppliers registered yet. Click "Add Supplier" to create a vendor account.
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      <div>{s.name}</div>
                      {s.businessName && <div className="text-[11px] font-normal text-slate-500">{s.businessName}</div>}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-500">{s.phone || s.email || "—"}</td>
                    <td className="px-4 py-3 text-[11px] text-slate-500">{s.address || "—"}</td>
                    <td className="px-4 py-3 text-right font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                      {formatMoney(s.currentBalance)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelectedSupplier(s)}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50"
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

      {/* Add Supplier Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Register Supplier Vendor">
        <form onSubmit={handleCreateSupplier} className="space-y-3.5">
          <Input label="Supplier / Contact Person" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input label="Business / Company Name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Input label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
          <Input
            label="Opening Payable Balance (Rs)"
            type="number"
            step="0.01"
            value={openingBalance}
            onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)}
          />
          <div className="pt-3 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              Save Supplier
            </Button>
          </div>
        </form>
      </Modal>

      {/* Supplier Statement Modal */}
      <Modal
        isOpen={!!selectedSupplier}
        onClose={() => setSelectedSupplier(null)}
        title={`Supplier Statement: ${selectedSupplier?.name}`}
      >
        <div className="space-y-4 text-xs">
          <div className="flex justify-between rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800">
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-200">{selectedSupplier?.businessName || selectedSupplier?.name}</p>
              <p className="text-slate-500 mt-0.5">{selectedSupplier?.phone}</p>
            </div>
            <div className="text-right">
              <p className="text-slate-500">Payable Balance</p>
              <p className="text-base font-bold text-rose-600 tabular-nums">
                {formatMoney(selectedSupplier?.currentBalance)}
              </p>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-2">Recent Inward Bills</h4>
            {selectedSupplier?.purchases && selectedSupplier.purchases.length > 0 ? (
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {selectedSupplier.purchases.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between p-2.5">
                    <div>
                      <span className="font-semibold text-blue-600">{p.purchaseNumber}</span>
                      <span className="text-slate-400 ml-2">{new Date(p.date).toLocaleDateString()}</span>
                    </div>
                    <div className="text-right tabular-nums">
                      <span className="font-bold text-slate-900">{formatMoney(p.totalAmount)}</span>
                      <span className="text-slate-400 ml-2">(Unpaid: {formatMoney(p.remainingAmount)})</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 italic">No recent purchase records for this vendor.</p>
            )}
          </div>

          <div className="pt-3 flex justify-end">
            <Button variant="secondary" size="sm" onClick={() => setSelectedSupplier(null)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
