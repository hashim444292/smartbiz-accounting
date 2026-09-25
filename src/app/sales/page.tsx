"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/decimal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Search,
  Eye,
  RotateCcw,
  Printer,
  UploadCloud,
  Download,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  CheckCircle2,
  Clock,
  X,
  Pencil,
  AlertCircle,
  Building2,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useAuth } from "@/context/AuthContext";
import { smartFetch, invalidateCache } from "@/lib/clientCache";

interface SaleRecord {
  id: string;
  invoiceNumber: string;
  date: string;
  customerName: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: "PAID" | "PARTIAL" | "UNPAID";
  paymentMethod: string;
  status: "DRAFT" | "POSTED" | "CANCELLED";
  createdById?: string;
  createdByName?: string;
  isEdited?: boolean;
  editCount?: number;
  updatedById?: string;
  updatedByName?: string;
  updatedAt?: string;
  editReason?: string;
  notes?: string;
  items: Array<{ productName: string; quantity: number; unitPrice: number; lineTotal: number }>;
}

export default function SalesPage() {
  const { user, activeCompany, branches, selectedBranch, activeBranchId, isBranchLocked } = useAuth();
  const effectiveBranch = isBranchLocked ? user?.branchId : (selectedBranch?.id || activeBranchId || null);

  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState<"ALL" | "TODAY" | "YESTERDAY" | "THIS_WEEK" | "THIS_MONTH" | "LAST_30_DAYS">("ALL");
  const [reversingId, setReversingId] = useState<string | null>(null);

  // Edit Invoice State & User Tracking
  const [editingSale, setEditingSale] = useState<SaleRecord | null>(null);
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editPaymentStatus, setEditPaymentStatus] = useState<"PAID" | "PARTIAL" | "UNPAID">("PAID");
  const [editPaidAmount, setEditPaidAmount] = useState<number>(0);
  const [editNotes, setEditNotes] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); // 10 or 15 default entries

  const fetchSales = async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (activeCompany?.id) headers["x-business-id"] = activeCompany.id;
      if (effectiveBranch) headers["x-branch-id"] = effectiveBranch;
      const query = effectiveBranch ? `?branchId=${effectiveBranch}` : "?branchId=all";

      const json = await smartFetch(`/api/sales${query}`, { headers, ttlMs: 20000 });
      if (json.success) {
        setSales(json.data);
      }
    } catch (err) {
      console.error("Failed to load sales:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, [activeCompany?.id, effectiveBranch]);

  const handleReverse = async (id: string, invoiceNumber: string) => {
    if (!confirm(`Are you sure you want to reverse sale invoice #${invoiceNumber}? This will restock items and rebalance receivables.`)) {
      return;
    }
    setReversingId(id);
    try {
      const res = await fetch(`/api/sales/${id}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Customer return / cancellation requested by user" }),
      });
      const json = await res.json();
      if (json.success) {
        alert("Sale reversed successfully.");
        invalidateCache("/api/sales");
        invalidateCache("/api/products");
        invalidateCache("/api/dashboard");
        fetchSales();
      } else {
        alert(`Failed to reverse: ${json.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setReversingId(null);
    }
  };

  const openEditModal = (sale: SaleRecord) => {
    setEditingSale(sale);
    setEditCustomerName(sale.customerName || "");
    setEditPaymentStatus(sale.paymentStatus);
    setEditPaidAmount(Number(sale.paidAmount || 0));
    setEditNotes(sale.notes || "");
    setEditReason("");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSale) return;
    if (!editReason.trim()) {
      alert("Please provide an edit reason (ترمیم کی وجہ درج کرنا لازمی ہے).");
      return;
    }
    setEditSaving(true);
    try {
      const res = await fetch(`/api/sales/${editingSale.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: editCustomerName,
          paidAmount: editPaidAmount,
          paymentStatus: editPaymentStatus,
          notes: editNotes,
          editReason: editReason.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        alert("Invoice updated successfully. Audit trail recorded.");
        setEditingSale(null);
        invalidateCache("/api/sales");
        invalidateCache("/api/dashboard");
        fetchSales();
      } else {
        alert(json.error || "Failed to update sale invoice");
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setEditSaving(false);
    }
  };

  // Date comparison helper functions
  const now = new Date();
  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  // KPI computations — from ALL sales (not filtered) so cards always show full picture
  const postedSales = sales.filter((s) => s.status !== "CANCELLED");
  const todayStart  = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const _weekDay    = now.getDay();
  const weekStart   = new Date(now.getFullYear(), now.getMonth(), now.getDate() - _weekDay + (_weekDay === 0 ? -6 : 1), 0, 0, 0, 0);
  const monthStart  = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const sumAmt = (arr: SaleRecord[]) => arr.reduce((a, s) => a + Number(s.totalAmount || 0), 0);
  const sumPd  = (arr: SaleRecord[]) => arr.reduce((a, s) => a + Number(s.paidAmount  || 0), 0);
  const todaySalesData   = postedSales.filter((s) => new Date(s.date) >= todayStart);
  const weekSalesData    = postedSales.filter((s) => new Date(s.date) >= weekStart);
  const monthSalesData   = postedSales.filter((s) => new Date(s.date) >= monthStart);
  const kpiCards = [
    { label: "Today's Sales",  urdu: "آج کی فروخت",         count: todaySalesData.length,   amt: sumAmt(todaySalesData),   paid: sumPd(todaySalesData),   c: "blue"    as const, emoji: "📅" },
    { label: "This Week",      urdu: "اس ہفتے کی فروخت",    count: weekSalesData.length,    amt: sumAmt(weekSalesData),    paid: sumPd(weekSalesData),    c: "indigo"  as const, emoji: "📆" },
    { label: "This Month",     urdu: "اس مہینے کی فروخت",   count: monthSalesData.length,   amt: sumAmt(monthSalesData),   paid: sumPd(monthSalesData),   c: "violet"  as const, emoji: "🗓️" },
    { label: "Overall Sales",  urdu: "مجموعی فروخت",         count: postedSales.length,      amt: sumAmt(postedSales),      paid: sumPd(postedSales),      c: "emerald" as const, emoji: "📊" },
  ];
  const kpiColor = {
    blue:    { border: "border-blue-100 dark:border-blue-900/40",    bg: "bg-blue-50/60 dark:bg-blue-950/20",    lbl: "text-blue-700 dark:text-blue-300",    val: "text-blue-900 dark:text-blue-100",    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300" },
    indigo:  { border: "border-indigo-100 dark:border-indigo-900/40",bg: "bg-indigo-50/60 dark:bg-indigo-950/20",lbl: "text-indigo-700 dark:text-indigo-300",val: "text-indigo-900 dark:text-indigo-100",badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300" },
    violet:  { border: "border-violet-100 dark:border-violet-900/40",bg: "bg-violet-50/60 dark:bg-violet-950/20",lbl: "text-violet-700 dark:text-violet-300",val: "text-violet-900 dark:text-violet-100",badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-300" },
    emerald: { border: "border-emerald-100 dark:border-emerald-900/40",bg: "bg-emerald-50/60 dark:bg-emerald-950/20",lbl: "text-emerald-700 dark:text-emerald-300",val: "text-emerald-900 dark:text-emerald-100",badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300" },
  };

  // Filter Sales records
  const filteredSales = sales.filter((s) => {
    // 1. Search text filter
    const matchesSearch =
      s.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      s.customerName.toLowerCase().includes(search.toLowerCase());

    // 2. Payment Status filter
    const matchesStatus = statusFilter === "ALL" || s.paymentStatus === statusFilter;

    // 3. Date Range filter (Today, Yesterday, This Week, This Month)
    let matchesDate = true;
    if (dateFilter !== "ALL") {
      const saleDate = new Date(s.date);
      if (isNaN(saleDate.getTime())) {
        matchesDate = true;
      } else if (dateFilter === "TODAY") {
        matchesDate = isSameDay(saleDate, now);
      } else if (dateFilter === "YESTERDAY") {
        const yesterday = new Date(now.getTime() - 86400000);
        matchesDate = isSameDay(saleDate, yesterday);
      } else if (dateFilter === "THIS_WEEK") {
        const day = now.getDay();
        const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), diffToMonday, 0, 0, 0, 0);
        matchesDate = saleDate >= startOfWeek;
      } else if (dateFilter === "THIS_MONTH") {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        matchesDate = saleDate >= startOfMonth;
      } else if (dateFilter === "LAST_30_DAYS") {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
        thirtyDaysAgo.setHours(0, 0, 0, 0);
        matchesDate = saleDate >= thirtyDaysAgo;
      }
    }

    return matchesSearch && matchesStatus && matchesDate;
  });

  // Calculate Summary metrics on filtered data
  const totalInvoices = filteredSales.length;
  const paidCount = filteredSales.filter((s) => s.paymentStatus === "PAID").length;
  const partialCount = filteredSales.filter((s) => s.paymentStatus === "PARTIAL").length;
  const unpaidCount = filteredSales.filter((s) => s.paymentStatus === "UNPAID").length;

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(totalInvoices / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedSales = filteredSales.slice(startIndex, startIndex + pageSize);

  const exportSalesToCsv = () => {
    if (filteredSales.length === 0) {
      alert("No sales invoices to export.");
      return;
    }

    const headers = [
      "Invoice Number",
      "Date",
      "Customer Name",
      "Total Amount",
      "Paid Amount",
      "Remaining Receivable",
      "Payment Status",
      "Payment Method",
      "Accounting Status",
    ];

    const rows = filteredSales.map((s) => [
      s.invoiceNumber,
      new Date(s.date).toLocaleDateString(),
      `"${(s.customerName || "").replace(/"/g, '""')}"`,
      Number(s.totalAmount || 0).toFixed(2),
      Number(s.paidAmount || 0).toFixed(2),
      Number(s.remainingAmount || 0).toFixed(2),
      s.paymentStatus || "PAID",
      s.paymentMethod || "CASH",
      s.status || "POSTED",
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Sales_Invoices_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Sales & Invoices</h2>
          <p className="text-xs text-slate-500">Track customer sales, payments, and receivables</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/sales/import"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition"
          >
            <UploadCloud className="h-3.5 w-3.5 text-indigo-600" />
            <span>Bulk Upload (CSV)</span>
          </Link>

          <button
            onClick={exportSalesToCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition"
          >
            <Download className="h-3.5 w-3.5 text-slate-600" />
            <span>Export CSV</span>
          </button>

          <Link href="/sales/create">
            <Button variant="primary" size="md">
              <Plus className="h-4 w-4 mr-1.5" />
              Create Sale Invoice
            </Button>
          </Link>
        </div>
      </div>

      {/* Active Branch Scope Indicator Banner */}
      <div className="flex items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-2.5 text-xs text-indigo-950 dark:border-indigo-900/50 dark:bg-indigo-950/20 dark:text-indigo-200">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <span>
            Current Outlet Scope:{" "}
            <strong>
              {isBranchLocked
                ? `${user?.branchName || "Assigned Outlet"} (Fixed Staff Access)`
                : effectiveBranch
                ? branches.find((b) => b.id === effectiveBranch)?.name || "Filtered Outlet"
                : "All Outlets (Consolidated Master View)"}
            </strong>
          </span>
        </div>
        {isBranchLocked ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
            🔒 Branch Restricted
          </span>
        ) : (
          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300">
            👑 Owner Multi-Outlet View
          </span>
        )}
      </div>

      {/* ── KPI Summary Cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpiCards.map((card) => {
          const cl = kpiColor[card.c];
          return (
            <div
              key={card.label}
              className={`relative overflow-hidden rounded-2xl border ${cl.border} ${cl.bg} p-4 shadow-xs transition hover:shadow-sm`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[11px] font-bold uppercase tracking-wide ${cl.lbl}`}>
                  {card.emoji} {card.label}
                </span>
                <span className={`rounded-lg px-1.5 py-0.5 text-[10px] font-bold ${cl.badge}`}>
                  {loading ? "…" : card.count} inv
                </span>
              </div>
              <p className={`text-xl font-extrabold tabular-nums leading-tight ${cl.val}`}>
                {loading ? "—" : formatMoney(card.amt)}
              </p>
              <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                Collected:{" "}
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {loading ? "—" : formatMoney(card.paid)}
                </span>
              </p>
              <p className={`mt-1.5 text-[10px] font-medium opacity-70 ${cl.lbl}`}>{card.urdu}</p>
            </div>
          );
        })}
      </div>

      {/* Enhanced Filters Bar with Date, Status & Quick Pills */}
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
        {/* Main Controls Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by invoice # or customer name..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 pl-9 pr-8 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            {search && (
              <button
                onClick={() => {
                  setSearch("");
                  setCurrentPage(1);
                }}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Quick Date Pills: Today, Yesterday, This Week, This Month */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
            {[
              { id: "ALL", label: "All Dates" },
              { id: "TODAY", label: "Today (آج)" },
              { id: "YESTERDAY", label: "Yesterday (کل)" },
              { id: "THIS_WEEK", label: "This Week (اس ہفتے)" },
              { id: "THIS_MONTH", label: "This Month (اس ماہ)" },
            ].map((tab) => {
              const isActive = dateFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setDateFilter(tab.id as any);
                    setCurrentPage(1);
                  }}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition whitespace-nowrap ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Dropdown Filters: Date Range + Payment Status */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Date:</span>
              <select
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">All Dates (تمام)</option>
                <option value="TODAY">Today (آج)</option>
                <option value="YESTERDAY">Yesterday (گزشتہ کل)</option>
                <option value="THIS_WEEK">This Week (اس ہفتے)</option>
                <option value="THIS_MONTH">This Month (اس ماہ)</option>
                <option value="LAST_30_DAYS">Last 30 Days (30 دن)</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Payment Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="PAID">Paid</option>
                <option value="PARTIAL">Partial</option>
                <option value="UNPAID">Unpaid (Credit)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Filter Summary Counter Pills & Reset */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span>
              Total Filtered: <strong className="text-slate-900 font-semibold">{totalInvoices}</strong>
            </span>
            <span className="h-3 w-px bg-slate-200" />
            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Paid: <strong className="font-semibold text-slate-900">{paidCount}</strong>
            </span>
            <span className="h-3 w-px bg-slate-200" />
            <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Partial: <strong className="font-semibold text-slate-900">{partialCount}</strong>
            </span>
            <span className="h-3 w-px bg-slate-200" />
            <span className="inline-flex items-center gap-1 text-rose-700 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              Unpaid: <strong className="font-semibold text-slate-900">{unpaidCount}</strong>
            </span>
          </div>

          {(search || statusFilter !== "ALL" || dateFilter !== "ALL") && (
            <button
              onClick={() => {
                setSearch("");
                setStatusFilter("ALL");
                setDateFilter("ALL");
                setCurrentPage(1);
              }}
              className="text-indigo-600 hover:text-indigo-800 font-semibold hover:underline"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Sales List Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Created By (بنایا گیا)</th>
                <th className="px-4 py-3 text-right">Total Amount</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3 text-center">Payment</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="px-4 py-3.5"><div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded-md" /></td>
                    <td className="px-4 py-3.5"><div className="h-4 w-18 bg-slate-100 dark:bg-slate-800/60 rounded" /></td>
                    <td className="px-4 py-3.5"><div className="h-4 w-36 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                    <td className="px-4 py-3.5"><div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                    <td className="px-4 py-3.5 text-right"><div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded ml-auto" /></td>
                    <td className="px-4 py-3.5 text-right"><div className="h-4 w-16 bg-slate-100 dark:bg-slate-800/60 rounded ml-auto" /></td>
                    <td className="px-4 py-3.5 text-right"><div className="h-4 w-16 bg-slate-100 dark:bg-slate-800/60 rounded ml-auto" /></td>
                    <td className="px-4 py-3.5 text-center"><div className="h-5 w-20 bg-slate-100 dark:bg-slate-800 rounded-full mx-auto" /></td>
                    <td className="px-4 py-3.5 text-center"><div className="h-5 w-16 bg-slate-100 dark:bg-slate-800 rounded-full mx-auto" /></td>
                    <td className="px-4 py-3.5 text-right"><div className="h-7 w-20 bg-slate-100 dark:bg-slate-800 rounded-lg ml-auto" /></td>
                  </tr>
                ))
              ) : paginatedSales.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-xs text-slate-400">
                    No sales invoices found matching your criteria. Try adjusting date or payment filters.
                  </td>
                </tr>
              ) : (
                paginatedSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      <div className="flex flex-col gap-1 items-start">
                        <Link href={`/sales/${sale.id}`} className="hover:underline text-blue-600 dark:text-blue-400 font-bold">
                          {sale.invoiceNumber}
                        </Link>
                        {sale.isEdited && (
                          <span
                            className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 cursor-help"
                            title={`⚠️ Edited invoice (${sale.editCount || 1}x)\nLast edited by: ${sale.updatedByName || "User"}\nReason: ${sale.editReason || "Modified"}\nDate: ${sale.updatedAt ? new Date(sale.updatedAt).toLocaleString() : ""}`}
                          >
                            <span>✏️ Edited</span>
                            {(sale.editCount || 1) > 1 && <span className="text-[9px]">({sale.editCount}x)</span>}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">{new Date(sale.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                      {sale.customerName}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                          {(sale.createdByName || "A").slice(0, 1).toUpperCase()}
                        </div>
                        <div className="leading-tight">
                          <p className="text-xs font-semibold text-slate-900 dark:text-white">
                            {sale.createdByName || "System Admin"}
                          </p>
                          {sale.isEdited && (
                            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                              ✏️ Edited by: {sale.updatedByName || "Admin"}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white tabular-nums">
                      {formatMoney(sale.totalAmount)}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-600 font-semibold tabular-nums">
                      {formatMoney(sale.paidAmount)}
                    </td>
                    <td className="px-4 py-3 text-right text-rose-600 font-semibold tabular-nums">
                      {formatMoney(sale.remainingAmount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        variant={
                          sale.paymentStatus === "PAID"
                            ? "success"
                            : sale.paymentStatus === "PARTIAL"
                            ? "warning"
                            : "danger"
                        }
                      >
                        {sale.paymentStatus}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={sale.status === "POSTED" ? "default" : "secondary"}>
                        {sale.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(sale)}
                          className="rounded-lg p-1.5 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-800 dark:hover:bg-indigo-950/40"
                          title="Edit Invoice Details (Record change in audit trail)"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <Link
                          href={`/sales/${sale.id}`}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                          title="View Invoice"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Link>
                        {sale.status === "POSTED" && (
                          <button
                            onClick={() => handleReverse(sale.id, sale.invoiceNumber)}
                            disabled={reversingId === sale.id}
                            className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40"
                            title="Return / Reverse Sale"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Responsive Pagination Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 bg-slate-50/80 text-xs text-slate-600">
          <div className="flex items-center gap-3">
            <div>
              Showing <strong className="text-slate-900">{totalInvoices === 0 ? 0 : startIndex + 1}</strong> to{" "}
              <strong className="text-slate-900">{Math.min(startIndex + pageSize, totalInvoices)}</strong> of{" "}
              <strong className="text-slate-900">{totalInvoices}</strong> invoices
            </div>
            <span className="hidden sm:inline-block h-3 w-px bg-slate-300" />
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          {/* Page Buttons */}
          <div className="flex items-center gap-1 self-center sm:self-auto">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={safeCurrentPage <= 1}
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed shadow-2xs transition"
              title="First Page"
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage <= 1}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed shadow-2xs transition"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Previous</span>
            </button>

            {/* Page Number Pills */}
            <div className="flex items-center gap-1 px-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => {
                  return (
                    p === 1 ||
                    p === totalPages ||
                    Math.abs(p - safeCurrentPage) <= 1
                  );
                })
                .map((p, idx, arr) => {
                  const prev = arr[idx - 1];
                  const hasGap = prev && p - prev > 1;
                  return (
                    <React.Fragment key={p}>
                      {hasGap && <span className="px-1 text-slate-400">...</span>}
                      <button
                        onClick={() => setCurrentPage(p)}
                        className={`min-w-[28px] h-7 rounded-lg text-xs font-semibold transition ${
                          safeCurrentPage === p
                            ? "bg-indigo-600 text-white shadow-xs"
                            : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  );
                })}
            </div>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage >= totalPages}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed shadow-2xs transition"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={safeCurrentPage >= totalPages}
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed shadow-2xs transition"
              title="Last Page"
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Edit Sale Invoice Modal with Audit Logging */}
      {editingSale && (
        <Modal
          isOpen={!!editingSale}
          onClose={() => setEditingSale(null)}
          title={`Edit Invoice #${editingSale.invoiceNumber}`}
        >
          <form onSubmit={handleSaveEdit} className="space-y-4">
            {/* Creator Attribution Info Card */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/50">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Original Creator (بنایا گیا بذریعہ):</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {editingSale.createdByName || "System Admin"}
                </span>
              </div>
              {editingSale.isEdited && (
                <div className="mt-1 flex items-center justify-between text-amber-700 dark:text-amber-300">
                  <span>Previous Edit ({editingSale.editCount || 1}x):</span>
                  <span className="font-medium">
                    By {editingSale.updatedByName || "Staff"}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Customer Name
              </label>
              <Input
                value={editCustomerName}
                onChange={(e) => setEditCustomerName(e.target.value)}
                placeholder="Customer Name"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Status
                </label>
                <select
                  value={editPaymentStatus}
                  onChange={(e) => setEditPaymentStatus(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="PAID">PAID (مکمل ادا)</option>
                  <option value="PARTIAL">PARTIAL (جزوی ادا)</option>
                  <option value="UNPAID">UNPAID (ادھار)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Paid Amount (Rs)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={editPaidAmount}
                  onChange={(e) => setEditPaidAmount(Number(e.target.value) || 0)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Invoice Notes
              </label>
              <Input
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Additional notes / comments..."
              />
            </div>

            {/* Required Audit Reason */}
            <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-3 dark:border-amber-800 dark:bg-amber-950/40">
              <label className="block text-xs font-bold text-amber-900 dark:text-amber-200 mb-1">
                Reason for Editing (ترمیم کی وجہ درج کرنا لازمی ہے) *
              </label>
              <p className="text-[11px] text-amber-700 dark:text-amber-400 mb-1.5">
                This modification will be permanently logged in the software Audit Trail along with your name.
              </p>
              <textarea
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="e.g. Corrected typo in customer name / received additional payment..."
                rows={2}
                required
                className="w-full rounded-lg border border-amber-300 bg-white p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-slate-900 dark:text-white dark:border-amber-700"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditingSale(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={editSaving}
              >
                Save Changes (ترمیم محفوظ کریں)
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
