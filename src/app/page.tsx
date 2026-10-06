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
  Sparkles,
  ArrowDownLeft,
  ArrowUpRight,
  Eye,
  Bell,
  AlertTriangle,
  Clock,
  Calendar,
  Phone,
  UploadCloud,
  BarChart3,
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
import { useLanguage } from "@/context/LanguageContext";
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
  const { t, language } = useLanguage();
  const isFbrInvoicingOnly = activeCompany?.packageType === "FBR_INVOICING_ONLY";
  const isAccountingOnly =
    !isFbrInvoicingOnly &&
    (activeCompany?.packageType === "ACCOUNTING_ONLY" ||
      (activeCompany?.enabledModules && !activeCompany.enabledModules.includes("compliance")));
  const { range } = useDateRange();
  const { resolvedTheme } = useTheme();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DashboardTab>("all");
  const [tableLayout, setTableLayout] = useState<TableLayoutMode>("table");
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [isAsaanMode, setIsAsaanMode] = useState<boolean>(true);
  const [reminderFilter, setReminderFilter] = useState<"ALL" | "RECEIVABLE" | "PAYABLE">("ALL");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("smartbiz_asaan_mode");
      if (saved !== null) {
        setIsAsaanMode(saved === "true");
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const toggleAsaanMode = () => {
    setIsAsaanMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("smartbiz_asaan_mode", String(next));
      } catch (e) {}
      return next;
    });
  };

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
      return;
    }
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

  const showAccounting = !isFbrInvoicingOnly && (activeTab === "all" || activeTab === "accounting");
  const showFbr = !isAccountingOnly && (activeTab === "all" || activeTab === "fbr" || isFbrInvoicingOnly);

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
              <span>{isFbrInvoicingOnly ? t("FBR Digital Invoicing & POS", "خالص FBR انوائسنگ و بلنگ") : isAccountingOnly ? t("Business Accounting", "کھاتہ و بک کیپنگ") : t("POS & Cashier Terminal", "پی او ایس و کیشیئر کاؤنٹر")}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-sans">
              {t("Welcome", "خوش آمدید")}, {user.name} 👋
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t("Active Client", "فعال ادارہ")}: <strong className="text-slate-800 dark:text-slate-200">{activeCompany?.name}</strong> • {isFbrInvoicingOnly ? t("FBR Digital Invoicing & POS", "FBR ڈیجیٹل بلنگ") : isAccountingOnly ? t("Business Accounting & Ledger", "بزنس اکاؤنٹنگ و لیجر") : t("Retail POS & Invoicing", "ریٹیل پی او ایس و انوائسنگ")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <Link
              href="/sales/create"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition shadow-emerald-600/20"
            >
              <Receipt className="h-4 w-4" />
              <span>{t("New Sale", "نیا بل بنائیں")}</span>
            </Link>
            {isFbrInvoicingOnly ? (
              <Link
                href="/sales/import"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition shadow-indigo-600/20"
              >
                <UploadCloud className="h-4 w-4" />
                <span>{t("Excel Bulk Upload", "ایکسل بلک اپلوڈ")}</span>
              </Link>
            ) : !isAccountingOnly ? (
              <Link
                href="/compliance/fbr"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition shadow-indigo-600/20"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>{t("FBR POS Invoice", "FBR ٹیکس انوائس")}</span>
              </Link>
            ) : (
              <Link
                href="/purchases/create"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition shadow-indigo-600/20"
              >
                <Package className="h-4 w-4" />
                <span>{t("New Purchase", "نیا خریداری بل")}</span>
              </Link>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800/90 dark:bg-[#111827]">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold block">{t("Today's Gross Sales", "آج کی کل فروخت")}</span>
            <p className="text-xl font-bold text-slate-900 dark:text-white font-mono mt-1">
              Rs {data ? Number(data.totalGrossSales || data.netSales || 0).toLocaleString() : "..."}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800/90 dark:bg-[#111827]">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold block">{t("Bills Generated", "کل جاری کردہ بل")}</span>
            <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400 font-mono mt-1">
              {data?.recentInvoices?.length || 0} {t("Bills", "بل")}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800/90 dark:bg-[#111827]">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold block">{isAccountingOnly ? t("Accounting Status", "کھاتے کی صورتحال") : t("FBR Sync Status", "FBR ٹیکس کنکشن")}</span>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-1 flex items-center gap-1.5">
              <CheckCircle2 className="h-5 w-5" />
              <span>{isAccountingOnly ? t("Active & Balanced", "فعال و متوازن") : t("Active & Synchronized", "فعال و ہم آہنگ")}</span>
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
          submessage={
            isAccountingOnly
              ? "Synchronizing double-entry transactions, receivables, payables, and stock valuations..."
              : "Synchronizing double-entry transactions, receivables, stock valuations, and FBR POS tax queue..."
          }
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
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {activeCompany?.name || "SmartBiz Workspace"}
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
            {t("Business Dashboard", "کاروباری ڈیش بورڈ")}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
            {t(
              "Daily business overview, cash flow, receivables, payables and net profit summary",
              "دکان کی روزمرہ فروخت، خریداری، بقایا رقم اور منافع کا آسان خلاصہ"
            )}
          </p>
        </div>

        {/* Action Controls & Asaan Mode Switch */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* Asaan Mode Toggle */}
          <button
            onClick={toggleAsaanMode}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition shadow-xs border ${
              isAsaanMode
                ? "bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-700 shadow-emerald-600/20"
                : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
            }`}
            title={t("Toggle simple or advanced dashboard mode", "آسان موڈ یا تفصیلی موڈ میں تبدیل کریں")}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{isAsaanMode ? t("⚡ Simple Mode: ON", "⚡ آسان موڈ: آن") : t("📊 Advanced Mode", "📊 تفصیلی موڈ")}</span>
          </button>

          <button
            onClick={fetchMetrics}
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            title={t("Refresh live metrics", "تازہ ترین ڈیٹا لائیں")}
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 dark:text-slate-400 ${loading ? "animate-spin" : ""}`} />
            <span className="truncate">{t("Refresh", "تازہ کریں")}</span>
          </button>
        </div>
      </div>

      {/* Multi-Branch Scope Banner */}
      {data?.activeBranchName ? (
        <div className="rounded-xl border border-emerald-300/80 bg-emerald-50/90 px-4 py-2.5 text-xs text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              {t("Viewing Branch", "موجودہ برانچ")}: <strong className="font-bold text-emerald-900 dark:text-emerald-100">{data.activeBranchName}</strong>
            </span>
          </div>
          {!isBranchLocked && (
            <button
              onClick={() => switchBranch(null)}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-emerald-100 underline self-start sm:self-auto"
            >
              <span>{t("Switch to All Branches", "تمام برانچز کا مجموعی کھاتہ دیکھیں")}</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
      ) : data?.branchesCount && data.branchesCount > 1 ? (
        <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/80 px-4 py-2.5 text-xs text-indigo-950 dark:border-indigo-800/80 dark:bg-indigo-950/40 dark:text-indigo-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-sm">🌐</span>
            <span>
              <strong>{t("All Branches View", "مجموعی کھاتہ")}:</strong> {t(`Showing consolidated financials across all ${data.branchesCount} sub-branches.`, `تمام ${data.branchesCount} برانچز کا مجموعی مالیاتی ریکارڈ ظاہر ہے۔`)}
            </span>
          </div>
          {(user?.role === "SUPER_ADMIN" || user?.role === "OWNER_ADMIN") && (
            <Link
              href="/branches"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 hover:text-indigo-900 dark:text-indigo-300 dark:hover:text-indigo-100 underline self-start sm:self-auto"
            >
              <span>{t("Manage Branches", "برانچز کا انتظام")}</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      ) : null}

      {/* ========================================================================= */}
      {/* OVERDUE & PAYMENT PROMISE ALERT BANNER */}
      {/* ========================================================================= */}
      {data?.paymentReminders && (data.paymentReminders.overdueCount > 0 || data.paymentReminders.dueTodayCount > 0) && (
        <div className="rounded-2xl border-2 border-rose-400 bg-gradient-to-r from-rose-50 via-amber-50 to-rose-50 p-4 sm:p-5 text-xs text-rose-950 dark:border-rose-800 dark:from-rose-950/60 dark:via-amber-950/40 dark:to-rose-950/60 dark:text-rose-200 shadow-md animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center font-bold shrink-0 shadow-sm animate-pulse">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-black text-rose-950 dark:text-rose-100">
                    ⚠️ {t(`Payment Due Alert: ${data.paymentReminders.overdueCount} payments are overdue!`, `اہم یاد دہانی: ${data.paymentReminders.overdueCount} ادائیگیاں / وصولیاں تاخیر کا شکار ہیں!`)}
                  </span>
                  <span className="rounded-full bg-rose-200/80 px-2 py-0.5 text-[10px] font-bold text-rose-900 dark:bg-rose-900 dark:text-rose-100">
                    {t("Overdue Alert", "تاخیر شدہ واجبات")}
                  </span>
                </div>
                <p className="text-rose-800 dark:text-rose-300 mt-0.5 text-xs leading-relaxed">
                  {t(
                    `Receivable from customers: Rs ${Number(data.paymentReminders.totalOverdueReceivables || 0).toLocaleString()} • Payable to suppliers: Rs ${Number(data.paymentReminders.totalOverduePayables || 0).toLocaleString()}`,
                    `گاہکوں سے Rs ${Number(data.paymentReminders.totalOverdueReceivables || 0).toLocaleString()} وصول کرنی ہے اور سپلائرز کو Rs ${Number(data.paymentReminders.totalOverduePayables || 0).toLocaleString()} ادا کرنی ہے۔`
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <Link
                href="/payments"
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-2 text-xs font-bold transition shadow-xs"
              >
                <span>{t("Record Payment", "ادائیگی ریکارڈ کریں")}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* HERO QUICK ACTION COMMAND CENTER                                          */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-50/80 to-white p-4 sm:p-5 shadow-xs dark:border-slate-800 dark:from-[#131b2e] dark:to-[#0f172a]">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white font-sans">
              {t("Daily Fast Actions", "آج کیا کرنا ہے؟")}
            </h2>
          </div>
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
            {t("Quick Shortcuts", "فوری شارٹ کٹس")}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {isFbrInvoicingOnly ? (
            <>
              {/* Action 1: New Sale Invoice */}
              <Link
                href="/sales/create"
                className="group relative flex flex-col justify-between p-4 rounded-xl border border-emerald-200/80 bg-white hover:bg-emerald-50/50 hover:border-emerald-400 shadow-2xs hover:shadow-md transition-all duration-200 dark:border-emerald-900/60 dark:bg-[#111827] dark:hover:bg-emerald-950/30"
              >
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold dark:bg-emerald-950/80 dark:text-emerald-300 group-hover:scale-105 transition-transform">
                    <Receipt className="h-5 w-5" />
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                    {t("+ New Invoice", "+ نیا بل")}
                  </span>
                </div>
                <div className="mt-3">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    {t("New Sale Invoice", "سیلز انوائس بنائیں")}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                    {t("Create single invoice and sync to FBR live", "سیلز بل بنائیں اور فوری FBR پر بھیجیں")}
                  </p>
                </div>
              </Link>

              {/* Action 2: Excel / CSV Bulk Upload */}
              <Link
                href="/sales/import"
                className="group relative flex flex-col justify-between p-4 rounded-xl border border-indigo-200/80 bg-white hover:bg-indigo-50/50 hover:border-indigo-400 shadow-2xs hover:shadow-md transition-all duration-200 dark:border-indigo-900/60 dark:bg-[#111827] dark:hover:bg-indigo-950/30"
              >
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold dark:bg-indigo-950/80 dark:text-indigo-300 group-hover:scale-105 transition-transform">
                    <UploadCloud className="h-5 w-5" />
                  </div>
                  <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
                    {t("Bulk Upload", "بلک اپلوڈ")}
                  </span>
                </div>
                <div className="mt-3">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {t("Excel / CSV Import", "ایکسل سے بلک انوائسز")}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                    {t("Upload sales invoice spreadsheet and hit FBR", "شیٹ اپلوڈ کریں اور تمام انوائسز FBR پر ہٹ کریں")}
                  </p>
                </div>
              </Link>

              {/* Action 3: FBR Compliance Hub */}
              <Link
                href="/compliance/fbr"
                className="group relative flex flex-col justify-between p-4 rounded-xl border border-purple-200/80 bg-white hover:bg-purple-50/50 hover:border-purple-400 shadow-2xs hover:shadow-md transition-all duration-200 dark:border-purple-900/60 dark:bg-[#111827] dark:hover:bg-purple-950/30"
              >
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold dark:bg-purple-950/80 dark:text-purple-300 group-hover:scale-105 transition-transform">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded-md border border-purple-200 dark:border-purple-800">
                    {t("FBR Gateway", "FBR گیٹ وے")}
                  </span>
                </div>
                <div className="mt-3">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                    {t("FBR Live Hub", "FBR ڈیجیٹل ہب")}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                    {t("Monitor live transmission queue & retry errors", "لائیو ٹرانسمیشن کیو اور غلط انوائسز دوبارہ بھیجیں")}
                  </p>
                </div>
              </Link>

              {/* Action 4: Sales Reports & Downloads */}
              <Link
                href="/reports"
                className="group relative flex flex-col justify-between p-4 rounded-xl border border-blue-200/80 bg-white hover:bg-blue-50/50 hover:border-blue-400 shadow-2xs hover:shadow-md transition-all duration-200 dark:border-blue-900/60 dark:bg-[#111827] dark:hover:bg-blue-950/30"
              >
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold dark:bg-blue-950/80 dark:text-blue-300 group-hover:scale-105 transition-transform">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800">
                    {t("Reports", "رپورٹس")}
                  </span>
                </div>
                <div className="mt-3">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {t("Sales Reports & Export", "سیلز رپورٹس و ڈاؤنلوڈ")}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                    {t("View sales summary and export invoice sheets", "سیلز سمری دیکھیں اور ایکسل و پی ڈی ایف ڈاؤنلوڈ کریں")}
                  </p>
                </div>
              </Link>
            </>
          ) : (
            <>
              {/* Action 1: New Sale */}
              <Link
                href="/sales/create"
                className="group relative flex flex-col justify-between p-4 rounded-xl border border-emerald-200/80 bg-white hover:bg-emerald-50/50 hover:border-emerald-400 shadow-2xs hover:shadow-md transition-all duration-200 dark:border-emerald-900/60 dark:bg-[#111827] dark:hover:bg-emerald-950/30"
              >
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold dark:bg-emerald-950/80 dark:text-emerald-300 group-hover:scale-105 transition-transform">
                    <Receipt className="h-5 w-5" />
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                    {t("+ New Sale", "+ نیا بل")}
                  </span>
                </div>
                <div className="mt-3">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    {t("New Sale", "مال بیچیں")}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                    {t("Create customer invoice and record sale", "گاہک کو مال بیچیں اور نیا بل بنائیں")}
                  </p>
                </div>
              </Link>

              {/* Action 2: New Purchase */}
              <Link
                href="/purchases/create"
                className="group relative flex flex-col justify-between p-4 rounded-xl border border-purple-200/80 bg-white hover:bg-purple-50/50 hover:border-purple-400 shadow-2xs hover:shadow-md transition-all duration-200 dark:border-purple-900/60 dark:bg-[#111827] dark:hover:bg-purple-950/30"
              >
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold dark:bg-purple-950/80 dark:text-purple-300 group-hover:scale-105 transition-transform">
                    <ShoppingBag className="h-5 w-5" />
                  </div>
                  <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded-md border border-purple-200 dark:border-purple-800">
                    {t("+ Purchase", "+ خریداری")}
                  </span>
                </div>
                <div className="mt-3">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                    {t("New Purchase", "مال خریدیں")}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                    {t("Record supplier purchase and warehouse inventory", "سپلائر سے مال لیں اور گودام کا اسٹاک درج کریں")}
                  </p>
                </div>
              </Link>

              {/* Action 3: Money In / Payment */}
              <Link
                href="/payments"
                className="group relative flex flex-col justify-between p-4 rounded-xl border border-blue-200/80 bg-white hover:bg-blue-50/50 hover:border-blue-400 shadow-2xs hover:shadow-md transition-all duration-200 dark:border-blue-900/60 dark:bg-[#111827] dark:hover:bg-blue-950/30"
              >
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold dark:bg-blue-950/80 dark:text-blue-300 group-hover:scale-105 transition-transform">
                    <ArrowDownLeft className="h-5 w-5" />
                  </div>
                  <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800">
                    {t("Money In", "وصولی +")}
                  </span>
                </div>
                <div className="mt-3">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {t("Customer Receipt", "پیسے وصول کریں")}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                    {t("Record customer dues or bank deposits", "گاہک سے بقایا وصولی یا بینک میں رقم درج کریں")}
                  </p>
                </div>
              </Link>

              {/* Action 4: Expenses / Money Out */}
              <Link
                href="/expenses"
                className="group relative flex flex-col justify-between p-4 rounded-xl border border-rose-200/80 bg-white hover:bg-rose-50/50 hover:border-rose-400 shadow-2xs hover:shadow-md transition-all duration-200 dark:border-rose-900/60 dark:bg-[#111827] dark:hover:bg-rose-950/30"
              >
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold dark:bg-rose-950/80 dark:text-rose-300 group-hover:scale-105 transition-transform">
                    <ArrowUpRight className="h-5 w-5" />
                  </div>
                  <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-800">
                    {t("Expense", "خرچہ -")}
                  </span>
                </div>
                <div className="mt-3">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                    {t("Record Expense", "خرچہ درج کریں")}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                    {t("Shop rent, electricity, bills or staff wages", "دکان کا کرایہ، بجلی بل، چائے یا تنخواہ کا خرچہ")}
                  </p>
                </div>
              </Link>
            </>
          )}
        </div>
      </div>

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
            <span>{isFbrInvoicingOnly ? t("Sales & FBR Hub", "سیلز و FBR ہب") : t("All Modules", "تمام کھاتے")}</span>
          </button>
          {!isFbrInvoicingOnly && (
            <button
              onClick={() => setActiveTab("accounting")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                activeTab === "accounting"
                  ? "bg-white text-indigo-700 shadow-2xs font-bold dark:bg-slate-800 dark:text-indigo-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <span>{t("Accounting & Bookkeeping", "روکڑ کھاتہ و بک کیپنگ")}</span>
            </button>
          )}
          {!isAccountingOnly && (
            <button
              onClick={() => setActiveTab("fbr")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                activeTab === "fbr"
                  ? "bg-white text-emerald-700 shadow-2xs font-bold dark:bg-slate-800 dark:text-emerald-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <span>{t("FBR Digital Tax", "FBR ٹیکس انوائسنگ")}</span>
            </button>
          )}
        </div>

        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium hidden md:block">
          {t("Business", "دکان")}: <strong className="text-slate-700 dark:text-slate-300">{activeCompany?.name}</strong>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: CORE BUSINESS ACCOUNTING HEALTH                                */}
      {/* ========================================================================= */}
      {showAccounting && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
              <span>{t("Financial Pulse & Cash Flow", "مالی صورتحال و روکڑ کھاتہ")}</span>
            </h2>
            <Link
              href="/reports"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-1 shrink-0"
            >
              <span>{t("Full Financial Reports", "مکمل مالیاتی رپورٹیں")}</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
            {/* Total Gross Sales */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-xs flex flex-col justify-between dark:border-slate-800/90 dark:bg-[#111827]">
              <div className="flex items-center justify-between gap-1">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                    {t("Gross Sales", "کل فروخت")}
                  </span>
                </div>
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
              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium mt-1 truncate block">
                {t("Total revenue earned", "دکان کی کل آمدنی")}
              </span>
            </div>

            {/* Total Purchases */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-xs flex flex-col justify-between dark:border-slate-800/90 dark:bg-[#111827]">
              <div className="flex items-center justify-between gap-1">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                    {t("Purchases", "کل خریداری")}
                  </span>
                </div>
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
              <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium mt-1 truncate block">
                {t("Total inventory bought", "دکان کا خریدا گیا مال")}
              </span>
            </div>

            {/* Cash & Bank Liquidity */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-xs flex flex-col justify-between dark:border-slate-800/90 dark:bg-[#111827]">
              <div className="flex items-center justify-between gap-1">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                    {t("Cash & Bank", "کیش و بینک")}
                  </span>
                </div>
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
                className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-1 truncate block"
                title={`${t("Cash", "کیش")}: Rs ${cashAmount.toLocaleString()} • ${t("Bank", "بینک")}: Rs ${bankAmount.toLocaleString()}`}
              >
                {t("Cash", "کیش")}: Rs {(cashAmount / 1000).toFixed(0)}k • {t("Bank", "بینک")}: Rs {(bankAmount / 1000).toFixed(0)}k
              </span>
            </div>

            {/* Customer Receivables */}
            <div className="rounded-2xl border border-amber-200/90 bg-amber-50/40 p-3.5 sm:p-4 shadow-xs flex flex-col justify-between dark:border-amber-900/60 dark:bg-amber-950/25">
              <div className="flex items-center justify-between gap-1">
                <div>
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-200 block">
                    {t("Receivables", "رقم لینی ہے")}
                  </span>
                </div>
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
                {t("Customer dues", "گاہکوں کے ذمے بقایا")} &rarr;
              </Link>
            </div>

            {/* Supplier Payables */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-xs flex flex-col justify-between dark:border-slate-800/90 dark:bg-[#111827]">
              <div className="flex items-center justify-between gap-1">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                    {t("Payables", "رقم دینی ہے")}
                  </span>
                </div>
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
                {t("Supplier dues", "سپلائرز کو بقایا")} &rarr;
              </Link>
            </div>

            {/* Estimated Net Profit */}
            <div className="rounded-2xl border border-emerald-200/90 bg-emerald-50/40 p-3.5 sm:p-4 shadow-xs flex flex-col justify-between dark:border-emerald-900/60 dark:bg-emerald-950/25">
              <div className="flex items-center justify-between gap-1">
                <div>
                  <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 block">
                    {t("Net Profit", "خالص بچت")}
                  </span>
                </div>
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
              <span
                className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium mt-1 truncate block cursor-help"
                title={`${t("Revenue minus COGS and Operating Expenses", "فروخت منفی مال کی لاگت و اخراجات")}`}
              >
                {t("Revenue less COGS & expenses", "فروخت منفی مال کی لاگت و اخراجات")}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Branch Performance Comparison Matrix (Consolidated Mode) */}
      {showAccounting && !isAsaanMode && data?.branchBreakdown && data.branchBreakdown.length > 0 && !data?.activeBranchId && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800/90 dark:bg-[#111827]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3.5 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-sans flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>{t("Branch Performance Matrix", "برانچ وائز تقابلی جائزہ")}</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {t(
                  "Real-time consolidated sales, purchases, operating expenses, and estimated net profit per branch",
                  "تمام برانچز کی فروخت، خریداری، اخراجات اور متوقع خالص منافع کا تقابل"
                )}
              </p>
            </div>
            {(user?.role === "SUPER_ADMIN" || user?.role === "OWNER_ADMIN") && (
              <Link
                href="/branches"
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1 shrink-0"
              >
                <span>{t("Manage Branches", "برانچز کا انتظام")}</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>

          <div className="overflow-x-auto mt-3">
            <table className="w-full min-w-[720px] text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                  <th className="py-2.5 px-3">{t("Branch Details", "برانچ کی تفصیلات")}</th>
                  <th className="py-2.5 px-3">{t("Manager / City", "منیجر / شہر")}</th>
                  <th className="py-2.5 px-3">{t("Gross Sales", "کل فروخت")}</th>
                  <th className="py-2.5 px-3">{t("Purchases", "کل خریداری")}</th>
                  <th className="py-2.5 px-3">{t("Expenses", "اخراجات")}</th>
                  <th className="py-2.5 px-3">{t("Net Profit", "خالص بچت")}</th>
                  <th className="py-2.5 px-3 text-right">{t("Action", "کارروائی")}</th>
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
                        {b.salesSharePercent}% {t("of total", "کل کا")}
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
                        {t("Inspect Branch", "برانچ کھولیں")} &rarr;
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
      {showFbr && (!isAsaanMode || activeTab === "fbr") && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
              <span>{t("FBR Digital POS & Statutory Tax Center", "FBR ڈیجیٹل پی او ایس و ٹیکس سینٹر")}</span>
            </h2>
            <Link
              href="/compliance/fbr"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-1 shrink-0"
            >
              <span>{t("FBR Invoicing Hub", "FBR انوائسنگ ہب")}</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
            {/* Net Taxable Sales */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-xs flex flex-col justify-between dark:border-slate-800/90 dark:bg-[#111827]">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block truncate">
                {t("Net Taxable Sales", "قابل ٹیکس فروخت")}
              </span>
              <p
                className="mt-2 text-sm sm:text-base lg:text-lg xl:text-xl font-bold text-slate-900 dark:text-white font-mono tabular-nums truncate"
                title={`Rs ${Number(data?.netSales || 0).toLocaleString()}`}
              >
                Rs {data ? Number(data.netSales || 0).toLocaleString() : "..."}
              </p>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 truncate block">
                {t("Excl. Sales Tax", "سیلز ٹیکس کے علاوہ")}
              </span>
            </div>

            {/* Total Tax Collected */}
            <div className="rounded-2xl border border-indigo-200/80 bg-indigo-50/40 p-3.5 sm:p-4 shadow-xs flex flex-col justify-between dark:border-indigo-900/60 dark:bg-indigo-950/25">
              <span className="text-[10px] sm:text-[11px] font-bold text-indigo-900 dark:text-indigo-200 uppercase tracking-wide block truncate">
                {t("Total Tax Collected", "وصول شدہ کل ٹیکس")}
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
                {t("18% Sales Tax", "18% سیلز ٹیکس")}
              </span>
              <p
                className="mt-2 text-sm sm:text-base lg:text-lg xl:text-xl font-bold text-slate-900 dark:text-white font-mono tabular-nums truncate"
                title={`Rs ${Number(data?.salesTax || 0).toLocaleString()}`}
              >
                Rs {data ? Number(data.salesTax || 0).toLocaleString() : "..."}
              </p>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 truncate block">
                {t("Standard Schedule", "معیاری شیڈول")}
              </span>
            </div>

            {/* 3% Further Tax */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-xs flex flex-col justify-between dark:border-slate-800/90 dark:bg-[#111827]">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block truncate">
                {t("3% Further Tax", "3% مزید ٹیکس")}
              </span>
              <p
                className="mt-2 text-sm sm:text-base lg:text-lg xl:text-xl font-bold text-amber-600 dark:text-amber-400 font-mono tabular-nums truncate"
                title={`Rs ${Number(data?.furtherTax || 0).toLocaleString()}`}
              >
                Rs {data ? Number(data.furtherTax || 0).toLocaleString() : "..."}
              </p>
              <span className="text-[10px] text-amber-600/90 dark:text-amber-400/90 mt-1 truncate block">
                {t("Unregistered Buyers", "غیر رجسٹرڈ خریدار")}
              </span>
            </div>

            {/* FBR Validated Invoices */}
            <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-3.5 sm:p-4 shadow-xs flex flex-col justify-between dark:border-emerald-900/60 dark:bg-emerald-950/25">
              <span className="text-[10px] sm:text-[11px] font-bold text-emerald-800 dark:text-emerald-200 uppercase tracking-wide block truncate">
                {t("FBR Validated", "FBR تصدیق شدہ")}
              </span>
              <p className="mt-2 text-sm sm:text-base lg:text-lg xl:text-xl font-bold text-emerald-700 dark:text-emerald-300 font-mono tabular-nums truncate">
                {data?.successfulFbr ?? 0} {t("Invoices", "انوائسز")}
              </p>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 truncate flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 shrink-0" /> {t("QR Generated", "کیو آر تصدیق شدہ")}
              </span>
            </div>

            {/* FBR Compliance Score */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-xs flex flex-col justify-between dark:border-slate-800/90 dark:bg-[#111827]">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block truncate">
                {t("Compliance Health", "ٹیکس کمپلائنس")}
              </span>
              <p className="mt-2 text-sm sm:text-base lg:text-lg xl:text-xl font-bold text-indigo-600 dark:text-indigo-400 font-mono tabular-nums truncate">
                {data?.complianceScore ?? 100}%
              </p>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-1 truncate block">
                {data?.failedFbr ? `${data.failedFbr} ${t("Failed (Action Req.)", "ناکام (کارروائی درکار)")}` : t("All Sync Healthy", "تمام ڈیٹا اپ ڈیٹ ہے")}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Visual Analytics & FBR Live Queue */}
      {(!isAsaanMode || activeTab === "fbr") && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Left 2 Cols: Revenue & Trajectory Chart */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-xs dark:border-slate-800/90 dark:bg-[#111827]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 mb-4 sm:mb-6">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight font-sans">
                  {isAccountingOnly
                    ? t("Monthly Sales Performance", "ماہانہ فروخت و آمدنی")
                    : t("Monthly Revenue & FBR POS Performance", "ماہانہ آمدنی و FBR پی او ایس کارکردگی")}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isAccountingOnly
                    ? t("Net sales turnover and invoice performance", "خالص فروخت اور بلوں کی کارکردگی")
                    : t("Gross Sales, Tax Collected, and Verified FBR Invoicing", "کل فروخت، وصول شدہ ٹیکس اور تصدیق شدہ FBR انوائسز")}
                </p>
              </div>
              <div className="flex items-center gap-3 sm:gap-4 text-xs font-semibold flex-wrap">
                <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <span className="h-2.5 w-2.5 rounded-sm bg-indigo-600 shrink-0" /> {t("Net Sales", "خالص فروخت")}
                </span>
                {!isAccountingOnly && (
                  <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                    <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500 shrink-0" /> {t("FBR Compliant", "FBR تصدیق شدہ")}
                  </span>
                )}
              </div>
            </div>

            <div className="h-64 sm:h-72 w-full">
              {data?.monthlyTrends && data.monthlyTrends.some((t: any) => Number(t.sales || 0) > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.monthlyTrends}
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
                    <Bar dataKey="sales" name={t("Net Sales", "خالص فروخت")} fill="#4f46e5" radius={[4, 4, 0, 0]} maxBarSize={22} />
                    {!isAccountingOnly && (
                      <Bar dataKey="fbrCompliant" name={t("FBR Compliant", "FBR تصدیق شدہ")} fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={22} />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                  <BarChart3 className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {t("No Sales History in this Period", "اس مدت میں کوئی فروخت ریکارڈ نہیں ہوئی")}
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 max-w-xs">
                    {t("Monthly sales trend bars will automatically appear as you create customer sales invoices.", "جب آپ سیلز بل جاری کریں گے تو ماہانہ چارٹ خودکار طور پر بن جائے گا۔")}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right 1 Col: Quick Accounting Summary OR FBR Live Queue */}
          {isAccountingOnly ? (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-xs dark:border-slate-800/90 dark:bg-[#111827] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white font-sans">{t("Quick Overview", "کاروباری خلاصہ")}</h3>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                    {t("ACCOUNTING", "اکاؤنٹنگ")}
                  </span>
                </div>

                <div className="mt-4 space-y-3.5">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 space-y-2 dark:border-slate-800 dark:bg-slate-900/60">
                    <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                      <span>{t("Business Name", "ادارہ / بزنس")}:</span>
                      <strong className="text-slate-900 dark:text-slate-100 font-sans">{activeCompany?.name}</strong>
                    </div>
                    <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                      <span>{t("Total Bills Issued", "کل جاری کردہ بل")}:</span>
                      <strong className="text-slate-900 dark:text-slate-100 font-mono">{data?.recentInvoices?.length || 0} {t("Bills", "بل")}</strong>
                    </div>
                    <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                      <span>{t("Receivables", "واجب الوصول")}:</span>
                      <strong className="text-indigo-600 dark:text-indigo-400 font-mono">Rs {Number(data?.receivablesTotal || 0).toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                      <span>{t("Payables", "واجب الادا")}:</span>
                      <strong className="text-rose-600 dark:text-rose-400 font-mono">Rs {Number(data?.payablesTotal || 0).toLocaleString()}</strong>
                    </div>
                  </div>

                  <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center dark:border-slate-800">
                    <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1" />
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t("Ledger & accounts are balanced", "لیجر و کھاتے اپ ڈیٹ اور متوازن ہیں")}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">{t("Double-entry bookkeeping is active & balanced", "ڈبل انٹری بک کیپنگ فعال ہے")}</p>
                  </div>
                </div>
              </div>

              <div className="pt-3.5 border-t border-slate-100 dark:border-slate-800 mt-4 flex gap-2">
                <Link
                  href="/reports"
                  className="flex-1 rounded-xl bg-indigo-50 border border-indigo-200 py-2.5 text-center text-xs font-bold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-900/50 transition"
                >
                  {t("Full Financial Reports", "مکمل مالیاتی رپورٹیں")} &rarr;
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-xs dark:border-slate-800/90 dark:bg-[#111827] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white font-sans">{t("FBR POS Live Status", "FBR پی او ایس لائیو صورتحال")}</h3>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {t("ACTIVE", "فعال")}
                  </span>
                </div>

                <div className="mt-4 space-y-3.5">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 space-y-1.5 dark:border-slate-800 dark:bg-slate-900/60">
                    <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                      <span>{t("POS Terminal ID", "ٹرمینل آئی ڈی")}:</span>
                      <strong className="text-slate-900 dark:text-slate-100 font-mono">POS-KHI-001</strong>
                    </div>
                    <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                      <span>{t("Organization NTN", "ادارہ NTN")}:</span>
                      <strong className="text-slate-900 dark:text-slate-100 font-mono">{activeCompany?.ntn || "1234567-8"}</strong>
                    </div>
                    <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                      <span>{t("Tax Profile", "ٹیکس پروفائل")}:</span>
                      <strong className="text-slate-900 dark:text-slate-100 font-mono">{t("Standard 18%", "معیاری 18%")}</strong>
                    </div>
                  </div>

                  {/* Compliance Issues / Retries */}
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                      {t("Transmission Queue", "FBR منتقلی کی قطار")} ({data?.complianceIssues?.length || 0})
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
                                {issue.reason || t("Pending transmission batch", "منتقلی زیر التواء")}
                              </span>
                            </div>
                            <button
                              onClick={() => handleRetryFbr(issue.invoiceId)}
                              disabled={retryingId === issue.invoiceId}
                              className="shrink-0 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition"
                            >
                              {retryingId === issue.invoiceId ? t("Retrying...", "کوشش جاری...") : t("Retry", "دوبارہ بھیجیں")}
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center dark:border-slate-800">
                        <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1" />
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t("All Invoices Synchronized", "تمام انوائسز FBR پر منتقل ہیں")}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">{t("Zero transmission backlogs detected", "کوئی تاخیر شدہ ریکارڈ نہیں ہے")}</p>
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
                  {t("FBR Audit Center", "FBR آڈٹ سینٹر")} &rarr;
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Asaan Mode Guidance Banner */}
      {isAsaanMode && activeTab === "all" && (
        <div className="rounded-xl border border-emerald-200/90 bg-emerald-50/70 p-3 sm:p-4 text-xs text-emerald-950 dark:border-emerald-800/80 dark:bg-emerald-950/40 dark:text-emerald-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              <strong>{t("Simple Mode Active", "آسان موڈ آن ہے")}:</strong> {t(
                "Complex analytics charts are hidden for high-speed daily bookkeeping. Switch to Advanced Mode above to view charts and tax queues.",
                "غیر ضروری پیچیدہ گراف چھپا دیے گئے ہیں تاکہ آپ آسانی سے روزمرہ کا کام کر سکیں۔ تفصیلی چارٹس اور ٹیکس گوشوارے دیکھنے کیلئے اوپر تفصیلی موڈ کا بٹن دبائیں۔"
              )}
            </span>
          </div>
          <button
            onClick={toggleAsaanMode}
            className="text-emerald-700 dark:text-emerald-300 font-bold hover:underline shrink-0 text-xs self-start sm:self-auto"
          >
            {t("Open Advanced Mode", "تفصیلی موڈ کھولیں")} &rarr;
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PAYMENT PROMISE & OVERDUE REMINDERS WIDGET                                 */}
      {/* ========================================================================= */}
      {!isFbrInvoicingOnly && data?.paymentReminders && (
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden dark:border-slate-800/90 dark:bg-[#111827]">
          <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shrink-0 border border-amber-200/80 dark:border-amber-800/80">
                <Bell className="h-4.5 w-4.5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight font-sans">
                  {t("Payment Due Dates & Reminders", "ادائیگی و وصولی کی یاد دہانی")}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {t("Scheduled and overdue customer receivables and supplier payables", "وعدہ کے مطابق تاخیر شدہ اور آج کی وصولیاں اور ادائیگیاں")}
                </p>
              </div>
            </div>

            {/* Filter Buttons: All, Receivables, Payables */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl shrink-0 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setReminderFilter("ALL")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                  reminderFilter === "ALL"
                    ? "bg-white text-slate-900 shadow-2xs font-bold dark:bg-slate-900 dark:text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                {t("All", "سب")} ({data.paymentReminders.reminders?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setReminderFilter("RECEIVABLE")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                  reminderFilter === "RECEIVABLE"
                    ? "bg-emerald-600 text-white shadow-2xs font-bold"
                    : "text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
                }`}
              >
                {t("Receivables", "وصولیاں")} ({data.paymentReminders.reminders?.filter((r: any) => r.type === "RECEIVABLE").length || 0})
              </button>
              <button
                type="button"
                onClick={() => setReminderFilter("PAYABLE")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                  reminderFilter === "PAYABLE"
                    ? "bg-rose-600 text-white shadow-2xs font-bold"
                    : "text-rose-700 hover:text-rose-800 dark:text-rose-400"
                }`}
              >
                {t("Payables", "ادائیگیاں")} ({data.paymentReminders.reminders?.filter((r: any) => r.type === "PAYABLE").length || 0})
              </button>
            </div>
          </div>

          {/* List of Reminders */}
          <div className="p-4 sm:p-5">
            {(() => {
              const activeReminders = (data.paymentReminders.reminders || []).filter((r: any) => {
                if (reminderFilter === "RECEIVABLE") return r.type === "RECEIVABLE";
                if (reminderFilter === "PAYABLE") return r.type === "PAYABLE";
                return true;
              });

              if (activeReminders.length === 0) {
                return (
                  <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/50 p-6 text-center dark:border-emerald-900/60 dark:bg-emerald-950/20">
                    <CheckCircle2 className="h-7 w-7 text-emerald-500 mx-auto mb-2" />
                    <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                      {t("All payment commitments are completely settled!", "تمام وعدہ شدہ ادائیگیاں اور وصولیاں کلیئر ہیں!")}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      {t("No overdue or pending payments requiring immediate attention in this filter.", "کوئی تاخیر شدہ ادائیگیاں یا وصولیاں موجود نہیں ہیں۔")}
                    </p>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {activeReminders.map((reminder: any) => {
                    const isReceivable = reminder.type === "RECEIVABLE";
                    const isOverdue = reminder.urgency === "OVERDUE";
                    const isDueToday = reminder.urgency === "DUE_TODAY";

                    return (
                      <div
                        key={`${reminder.type}-${reminder.id}`}
                        className={`rounded-xl border p-3.5 flex flex-col justify-between transition hover:shadow-xs ${
                          isOverdue
                            ? "border-rose-200/90 bg-rose-50/40 dark:border-rose-900/50 dark:bg-rose-950/20"
                            : isDueToday
                            ? "border-amber-200/90 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/20"
                            : "border-slate-200/80 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/30"
                        }`}
                      >
                        <div>
                          {/* Header row: Type badge & Urgency status */}
                          <div className="flex items-center justify-between gap-1 mb-2">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                isReceivable
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300"
                                  : "bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300"
                              }`}
                            >
                              {isReceivable ? t("Receivable", "گاہک سے وصولی") : t("Payable", "سپلائر کو ادائیگی")}
                            </span>

                            {isOverdue ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-700 dark:text-rose-400">
                                <AlertTriangle className="h-3 w-3" />
                                <span>{reminder.daysOverdue} {t("Days Overdue", "دن تاخیر")}</span>
                              </span>
                            ) : isDueToday ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-700 dark:text-amber-400">
                                <Clock className="h-3 w-3" />
                                <span>{t("Due Today", "آج کا وعدہ")}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                <Calendar className="h-3 w-3" />
                                <span>{reminder.daysOverdue < 0 ? `${Math.abs(reminder.daysOverdue)} ${t("days remaining", "دن بعد")}` : t("Upcoming", "آئندہ")}</span>
                              </span>
                            )}
                          </div>

                          {/* Party Name & Contact */}
                          <div className="mb-2">
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                              {reminder.entityName}
                            </h4>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              <span>Ref: #{reminder.referenceNumber}</span>
                              {reminder.entityPhone && (
                                <a
                                  href={`tel:${reminder.entityPhone}`}
                                  className="inline-flex items-center gap-0.5 text-indigo-600 dark:text-indigo-400 hover:underline"
                                  title={t("Call Phone", "کال کریں")}
                                >
                                  <Phone className="h-3 w-3" />
                                  <span>{reminder.entityPhone}</span>
                                </a>
                              )}
                            </div>
                          </div>

                          {/* Promised Date info */}
                          <div className="rounded-lg bg-white/70 dark:bg-slate-800/60 p-2 text-[11px] space-y-1 border border-slate-100 dark:border-slate-800 mb-3">
                            <div className="flex justify-between text-slate-600 dark:text-slate-400">
                              <span>{t("Due Date", "وعدہ تاریخ")}:</span>
                              <strong className="text-slate-900 dark:text-slate-200">
                                {new Date(reminder.dueDate).toLocaleDateString("en-GB", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </strong>
                            </div>
                            <div className="flex justify-between text-slate-600 dark:text-slate-400">
                              <span>{t("Total Amount", "کل رقم")}:</span>
                              <span className="font-mono">Rs {Number(reminder.totalAmount).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-slate-600 dark:text-slate-400">
                              <span>{t("Paid", "ادا شدہ")}:</span>
                              <span className="font-mono text-emerald-600 dark:text-emerald-400">
                                Rs {Number(reminder.paidAmount).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Balance Remaining & 1-Click Action */}
                        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between gap-2">
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">{t("Remaining Balance", "بقایا رقم")}</span>
                            <span
                              className={`text-sm sm:text-base font-black font-mono ${
                                isReceivable ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
                              }`}
                            >
                              Rs {Number(reminder.remainingAmount).toLocaleString()}
                            </span>
                          </div>

                          <Link
                            href={
                              isReceivable
                                ? `/payments?type=CUSTOMER_RECEIPT`
                                : `/payments?type=SUPPLIER_PAYMENT`
                            }
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition shadow-2xs ${
                              isReceivable
                                ? "bg-emerald-600 hover:bg-emerald-700"
                                : "bg-rose-600 hover:bg-rose-700"
                            }`}
                          >
                            <span>{isReceivable ? t("Receive Payment", "وصول کریں") : t("Make Payment", "ادائیگی کریں")}</span>
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Unified Recent Sales & Compliance Ledger Table */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden dark:border-slate-800/90 dark:bg-[#111827]">
        <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight font-sans">
              {t("Recent Customer Bills", "حالیہ فروخت و انوائسز")}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t(
                "Recent sales invoices, payment status, receipts and FBR fiscal validation",
                "دکان کے حالیہ کسٹمر بل، ادائیگی کی تفصیلات اور رسید پرنٹ کرنے کی سہولت"
              )}
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
                title={t("Table View", "ٹیبل ویو")}
              >
                <List className="h-3.5 w-3.5" />
                <span className="text-[10px]">{t("Table", "ٹیبل")}</span>
              </button>
              <button
                onClick={() => setTableLayout("cards")}
                className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 ${
                  tableLayout === "cards"
                    ? "bg-white text-slate-900 shadow-2xs dark:bg-slate-900 dark:text-white"
                    : "text-slate-500 dark:text-slate-400"
                }`}
                title={t("Cards View", "کارڈ ویو")}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="text-[10px]">{t("Cards", "کارڈز")}</span>
              </button>
            </div>

            <Link
              href="/sales"
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 hover:underline"
            >
              <span>{t("All Sales Invoices", "تمام فروخت کا کھاتہ")}</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Mobile Swipe Hint when in Table view */}
        <div className="md:hidden bg-slate-50/90 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800 px-4 py-1.5 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
          <span>{t("👉 Swipe table sideways to inspect all columns", "👉 تمام کالم دیکھنے کے لیے ٹیبل کو بائیں دائیں گھمائیں")}</span>
          <span className="font-semibold text-slate-700 dark:text-slate-300">{data?.recentInvoices?.length || 0} {t("bills", "بل")}</span>
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
                          {inv.customerName || t("Walk-in Retail Customer", "واک اِن کسٹمر")}
                        </span>
                      </div>
                      {isAccountingOnly ? (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            inv.paymentStatus === "PAID"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                              : inv.paymentStatus === "PARTIAL"
                              ? "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                              : "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800"
                          }`}
                        >
                          {inv.paymentStatus === "PAID" && <CheckCircle2 className="h-2.5 w-2.5" />}
                          {inv.paymentStatus || "PAID"}
                        </span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            isSuccess
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                              : isFailed
                              ? "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800"
                              : inv.fbrStatus === "NOT_APPLICABLE"
                              ? "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                              : "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                          }`}
                        >
                          {isSuccess && <CheckCircle2 className="h-2.5 w-2.5" />}
                          {inv.fbrStatus === "NOT_APPLICABLE" ? "LOCAL SALE" : (inv.fbrStatus || "PENDING")}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 block">{t("Total Amount:", "کل رقم:")}</span>
                        <strong className="text-slate-900 dark:text-white font-mono text-sm">
                          Rs {Number(inv.totalAmount || 0).toLocaleString()}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 block">{isAccountingOnly ? t("Tax Amount:", "ٹیکس:") : t("Tax (18% / 3%):", "ٹیکس (18% / 3%):")}</span>
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
                        {isAccountingOnly || inv.fbrStatus === "NOT_APPLICABLE" ? (
                          <Link
                            href="/sales"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-indigo-600 hover:bg-slate-50 shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-indigo-300"
                          >
                            <Eye className="h-3 w-3" />
                            <span>{t("View Bill", "بل دیکھیں")}</span>
                          </Link>
                        ) : (inv.fbrQrCode || inv.fbrInvoiceNumber) ? (
                          <a
                            href={`/verify/fbr?inv=${encodeURIComponent(inv.fbrInvoiceNumber || inv.invoiceNumber)}`}
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
                {t("No transactions found for the selected period", "منتخب مدت کے لیے کوئی لین دین نہیں ملا")}
              </div>
            )}
          </div>
        ) : (
          /* High-Density Responsive Table View */
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                  <th className="py-3 px-4 whitespace-nowrap">{t("Invoice #", "انوائس نمبر")}</th>
                  <th className="py-3 px-4">{t("Customer", "گاہک")}</th>
                  <th className="py-3 px-4 whitespace-nowrap">{t("Date", "تاریخ")}</th>
                  <th className="py-3 px-4 whitespace-nowrap">{t("Subtotal", "سب ٹوٹل")}</th>
                  <th className="py-3 px-4 whitespace-nowrap">{isAccountingOnly ? t("Tax", "ٹیکس") : t("Tax (18% / 3%)", "ٹیکس (18% / 3%)")}</th>
                  <th className="py-3 px-4 whitespace-nowrap">{t("Total Amount", "کل رقم")}</th>
                  <th className="py-3 px-4 whitespace-nowrap">{t("Payment", "ادائیگی")}</th>
                  {!isAccountingOnly && <th className="py-3 px-4 whitespace-nowrap">{t("FBR Status", "FBR اسٹیٹس")}</th>}
                  <th className="py-3 px-4 text-right whitespace-nowrap">{isAccountingOnly ? t("Action", "کارروائی") : t("Receipt / Action", "رسید / کارروائی")}</th>
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
                          {inv.customerName || t("Walk-in Retail Customer", "واک اِن کسٹمر")}
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
                        {!isAccountingOnly && (
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                isSuccess
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                                  : isFailed
                                  ? "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800"
                                  : inv.fbrStatus === "NOT_APPLICABLE"
                                  ? "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                                  : "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                              }`}
                            >
                              {isSuccess && <CheckCircle2 className="h-3 w-3" />}
                              {inv.fbrStatus === "NOT_APPLICABLE" ? "LOCAL SALE" : (inv.fbrStatus || "PENDING")}
                            </span>
                          </td>
                        )}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {isAccountingOnly || inv.fbrStatus === "NOT_APPLICABLE" ? (
                            <Link
                              href="/sales"
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition"
                            >
                              <Eye className="h-3 w-3" />
                              <span>{t("View Bill", "بل دیکھیں")}</span>
                            </Link>
                          ) : (inv.fbrQrCode || inv.fbrInvoiceNumber) ? (
                            <a
                              href={`/verify/fbr?inv=${encodeURIComponent(inv.fbrInvoiceNumber || inv.invoiceNumber)}`}
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
                    <td colSpan={isAccountingOnly ? 8 : 9} className="py-8 text-center text-slate-400 text-xs dark:text-slate-500">
                      {t("No transactions found for the selected period", "منتخب مدت کے لیے کوئی لین دین نہیں ملا")}
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
