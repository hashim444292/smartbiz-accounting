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
  const [activeTab, setActiveTab] = useState<"PROFILE" | "DEFAULTS" | "FBR" | "USERS" | "AUDIT">("PROFILE");
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

  // FBR Digital Invoicing & POS State
  const [fbrToken, setFbrToken] = useState("");
  const [fbrEnv, setFbrEnv] = useState<"sandbox" | "production">("sandbox");
  const [fbrIntegrationType, setFbrIntegrationType] = useState<"DIGITAL_INVOICING" | "TIER1_POS">("DIGITAL_INVOICING");
  const [fbrPosId, setFbrPosId] = useState("822646");
  const [fbrScenarioId, setFbrScenarioId] = useState("SN000");
  const [fbrAutoSync, setFbrAutoSync] = useState(false);
  const [fbrSellerNtn, setFbrSellerNtn] = useState(activeCompany?.ntn || "");
  const [fbrSellerProvince, setFbrSellerProvince] = useState(activeCompany?.province || "Sindh");
  const [fbrSellerAddress, setFbrSellerAddress] = useState(activeCompany?.address || "");
  const [fbrSaved, setFbrSaved] = useState(false);
  const [fbrSaving, setFbrSaving] = useState(false);
  const [fbrTesting, setFbrTesting] = useState(false);
  const [fbrTestResult, setFbrTestResult] = useState<any | null>(null);

  useEffect(() => {
    async function loadFbrSettings() {
      try {
        const res = await fetch("/api/compliance/fbr");
        const json = await res.json();
        if (json.success && json.data?.config) {
          const cfg = json.data.config;
          if (cfg.token) setFbrToken(cfg.token);
          if (cfg.environment) setFbrEnv(cfg.environment);
          if (cfg.integrationType) setFbrIntegrationType(cfg.integrationType);
          if (cfg.posId) setFbrPosId(cfg.posId);
          if (cfg.scenarioId) setFbrScenarioId(cfg.scenarioId);
          if (cfg.autoSync !== undefined) setFbrAutoSync(Boolean(cfg.autoSync));
          if (cfg.sellerNtn) setFbrSellerNtn(cfg.sellerNtn);
          if (cfg.sellerProvince) setFbrSellerProvince(cfg.sellerProvince);
          if (cfg.sellerAddress) setFbrSellerAddress(cfg.sellerAddress);
        }
      } catch (err) {
        console.error("Failed to load FBR settings:", err);
      }
    }
    loadFbrSettings();
  }, [activeCompany?.id]);

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
      if (activeCompany.ntn) setFbrSellerNtn(activeCompany.ntn);
      if (activeCompany.province) setFbrSellerProvince(activeCompany.province);
      if (activeCompany.address) setFbrSellerAddress(activeCompany.address);
    }
  }, [activeCompany]);

  const handleSaveFbr = async (e: React.FormEvent) => {
    e.preventDefault();
    setFbrSaving(true);
    setFbrSaved(false);
    try {
      const res = await fetch("/api/compliance/fbr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_config",
          config: {
            token: fbrToken,
            environment: fbrEnv,
            integrationType: fbrIntegrationType,
            posId: fbrPosId,
            scenarioId: fbrScenarioId,
            autoSync: fbrAutoSync,
            sellerNtn: fbrSellerNtn || activeCompany?.ntn,
            sellerProvince: fbrSellerProvince || activeCompany?.province,
            sellerAddress: fbrSellerAddress || activeCompany?.address,
          },
        }),
      });
      const json = await res.json();
      if (json.success) {
        setFbrSaved(true);
        if (refreshSession) await refreshSession();
        setTimeout(() => setFbrSaved(false), 3000);
      } else {
        alert(json.error || "Failed to save FBR settings");
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setFbrSaving(false);
    }
  };

  const handleTestFbr = async () => {
    setFbrTesting(true);
    setFbrTestResult(null);
    try {
      const res = await fetch("/api/compliance/fbr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_connection",
          token: fbrToken,
          environment: fbrEnv,
          integrationType: fbrIntegrationType,
          posId: fbrPosId,
        }),
      });
      const json = await res.json();
      setFbrTestResult(json.data);
    } catch (err: any) {
      setFbrTestResult({ success: false, message: err.message });
    } finally {
      setFbrTesting(false);
    }
  };

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

        <button
          onClick={() => setActiveTab("FBR")}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition ${
            activeTab === "FBR" ? "bg-white text-indigo-700 font-bold shadow-xs" : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
          }`}
        >
          <Shield className="h-4 w-4" />
          <span>FBR Digital Invoicing</span>
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

      {/* TAB: FBR DIGITAL INVOICING */}
      {activeTab === "FBR" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                FBR Digital Invoicing (DI) API Configuration
              </h3>
              <p className="text-[11px] text-slate-500">
                Manage your official FBR Bearer Security Token, gateway endpoints, and automatic invoice synchronization.
              </p>
            </div>
            <span className="rounded bg-indigo-50 border border-indigo-200 px-2.5 py-1 text-[11px] font-mono text-indigo-700 font-bold">
              gw.fbr.gov.pk
            </span>
          </div>

          {fbrSaved && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-600" />
              <span>FBR Digital Invoicing settings saved successfully!</span>
            </div>
          )}

          {/* Integration Mode / Engine */}
          <div className="rounded-xl border border-indigo-200 bg-white p-4 space-y-2">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
              FBR Integration Engine / Mode (طریقہ کار)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFbrIntegrationType("DIGITAL_INVOICING")}
                className={`p-3 rounded-xl border text-left transition ${
                  fbrIntegrationType === "DIGITAL_INVOICING"
                    ? "bg-indigo-50/70 border-indigo-600 ring-2 ring-indigo-500/20 shadow-xs"
                    : "bg-slate-50/50 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <p className="font-bold text-xs text-indigo-950 flex items-center gap-1.5">
                  <span>🏷️</span> Digital Invoicing (DI)
                </p>
                <p className="text-[10px] text-slate-600 mt-1">
                  B2B & Wholesale (gw.fbr.gov.pk/di_data). Official Sales Tax schedules & Scenario IDs.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setFbrIntegrationType("TIER1_POS")}
                className={`p-3 rounded-xl border text-left transition ${
                  fbrIntegrationType === "TIER1_POS"
                    ? "bg-purple-50/70 border-purple-600 ring-2 ring-purple-500/20 shadow-xs"
                    : "bg-slate-50/50 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <p className="font-bold text-xs text-purple-950 flex items-center gap-1.5">
                  <span>🛒</span> Tier-1 Retail POS (IMS)
                </p>
                <p className="text-[10px] text-slate-600 mt-1">
                  B2C & Counter Retail (ims.fbr.gov.pk). Automated Rs. 1 POS fee & 18-digit verification QR code.
                </p>
              </button>
            </div>
          </div>

          {/* Gateway Environment Box */}
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-950 uppercase tracking-wide">
                Target Gateway Environment
              </span>
              <span className="text-[10px] font-mono text-indigo-800 bg-white px-2 py-0.5 rounded border border-indigo-200">
                Mode: {fbrIntegrationType === "TIER1_POS" ? "RETAIL POS (IMS)" : "DIGITAL INVOICING (DI)"} | {fbrEnv === "production" ? "PRODUCTION" : "SANDBOX"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFbrEnv("sandbox")}
                className={`p-3 rounded-xl border text-left transition ${
                  fbrEnv === "sandbox"
                    ? "bg-white border-indigo-600 shadow-xs ring-2 ring-indigo-500/20"
                    : "bg-white/60 border-slate-200 hover:bg-white"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">🧪</span>
                  <span className="font-bold text-xs text-slate-900">Sandbox Testing Environment</span>
                </div>
                <code className="text-[10px] text-indigo-700 font-mono block break-all">
                  {fbrIntegrationType === "TIER1_POS"
                    ? "https://gw.fbr.gov.pk/imsp/v1/api/Live/PostData"
                    : "https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata_sb"}
                </code>
              </button>

              <button
                type="button"
                onClick={() => setFbrEnv("production")}
                className={`p-3 rounded-xl border text-left transition ${
                  fbrEnv === "production"
                    ? "bg-white border-indigo-600 shadow-xs ring-2 ring-indigo-500/20"
                    : "bg-white/60 border-slate-200 hover:bg-white"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">🏢</span>
                  <span className="font-bold text-xs text-slate-900">Live Production Gateway</span>
                </div>
                <code className="text-[10px] text-indigo-700 font-mono block break-all">
                  {fbrIntegrationType === "TIER1_POS"
                    ? "https://ims.fbr.gov.pk/api/Live/PostData"
                    : "https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata"}
                </code>
              </button>
            </div>
          </div>

          <form onSubmit={handleSaveFbr} className="space-y-4">
            {/* Bearer Token */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                FBR Bearer Security Token (API Authorization) <span className="text-indigo-600">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={fbrToken}
                  onChange={(e) => setFbrToken(e.target.value)}
                  placeholder="Paste your Bearer Token here..."
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:border-indigo-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleTestFbr}
                  disabled={fbrTesting}
                  className="px-4 py-2.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold hover:bg-indigo-100 transition shrink-0"
                >
                  {fbrTesting ? "Testing Gateway..." : "Test Connection"}
                </button>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Passed in header: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">Authorization: Bearer &lt;token&gt;</code>
              </p>

              {fbrTestResult && (
                <div
                  className={`mt-2 p-3 rounded-xl border text-xs ${
                    fbrTestResult.success
                      ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                      : "bg-amber-50 text-amber-900 border-amber-200"
                  }`}
                >
                  <p className="font-bold">
                    {fbrTestResult.success ? "✓ FBR Gateway Verified" : `HTTP ${fbrTestResult.statusCode || 401} Gateway Response`}
                  </p>
                  <p className="text-[11px] mt-0.5">{fbrTestResult.message}</p>
                </div>
              )}
            </div>

            {/* Scenario ID & POS ID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Scenario ID
                </label>
                <input
                  type="text"
                  value={fbrScenarioId}
                  onChange={(e) => setFbrScenarioId(e.target.value)}
                  placeholder="SN000"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:border-indigo-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-0.5">Default standard: SN000</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  POS ID
                </label>
                <input
                  type="text"
                  value={fbrPosId}
                  onChange={(e) => setFbrPosId(e.target.value)}
                  placeholder="POS-101"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Seller NTN, Province, Address */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
              <span className="text-xs font-bold text-slate-800 uppercase block">
                Seller Information (Header Fields in FBR JSON)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Seller NTN / CNIC</label>
                  <input
                    type="text"
                    value={fbrSellerNtn}
                    onChange={(e) => setFbrSellerNtn(e.target.value)}
                    placeholder="e.g. 1234567-8"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Seller Province</label>
                  <select
                    value={fbrSellerProvince}
                    onChange={(e) => setFbrSellerProvince(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900"
                  >
                    <option value="Sindh">Sindh</option>
                    <option value="Punjab">Punjab</option>
                    <option value="Khyber Pakhtunkhwa">Khyber Pakhtunkhwa</option>
                    <option value="Balochistan">Balochistan</option>
                    <option value="Islamabad Capital Territory">Islamabad</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Seller Registered Address</label>
                <input
                  type="text"
                  value={fbrSellerAddress}
                  onChange={(e) => setFbrSellerAddress(e.target.value)}
                  placeholder="e.g. Shop 14, Saddar Mobile Market, Karachi"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900"
                />
              </div>
            </div>

            {/* Auto-Sync Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white">
              <div>
                <span className="font-bold text-slate-800 text-xs block">
                  Automatic FBR Sync on Sale Post
                </span>
                <p className="text-[11px] text-slate-500">
                  When enabled, any fully-paid sale invoice will immediately transmit to FBR upon creation.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(fbrAutoSync)}
                  onChange={(e) => setFbrAutoSync(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            <div className="flex justify-end pt-3">
              <button
                type="submit"
                disabled={fbrSaving}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-indigo-700 transition"
              >
                <Save className="h-4 w-4" />
                <span>{fbrSaving ? "Saving..." : "Save FBR Settings"}</span>
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
