"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Plus,
  ArrowLeft,
  Search,
  Check,
  Edit2,
  Trash2,
  AlertCircle,
  X,
  Layers,
  CreditCard,
  Calendar,
  DollarSign,
  Clock,
  ArrowUpRight,
  Receipt,
  Sparkles,
  RefreshCw,
  Banknote,
  CheckCircle2,
  Wallet,
  TrendingUp,
  Shield,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { BrandPageLoader, TableSkeleton } from "@/components/ui/loader";

const AVAILABLE_MODULES = [
  { id: "sales", label: "Sales & POS Invoicing", desc: "Customer invoices, POS checkout & sales tax" },
  { id: "purchases", label: "Purchases & Re-buy Bills", desc: "Supplier bills, price tracking & re-buy rates" },
  { id: "inventory", label: "Inventory & Stock Ledger", desc: "Live physical stock, warehouses & HS codes" },
  { id: "accounting", label: "Double-Entry General Ledger", desc: "Cash in hand, bank accounts & expense vouchers" },
  { id: "compliance", label: "FBR Digital POS & Tax QR", desc: "Real-time FBR submission & verification receipts" },
  { id: "reports", label: "Closing Financial Reports", desc: "Balance sheet, P&L, and monthly tax summaries" },
  { id: "aiEntry", label: "AI Smart Invoice OCR", desc: "Document scanning & automatic line-item extraction" },
  { id: "bulkImport", label: "Bulk Import Wizard", desc: "Excel & CSV data import for catalog & opening balances" },
];

