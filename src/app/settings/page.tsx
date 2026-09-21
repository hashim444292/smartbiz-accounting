"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, Shield, History, Check, Percent, Layers, AlertCircle, Save } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { BrandPageLoader } from "@/components/ui/loader";

export default function SettingsPage() {
  const { user, activeCompany, isLoading, refreshSession } = useAuth();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const [activeTab, setActiveTab] = useState<"PROFILE" | "DEFAULTS" | "USERS" | "AUDIT">("PROFILE");
  const [saved, setSaved] = useState(false);
  const [defaultsSaved, setDefaultsSaved] = useState(false);
  const [defaultsError, setDefaultsError] = useState<string | null>(null);

  // Profile synced from activeCompany
  const [businessName, setBusinessName] = useState(activeCompany?.name || "SmartBiz Trading & Distribution");
  const [ownerName, setOwnerName] = useState(activeCompany?.ownerName || "Hashim Khan");
  const [currency, setCurrency] = useState(activeCompany?.currency || "PKR");
  const [currencySymbol, setCurrencySymbol] = useState(activeCompany?.currencySymbol || "Rs");
  const [country, setCountry] = useState("Pakistan");
  const [invoicePrefix, setInvoicePrefix] = useState("INV-");
  const [purchasePrefix, setPurchasePrefix] = useState("PUR-");
  const [defaultTerms, setDefaultTerms] = useState(30);

  // Tax & Product Defaults
  const [defaultHsCode, setDefaultHsCode] = useState(activeCompany?.defaultHsCode || "8517.13");
  const [defaultTaxProfile, setDefaultTaxProfile] = useState(activeCompany?.defaultTaxProfile || "Standard 18%");
  const [defaultUom, setDefaultUom] = useState(activeCompany?.defaultUom || "pcs");
  const [defaultSalesTax, setDefaultSalesTax] = useState(activeCompany?.defaultSalesTax || 18);
  const [defaultFurtherTax, setDefaultFurtherTax] = useState(activeCompany?.defaultFurtherTax || 3);

  useEffect(() => {
    if (activeCompany) {
      setBusinessName(activeCompany.name || "");
      if (activeCompany.ownerName) setOwnerName(activeCompany.ownerName);
      if (activeCompany.currency) setCurrency(activeCompany.currency);
      if (activeCompany.currencySymbol) setCurrencySymbol(activeCompany.currencySymbol);
      if (activeCompany.defaultHsCode) setDefaultHsCode(activeCompany.defaultHsCode);
      if (activeCompany.defaultUom) setDefaultUom(activeCompany.defaultUom);
      if (activeCompany.defaultSalesTax !== undefined) setDefaultSalesTax(activeCompany.defaultSalesTax);
      if (activeCompany.defaultFurtherTax !== undefined) setDefaultFurtherTax(activeCompany.defaultFurtherTax);
    }
  }, [activeCompany]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleSaveDefaults = async (e: React.FormEvent) => {
    e.preventDefault();
    setDefaultsError(null);
    setDefaultsSaved(false);

    if (!activeCompany?.id) return;

    try {
      const res = await fetch(`/api/admin/companies/${activeCompany.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultHsCode,
          defaultTaxProfile,
          defaultUom,
          defaultSalesTax: Number(defaultSalesTax),
          defaultFurtherTax: Number(defaultFurtherTax),
        }),
      });

      const json = await res.json();
      if (json.success) {
        setDefaultsSaved(true);
        if (refreshSession) await refreshSession();
        setTimeout(() => setDefaultsSaved(false), 3000);
      } else {
        setDefaultsError(json.error || "Failed to update defaults");
      }
    } catch (err: any) {
      setDefaultsError(err.message || "Network error");
    }
  };

  const users = [
    { name: "Hashim Khan", email: "admin@smartbiz.com", role: "OWNER_ADMIN", status: "Active" },
    { name: "Farhan Accountant", email: "accountant@smartbiz.com", role: "ACCOUNTANT", status: "Active" },
    { name: "Bilal Cashier", email: "staff@smartbiz.com", role: "STAFF", status: "Active" },
  ];

  const auditLogs = [
    { action: "CREATE_SALE", entity: "Sale", details: "Invoice #INV-2026-00001 created (Rs 144,500)", time: "Just now" },
    { action: "FBR_TRANSMISSION", entity: "Compliance", details: "FBR POS invoice FBR-POS-2026-00001 transmitted successfully", time: "10 mins ago" },
    { action: "BULK_IMPORT", entity: "Products", details: "Imported 31 catalog products with HS code inheritance", time: "1 hour ago" },
    { action: "HS_CODE_CONFIG", entity: "Company", details: "Organization Default HS Code set to 8517.13", time: "2 hours ago" },
  ];

  if (isLoading || !activeCompany) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <BrandPageLoader
          message="Loading Organization Settings..."
          submessage="Retrieving tenant preferences, HS Code tax profiles, and user permissions..."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 font-sans">
          Organization Settings & Defaults
        </h2>
        <p className="text-xs text-slate-500">
          Configure client profile, HS Code inheritance defaults, FBR tax schedules, and view audit trails.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1.5 shadow-xs">
        <button
          onClick={() => setActiveTab("PROFILE")}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition ${
            activeTab === "PROFILE" ? "bg-white text-indigo-700 font-bold shadow-xs" : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
          }`}
        >
          <Building2 className="h-4 w-4" />
          <span>Business Profile</span>
        </button>

        <button
          onClick={() => setActiveTab("DEFAULTS")}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition ${
            activeTab === "DEFAULTS" ? "bg-white text-indigo-700 font-bold shadow-xs" : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>Tax & Product Defaults</span>
        </button>

        {isSuperAdmin && (
          <button
            onClick={() => setActiveTab("USERS")}
            className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition ${
              activeTab === "USERS" ? "bg-white text-indigo-700 font-bold shadow-xs" : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
            }`}
          >
            <Users className="h-4 w-4" />
            <span>User Roles</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab("AUDIT")}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition ${
            activeTab === "AUDIT" ? "bg-white text-indigo-700 font-bold shadow-xs" : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
          }`}
        >
          <History className="h-4 w-4" />
          <span>Audit Logs</span>
        </button>
      </div>

      {/* TAB 1: PROFILE */}
      {activeTab === "PROFILE" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">Business Profile</h3>
            <p className="text-[11px] text-slate-500">Manage business identity, owner details, and currency</p>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Business Name</label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Owner Name</label>
                <input
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Country</label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="PKR">Pakistani Rupee (PKR)</option>
                  <option value="USD">US Dollar (USD)</option>
                  <option value="AED">UAE Dirham (AED)</option>
                  <option value="SAR">Saudi Riyal (SAR)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Currency Symbol</label>
                <input
                  type="text"
                  value={currencySymbol}
                  onChange={(e) => setCurrencySymbol(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-indigo-700 transition"
              >
                <Save className="h-4 w-4" />
                <span>{saved ? "Profile Saved!" : "Save Profile"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: TAX & PRODUCT DEFAULTS */}
      {activeTab === "DEFAULTS" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">Tax & Product Defaults Configuration</h3>
            <p className="text-[11px] text-slate-500">
              Configure baseline defaults inherited automatically by new products and bulk imports.
            </p>
          </div>

          {defaultsSaved && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-600" />
              <span>Defaults updated successfully! Existing product records remain safely decoupled and untouched.</span>
            </div>
          )}

          {defaultsError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600" />
              <span>{defaultsError}</span>
            </div>
          )}

          <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/50 text-xs text-slate-700 space-y-1">
            <p className="font-bold text-indigo-900 flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-indigo-600" />
              <span>Decoupling & Non-Retroactivity Rule</span>
            </p>
            <p className="text-slate-600">
              Changing these defaults will <strong>NOT</strong> overwrite or corrupt any existing products.
              They solely establish the starting pre-filled values for <strong>New Products</strong> and future <strong>Bulk Imports</strong>.
            </p>
          </div>

          <form onSubmit={handleSaveDefaults} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Default HS Code <span className="text-indigo-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={defaultHsCode}
                  onChange={(e) => setDefaultHsCode(e.target.value)}
                  placeholder="e.g. 8517.13"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:border-indigo-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-1">Pre-filled in Add Product when no category default is present.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Default Unit of Measure (UOM)
                </label>
                <input
                  type="text"
                  value={defaultUom}
                  onChange={(e) => setDefaultUom(e.target.value)}
                  placeholder="e.g. pcs"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Default Tax Profile
                </label>
                <select
                  value={defaultTaxProfile}
                  onChange={(e) => setDefaultTaxProfile(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="Standard 18%">Standard 18%</option>
                  <option value="Reduced Rate">Reduced Rate</option>
                  <option value="Exempt">Exempt / Zero-Rated</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Default Sales Tax (%)
                </label>
                <input
                  type="number"
                  value={defaultSalesTax}
                  onChange={(e) => setDefaultSalesTax(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Default Further Tax (%)
                </label>
                <input
                  type="number"
                  value={defaultFurtherTax}
                  onChange={(e) => setDefaultFurtherTax(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2 text-xs font-bold text-white shadow-md hover:bg-indigo-700 transition"
              >
                <Save className="h-4 w-4" />
                <span>Save Organization Defaults</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: USERS */}
      {activeTab === "USERS" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">Active System Users</h3>
            <p className="text-[11px] text-slate-500">Members with operational access to this organization</p>
          </div>

          <div className="divide-y divide-slate-100">
            {users.map((u, idx) => (
              <div key={idx} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <p className="font-semibold text-slate-900">{u.name}</p>
                  <p className="text-slate-500 text-[11px]">{u.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200">
                    {u.role}
                  </span>
                  <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                    {u.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT */}
      {activeTab === "AUDIT" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">Organization Audit Log</h3>
            <p className="text-[11px] text-slate-500">Chronological history of compliance events and administrative actions</p>
          </div>

          <div className="space-y-2">
            {auditLogs.map((log, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-indigo-700 uppercase tracking-wide text-[10px]">
                      {log.action}
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-900 font-medium">{log.details}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">Target: {log.entity}</p>
                </div>
                <span className="text-slate-500 text-[11px] font-mono">{log.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
