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
  ShieldCheck,
  UserPlus,
  Users,
  Lock,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { SalesReturnModal } from "@/components/sales/SalesReturnModal";
import { SalesEditModal } from "@/components/sales/SalesEditModal";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { smartFetch, invalidateCache, useAutoSync } from "@/lib/clientCache";
import { extractCreditNoteInfo } from "@/lib/fbrRowActions";

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
  isPartialReturn?: boolean;
  totalReturnedAmount?: number;
  hasReturnableItems?: boolean;
  returnHistory?: any[];
  items: Array<{
    id?: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    returnedQuantity?: number;
    remainingQuantity?: number;
    taxRate?: number;
    taxAmount?: number;
    costPrice?: number;
    productId?: string;
    uom?: string;
    product?: any;
  }>;
}

export default function SalesPage() {
  const { user, activeCompany, branches, selectedBranch, activeBranchId, isBranchLocked } = useAuth();
  const { t, language } = useLanguage();
  const isAccountingOnly =
    activeCompany?.packageType === "ACCOUNTING_ONLY" ||
    (activeCompany?.enabledModules && !activeCompany.enabledModules.includes("compliance"));
  const isDigitalInvoicing = activeCompany?.integrationType === "DIGITAL_INVOICING";
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
  const [returnModalSale, setReturnModalSale] = useState<any | null>(null);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);

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

  // Bulk Selection & Actions State
  const [selectedSaleIds, setSelectedSaleIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [bulkEditDate, setBulkEditDate] = useState("");
  const [bulkEditCustomerName, setBulkEditCustomerName] = useState("");
  const [bulkEditPaymentMethod, setBulkEditPaymentMethod] = useState("");
  const [bulkEditPaymentStatus, setBulkEditPaymentStatus] = useState("");
  const [bulkEditFbrStatus, setBulkEditFbrStatus] = useState("");
  const [bulkEditNotes, setBulkEditNotes] = useState("");
  const [bulkEditReason, setBulkEditReason] = useState("");
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [transmittingFbrId, setTransmittingFbrId] = useState<string | null>(null);
  const [isBulkTransmittingFbr, setIsBulkTransmittingFbr] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); // 10 or 15 default entries

  const fetchSales = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (activeCompany?.id) headers["x-business-id"] = activeCompany.id;
      if (effectiveBranch) headers["x-branch-id"] = effectiveBranch;
      const query = effectiveBranch ? `?branchId=${effectiveBranch}` : "?branchId=all";

      const json = await smartFetch(`/api/sales${query}`, { headers, ttlMs: isSilent ? 0 : 2000, skipCache: isSilent });
      if (json.success) {
        setSales(json.data);
      }
    } catch (err) {
      console.error("Failed to load sales:", err);
    } finally {
      if (!isSilent) setLoading(false);
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

  // Real-time silent auto-sync for sales list
  useAutoSync((opts) => {
    fetchSales(opts?.silent ?? true);
  });

  const handleReverse = async (id: string, invoiceNumber: string, isFbrPos = false) => {
    const confirmPrompt = isFbrPos
      ? (language === "ur"
          ? `انوائس #${invoiceNumber} FBR POS سے منظور شدہ ہے۔ اسے ریورس کرنے پر باقاعدہ FBR Credit Note (InvoiceType 3) جاری ہوگا، مال گودام میں بحال ہوگا اور کھاتہ ایڈجسٹ ہو جائے گا۔ کیا آپ جاری رکھنا چاہتے ہیں؟`
          : `Sale invoice #${invoiceNumber} is stamped with FBR POS. Returning this will issue an official FBR Credit Note (InvoiceType 3), restock inventory items, and adjust customer khata balance. Do you want to proceed?`)
      : (language === "ur"
          ? `کیا آپ واقعی سیل انوائس #${invoiceNumber} واپس (reverse) کرنا چاہتے ہیں؟ اس سے مال گودام میں واپس آ جائے گا اور کھاتہ ایڈجسٹ ہو جائے گا۔`
          : `Are you sure you want to return sale invoice #${invoiceNumber}? This will restock items and balance receivables.`);

    if (!confirm(confirmPrompt)) {
      return;
    }
    setReversingId(id);
    try {
      const res = await fetch(`/api/sales/${id}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: isFbrPos ? "FBR POS Credit Note / Customer Return" : "Customer return / cancellation requested by user" }),
      });
      const json = await res.json();
      if (json.success) {
        const msg = json.isPosCreditNote
          ? (language === "ur"
              ? "سیل کامیابی سے واپس ہو گئی اور FBR Credit Note جاری کر دیا گیا!"
              : "Sale returned successfully and FBR Credit Note issued!")
          : (language === "ur"
              ? "سیل کامیابی سے واپس ہو گئی اور مال گودام میں بحال کر دیا گیا۔"
              : "Sale returned successfully and items restocked.");
        alert(msg);
        invalidateCache("/api/sales");
        invalidateCache("/api/products");
        invalidateCache("/api/dashboard");
        fetchSales();
      } else {
        alert(`Failed to return sale: ${json.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setReversingId(null);
    }
  };

  const handleInitiateReturn = (sale: any) => {
    const isFbrPos = sale.fbrStatus === "SUCCESS" && Boolean(sale.fbrInvoiceNumber) && !sale.fbrInvoiceNumber.includes("DI");
    if (isFbrPos) {
      handleReverse(sale.id, sale.invoiceNumber, true);
    } else {
      setReturnModalSale(sale);
      setIsReturnModalOpen(true);
    }
  };

  const handleReturnSuccess = (result: any) => {
    const msg = language === "ur"
      ? (result.isFullReturn
          ? "مکمل سیل کامیابی سے واپس ہو گئی اور تمام اشیاء گودام میں بحال ہو گئیں۔"
          : `کامیابی سے ${result.returnedItemsCount || "منتخب"} اشیاء واپس کر دی گئیں اور کھاتہ ایڈجسٹ ہو گیا۔`)
      : (result.isFullReturn
          ? "Sale invoice fully reversed and all items restocked."
          : `Successfully returned ${result.returnedItemsCount || "selected"} item(s). Accounts and inventory updated.`);
    alert(msg);
    invalidateCache("/api/sales");
    invalidateCache("/api/products");
    invalidateCache("/api/dashboard");
    fetchSales();
  };

  const handleDeleteSale = async (sale: SaleRecord) => {
    const isTransmitted = sale.fbrStatus === "SUCCESS" || Boolean(sale.fbrInvoiceNumber);
    if (isTransmitted) {
      alert(
        language === "ur"
          ? `انوائس #${sale.invoiceNumber} FBR سے منظور شدہ ہے (FBR Ref: ${sale.fbrInvoiceNumber || ""})۔ قانونی طور پر FBR سینک انوائس کو ڈیلیٹ کرنا سختی سے ممنوع ہے۔`
          : `Invoice #${sale.invoiceNumber} is registered on FBR (${sale.fbrInvoiceNumber || ""}). Statutory compliance strictly prohibits deleting FBR registered invoices.`
      );
      return;
    }

    const confirmPrompt = language === "ur"
      ? `کیا آپ واقعی انوائس #${sale.invoiceNumber} کو مکمل ڈیلیٹ کرنا چاہتے ہیں؟\nاس سے انوینٹری اور کھاتہ خودکار ریورس ہو جائے گا۔`
      : `Are you sure you want to delete invoice #${sale.invoiceNumber}?\nThis will automatically reverse inventory and ledger entries.`;

    if (!confirm(confirmPrompt)) return;

    setDeletingSaleId(sale.id);
    try {
      const res = await fetch(`/api/sales/${sale.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        alert(language === "ur" ? `انوائس #${sale.invoiceNumber} کامیابی سے ڈیلیٹ کر دی گئی ہے۔` : `Invoice #${sale.invoiceNumber} deleted successfully.`);
        invalidateCache("/api/sales");
        invalidateCache("/api/products");
        invalidateCache("/api/dashboard");
        if (editingSale?.id === sale.id) {
          setEditingSale(null);
        }
        fetchSales();
      } else {
        alert(json.error || (language === "ur" ? "انوائس ڈیلیٹ کرنے میں ناکامی ہوئی۔" : "Failed to delete invoice."));
      }
    } catch (err: any) {
      alert(`${language === "ur" ? "خرابی" : "Error"}: ${err.message}`);
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

    const selectedSales = sales.filter((s) => selectedSaleIds.includes(s.id));
    const syncedSales = selectedSales.filter((s) => s.fbrStatus === "SUCCESS" || Boolean(s.fbrInvoiceNumber));
    const deletableIds = selectedSales
      .filter((s) => s.fbrStatus !== "SUCCESS" && !Boolean(s.fbrInvoiceNumber))
      .map((s) => s.id);

    if (deletableIds.length === 0) {
      alert(
        language === "ur"
          ? "تمام منتخب کردہ انوائسز FBR پر رجسٹرڈ ہیں۔ قانونی طور پر FBR سینک انوائسز کو ڈیلیٹ کرنا سختی سے ممنوع ہے۔"
          : "All selected invoices are synchronized with FBR. Statutory compliance strictly prohibits deleting FBR registered invoices."
      );
      return;
    }

    if (syncedSales.length > 0) {
      const proceed = confirm(
        language === "ur"
          ? `نوٹ: ${syncedSales.length} FBR سینک انوائسز محفوظ رکھی گئی ہیں اور ڈیلیٹ نہیں ہو سکتیں۔ صرف باقی ${deletableIds.length} ان-سینک انوائسز ڈیلیٹ ہوں گی۔ کیا آپ جاری رکھنا چاہتے ہیں؟`
          : `Note: ${syncedSales.length} FBR-synchronized invoice(s) are protected and cannot be deleted. Only the remaining ${deletableIds.length} unstamped invoice(s) will be deleted. Do you want to proceed?`
      );
      if (!proceed) return;
    } else {
      const confirmPrompt = language === "ur"
        ? `کیا آپ واقعی منتخب کردہ ${deletableIds.length} انوائسز کو مکمل ڈیلیٹ کرنا چاہتے ہیں؟\n\n- گاہک کا لیجر (Accounts Receivable) اور انوینٹری اسٹاک خودکار طور پر بحال (reverse) ہو جائے گا۔\n- اس عمل کو واپس نہیں لایا جا سکتا۔`
        : `Are you sure you want to permanently delete ${deletableIds.length} selected invoices?\n\n- Customer ledger and inventory will be automatically reversed.\n- This action cannot be undone.`;
      if (!confirm(confirmPrompt)) return;
    }

    setIsBulkDeleting(true);
    try {
      const res = await fetch("/api/sales", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: deletableIds }),
      });
      const json = await res.json();
      if (json.success) {
        alert(language === "ur" ? `کامیابی سے ${json.deletedCount} انوائسز ڈیلیٹ کر دی گئیں۔` : `Successfully deleted ${json.deletedCount} invoices.`);
        setSelectedSaleIds([]);
        invalidateCache("/api/sales");
        invalidateCache("/api/products");
        invalidateCache("/api/dashboard");
        fetchSales();
      } else {
        alert(json.error || (language === "ur" ? "بلک ڈیلیٹ میں خرابی پیش آئی۔" : "Bulk delete failed."));
      }
    } catch (err: any) {
      alert(`${language === "ur" ? "خرابی" : "Error"}: ${err.message}`);
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
    if (bulkEditFbrStatus) updates.fbrStatus = bulkEditFbrStatus;
    if (bulkEditNotes.trim()) updates.notes = bulkEditNotes.trim();
    if (bulkEditReason.trim()) updates.editReason = bulkEditReason.trim();

    if (Object.keys(updates).length === 0) {
      alert(language === "ur" ? "برائے مہربانی کم از کم ایک فیلڈ منتخب کریں جس میں ترمیم کرنی ہے۔" : "Please select at least one field to edit.");
      return;
    }

    if (!bulkEditReason.trim()) {
      alert(language === "ur" ? "ترمیم کی وجہ درج کرنا لازمی ہے۔" : "Reason for editing is required.");
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
        alert(language === "ur" ? `کامیابی سے ${json.updatedCount} انوائسز میں ترمیم کر دی گئی۔` : `Successfully updated ${json.updatedCount} invoices.`);
        setShowBulkEditModal(false);
        setSelectedSaleIds([]);
        setBulkEditDate("");
        setBulkEditCustomerName("");
        setBulkEditPaymentMethod("");
        setBulkEditPaymentStatus("");
        setBulkEditFbrStatus("");
        setBulkEditNotes("");
        setBulkEditReason("");
        invalidateCache("/api/sales");
        invalidateCache("/api/dashboard");
        invalidateCache("/api/compliance/fbr");
        fetchSales();
      } else {
        alert(json.error || (language === "ur" ? "بلک ایڈیٹ میں ناکامی ہوئی۔" : "Bulk edit failed."));
      }
    } catch (err: any) {
      alert(`${language === "ur" ? "خرابی" : "Error"}: ${err.message}`);
    } finally {
      setIsBulkSaving(false);
    }
  };

  const handleTransmitSingleToFbr = async (sale: SaleRecord) => {
    if (sale.paymentStatus !== "PAID") {
      alert(
        language === "ur"
          ? `انوائس #${sale.invoiceNumber} ابھی مکمل ادا (PAID) نہیں ہے۔ FBR قواعد کے مطابق نامکمل ادا شدہ یا ادھار انوائس کو بھیجنے سے پہلے مکمل ادائیگی درج کریں۔`
          : `Invoice #${sale.invoiceNumber} is not fully paid. FBR regulations require invoices to be fully paid before transmission.`
      );
      return;
    }

    const confirmMsg =
      language === "ur"
        ? `کیا آپ انوائس #${sale.invoiceNumber} کو FBR پر براہ راست منتقل / transmit کرنا چاہتے ہیں؟`
        : `Do you want to transmit invoice #${sale.invoiceNumber} to FBR now?`;
    if (!confirm(confirmMsg)) return;

    setTransmittingFbrId(sale.id);
    try {
      const res = await fetch("/api/compliance/fbr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "transmit", invoiceId: sale.id }),
      });
      const json = await res.json();
      if (json.success) {
        alert(
          language === "ur"
            ? `انوائس #${sale.invoiceNumber} کامیابی سے FBR پر منتقل ہو گئی!\nFBR انوائس نمبر: ${json.data?.fbrInvoiceNumber || ""}`
            : `Invoice #${sale.invoiceNumber} transmitted to FBR successfully!\nFBR Invoice #: ${json.data?.fbrInvoiceNumber || ""}`
        );
        invalidateCache("/api/sales");
        invalidateCache("/api/dashboard");
        invalidateCache("/api/compliance/fbr");
        fetchSales();
      } else {
        alert(json.error || json.message || (language === "ur" ? "FBR پر ٹرانسمیشن میں ناکامی ہوئی۔" : "Failed to transmit invoice to FBR"));
      }
    } catch (err: any) {
      alert(`${language === "ur" ? "خرابی" : "Error"}: ${err.message}`);
    } finally {
      setTransmittingFbrId(null);
    }
  };

  const handleBulkTransmitToFbr = async () => {
    if (selectedSaleIds.length === 0) return;

    const selectedSales = sales.filter((s) => selectedSaleIds.includes(s.id));
    const nonSuccessSales = selectedSales.filter((s) => s.fbrStatus !== "SUCCESS");

    if (nonSuccessSales.length === 0) {
      alert(
        language === "ur"
          ? "تمام منتخب کردہ انوائسز پہلے سے ہی FBR پر منتقل اور تصدیق شدہ (SUCCESS) ہیں۔"
          : "All selected invoices have already been successfully transmitted to FBR."
      );
      return;
    }

    const unPaidSales = nonSuccessSales.filter((s) => s.paymentStatus !== "PAID");
    const eligibleSales = nonSuccessSales.filter((s) => s.paymentStatus === "PAID");

    if (eligibleSales.length === 0) {
      alert(
        language === "ur"
          ? `منتخب کردہ ${nonSuccessSales.length} انوائسز میں سے کوئی بھی مکمل ادا شدہ (PAID) نہیں ہے۔ FBR پر صرف مکمل ادا شدہ انوائسز منتقل ہو سکتی ہیں۔`
          : `None of the selected ${nonSuccessSales.length} invoices are fully paid. Only fully paid invoices can be transmitted to FBR.`
      );
      return;
    }

    const confirmMsg =
      language === "ur"
        ? `کیا آپ واقعی ${eligibleSales.length} مکمل ادا شدہ انوائسز کو FBR پر منتقل / transmit کرنا چاہتے ہیں؟${
            unPaidSales.length > 0
              ? `\n\n(نوٹ: ${unPaidSales.length} غیر ادا شدہ انوائسز کو محفوظ طریقے سے چھوڑ دیا جائے گا)`
              : ""
          }`
        : `Transmit ${eligibleSales.length} fully paid invoice(s) to FBR?${
            unPaidSales.length > 0
              ? `\n\n(Note: ${unPaidSales.length} unpaid invoices will be safely skipped)`
              : ""
          }`;
    if (!confirm(confirmMsg)) return;

    setIsBulkTransmittingFbr(true);
    let successCount = 0;
    let failCount = 0;

    try {
      const targetIds = eligibleSales.map((s) => s.id);
      for (let i = 0; i < targetIds.length; i++) {
        const id = targetIds[i];
        if (i > 0) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        try {
          const res = await fetch("/api/compliance/fbr", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "transmit", invoiceId: id }),
          });
          const json = await res.json().catch(() => null);
          if (json?.success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch {
          failCount++;
        }
      }

      alert(
        language === "ur"
          ? `FBR ٹرانسمیشن مکمل:\nکامیاب: ${successCount} انوائسز${failCount > 0 ? `\nناکام/روکی گئیں: ${failCount}` : ""}`
          : `FBR Transmission complete:\nTransmitted: ${successCount}${failCount > 0 ? `\nFailed/Skipped: ${failCount}` : ""}`
      );
      setSelectedSaleIds([]);
      invalidateCache("/api/sales");
      invalidateCache("/api/dashboard");
      invalidateCache("/api/compliance/fbr");
      fetchSales();
    } catch (err: any) {
      alert(`${language === "ur" ? "خرابی" : "Error"}: ${err.message}`);
    } finally {
      setIsBulkTransmittingFbr(false);
    }
  };

  const openEditModal = (sale: SaleRecord) => {
    setEditingSale(sale);
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
  const sumAmt = (arr: SaleRecord[]) =>
    arr.reduce((a, s) => {
      const gross = Number(s.totalAmount || 0);
      const ret = Number(s.totalReturnedAmount || 0);
      return a + Math.max(0, gross - ret);
    }, 0);
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
    const cnInfo = extractCreditNoteInfo(s);
    const matchesSearch =
      !q ||
      s.invoiceNumber.toLowerCase().includes(q) ||
      s.customerName.toLowerCase().includes(q) ||
      (s.fbrInvoiceNumber && s.fbrInvoiceNumber.toLowerCase().includes(q)) ||
      (cnInfo.creditNoteNumber && cnInfo.creditNoteNumber.toLowerCase().includes(q)) ||
      (typeof s.notes === "string" && s.notes.toLowerCase().includes(q)) ||
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
  const filteredTotalGross = useMemo(
    () => filteredSales.reduce((a, s) => a + Number(s.totalAmount || 0), 0),
    [filteredSales]
  );
  const filteredTotalNet = useMemo(
    () =>
      filteredSales.reduce((a, s) => {
        const gross = Number(s.totalAmount || 0);
        const ret = Number(s.totalReturnedAmount || 0);
        return a + Math.max(0, gross - ret);
      }, 0),
    [filteredSales]
  );
  const filteredTotalReturns = useMemo(
    () => filteredSales.reduce((a, s) => a + Number(s.totalReturnedAmount || 0), 0),
    [filteredSales]
  );
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
      "Gross Amount",
      "Returned Amount",
      "Net Sale Amount",
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
      `"${(s.items?.map((it: any) => `${it.productName} (${it.quantity} ${(it.uom || it.product?.uom || it.product?.unit || "").toUpperCase() || "PCS"})`).join("; ") || "").replace(/"/g, '""')}"`,
      Number(s.totalAmount || 0).toFixed(2),
      Number(s.totalReturnedAmount || 0).toFixed(2),
      Math.max(0, Number(s.totalAmount || 0) - Number(s.totalReturnedAmount || 0)).toFixed(2),
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
              Total Sales: {formatMoney(filteredTotalNet)}
              {filteredTotalReturns > 0 && (
                <span className="text-[10px] text-rose-600 font-semibold ml-1">
                  (-{formatMoney(filteredTotalReturns)} ret)
                </span>
              )}
            </p>
            <p className="text-xs font-bold text-emerald-700">
              Collected: {formatMoney(filteredTotalPaid)}
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
            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition"
          >
            <UploadCloud className="h-3.5 w-3.5 text-indigo-600" />
            <span>Bulk Upload (CSV)</span>
          </Link>

          <button
            onClick={exportSalesToCsv}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition"
          >
            <Download className="h-3.5 w-3.5 text-slate-600" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => window.print()}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition"
            title={t("Print Sales Report for filtered period", "فلٹر شدہ مدت کی سیلز رپورٹ پرنٹ کریں")}
          >
            <Printer className="h-3.5 w-3.5 text-slate-600" />
            <span>{t("Print Sales Report", "سیلز رپورٹ پرنٹ کریں")}</span>
          </button>

          <Link
            href="/customers?action=add"
            className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50/70 px-3.5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 shadow-2xs transition dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
          >
            <UserPlus className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span>+ Register Customer</span>
          </Link>

          <Link
            href="/products/create"
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 shadow-2xs transition dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
          >
            <Plus className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>+ Add Product</span>
          </Link>

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
                {t("Invoices in filter:", "بلز:")} <strong>{filteredSales.length}</strong> | {t("Net Sales:", "نیٹ سیلز:")}{" "}
                <strong>Rs {filteredTotalNet.toLocaleString()}</strong>
                {filteredTotalReturns > 0 && (
                  <span className="text-rose-600 dark:text-rose-300 font-medium ml-1">
                    (-Rs {filteredTotalReturns.toLocaleString()} {t("returns", "واپسی")})
                  </span>
                )}{" "}
                | {t("Collected:", "وصول:")}{" "}
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
                <option value="ALL">{t("All Customers", "تمام گاہک")}</option>
                {customerList.map((c: any) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">{t("Date:", "تاریخ:")}</span>
              <select
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">{t("All Dates", "تمام تاریخیں")}</option>
                <option value="TODAY">{t("Today", "آج")}</option>
                <option value="YESTERDAY">{t("Yesterday", "گزشتہ کل")}</option>
                <option value="THIS_WEEK">{t("This Week", "اس ہفتے")}</option>
                <option value="THIS_MONTH">{t("This Month", "اس ماہ")}</option>
                <option value="LAST_30_DAYS">{t("Last 30 Days", "گزشتہ 30 دن")}</option>
                <option value="CUSTOM">{t("Custom Date Range", "کسٹم تاریخ")}</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">{t("Payment Status:", "ادائیگی صورتحال:")}</span>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ALL">{t("All Statuses", "تمام صورتحال")}</option>
                <option value="PAID">{t("Paid", "ادا شدہ")}</option>
                <option value="PARTIAL">{t("Partial", "جزوی ادا")}</option>
                <option value="UNPAID">{t("Unpaid (Credit)", "ادھار / غیر ادا شدہ")}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Custom Date Pickers (Shown if CUSTOM selected) */}
        {dateFilter === "CUSTOM" && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500">{t("From Date:", "تاریخ سے:")}</span>
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
              <span className="text-xs font-semibold text-slate-500">{t("To Date:", "تاریخ تک:")}</span>
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
              {t("Invoices Selected", "منتخب شدہ انوائسز")}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!isAccountingOnly && (
              <Button
                type="button"
                size="sm"
                onClick={handleBulkTransmitToFbr}
                isLoading={isBulkTransmittingFbr}
                className="bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 text-xs shadow-2xs font-semibold"
              >
                <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                {t("Push to FBR", "FBR پر بھیجیں")} ({selectedSaleIds.length})
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowBulkEditModal(true)}
              className="bg-white border-indigo-300 text-indigo-700 hover:bg-indigo-50 dark:bg-slate-900 dark:text-indigo-300 dark:border-indigo-700 text-xs shadow-2xs"
            >
              <Edit className="h-3.5 w-3.5 mr-1.5" />
              {t("Bulk Edit", "بلک ترمیم")} ({selectedSaleIds.length})
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
              {t("Delete Selected", "منتخب ڈیلیٹ")} ({selectedSaleIds.length})
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
        {/* Mobile Responsive Cards View (< md) */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {loading ? (
            Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="p-4 space-y-3 animate-pulse">
                <div className="flex justify-between items-center">
                  <div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="h-5 w-16 bg-slate-100 dark:bg-slate-800 rounded-full" />
                </div>
                <div className="h-4 w-40 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="flex justify-between pt-2">
                  <div className="h-4 w-24 bg-slate-100 dark:bg-slate-800 rounded" />
                  <div className="h-5 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
                </div>
              </div>
            ))
          ) : paginatedSales.length === 0 ? (
            <div className="py-10 px-4 text-center text-xs text-slate-400">
              No sales invoices found matching your criteria.
            </div>
          ) : (
            paginatedSales.map((sale) => {
              const isSelected = selectedSaleIds.includes(sale.id);
              return (
                <div
                  key={sale.id}
                  className={`p-3.5 space-y-2.5 transition-colors ${
                    isSelected ? "bg-indigo-50/50 dark:bg-indigo-950/30" : "bg-white dark:bg-slate-900"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Link
                          href={`/sales/${sale.id}`}
                          className="font-bold text-sm text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {sale.invoiceNumber}
                        </Link>
                        {!isAccountingOnly && (
                          (() => {
                            const cn = extractCreditNoteInfo(sale);
                            if (cn.hasCreditNote) {
                              return (
                                <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800">
                                  <RotateCcw className="h-2.5 w-2.5 text-purple-600" />
                                  <span>CN Applied{cn.creditNoteNumber ? `: ${cn.creditNoteNumber}` : ""}</span>
                                </span>
                              );
                            }
                            if (sale.fbrStatus === "SUCCESS") {
                              return (
                                <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                                  🏛️ FBR Sync
                                </span>
                              );
                            }
                            if (sale.fbrStatus === "PENDING") {
                              return (
                                <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
                                  ⏳ FBR Queue
                                </span>
                              );
                            }
                            return null;
                          })()
                        )}
                        {sale.isEdited && (
                          <span className="inline-flex items-center rounded-md bg-amber-50 px-1 py-0.5 text-[9px] font-semibold text-amber-800 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300">
                            ✏️ Edited
                          </span>
                        )}
                        {sale.isPartialReturn && sale.status === "POSTED" && (
                          <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300">
                            ↺ {language === "ur" ? "جزوی واپسی" : "Partial Return"}
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-xs text-slate-900 dark:text-white">
                        {sale.customerName}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {new Date(sale.date).toLocaleDateString()} • {sale.items?.length || 0} items
                      </p>
                    </div>

                    <div className="text-right space-y-0.5 shrink-0">
                      {sale.totalReturnedAmount && Number(sale.totalReturnedAmount) > 0 ? (
                        <div>
                          <span className="block font-mono font-bold text-sm text-slate-900 dark:text-white">
                            {formatMoney(Math.max(0, Number(sale.totalAmount) - Number(sale.totalReturnedAmount)))}
                          </span>
                          <span className="block text-[10px] text-slate-400 line-through">
                            {formatMoney(sale.totalAmount)}
                          </span>
                          <span className="block text-[10px] text-rose-600 font-semibold dark:text-rose-400">
                            (-{formatMoney(sale.totalReturnedAmount)} {language === "ur" ? "واپس" : "ret"})
                          </span>
                        </div>
                      ) : (
                        <span className="block font-mono font-bold text-sm text-slate-900 dark:text-white">
                          {formatMoney(sale.totalAmount)}
                        </span>
                      )}
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
                    </div>
                  </div>

                  {/* Payment Breakdown */}
                  <div className="flex items-center justify-between text-[11px] bg-slate-50 dark:bg-slate-800/50 rounded-lg px-2.5 py-1.5 font-mono">
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      Paid: {formatMoney(sale.paidAmount)}
                    </span>
                    <span className={`font-bold ${Number(sale.remainingAmount || 0) > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-400"}`}>
                      Due: {formatMoney(sale.remainingAmount)}
                    </span>
                  </div>

                  {/* Mobile Quick Action Buttons */}
                  <div className="flex items-center justify-between pt-1 gap-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => handleToggleSelectSale(sale.id)}
                      className="text-xs text-slate-500 flex items-center gap-1 py-1"
                    >
                      {isSelected ? (
                        <CheckSquare className="h-4 w-4 text-indigo-600" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                      <span className="text-[10px]">Select</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/sales/${sale.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 dark:bg-slate-800 dark:text-slate-200 rounded-lg hover:bg-slate-200 transition"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>View</span>
                      </Link>
                      <Link
                        href={`/sales/${sale.id}?print=true`}
                        target="_blank"
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-lg hover:bg-emerald-100 transition border border-emerald-200 dark:border-emerald-800"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        <span>Print</span>
                      </Link>
                      <button
                        onClick={() => openEditModal(sale)}
                        className="p-1 text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 rounded-lg"
                        title="Edit Invoice Details"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {sale.status === "POSTED" && sale.hasReturnableItems !== false && !extractCreditNoteInfo(sale).hasCreditNote && !(sale.fbrStatus === "SUCCESS" && Boolean(typeof sale.fbrInvoiceNumber === "string" && (sale.fbrInvoiceNumber.includes("DI") || isDigitalInvoicing))) && (
                        <button
                          onClick={() => handleInitiateReturn(sale)}
                          disabled={reversingId === sale.id}
                          className="p-1 text-rose-500 hover:bg-rose-50 dark:text-rose-400 rounded-lg"
                          title={sale.fbrStatus === "SUCCESS" ? t("Return Sale & Issue FBR Credit Note", "سیل واپسی اور FBR کریڈٹ نوٹ") : t("Select Items to Return", "آئٹم وائز سیل واپسی")}
                        >
                          <RotateCcw className={`h-3.5 w-3.5 ${reversingId === sale.id ? "animate-spin text-rose-700" : ""}`} />
                        </button>
                      )}
                      {extractCreditNoteInfo(sale).hasCreditNote && (
                        <span
                          className="p-1 text-purple-600 opacity-80 cursor-not-allowed"
                          title={`FBR Credit Note already applied (${extractCreditNoteInfo(sale).creditNoteNumber || "Reversed"}). Duplicate prevented.`}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table View (>= md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-xs text-slate-600 dark:text-slate-300">
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
                <th className="px-4 py-3">{t("Invoice #", "انوائس نمبر")}</th>
                <th className="px-4 py-3">{t("Date", "تاریخ")}</th>
                <th className="px-4 py-3">{t("Customer", "گاہک")}</th>
                <th className="px-4 py-3">{t("Products Sold", "اشیاء")}</th>
                <th className="px-4 py-3">{t("Created By", "بنایا گیا")}</th>
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
                          {!isAccountingOnly && (
                            (() => {
                              const cnInfo = extractCreditNoteInfo(sale);
                              if (cnInfo.hasCreditNote) {
                                return (
                                  <span
                                    className="inline-flex items-center gap-1 rounded px-1.5 py-0.2 text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800"
                                    title={`Official FBR Credit Note Applied: ${cnInfo.creditNoteNumber || "Reversed"}`}
                                  >
                                    <RotateCcw className="h-2.5 w-2.5 text-purple-600" />
                                    <span>CN Applied{cnInfo.creditNoteNumber ? `: ${cnInfo.creditNoteNumber}` : ""}</span>
                                  </span>
                                );
                              }
                              if (sale.fbrStatus === "SUCCESS") {
                                return (
                                  <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                                    🏛️ FBR Sync
                                  </span>
                                );
                              }
                              if (sale.fbrStatus === "PENDING") {
                                return (
                                  <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
                                    ⏳ FBR Queue
                                  </span>
                                );
                              }
                              if (sale.fbrStatus === "NOT_APPLICABLE") {
                                return (
                                  <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                                    🏠 Local Sale
                                  </span>
                                );
                              }
                              return null;
                            })()
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
                          {sale.items.map((item: any, i: number) => {
                            const uomDisplay = (item.uom || item.product?.uom || item.product?.unit || "").toUpperCase() || "PCS";
                            const retQty = Number(item.returnedQuantity || 0);
                            return (
                              <div key={i} className="flex items-center gap-1.5 text-xs">
                                <span className="font-bold text-slate-900 dark:text-white">
                                  {item.productName || "Product"}
                                </span>
                                <span className="rounded bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.2 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 shrink-0">
                                  {Number(item.quantity || 1)} {uomDisplay}
                                </span>
                                {retQty > 0 && (
                                  <span className="rounded bg-rose-50 border border-rose-200/60 px-1 py-0.2 text-[9px] font-bold text-rose-600 dark:bg-rose-950/60 dark:text-rose-300 shrink-0">
                                    (-{retQty} {language === "ur" ? "واپس" : "ret"})
                                  </span>
                                )}
                              </div>
                            );
                          })}
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
                      {sale.totalReturnedAmount && Number(sale.totalReturnedAmount) > 0 ? (
                        <div className="flex flex-col items-end">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {formatMoney(Math.max(0, Number(sale.totalAmount) - Number(sale.totalReturnedAmount)))}
                          </span>
                          <span className="text-[10px] text-slate-400 line-through">
                            {formatMoney(sale.totalAmount)}
                          </span>
                          <span className="text-[10px] text-rose-600 font-semibold dark:text-rose-400">
                            (-{formatMoney(sale.totalReturnedAmount)} {language === "ur" ? "واپس" : "ret"})
                          </span>
                        </div>
                      ) : (
                        formatMoney(sale.totalAmount)
                      )}
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
                      <div className="flex flex-col items-center gap-1">
                        <Badge variant={sale.status === "POSTED" ? "default" : "secondary"}>
                          {sale.status === "CANCELLED"
                            ? (language === "ur" ? "واپسی شدہ" : "CANCELLED")
                            : sale.status}
                        </Badge>
                        {sale.isPartialReturn && sale.status === "POSTED" && (
                          <span
                            className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300"
                            title={`Partial return of Rs. ${formatMoney(sale.totalReturnedAmount || 0)}`}
                          >
                            ↺ {language === "ur" ? "جزوی واپسی" : "Partial Ret"}
                          </span>
                        )}
                      </div>
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
                          title={t("Print Invoice / Receipt", "انوائس پرنٹ کریں")}
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </Link>
                        {!isAccountingOnly && sale.fbrStatus !== "SUCCESS" && sale.status === "POSTED" && (
                          <button
                            onClick={() => handleTransmitSingleToFbr(sale)}
                            disabled={transmittingFbrId === sale.id}
                            className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50 hover:text-blue-800 dark:hover:bg-blue-950/40"
                            title={t("Transmit / Push to FBR", "FBR پر منتقل کریں")}
                          >
                            <ShieldCheck className={`h-3.5 w-3.5 ${transmittingFbrId === sale.id ? "animate-spin text-blue-700" : ""}`} />
                          </button>
                        )}
                        {sale.status === "POSTED" && sale.hasReturnableItems !== false && !extractCreditNoteInfo(sale).hasCreditNote && !(sale.fbrStatus === "SUCCESS" && Boolean(typeof sale.fbrInvoiceNumber === "string" && (sale.fbrInvoiceNumber.includes("DI") || isDigitalInvoicing))) && (
                          <button
                            onClick={() => handleInitiateReturn(sale)}
                            disabled={reversingId === sale.id}
                            className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40"
                            title={sale.fbrStatus === "SUCCESS" ? t("Return Sale & Issue FBR Credit Note", "سیل واپسی اور FBR کریڈٹ نوٹ") : t("Select Items to Return / Reverse Sale", "آئٹم وائز سیل واپسی / ریورس")}
                          >
                            <RotateCcw className={`h-3.5 w-3.5 ${reversingId === sale.id ? "animate-spin text-rose-700" : ""}`} />
                          </button>
                        )}
                        {extractCreditNoteInfo(sale).hasCreditNote && (
                          <span
                            className="rounded-lg p-1 text-purple-600 opacity-80 cursor-not-allowed"
                            title={`FBR Credit Note already applied (${extractCreditNoteInfo(sale).creditNoteNumber || "Reversed"}). Duplicate prevented.`}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </span>
                        )}
                        {sale.fbrStatus !== "SUCCESS" && !Boolean(sale.fbrInvoiceNumber) ? (
                          <button
                            onClick={() => handleDeleteSale(sale)}
                            disabled={deletingSaleId === sale.id}
                            className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-100/70 hover:text-rose-800 dark:hover:bg-rose-950/50"
                            title={t("Delete Invoice", "انوائس ڈیلیٹ کریں")}
                          >
                            <Trash2 className={`h-3.5 w-3.5 ${deletingSaleId === sale.id ? "animate-spin" : ""}`} />
                          </button>
                        ) : (
                          <span
                            className="rounded-lg p-1.5 text-slate-400 dark:text-slate-500 cursor-not-allowed inline-flex items-center"
                            title={t("FBR Synced - Deletion Prohibited", "FBR سے منظور شدہ - ڈیلیٹ ممنوع ہے")}
                          >
                            <Lock className="h-3.5 w-3.5" />
                          </span>
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
                      ? sale.items.map((it: any) => `${it.productName || "Product"} (${Number(it.quantity || 1)} ${(it.uom || it.product?.uom || it.product?.unit || "").toUpperCase() || "PCS"})`).join(", ")
                      : "—"}
                  </td>
                  <td className="py-1.5 px-2 text-right font-black text-slate-900 tabular-nums whitespace-nowrap">
                    {sale.totalReturnedAmount && Number(sale.totalReturnedAmount) > 0 ? (
                      <div className="leading-tight">
                        <div>{formatMoney(Math.max(0, Number(sale.totalAmount) - Number(sale.totalReturnedAmount)))}</div>
                        <div className="text-[9px] text-slate-500 font-normal line-through">{formatMoney(sale.totalAmount)}</div>
                        <div className="text-[9px] text-rose-700 font-bold">(-{formatMoney(sale.totalReturnedAmount)})</div>
                      </div>
                    ) : (
                      formatMoney(sale.totalAmount)
                    )}
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
                {filteredTotalReturns > 0 ? (
                  <div className="leading-tight">
                    <div>{formatMoney(filteredTotalNet)}</div>
                    <div className="text-[9px] text-slate-500 font-normal line-through">{formatMoney(filteredTotalGross)}</div>
                    <div className="text-[9px] text-rose-700 font-bold">(-{formatMoney(filteredTotalReturns)})</div>
                  </div>
                ) : (
                  formatMoney(filteredTotalGross)
                )}
              </td>
              <td className="py-2.5 px-2 text-right tabular-nums whitespace-nowrap text-emerald-800">
                {formatMoney(filteredTotalPaid)}
              </td>
              <td className="py-2.5 px-2 text-right tabular-nums whitespace-nowrap text-rose-800">
                {formatMoney(Math.max(0, filteredTotalNet - filteredTotalPaid))}
              </td>
              <td colSpan={2} className="py-2.5 px-2 text-center text-[10px] text-slate-600">
                End of Report
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Comprehensive Sales Edit Modal */}
      {editingSale && (
        <SalesEditModal
          isOpen={!!editingSale}
          onClose={() => setEditingSale(null)}
          sale={editingSale}
          onSuccess={(updatedSale) => {
            alert(
              language === "ur"
                ? "انوائس میں تمام ترامیم کامیابی سے محفوظ ہو گئیں!"
                : "Sale invoice updated successfully. Audit trail recorded."
            );
            setEditingSale(null);
            invalidateCache("/api/sales");
            invalidateCache("/api/products");
            invalidateCache("/api/dashboard");
            fetchSales();
          }}
          onDelete={(saleToDelete) => {
            handleDeleteSale(saleToDelete);
          }}
        />
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
                {language === "ur"
                  ? `آپ بیک وقت ${selectedSaleIds.length} انوائسز میں تبدیلیاں کر رہے ہیں۔`
                  : `You are bulk updating ${selectedSaleIds.length} invoices simultaneously.`}
              </p>
              <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
                {language === "ur"
                  ? "جس فیلڈ کو آپ خالی چھوڑیں گے اس میں کوئی تبدیلی نہیں ہوگی۔ صرف مطلوبہ فیلڈز کو پر کریں۔"
                  : "Fields left blank will remain unchanged. Only fill the fields you want to update."}
              </p>
            </div>

            {/* 1. Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t("New Invoice Date (Optional)", "نئی انوائس تاریخ (اختیاری)")}
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
                {t("New Customer Name (Optional)", "نیا گاہک کا نام (اختیاری)")}
              </label>
              <Input
                value={bulkEditCustomerName}
                onChange={(e) => setBulkEditCustomerName(e.target.value)}
                placeholder={t("Leave blank to keep existing customer names", "پرانے گاہک کا نام برقرار رکھنے کے لیے خالی چھوڑیں")}
              />
            </div>

            {/* 3. Payment Method & Payment Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t("Payment Method", "طریقہ ادائیگی")}
                </label>
                <select
                  value={bulkEditPaymentMethod}
                  onChange={(e) => setBulkEditPaymentMethod(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                >
                  <option value="">{t("(Keep Existing)", "(تبدیل نہ کریں - وہی رکھیں)")}</option>
                  <option value="CASH">{t("CASH", "نقد")}</option>
                  <option value="BANK">{t("BANK", "بینک")}</option>
                  <option value="ONLINE">{t("ONLINE", "آن لائن")}</option>
                  <option value="CHEQUE">{t("CHEQUE", "چیک")}</option>
                  <option value="CREDIT">{t("CREDIT", "ادھار")}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t("Payment Status", "ادائیگی کی صورتحال")}
                </label>
                <select
                  value={bulkEditPaymentStatus}
                  onChange={(e) => setBulkEditPaymentStatus(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                >
                  <option value="">{t("(Keep Existing)", "(تبدیل نہ کریں - وہی رکھیں)")}</option>
                  <option value="PAID">{t("PAID", "مکمل ادا شدہ")}</option>
                  <option value="PARTIAL">{t("PARTIAL", "جزوی ادائیگی")}</option>
                  <option value="UNPAID">{t("UNPAID", "غیر ادا شدہ / ادھار")}</option>
                </select>
              </div>
            </div>

            {/* 4. Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t("Invoice Notes (Optional)", "ریمارکس (اختیاری)")}
              </label>
              <Input
                value={bulkEditNotes}
                onChange={(e) => setBulkEditNotes(e.target.value)}
                placeholder={t("Leave blank to keep existing notes", "پرانے ریمارکس برقرار رکھنے کے لیے خالی چھوڑیں")}
              />
            </div>

            {/* 5. FBR Status (Optional) */}
            {!isAccountingOnly && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t("FBR Status (Optional)", "FBR صورتحال (اختیاری)")}
                </label>
                <select
                  value={bulkEditFbrStatus}
                  onChange={(e) => setBulkEditFbrStatus(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                >
                  <option value="">{t("(Keep Existing)", "(تبدیل نہ کریں - وہی رکھیں)")}</option>
                  <option value="PENDING">{t("PENDING (Move to FBR Queue)", "منتظر (FBR قطار میں منتقل کریں)")}</option>
                  <option value="NOT_APPLICABLE">{t("NOT_APPLICABLE (Local Sale / Exempt)", "لاگو نہیں (مقامی سیل)")}</option>
                </select>
              </div>
            )}

            {/* 5. Audit Reason (Required) */}
            <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-3 dark:border-amber-800 dark:bg-amber-950/40">
              <label className="block text-xs font-bold text-amber-900 dark:text-amber-200 mb-1">
                {t("Reason for Bulk Edit", "بلک ترمیم کی وجہ درج کریں")} *
              </label>
              <textarea
                value={bulkEditReason}
                onChange={(e) => setBulkEditReason(e.target.value)}
                placeholder={t("e.g. Corrected invoice date, customer updated, etc...", "مثال: تاریخ درست کی گئی، غلط کسٹمر اپڈیٹ کیا گیا، وغیرہ...")}
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
                {t("Cancel", "منسوخ")}
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={isBulkSaving}
              >
                {t(`Apply to ${selectedSaleIds.length} Invoices`, `${selectedSaleIds.length} انوائسز پر لاگو کریں`)}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Partial & Item-wise Sales Return Modal */}
      {isReturnModalOpen && returnModalSale && (
        <SalesReturnModal
          isOpen={isReturnModalOpen}
          onClose={() => {
            setIsReturnModalOpen(false);
            setReturnModalSale(null);
          }}
          sale={returnModalSale}
          onSuccess={handleReturnSuccess}
        />
      )}
    </div>
  );
}