export default function CompaniesManagementPage() {
  const router = useRouter();
  const { user, activeCompany, switchCompany, inspectCompany } = useAuth();
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingStats, setBillingStats] = useState<any>(null);
  const [paymentsLedger, setPaymentsLedger] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"COMPANIES" | "LEDGER">("COMPANIES");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "DUE" | "OVERDUE">("ALL");

  useEffect(() => {
    if (user && user.role !== "SUPER_ADMIN") {
      router.replace("/");
    }
  }, [user, router]);

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<any | null>(null);
  const [switchingCompanyId, setSwitchingCompanyId] = useState<string | null>(null);

  // Quick Renewal / Record Payment Modal
  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [renewCompany, setRenewCompany] = useState<any | null>(null);
  const [renewFormData, setRenewFormData] = useState({
    amount: "5000",
    paymentMethod: "BANK",
    reference: "",
    period: "",
    notes: "Monthly subscription fee renewal",
  });
  const [renewSubmitting, setRenewSubmitting] = useState(false);

  // Form State
  const initialFormState = {
    name: "",
    ownerName: "",
    phone: "",
    email: "",
    address: "",
    city: "Karachi",
    province: "Sindh",
    ntn: "",
    strn: "",
    businessType: "Retail & Wholesale",
    defaultHsCode: "8517.13",
    defaultUom: "pcs",
    defaultSalesTax: "18",
    defaultFurtherTax: "3",
    currency: "PKR",
    currencySymbol: "Rs",
    defaultPaymentTerms: "30",
    defaultTaxRate: "18",
    monthlyFee: "5000",
    billingPlan: "Standard Monthly",
    billingCycleEnd: "",
    canCreateBranches: false,
    fbrToken: "",
    fbrEnv: "sandbox",
    fbrIntegrationType: "DIGITAL_INVOICING",
    fbrPosId: "822646",
    fbrScenarioId: "SN000",
    fbrAutoSync: false,
    enabledModules: [
      "sales",
      "purchases",
      "inventory",
      "accounting",
      "compliance",
      "reports",
      "aiEntry",
      "bulkImport",
    ] as string[],
  };

  const [formData, setFormData] = useState(initialFormState);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [testingFbr, setTestingFbr] = useState(false);
  const [fbrTestMessage, setFbrTestMessage] = useState<{ success: boolean; text: string } | null>(null);

  const testFbrConnection = async (
    token: string,
    env: string,
    integrationType = formData.fbrIntegrationType,
    posId = formData.fbrPosId
  ) => {
    if (!token || !token.trim()) {
      setFbrTestMessage({ success: false, text: "Please enter an FBR Bearer Token first." });
      return;
    }
    setTestingFbr(true);
    setFbrTestMessage(null);
    try {
      const res = await fetch("/api/compliance/fbr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_connection",
          token,
          environment: env,
          integrationType,
          posId,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setFbrTestMessage({
          success: true,
          text: json.data?.message || "FBR Gateway Connection Verified! Token is valid.",
        });
      } else {
        setFbrTestMessage({
          success: false,
          text: json.data?.message || json.error || `HTTP ${json.data?.statusCode || 401} response from FBR Gateway`,
        });
      }
    } catch (err: any) {
      setFbrTestMessage({ success: false, text: err.message });
    } finally {
      setTestingFbr(false);
    }
  };

  const toggleModule = (modId: string) => {
    setFormData((prev: any) => {
      const current = prev.enabledModules || [];
      const exists = current.includes(modId);
      return {
        ...prev,
        enabledModules: exists
          ? current.filter((m: string) => m !== modId)
          : [...current, modId],
      };
    });
  };

  const fetchCompanies = async () => {
    try {
      const res = await fetch("/api/admin/companies");
      const data = await res.json();
      if (data.success) {
        setCompanies(data.data || []);
      }
    } catch (err) {
      console.error("Failed to load companies:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBillingData = async () => {
    try {
      const res = await fetch("/api/admin/billing");
      const data = await res.json();
      if (data.success) {
        setBillingStats(data.stats || null);
        setPaymentsLedger(data.payments || []);
      }
    } catch (err) {
      console.error("Failed to load billing stats:", err);
    }
  };

  useEffect(() => {
    fetchCompanies();
    fetchBillingData();
  }, []);

  const getDaysRemaining = (endDateStr?: string) => {
    if (!endDateStr) {
      return {
        days: 0,
        label: "Not Set",
        badgeClass: "bg-slate-100 text-slate-600 border-slate-200",
        isOverdue: false,
        isDueSoon: false,
      };
    }
    const target = new Date(endDateStr);
    const now = new Date();
    const targetMidnight = new Date(target.getFullYear(), target.getMonth(), target.getDate());
    const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffTime = targetMidnight.getTime() - nowMidnight.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        days: diffDays,
        label: `Expired (${Math.abs(diffDays)}d ago)`,
        badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
        isOverdue: true,
        isDueSoon: false,
      };
    } else if (diffDays === 0) {
      return {
        days: 0,
        label: "Due Today",
        badgeClass: "bg-amber-50 text-amber-800 border-amber-300 font-bold animate-pulse",
        isOverdue: false,
        isDueSoon: true,
      };
    } else if (diffDays <= 7) {
      return {
        days: diffDays,
        label: `${diffDays} Day${diffDays > 1 ? "s" : ""} Left`,
        badgeClass: "bg-amber-50 text-amber-700 border-amber-200 font-bold",
        isOverdue: false,
        isDueSoon: true,
      };
    } else {
      return {
        days: diffDays,
        label: `${diffDays} Days Left`,
        badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold",
        isOverdue: false,
        isDueSoon: false,
      };
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/admin/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      if (data.success) {
        setModalOpen(false);
        setFormData(initialFormState);
        await Promise.all([fetchCompanies(), fetchBillingData()]);
      } else {
        setFormError(data.error || "Failed to create company");
      }
    } catch (err: any) {
      setFormError(err.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;
    setFormError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/admin/companies/${selectedCompany.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      if (data.success) {
        setEditModalOpen(false);
        setSelectedCompany(null);
        await Promise.all([fetchCompanies(), fetchBillingData()]);
      } else {
        setFormError(data.error || "Failed to update company");
      }
    } catch (err: any) {
      setFormError(err.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCompany = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to permanently delete "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/companies/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        await Promise.all([fetchCompanies(), fetchBillingData()]);
      } else {
        alert(data.error || "Failed to delete company");
      }
    } catch (err: any) {
      alert(err.message || "Network error");
    }
  };

  const handleToggleMultiBranch = async (comp: any) => {
    try {
      const nextVal = !comp.canCreateBranches;
      const res = await fetch(`/api/admin/companies/${comp.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canCreateBranches: nextVal }),
      });
      const data = await res.json();
      if (data.success) {
        await Promise.all([fetchCompanies(), fetchBillingData()]);
      } else {
        alert(data.error || "Failed to update branch permission");
      }
    } catch (err: any) {
      alert(err.message || "Network error");
    }
  };

  const openEditModal = (comp: any) => {
    setSelectedCompany(comp);
    setFormData({
      name: comp.name || "",
      ownerName: comp.ownerName || "",
      phone: comp.phone && comp.phone !== "—" ? comp.phone : "",
      email: comp.email && comp.email !== "—" ? comp.email : "",
      address: comp.address && comp.address !== "—" ? comp.address : "",
      city: comp.city || "Karachi",
      province: comp.province || "Sindh",
      ntn: comp.ntn && comp.ntn !== "—" ? comp.ntn : "",
      strn: comp.strn && comp.strn !== "—" ? comp.strn : "",
      businessType: comp.businessType || "Retail & Wholesale",
      defaultHsCode: comp.defaultHsCode || "8517.13",
      defaultUom: comp.defaultUom || "pcs",
      defaultSalesTax: String(comp.defaultSalesTax || 18),
      defaultFurtherTax: String(comp.defaultFurtherTax || 3),
      currency: comp.currency || "PKR",
      currencySymbol: comp.currencySymbol || "Rs",
      defaultPaymentTerms: String(comp.defaultPaymentTerms || 30),
      defaultTaxRate: String(comp.defaultTaxRate || 18),
      monthlyFee: String(comp.monthlyFee || 5000),
      billingPlan: comp.billingPlan || "Standard Monthly",
      billingCycleEnd: comp.billingCycleEnd ? comp.billingCycleEnd.slice(0, 10) : "",
      canCreateBranches: Boolean(comp.canCreateBranches),
      fbrToken: comp.fbrToken || "",
      fbrEnv: comp.fbrEnv || "sandbox",
      fbrIntegrationType: comp.fbrIntegrationType || "DIGITAL_INVOICING",
      fbrPosId: comp.fbrPosId || "822646",
      fbrScenarioId: comp.fbrScenarioId || "SN000",
      fbrAutoSync: Boolean(comp.fbrAutoSync),
      enabledModules: comp.enabledModules || [
        "sales",
        "purchases",
        "inventory",
        "accounting",
        "compliance",
        "reports",
        "aiEntry",
        "bulkImport",
      ],
    });
    setEditModalOpen(true);
  };

  const openRenewModal = (comp: any) => {
    setRenewCompany(comp);
    const now = new Date();
    const periodName = now.toLocaleString("default", { month: "long", year: "numeric" });
    setRenewFormData({
      amount: String(comp.monthlyFee || 5000),
      paymentMethod: "BANK",
      reference: `REC-${Date.now().toString().slice(-6)}`,
      period: periodName,
      notes: `Monthly fee renewal for ${comp.name} (${periodName})`,
    });
    setRenewModalOpen(true);
  };

  const handleRecordRenewal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewCompany) return;
    setRenewSubmitting(true);

    try {
      const res = await fetch("/api/admin/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: renewCompany.id,
          amount: Number(renewFormData.amount),
          paymentMethod: renewFormData.paymentMethod,
          reference: renewFormData.reference,
          period: renewFormData.period,
          notes: renewFormData.notes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setRenewModalOpen(false);
        setRenewCompany(null);
        await Promise.all([fetchCompanies(), fetchBillingData()]);
      } else {
        alert(data.error || "Failed to record renewal");
      }
    } catch (err: any) {
      alert(err.message || "Network error");
    } finally {
      setRenewSubmitting(false);
    }
  };

  const filtered = companies.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.ownerName.toLowerCase().includes(search.toLowerCase()) ||
      (c.defaultHsCode && c.defaultHsCode.includes(search)) ||
      (c.phone && c.phone.includes(search));

    if (!matchesSearch) return false;

    if (statusFilter === "ALL") return true;

    const remaining = getDaysRemaining(c.billingCycleEnd);
    if (statusFilter === "OVERDUE") return remaining.isOverdue;
    if (statusFilter === "DUE") return remaining.isDueSoon;
    if (statusFilter === "ACTIVE") return !remaining.isOverdue && !remaining.isDueSoon;

    return true;
  });

  if (user && user.role !== "SUPER_ADMIN") {
    return (
      <div className="p-12 text-center">
        <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <AlertCircle className="mx-auto h-8 w-8 text-rose-500 mb-3" />
          <h2 className="text-base font-bold text-slate-900">Access Restricted</h2>
          <p className="text-xs text-slate-500 mt-1">
            Companies and Client Registry is exclusively available to Platform Super Administrators.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <BrandPageLoader
          message="Loading Company & Client Registry..."
          submessage="Retrieving tenant database workspaces, billing schedules, and compliance settings..."
        />
        <TableSkeleton rows={6} cols={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Admin Portal</span>
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Building2 className="h-6 w-6 text-indigo-600" />
            <span>Organizations & SaaS Client Registry</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage client companies, monthly subscription pricing, renewal cycles, and total recurring revenue.
          </p>
        </div>

        <button
          onClick={() => {
            setFormData(initialFormState);
            setFormError(null);
            setModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-indigo-700 transition"
        >
          <Plus className="h-4 w-4" />
          <span>Register New Client / Organization</span>
        </button>
      </div>

      {/* SaaS Revenue & Billing Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Monthly Recurring Revenue (MRR) */}
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Total Monthly Revenue (MRR)
              </span>
              <div className="h-8 w-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                Rs {Number(billingStats?.totalMRR || 19000).toLocaleString()}
              </span>
              <span className="text-[11px] font-semibold text-slate-500">/ month</span>
            </div>
            <p className="mt-1 text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              <span>Projected ARR: Rs {Number((billingStats?.totalMRR || 19000) * 12).toLocaleString()}</span>
            </p>
          </CardContent>
        </Card>

        {/* Collected This Month */}
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Collected This Month
              </span>
              <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Banknote className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-600">
                Rs {Number(billingStats?.collectedThisMonth || 0).toLocaleString()}
              </span>
              <span className="text-[11px] font-semibold text-slate-500">received</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {billingStats?.activeCount || 0} active subscriptions up to date
            </p>
          </CardContent>
        </Card>

        {/* Pending / Due Renewals */}
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Pending / Due Renewals
              </span>
              <div className="h-8 w-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-amber-600">
                Rs {Number(billingStats?.pendingDueAmount || 0).toLocaleString()}
              </span>
              <span className="text-[11px] font-semibold text-slate-500">pending</span>
            </div>
            <p className="mt-1 text-[11px] text-amber-700 font-semibold">
              {billingStats?.renewalsDueThisWeek || 0} company renewing within 7 days
            </p>
          </CardContent>
        </Card>

        {/* Total Registered Clients */}
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Client Organizations
              </span>
              <div className="h-8 w-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Building2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">{companies.length}</span>
              <span className="text-[11px] font-semibold text-slate-500">tenants</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px]">
              <span className="font-bold text-emerald-600">{billingStats?.activeCount || 0} Active</span>
              <span className="text-slate-300">•</span>
              <span className="font-bold text-rose-600">{billingStats?.overdueCount || 0} Overdue</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View Switcher Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("COMPANIES")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === "COMPANIES"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            <span>Client Companies & Subscriptions ({companies.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("LEDGER")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === "LEDGER"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Receipt className="h-3.5 w-3.5" />
            <span>SaaS Subscription Ledger & Receipts ({paymentsLedger.length})</span>
          </button>
        </div>

        <button
          onClick={() => {
            fetchCompanies();
            fetchBillingData();
          }}
          className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition"
          title="Refresh Data"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {activeTab === "COMPANIES" ? (
        <>
          {/* Search & Status Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search company, owner, phone, or HS Code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 shadow-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto">
              {(["ALL", "ACTIVE", "DUE", "OVERDUE"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                    statusFilter === filter
                      ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200/80 border border-transparent"
                  }`}
                >
                  {filter === "ALL" && `All (${companies.length})`}
                  {filter === "ACTIVE" && `Active (${billingStats?.activeCount || 0})`}
                  {filter === "DUE" && `Due Soon (${billingStats?.dueCount || 0})`}
                  {filter === "OVERDUE" && `Overdue (${billingStats?.overdueCount || 0})`}
                </button>
              ))}
            </div>
          </div>

          {/* Companies & Billing Table */}
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase font-bold text-slate-500">
                  <tr>
                    <th className="py-3 px-4">Organization / Client</th>
                    <th className="py-3 px-4">Owner & Contact</th>
                    <th className="py-3 px-4">Registered Date</th>
                    <th className="py-3 px-4">Monthly Fee</th>
                    <th className="py-3 px-4">Month End / Renewal Due</th>
                    <th className="py-3 px-4 text-center">Renewal Countdown</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {filtered.map((comp) => {
                    const isActive = comp.id === activeCompany?.id;
                    const remaining = getDaysRemaining(comp.billingCycleEnd);

                    return (
                      <tr key={comp.id} className="hover:bg-slate-50/80 transition">
                        {/* Company Name & Type */}
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-slate-900 text-xs">{comp.name}</p>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className="text-[10px] text-slate-500">{comp.businessType || "Enterprise"}</span>
                            {comp.defaultHsCode && (
                              <span className="font-mono text-[9px] bg-slate-100 text-slate-600 px-1 rounded border border-slate-200">
                                HS {comp.defaultHsCode}
                              </span>
                            )}
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                              🛡️ {comp.enabledModules ? `${comp.enabledModules.length}/8` : "8/8"} Modules
                            </span>
                            <button
                              type="button"
                              onClick={() => handleToggleMultiBranch(comp)}
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded border transition inline-flex items-center gap-1 ${
                                comp.canCreateBranches
                                  ? "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                                  : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                              }`}
                              title="Click to toggle Multi-Branch authorization for this company"
                            >
                              <span>🏢 {comp.canCreateBranches ? "Multi-Branch: Enabled (ملٹی برانچ)" : "Single Branch (سنگل برانچ)"}</span>
                            </button>
                          </div>
                        </td>

                        {/* Owner & Contact */}
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-slate-900">{comp.ownerName}</p>
                          <p className="text-[11px] text-slate-500">{comp.phone}</p>
                        </td>

                        {/* Registered Date (kab se register howe) */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 text-slate-700">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            <span className="font-medium">{formatDate(comp.createdAt)}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {comp.city || "Karachi"}, {comp.province || "Sindh"}
                          </p>
                        </td>

                        {/* Monthly Fee (monthly basis paise) */}
                        <td className="py-3.5 px-4">
                          <p className="font-black text-slate-900 text-xs">
                            Rs {Number(comp.monthlyFee || 5000).toLocaleString()}{" "}
                            <span className="text-[10px] font-normal text-slate-500">/ mo</span>
                          </p>
                          <span className="inline-block mt-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {comp.billingPlan || "Standard Monthly"}
                          </span>
                        </td>

                        {/* Month End / Next Renewal Date */}
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-slate-900">{formatDate(comp.billingCycleEnd)}</p>
                          <p className="text-[10px] text-slate-500">
                            Last Paid: {formatDate(comp.lastPaymentDate)}
                          </p>
                        </td>

                        {/* Renewal Countdown Badge */}
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] border ${remaining.badgeClass}`}>
                            {remaining.label}
                          </span>
                        </td>

                        {/* Subscription Status */}
                        <td className="py-3.5 px-4 text-center">
                          {remaining.isOverdue ? (
                            <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded">
                              OVERDUE
                            </span>
                          ) : (
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded">
                              PAID
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Inspect Client Workspace as Super Admin */}
                            <button
                              onClick={() => inspectCompany(comp.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 transition shadow-2xs"
                              title="Inspect this client's accounting workspace"
                            >
                              <Shield className="h-3.5 w-3.5 text-purple-600" />
                              <span>Inspect</span>
                            </button>

                            {/* Record Payment / Renew Month Button */}
                            <button
                              onClick={() => openRenewModal(comp)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition shadow-2xs"
                              title="Record Monthly Payment & Renew"
                            >
                              <Banknote className="h-3.5 w-3.5 text-emerald-600" />
                              <span>Renew / Pay</span>
                            </button>

                            {!isActive && (
                              <button
                                disabled={switchingCompanyId !== null}
                                onClick={async () => {
                                  setSwitchingCompanyId(comp.id);
                                  await switchCompany(comp.id);
                                  setSwitchingCompanyId(null);
                                }}
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition ${
                                  switchingCompanyId === comp.id
                                    ? "bg-amber-50 text-amber-700 border-amber-300 animate-pulse cursor-wait"
                                    : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200"
                                }`}
                                title="Switch into this company"
                              >
                                {switchingCompanyId === comp.id ? (
                                  <>
                                    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
                                    <span>...</span>
                                  </>
                                ) : (
                                  <>
                                    <Check className="h-3 w-3" />
                                    <span>Switch</span>
                                  </>
                                )}
                              </button>
                            )}

                            <button
                              onClick={() => openEditModal(comp)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                              title="Edit Company Details & Pricing"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>

                            <button
                              onClick={() => handleDeleteCompany(comp.id, comp.name)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                              title="Delete Company"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filtered.length === 0 && !loading && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                        No organizations found matching your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Tab 2: SaaS Subscription Ledger Table */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Receipt className="h-4 w-4 text-indigo-600" />
                <span>Subscription Payment Receipts Ledger</span>
              </h3>
              <p className="text-xs text-slate-500">
                Audit trail of all recurring subscription payments received from client organizations.
              </p>
            </div>
            <div className="text-xs font-bold text-slate-600">
              Total Receipts: {paymentsLedger.length}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase font-bold text-slate-500">
                  <tr>
                    <th className="py-3 px-4">Receipt # / Ref</th>
                    <th className="py-3 px-4">Client Organization</th>
                    <th className="py-3 px-4">Amount Paid</th>
                    <th className="py-3 px-4">Period Covered</th>
                    <th className="py-3 px-4">Payment Method</th>
                    <th className="py-3 px-4">Payment Date</th>
                    <th className="py-3 px-4">Recorded By</th>
                    <th className="py-3 px-4">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {paymentsLedger.map((pay) => (
                    <tr key={pay.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-indigo-700">
                        {pay.reference || pay.id}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {pay.businessName}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-black text-emerald-600">
                          Rs {Number(pay.amount).toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {pay.period}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                          {pay.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {formatDate(pay.date)}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                        {pay.recordedBy || "Super Admin"}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 text-[11px] truncate max-w-xs">
                        {pay.notes || "—"}
                      </td>
                    </tr>
                  ))}

                  {paymentsLedger.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                        No subscription payments recorded yet. Click &quot;Renew / Pay&quot; on any company to record a payment.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Record Monthly Payment / Renew Modal */}
      {renewModalOpen && renewCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Banknote className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Record Monthly Subscription Payment
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Renew cycle for 1 month & update ledger
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRenewModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleRecordRenewal} className="p-5 space-y-4">
              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
                <p className="text-[10px] uppercase font-bold text-indigo-600">Target Client Organization</p>
                <p className="text-sm font-bold text-indigo-950 mt-0.5">{renewCompany.name}</p>
                <div className="mt-1 flex items-center justify-between text-[11px] text-indigo-800">
                  <span>Current Month End:</span>
                  <span className="font-semibold">{formatDate(renewCompany.billingCycleEnd)}</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Payment Amount (PKR) *
                </label>
                <input
                  type="number"
                  required
                  value={renewFormData.amount}
                  onChange={(e) => setRenewFormData({ ...renewFormData, amount: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Payment Method *
                  </label>
                  <select
                    value={renewFormData.paymentMethod}
                    onChange={(e) => setRenewFormData({ ...renewFormData, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="BANK">Bank Transfer</option>
                    <option value="CASH">Cash</option>
                    <option value="EASYPAISA">EasyPaisa</option>
                    <option value="JAZZCASH">JazzCash</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Billing Period *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. October 2026"
                    value={renewFormData.period}
                    onChange={(e) => setRenewFormData({ ...renewFormData, period: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Receipt / Transaction Ref #
                </label>
                <input
                  type="text"
                  placeholder="e.g. TXN-129482 or Cash Voucher #"
                  value={renewFormData.reference}
                  onChange={(e) => setRenewFormData({ ...renewFormData, reference: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-mono focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={renewFormData.notes}
                  onChange={(e) => setRenewFormData({ ...renewFormData, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRenewModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={renewSubmitting}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700 transition shadow-sm flex items-center gap-1.5"
                >
                  {renewSubmitting ? "Processing..." : "Confirm & Renew Month"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register Organization Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-xl rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <Building2 className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">
                  Register New Client / Organization
                </h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="m-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateCompany} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ABC Electronics"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Owner Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tariq Mehmood"
                    value={formData.ownerName}
                    onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* SaaS Subscription & Monthly Fee Section */}
              <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                  <CreditCard className="h-4 w-4 text-emerald-600" />
                  <span>SaaS Subscription & Monthly Billing Settings</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Monthly Fee (PKR) *
                    </label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 5000"
                      value={formData.monthlyFee}
                      onChange={(e) => setFormData({ ...formData, monthlyFee: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:border-emerald-500 focus:outline-none"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Amount charged to this client on a monthly basis.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Subscription Plan
                    </label>
                    <select
                      value={formData.billingPlan}
                      onChange={(e) => setFormData({ ...formData, billingPlan: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="Standard Monthly">Standard Monthly</option>
                      <option value="Enterprise Pro">Enterprise Pro</option>
                      <option value="Retail Growth">Retail Growth</option>
                      <option value="Custom Plan">Custom Plan</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Feature Modules Entitlement / Gating */}
              <div className="p-3.5 rounded-xl border border-purple-200 bg-purple-50/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900">
                    <Shield className="h-4 w-4 text-purple-600" />
                    <span>Company Feature Access & Modules ("kis company ko kitna access dena hai")</span>
                  </div>
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                    {formData.enabledModules?.length || 0} / {AVAILABLE_MODULES.length} Selected
                  </span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Select which software modules are unlocked for this company. Disabled modules will be hidden from their sidebar.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {AVAILABLE_MODULES.map((mod) => {
                    const isChecked = formData.enabledModules?.includes(mod.id);
                    return (
                      <label
                        key={mod.id}
                        className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition ${
                          isChecked
                            ? "bg-white border-purple-300 shadow-2xs"
                            : "bg-slate-50/60 border-slate-200 opacity-60 hover:opacity-100"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleModule(mod.id)}
                          className="mt-0.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-900">{mod.label}</p>
                          <p className="text-[10px] text-slate-500 leading-tight">{mod.desc}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Multi-Branch Management Authorization */}
              <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/40 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-950">
                    <Building2 className="h-4 w-4 text-indigo-600" />
                    <span>Multi-Branch Authorization (ملٹی برانچ مینجمنٹ کی اجازت)</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.canCreateBranches)}
                      onChange={(e) => setFormData({ ...formData, canCreateBranches: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Enable this if this company has multiple branches. When enabled, the company owner can create sub-branches, assign staff, and access branch-wise and consolidated accounting views.
                </p>
              </div>

              {/* Critical Default HS Code & UOM */}
              <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/50 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                  <Layers className="h-4 w-4 text-indigo-600" />
                  <span>Client Default Classification & Tariff</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Default HS Code *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 8517.13"
                      value={formData.defaultHsCode}
                      onChange={(e) => setFormData({ ...formData, defaultHsCode: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-mono focus:border-indigo-500 focus:outline-none"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      New products & imports for this client will inherit this tariff code by default.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Default UOM
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. pcs"
                      value={formData.defaultUom}
                      onChange={(e) => setFormData({ ...formData, defaultUom: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Phone / Mobile *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. +92 300 1234567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. owner@company.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    National Tax Number (NTN)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1234567-8"
                    value={formData.ntn}
                    onChange={(e) => setFormData({ ...formData, ntn: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-mono focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Sales Tax Reg. (STRN)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 17-00-1234-567-89"
                    value={formData.strn}
                    onChange={(e) => setFormData({ ...formData, strn: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-mono focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Business Street Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. Shop 12, Saddar Mobile Market"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* FBR Compliance & Integration Profile */}
              <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-950">
                    <Shield className="h-4 w-4 text-indigo-600" />
                    <span>FBR Compliance & Fiscalization Configuration</span>
                  </div>
                  <span className="rounded bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 font-mono">
                    {formData.fbrIntegrationType === "TIER1_POS" ? "ims.fbr.gov.pk" : "gw.fbr.gov.pk"}
                  </span>
                </div>

                {/* Integration Mode / Engine */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    FBR Integration Engine / Mode *
                  </label>
                  <select
                    value={formData.fbrIntegrationType || "DIGITAL_INVOICING"}
                    onChange={(e) => setFormData({ ...formData, fbrIntegrationType: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-indigo-950 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="DIGITAL_INVOICING">🏷️ Digital Invoicing (DI) — Wholesale / B2B (gw.fbr.gov.pk)</option>
                    <option value="TIER1_POS">🛒 Tier-1 Retail POS (IMS) — Counter / B2C (ims.fbr.gov.pk)</option>
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {formData.fbrIntegrationType === "TIER1_POS"
                      ? "Transmits retail sales to FBR IMS POS gateway with Rs. 1 POS fee & 18-digit QR code verification."
                      : "Transmits sales tax electronic invoices to FBR Digital Invoicing gateway with official tax schedules."}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Gateway Environment
                    </label>
                    <select
                      value={formData.fbrEnv}
                      onChange={(e) => setFormData({ ...formData, fbrEnv: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="sandbox">🧪 Sandbox Test</option>
                      <option value="production">🏢 Live Production</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      {formData.fbrIntegrationType === "TIER1_POS" ? "POS Registration Number (POS ID) *" : "Scenario ID"}
                    </label>
                    <input
                      type="text"
                      placeholder={formData.fbrIntegrationType === "TIER1_POS" ? "e.g. 822646" : "SN000"}
                      value={formData.fbrIntegrationType === "TIER1_POS" ? formData.fbrPosId : formData.fbrScenarioId}
                      onChange={(e) =>
                        formData.fbrIntegrationType === "TIER1_POS"
                          ? setFormData({ ...formData, fbrPosId: e.target.value })
                          : setFormData({ ...formData, fbrScenarioId: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    FBR Bearer Security Token
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Paste FBR Bearer Token / Auth Key here..."
                      value={formData.fbrToken}
                      onChange={(e) => setFormData({ ...formData, fbrToken: e.target.value })}
                      className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:border-indigo-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        testFbrConnection(
                          formData.fbrToken,
                          formData.fbrEnv,
                          formData.fbrIntegrationType,
                          formData.fbrPosId
                        )
                      }
                      disabled={testingFbr}
                      className="px-3 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold hover:bg-indigo-100 shrink-0"
                    >
                      {testingFbr ? "Testing..." : "Test FBR Gateway"}
                    </button>
                  </div>
                  {fbrTestMessage && (
                    <p
                      className={`text-[11px] font-medium mt-1.5 p-2 rounded-lg border ${
                        fbrTestMessage.success
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : "bg-amber-50 text-amber-900 border-amber-200"
                      }`}
                    >
                      {fbrTestMessage.text}
                    </p>
                  )}
                  <p className="text-[10px] text-slate-500 mt-1">
                    Endpoint:{" "}
                    <code>
                      {formData.fbrIntegrationType === "TIER1_POS"
                        ? formData.fbrEnv === "production"
                          ? "https://ims.fbr.gov.pk/api/Live/PostData"
                          : "https://gw.fbr.gov.pk/imsp/v1/api/Live/PostData"
                        : formData.fbrEnv === "production"
                        ? "https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata"
                        : "https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata_sb"}
                    </code>
                  </p>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      Auto-Sync Invoices to FBR on Post
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Instantly hit FBR when a sale invoice is posted with full payment
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.fbrAutoSync)}
                      onChange={(e) => setFormData({ ...formData, fbrAutoSync: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-700 transition shadow-sm flex items-center gap-1.5"
                >
                  {submitting ? "Registering..." : "Create Organization"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Organization Modal */}
      {editModalOpen && selectedCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-xl rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <Edit2 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Edit Organization Profile & SaaS Billing
                  </h3>
                  <p className="text-[11px] text-slate-500">{selectedCompany.name}</p>
                </div>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="m-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateCompany} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Owner Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.ownerName}
                    onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* SaaS Subscription & Monthly Fee Section */}
              <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                  <CreditCard className="h-4 w-4 text-emerald-600" />
                  <span>SaaS Subscription & Monthly Billing</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Monthly Fee (PKR)
                    </label>
                    <input
                      type="number"
                      required
                      value={formData.monthlyFee}
                      onChange={(e) => setFormData({ ...formData, monthlyFee: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Subscription Plan
                    </label>
                    <select
                      value={formData.billingPlan}
                      onChange={(e) => setFormData({ ...formData, billingPlan: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="Standard Monthly">Standard Monthly</option>
                      <option value="Enterprise Pro">Enterprise Pro</option>
                      <option value="Retail Growth">Retail Growth</option>
                      <option value="Custom Plan">Custom Plan</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Next Renewal Due
                    </label>
                    <input
                      type="date"
                      value={formData.billingCycleEnd}
                      onChange={(e) => setFormData({ ...formData, billingCycleEnd: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Feature Modules Entitlement / Gating */}
              <div className="p-3.5 rounded-xl border border-purple-200 bg-purple-50/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900">
                    <Shield className="h-4 w-4 text-purple-600" />
                    <span>Company Feature Access & Modules ("kis company ko kitna access dena hai")</span>
                  </div>
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                    {formData.enabledModules?.length || 0} / {AVAILABLE_MODULES.length} Selected
                  </span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Select which software modules are unlocked for this company. Disabled modules will be hidden from their sidebar.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {AVAILABLE_MODULES.map((mod) => {
                    const isChecked = formData.enabledModules?.includes(mod.id);
                    return (
                      <label
                        key={mod.id}
                        className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition ${
                          isChecked
                            ? "bg-white border-purple-300 shadow-2xs"
                            : "bg-slate-50/60 border-slate-200 opacity-60 hover:opacity-100"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleModule(mod.id)}
                          className="mt-0.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-900">{mod.label}</p>
                          <p className="text-[10px] text-slate-500 leading-tight">{mod.desc}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Multi-Branch Management Authorization */}
              <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/40 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-950">
                    <Building2 className="h-4 w-4 text-indigo-600" />
                    <span>Multi-Branch Authorization (ملٹی برانچ مینجمنٹ کی اجازت)</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.canCreateBranches)}
                      onChange={(e) => setFormData({ ...formData, canCreateBranches: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Enable this if this company has multiple branches. When enabled, the company owner can create sub-branches, assign staff, and access branch-wise and consolidated accounting views.
                </p>
              </div>

              {/* Classification */}
              <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/50 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                  <Layers className="h-4 w-4 text-indigo-600" />
                  <span>Client Default Classification & Tariff</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Default HS Code *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.defaultHsCode}
                      onChange={(e) => setFormData({ ...formData, defaultHsCode: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-mono focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Default UOM
                    </label>
                    <input
                      type="text"
                      value={formData.defaultUom}
                      onChange={(e) => setFormData({ ...formData, defaultUom: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Phone / Mobile
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* FBR Digital Invoicing (DI) API Profile */}
              <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-950">
                    <Shield className="h-4 w-4 text-indigo-600" />
                    <span>FBR Digital Invoicing (DI) API Configuration</span>
                  </div>
                  <span className="rounded bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 font-mono">
                    gw.fbr.gov.pk
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Gateway Environment
                    </label>
                    <select
                      value={formData.fbrEnv}
                      onChange={(e) => setFormData({ ...formData, fbrEnv: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="sandbox">🧪 Sandbox Test (_sb)</option>
                      <option value="production">🏢 Live Production</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Scenario ID
                    </label>
                    <input
                      type="text"
                      placeholder="SN000"
                      value={formData.fbrScenarioId}
                      onChange={(e) => setFormData({ ...formData, fbrScenarioId: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    FBR Bearer Security Token
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Paste FBR Bearer Token here..."
                      value={formData.fbrToken}
                      onChange={(e) => setFormData({ ...formData, fbrToken: e.target.value })}
                      className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:border-indigo-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => testFbrConnection(formData.fbrToken, formData.fbrEnv)}
                      disabled={testingFbr}
                      className="px-3 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold hover:bg-indigo-100 shrink-0"
                    >
                      {testingFbr ? "Testing..." : "Test FBR Gateway"}
                    </button>
                  </div>
                  {fbrTestMessage && (
                    <p
                      className={`text-[11px] font-medium mt-1.5 p-2 rounded-lg border ${
                        fbrTestMessage.success
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : "bg-amber-50 text-amber-900 border-amber-200"
                      }`}
                    >
                      {fbrTestMessage.text}
                    </p>
                  )}
                  <p className="text-[10px] text-slate-500 mt-1">
                    Endpoint: <code>https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata_sb</code>
                  </p>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      Auto-Sync Invoices to FBR on Post
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Instantly hit FBR when a sale invoice is posted with full payment
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.fbrAutoSync)}
                      onChange={(e) => setFormData({ ...formData, fbrAutoSync: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-700 transition shadow-sm flex items-center gap-1.5"
                >
                  {submitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
