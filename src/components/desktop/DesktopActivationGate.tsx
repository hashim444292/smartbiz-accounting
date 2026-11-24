"use client";

import React, { useState, useEffect } from "react";
import {
  Laptop,
  KeyRound,
  ShieldAlert,
  CheckCircle2,
  Copy,
  ExternalLink,
  MessageCircle,
  Sparkles,
  Store,
  Building2,
  Receipt,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/context/LanguageContext";

export interface DesktopLicenseState {
  isDesktop: boolean;
  isActivated: boolean;
  machineId: string;
  packageType?: "ACCOUNTING_ONLY" | "POS_COMBO" | "DI_COMBO";
  expiresAt?: string;
  daysRemaining?: number;
  isGracePeriod?: boolean;
  isExpired?: boolean;
  clientName?: string;
  error?: string;
}

interface DesktopActivationGateProps {
  onActivated?: () => void;
  allowClose?: boolean;
  onClose?: () => void;
}

export default function DesktopActivationGate({
  onActivated,
  allowClose = false,
  onClose,
}: DesktopActivationGateProps) {
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [state, setState] = useState<DesktopLicenseState | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [clientNameInput, setClientNameInput] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [copied, setCopied] = useState(false);

  // Fetch machine ID and activation status
  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/desktop/license");
      const json = await res.json();
      if (json.success) {
        setState({
          isDesktop: json.isDesktop,
          isActivated: json.isActivated,
          machineId: json.machineId,
          packageType: json.packageType,
          expiresAt: json.expiresAt,
          daysRemaining: json.daysRemaining,
          isGracePeriod: json.isGracePeriod,
          isExpired: json.isExpired,
          clientName: json.clientName,
          error: json.error,
        });
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to contact local license daemon");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleCopyMachineId = () => {
    if (!state?.machineId) return;
    navigator.clipboard.writeText(state.machineId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsAppShare = () => {
    if (!state?.machineId) return;
    const msg =
      language === "ur"
        ? `سلام، میرا Accounts360 مشین کوڈ یہ ہے: *${state.machineId}*\nبرائے مہربانی میری سالانہ لائسنس ایکٹیویشن کی (Key) فراہم کر دیں۔`
        : `Salam, my Accounts360 Hardware Machine Code is: *${state.machineId}*.\nPlease issue my annual software activation key.`;
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyInput.trim()) {
      setErrorMessage(t("Please enter your product license key.", "براہ کرم پروڈکٹ لائسنس کی درج کریں۔"));
      return;
    }

    setActivating(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const res = await fetch("/api/desktop/license", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenseKey: keyInput.trim().toUpperCase(),
          clientName: clientNameInput.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setSuccessMessage(
          language === "ur"
            ? `مبارک ہو! سافٹ ویئر کامیابی سے رجسٹر ہو گیا ہے۔ پیکج: ${json.verification?.packageType}`
            : `Success! Software activated successfully. Unlocked Package: ${json.verification?.packageType}`
        );
        fetchStatus();
        if (onActivated) {
          setTimeout(onActivated, 1500);
        }
      } else {
        setErrorMessage(json.error || "Activation failed. Please check key.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Network error communicating with license system");
    } finally {
      setActivating(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
        <div className="flex flex-col items-center gap-3 text-white">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold tracking-wide">
            {t("Inspecting Computer Hardware Signature...", "کمپیوٹر ہارڈویئر سگنیچر کی جانچ ہو رہی ہے...")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white border-b border-indigo-900/40 relative">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Laptop className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black tracking-tight text-white">
                    Accounts360 Desktop
                  </h2>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 font-bold uppercase">
                    Offline Edition
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  {t(
                    "Cryptographic Hardware-Locked Offline Licensing",
                    "محفوظ آف لائن ہارڈویئر لاک لائسنسنگ سسٹم"
                  )}
                </p>
              </div>
            </div>

            {allowClose && onClose && (
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white transition text-xs font-bold px-2.5 py-1 rounded-lg hover:bg-white/10"
              >
                ✕ Close
              </button>
            )}
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Status Alert if expired or grace period */}
          {state?.isExpired && (
            <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold text-red-900 dark:text-red-200">
                  {t("Annual License Has Expired", "سالانہ لائسنس کی میعاد ختم ہو چکی ہے")}
                </p>
                <p className="text-red-700 dark:text-red-300 mt-0.5">
                  {t(
                    `Your license expired on ${state.expiresAt}. Please enter your renewal key below to resume access without data loss.`,
                    `آپ کے لائسنس کی مدت ${state.expiresAt} کو ختم ہو چکی ہے۔ ڈیٹا ضائع ہوئے بغیر بحالی کے لیے نئی کی درج کریں۔`
                  )}
                </p>
              </div>
            </div>
          )}

          {state?.isGracePeriod && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold text-amber-900 dark:text-amber-200">
                  {t("7-Day Grace Period Active", "7 روزہ رعایت کی مدت جاری ہے")}
                </p>
                <p className="text-amber-700 dark:text-amber-300 mt-0.5">
                  {t(
                    `Your license has expired. You have ${state.daysRemaining} days remaining in your emergency grace window before lockout.`,
                    `لائسنس ختم ہو چکا ہے۔ لاک آؤٹ سے قبل آپ کے پاس صرف ${state.daysRemaining} دن باقی ہیں۔`
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Machine ID Box */}
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Laptop className="h-3.5 w-3.5 text-indigo-600" />
                {t("This Computer's Machine Code", "اس کمپیوٹر کا ہارڈویئر مشین کوڈ")}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Motherboard & CPU Locked
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="w-full sm:flex-1 font-mono text-xl sm:text-2xl font-black tracking-wider text-slate-900 dark:text-white bg-white dark:bg-slate-900 px-4 py-3 rounded-xl border border-indigo-200 dark:border-indigo-900 text-center shadow-xs">
                {state?.machineId || "MCH-XXXX-XXXX-XXXX"}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCopyMachineId}
                  className="flex-1 sm:flex-initial text-xs font-bold h-11 px-3 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 mr-1.5" />
                      {t("Copied!", "کاپی ہو گیا!")}
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1.5" />
                      {t("Copy Code", "کوڈ کاپی")}
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  onClick={handleWhatsAppShare}
                  className="flex-1 sm:flex-initial text-xs font-bold h-11 px-3 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                >
                  <MessageCircle className="h-4 w-4 mr-1.5" />
                  {t("Send via WhatsApp", "واٹس ایپ بھیجیں")}
                </Button>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {t(
                "Copy this code and send it to your software vendor to receive your official annual activation key.",
                "یہ کوڈ کاپی کر کے اپنے سافٹ ویئر وینڈر کو واٹس ایپ کریں تاکہ وہ آپ کے لیے سالانہ لائسنس کی جاری کر سکے۔"
              )}
            </p>
          </div>

          {/* Activation Form */}
          <form onSubmit={handleActivate} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                {t("Enter Product License Key", "پروڈکٹ لائسنس کی درج کریں")}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value.toUpperCase())}
                  placeholder="A360-ACC-XXXX-YYYYMMDD-XXXXXXXXXXXXXXXX"
                  className="w-full font-mono text-xs sm:text-sm uppercase tracking-wider px-3.5 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
                {t("Business Name (Optional)", "کاروبار یا دکان کا نام (اختیاری)")}
              </label>
              <input
                type="text"
                value={clientNameInput}
                onChange={(e) => setClientNameInput(e.target.value)}
                placeholder="e.g. Al-Madina Super Store"
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs font-medium text-red-600 dark:text-red-300">
                ⚠️ {errorMessage}
              </div>
            )}

            {successMessage && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {successMessage}
              </div>
            )}

            <Button
              type="submit"
              disabled={activating}
              className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md rounded-xl"
            >
              {activating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  {t("Verifying Cryptographic Lock...", "تصدیق ہو رہی ہے...")}
                </>
              ) : (
                <>
                  <KeyRound className="h-4 w-4 mr-2" />
                  {t("Activate Software Now", "ابھی سافٹ ویئر ایکٹیویٹ کریں")}
                </>
              )}
            </Button>
          </form>

          {/* Package Tier Reference Cards */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2.5">
              {t("Package Capabilities & Inclusions", "پیکجز کی خصوصیات و تفصیل")}
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px]">
              {/* 1. ACC */}
              <div className="p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-900/40">
                <div className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5 mb-1">
                  <Receipt className="h-3.5 w-3.5 text-indigo-600" />
                  <span>1. Accounting Suite</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-[10.5px] leading-relaxed">
                  Cash Drawer & Cash Book, Full Double-Entry Ledger, Sales & Purchase Returns, 80mm Thermal & A4 Prints. Zero FBR complexity.
                </p>
              </div>

              {/* 2. POS */}
              <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40">
                <div className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5 mb-1">
                  <Store className="h-3.5 w-3.5 text-emerald-600" />
                  <span>2. POS + Accounting</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-[10.5px] leading-relaxed">
                  Retail Cashier Counter, Barcode Scanner, Cash Drawer, Counter Returns & Credit Notes, FBR POS QR + Full Accounting.
                </p>
              </div>

              {/* 3. DI */}
              <div className="p-3 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/40">
                <div className="font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5 mb-1">
                  <Building2 className="h-3.5 w-3.5 text-purple-600" />
                  <span>3. DI + Accounting</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-[10.5px] leading-relaxed">
                  FBR Digital Invoicing (Buyer NTN/STRN/CNIC, Debit/Credit Notes, 18%/15%/8th Schedule Tax) + Full Accounting.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
