"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDateRange } from "@/context/DateRangeContext";
import {
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  Receipt,
  ArrowRight,
  Plus,
  RefreshCw,
  ShoppingBag,
  Wallet,
  Users,
  Truck,
  Package,
  LayoutGrid,
  List,
  ExternalLink,
  ChevronRight,
  Activity,
  Store,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { smartFetch, invalidateCache } from "@/lib/clientCache";
import {
  BrandPageLoader,
  CardSkeleton,
  ChartSkeleton,
  TableSkeleton,
  LoadingSpinner,
} from "@/components/ui/loader";

type DashboardTab = "all" | "accounting" | "fbr";
type TableLayoutMode = "table" | "cards";

export default function DashboardPage() {
  const router = useRouter();
  const { user, activeCompany, isInspectingClient, isLoading, switchBranch, isBranchLocked } = useAuth();
  const { range } = useDateRange();
  const { resolvedTheme } = useTheme();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DashboardTab>("all");
  const [tableLayout, setTableLayout] = useState<TableLayoutMode>("table");
  const [retryingId, setRetryingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && user?.role === "SUPER_ADMIN" && !isInspectingClient) {
      router.replace("/admin");
    }
  }, [user, isInspectingClient, isLoading, router]);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const start = range.startDate.toISOString();
      const end = range.endDate.toISOString();
      const headers: Record<string, string> = {};
      if (activeCompany?.id) headers["x-business-id"] = activeCompany.id;

      const json = await smartFetch(`/api/dashboard?start=${start}&end=${end}`, { headers, ttlMs: 15000 });
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      console.error("Failed to load dashboard metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [range.startDate, range.endDate, activeCompany?.id]);

  const handleRetryFbr = async (invoiceId: string) => {
    setRetryingId(invoiceId);
    try {
      const res = await fetch("/api/compliance/fbr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry", invoiceId }),
      });
      const resData = await res.json();
      if (resData.success) {
        invalidateCache("/api/dashboard");
        await fetchMetrics();
      }
    } catch (err) {
      console.error("Retry failed:", err);
    } finally {
      setRetryingId(null);
    }
  };

  const showAccounting = activeTab === "all" || activeTab === "accounting";
  const showFbr = activeTab === "all" || activeTab === "fbr";

  // Super Admin Platform Mode: Do NOT display customer books by default
  if (!isLoading && user?.role === "SUPER_ADMIN" && !isInspectingClient) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-4 sm:p-6 space-y-4">
        <div className="h-14 w-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold border border-indigo-200 dark:border-indigo-800 shadow-xs animate-pulse">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white font-sans">
            Super Admin SaaS Platform Control Center
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mt-1 leading-relaxed">
            As Platform Super Admin, your central dashboard is the multi-tenant SaaS management center. Redirecting now...
          </p>
        </div>
        <Link
          href="/admin"
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition shadow-xs inline-flex items-center gap-2"
        >
          <span>Open Platform Admin Portal</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  // Dedicated Cashier / Staff View (Fully Responsive)
  if (user?.role === "STAFF") {
    return (
      <div className="space-y-4 sm:space-y-6 pb-12">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-xs dark:border-slate-800/90 dark:bg-[#111827] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 text-xs font-bold mb-2 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800">
              <span>💼 POS & Cashier Terminal</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-sans">
              Welcome, {user.name} 👋
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Active Client: <strong className="text-slate-800 dark:text-slate-200">{activeCompany?.name}</strong> • Retail POS & Invoicing
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Link
              href="/compliance/fbr"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition shadow-indigo-600/20"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Create FBR POS Invoice</span>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800/90 dark:bg-[#111827]">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold block">Today&apos;s Gross Sales</span>
            <p className="text-xl font-bold text-slate-900 dark:text-white font-mono mt-1">
              Rs {data ? Number(data.totalGrossSales || data.netSales || 0).toLocaleString() : "..."}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800/90 dark:bg-[#111827]">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold block">Invoices Generated</span>
            <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400 font-mono mt-1">
              {data?.recentInvoices?.length || 0} Bills
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800/90 dark:bg-[#111827]">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold block">FBR Sync Status</span>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-1 flex items-center gap-1.5">
              <CheckCircle2 className="h-5 w-5" />
              <span>Online & Synced</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="space-y-6 pb-12 animate-in fade-in duration-200">
        {/* Skeleton Top Bar */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-card dark:border-slate-800/80 dark:bg-[#111827] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <div className="h-6 w-56 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
            <div className="h-3.5 w-72 bg-slate-100 dark:bg-slate-800/60 rounded-md animate-pulse" />
          </div>
          <div className="h-9 w-32 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
        </div>

        {/* Central Brand Loading Animation */}
        <BrandPageLoader
          message="Loading Real-Time Financial Ledger..."
          submessage="Synchronizing double-entry transactions, receivables, stock valuations, and FBR POS tax queue..."
          minHeight="min-h-[220px]"
        />

        {/* Financial KPI Cards Skeleton */}
        <CardSkeleton count={6} />

        {/* Chart Skeleton */}
        <ChartSkeleton />

        {/* Ledger Table Skeleton */}
        <TableSkeleton rows={5} />
      </div>
    );
  }

  const cashAmount = Number(data?.cashBalance || 0);
  const bankAmount = Number(data?.bankBalance || 0);
  const totalLiquidity = cashAmount + bankAmount;

  return (
    <div className="space-y-5 sm:space-y-6 pb-12 transition-colors duration-150">
      {/* Background Fetching Notification Banner */}
      {loading && data && (
        <div className="sticky top-16 z-30 mb-4 rounded-xl border border-indigo-200/90 bg-indigo-50/95 px-3.5 py-2.5 backdrop-blur-md dark:border-indigo-900/60 dark:bg-indigo-950/90 text-xs font-semibold text-indigo-700 dark:text-indigo-300 flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center gap-2.5">
            <LoadingSpinner size="sm" />
            <span>Updating real-time financial metrics for the selected period...</span>
          </div>
          <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-mono font-medium">Syncing</span>
        </div>
      )}

      {/* Top Header & Fast Action Area */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50/80 border border-indigo-200/80 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700 dark:bg-indigo-950/60 dark:border-indigo-800 dark:text-indigo-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {activeCompany?.name || "SmartBiz ERP Workspace"}
            </span>
            {activeCompany?.defaultHsCode && (
              <>
                <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
                <span className="text-[10px] sm:text-[11px] font-mono text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 hidden sm:inline">
                  HS: {activeCompany.defaultHsCode}
                </span>
              </>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white font-sans leading-tight">
            Financial Ledger & FBR Compliance Suite
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Real-time double-entry accounting, customer receivables, inventory valuation, and automated FBR digital invoicing.
          </p>
        </div>

        {/* Action Controls */}
        <div className="grid grid-cols-3 sm:flex sm:items-center gap-2 shrink-0">
          <button
            onClick={fetchMetrics}
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            title="Refresh live metrics"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 dark:text-slate-400 ${loading ? "animate-spin" : ""}`} />
            <span className="truncate">Sync</span>
          </button>
          <Link
            href="/sales/create"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-slate-800 transition dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="truncate">New Sale</span>
          </Link>
          <Link
            href="/compliance/fbr"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 shadow-indigo-600/20 transition"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span className="truncate">FBR POS</span>
          </Link>
        </div>
      </div>

      {/* Multi-Branch Scope Banner */}
      {data?.activeBranchName ? (
        <div className="rounded-xl border border-emerald-300/80 bg-emerald-50/90 px-4 py-2.5 text-xs text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              Viewing Branch: <strong className="font-bold text-emerald-900 dark:text-emerald-100">{data.activeBranchName}</strong> (صرف اس برانچ کا ڈیٹا ظاہر ہے)
            </span>
          </div>
          {!isBranchLocked && (
            <button
              onClick={() => switchBranch(null)}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-emerald-100 underline self-start sm:self-auto"
            >
              <span>Switch to All Branches (مجموعی کھاتہ دیکھیں)</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
      ) : data?.branchesCount && data.branchesCount > 1 ? (
        <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/80 px-4 py-2.5 text-xs text-indigo-950 dark:border-indigo-800/80 dark:bg-indigo-950/40 dark:text-indigo-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-sm">🌐</span>
            <span>
              <strong>All Branches View (مجموعی کھاتہ):</strong> Showing consolidated financials across all {data.branchesCount} sub-branches.
            </span>
          </div>
          {(user?.role === "SUPER_ADMIN" || user?.role === "OWNER_ADMIN") && (
            <Link
              href="/branches"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 hover:text-indigo-900 dark:text-indigo-300 dark:hover:text-indigo-100 underline self-start sm:self-auto"
            >
              <span>Manage Branches (برانچز)</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      ) : null}

      {/* View Switcher / Tabs for Focused Clarity */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200/80 dark:border-slate-800 pb-2.5">
        <div className="w-full sm:w-auto overflow-x-auto no-scrollbar scroll-smooth flex items-center gap-1 bg-slate-100/90 dark:bg-slate-900/80 p-1 rounded-xl shrink-0 border border-slate-200/60 dark:border-slate-800">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
              activeTab === "all"
                ? "bg-white text-slate-900 shadow-2xs font-bold dark:bg-slate-800 dark:text-white"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <span className="sm:hidden">All Modules</span>
            <span className="hidden sm:inline">All Modules (Accounting + FBR)</span>
          </button>
          <button
            onClick={() => setActiveTab("accounting")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
              activeTab === "accounting"
                ? "bg-white text-indigo-700 shadow-2xs font-bold dark:bg-slate-800 dark:text-indigo-400"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <span className="sm:hidden">Accounting</span>
            <span className="hidden sm:inline">Business Accounting Ledger</span>
          </button>
          <button
            onClick={() => setActiveTab("fbr")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
              activeTab === "fbr"
                ? "bg-white text-emerald-700 shadow-2xs font-bold dark:bg-slate-800 dark:text-emerald-400"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <span className="sm:hidden">FBR Tax</span>
            <span className="hidden sm:inline">FBR Tax Compliance</span>
          </button>
        </div>

        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium hidden md:block">
          Showing active period records for <strong className="text-slate-700 dark:text-slate-300">{activeCompany?.name}</strong>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: CORE BUSINESS ACCOUNTING HEALTH                                */}
      {/* ========================================================================= */}
      {showAccounting && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-indigo-600 shrink-0" />
              <span>1. Business Financial Pulse & Liquidity</span>
            </h2>
            <Link
              href="/reports"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-1 shrink-0"
            >
              <span>Closing Reports</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
            {/* Total Gross Sales */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-xs flex flex-col justify-between dark:border-slate-800/90 dark:bg-[#111827]">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate">
                  Gross Sales
                </span>
                <div className="h-7 w-7 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Receipt className="h-3.5 w-3.5" />
                </div>
              </div>
              <p
                className="mt-2 text-sm sm:text-base lg:text-lg xl:text-xl font-bold text-slate-900 dark:text-white font-mono tabular-nums truncate"
                title={`Rs ${Number(data?.totalGrossSales || data?.netSales || 0).toLocaleString()}`}
              >
                Rs {data ? Number(data.totalGrossSales || data.netSales || 0).toLocaleString() : "..."}
              </p>
              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold mt-1 truncate block">
                Total Invoiced Revenue
              </span>
            </div>

            {/* Total Purchases */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-xs flex flex-col justify-between dark:border-slate-800/90 dark:bg-[#111827]">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate">
                  Purchases
                </span>
                <div className="h-7 w-7 rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400 flex items-center justify-center shrink-0">
                  <ShoppingBag className="h-3.5 w-3.5" />
                </div>
              </div>
              <p
                className="mt-2 text-sm sm:text-base lg:text-lg xl:text-xl font-bold text-slate-900 dark:text-white font-mono tabular-nums truncate"
                title={`Rs ${Number(data?.totalPurchases || 0).toLocaleString()}`}
              >
                Rs {data ? Number(data.totalPurchases || 0).toLocaleString() : "..."}
              </p>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-1 truncate block">
                Stock Inventory In
              </span>
            </div>

            {/* Cash & Bank Liquidity */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-xs flex flex-col justify-between dark:border-slate-800/90 dark:bg-[#111827]">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate">
                  Cash & Bank
                </span>
                <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Wallet className="h-3.5 w-3.5" />
                </div>
              </div>
              <p
                className="mt-2 text-sm sm:text-base lg:text-lg xl:text-xl font-bold text-slate-900 dark:text-white font-mono tabular-nums truncate"
                title={`Rs ${totalLiquidity.toLocaleString()}`}
              >
                Rs {data ? totalLiquidity.toLocaleString() : "..."}
              </p>
              <span
                className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-1 truncate block"
                title={`Cash: Rs ${cashAmount.toLocaleString()} • Bank: Rs ${bankAmount.toLocaleString()}`}
              >
                Cash: Rs {(cashAmount / 1000).toFixed(0)}k • Bank: Rs {(bankAmount / 1000).toFixed(0)}k
              </span>
            </div>

            {/* Customer Receivables */}
            <div className="rounded-2xl border border-amber-200/90 bg-amber-50/40 p-3.5 sm:p-4 shadow-xs flex flex-col justify-between dark:border-amber-900/60 dark:bg-amber-950/25">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] sm:text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wide truncate">
                  Receivables
                </span>
                <div className="h-7 w-7 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300 flex items-center justify-center shrink-0">
                  <Users className="h-3.5 w-3.5" />
                </div>
              </div>
              <p
                className="mt-2 text-sm sm:text-base lg:text-lg xl:text-xl font-bold text-amber-950 dark:text-amber-200 font-mono tabular-nums truncate"
                title={`Rs ${Number(data?.totalReceivables || 0).toLocaleString()}`}
              >
                Rs {data ? Number(data.totalReceivables || 0).toLocaleString() : "..."}
              </p>
              <Link href="/customers" className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold hover:underline mt-1 truncate block">
                Customers Due &rarr;
              </Link>
            </div>

            {/* Supplier Payables */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-xs flex flex-col justify-between dark:border-slate-800/90 dark:bg-[#111827]">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate">
                  Payables
                </span>
                <div className="h-7 w-7 rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <Truck className="h-3.5 w-3.5" />
                </div>
              </div>
              <p
                className="mt-2 text-sm sm:text-base lg:text-lg xl:text-xl font-bold text-slate-900 dark:text-white font-mono tabular-nums truncate"
                title={`Rs ${Number(data?.totalPayables || 0).toLocaleString()}`}
              >
                Rs {data ? Number(data.totalPayables || 0).toLocaleString() : "..."}
              </p>
              <Link href="/suppliers" className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold hover:underline mt-1 truncate block">
                Suppliers Due &rarr;
              </Link>
            </div>

            {/* Estimated Net Profit */}
            <div className="rounded-2xl border border-emerald-200/90 bg-emerald-50/40 p-3.5 sm:p-4 shadow-xs flex flex-col justify-between dark:border-emerald-900/60 dark:bg-emerald-950/25">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] sm:text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide truncate">
                  Net Profit
                </span>
                <div className="h-7 w-7 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300 flex items-center justify-center shrink-0">
                  <TrendingUp className="h-3.5 w-3.5" />
                </div>
              </div>
              <p
                className="mt-2 text-sm sm:text-base lg:text-lg xl:text-xl font-bold text-emerald-950 dark:text-emerald-200 font-mono tabular-nums truncate"
                title={`Rs ${Number(data?.netProfit || 0).toLocaleString()}`}
              >
                Rs {data ? Number(data.netProfit || 0).toLocaleString() : "..."}
              </p>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium mt-1 truncate block">
                After COGS & Expenses
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Branch Performance Comparison Matrix (Consolidated Mode) */}
      {showAccounting && data?.branchBreakdown && data.branchBreakdown.length > 0 && !data?.activeBranchId && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800/90 dark:bg-[#111827]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3.5 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-sans flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>Branch Performance Matrix (برانچ وائز تقابلی جائزہ)</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Real-time consolidated sales, purchases, operating expenses, and estimated net profit per branch
              </p>
            </div>
            {(user?.role === "SUPER_ADMIN" || user?.role === "OWNER_ADMIN") && (
              <Link
                href="/branches"
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1 shrink-0"
              >
                <span>Manage Branches</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>

          <div className="overflow-x-auto mt-3">
            <table className="w-full min-w-[720px] text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                  <th className="py-2.5 px-3">Branch Details</th>
                  <th className="py-2.5 px-3">Manager / City</th>
                  <th className="py-2.5 px-3">Gross Sales</th>
                  <th className="py-2.5 px-3">Purchases</th>
                  <th className="py-2.5 px-3">Expenses</th>
                  <th className="py-2.5 px-3">Net Profit</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {data.branchBreakdown.map((b: any) => (
                  <tr key={b.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0">
                          🏬
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white block">{b.name}</span>
                          <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">
                            {b.code}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">{b.managerName || "Staff"}</div>
                      <div className="text-[10px] text-slate-400">{b.city || "Pakistan"}</div>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                      <div>Rs {Number(b.totalSales || 0).toLocaleString()}</div>
                      <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-sans font-medium">
                        {b.salesSharePercent}% of total
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-700 dark:text-slate-300">
                      Rs {Number(b.totalPurchases || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 font-mono text-rose-600 dark:text-rose-400">
                      Rs {Number(b.totalExpenses || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md text-xs ${
                          b.netProfit >= 0
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                        }`}
                      >
                        Rs {Number(b.netProfit || 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => switchBranch(b.id)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:border-emerald-500 transition shadow-2xs"
                      >
                        Inspect Branch &rarr;
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: FBR DIGITAL TAX COMPLIANCE ENGINE                              */}
      {/* ========================================================================= */}
      {showFbr && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
              <span>2. FBR Digital POS & Statutory Tax Center</span>
            </h2>
            <Link
              href="/compliance/fbr"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-1 shrink-0"
            >
              <span>FBR Invoicing Hub</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
            {/* Net Taxable Sales */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-xs flex flex-col justify-between dark:border-slate-800/90 dark:bg-[#111827]">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block truncate">
                Net Taxable Sales
              </span>
              <p
                className="mt-2 text-sm sm:text-base lg:text-lg xl:text-xl font-bold text-slate-900 dark:text-white font-mono tabular-nums truncate"
                title={`Rs ${Number(data?.netSales || 0).toLocaleString()}`}
              >
                Rs {data ? Number(data.netSales || 0).toLocaleString() : "..."}
              </p>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 truncate block">
                Excl. Sales Tax
              </span>
            </div>

            {/* Total Tax Collected */}
            <div className="rounded-2xl border border-indigo-200/80 bg-indigo-50/40 p-3.5 sm:p-4 shadow-xs flex flex-col justify-between dark:border-indigo-900/60 dark:bg-indigo-950/25">
              <span className="text-[10px] sm:text-[11px] font-bold text-indigo-900 dark:text-indigo-200 uppercase tracking-wide block truncate">
                Total Tax Collected
              </span>
              <p
                className="mt-2 text-sm sm:text-base lg:text-lg xl:text-xl font-bold text-indigo-700 dark:text-indigo-300 font-mono tabular-nums truncate"
                title={`Rs ${Number(data?.taxCollected || 0).toLocaleString()}`}
              >
                Rs {data ? Number(data.taxCollected || 0).toLocaleString() : "..."}
              </p>
              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold mt-1 truncate block">
                18% ST + 3% Further
              </span>
            </div>

            {/* 18% Sales Tax */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-xs flex flex-col justify-between dark:border-slate-800/90 dark:bg-[#111827]">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block truncate">
                18% Sales Tax
              </span>
              <p
                className="mt-2 text-sm sm:text-base lg:text-lg xl:text-xl font-bold text-slate-900 dark:text-white font-mono tabular-nums truncate"
                title={`Rs ${Number(data?.salesTax || 0).toLocaleString()}`}
              >
                Rs {data ? Number(data.salesTax || 0).toLocaleString() : "..."}
              </p>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 truncate block">
                Standard Schedule
              </span>
            </div>

            {/* 3% Further Tax */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-xs flex flex-col justify-between dark:border-slate-800/90 dark:bg-[#111827]">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block truncate">
                3% Further Tax
              </span>
              <p
                className="mt-2 text-sm sm:text-base lg:text-lg xl:text-xl font-bold text-amber-600 dark:text-amber-400 font-mono tabular-nums truncate"
                title={`Rs ${Number(data?.furtherTax || 0).toLocaleString()}`}
              >
                Rs {data ? Number(data.furtherTax || 0).toLocaleString() : "..."}
              </p>
              <span className="text-[10px] text-amber-600/90 dark:text-amber-400/90 mt-1 truncate block">
                Unregistered Buyers
              </span>
            </div>

            {/* FBR Validated Invoices */}
            <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-3.5 sm:p-4 shadow-xs flex flex-col justify-between dark:border-emerald-900/60 dark:bg-emerald-950/25">
              <span className="text-[10px] sm:text-[11px] font-bold text-emerald-800 dark:text-emerald-200 uppercase tracking-wide block truncate">
                FBR Validated
              </span>
              <p className="mt-2 text-sm sm:text-base lg:text-lg xl:text-xl font-bold text-emerald-700 dark:text-emerald-300 font-mono tabular-nums truncate">
                {data?.successfulFbr ?? 0} Invoices
              </p>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 truncate flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 shrink-0" /> QR Generated
              </span>
            </div>

            {/* FBR Compliance Score */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-xs flex flex-col justify-between dark:border-slate-800/90 dark:bg-[#111827]">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block truncate">
                Compliance Health
              </span>
              <p className="mt-2 text-sm sm:text-base lg:text-lg xl:text-xl font-bold text-indigo-600 dark:text-indigo-400 font-mono tabular-nums truncate">
                {data?.complianceScore ?? 100}%
              </p>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-1 truncate block">
                {data?.failedFbr ? `${data.failedFbr} Failed (Action Req.)` : "All Sync Healthy"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Visual Analytics & FBR Live Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left 2 Cols: Revenue & Tax Trajectory Chart */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-xs dark:border-slate-800/90 dark:bg-[#111827]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 mb-4 sm:mb-6">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight font-sans">
                Monthly Revenue & FBR POS Performance
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gross Sales, Tax Collected, and Verified FBR Invoicing
              </p>
            </div>
            <div className="flex items-center gap-3 sm:gap-4 text-xs font-semibold flex-wrap">
              <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <span className="h-2.5 w-2.5 rounded-sm bg-indigo-600 shrink-0" /> Net Sales
              </span>
              <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500 shrink-0" /> FBR Compliant
              </span>
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data?.monthlyTrends || []}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={resolvedTheme === "dark" ? "#1e293b" : "#f1f5f9"}
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  stroke={resolvedTheme === "dark" ? "#64748b" : "#94a3b8"}
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: resolvedTheme === "dark" ? "#1e293b" : "#e2e8f0" }}
                />
                <YAxis
                  stroke={resolvedTheme === "dark" ? "#64748b" : "#94a3b8"}
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `Rs ${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: resolvedTheme === "dark" ? "#111827" : "#ffffff",
                    borderColor: resolvedTheme === "dark" ? "#1e293b" : "#e2e8f0",
                    borderRadius: "14px",
                    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.15)",
                    fontSize: "12px",
                    color: resolvedTheme === "dark" ? "#f8fafc" : "#0f172a",
                  }}
                  formatter={(val: any) => [`Rs ${Number(val).toLocaleString()}`, ""]}
                />
                <Bar dataKey="sales" name="Net Sales" fill="#4f46e5" radius={[4, 4, 0, 0]} maxBarSize={22} />
                <Bar dataKey="fbrCompliant" name="FBR Compliant" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right 1 Col: FBR Status & Action Center */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-xs dark:border-slate-800/90 dark:bg-[#111827] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white font-sans">FBR POS Live Status</h3>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                ACTIVE
              </span>
            </div>

            <div className="mt-4 space-y-3.5">
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 space-y-1.5 dark:border-slate-800 dark:bg-slate-900/60">
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                  <span>POS Terminal ID:</span>
                  <strong className="text-slate-900 dark:text-slate-100 font-mono">POS-KHI-001</strong>
                </div>
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                  <span>Organization NTN:</span>
                  <strong className="text-slate-900 dark:text-slate-100 font-mono">{activeCompany?.ntn || "1234567-8"}</strong>
                </div>
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                  <span>Tax Profile:</span>
                  <strong className="text-slate-900 dark:text-slate-100 font-mono">Standard 18%</strong>
                </div>
              </div>

              {/* Compliance Issues / Retries */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Transmission Queue ({data?.complianceIssues?.length || 0})
                </h4>
                {data?.complianceIssues && data.complianceIssues.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {data.complianceIssues.map((issue: any) => (
                      <div
                        key={issue.invoiceId}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs gap-2 dark:border-slate-800 dark:bg-slate-900/60"
                      >
                        <div className="min-w-0 pr-1">
                          <p className="font-bold text-slate-900 dark:text-slate-100 truncate">
                            {issue.invoiceNumber} • {issue.customerName}
                          </p>
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium block truncate">
                            {issue.reason || "Pending transmission batch"}
                          </span>
                        </div>
                        <button
                          onClick={() => handleRetryFbr(issue.invoiceId)}
                          disabled={retryingId === issue.invoiceId}
                          className="shrink-0 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition"
                        >
                          {retryingId === issue.invoiceId ? "Retrying..." : "Retry"}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center dark:border-slate-800">
                    <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1" />
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">All Invoices Synchronized</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">Zero transmission backlogs detected</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="pt-3.5 border-t border-slate-100 dark:border-slate-800 mt-4 flex gap-2">
            <Link
              href="/compliance/fbr"
              className="flex-1 rounded-xl bg-indigo-50 border border-indigo-200 py-2.5 text-center text-xs font-bold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-900/50 transition"
            >
              FBR Audit Center &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Unified Recent Sales & Compliance Ledger Table */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden dark:border-slate-800/90 dark:bg-[#111827]">
        <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight font-sans">
              Recent Invoices & FBR Compliance Ledger
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Live double-entry sales transactions with real-time FBR digital verification receipts
            </p>
          </div>
          <div className="flex items-center gap-2 justify-between sm:justify-end">
            {/* Mobile View Toggle: Table vs Cards */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg md:hidden">
              <button
                onClick={() => setTableLayout("table")}
                className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 ${
                  tableLayout === "table"
                    ? "bg-white text-slate-900 shadow-2xs dark:bg-slate-900 dark:text-white"
                    : "text-slate-500 dark:text-slate-400"
                }`}
                title="Table View"
              >
                <List className="h-3.5 w-3.5" />
                <span className="text-[10px]">Table</span>
              </button>
              <button
                onClick={() => setTableLayout("cards")}
                className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 ${
                  tableLayout === "cards"
                    ? "bg-white text-slate-900 shadow-2xs dark:bg-slate-900 dark:text-white"
                    : "text-slate-500 dark:text-slate-400"
                }`}
                title="Cards View"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="text-[10px]">Cards</span>
              </button>
            </div>

            <Link
              href="/sales"
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 hover:underline"
            >
              <span>Full Sales Ledger</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Mobile Swipe Hint when in Table view */}
        <div className="md:hidden bg-slate-50/90 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800 px-4 py-1.5 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
          <span>👉 Swipe table sideways to inspect all columns</span>
          <span className="font-semibold text-slate-700 dark:text-slate-300">{data?.recentInvoices?.length || 0} bills</span>
        </div>

        {/* Mobile Cards View (Optional on small screens) */}
        {tableLayout === "cards" ? (
          <div className="p-3.5 space-y-3 md:hidden">
            {data?.recentInvoices && data.recentInvoices.length > 0 ? (
              data.recentInvoices.map((inv: any) => {
                const isSuccess = inv.fbrStatus === "SUCCESS";
                const isFailed = inv.fbrStatus === "FAILED";

                return (
                  <div
                    key={inv.id}
                    className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2.5 dark:border-slate-800 dark:bg-[#111827]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono font-bold text-xs text-slate-900 dark:text-white block">
                          {inv.invoiceNumber}
                        </span>
                        <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold mt-0.5 block">
                          {inv.customerName || "Walk-in Retail Customer"}
                        </span>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          isSuccess
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                            : isFailed
                            ? "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800"
                            : "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                        }`}
                      >
                        {isSuccess && <CheckCircle2 className="h-2.5 w-2.5" />}
                        {inv.fbrStatus || "PENDING"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 block">Total Amount:</span>
                        <strong className="text-slate-900 dark:text-white font-mono text-sm">
                          Rs {Number(inv.totalAmount || 0).toLocaleString()}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 block">Tax (18% / 3%):</span>
                        <strong className="text-indigo-600 dark:text-indigo-400 font-mono">
                          Rs {Number((inv.salesTax || 0) + (inv.furtherTax || 0)).toLocaleString()}
                        </strong>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                          {inv.paymentMethod || "CASH"}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                          {new Date(inv.date).toLocaleDateString("en-PK", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </span>
                      </div>

                      <div>
                        {inv.fbrQrCode ? (
                          <a
                            href={inv.fbrQrCode}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-indigo-600 hover:bg-slate-50 shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-indigo-300"
                          >
                            <span>FBR QR</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <button
                            onClick={() => handleRetryFbr(inv.id)}
                            className="rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-indigo-700"
                          >
                            Push FBR
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs">
                No transactions found for the selected period
              </div>
            )}
          </div>
        ) : (
          /* High-Density Responsive Table View */
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                  <th className="py-3 px-4 whitespace-nowrap">Invoice #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4 whitespace-nowrap">Date</th>
                  <th className="py-3 px-4 whitespace-nowrap">Subtotal</th>
                  <th className="py-3 px-4 whitespace-nowrap">Tax (18% / 3%)</th>
                  <th className="py-3 px-4 whitespace-nowrap">Total Amount</th>
                  <th className="py-3 px-4 whitespace-nowrap">Payment</th>
                  <th className="py-3 px-4 whitespace-nowrap">FBR Status</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Receipt / Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {data?.recentInvoices && data.recentInvoices.length > 0 ? (
                  data.recentInvoices.map((inv: any) => {
                    const isSuccess = inv.fbrStatus === "SUCCESS";
                    const isFailed = inv.fbrStatus === "FAILED";

                    return (
                      <tr
                        key={inv.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          {inv.invoiceNumber}
                        </td>
                        <td className="py-3 px-4 text-slate-800 dark:text-slate-200 max-w-[180px] truncate font-semibold">
                          {inv.customerName || "Walk-in Retail Customer"}
                        </td>
                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-mono whitespace-nowrap">
                          {new Date(inv.date).toLocaleDateString("en-PK", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
                          Rs {Number(inv.subtotal || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-mono text-indigo-600 dark:text-indigo-400 tabular-nums whitespace-nowrap font-semibold">
                          Rs {Number((inv.salesTax || 0) + (inv.furtherTax || 0)).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                          Rs {Number(inv.totalAmount || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300 uppercase">
                            {inv.paymentMethod || "CASH"}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              isSuccess
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                                : isFailed
                                ? "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800"
                                : "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                            }`}
                          >
                            {isSuccess && <CheckCircle2 className="h-3 w-3" />}
                            {inv.fbrStatus || "PENDING"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {inv.fbrQrCode ? (
                            <a
                              href={inv.fbrQrCode}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-indigo-600 hover:bg-slate-50 shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-indigo-300 dark:hover:bg-slate-700 transition"
                            >
                              <span>FBR QR</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <button
                              onClick={() => handleRetryFbr(inv.id)}
                              className="rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-indigo-700 transition"
                            >
                              Push FBR
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400 text-xs dark:text-slate-500">
                      No transactions found for the selected period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
