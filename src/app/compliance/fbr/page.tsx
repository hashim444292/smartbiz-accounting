"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  CheckCircle2,
  AlertOctagon,
  Clock,
  QrCode,
  RotateCcw,
  ExternalLink,
  Printer,
  AlertCircle,
  Zap,
  Search,
  CheckSquare,
  Square,
  Check,
  FileText,
  Building,
  Plus,
  Lock,
  Wallet,
  ArrowRight,
  ShieldAlert,
  Download,
  UploadCloud,
  FileSpreadsheet,
  Settings,
  Key,
  Code,
  Copy,
  CheckCheck,
  Pencil,
  Trash2,
} from "lucide-react";
import { TableRowsSkeleton } from "@/components/ui/loader";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { FbrQrCode } from "@/components/ui/FbrQrCode";

export default function FbrCompliancePage() {
  const { activeCompany, user } = useAuth();
  const { language, t } = useLanguage();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const [loading, setLoading] = useState(true);
  const [complianceData, setComplianceData] = useState<any>(null);

  // Search & Filter State
  const [activeTab, setActiveTab] = useState<"READY" | "AWAITING_PAYMENT" | "SUCCESS" | "ALL">("READY");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Action Loading States
  const [hittingId, setHittingId] = useState<string | null>(null);
  const [isBatchHitting, setIsBatchHitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // QR / Receipt Modal State
  const [selectedReceiptInvoice, setSelectedReceiptInvoice] = useState<any | null>(null);

  // Locked Partial Invoice Explainer Modal State
  const [lockedInvoiceModal, setLockedInvoiceModal] = useState<any | null>(null);

  // Direct Invoice Settle Modal State
  const [settleModalInvoice, setSettleModalInvoice] = useState<any | null>(null);
  const [settleMethod, setSettleMethod] = useState<"CASH" | "BANK">("CASH");
  const [isSettling, setIsSettling] = useState(false);

  // FBR API Gateway Config & Test State
  const [fbrConfigModal, setFbrConfigModal] = useState(false);
  const [fbrConfigForm, setFbrConfigForm] = useState({
    token: "",
    environment: "sandbox",
    integrationType: "DIGITAL_INVOICING" as "DIGITAL_INVOICING" | "TIER1_POS" | "BOTH",
    posId: "822646",
    scenarioId: "SN000",
    autoSync: false,
    sellerNtn: "",
    sellerBusinessName: "",
    sellerProvince: "Sindh",
    sellerAddress: "",
  });
  const [savingConfig, setSavingConfig] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResultModal, setTestResultModal] = useState<any | null>(null);
  const [payloadModal, setPayloadModal] = useState<any | null>(null);
  const [loadingPayloadId, setLoadingPayloadId] = useState<string | null>(null);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [reversingId, setReversingId] = useState<string | null>(null);

  // FBR Credit Note / Duplicate Reversal States
  const [showCreditNoteModal, setShowCreditNoteModal] = useState(false);
  const [creditNoteTab, setCreditNoteTab] = useState<"list" | "paste">("list");
  const [creditNoteSearch, setCreditNoteSearch] = useState("");
  const [creditNotePastedText, setCreditNotePastedText] = useState("");
  const [selectedCreditNoteIds, setSelectedCreditNoteIds] = useState<string[]>([]);
  const [transmittingCreditNoteId, setTransmittingCreditNoteId] = useState<string | null>(null);
  const [isTransmittingCreditNotes, setIsTransmittingCreditNotes] = useState(false);

  const handleTransmitCreditNote = async (inv: any) => {
    const confirmPrompt = language === "ur"
      ? `کیا آپ انوائس #${inv.invoiceNumber} (${inv.fbrInvoiceNumber || ""}) کے لیے FBR پر باقاعدہ Credit Note (InvoiceType 2 - واپسی) ارسال کرنا چاہتے ہیں؟\n\n- اس سے FBR پورٹل پر اس انوائس کی سیلز اور ٹیکس کی رقم مائنس / ریورس ہو جائے گی۔\n- یہ عمل FBR پورٹل پر ڈپلیکیٹ انوائسز کو کینسل کرنے کے لیے استعمال ہوتا ہے۔`
      : `Transmit official FBR Credit Note (InvoiceType 2 - Return) for invoice #${inv.invoiceNumber} (${inv.fbrInvoiceNumber || ""}) to FBR?\n\n- This will reverse the sales and tax on the FBR portal.\n- Used to negate duplicate FBR entries.`;

    if (!confirm(confirmPrompt)) return;

    setTransmittingCreditNoteId(inv.id);
    try {
      const res = await fetch("/api/compliance/fbr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "credit_note",
          invoiceId: inv.id,
          reason: "Duplicate transmission correction",
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(
          language === "ur"
            ? `FBR Credit Note کامیابی سے FBR پر درج ہو گیا!\nCredit Note نمبر: ${data.cnInvoiceNumber || ""}`
            : `FBR Credit Note transmitted successfully!\nCredit Note #: ${data.cnInvoiceNumber || ""}`
        );
        loadCompliance();
      } else {
        alert(data.error || data.message || "Failed to transmit Credit Note to FBR");
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setTransmittingCreditNoteId(null);
    }
  };

  const handleBatchTransmitCreditNotes = async (targetInvoices: any[]) => {
    if (targetInvoices.length === 0) return;
    const confirmPrompt = language === "ur"
      ? `کیا آپ واقعی ${targetInvoices.length} انوائسز کے لیے FBR پر باقاعدہ Credit Notes (InvoiceType 2) ارسال کرنا چاہتے ہیں؟\n\n- ہر Credit Note 2 سیکنڈ کے وقفے سے FBR گیٹ وے کو ارسال ہو گا۔\n- FBR پورٹل پر ان انوائسز کی ڈپلیکیٹ سیلز ریورس ہو جائے گی۔`
      : `Transmit official FBR Credit Notes (InvoiceType 2) for ${targetInvoices.length} invoice(s)?\n\n- Each Credit Note will transmit with a 2-second rate-limiting delay.\n- Duplicate liability will be cancelled on FBR.`;

    if (!confirm(confirmPrompt)) return;

    setIsTransmittingCreditNotes(true);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < targetInvoices.length; i++) {
      const inv = targetInvoices[i];
      const pct = Math.round(((i + 1) / targetInvoices.length) * 100);

      setActionMessage({
        type: "info",
        text: language === "ur"
          ? `FBR Credit Notes ترسیل جاری ہے: ${i + 1} / ${targetInvoices.length} (${pct}%)... کامیاب: ${successCount}`
          : `Transmitting FBR Credit Notes: ${i + 1} of ${targetInvoices.length} (${pct}%)... Success: ${successCount}`,
      });

      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      try {
        const res = await fetch("/api/compliance/fbr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "credit_note",
            invoiceId: inv.id,
            reason: "Duplicate transmission correction",
          }),
        });
        const data = await res.json().catch(() => null);
        if (data?.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    setActionMessage({
      type: failCount === 0 ? "success" : "info",
      text: language === "ur"
        ? `FBR Credit Notes مکمل! کامیاب: ${successCount} انوائسز${failCount > 0 ? `، ناکام: ${failCount}` : ""}`
        : `FBR Credit Notes completed! Transmitted: ${successCount}${failCount > 0 ? `, Failed: ${failCount}` : ""}`,
    });
    setIsTransmittingCreditNotes(false);
    setSelectedCreditNoteIds([]);
    setShowCreditNoteModal(false);
    loadCompliance();
  };

  const handleReverseInvoice = async (inv: any) => {
    const isStamped = inv.fbrStatus === "SUCCESS";
    const confirmText = isStamped
      ? (language === "ur"
          ? `انوائس #${inv.invoiceNumber} پہلے سے FBR پر منظور شدہ ہے۔\n\nاسے ریورس کرنے پر اکاؤنٹنگ میں باقاعدہ Sales Return / Credit Note درج ہوگا، گودام کا اسٹاک بحال ہوگا اور گاہک کا کھاتہ درست ہو جائے گا۔\n\nکیا آپ یہ Credit Note / Reversal جاری کرنا چاہتے ہیں؟`
          : `Invoice #${inv.invoiceNumber} is already validated with FBR.\n\nReversing this will record an official Credit Note / Sales Return in accounting, restore inventory stock, and balance customer ledger.\n\nDo you want to issue this Credit Note / Reversal?`)
      : (language === "ur"
          ? `کیا آپ انوائس #${inv.invoiceNumber} کو منسوخ / ریورس کرنا چاہتے ہیں؟ اس سے کھاتے اور اسٹاک درست ہو جائیں گے اور یہ بل کینسل ہو جائے گا۔`
          : `Are you sure you want to cancel / reverse invoice #${inv.invoiceNumber}? This will restore ledger and inventory.`);

    if (!window.confirm(confirmText)) return;

    setReversingId(inv.id);
    try {
      const res = await fetch(`/api/sales/${inv.id}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: isStamped
            ? `Credit Note for FBR Stamped Invoice #${inv.invoiceNumber} (${inv.fbrInvoiceNumber || ""})`
            : `User cancellation / reversal of invoice #${inv.invoiceNumber}`,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setActionMessage({
          type: "success",
          text: language === "ur"
            ? `انوائس #${inv.invoiceNumber} کامیابی سے ریورس ہو گئی۔ (Credit Note / Reversal Recorded)`
            : `Invoice #${inv.invoiceNumber} reversed successfully. (Credit Note Recorded)`,
        });
        loadCompliance();
      } else {
        setActionMessage({
          type: "error",
          text: json.error || (language === "ur" ? "ریورس کرنے میں ناکامی ہوئی۔" : "Failed to reverse invoice."),
        });
      }
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err.message || (language === "ur" ? "نیٹ ورک کی خرابی۔" : "Network error."),
      });
    } finally {
      setReversingId(null);
    }
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  const handleDeleteInvoice = async (inv: any) => {
    const isStamped = inv.fbrStatus === "SUCCESS";
    const confirmMsg = isStamped
      ? (language === "ur"
          ? `انوائس #${inv.invoiceNumber} پہلے سے FBR پر منظور شدہ ہے۔ کیا آپ اسے واقعی اس سسٹم سے ڈیلیٹ کرنا چاہتے ہیں؟`
          : `Invoice #${inv.invoiceNumber} is approved by FBR. Are you sure you want to delete it from this system?`)
      : (language === "ur"
          ? `کیا آپ انوائس #${inv.invoiceNumber} کو مستقل ڈیلیٹ کرنا چاہتے ہیں؟ اس سے کھاتے اور اسٹاک واپس درست ہو جائیں گے۔`
          : `Are you sure you want to permanently delete invoice #${inv.invoiceNumber}? This will restore ledger and inventory.`);

    if (!window.confirm(confirmMsg)) return;

    setDeletingId(inv.id);
    try {
      const res = await fetch(`/api/sales/${inv.id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        setActionMessage({
          type: "success",
          text: language === "ur"
            ? `انوائس #${inv.invoiceNumber} کامیابی سے ڈیلیٹ ہو گئی۔`
            : `Invoice #${inv.invoiceNumber} deleted successfully.`,
        });
        setSelectedIds((prev) => prev.filter((id) => id !== inv.id));
        loadCompliance();
      } else {
        setActionMessage({
          type: "error",
          text: json.error || (language === "ur" ? "انوائس ڈیلیٹ کرنے میں ناکامی ہوئی۔" : "Failed to delete invoice."),
        });
      }
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err.message || (language === "ur" ? "نیٹ ورک کی خرابی۔" : "Network error."),
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    const confirmPrompt = language === "ur"
      ? `کیا آپ منتخب کردہ تمام ${selectedIds.length} انوائسز کو مستقل ڈیلیٹ کرنا چاہتے ہیں؟`
      : `Are you sure you want to permanently delete all ${selectedIds.length} selected invoices?`;
    if (!window.confirm(confirmPrompt)) {
      return;
    }

    setIsBatchDeleting(true);
    try {
      const res = await fetch("/api/sales", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const json = await res.json();
      if (json.success) {
        setActionMessage({
          type: "success",
          text: language === "ur"
            ? `کامیابی سے ${json.deletedCount} انوائسز ڈیلیٹ کر دی گئیں۔`
            : `Successfully deleted ${json.deletedCount} invoices.`,
        });
        setSelectedIds([]);
        loadCompliance();
      } else {
        setActionMessage({
          type: "error",
          text: json.error || (language === "ur" ? "بلک ڈیلیٹ میں ناکامی ہوئی۔" : "Bulk delete failed."),
        });
      }
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err.message || (language === "ur" ? "نیٹ ورک کی خرابی۔" : "Network error."),
      });
    } finally {
      setIsBatchDeleting(false);
    }
  };

  const loadCompliance = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/compliance/fbr");
      const json = await res.json();
      if (json.success) {
        setComplianceData(json.data);
      }
    } catch (err) {
      console.error("Failed to load compliance data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompliance();
  }, [activeCompany?.id]);

  useEffect(() => {
    if (complianceData?.config) {
      let rawNtn = complianceData.config.sellerNtn || activeCompany?.ntn || "4428410-1";
      const digits = rawNtn.replace(/[^0-9]/g, "");
      if (!digits || /^0+$/.test(digits) || digits.length < 5) {
        rawNtn = "4428410-1";
      }
      setFbrConfigForm({
        token: complianceData.config.token || "121f8deb-bb81-3e13-b49d-87f3b6792fe2",
        environment: complianceData.config.environment || "sandbox",
        integrationType: complianceData.config.integrationType || "DIGITAL_INVOICING",
        posId: complianceData.config.posId || "200871",
        scenarioId: complianceData.config.scenarioId || "SN001",
        autoSync: Boolean(complianceData.config.autoSync),
        sellerNtn: rawNtn,
        sellerBusinessName: complianceData.config.sellerBusinessName || activeCompany?.name || "Business",
        sellerProvince: complianceData.config.sellerProvince || activeCompany?.province || "Sindh",
        sellerAddress: complianceData.config.sellerAddress || activeCompany?.address || "",
      });
    }
  }, [complianceData, activeCompany]);

  const handleSaveFbrConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const res = await fetch("/api/compliance/fbr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_config", config: fbrConfigForm }),
      });
      const json = await res.json();
      if (json.success) {
        setActionMessage({ type: "success", text: "FBR Integration settings saved successfully." });
        setFbrConfigModal(false);
        loadCompliance();
      } else {
        alert(json.error || "Failed to save FBR settings");
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleTestSandbox = async () => {
    setTestingConnection(true);
    let effectiveNtn = (fbrConfigForm.sellerNtn || "4428410").replace(/[^0-9]/g, "");
    if (effectiveNtn.length === 8) {
      effectiveNtn = effectiveNtn.slice(0, 7);
    }
    if (!effectiveNtn || /^0+$/.test(effectiveNtn) || effectiveNtn.length < 7) {
      effectiveNtn = "4428410";
    }
    try {
      const res = await fetch("/api/compliance/fbr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_connection",
          token: fbrConfigForm.token,
          environment: fbrConfigForm.environment,
          integrationType: fbrConfigForm.integrationType,
          posId: fbrConfigForm.posId,
          sellerNtn: effectiveNtn,
          sellerBusinessName: fbrConfigForm.sellerBusinessName || "Shakeel mobiles",
          sellerProvince: fbrConfigForm.sellerProvince || "Sindh",
          sellerAddress: fbrConfigForm.sellerAddress || "R-70 rehman villas",
        }),
      });
      const json = await res.json();
      setTestResultModal(json.data);
    } catch (err: any) {
      setTestResultModal({ success: false, message: err.message });
    } finally {
      setTestingConnection(false);
    }
  };

  const handlePreviewPayload = async (inv: any) => {
    setLoadingPayloadId(inv.id);
    try {
      const res = await fetch("/api/compliance/fbr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview_payload", invoiceId: inv.id }),
      });
      const json = await res.json();
      if (json.success) {
        setPayloadModal({
          invoiceNumber: inv.invoiceNumber,
          payload: json.data.payload,
          endpoint: json.data.endpoint,
        });
      } else {
        alert(json.error || "Failed to generate preview");
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoadingPayloadId(null);
    }
  };

  // All Invoices List
  const allInvoices: any[] = useMemo(() => {
    return (complianceData?.recentInvoices || []).filter(
      (inv: any) => inv.fbrStatus !== "NOT_APPLICABLE"
    );
  }, [complianceData]);

  // Invoices filtered by activeTab & search
  const filteredInvoices = useMemo(() => {
    let list = allInvoices;

    if (activeTab === "READY") {
      // Fully paid and not yet transmitted to FBR
      list = list.filter((inv) => (!inv.fbrStatus || inv.fbrStatus === "PENDING") && inv.paymentStatus === "PAID");
    } else if (activeTab === "AWAITING_PAYMENT") {
      // Incomplete payment (Partial or 100% credit) and not yet transmitted to FBR
      list = list.filter((inv) => (!inv.fbrStatus || inv.fbrStatus === "PENDING") && inv.paymentStatus !== "PAID");
    } else if (activeTab === "SUCCESS") {
      // Transmitted & verified on FBR
      list = list.filter((inv) => inv.fbrStatus === "SUCCESS");
    } else if (activeTab === "ALL") {
      list = list.filter((inv) => inv.fbrStatus !== "NOT_APPLICABLE");
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (inv) =>
          inv.invoiceNumber?.toLowerCase().includes(q) ||
          inv.customerName?.toLowerCase().includes(q) ||
          inv.fbrInvoiceNumber?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [allInvoices, activeTab, searchQuery]);

  // Counts
  const readyInvoices = allInvoices.filter(
    (inv) => (!inv.fbrStatus || inv.fbrStatus === "PENDING") && inv.paymentStatus === "PAID"
  );
  const awaitingPaymentInvoices = allInvoices.filter(
    (inv) => (!inv.fbrStatus || inv.fbrStatus === "PENDING") && inv.paymentStatus !== "PAID"
  );
  const successInvoices = allInvoices.filter((inv) => inv.fbrStatus === "SUCCESS");

  const readyCount = readyInvoices.length;
  const awaitingPaymentCount = awaitingPaymentInvoices.length;
  const successCount = successInvoices.length;
  const totalPosFees = successCount * 1.0;

  // Single Invoice FBR Hit Handler
  const handleHitFbr = async (invoice: any) => {
    if (invoice.paymentStatus !== "PAID") {
      setLockedInvoiceModal(invoice);
      return;
    }

    setHittingId(invoice.id);
    setActionMessage(null);

    try {
      const res = await fetch("/api/compliance/fbr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "transmit", invoiceId: invoice.id }),
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.message || data.error || "Failed to transmit invoice to FBR");
      }

      setActionMessage({
        type: "success",
        text: `Invoice #${data.data.invoiceNumber} successfully transmitted to FBR. FBR Number: ${data.data.fbrInvoiceNumber}. Rs. 1/- POS fee applied.`,
      });

      // Show receipt modal
      setSelectedReceiptInvoice(data.data);
      await loadCompliance();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "FBR transmission failed." });
    } finally {
      setHittingId(null);
    }
  };

  // Batch Invoices FBR Hit Handler (Only transmits READY/Fully Paid invoices)
  const handleBatchHitFbr = async () => {
    const eligiblePool = readyInvoices;
    const idsToHit =
      selectedIds.length > 0
        ? selectedIds.filter((id) => eligiblePool.some((inv) => inv.id === id))
        : eligiblePool.map((i) => i.id);

    if (idsToHit.length === 0) {
      alert("No fully paid invoices are selected for FBR transmission.");
      return;
    }

    const confirmPrompt = language === "ur"
      ? `FBR پر ${idsToHit.length} انوائسز ارسال کریں؟\n\n- ہر انوائس 2 سیکنڈ کے وقفے سے محفوظ طریقے سے ہٹ ہوگی (FBR Rate-Limiting Protection).\n- قانونی Rs. 1/- POS فیس لاگو ہوگی۔\n- غیر ادا شدہ و ادھار انوائسز (${awaitingPaymentCount}) محفوظ طریقے سے روک لی گئی ہیں۔`
      : `Transmit ${idsToHit.length} fully paid invoice(s) to FBR?\n\n- Each invoice will transmit safely with a 2-second rate-limiting delay.\n- Statutory Rs. 1/- POS fee per invoice will be charged.\n- Partial & Credit invoices (${awaitingPaymentCount}) are safely held back.`;

    if (!confirm(confirmPrompt)) {
      return;
    }

    setIsBatchHitting(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (let i = 0; i < idsToHit.length; i++) {
        const id = idsToHit[i];
        const pct = Math.round(((i + 1) / idsToHit.length) * 100);

        setActionMessage({
          type: "info",
          text: language === "ur"
            ? `FBR ترسیل جاری ہے: ${i + 1} / ${idsToHit.length} (${pct}%)... کامیاب: ${successCount}`
            : `Transmitting to FBR: ${i + 1} of ${idsToHit.length} (${pct}%)... Transmitted: ${successCount}`,
        });

        if (i > 0) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        try {
          const res = await fetch("/api/compliance/fbr", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "transmit", invoiceId: id }),
          });
          const data = await res.json().catch(() => null);
          if (data?.success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch {
          failCount++;
        }
      }

      setActionMessage({
        type: failCount === 0 ? "success" : "info",
        text: language === "ur"
          ? `FBR ترسیل مکمل! کامیاب: ${successCount} انوائسز${failCount > 0 ? `، ناکام/روکی گئیں: ${failCount}` : ""}`
          : `FBR Transmission complete! Transmitted: ${successCount}${failCount > 0 ? `, Failed/Skipped: ${failCount}` : ""}`,
      });
      setSelectedIds([]);
      await loadCompliance();
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Batch transmission failed." });
    } finally {
      setIsBatchHitting(false);
    }
  };

  // Direct 1-Click Invoice Settlement Handler
  const handleSettleInvoice = async () => {
    if (!settleModalInvoice) return;
    setIsSettling(true);

    try {
      const balanceToClear = Number(settleModalInvoice.remainingAmount || 0);

      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "RECEIPT",
          saleId: settleModalInvoice.id,
          customerId: settleModalInvoice.customerId,
          amount: balanceToClear,
          paymentMethod: settleMethod,
          notes: `Settlement payment for invoice #${settleModalInvoice.invoiceNumber}`,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to record payment settlement");
      }

      setActionMessage({
        type: "success",
        text: `Invoice #${settleModalInvoice.invoiceNumber} balance of Rs. ${balanceToClear.toLocaleString()} settled successfully! It has been moved to "Ready to Hit FBR".`,
      });

      setSettleModalInvoice(null);
      setLockedInvoiceModal(null);
      await loadCompliance();
      setActiveTab("READY");
    } catch (err: any) {
      alert("Error settling invoice: " + err.message);
    } finally {
      setIsSettling(false);
    }
  };

  // Export Invoices to CSV
  const exportInvoicesToCsv = (customList?: any[]) => {
    const list = customList || filteredInvoices;
    if (list.length === 0) {
      alert("No invoices to export matching current filter.");
      return;
    }

    const headers = [
      "Invoice Number",
      "Date",
      "Customer (Buyer)",
      "Goods Subtotal",
      "Sales Tax (18% GST)",
      "POS Fee",
      "Total Amount",
      "Amount Paid",
      "Accounts Receivable (Balance)",
      "Payment Status",
      "Payment Method",
      "FBR Status",
      "FBR Invoice Number",
    ];

    const rows = list.map((inv) => [
      inv.invoiceNumber,
      new Date(inv.date).toLocaleDateString(),
      `"${(inv.customerName || "").replace(/"/g, '""')}"`,
      Number(inv.subtotal || 0).toFixed(2),
      Number(inv.salesTax || inv.taxAmount || 0).toFixed(2),
      Number(inv.posFee || 0).toFixed(2),
      Number(inv.totalAmount || 0).toFixed(2),
      Number(inv.paidAmount || 0).toFixed(2),
      Number(inv.remainingAmount || 0).toFixed(2),
      inv.paymentStatus || "PAID",
      inv.paymentMethod || "CASH",
      inv.fbrStatus || "PENDING",
      inv.fbrInvoiceNumber || "Un-transmitted",
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `FBR_Invoices_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Safe date formatter for clean date display without time
  const formatDateDisplay = (dateVal: any) => {
    if (!dateVal) return "-";
    try {
      const dStr = String(dateVal);
      if (dStr.includes("T")) {
        return dStr.split("T")[0];
      }
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return String(dateVal);
      return d.toISOString().slice(0, 10);
    } catch {
      return String(dateVal);
    }
  };

  // Toggle selection: selects all un-transmitted invoices in the current view
  const toggleSelectAll = () => {
    const selectable = filteredInvoices.filter(
      (inv) => !inv.fbrStatus || inv.fbrStatus !== "SUCCESS"
    );
    if (selectedIds.length === selectable.length && selectable.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(selectable.map((inv) => inv.id));
    }
  };

  const toggleSelectOne = (id: string, isSelectable: boolean = true) => {
    if (!isSelectable) return;
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  return (
    <div className="space-y-6 pb-24 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
              FBR Invoicing Center
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              SRO 1006(I) Controlled Portal
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">
            FBR Invoicing & POS Transmission Center
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Controlled transmission to FBR: Transmit fully paid invoices on demand, apply Rs. 1/- POS fee upon hit, settle pending partial balances in 1-click, and download or bulk-upload invoices.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Bulk Upload Button */}
          <Link
            href="/sales/import"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition"
          >
            <UploadCloud className="h-3.5 w-3.5 text-indigo-600" />
            <span>Bulk Upload (CSV)</span>
          </Link>

          {/* Download All Invoices Button */}
          <button
            onClick={() => exportInvoicesToCsv(allInvoices)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition"
          >
            <Download className="h-3.5 w-3.5 text-slate-600" />
            <span>Download All (CSV)</span>
          </button>

          {/* FBR Credit Notes Button */}
          <button
            onClick={() => setShowCreditNoteModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100 shadow-2xs transition"
            title="Issue FBR Credit Notes to negate duplicate hits"
          >
            <RotateCcw className="h-3.5 w-3.5 text-amber-700" />
            <span>{t("FBR Credit Notes (Reconcile)", "FBR کریڈٹ نوٹس")}</span>
          </button>

          {/* Create Sale Invoice */}
          <Link
            href="/sales/create"
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-sm transition"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create Sale Invoice</span>
          </Link>

          {/* Refresh */}
          <button
            onClick={loadCompliance}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition"
            title="Refresh Invoices"
          >
            <RotateCcw className={`h-3.5 w-3.5 text-slate-500 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Action Notification Alert */}
      {actionMessage && (
        <div
          className={`flex items-center justify-between rounded-xl p-3.5 text-xs font-medium border ${
            actionMessage.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-200"
              : actionMessage.type === "error"
              ? "bg-rose-50 text-rose-900 border-rose-200"
              : "bg-blue-50 text-blue-900 border-blue-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertOctagon className="h-4 w-4 text-rose-600 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-xs font-bold underline hover:opacity-80 ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Live FBR Gateway & Sandbox Sync Status Banner (Super Admin Only) */}
      {isSuperAdmin && (
        <div className="rounded-2xl border border-indigo-200/80 bg-gradient-to-r from-indigo-50/90 via-white to-blue-50/50 p-4 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  FBR Gateway: {complianceData?.config?.integrationType === "TIER1_POS" ? "Tier-1 Retail POS (IMS)" : "Digital Invoicing (DI)"}
                </span>
                <span className="rounded bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800 uppercase font-mono">
                  {complianceData?.config?.environment === "production" ? "LIVE PRODUCTION" : "SANDBOX"}
                </span>
                <span className="rounded bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800 uppercase font-mono">
                  {complianceData?.config?.integrationType === "TIER1_POS" ? "🛒 POS Retail (B2C)" : "🏷️ Digital Invoicing (B2B)"}
                </span>
                {complianceData?.config?.token ? (
                  <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                    ✓ Token Active
                  </span>
                ) : (
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                    ⚠️ Token Not Set (Using Sandbox Simulation)
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 font-mono">
                <span>
                  <strong>Post URL:</strong>{" "}
                  <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-700">
                    {complianceData?.config?.integrationType === "TIER1_POS"
                      ? complianceData?.config?.environment === "production"
                        ? "https://ims.fbr.gov.pk/api/Live/PostData"
                        : "https://gw.fbr.gov.pk/imsp/v1/api/Live/PostData"
                      : complianceData?.config?.environment === "production"
                      ? "https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata"
                      : "https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata_sb"}
                  </code>
                </span>
                <span>
                  <strong>Seller NTN:</strong>{" "}
                  {complianceData?.config?.sellerNtn || activeCompany?.ntn || "0000000000000"}
                </span>
                {complianceData?.config?.integrationType === "TIER1_POS" ? (
                  <span>
                    <strong>POS ID:</strong> {complianceData?.config?.posId || "200871"}
                  </span>
                ) : (
                  <span>
                    <strong>Scenario ID:</strong> {complianceData?.config?.scenarioId || "SN000"}
                  </span>
                )}
                <span>
                  <strong>Auto-Sync on Post:</strong>{" "}
                  {complianceData?.config?.autoSync ? (
                    <span className="text-emerald-700 font-bold">Enabled (Auto-POST)</span>
                  ) : (
                    <span className="text-slate-500">Manual Queue</span>
                  )}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleTestSandbox}
                disabled={testingConnection}
                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 shadow-2xs transition"
              >
                <Zap className={`h-3.5 w-3.5 text-indigo-600 ${testingConnection ? "animate-spin" : ""}`} />
                <span>{testingConnection ? "Testing Gateway..." : "Test Sandbox API"}</span>
              </button>

              <button
                onClick={() => setFbrConfigModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 shadow-sm transition"
              >
                <Settings className="h-3.5 w-3.5" />
                <span>FBR Credentials</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Ready to Hit (Fully Paid) */}
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-indigo-800 tracking-wider">
              Ready to Hit FBR
            </span>
            <span className="rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 border border-emerald-300">
              100% Paid
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold font-mono text-indigo-900">
            {readyCount}
          </p>
          <span className="text-[10px] text-indigo-700 flex items-center gap-1 mt-1 font-medium">
            <Clock className="h-3 w-3" /> Transmittable on demand (Rs. 0 POS fee yet)
          </span>
        </div>

        {/* Card 2: Awaiting Full Payment (Partial / Credit) */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-amber-900 tracking-wider">
              Awaiting Full Payment
            </span>
            <span className="rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 border border-amber-300 flex items-center gap-1">
              <Lock className="h-2.5 w-2.5" /> Protected
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold font-mono text-amber-800">
            {awaitingPaymentCount}
          </p>
          <span className="text-[10px] text-amber-700 flex items-center gap-1 mt-1 font-medium">
            <ShieldAlert className="h-3 w-3" /> 1-Click Settle available to unlock
          </span>
        </div>

        {/* Card 3: FBR Stamped */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-emerald-800 block tracking-wider">
            FBR Stamped (Transmitted)
          </span>
          <p className="mt-2 text-2xl font-bold font-mono text-emerald-700">
            {successCount}
          </p>
          <span className="text-[10px] text-emerald-600 flex items-center gap-1 mt-1 font-medium">
            <CheckCircle2 className="h-3 w-3" /> Verified Electronic Receipts
          </span>
        </div>

        {/* Card 4: POS Fees Charged */}
        <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 shadow-xs">
          <span className="text-[10px] uppercase font-bold text-blue-800 block tracking-wider">
            FBR POS Fees Charged
          </span>
          <p className="mt-2 text-2xl font-bold font-mono text-blue-700">
            Rs. {totalPosFees.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-blue-600 flex items-center gap-1 mt-1 font-medium">
            Rs. 1.00 per Transmitted Invoice
          </span>
        </div>
      </div>

      {/* Tax Safeguard Notice Banner */}
      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 text-xs text-indigo-950 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div className="rounded-xl bg-indigo-600 p-2 text-white shrink-0 mt-0.5 sm:mt-0">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <h4 className="font-bold text-indigo-950">
              Tax Protection Rule: Invoices with Remaining Balances Are Protected
            </h4>
            <p className="text-indigo-800/90 mt-0.5 leading-relaxed">
              If a customer has partially paid or bought on credit, their invoice is safely kept under <strong>"Awaiting Full Payment"</strong>. Use the <strong>"💳 Settle & Unlock"</strong> button on any row below to instantly clear the balance and unlock FBR transmission.
            </p>
          </div>
        </div>

        {readyCount > 0 && (
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleBatchHitFbr}
            isLoading={isBatchHitting}
            className="bg-indigo-600 hover:bg-indigo-700 shadow-sm shrink-0"
          >
            <Zap className="h-3.5 w-3.5 mr-1" />
            Hit All {readyCount} Ready Invoices
          </Button>
        )}
      </div>

      {/* Invoicing Table Section */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        {/* Table Header Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 px-5 py-4">
          {/* Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => {
                setActiveTab("READY");
                setSelectedIds([]);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === "READY"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Zap className="h-3.5 w-3.5" />
              <span>Ready to Hit FBR ({readyCount})</span>
            </button>

            <button
              onClick={() => {
                setActiveTab("AWAITING_PAYMENT");
                setSelectedIds([]);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === "AWAITING_PAYMENT"
                  ? "bg-amber-100 text-amber-900 border border-amber-300"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Lock className="h-3 w-3 text-amber-700" />
              <span>Awaiting Full Payment ({awaitingPaymentCount})</span>
            </button>

            <button
              onClick={() => {
                setActiveTab("SUCCESS");
                setSelectedIds([]);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === "SUCCESS"
                  ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
              <span>Transmitted & Verified ({successCount})</span>
            </button>

            <button
              onClick={() => {
                setActiveTab("ALL");
                setSelectedIds([]);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeTab === "ALL"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              All Invoices ({allInvoices.length})
            </button>
          </div>

          {/* Search, Export and Batch Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => exportInvoicesToCsv(filteredInvoices)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
              title="Download invoices in current tab as CSV"
            >
              <Download className="h-3.5 w-3.5 text-slate-500" />
              <span>Export Tab (CSV)</span>
            </button>

            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search invoice or customer..."
                className="rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none w-44 sm:w-52"
              />
            </div>

            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleBatchHitFbr}
                  isLoading={isBatchHitting}
                  className="bg-indigo-600 hover:bg-indigo-700 text-xs shadow-sm"
                >
                  <Zap className="h-3.5 w-3.5 mr-1" />
                  Hit Selected ({selectedIds.length})
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleBatchDelete}
                  isLoading={isBatchDeleting}
                  className="border-rose-300 text-rose-700 hover:bg-rose-50 hover:border-rose-400 text-xs shadow-sm"
                  title="Delete selected invoices from system"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1 text-rose-600" />
                  Delete Selected ({selectedIds.length})
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Tab Information Header */}
        {activeTab === "AWAITING_PAYMENT" && (
          <div className="bg-amber-50/70 border-b border-amber-200 px-5 py-2.5 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <span className="flex items-center gap-1.5 font-medium">
              <Lock className="h-3.5 w-3.5 text-amber-700 shrink-0" />
              These invoices have partial or zero payments. Click <strong>"Settle & Unlock"</strong> on any invoice to record customer payment and move it to Ready to Hit FBR!
            </span>
            <Link
              href="/payments"
              className="text-amber-800 font-bold underline hover:text-amber-950 inline-flex items-center gap-1 shrink-0"
            >
              <span>View Customer Ledgers</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}

        {/* Invoices Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              <tr>
                <th className="py-3 px-3 w-8 text-center">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-slate-500 hover:text-slate-800"
                    title="Select all un-transmitted invoices"
                  >
                    {selectedIds.length > 0 && selectedIds.length === filteredInvoices.filter((i) => !i.fbrStatus || i.fbrStatus !== "SUCCESS").length ? (
                      <CheckSquare className="h-4 w-4 text-indigo-600" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-3">Invoice #</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Customer (Buyer)</th>
                <th className="py-3 px-3">Payment & AR Balance</th>
                <th className="py-3 px-3 text-right">Goods Subtotal</th>
                <th className="py-3 px-3 text-right">Sales Tax</th>
                <th className="py-3 px-3 text-center">FBR POS Fee</th>
                <th className="py-3 px-3 text-right">Total Amount</th>
                <th className="py-3 px-3 text-center">FBR Status</th>
                <th className="py-3 px-3 text-center">FBR Reference</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {loading ? (
                <TableRowsSkeleton rows={6} cols={12} />
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-10 text-center text-slate-400">
                    {activeTab === "AWAITING_PAYMENT"
                      ? "No partial or credit invoices pending. All sales are either fully paid or transmitted!"
                      : activeTab === "READY"
                      ? "No fully paid invoices waiting to hit FBR. All clear!"
                      : "No invoices matching the current filter."}
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const isPending = !inv.fbrStatus || inv.fbrStatus === "PENDING";
                  const isSuccess = inv.fbrStatus === "SUCCESS";
                  const isFailed = inv.fbrStatus === "FAILED";
                  const isFullyPaid = inv.paymentStatus === "PAID";
                  const isPartial = inv.paymentStatus === "PARTIAL";
                  const isEligibleToHit = isPending && isFullyPaid;
                  const isSelectable = !isSuccess;
                  const isSelected = selectedIds.includes(inv.id);
                  const isHittingThis = hittingId === inv.id;

                  return (
                    <tr
                      key={inv.id}
                      className={`hover:bg-slate-50/60 transition ${
                        isSelected ? "bg-indigo-50/30" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center">
                        {isSelectable ? (
                          <button
                            type="button"
                            onClick={() => toggleSelectOne(inv.id, true)}
                            className="text-slate-400 hover:text-slate-700"
                            title={isEligibleToHit ? "Select for FBR Hit or Bulk Delete" : "Select for Bulk Delete"}
                          >
                            {isSelected ? (
                              <CheckSquare className="h-4 w-4 text-indigo-600" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </button>
                        ) : (
                          <span
                            className="inline-block cursor-not-allowed opacity-40 text-slate-400"
                            title="Invoice already transmitted to FBR"
                          >
                            <Lock className="h-3.5 w-3.5 mx-auto" />
                          </span>
                        )}
                      </td>

                      {/* Invoice Number */}
                      <td className="py-3 px-3 font-mono font-bold text-slate-900">
                        {inv.invoiceNumber}
                      </td>

                      {/* Date */}
                      <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                        {formatDateDisplay(inv.date)}
                      </td>

                      {/* Customer */}
                      <td className="py-3 px-3 font-medium text-slate-800">
                        {inv.customerName}
                      </td>

                      {/* Payment & AR Balance Status */}
                      <td className="py-3 px-3">
                        {isFullyPaid ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                            <Check className="h-2.5 w-2.5" /> PAID (100%)
                          </span>
                        ) : isPartial ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-300">
                              PARTIAL PAYMENT
                            </span>
                            <div className="text-[10px] font-mono text-rose-600 font-semibold">
                              AR Bal: Rs. {Number(inv.remainingAmount || 0).toLocaleString()}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-800 border border-rose-200">
                              CREDIT (0% PAID)
                            </span>
                            <div className="text-[10px] font-mono text-rose-600 font-semibold">
                              AR Bal: Rs. {Number(inv.remainingAmount || inv.totalAmount || 0).toLocaleString()}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Subtotal */}
                      <td className="py-3 px-3 text-right font-mono font-semibold text-slate-700">
                        Rs {Number(inv.subtotal || 0).toLocaleString()}
                      </td>

                      {/* Tax */}
                      <td className="py-3 px-3 text-right font-mono text-indigo-600 font-semibold">
                        Rs {Number(inv.salesTax || inv.taxAmount || 0).toLocaleString()}
                      </td>

                      {/* POS Fee */}
                      <td className="py-3 px-3 text-center">
                        {Number(inv.posFee || 0) >= 1 ? (
                          <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">
                            Rs. 1.00 Charged
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 border border-slate-200">
                            Rs 0.00 (Pending)
                          </span>
                        )}
                      </td>

                      {/* Total Amount */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        Rs {Number(inv.totalAmount).toLocaleString()}
                      </td>

                      {/* FBR Status */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                            isSuccess
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : isFailed
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : isEligibleToHit
                              ? "bg-indigo-50 text-indigo-800 border border-indigo-200"
                              : "bg-amber-50 text-amber-800 border border-amber-300"
                          }`}
                        >
                          {isSuccess && <Check className="h-3 w-3" />}
                          {isEligibleToHit && <Zap className="h-3 w-3 text-indigo-600" />}
                          {!isEligibleToHit && isPending && <Lock className="h-2.5 w-2.5 text-amber-700" />}
                          {isSuccess
                            ? "FBR Stamped"
                            : isFailed
                            ? "Failed"
                            : isEligibleToHit
                            ? "Ready to Hit"
                            : "Awaiting Full Pay"}
                        </span>
                      </td>

                      {/* FBR Reference */}
                      <td className="py-3 px-3 text-center font-mono text-[11px]">
                        {inv.fbrInvoiceNumber ? (
                          <span className="text-blue-700 font-semibold">
                            {inv.fbrInvoiceNumber}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px] italic">
                            Un-transmitted
                          </span>
                        )}
                      </td>

                      {/* Action Button */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handlePreviewPayload(inv)}
                            disabled={loadingPayloadId === inv.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:text-indigo-600 hover:bg-slate-50 shadow-2xs"
                            title="Preview FBR Digital Invoice JSON"
                          >
                            <Code className={`h-3 w-3 ${loadingPayloadId === inv.id ? "animate-spin text-indigo-600" : ""}`} />
                            <span>JSON</span>
                          </button>

                          {isSuccess ? (
                            <>
                              <button
                                type="button"
                                onClick={() => setSelectedReceiptInvoice(inv)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50 shadow-2xs"
                              >
                                <QrCode className="h-3.5 w-3.5" />
                                <span>View QR</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleTransmitCreditNote(inv)}
                                disabled={transmittingCreditNoteId === inv.id}
                                className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800 hover:bg-amber-100 shadow-2xs"
                                title="Transmit FBR Credit Note (InvoiceType 2) to reverse/cancel on FBR"
                              >
                                <RotateCcw className={`h-3 w-3 ${transmittingCreditNoteId === inv.id ? "animate-spin text-amber-700" : ""}`} />
                                <span>Credit Note</span>
                              </button>
                            </>
                          ) : isEligibleToHit ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="primary"
                              onClick={() => handleHitFbr(inv)}
                              isLoading={isHittingThis}
                              className="bg-indigo-600 hover:bg-indigo-700 text-xs px-2.5 py-1 shadow-2xs"
                            >
                              <Zap className="h-3 w-3 mr-1" />
                              Hit FBR
                            </Button>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              {/* 1-Click Settle Button */}
                              <button
                                type="button"
                                onClick={() => setSettleModalInvoice(inv)}
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 shadow-2xs transition"
                                title="Clear balance and unlock for FBR"
                              >
                                <Wallet className="h-3 w-3" />
                                <span>Settle & Unlock</span>
                              </button>

                              {/* Details modal */}
                              <button
                                type="button"
                                onClick={() => setLockedInvoiceModal(inv)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 text-slate-500 hover:bg-slate-50"
                                title="View Protection Details"
                              >
                                <Lock className="h-3 w-3 text-amber-600" />
                              </button>
                            </div>
                          )}

                          {/* Direct Edit link to Sales */}
                          <Link
                            href="/sales"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:text-indigo-600 hover:bg-slate-50 shadow-2xs transition"
                            title="Edit Invoice in Sales Ledger"
                          >
                            <Pencil className="h-3 w-3" />
                            <span>Edit</span>
                          </Link>

                          {/* Delete Invoice Button */}
                          <button
                            type="button"
                            onClick={() => handleDeleteInvoice(inv)}
                            disabled={deletingId === inv.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50/70 px-2 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 shadow-2xs transition"
                            title={
                              inv.fbrStatus === "SUCCESS"
                                ? "Delete Stamped Invoice (Reverses stock & ledger)"
                                : "Permanently Delete Invoice"
                            }
                          >
                            <Trash2 className={`h-3 w-3 ${deletingId === inv.id ? "animate-spin text-rose-600" : ""}`} />
                            <span>Delete</span>
                          </button>

                          {/* Reverse / Credit Note Button */}
                          {inv.status !== "CANCELLED" && (
                            <button
                              type="button"
                              onClick={() => handleReverseInvoice(inv)}
                              disabled={reversingId === inv.id}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 shadow-2xs transition"
                              title={
                                inv.fbrStatus === "SUCCESS"
                                  ? "Issue Credit Note / Sale Return for FBR Stamped Invoice"
                                  : "Cancel / Reverse Unverified Invoice"
                              }
                            >
                              <RotateCcw className={`h-3 w-3 ${reversingId === inv.id ? "animate-spin text-slate-600" : ""}`} />
                              <span>{inv.fbrStatus === "SUCCESS" ? "Credit Note" : "Reverse"}</span>
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
      </div>

      {/* 1-CLICK SETTLEMENT MODAL (Settle Balance & Move to Ready to Hit) */}
      {settleModalInvoice && (
        <Modal
          isOpen={true}
          onClose={() => setSettleModalInvoice(null)}
          title="Settle Invoice Balance & Unlock for FBR"
          description="Clear the outstanding Accounts Receivable balance to immediately make this invoice eligible to hit FBR."
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-emerald-950 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-900 text-sm">
                  Invoice #{settleModalInvoice.invoiceNumber}
                </span>
                <span className="font-bold rounded bg-emerald-200/80 px-2 py-0.5 text-[10px] text-emerald-900">
                  Customer: {settleModalInvoice.customerName}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-emerald-200 text-slate-700">
                <div>
                  <span className="text-[10px] text-slate-500 block">Total Invoice:</span>
                  <span className="font-bold font-mono">Rs {Number(settleModalInvoice.totalAmount || 0).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Previously Paid:</span>
                  <span className="font-bold font-mono text-emerald-700">Rs {Number(settleModalInvoice.paidAmount || 0).toLocaleString()}</span>
                </div>
              </div>
              <div className="pt-2 border-t border-emerald-200 flex items-center justify-between">
                <span className="font-bold text-emerald-900">Remaining Balance to Clear:</span>
                <span className="font-bold font-mono text-base text-rose-700">
                  Rs {Number(settleModalInvoice.remainingAmount || 0).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Payment Method Selection */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 block">Received Into Account:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSettleMethod("CASH")}
                  className={`rounded-xl border p-2.5 text-left transition ${
                    settleMethod === "CASH"
                      ? "border-emerald-600 bg-emerald-50 text-emerald-950 font-bold"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <div className="font-semibold">💵 Cash in Hand</div>
                  <div className="text-[10px] text-slate-500">Account 1010</div>
                </button>
                <button
                  type="button"
                  onClick={() => setSettleMethod("BANK")}
                  className={`rounded-xl border p-2.5 text-left transition ${
                    settleMethod === "BANK"
                      ? "border-emerald-600 bg-emerald-50 text-emerald-950 font-bold"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <div className="font-semibold">🏦 Bank Account</div>
                  <div className="text-[10px] text-slate-500">Account 1020</div>
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Clicking <strong>Confirm & Clear Balance</strong> will record the customer receipt, debit cash/bank, credit Accounts Receivable, and immediately move this invoice to the <strong>Ready to Hit FBR</strong> tab.
            </p>

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setSettleModalInvoice(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleSettleInvoice}
                isLoading={isSettling}
                className="bg-emerald-600 hover:bg-emerald-700 text-xs px-4"
              >
                <Check className="h-4 w-4 mr-1.5" /> Confirm & Clear Balance
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* LOCKED PARTIAL / CREDIT INVOICE EXPLAINER DIALOG */}
      {lockedInvoiceModal && (
        <Modal
          isOpen={true}
          onClose={() => setLockedInvoiceModal(null)}
          title="FBR Transmission Withheld: Incomplete Payment"
          description="Invoices with outstanding balances are protected from FBR transmission under Pakistani tax rules."
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950 space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
                <Lock className="h-4 w-4 text-amber-700" />
                <span>Invoice #{lockedInvoiceModal.invoiceNumber} Is Protected</span>
              </div>
              <p className="text-amber-800 leading-relaxed">
                Customer <strong>{lockedInvoiceModal.customerName}</strong> currently owes an outstanding balance of{" "}
                <span className="font-bold font-mono text-rose-700 text-sm">
                  Rs. {Number(lockedInvoiceModal.remainingAmount || 0).toLocaleString()}
                </span>{" "}
                against this invoice.
              </p>
            </div>

            <div className="space-y-2 text-slate-600">
              <h5 className="font-bold text-slate-800">Why is this invoice blocked from hitting FBR?</h5>
              <ul className="list-disc pl-4 space-y-1 text-[11px]">
                <li>
                  Transmitting to FBR immediately creates a legal sales tax liability (18% GST + Rs. 1 POS fee) payable to the government.
                </li>
                <li>
                  Because this is a partial or credit sale, sending it to FBR before collecting full payment puts your cash flow at risk.
                </li>
                <li>
                  You can click <strong>"Settle & Unlock Now"</strong> below to record the payment and move it straight to Ready to Hit!
                </li>
              </ul>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setLockedInvoiceModal(null)}
              >
                Close
              </Button>
              <Button
                type="button"
                variant="primary"
                className="bg-emerald-600 hover:bg-emerald-700 text-xs"
                onClick={() => {
                  const inv = lockedInvoiceModal;
                  setLockedInvoiceModal(null);
                  setSettleModalInvoice(inv);
                }}
              >
                <Wallet className="h-3.5 w-3.5 mr-1" /> Settle & Unlock Now
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* FBR RECEIPT & QR CODE DIALOG */}
      {selectedReceiptInvoice && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedReceiptInvoice(null)}
          title="FBR Stamped Fiscal Invoice"
          description="Verified electronic fiscal receipt recorded under Pakistani Sales Tax Act, 1990"
          maxWidth="2xl"
        >
          <div className="space-y-5">
            {/* Header Stamp */}
            <div className="flex items-center justify-between rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-emerald-900">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-emerald-600 p-2 text-white">
                  <Check className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">Invoice Fiscalized & Stamped Successfully</h4>
                  <p className="text-xs text-emerald-700">
                    System Invoice: <strong>{selectedReceiptInvoice.invoiceNumber}</strong>
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-100 border border-emerald-300 px-3 py-1 font-mono text-xs font-bold text-emerald-800">
                SRO-1006(I) Verified
              </span>
            </div>

            {/* Receipt Details */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <div className="flex justify-between items-start border-b border-slate-200 pb-3">
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    {fbrConfigForm.sellerBusinessName || activeCompany?.name || "ENTERPRISE BUSINESS PORTAL"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {(activeCompany as any)?.strn ? `STRN: ${(activeCompany as any).strn} • ` : ""}NTN: {fbrConfigForm.sellerNtn || (activeCompany as any)?.ntn || "N/A"}{fbrConfigForm.posId ? ` • POS ID: ${fbrConfigForm.posId}` : ""}
                  </p>
                  <p className="text-xs text-slate-500">
                    Buyer: <strong>{selectedReceiptInvoice.customerName}</strong>
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    FBR INVOICE NUMBER
                  </span>
                  <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 inline-block mt-0.5">
                    {selectedReceiptInvoice.fbrInvoiceNumber}
                  </span>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {new Date(selectedReceiptInvoice.date).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* QR Code and Tax Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center pt-2">
                {/* Visual QR Code Box */}
                <div className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-200 bg-slate-50 text-center">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-300 shadow-xs mb-2 flex items-center justify-center">
                    <FbrQrCode
                      value={selectedReceiptInvoice.fbrInvoiceNumber || selectedReceiptInvoice.invoiceNumber || ""}
                      size={130}
                    />
                  </div>
                  <span className="text-[11px] font-mono text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Scan via Mobile Camera / Tax Asaan App
                  </span>
                  
                  <div className="flex flex-col gap-1 mt-2 w-full">
                    <a
                      href={`/verify/fbr?inv=${encodeURIComponent(selectedReceiptInvoice.fbrInvoiceNumber || selectedReceiptInvoice.invoiceNumber || "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-emerald-700 hover:text-emerald-900 hover:underline inline-flex items-center justify-center gap-1 font-semibold bg-emerald-50/80 py-1 px-2 rounded border border-emerald-200/80 transition"
                    >
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      <span>View Verified Fiscal e-Receipt</span>
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                    <a
                      href="https://iris.fbr.gov.pk/#verifications"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-indigo-600 hover:underline inline-flex items-center justify-center gap-1 font-medium mt-0.5"
                    >
                      <span>Verify on FBR IRIS Portal</span>
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-200 w-full text-[10px] text-slate-500 font-mono">
                    SMS: <span className="font-bold text-slate-700">9966</span> (INV &lt;CNIC&gt; {selectedReceiptInvoice.fbrInvoiceNumber || ""})
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Taxable Goods Value:</span>
                    <span className="font-mono font-bold text-slate-800">
                      Rs {Number(selectedReceiptInvoice.subtotal || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Sales Tax (18% GST):</span>
                    <span className="font-mono font-bold text-slate-800">
                      Rs {Number(selectedReceiptInvoice.salesTax || selectedReceiptInvoice.taxAmount || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 bg-blue-50/60 px-2 rounded">
                    <span className="font-semibold text-blue-900">Statutory POS Fee:</span>
                    <span className="font-mono font-bold text-blue-900">
                      Rs {Number(selectedReceiptInvoice.posFee || 1.0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-t border-slate-200 text-sm">
                    <span className="font-bold text-slate-900">Grand Total Payable:</span>
                    <span className="font-mono font-bold text-indigo-600">
                      Rs {Number(selectedReceiptInvoice.totalAmount).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setSelectedReceiptInvoice(null)}
              >
                Close
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => window.print()}
                >
                  <Printer className="h-4 w-4 mr-1.5" />
                  Print Stamped Invoice
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => {
                    setSelectedReceiptInvoice(null);
                    setActiveTab("SUCCESS");
                  }}
                >
                  <Check className="h-4 w-4 mr-1.5" />
                  Done
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ── 1. FBR DIGITAL INVOICING CONFIGURATION MODAL ── */}
      {isSuperAdmin && fbrConfigModal && (
        <Modal
          isOpen={true}
          onClose={() => setFbrConfigModal(false)}
          title="FBR Compliance & Tax Gateway Configuration"
          description="Configure your official FBR credentials and select whether this company transmits via Digital Invoicing (DI) or Tier-1 Retail POS (IMS)."
          maxWidth="lg"
        >
          <form onSubmit={handleSaveFbrConfig} className="space-y-4 text-xs">
            {/* Mode / Integration Engine */}
            <div className="rounded-xl border border-indigo-200 bg-white p-3 space-y-2">
              <label className="block text-[11px] font-bold text-slate-800 uppercase tracking-wide">
                {t("FBR Integration Mode / Engine", "FBR طریقہ کار / انٹیگریشن انجن")}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setFbrConfigForm({ ...fbrConfigForm, integrationType: "DIGITAL_INVOICING" })}
                  className={`p-2.5 rounded-xl border text-left transition ${
                    fbrConfigForm.integrationType === "DIGITAL_INVOICING"
                      ? "bg-indigo-50 border-indigo-600 ring-2 ring-indigo-500/20 shadow-xs"
                      : "bg-slate-50/60 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <p className="font-bold text-xs text-indigo-950 flex items-center gap-1">
                    <span>🏷️</span> Digital Invoicing (DI)
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                    B2B Wholesale. Sales Tax schedules & Scenario IDs.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setFbrConfigForm({ ...fbrConfigForm, integrationType: "TIER1_POS" })}
                  className={`p-2.5 rounded-xl border text-left transition ${
                    fbrConfigForm.integrationType === "TIER1_POS"
                      ? "bg-purple-50 border-purple-600 ring-2 ring-purple-500/20 shadow-xs"
                      : "bg-slate-50/60 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <p className="font-bold text-xs text-purple-950 flex items-center gap-1">
                    <span>🛒</span> Tier-1 Retail POS (IMS)
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                    B2C Counter POS. Rs. 1 POS fee & 18-digit QR code.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setFbrConfigForm({ ...fbrConfigForm, integrationType: "BOTH" })}
                  className={`p-2.5 rounded-xl border text-left transition ${
                    fbrConfigForm.integrationType === "BOTH"
                      ? "bg-blue-50 border-blue-600 ring-2 ring-blue-500/20 shadow-xs"
                      : "bg-slate-50/60 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <p className="font-bold text-xs text-blue-950 flex items-center gap-1">
                    <span>⚡</span> Both (DI + Retail POS)
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                    Dual Mode: B2B to DI, Walk-in retail to POS IMS.
                  </p>
                </button>
              </div>
            </div>

            {/* Gateway Environment */}
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-indigo-950">Gateway Environment</span>
                <span className="rounded bg-indigo-200/80 px-2 py-0.5 text-[10px] font-bold text-indigo-900 font-mono">
                  {fbrConfigForm.integrationType === "TIER1_POS"
                    ? "ims.fbr.gov.pk / gw.fbr.gov.pk"
                    : fbrConfigForm.integrationType === "BOTH"
                    ? "gw + ims.fbr.gov.pk"
                    : "gw.fbr.gov.pk"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFbrConfigForm({ ...fbrConfigForm, environment: "sandbox" })}
                  className={`py-2 px-3 rounded-lg text-xs font-bold border transition ${
                    fbrConfigForm.environment === "sandbox"
                      ? "bg-indigo-600 text-white border-indigo-700 shadow-xs"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  🧪 Sandbox Testing (_sb)
                </button>
                <button
                  type="button"
                  onClick={() => setFbrConfigForm({ ...fbrConfigForm, environment: "production" })}
                  className={`py-2 px-3 rounded-lg text-xs font-bold border transition ${
                    fbrConfigForm.environment === "production"
                      ? "bg-indigo-600 text-white border-indigo-700 shadow-xs"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  🏢 Production Live
                </button>
              </div>
              <p className="text-[10px] text-slate-500 font-mono">
                Active Endpoint:{" "}
                <span className="text-indigo-700 font-bold break-all">
                  {fbrConfigForm.integrationType === "TIER1_POS"
                    ? (fbrConfigForm.environment === "production"
                        ? "https://ims.fbr.gov.pk/api/Live/PostData"
                        : "https://gw.fbr.gov.pk/imsp/v1/api/Live/PostData")
                    : (fbrConfigForm.environment === "production"
                        ? "https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata"
                        : "https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata_sb")}
                </span>
              </p>
            </div>

            {/* Bearer Token */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                FBR Bearer Security Token (API Key / Token) *
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Paste your FBR Bearer Token here..."
                  value={fbrConfigForm.token}
                  onChange={(e) => setFbrConfigForm({ ...fbrConfigForm, token: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:border-indigo-500 focus:outline-none pr-24"
                />
                <button
                  type="button"
                  onClick={handleTestSandbox}
                  disabled={testingConnection}
                  className="absolute right-1.5 top-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-[10px] font-bold text-indigo-700 hover:bg-indigo-100 border border-indigo-200"
                >
                  {testingConnection ? "Testing..." : "Test Token"}
                </button>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Obtained from FBR IRIS / POS Developer Portal. Used in HTTP header:{" "}
                <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">Authorization: Bearer &lt;token&gt;</code>
              </p>
            </div>

            {/* Scenario & POS ID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  POS Registration ID {fbrConfigForm.integrationType !== "DIGITAL_INVOICING" ? "*" : ""}
                </label>
                <input
                  type="text"
                  placeholder="822646"
                  value={fbrConfigForm.posId}
                  onChange={(e) => setFbrConfigForm({ ...fbrConfigForm, posId: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {fbrConfigForm.integrationType === "TIER1_POS"
                    ? "Official POS ID registered on e.fbr.gov.pk (e.g. 822646)"
                    : "Assigned by FBR for this branch/till"}
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Scenario ID {fbrConfigForm.integrationType === "DIGITAL_INVOICING" ? "(DI)" : "(Optional)"}
                </label>
                <input
                  type="text"
                  placeholder="SN000"
                  value={fbrConfigForm.scenarioId}
                  onChange={(e) => setFbrConfigForm({ ...fbrConfigForm, scenarioId: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-0.5">Standard default: SN000</p>
              </div>
            </div>

            {/* Seller Tax Profile */}
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5">
              <span className="text-[11px] font-bold text-slate-800 uppercase block">
                Seller Information (FBR Header Data)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Seller NTN / CNIC</label>
                  <input
                    type="text"
                    value={fbrConfigForm.sellerNtn}
                    onChange={(e) => setFbrConfigForm({ ...fbrConfigForm, sellerNtn: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Seller Province</label>
                  <select
                    value={fbrConfigForm.sellerProvince}
                    onChange={(e) => setFbrConfigForm({ ...fbrConfigForm, sellerProvince: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900"
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
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Seller Address</label>
                <input
                  type="text"
                  value={fbrConfigForm.sellerAddress}
                  onChange={(e) => setFbrConfigForm({ ...fbrConfigForm, sellerAddress: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900"
                />
              </div>
            </div>

            {/* Auto-Sync Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white">
              <div>
                <span className="font-bold text-slate-800 text-xs block">
                  Automatic FBR Sync on Sale Post
                </span>
                <p className="text-[11px] text-slate-500">
                  When enabled, fully-paid sales will automatically transmit to FBR as soon as they are posted.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(fbrConfigForm.autoSync)}
                  onChange={(e) => setFbrConfigForm({ ...fbrConfigForm, autoSync: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="secondary" onClick={() => setFbrConfigModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={savingConfig} className="bg-indigo-600 hover:bg-indigo-700">
                Save FBR Settings
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── 2. LIVE FBR GATEWAY TEST RESULT MODAL ── */}
      {testResultModal && (
        <Modal
          isOpen={true}
          onClose={() => setTestResultModal(null)}
          title="FBR Gateway Connection Test Result"
          description="Live diagnostic response from gw.fbr.gov.pk"
          maxWidth="md"
        >
          <div className="space-y-3.5 text-xs">
            <div
              className={`p-3.5 rounded-xl border ${
                testResultModal.success
                  ? "bg-emerald-50 text-emerald-950 border-emerald-300"
                  : "bg-amber-50 text-amber-950 border-amber-300"
              }`}
            >
              <div className="flex items-center gap-2 font-bold mb-1">
                {testResultModal.success ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <AlertOctagon className="h-4 w-4 text-amber-600" />
                )}
                <span>
                  {testResultModal.success
                    ? "✓ Connection Verified by FBR"
                    : `HTTP ${testResultModal.statusCode || 401} Response from Gateway`}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed">{testResultModal.message}</p>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Target Endpoint
              </span>
              <code className="block bg-slate-900 text-slate-100 p-2.5 rounded-lg text-[11px] font-mono break-all">
                {testResultModal.endpoint || "https://gw.fbr.gov.pk/di_data/v1/di/validateinvoicedata_sb"}
              </code>
            </div>

            {testResultModal.fbrResponse && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Raw Gateway Response Body
                </span>
                <pre className="bg-slate-900 text-emerald-400 p-3 rounded-xl text-[10px] font-mono overflow-x-auto max-h-56">
                  {JSON.stringify(testResultModal.fbrResponse, null, 2)}
                </pre>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button type="button" variant="primary" onClick={() => setTestResultModal(null)}>
                Dismiss
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── 3. FBR JSON PAYLOAD INSPECTOR MODAL ── */}
      {payloadModal && (
        <Modal
          isOpen={true}
          onClose={() => setPayloadModal(null)}
          title={`FBR Digital Invoicing Payload — #${payloadModal.invoiceNumber}`}
          description="Exact JSON schema sent to gw.fbr.gov.pk according to official FBR specifications."
          maxWidth="lg"
        >
          <div className="space-y-3.5 text-xs">
            <div className="flex items-center justify-between bg-slate-100 px-3 py-2 rounded-lg text-[11px] font-mono">
              <span className="truncate text-slate-700">
                <strong>POST:</strong> {payloadModal.endpoint}
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(payloadModal.payload, null, 2));
                  setCopiedPayload(true);
                  setTimeout(() => setCopiedPayload(false), 2000);
                }}
                className="inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded text-xs font-bold text-slate-700 border border-slate-200 hover:bg-slate-50 shrink-0 ml-2"
              >
                {copiedPayload ? (
                  <>
                    <CheckCheck className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-slate-500" />
                    <span>Copy JSON</span>
                  </>
                )}
              </button>
            </div>

            <pre className="bg-slate-900 text-emerald-400 p-4 rounded-xl text-[11px] font-mono overflow-x-auto max-h-96">
              {JSON.stringify(payloadModal.payload, null, 2)}
            </pre>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="secondary" onClick={() => setPayloadModal(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── 4. FBR CREDIT NOTE & RECONCILIATION MODAL ── */}
      {showCreditNoteModal && (
        <Modal
          isOpen={true}
          onClose={() => !isTransmittingCreditNotes && setShowCreditNoteModal(false)}
          title={language === "ur" ? "FBR کریڈٹ نوٹس اور ڈپلیکیٹ ایڈجسٹمنٹ" : "FBR Credit Notes & Duplicate Reconciliation"}
          description={
            language === "ur"
              ? "FBR پورٹل پر اضافی / ڈپلیکیٹ انوائسز کے لیے سرکاری کریڈٹ نوٹس (InvoiceType 2) بھیجیں۔ مقامی کھاتے اور اسٹاک محفوظ رہے گا۔"
              : "Transmit official FBR Credit Notes (InvoiceType 2) to reverse duplicate entries directly on FBR without affecting your local sales."
          }
          maxWidth="2xl"
        >
          <div className="space-y-4 text-xs">
            {/* Explanatory Notice */}
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900 flex items-start gap-2.5">
              <RotateCcw className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1 text-[11px] leading-relaxed">
                <p className="font-bold">
                  {language === "ur"
                    ? "قواعد و ضوابط: FBR سیلز ریورسل (InvoiceType: 2)"
                    : "Statutory Rule: FBR Sales Reversal via InvoiceType 2 (Credit Note)"}
                </p>
                <p>
                  {language === "ur"
                    ? "FBR POS سسٹم میں ایک بار جمع شدہ انوائس کو براہ راست ڈیلیٹ نہیں کیا جا سکتا، بلکہ FBR کے قانون کے مطابق InvoiceType 2 کریڈٹ نوٹ کے ذریعے رقم اور ٹیکس منفی کیا جاتا ہے۔"
                    : "Under FBR POS regulations, submitted invoices cannot be deleted. FBR requires an InvoiceType 2 (Credit Note) with RefUSIN to deduct sales turnover and sales tax liability on the portal."}
                </p>
              </div>
            </div>

            {/* Mode Tabs */}
            <div className="flex border-b border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setCreditNoteTab("list")}
                className={`py-2 px-4 border-b-2 transition ${
                  creditNoteTab === "list"
                    ? "border-amber-600 text-amber-800 bg-amber-50/50"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                {language === "ur" ? "لسٹ سے انتخاب کریں" : "Select from FBR Stamped List"}
              </button>
              <button
                type="button"
                onClick={() => setCreditNoteTab("paste")}
                className={`py-2 px-4 border-b-2 transition ${
                  creditNoteTab === "paste"
                    ? "border-amber-600 text-amber-800 bg-amber-50/50"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                {language === "ur" ? "انوائس نمبر پیسٹ کریں (بلک)" : "Quick Paste Numbers (Bulk)"}
              </button>
            </div>

            {creditNoteTab === "list" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder={language === "ur" ? "انوائس نمبر یا کسٹمر سے تلاش کریں..." : "Search by invoice # or customer..."}
                      value={creditNoteSearch}
                      onChange={(e) => setCreditNoteSearch(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const stamped = (complianceData?.sales || []).filter((s: any) => s.fbrStatus === "SUCCESS");
                        setSelectedCreditNoteIds(stamped.map((s: any) => s.id));
                      }}
                      className="px-2.5 py-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100"
                    >
                      {language === "ur" ? "تمام منتخب کریں" : "Select All"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedCreditNoteIds([])}
                      className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100"
                    >
                      {language === "ur" ? "صاف کریں" : "Clear"}
                    </button>
                  </div>
                </div>

                {/* Stamped List Table */}
                <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white">
                  {(() => {
                    const stamped = (complianceData?.sales || []).filter((s: any) => s.fbrStatus === "SUCCESS");
                    const filtered = stamped.filter((s: any) => {
                      if (!creditNoteSearch) return true;
                      const q = creditNoteSearch.toLowerCase();
                      return (
                        s.invoiceNumber?.toLowerCase().includes(q) ||
                        s.fbrInvoiceNumber?.toLowerCase().includes(q) ||
                        s.customer?.name?.toLowerCase().includes(q)
                      );
                    });

                    if (filtered.length === 0) {
                      return (
                        <div className="p-6 text-center text-slate-400">
                          {language === "ur" ? "کوئی FBR منظور شدہ انوائس نہیں ملی۔" : "No matching FBR stamped invoices found."}
                        </div>
                      );
                    }

                    return filtered.map((inv: any) => {
                      const isSelected = selectedCreditNoteIds.includes(inv.id);
                      return (
                        <div
                          key={inv.id}
                          onClick={() => {
                            setSelectedCreditNoteIds((prev) =>
                              isSelected ? prev.filter((id) => id !== inv.id) : [...prev, inv.id]
                            );
                          }}
                          className={`flex items-center justify-between p-2.5 cursor-pointer text-xs transition ${
                            isSelected ? "bg-amber-50/70" : "hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}} // handled by parent div onClick
                              className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 pointer-events-none"
                            />
                            <div className="min-w-0">
                              <span className="font-bold text-slate-800">#{inv.invoiceNumber}</span>
                              <span className="text-[10px] text-slate-400 ml-2">
                                {inv.customer?.name || "Walk-in Customer"}
                              </span>
                              <span className="block text-[10px] font-mono text-emerald-700">
                                FBR #{inv.fbrInvoiceNumber || "Stamped"}
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-bold text-slate-900 block">
                              PKR {Number(inv.totalAmount || 0).toLocaleString()}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Tax: PKR {Number(inv.taxAmount || 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="block text-slate-700 font-medium">
                  {language === "ur"
                    ? "انوائس نمبرز پیسٹ کریں (کوما یا نئی لائن کے ذریعے جدا کریں):"
                    : "Paste Invoice Numbers or FBR Numbers (comma or newline separated):"}
                </label>
                <textarea
                  rows={5}
                  value={creditNotePastedText}
                  onChange={(e) => setCreditNotePastedText(e.target.value)}
                  placeholder="e.g.&#10;INV-2026-0001&#10;INV-2026-0002&#10;INV-2026-0003"
                  className="w-full rounded-xl border border-slate-200 p-3 font-mono text-xs text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      const tokens = creditNotePastedText
                        .split(/[\s,;\n\r\t]+/)
                        .map((t) => t.trim().toLowerCase())
                        .filter(Boolean);

                      if (tokens.length === 0) {
                        alert("Please paste at least one invoice number.");
                        return;
                      }

                      const stamped = (complianceData?.sales || []).filter((s: any) => s.fbrStatus === "SUCCESS");
                      const matched = stamped.filter((s: any) => {
                        const inv = (s.invoiceNumber || "").toLowerCase();
                        const fbr = (s.fbrInvoiceNumber || "").toLowerCase();
                        return tokens.some((t) => inv === t || fbr === t || inv.endsWith(t));
                      });

                      const matchedIds = matched.map((s: any) => s.id);
                      setSelectedCreditNoteIds(Array.from(new Set([...selectedCreditNoteIds, ...matchedIds])));
                      alert(
                        language === "ur"
                          ? `${matchedIds.length} انوائسز مل گئیں اور منتخب کر لی گئیں۔`
                          : `Successfully matched and selected ${matchedIds.length} invoice(s).`
                      );
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg font-bold text-xs hover:bg-amber-700 transition"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>{language === "ur" ? "انوائسز تلاش کریں اور منتخب کریں" : "Match & Select Invoices"}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Selection Summary Banner */}
            {(() => {
              const stamped = (complianceData?.sales || []).filter((s: any) => s.fbrStatus === "SUCCESS");
              const selectedSales = stamped.filter((s: any) => selectedCreditNoteIds.includes(s.id));
              const totalAmount = selectedSales.reduce((acc: number, s: any) => acc + (Number(s.totalAmount) || 0), 0);
              const totalTax = selectedSales.reduce((acc: number, s: any) => acc + (Number(s.taxAmount) || 0), 0);

              return (
                <div className="rounded-xl bg-slate-900 text-white p-3.5 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-amber-400 block tracking-wider">
                      {language === "ur" ? "منتخب شدہ ریورسل سمری" : "Credit Note Reversal Summary"}
                    </span>
                    <span className="text-sm font-extrabold text-white">
                      {selectedSales.length} {language === "ur" ? "انوائسز منتخب" : "Invoice(s) Selected"}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-emerald-300 block">
                      PKR {totalAmount.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Tax Reversal: PKR {totalTax.toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="secondary"
                disabled={isTransmittingCreditNotes}
                onClick={() => setShowCreditNoteModal(false)}
              >
                {language === "ur" ? "بند کریں" : "Cancel"}
              </Button>

              <Button
                type="button"
                variant="primary"
                isLoading={isTransmittingCreditNotes}
                disabled={selectedCreditNoteIds.length === 0 || isTransmittingCreditNotes}
                onClick={() => {
                  const stamped = (complianceData?.sales || []).filter((s: any) => s.fbrStatus === "SUCCESS");
                  const selectedSales = stamped.filter((s: any) => selectedCreditNoteIds.includes(s.id));
                  handleBatchTransmitCreditNotes(selectedSales);
                }}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                {isTransmittingCreditNotes
                  ? language === "ur"
                    ? "ارسال ہو رہا ہے..."
                    : "Transmitting..."
                  : language === "ur"
                  ? `${selectedCreditNoteIds.length} کریڈٹ نوٹس FBR کو بھیجیں`
                  : `Transmit ${selectedCreditNoteIds.length} Credit Note(s) to FBR`}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
