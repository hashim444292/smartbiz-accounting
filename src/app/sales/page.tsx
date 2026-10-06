"use client";

import React, { useEffect, useState, useMemo } from "react";
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
  Trash2,
  CheckSquare,
  Square,
  Edit,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
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
  fbrStatus?: string;
  fbrInvoiceNumber?: string;
  fbrQrCode?: string;
  dueDate?: string;
  discountAmount?: number;
  subtotal?: number;
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
  const { t, language } = useLanguage();
  const isAccountingOnly =
    activeCompany?.packageType === "ACCOUNTING_ONLY" ||
    (activeCompany?.enabledModules && !activeCompany.enabledModules.includes("compliance"));
  const effectiveBranch = isBranchLocked ? user?.branchId : (selectedBranch?.id || activeBranchId || null);

  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [customerFilter, setCustomerFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState<"ALL" | "TODAY" | "YESTERDAY" | "THIS_WEEK" | "THIS_MONTH" | "LAST_30_DAYS" | "CUSTOM">("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reversingId, setReversingId] = useState<string | null>(null);
  const [deletingSaleId, setDeletingSaleId] = useState<string | null>(null);

  // Helper for date-only input formatting (YYYY-MM-DD, no time)
  const formatDateOnly = (d?: string | Date | null) => {
    if (!d) return "";
    const str = String(d);
    if (str.includes("T")) return str.split("T")[0];
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return "";
    return dt.toISOString().slice(0, 10);
  };

  // Edit Invoice State & User Tracking
  const [editingSale, setEditingSale] = useState<SaleRecord | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editPaymentMethod, setEditPaymentMethod] = useState("CASH");
  const [editTotalAmount, setEditTotalAmount] = useState<number>(0);
  const [editDiscountAmount, setEditDiscountAmount] = useState<number>(0);
  const [editPaymentStatus, setEditPaymentStatus] = useState<"PAID" | "PARTIAL" | "UNPAID">("PAID");
  const [editPaidAmount, setEditPaidAmount] = useState<number>(0);
  const [editFbrStatus, setEditFbrStatus] = useState("PENDING");
  const [editFbrInvoiceNumber, setEditFbrInvoiceNumber] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Bulk Selection & Actions State
  const [selectedSaleIds, setSelectedSaleIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [bulkEditDate, setBulkEditDate] = useState("");
  const [bulkEditCustomerName, setBulkEditCustomerName] = useState("");
  const [bulkEditPaymentMethod, setBulkEditPaymentMethod] = useState("");
  const [bulkEditPaymentStatus, setBulkEditPaymentStatus] = useState("");
  const [bulkEditNotes, setBulkEditNotes] = useState("");
  const [bulkEditReason, setBulkEditReason] = useState("");
  const [isBulkSaving, setIsBulkSaving] = useState(false);

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
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const dParam = params.get("date");
      if (dParam && ["ALL", "TODAY", "YESTERDAY", "THIS_WEEK", "THIS_MONTH", "LAST_30_DAYS", "CUSTOM"].includes(dParam)) {
        setDateFilter(dParam as any);
      }
    }
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

  const handleDeleteSale = async (sale: SaleRecord) => {
    const isTransmitted = sale.fbrStatus === "SUCCESS";
    const confirmPrompt = isTransmitted
      ? `انوائس #${sale.invoiceNumber} FBR سے منسلک ہے!\nکیا آپ واقعی اس انوائس کو مکمل ڈیلیٹ کرنا چاہتے ہیں؟\nاس سے گاہک کا لیجر اور انوینٹری اسٹاک خودکار طور پر بحال (reverse) ہو جائے گا۔`
      : `کیا آپ واقعی انوائس #${sale.invoiceNumber} کو مکمل ڈیلیٹ کرنا چاہتے ہیں؟\nاس سے انوینٹری اور کھاتہ خودکار ریورس ہو جائے گا۔`;

    if (!confirm(confirmPrompt)) return;

    setDeletingSaleId(sale.id);
    try {
      const res = await fetch(`/api/sales/${sale.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        alert(`انوائس #${sale.invoiceNumber} کامیابی سے ڈیلیٹ کر دی گئی ہے۔`);
        invalidateCache("/api/sales");
        invalidateCache("/api/products");
        invalidateCache("/api/dashboard");
        if (editingSale?.id === sale.id) {
          setEditingSale(null);
        }
        fetchSales();
      } else {
        alert(json.error || "انوائس ڈیلیٹ کرنے میں ناکامی ہوئی۔");
      }
    } catch (err: any) {
      alert(`خرابی: ${err.message}`);
    } finally {
      setDeletingSaleId(null);
    }
  };

  const handleToggleSelectSale = (id: string) => {
    setSelectedSaleIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAllSales = () => {
    const selectable = paginatedSales.map((s) => s.id);
    const allSelected = selectable.length > 0 && selectable.every((id) => selectedSaleIds.includes(id));
    if (allSelected) {
      setSelectedSaleIds((prev) => prev.filter((id) => !selectable.includes(id)));
    } else {
      setSelectedSaleIds((prev) => Array.from(new Set([...prev, ...selectable])));
    }
  };

  const handleBulkDeleteSales = async () => {
    if (selectedSaleIds.length === 0) return;
    const confirmPrompt = `کیا آپ واقعی منتخب کردہ ${selectedSaleIds.length} انوائسز کو مکمل ڈیلیٹ کرنا چاہتے ہیں؟\n\n- گاہک کا لیجر (Accounts Receivable) اور انوینٹری اسٹاک خودکار طور پر بحال (reverse) ہو جائے گا۔\n- اس عمل کو واپس نہیں لایا جا سکتا۔`;
    if (!confirm(confirmPrompt)) return;

    setIsBulkDeleting(true);
    try {
      const res = await fetch("/api/sales", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedSaleIds }),
      });
      const json = await res.json();
      if (json.success) {
        alert(`کامیابی سے ${json.deletedCount} انوائسز ڈیلیٹ کر دی گئیں۔`);
        setSelectedSaleIds([]);
        invalidateCache("/api/sales");
        invalidateCache("/api/products");
        invalidateCache("/api/dashboard");
        fetchSales();
      } else {
        alert(json.error || "بلک ڈیلیٹ میں خرابی پیش آئی۔");
      }
    } catch (err: any) {
      alert(`خرابی: ${err.message}`);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleBulkEditSales = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSaleIds.length === 0) return;

    const updates: any = {};
    if (bulkEditDate) updates.date = new Date(`${bulkEditDate}T12:00:00Z`).toISOString();
    if (bulkEditCustomerName.trim()) updates.customerName = bulkEditCustomerName.trim();
    if (bulkEditPaymentMethod) updates.paymentMethod = bulkEditPaymentMethod;
    if (bulkEditPaymentStatus) updates.paymentStatus = bulkEditPaymentStatus;
    if (bulkEditNotes.trim()) updates.notes = bulkEditNotes.trim();
    if (bulkEditReason.trim()) updates.editReason = bulkEditReason.trim();

    if (Object.keys(updates).length === 0) {
      alert("برائے مہربانی کم از کم ایک فیلڈ منتخب کریں جس میں ترمیم کرنی ہے۔");
      return;
    }

    if (!bulkEditReason.trim()) {
      alert("ترمیم کی وجہ درج کرنا لازمی ہے۔");
      return;
    }

    setIsBulkSaving(true);
    try {
      const res = await fetch("/api/sales", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedSaleIds, updates }),
      });
      const json = await res.json();
      if (json.success) {
        alert(`کامیابی سے ${json.updatedCount} انوائسز میں ترمیم کر دی گئی۔`);
        setShowBulkEditModal(false);
        setSelectedSaleIds([]);
        setBulkEditDate("");
        setBulkEditCustomerName("");
        setBulkEditPaymentMethod("");
        setBulkEditPaymentStatus("");
        setBulkEditNotes("");
        setBulkEditReason("");
        invalidateCache("/api/sales");
        invalidateCache("/api/dashboard");
        fetchSales();
      } else {
        alert(json.error || "بلک ایڈیٹ میں ناکامی ہوئی۔");
      }
    } catch (err: any) {
      alert(`خرابی: ${err.message}`);
    } finally {
      setIsBulkSaving(false);
    }
  };

  const openEditModal = (sale: SaleRecord) => {
    setEditingSale(sale);
    setEditDate(formatDateOnly(sale.date));
    setEditDueDate((sale as any).dueDate ? formatDateOnly((sale as any).dueDate) : "");
    setEditCustomerName(sale.customerName || "");
    setEditPaymentMethod(sale.paymentMethod || "CASH");
    setEditTotalAmount(Number(sale.totalAmount || 0));
    setEditDiscountAmount(Number(sale.discountAmount || 0));
    setEditPaymentStatus(sale.paymentStatus);
    setEditPaidAmount(Number(sale.paidAmount || 0));
    setEditFbrStatus(sale.fbrStatus || "PENDING");
    setEditFbrInvoiceNumber(sale.fbrInvoiceNumber || "");
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
          date: editDate ? new Date(`${editDate}T12:00:00Z`).toISOString() : editingSale.date,
          dueDate: editDueDate ? new Date(`${editDueDate}T12:00:00Z`).toISOString() : null,
          customerName: editCustomerName,
          paymentMethod: editPaymentMethod,
          totalAmount: editTotalAmount,
          discountAmount: editDiscountAmount,
          paidAmount: editPaidAmount,
          paymentStatus: editPaymentStatus,
          fbrStatus: editFbrStatus,
          fbrInvoiceNumber: editFbrInvoiceNumber.trim() || null,
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

  const customerList = useMemo(
    () => Array.from(new Set(sales.map((s) => s.customerName).filter(Boolean))),
    [sales]
  );

  // Filter Sales records
  const filteredSales = sales.filter((s) => {
    // 1. Search text filter
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      s.invoiceNumber.toLowerCase().includes(q) ||
      s.customerName.toLowerCase().includes(q) ||
      s.items?.some((it) => it.productName?.toLowerCase().includes(q));

    // 2. Customer filter
    const matchesCustomer =
      customerFilter === "ALL" || s.customerName.toLowerCase() === customerFilter.toLowerCase();

    // 3. Payment Status filter
    const matchesStatus = statusFilter === "ALL" || s.paymentStatus === statusFilter;

    // 4. Date Range filter (Today, Yesterday, This Week, This Month, Custom)
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
      } else if (dateFilter === "CUSTOM") {
        if (startDate) {
          const [y, m, d] = startDate.split("-").map(Number);
          const s = new Date(y, m - 1, d, 0, 0, 0);
          matchesDate = matchesDate && saleDate >= s;
        }
        if (endDate) {
          const [y, m, d] = endDate.split("-").map(Number);
          const e = new Date(y, m - 1, d, 23, 59, 59, 999);
          matchesDate = matchesDate && saleDate <= e;
        }
      }
    }

    return matchesSearch && matchesCustomer && matchesStatus && matchesDate;
  });

  // Calculate Summary metrics on filtered data
  const totalInvoices = filteredSales.length;
  const filteredTotalGross = useMemo(() => filteredSales.reduce((a, s) => a + Number(s.totalAmount || 0), 0), [filteredSales]);
  const filteredTotalPaid = useMemo(() => filteredSales.reduce((a, s) => a + Number(s.paidAmount || 0), 0), [filteredSales]);
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
      "Products Sold",
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
      `"${(s.items?.map((it) => `${it.productName} (x${it.quantity})`).join("; ") || "").replace(/"/g, '""')}"`,
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
      {/* Printable Report Header */}
      <div className="hidden print:block mb-6 border-b-2 border-slate-900 pb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-black text-slate-900">
              {activeCompany?.name || "SmartBiz Accounting"}
            </h1>
            <h2 className="text-lg font-bold text-slate-700 mt-0.5">Sales & Revenue Report</h2>
            <p className="text-xs text-slate-600 mt-1">
              <strong>Period:</strong>{" "}
              {dateFilter === "CUSTOM"
                ? `${startDate || "Start"} to ${endDate || "End"}`
                : dateFilter === "ALL"
                ? "All Recorded Transactions"
                : dateFilter.replace("_", " ")}{" "}
              | <strong>Status:</strong> {statusFilter} | <strong>Outlet:</strong>{" "}
              {user?.branchName || (effectiveBranch ? branches.find((b) => b.id === effectiveBranch)?.name : "All Outlets")}
            </p>
          </div>
          <div className="text-right border-l-2 border-slate-300 pl-4">
            <p className="text-xs text-slate-500">Generated: {new Date().toLocaleString()}</p>
            <p className="text-xs font-semibold text-slate-700 mt-1">Total Invoices: {totalInvoices}</p>
            <p className="text-sm font-black text-slate-900">
              Total Sales: Rs. {formatMoney(filteredTotalGross)}
            </p>
            <p className="text-xs font-bold text-emerald-700">
              Collected: Rs. {formatMoney(filteredTotalPaid)}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
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

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition"
            title="Print Sales Report for filtered period (سیلز رپورٹ پرنٹ کریں)"
          >
            <Printer className="h-3.5 w-3.5 text-slate-600" />
            <span>Print Sales Report</span>
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
      <div className="print:hidden flex items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-2.5 text-xs text-indigo-950 dark:border-indigo-900/50 dark:bg-indigo-950/20 dark:text-indigo-200">
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 print:hidden">
        {kpiCards.map((card) => {
          const cl = kpiColor[card.c];
          return (
            <div
              key={card.label}
              className={`relative overflow-hidden rounded-2xl border ${cl.border} ${cl.bg} p-4 shadow-xs transition hover:shadow-sm`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[11px] font-bold uppercase tracking-wide ${cl.lbl}`}>
                  {card.emoji} {language === "ur" ? card.urdu : card.label}
                </span>
                <span className={`rounded-lg px-1.5 py-0.5 text-[10px] font-bold ${cl.badge}`}>
                  {loading ? "…" : card.count} inv
                </span>
              </div>
              <p className={`text-xl font-extrabold tabular-nums leading-tight ${cl.val}`}>
                {loading ? "—" : formatMoney(card.amt)}
              </p>
              <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                {t("Collected:", "وصول شدہ:")}{" "}
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {loading ? "—" : formatMoney(card.paid)}
                </span>
              </p>
            </div>
          );
        })}
      </div>

      {/* Customer Spotlight & Summary Card */}
      {customerFilter !== "ALL" && (
        <div className="print:hidden rounded-2xl border-2 border-indigo-500/30 bg-indigo-50/60 p-4 shadow-sm dark:bg-indigo-950/30 dark:border-indigo-700/50">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase">
                  {t("Customer Summary", "گاہک تفصیلات")}
                </span>
                <span className="text-sm font-extrabold text-indigo-950 dark:text-indigo-100">
                  {customerFilter}
                </span>
              </div>
              <p className="mt-1 text-xs text-indigo-900/80 dark:text-indigo-200">
                {t("Invoices in filter:", "بلز:")} <strong>{filteredSales.length}</strong> | {t("Total Sales:", "کل سیلز:")}{" "}
                <strong>Rs {filteredSales.reduce((acc, s) => acc + Number(s.totalAmount || 0), 0).toLocaleString()}</strong> | {t("Collected:", "وصول:")}{" "}
                <strong>Rs {filteredSales.reduce((acc, s) => acc + Number(s.paidAmount || 0), 0).toLocaleString()}</strong>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-right mr-2">
                <div className="text-[10px] uppercase font-bold text-slate-500">
                  {t("Remaining Receivable", "بقیہ وصولی")}
                </div>
                <div className="text-base font-black text-rose-600 dark:text-rose-400">
                  Rs {filteredSales.reduce((acc, s) => acc + Number(s.remainingAmount || 0), 0).toLocaleString()}
                </div>
              </div>
              <Link
                href="/accounting?tab=LEDGER&type=CUSTOMER"
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition"
              >
                <span>{t("View Customer Ledger", "گاہک کا کھاتہ دیکھیں")}</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Filters Bar with Date, Status & Quick Pills */}
      <div className="print:hidden space-y-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
        {/* Main Controls Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={t("Search by invoice # or customer name...", "انوائس نمبر یا گاہک کا نام سرچ کریں...")}
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

          {/* Quick Date Pills: Today, Yesterday, This Week, This Month, Custom */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
            {[
              { id: "ALL", label: t("All Dates", "تمام تاریخیں") },
              { id: "TODAY", label: t("Today", "آج") },
              { id: "YESTERDAY", label: t("Yesterday", "گزشتہ کل") },
              { id: "THIS_WEEK", label: t("This Week", "اس ہفتے") },
              { id: "THIS_MONTH", label: t("This Month", "اس ماہ") },
              { id: "CUSTOM", label: t("Custom", "کسٹم") },
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

          {/* Dropdown Filters: Customer + Date Range + Payment Status */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Customer:</span>
              <select
                value={customerFilter}
                onChange={(e) => {
                  setCustomerFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">All Customers (تمام)</option>
                {customerList.map((c: any) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

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
                <option value="CUSTOM">Custom Date Range (کسٹم)</option>
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

        {/* Custom Date Pickers (Shown if CUSTOM selected) */}
        {dateFilter === "CUSTOM" && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500">تاریخ سے (From Date):</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500">تاریخ تک (To Date):</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
              />
            </div>
          </div>
        )}

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

      {/* Bulk Selection Actions Bar */}
      {selectedSaleIds.length > 0 && (
        <div className="print:hidden flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-indigo-500/40 bg-indigo-50/90 dark:bg-slate-800 dark:border-indigo-600/50 p-3.5 shadow-md animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white shadow-xs">
              {selectedSaleIds.length}
            </span>
            <span className="text-xs font-bold text-indigo-950 dark:text-indigo-100">
              Invoices Selected (منتخب انوائسز)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowBulkEditModal(true)}
              className="bg-white border-indigo-300 text-indigo-700 hover:bg-indigo-50 dark:bg-slate-900 dark:text-indigo-300 dark:border-indigo-700 text-xs shadow-2xs"
            >
              <Edit className="h-3.5 w-3.5 mr-1.5" />
              Bulk Edit ({selectedSaleIds.length})
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleBulkDeleteSales}
              isLoading={isBulkDeleting}
              className="bg-white border-rose-300 text-rose-700 hover:bg-rose-50 dark:bg-slate-900 dark:text-rose-400 dark:border-rose-800 text-xs shadow-2xs"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5 text-rose-600" />
              Delete Selected ({selectedSaleIds.length})
            </Button>

            <button
              type="button"
              onClick={() => setSelectedSaleIds([])}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200/60 dark:hover:bg-slate-700"
              title="Clear selection"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Sales List Table (Screen View with Pagination) */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 print:hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
              <tr>
                <th className="py-3 px-3 w-8 text-center print:hidden">
                  <button
                    type="button"
                    onClick={handleToggleSelectAllSales}
                    className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    title="Select all on this page"
                  >
                    {paginatedSales.length > 0 && paginatedSales.every((s) => selectedSaleIds.includes(s.id)) ? (
                      <CheckSquare className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Products Sold (اشیاء)</th>
                <th className="px-4 py-3">Created By (بنایا گیا)</th>
                <th className="px-4 py-3 text-right">Total Amount</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3 text-center">Payment</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right print:hidden">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="px-3 py-3.5 print:hidden"><div className="h-4 w-4 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                    <td className="px-4 py-3.5"><div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded-md" /></td>
                    <td className="px-4 py-3.5"><div className="h-4 w-18 bg-slate-100 dark:bg-slate-800/60 rounded" /></td>
                    <td className="px-4 py-3.5"><div className="h-4 w-36 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                    <td className="px-4 py-3.5"><div className="h-4 w-32 bg-slate-100 dark:bg-slate-800/60 rounded" /></td>
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
                  <td colSpan={12} className="py-8 text-center text-xs text-slate-400">
                    No sales invoices found matching your criteria. Try adjusting date or payment filters.
                  </td>
                </tr>
              ) : (
                paginatedSales.map((sale) => {
                  const isSelected = selectedSaleIds.includes(sale.id);
                  return (
                  <tr
                    key={sale.id}
                    className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors ${
                      isSelected ? "bg-indigo-50/40 dark:bg-indigo-950/30" : ""
                    }`}
                  >
                    <td className="py-3 px-3 text-center print:hidden">
                      <button
                        type="button"
                        onClick={() => handleToggleSelectSale(sale.id)}
                        className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      >
                        {isSelected ? (
                          <CheckSquare className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      <div className="flex flex-col gap-1 items-start">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Link href={`/sales/${sale.id}`} className="hover:underline text-blue-600 dark:text-blue-400 font-bold">
                            {sale.invoiceNumber}
                          </Link>
                          {!isAccountingOnly && sale.fbrStatus && (
                            sale.fbrStatus === "SUCCESS" ? (
                              <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                                🏛️ FBR Sync
                              </span>
                            ) : sale.fbrStatus === "PENDING" ? (
                              <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
                                ⏳ FBR Queue
                              </span>
                            ) : sale.fbrStatus === "NOT_APPLICABLE" ? (
                              <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                                🏠 Local Sale
                              </span>
                            ) : null
                          )}
                        </div>
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
                    <td className="px-4 py-3 min-w-[180px]">
                      {sale.items && sale.items.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {sale.items.map((item, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-xs">
                              <span className="font-bold text-slate-900 dark:text-white">
                                {item.productName || "Product"}
                              </span>
                              <span className="rounded bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.2 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 shrink-0">
                                {Number(item.quantity || 1)} pcs
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs italic">—</span>
                      )}
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
                    <td className="px-4 py-3 text-right print:hidden">
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
                        <Link
                          href={`/sales/${sale.id}?print=true`}
                          target="_blank"
                          className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-800 dark:hover:bg-emerald-950/40"
                          title="Print Invoice / Receipt (انوائس پرنٹ کریں)"
                        >
                          <Printer className="h-3.5 w-3.5" />
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
                        <button
                          onClick={() => handleDeleteSale(sale)}
                          disabled={deletingSaleId === sale.id}
                          className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-100/70 hover:text-rose-800 dark:hover:bg-rose-950/50"
                          title="Delete Invoice (مکمل ڈیلیٹ کریں)"
                        >
                          <Trash2 className={`h-3.5 w-3.5 ${deletingSaleId === sale.id ? "animate-spin" : ""}`} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Responsive Pagination Bar */}
        <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 bg-slate-50/80 text-xs text-slate-600">
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

      {/* ── Complete Dedicated Printable Sales Register Table (Includes ALL Filtered Invoices, No Pagination Clipping) ── */}
      <div className="hidden print:block">
        <table className="w-full text-left text-[11px] border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-900 bg-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-800">
              <th className="py-2 px-2 text-center w-8">#</th>
              <th className="py-2 px-2">Invoice #</th>
              <th className="py-2 px-2">Date</th>
              <th className="py-2 px-2">Customer</th>
              <th className="py-2 px-2">Items Detail</th>
              <th className="py-2 px-2 text-right">Total (Rs)</th>
              <th className="py-2 px-2 text-right">Paid (Rs)</th>
              <th className="py-2 px-2 text-right">Balance (Rs)</th>
              <th className="py-2 px-2 text-center">Payment</th>
              <th className="py-2 px-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300">
            {filteredSales.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-6 text-center text-slate-500 italic">
                  No sales invoices found for the selected period / filters.
                </td>
              </tr>
            ) : (
              filteredSales.map((sale, idx) => (
                <tr key={sale.id} className="break-inside-avoid">
                  <td className="py-1.5 px-2 text-center font-bold text-slate-500 text-[10px]">
                    {idx + 1}
                  </td>
                  <td className="py-1.5 px-2 font-black text-slate-900 whitespace-nowrap">
                    {sale.invoiceNumber}
                  </td>
                  <td className="py-1.5 px-2 text-slate-700 whitespace-nowrap">
                    {new Date(sale.date).toLocaleDateString()}
                  </td>
                  <td className="py-1.5 px-2 font-semibold text-slate-900">
                    {sale.customerName}
                  </td>
                  <td className="py-1.5 px-2 text-slate-700 max-w-[200px]">
                    {sale.items && sale.items.length > 0
                      ? sale.items.map((it) => `${it.productName || "Product"} (${Number(it.quantity || 1)})`).join(", ")
                      : "—"}
                  </td>
                  <td className="py-1.5 px-2 text-right font-black text-slate-900 tabular-nums whitespace-nowrap">
                    {formatMoney(sale.totalAmount)}
                  </td>
                  <td className="py-1.5 px-2 text-right font-bold text-emerald-800 tabular-nums whitespace-nowrap">
                    {formatMoney(sale.paidAmount)}
                  </td>
                  <td className="py-1.5 px-2 text-right font-bold text-rose-800 tabular-nums whitespace-nowrap">
                    {formatMoney(sale.remainingAmount)}
                  </td>
                  <td className="py-1.5 px-2 text-center font-bold text-[9px] uppercase whitespace-nowrap">
                    {sale.paymentStatus}
                  </td>
                  <td className="py-1.5 px-2 text-center font-bold text-[9px] uppercase whitespace-nowrap">
                    {sale.status}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-900 bg-slate-100 font-black text-slate-900 text-[11px]">
              <td colSpan={5} className="py-2.5 px-2 text-right uppercase">
                Grand Summary ({filteredSales.length} Invoices Filtered):
              </td>
              <td className="py-2.5 px-2 text-right tabular-nums whitespace-nowrap">
                Rs. {formatMoney(filteredTotalGross)}
              </td>
              <td className="py-2.5 px-2 text-right tabular-nums whitespace-nowrap text-emerald-800">
                Rs. {formatMoney(filteredTotalPaid)}
              </td>
              <td className="py-2.5 px-2 text-right tabular-nums whitespace-nowrap text-rose-800">
                Rs. {formatMoney(Math.max(0, filteredTotalGross - filteredTotalPaid))}
              </td>
              <td colSpan={2} className="py-2.5 px-2 text-center text-[10px] text-slate-600">
                End of Report
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Edit Sale Invoice Modal with Audit Logging */}
      {editingSale && (
        <Modal
          isOpen={!!editingSale}
          onClose={() => setEditingSale(null)}
          title={`Edit Invoice #${editingSale.invoiceNumber}`}
          maxWidth="2xl"
        >
          <form onSubmit={handleSaveEdit} className="space-y-4 max-h-[78vh] overflow-y-auto pr-1">
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

            {/* 1. Date & Due Date Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Invoice Date (انوائس کی تاریخ) *
                </label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Due Date (ادھار واجب الادا تاریخ)
                </label>
                <input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                />
              </div>
            </div>

            {/* 2. Customer Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Customer Name (گاہک کا نام) *
              </label>
              <Input
                value={editCustomerName}
                onChange={(e) => setEditCustomerName(e.target.value)}
                placeholder="Customer Name"
                required
              />
            </div>

            {/* 3. Amounts Row (Total, Discount, Payment Method) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Grand Total (Rs) *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={editTotalAmount}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0;
                    setEditTotalAmount(val);
                    if (editPaidAmount >= val && val > 0) setEditPaymentStatus("PAID");
                    else if (editPaidAmount > 0) setEditPaymentStatus("PARTIAL");
                    else setEditPaymentStatus("UNPAID");
                  }}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Discount (Rs)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={editDiscountAmount}
                  onChange={(e) => setEditDiscountAmount(Number(e.target.value) || 0)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Method
                </label>
                <select
                  value={editPaymentMethod}
                  onChange={(e) => setEditPaymentMethod(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                >
                  <option value="CASH">CASH (نقد)</option>
                  <option value="BANK_TRANSFER">Bank Transfer (بینک)</option>
                  <option value="ONLINE">Online / Card (آن لائن)</option>
                  <option value="CHEQUE">Cheque (چیک)</option>
                  <option value="CREDIT">Credit / Udhaar (ادھار)</option>
                </select>
              </div>
            </div>

            {/* 4. Payment Settlement Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Paid Amount (Rs) *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={editPaidAmount}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0;
                    setEditPaidAmount(val);
                    if (val >= editTotalAmount && editTotalAmount > 0) setEditPaymentStatus("PAID");
                    else if (val > 0) setEditPaymentStatus("PARTIAL");
                    else setEditPaymentStatus("UNPAID");
                  }}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Status
                </label>
                <select
                  value={editPaymentStatus}
                  onChange={(e) => setEditPaymentStatus(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                >
                  <option value="PAID">PAID (مکمل ادا)</option>
                  <option value="PARTIAL">PARTIAL (جزوی ادا)</option>
                  <option value="UNPAID">UNPAID (ادھار)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Remaining Receivable (بقایا)
                </label>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono font-bold text-rose-600 dark:border-slate-800 dark:bg-slate-800/60">
                  Rs {Math.max(0, editTotalAmount - editPaidAmount).toLocaleString()}
                </div>
              </div>
            </div>

            {/* 5. FBR Compliance Info */}
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 space-y-2 dark:border-blue-900/50 dark:bg-blue-950/20">
              <span className="block text-[11px] font-bold text-blue-900 dark:text-blue-200 uppercase tracking-wider">
                FBR Statutory & POS Info (ایف بی آر تفصیلات)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    FBR Status
                  </label>
                  <select
                    value={editFbrStatus}
                    onChange={(e) => setEditFbrStatus(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                  >
                    <option value="PENDING">PENDING (منتظر)</option>
                    <option value="SUCCESS">SUCCESS (کامیاب)</option>
                    <option value="FAILED">FAILED (ناکام)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    FBR Official Invoice Number
                  </label>
                  <Input
                    value={editFbrInvoiceNumber}
                    onChange={(e) => setEditFbrInvoiceNumber(e.target.value)}
                    placeholder="e.g. 201327FJ5V3432560"
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            {/* 6. Invoice Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Invoice Notes / Remarks
              </label>
              <Input
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Additional notes / comments..."
              />
            </div>

            {/* 7. Required Audit Reason */}
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
                placeholder="e.g. Corrected invoice date / customer name typo / adjusted payment..."
                rows={2}
                required
                className="w-full rounded-lg border border-amber-300 bg-white p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-slate-900 dark:text-white dark:border-amber-700"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 text-xs"
                onClick={() => handleDeleteSale(editingSale)}
                disabled={deletingSaleId === editingSale.id}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Delete Invoice (انوائس ڈیلیٹ کریں)
              </Button>

              <div className="flex items-center gap-2">
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
            </div>
          </form>
        </Modal>
      )}

      {/* Bulk Edit Modal */}
      {showBulkEditModal && (
        <Modal
          isOpen={showBulkEditModal}
          onClose={() => setShowBulkEditModal(false)}
          title={`Bulk Edit Invoices (${selectedSaleIds.length} Selected)`}
          maxWidth="lg"
        >
          <form onSubmit={handleBulkEditSales} className="space-y-4">
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3 text-xs text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200">
              <p className="font-semibold mb-1">
                آپ بیک وقت {selectedSaleIds.length} انوائسز میں تبدیلیاں کر رہے ہیں۔
              </p>
              <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
                جس فیلڈ کو آپ خالی چھوڑیں گے اس میں کوئی تبدیلی نہیں ہوگی۔ صرف مطلوبہ فیلڈز کو پر کریں۔
              </p>
            </div>

            {/* 1. Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                New Invoice Date (نئی تاریخ - اختیاری)
              </label>
              <input
                type="date"
                value={bulkEditDate}
                onChange={(e) => setBulkEditDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
              />
            </div>

            {/* 2. Customer Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                New Customer Name (گاہک کا نام - اختیاری)
              </label>
              <Input
                value={bulkEditCustomerName}
                onChange={(e) => setBulkEditCustomerName(e.target.value)}
                placeholder="Leave blank to keep existing customer names"
              />
            </div>

            {/* 3. Payment Method & Payment Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Method (طریقہ ادائیگی)
                </label>
                <select
                  value={bulkEditPaymentMethod}
                  onChange={(e) => setBulkEditPaymentMethod(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                >
                  <option value="">(تبدیل نہ کریں - Keep Existing)</option>
                  <option value="CASH">CASH (نقد)</option>
                  <option value="BANK">BANK (بینک)</option>
                  <option value="ONLINE">ONLINE (آن لائن)</option>
                  <option value="CHEQUE">CHEQUE (چیک)</option>
                  <option value="CREDIT">CREDIT (ادھار)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Status (ادائیگی کی صورتحال)
                </label>
                <select
                  value={bulkEditPaymentStatus}
                  onChange={(e) => setBulkEditPaymentStatus(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                >
                  <option value="">(تبدیل نہ کریں - Keep Existing)</option>
                  <option value="PAID">PAID (مکمل ادا شدہ)</option>
                  <option value="PARTIAL">PARTIAL (جزوی ادائیگی)</option>
                  <option value="UNPAID">UNPAID (غیر ادا شدہ / ادھار)</option>
                </select>
              </div>
            </div>

            {/* 4. Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Invoice Notes (ریمارکس - اختیاری)
              </label>
              <Input
                value={bulkEditNotes}
                onChange={(e) => setBulkEditNotes(e.target.value)}
                placeholder="Leave blank to keep existing notes"
              />
            </div>

            {/* 5. Audit Reason (Required) */}
            <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-3 dark:border-amber-800 dark:bg-amber-950/40">
              <label className="block text-xs font-bold text-amber-900 dark:text-amber-200 mb-1">
                Reason for Bulk Edit (بلک ترمیم کی وجہ درج کریں) *
              </label>
              <textarea
                value={bulkEditReason}
                onChange={(e) => setBulkEditReason(e.target.value)}
                placeholder="مثال: تاریخ درست کی گئی، غلط کسٹمر اپڈیٹ کیا گیا، وغیرہ..."
                rows={2}
                required
                className="w-full rounded-lg border border-amber-300 bg-white p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-slate-900 dark:text-white dark:border-amber-700"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowBulkEditModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={isBulkSaving}
              >
                Apply to {selectedSaleIds.length} Invoices
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
