"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  KeyRound,
  Plus,
  ArrowLeft,
  Search,
  Check,
  Copy,
  Trash2,
  AlertCircle,
  X,
  Calendar,
  DollarSign,
  Clock,
  ExternalLink,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  TrendingUp,
  Shield,
  Laptop,
  Share2,
  Receipt,
  Store,
  Building2,
  Layers,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { BrandPageLoader, TableSkeleton } from "@/components/ui/loader";
import {
  DesktopLicense,
  DesktopPackageType,
  DESKTOP_PACKAGE_META,
  formatMachineId,
  buildWhatsAppLicenseMessage,
} from "@/lib/desktopLicense";

export default function DesktopLicensesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { t, language } = useLanguage();

  const [licenses, setLicenses] = useState<DesktopLicense[]>([]);
  const [stats, setStats] = useState<{
    total: number;
    active: number;
    expiringSoon: number;
    expired: number;
    revoked: number;
    totalARR: number;
  }>({
    total: 0,
    active: 0,
    expiringSoon: 0,
    expired: 0,
    revoked: 0,
    totalARR: 0,
  });

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [packageFilter, setPackageFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [selectedLicense, setSelectedLicense] = useState<DesktopLicense | null>(null);

  // Form states for new license
  const [clientName, setClientName] = useState("");
  const [machineId, setMachineId] = useState("");
  const [packageType, setPackageType] = useState<DesktopPackageType>("POS_COMBO");
  const [durationDays, setDurationDays] = useState(365);
  const [annualFee, setAnnualFee] = useState(25000);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [generatedResult, setGeneratedResult] = useState<{
    license: DesktopLicense;
    whatsappMessage: string;
  } | null>(null);

  // Copied feedback states
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.role !== "SUPER_ADMIN" && user.role !== "ADMIN") {
      router.replace("/");
    }
  }, [user, router]);

  const fetchLicenses = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/licenses");
      const json = await res.json();
      if (json.success) {
        setLicenses(json.data || []);
        if (json.stats) setStats(json.stats);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLicenses();
  }, []);

  const handleCopyKey = (key: string, id: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2500);
  };

  const handleShareWhatsApp = (msg: string) => {
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  const handleCreateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/admin/licenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName,
          machineId,
          packageType,
          durationDays,
          annualFee,
          notes,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setGeneratedResult({
          license: json.data,
          whatsappMessage: json.whatsappMessage,
        });
        fetchLicenses();
      } else {
        setFormError(json.error || "Failed to generate license.");
      }
    } catch (err: any) {
      setFormError(err.message || "Network error while generating license.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRenewLicense = async (licId: string) => {
    try {
      setSubmitting(true);
      const res = await fetch("/api/admin/licenses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: licId,
          action: "RENEW",
          durationDays: 365,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setRenewModalOpen(false);
        fetchLicenses();
        if (json.whatsappMessage) {
          handleShareWhatsApp(json.whatsappMessage);
        }
      } else {
        alert(json.error || "Failed to renew license");
      }
    } catch (err: any) {
      alert(err.message || "Error renewing license");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevokeLicense = async (lic: DesktopLicense) => {
    const confirmed = confirm(
      `Are you sure you want to revoke the license for "${lic.clientName}" (${lic.machineId})? This will lock their software.`
    );
    if (!confirmed) return;

    try {
      const res = await fetch("/api/admin/licenses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: lic.id, action: "REVOKE" }),
      });
      const json = await res.json();
      if (json.success) {
        fetchLicenses();
      } else {
        alert(json.error || "Failed to revoke license");
      }
    } catch (err: any) {
      alert(err.message || "Error revoking license");
    }
  };

  const handleDeleteLicense = async (lic: DesktopLicense) => {
    const confirmed = confirm(
      `Permanently delete record for "${lic.clientName}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      const res = await fetch("/api/admin/licenses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: lic.id, action: "DELETE" }),
      });
      const json = await res.json();
      if (json.success) {
        fetchLicenses();
      } else {
        alert(json.error || "Failed to delete license");
      }
    } catch (err: any) {
      alert(err.message || "Error deleting license");
    }
  };

  const filteredLicenses = useMemo(() => {
    return licenses.filter((lic) => {
      // Search
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        lic.clientName.toLowerCase().includes(q) ||
        lic.machineId.toLowerCase().includes(q) ||
        lic.licenseKey.toLowerCase().includes(q) ||
        (lic.notes && lic.notes.toLowerCase().includes(q));

      if (!matchSearch) return false;

      // Package filter
      if (packageFilter !== "ALL" && lic.packageType !== packageFilter) return false;

      // Status filter
      if (statusFilter === "ACTIVE" && (lic.status !== "ACTIVE" || (lic as any).isExpired)) return false;
      if (statusFilter === "EXPIRING_SOON" && ((lic as any).daysRemaining > 30 || (lic as any).daysRemaining <= 0))
        return false;
      if (statusFilter === "EXPIRED" && !(lic as any).isExpired) return false;
      if (statusFilter === "REVOKED" && lic.status !== "REVOKED") return false;

      return true;
    });
  }, [licenses, search, packageFilter, statusFilter]);

  if (loading && licenses.length === 0) {
    return <BrandPageLoader message="Loading Desktop Licenses & Cryptographic Keys..." />;
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white transition shadow-xs"
            title="Back to Admin Dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
                <Laptop className="h-4 w-4" />
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {t("Desktop Licenses & Machine Lock", "ڈیسک ٹاپ لائسنس و مشین لاک")}
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t(
                "Generate 1-year cryptographic hardware-locked keys for offline desktop PC installations",
                "آف لائن کمپیوٹرز کے لیے 1 سالہ ہارڈویئر لاکڈ ڈیجیٹل لائسنس بنائیں اور رینیو کریں"
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setClientName("");
              setMachineId("");
              setPackageType("POS_COMBO");
              setDurationDays(365);
              setAnnualFee(25000);
              setNotes("");
              setFormError(null);
              setGeneratedResult(null);
              setCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-700 transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>{t("Generate New License", "نیا لائسنس بنائیں")}</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Total Active Licenses */}
        <Card className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {t("Active Licenses", "فعال لائسنس")}
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
            {stats.active} <span className="text-xs font-bold text-slate-400">/ {stats.total} Total</span>
          </div>
          <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
            <Shield className="h-3 w-3" />
            <span>{stats.revoked} revoked / {stats.expired} expired</span>
          </div>
        </Card>

        {/* Expiring Soon */}
        <Card className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {t("Expiring in 30 Days", "30 دن میں ختم ہونے والے")}
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
              <Clock className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-amber-600 dark:text-amber-400">
            {stats.expiringSoon}
          </div>
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">
            {t("Ready for renewal billing", "رینیول فیس کے لیے تیار")}
          </div>
        </Card>

        {/* ARR Potential */}
        <Card className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {t("Annual Recurring Value", "سالانہ لائسنس ویلیو")}
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
              <TrendingUp className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
            Rs. {stats.totalARR.toLocaleString()}
          </div>
          <div className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 mt-1">
            {t("Projected annual renewals", "متوقع سالانہ آمدنی")}
          </div>
        </Card>

        {/* Security Standard */}
        <Card className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {t("Security Engine", "سیکیورٹی معیار")}
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
              <KeyRound className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 text-sm font-black text-slate-900 dark:text-white">
            HMAC-SHA256
          </div>
          <div className="text-[11px] font-medium text-purple-600 dark:text-purple-400 mt-1">
            Hardware-bound CPU+MB Lock
          </div>
        </Card>
      </div>

      {/* Filters Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("Search by client name, machine code, key, or notes...", "کلائنٹ کا نام، مشین کوڈ، یا لائسنس کی تلاش کریں...")}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Package filter tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: "ALL", label: t("All Packages", "تمام پیکجز") },
              { id: "ACCOUNTING_ONLY", label: t("Accounting", "اکاؤنٹنگ") },
              { id: "POS_COMBO", label: t("POS + Acc", "پی او ایس") },
              { id: "DI_COMBO", label: t("DI + Acc", "ڈیجیٹل انوائس") },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPackageFilter(p.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  packageFilter === p.id
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Status filter tabs */}
        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs overflow-x-auto">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Status:</span>
          {[
            { id: "ALL", label: t("All Statuses", "تمام") },
            { id: "ACTIVE", label: t("Active (فعال)", "فعال") },
            { id: "EXPIRING_SOON", label: t("Expiring Soon (< 30d)", "جلد ختم ہونے والے") },
            { id: "EXPIRED", label: t("Expired (ختم شدہ)", "ختم شدہ") },
            { id: "REVOKED", label: t("Revoked (معطل)", "معطل") },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => setStatusFilter(s.id)}
              className={`px-2 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition cursor-pointer ${
                statusFilter === s.id
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-bold"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Licenses Table Card */}
      <Card className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs divide-y divide-slate-100 dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3.5">{t("Client / Business Name", "کلائنٹ / دکان کا نام")}</th>
                <th className="px-4 py-3.5">{t("Package Tier", "پیکج")}</th>
                <th className="px-4 py-3.5">{t("Machine Hardware ID", "مشین ہارڈویئر آئی ڈی")}</th>
                <th className="px-4 py-3.5">{t("License Key", "لائسنس کی")}</th>
                <th className="px-4 py-3.5">{t("Validity / Expiry", "میعاد")}</th>
                <th className="px-4 py-3.5">{t("Status", "حیثیت")}</th>
                <th className="px-4 py-3.5 text-right">{t("Actions", "ایکشنز")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {filteredLicenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400 text-xs">
                    {licenses.length === 0
                      ? "No desktop licenses have been generated yet. Click 'Generate New License' to create your first client license."
                      : "No licenses match the selected search and filter criteria."}
                  </td>
                </tr>
              ) : (
                filteredLicenses.map((lic) => {
                  const meta = DESKTOP_PACKAGE_META[lic.packageType];
                  const daysRemaining = (lic as any).daysRemaining ?? 0;
                  const isExpired = (lic as any).isExpired ?? false;
                  const isGracePeriod = (lic as any).isGracePeriod ?? false;

                  return (
                    <tr key={lic.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                      {/* Client Name */}
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900 dark:text-white">{lic.clientName}</div>
                        {lic.notes && (
                          <div className="text-[11px] text-slate-400 truncate max-w-[200px]">{lic.notes}</div>
                        )}
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Issued: {lic.issuedAt} {lic.annualFee ? `• Rs. ${lic.annualFee.toLocaleString()}/yr` : ""}
                        </div>
                      </td>

                      {/* Package Tier */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide ${
                            lic.packageType === "POS_COMBO"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                              : lic.packageType === "DI_COMBO"
                              ? "bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800"
                              : "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800"
                          }`}
                        >
                          {lic.packageType === "POS_COMBO" && <Store className="h-3 w-3" />}
                          {lic.packageType === "DI_COMBO" && <Building2 className="h-3 w-3" />}
                          {lic.packageType === "ACCOUNTING_ONLY" && <Receipt className="h-3 w-3" />}
                          <span>{meta?.label || lic.packageType}</span>
                        </span>
                      </td>

                      {/* Machine Hardware ID */}
                      <td className="px-4 py-3">
                        <div className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                          <Laptop className="h-3 w-3 text-slate-400" />
                          <span>{lic.machineId}</span>
                        </div>
                      </td>

                      {/* License Key */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <code className="text-[11px] font-mono font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50/60 dark:bg-indigo-950/40 px-2 py-1 rounded border border-indigo-200 dark:border-indigo-800/80">
                            {lic.licenseKey}
                          </code>
                          <button
                            type="button"
                            onClick={() => handleCopyKey(lic.licenseKey, lic.id)}
                            className="p-1 rounded text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                            title="Copy License Key"
                          >
                            {copiedKeyId === lic.id ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Validity / Expiry */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{lic.expiresAt}</div>
                        <div>
                          {isExpired ? (
                            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
                              ⚠️ Expired ({Math.abs(daysRemaining)} days ago)
                            </span>
                          ) : isGracePeriod ? (
                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                              ⏳ In Grace Period ({Math.abs(daysRemaining)}d overdue)
                            </span>
                          ) : daysRemaining <= 30 ? (
                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                              ⚠️ {daysRemaining} days left
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                              🟢 {daysRemaining} days remaining
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        {lic.status === "REVOKED" ? (
                          <Badge variant="danger" className="text-[10px] uppercase font-bold">
                            Revoked
                          </Badge>
                        ) : isExpired ? (
                          <Badge variant="outline" className="text-[10px] text-rose-600 border-rose-300 font-bold uppercase">
                            Expired
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] uppercase font-bold">
                            Active
                          </Badge>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Share on WhatsApp */}
                          <button
                            type="button"
                            onClick={() => handleShareWhatsApp(buildWhatsAppLicenseMessage(lic))}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition shadow-xs cursor-pointer"
                            title="Send Activation on WhatsApp"
                          >
                            <Share2 className="h-3 w-3" />
                            <span>WhatsApp</span>
                          </button>

                          {/* Renew (+1 Year) */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedLicense(lic);
                              setRenewModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-800 transition cursor-pointer"
                            title="Renew License (+1 Year)"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </button>

                          {/* Revoke / Delete */}
                          {lic.status === "ACTIVE" ? (
                            <button
                              type="button"
                              onClick={() => handleRevokeLicense(lic)}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-slate-800 transition cursor-pointer"
                              title="Revoke License"
                            >
                              <Shield className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleDeleteLicense(lic)}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-slate-800 transition cursor-pointer"
                              title="Delete Record"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ──────────────── Create License Modal ──────────────── */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-[#111827] max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
                  <KeyRound className="h-4 w-4" />
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {generatedResult
                    ? t("License Generated Successfully", "لائسنس کامیابی سے بن گیا")
                    : t("Generate Desktop License", "نیا ڈیسک ٹاپ لائسنس بنائیں")}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Generated Success Screen */}
            {generatedResult ? (
              <div className="mt-5 space-y-4">
                <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-950/30 text-center space-y-2">
                  <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
                  <div className="text-sm font-black text-slate-900 dark:text-white">
                    {generatedResult.license.clientName}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Hardware Machine ID: <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{generatedResult.license.machineId}</span>
                  </div>
                </div>

                {/* License Key Box */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {t("Generated Activation Key", "ایکٹیویشن کی")}
                  </label>
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-900 text-white font-mono text-sm font-black border border-slate-800 justify-between">
                    <span className="text-indigo-300 break-all">{generatedResult.license.licenseKey}</span>
                    <button
                      type="button"
                      onClick={() => handleCopyKey(generatedResult.license.licenseKey, "modal")}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold transition flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      {copiedKeyId === "modal" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copiedKeyId === "modal" ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                  <div>• Valid until: <strong className="text-slate-900 dark:text-white">{generatedResult.license.expiresAt}</strong> (1 Year)</div>
                  <div>• Package: <strong className="text-slate-900 dark:text-white">{DESKTOP_PACKAGE_META[generatedResult.license.packageType]?.label}</strong></div>
                </div>

                {/* WhatsApp Button */}
                <button
                  type="button"
                  onClick={() => handleShareWhatsApp(generatedResult.whatsappMessage)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition cursor-pointer"
                >
                  <Share2 className="h-4 w-4" />
                  <span>{t("Send Activation on WhatsApp (واٹس ایپ پر بھیجیں)", "واٹس ایپ پر بھیجیں")}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  {t("Done / Close", "مکمل / بند کریں")}
                </button>
              </div>
            ) : (
              /* Generation Form */
              <form onSubmit={handleCreateLicense} className="mt-4 space-y-4">
                {formError && (
                  <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Client Name */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {t("Client / Business Name", "کلائنٹ یا دکان کا نام")} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="e.g. Al-Madina Cash & Carry, Adeel Garments"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Machine Hardware ID */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {t("Client Machine Hardware Code", "کلائنٹ کا مشین کوڈ")} <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] text-slate-400">From desktop activation screen</span>
                  </div>
                  <input
                    type="text"
                    required
                    value={machineId}
                    onChange={(e) => setMachineId(e.target.value)}
                    placeholder="e.g. MCH-8F29-A4B1-99C3"
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400">
                    Client copies this code directly from their Accounts360 Desktop installation screen.
                  </p>
                </div>

                {/* Package Tier Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {t("Select Software Package Tier", "سافٹ ویئر پیکج منتخب کریں")} <span className="text-rose-500">*</span>
                  </label>

                  <div className="grid grid-cols-1 gap-2.5">
                    {/* 1. Accounting Only */}
                    <label
                      onClick={() => setPackageType("ACCOUNTING_ONLY")}
                      className={`flex items-start gap-3 p-3 rounded-2xl border text-xs cursor-pointer transition ${
                        packageType === "ACCOUNTING_ONLY"
                          ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 ring-2 ring-indigo-500/30"
                          : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="packageType"
                        checked={packageType === "ACCOUNTING_ONLY"}
                        onChange={() => setPackageType("ACCOUNTING_ONLY")}
                        className="mt-0.5 text-indigo-600"
                      />
                      <div className="flex-1">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                          <span>{t("1. Accounting Suite Only", "صرف مالیاتی اکاؤنٹس و لیجر")}</span>
                          <span className="text-[10px] font-black text-indigo-600 uppercase">Standard</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Cash Drawer & Cash Book, Full Double-Entry Ledger, Sales & Purchase Returns (Restocking & Balance Refund), 80mm Thermal & A4 Print. (Zero FBR complexity).
                        </p>
                      </div>
                    </label>

                    {/* 2. Retail POS Combo */}
                    <label
                      onClick={() => setPackageType("POS_COMBO")}
                      className={`flex items-start gap-3 p-3 rounded-2xl border text-xs cursor-pointer transition ${
                        packageType === "POS_COMBO"
                          ? "border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30 ring-2 ring-emerald-500/30"
                          : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="packageType"
                        checked={packageType === "POS_COMBO"}
                        onChange={() => setPackageType("POS_COMBO")}
                        className="mt-0.5 text-emerald-600"
                      />
                      <div className="flex-1">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                          <span>{t("2. Retail POS + Accounting Combo", "ریٹیل پی او ایس کاؤنٹر و اکاؤنٹس")}</span>
                          <span className="text-[10px] font-black text-emerald-600 uppercase">Popular</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Retail Cashier Counter, Barcode Scanner, Cash Drawer, Counter Returns & Credit Notes, 80mm Thermal Slips, FBR POS QR + Full Double-Entry Ledger.
                        </p>
                      </div>
                    </label>

                    {/* 3. DI Combo */}
                    <label
                      onClick={() => setPackageType("DI_COMBO")}
                      className={`flex items-start gap-3 p-3 rounded-2xl border text-xs cursor-pointer transition ${
                        packageType === "DI_COMBO"
                          ? "border-purple-600 bg-purple-50/50 dark:bg-purple-950/30 ring-2 ring-purple-500/30"
                          : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="packageType"
                        checked={packageType === "DI_COMBO"}
                        onChange={() => setPackageType("DI_COMBO")}
                        className="mt-0.5 text-purple-600"
                      />
                      <div className="flex-1">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                          <span>{t("3. Digital Invoicing + Accounting Combo", "ایف بی آر ڈیجیٹل انوائسنگ و اکاؤنٹس")}</span>
                          <span className="text-[10px] font-black text-purple-600 uppercase">Enterprise</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Statutory B2B Digital Invoicing for registered buyers (STRN), variable tax rates (18%, 15%, 8th Sched), credit notes + full ledger.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Duration & Fee */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {t("Validity Duration", "لائسنس کی مدت")}
                    </label>
                    <select
                      value={durationDays}
                      onChange={(e) => setDurationDays(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value={365}>1 Year (365 Days) [Standard]</option>
                      <option value={730}>2 Years (730 Days)</option>
                      <option value={180}>6 Months (180 Days)</option>
                      <option value={30}>1 Month Trial (30 Days)</option>
                      <option value={3650}>Lifetime (10 Years)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {t("Annual Fee (PKR)", "سالانہ لائسنس فیس")}
                    </label>
                    <input
                      type="number"
                      value={annualFee}
                      onChange={(e) => setAnnualFee(Number(e.target.value))}
                      placeholder="25000"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Internal Notes */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {t("Internal Notes", "اندرونی نوٹس")}
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Shop # 14 Tariq Road, Paid via HBL"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Submit Buttons */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                  >
                    {t("Cancel", "منسوخ")}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/20 transition cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>{submitting ? "Signing Key..." : t("Generate Activation Key", "لائسنس کی بنائیں")}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ──────────────── Renew Modal ──────────────── */}
      {renewModalOpen && selectedLicense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-[#111827]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Renew License: {selectedLicense.clientName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRenewModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <p>
                Extending license for <strong>{selectedLicense.clientName}</strong> ({selectedLicense.machineId}) by <strong>+1 Year (365 Days)</strong>.
              </p>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 space-y-1">
                <div>• Current Expiry: <strong>{selectedLicense.expiresAt}</strong></div>
                <div>• Package: <strong>{DESKTOP_PACKAGE_META[selectedLicense.packageType]?.label}</strong></div>
              </div>
              <p className="text-[11px] text-slate-400">
                A new cryptographic license key will be generated and signed with the extended expiration date.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 mt-5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setRenewModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleRenewLicense(selectedLicense.id)}
                className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
              >
                {submitting ? "Renewing..." : "Confirm & Renew (+1 Year)"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
