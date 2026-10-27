"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/decimal";
import { Badge } from "@/components/ui/badge";
import {
  Landmark,
  Scale,
  Boxes,
  Users,
  Truck,
  Wallet,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Save,
  ArrowLeft,
  Sparkles,
  Download,
  UploadCloud,
  RefreshCw,
  Coins,
  ShieldCheck,
} from "lucide-react";
import { smartFetch, invalidateCache } from "@/lib/clientCache";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { BrandPageLoader } from "@/components/ui/loader";

interface CashBankRow {
  id?: string;
  name: string;
  type: "CASH" | "BANK";
  accountNumber?: string;
  bankName?: string;
  balance: number;
}

interface InventoryRow {
  productId?: string;
  name: string;
  sku: string;
  quantity: number;
  unitCost: number;
  totalValue: number;
}

interface CustomerRow {
  customerId?: string;
  name: string;
  phone?: string;
  ntn?: string;
  cnic?: string;
  balance: number;
}

interface SupplierRow {
  supplierId?: string;
  name: string;
  phone?: string;
  balance: number;
}

export default function OpeningBalancesPage() {
  const router = useRouter();
  const { user, activeCompany } = useAuth();
  const { t, language } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Active section tab
  const [activeSection, setActiveSection] = useState<"CAPITAL" | "CASH_BANK" | "INVENTORY" | "CUSTOMERS" | "SUPPLIERS">("CAPITAL");

  // Form State
  const [asOfDate, setAsOfDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [capitalAmount, setCapitalAmount] = useState<number>(0);
  const [capitalDrawings, setCapitalDrawings] = useState<number>(0);
  const [capitalNotes, setCapitalNotes] = useState<string>("Initial Business Capital Setup");

  const [cashBankList, setCashBankList] = useState<CashBankRow[]>([
    { id: "cash-1", name: "Cash in Hand (نقد رقم)", type: "CASH", balance: 0 },
    { id: "bank-1", name: "Primary Bank Account (بینک اکاؤنٹ)", type: "BANK", balance: 0 },
  ]);

  const [inventoryList, setInventoryList] = useState<InventoryRow[]>([]);
  const [customersList, setCustomersList] = useState<CustomerRow[]>([]);
  const [suppliersList, setSuppliersList] = useState<SupplierRow[]>([]);

  // Check if company is FBR only
  const isFbrInvoicingOnly = activeCompany?.packageType === "FBR_INVOICING_ONLY";

  // Fetch existing state
  const loadOpeningData = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await smartFetch("/api/accounting/opening-balances", { ttlMs: 0, skipCache: true });
      if (res.success && res.data) {
        const d = res.data;
        if (d.asOfDate) setAsOfDate(d.asOfDate);
        if (d.capital) {
          setCapitalAmount(Number(d.capital.amount || 0));
          setCapitalDrawings(Number(d.capital.drawings || 0));
          if (d.capital.notes) setCapitalNotes(d.capital.notes);
        }
        if (d.cashBank && d.cashBank.length > 0) {
          setCashBankList(d.cashBank);
        }
        if (d.inventory && d.inventory.length > 0) {
          setInventoryList(d.inventory);
        }
        if (d.customers && d.customers.length > 0) {
          setCustomersList(d.customers);
        }
        if (d.suppliers && d.suppliers.length > 0) {
          setSuppliersList(d.suppliers);
        }
      }
    } catch (err: any) {
      console.error("Error loading opening balances:", err);
      setErrorMessage(err.message || "Failed to load opening balances data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOpeningData();
  }, [activeCompany?.id]);

  // Live Calculations
  const totals = useMemo(() => {
    let cashTotal = 0;
    let bankTotal = 0;
    cashBankList.forEach((c) => {
      const b = Number(c.balance || 0);
      if (c.type === "BANK") bankTotal += b;
      else cashTotal += b;
    });

    let inventoryTotal = 0;
    inventoryList.forEach((i) => {
      inventoryTotal += Number(i.quantity || 0) * Number(i.unitCost || 0);
    });

    let receivablesTotal = 0;
    customersList.forEach((c) => {
      receivablesTotal += Number(c.balance || 0);
    });

    let payablesTotal = 0;
    suppliersList.forEach((s) => {
      payablesTotal += Number(s.balance || 0);
    });

    const totalAssets = cashTotal + bankTotal + inventoryTotal + receivablesTotal;
    const totalLiabilities = payablesTotal;
    const totalCredits = totalLiabilities + Number(capitalAmount || 0);
    const difference = Math.round((totalAssets - totalCredits) * 100) / 100;
    const isBalanced = Math.abs(difference) < 0.01;

    return {
      cashTotal,
      bankTotal,
      inventoryTotal,
      receivablesTotal,
      totalAssets,
      payablesTotal,
      totalLiabilities,
      totalCredits,
      difference,
      isBalanced,
    };
  }, [cashBankList, inventoryList, customersList, suppliersList, capitalAmount]);

  // Auto-Balance Action
  const handleAutoBalanceCapital = () => {
    const requiredCapital = Math.max(0, totals.totalAssets - totals.totalLiabilities);
    setCapitalAmount(requiredCapital);
    setSuccessMessage(
      t(
        `Owner's Capital auto-balanced to Rs. ${requiredCapital.toLocaleString()} to match Total Assets!`,
        `سرمایہ خودکار طور پر مجموعی اثاثہ جات کے برابر متوازن کر دیا گیا: Rs. ${requiredCapital.toLocaleString()}`
      )
    );
  };

  // Add Row Handlers
  const handleAddBank = () => {
    setCashBankList([
      ...cashBankList,
      {
        id: `bank-${Date.now()}`,
        name: `Bank Account ${cashBankList.filter((b) => b.type === "BANK").length + 1}`,
        type: "BANK",
        accountNumber: "",
        bankName: "",
        balance: 0,
      },
    ]);
  };

  const handleAddInventoryRow = () => {
    setInventoryList([
      ...inventoryList,
      {
        name: "",
        sku: `SKU-${Date.now().toString().slice(-4)}`,
        quantity: 1,
        unitCost: 0,
        totalValue: 0,
      },
    ]);
  };

  const handleAddCustomerRow = () => {
    setCustomersList([
      ...customersList,
      {
        name: "",
        phone: "",
        balance: 0,
      },
    ]);
  };

  const handleAddSupplierRow = () => {
    setSuppliersList([
      ...suppliersList,
      {
        name: "",
        phone: "",
        balance: 0,
      },
    ]);
  };

  // Save / Post Opening Balances
  const handleSaveOpeningBalances = async () => {
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload = {
        asOfDate,
        capital: {
          amount: Number(capitalAmount || 0),
          drawings: Number(capitalDrawings || 0),
          notes: capitalNotes,
        },
        cashBank: cashBankList.map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
          accountNumber: c.accountNumber,
          bankName: c.bankName,
          balance: Number(c.balance || 0),
        })),
        inventory: inventoryList.filter((i) => i.name.trim() !== "").map((i) => ({
          productId: i.productId,
          name: i.name,
          sku: i.sku,
          quantity: Number(i.quantity || 0),
          unitCost: Number(i.unitCost || 0),
        })),
        customers: customersList.filter((c) => c.name.trim() !== "").map((c) => ({
          customerId: c.customerId,
          name: c.name,
          phone: c.phone,
          ntn: c.ntn,
          cnic: c.cnic,
          balance: Number(c.balance || 0),
        })),
        suppliers: suppliersList.filter((s) => s.name.trim() !== "").map((s) => ({
          supplierId: s.supplierId,
          name: s.name,
          phone: s.phone,
          balance: Number(s.balance || 0),
        })),
        autoBalanceWithCapital: false,
      };

      const res = await fetch("/api/accounting/opening-balances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to post opening balances.");
      }

      setSuccessMessage(
        t(
          "Opening balances, capital, stock, and party dues successfully recorded and posted to General Ledger!",
          "ابتدائی بقایا جات، سرمایہ، اسٹاک اور کھاتہ جنرل لیجر میں کامیابی سے پوسٹ ہو گیا!"
        )
      );

      // Invalidate cache across all tabs
      invalidateCache();
    } catch (err: any) {
      setErrorMessage(err.message || "An error occurred while saving opening balances.");
    } finally {
      setSaving(false);
    }
  };

  // If user is in FBR Invoicing Only mode, advise switching
  if (isFbrInvoicingOnly) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-900/60 dark:bg-amber-950/30">
          <AlertTriangle className="mx-auto h-12 w-12 text-amber-600 dark:text-amber-400 mb-3" />
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            {t("Full Accounting Suite Required", "بزنس اکاؤنٹنگ پیکیج درکار ہے")}
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {t(
              "Your active company is currently in FBR Digital Invoicing Only mode. Opening Balances, Capital assignment, and double-entry General Ledgers are available in the Accounting Only and Full Suite packages.",
              "آپ کی کمپنی اس وقت صرف ایف بی آر ڈیجیٹل انوائسنگ موڈ میں ہے۔ ابتدائی کیپیٹل اور اسٹاک بیلنس اکاؤنٹنگ اور فل سوٹ پیکیج میں دستیاب ہیں۔"
            )}
          </p>
          <div className="mt-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{t("Back to Dashboard", "ڈیش بورڈ پر واپس")}</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return <BrandPageLoader message={t("Loading Opening Balances...", "ابتدائی کھاتہ لوڈ ہو رہا ہے...")} />;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/accounting"
              className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Landmark className="h-6 w-6 text-emerald-600" />
              <span>{t("Opening Balances & Initial Capital Setup", "ابتدائی کھاتہ و کیپیٹل سیٹ اپ")}</span>
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t(
              "Record starting Capital, existing stock, customer receivables, and supplier payables for starting or migrating your business.",
              "کاروبار کا ابتدائی سرمایہ، موجودہ اسٹاک، گاہکوں سے وصولیاں اور سپلائرز کے واجبات کا مکمل اندراج۔"
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadOpeningData}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>{t("Refresh", "ریفریش")}</span>
          </button>
          <button
            onClick={handleSaveOpeningBalances}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-50 transition"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? t("Posting...", "پوسٹ ہو رہا ہے...") : t("Save & Post Opening Balances", "ابتدائی کھاتہ محفوظ اور پوسٹ کریں")}</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {successMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-300">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/30 dark:text-rose-300">
          <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* QuickBooks Style Opening Setup Status Hero */}
      <div className={`rounded-2xl border p-5 shadow-sm transition ${
        totals.isBalanced
          ? "border-emerald-200 bg-linear-to-r from-emerald-50/80 to-white dark:border-emerald-900/60 dark:from-emerald-950/30 dark:to-slate-900"
          : "border-amber-200 bg-linear-to-r from-amber-50/80 to-white dark:border-amber-900/60 dark:from-amber-950/30 dark:to-slate-900"
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200/60 dark:border-slate-800">
          <div className="flex items-start gap-3.5">
            <div className={`p-3 rounded-2xl shadow-xs shrink-0 ${
              totals.isBalanced ? "bg-emerald-600 text-white" : "bg-amber-500 text-white"
            }`}>
              {totals.isBalanced ? <ShieldCheck className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {totals.isBalanced
                    ? t("Opening Setup Active & Balanced", "ابتدائی سیٹ اپ مکمل اور متوازن ہے")
                    : t("Opening Balances Require Alignment", "ابتدائی کھاتوں میں فرق موجود ہے")}
                </h2>
                <Badge variant={totals.isBalanced ? "success" : "warning"} className="text-[10px] font-mono">
                  {totals.isBalanced ? "Assets = Liab + Equity ✓" : `Diff: ${formatMoney(Math.abs(totals.difference))}`}
                </Badge>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-3xl leading-relaxed">
                {totals.isBalanced
                  ? t(
                      "Your business starting baseline is active. Owner's Capital is established once as of opening cutoff. Day-to-day purchases and sales flow through Bills & Invoices automatically without modifying opening capital.",
                      "آپ کا ابتدائی بزنس سیٹ اپ مکمل اور فعال ہے۔ کیپیٹل صرف ایک بار مقرر ہوتا ہے۔ روزمرہ کی خریداریاں اور سیلز انوائسز سے خودکار چلتی ہیں اور کیپیٹل پر اثرانداز نہیں ہوتیں۔"
                    )
                  : t(
                      "Total Assets do not match Total Liabilities + Owner's Capital. Click 'Auto-Balance Capital' to automatically set Owner's Capital equal to net assets.",
                      "مجموعی اثاثے اور واجبات برابر نہیں ہیں۔ کیپیٹل کو خودکار برابر کرنے کے لیے نیچے والا بٹن دبائیں۔"
                    )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!totals.isBalanced && (
              <button
                type="button"
                onClick={handleAutoBalanceCapital}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-amber-700 transition"
              >
                <Sparkles className="h-4 w-4" />
                <span>{t("Auto-Balance Capital", "کیپیٹل خودکار متوازن کریں")}</span>
              </button>
            )}
            <Link
              href="/accounting"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200"
            >
              <span>{t("Accounting Hub →", "اکاؤنٹنگ ہب →")}</span>
            </Link>
          </div>
        </div>

        {/* 5 Clean Metrics Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-4">
          <div className="rounded-xl border border-slate-200/60 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-800/80">
            <span className="text-[10px] font-bold uppercase text-slate-400">{t("Owner's Capital", "سرمایہ")}</span>
            <p className="text-base font-black text-slate-900 dark:text-white mt-0.5 tabular-nums">
              {formatMoney(capitalAmount)}
            </p>
            <span className="text-[10px] text-slate-400">Account 3010</span>
          </div>

          <div className="rounded-xl border border-slate-200/60 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-800/80">
            <span className="text-[10px] font-bold uppercase text-slate-400">{t("Cash & Bank", "نقد و بینک")}</span>
            <p className="text-base font-black text-slate-900 dark:text-white mt-0.5 tabular-nums">
              {formatMoney(totals.cashTotal + totals.bankTotal)}
            </p>
            <span className="text-[10px] text-slate-400">{cashBankList.length} accounts</span>
          </div>

          <div className="rounded-xl border border-slate-200/60 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-800/80">
            <span className="text-[10px] font-bold uppercase text-slate-400">{t("Opening Stock", "موجودہ اسٹاک")}</span>
            <p className="text-base font-black text-purple-700 dark:text-purple-300 mt-0.5 tabular-nums">
              {formatMoney(totals.inventoryTotal)}
            </p>
            <span className="text-[10px] text-slate-400">{inventoryList.length} items</span>
          </div>

          <div className="rounded-xl border border-slate-200/60 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-800/80">
            <span className="text-[10px] font-bold uppercase text-slate-400">{t("Customer Receivables", "وصولیاں")}</span>
            <p className="text-base font-black text-blue-600 dark:text-blue-400 mt-0.5 tabular-nums">
              {formatMoney(totals.receivablesTotal)}
            </p>
            <span className="text-[10px] text-slate-400">{customersList.length} customers</span>
          </div>

          <div className="rounded-xl border border-slate-200/60 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-800/80">
            <span className="text-[10px] font-bold uppercase text-slate-400">{t("Supplier Payables", "واجبات")}</span>
            <p className="text-base font-black text-rose-600 dark:text-rose-400 mt-0.5 tabular-nums">
              {formatMoney(totals.payablesTotal)}
            </p>
            <span className="text-[10px] text-slate-400">{suppliersList.length} vendors</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <button
          onClick={() => setActiveSection("CAPITAL")}
          className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
            activeSection === "CAPITAL"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          }`}
        >
          <Coins className="h-4 w-4" />
          <span>{t("1. Capital & As-Of Date", "1. ابتدائی سرمایہ و تاریخ")}</span>
        </button>

        <button
          onClick={() => setActiveSection("CASH_BANK")}
          className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
            activeSection === "CASH_BANK"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          }`}
        >
          <Wallet className="h-4 w-4" />
          <span>{t("2. Cash & Bank", "2. نقد و بینک بیلنس")} ({cashBankList.length})</span>
        </button>

        <button
          onClick={() => setActiveSection("INVENTORY")}
          className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
            activeSection === "INVENTORY"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          }`}
        >
          <Boxes className="h-4 w-4" />
          <span>{t("3. Opening Stock", "3. موجودہ اسٹاک")} ({inventoryList.length})</span>
        </button>

        <button
          onClick={() => setActiveSection("CUSTOMERS")}
          className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
            activeSection === "CUSTOMERS"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          }`}
        >
          <Users className="h-4 w-4" />
          <span>{t("4. Customer Receivables", "4. کسٹمرز سے وصولیاں")} ({customersList.length})</span>
        </button>

        <button
          onClick={() => setActiveSection("SUPPLIERS")}
          className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
            activeSection === "SUPPLIERS"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          }`}
        >
          <Truck className="h-4 w-4" />
          <span>{t("5. Supplier Payables", "5. سپلائرز کے واجبات")} ({suppliersList.length})</span>
        </button>
      </div>

      {/* SECTION 1: CAPITAL & AS-OF DATE */}
      {activeSection === "CAPITAL" && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {t("Owner's Equity & Starting Capital Assignment", "مالک کا ابتدائی سرمایہ اور کھاتہ سیٹ اپ")}
              </h3>
              <p className="text-xs text-slate-500">
                {t(
                  "Set the starting equity investment of the owner or partners in the business.",
                  "کاروبار میں مالک یا پارٹنرز کا ابتدائی لگایا گیا سرمایہ درج کریں۔"
                )}
              </p>
            </div>
            <button
              onClick={handleAutoBalanceCapital}
              className="flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-300"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{t("Calculate from Assets - Liabilities", "اثاثوں کے فرق سے خودکار سیٹ کریں")}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {t("Opening As-Of Date", "ابتدائی کھاتہ کی تاریخ")} *
              </label>
              <input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <span className="text-[10px] text-slate-400">
                {t("The date business begins recording in this system.", "سسٹم میں کام شروع کرنے کی تاریخ۔")}
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {t("Owner's Capital (Rs.)", "ابتدائی سرمایہ (روپے)")} *
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={capitalAmount}
                onChange={(e) => setCapitalAmount(Number(e.target.value) || 0)}
                placeholder="e.g. 500000"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <span className="text-[10px] text-slate-400">
                {t("Credited to Account 3010 (Owner's Capital).", "اکاؤنٹ 3010 میں کریڈٹ ہوگا۔")}
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {t("Owner Drawings (Rs.) [Optional]", "مالک کا ذاتی استعمال / ڈرائنگز")}
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={capitalDrawings}
                onChange={(e) => setCapitalDrawings(Number(e.target.value) || 0)}
                placeholder="0"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <span className="text-[10px] text-slate-400">
                {t("Account 3020 (Contra Equity).", "اکاؤنٹ 3020 میں درج ہوگا۔")}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t("Opening Notes / Legal Description", "تفصیل / ریمارکس")}
            </label>
            <input
              type="text"
              value={capitalNotes}
              onChange={(e) => setCapitalNotes(e.target.value)}
              placeholder="e.g. Initial balance sheet migration for business launch"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>
      )}

      {/* SECTION 2: CASH & BANK BALANCES */}
      {activeSection === "CASH_BANK" && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {t("Cash & Bank Opening Balances", "نقد رقم اور بینک بیلنسز")}
              </h3>
              <p className="text-xs text-slate-500">
                {t("Enter opening cash in shop/drawer and balances in all company bank accounts.", "دکان یا دراز میں موجود نقد اور تمام بینک اکاؤنٹس کے موجودہ بیلنس درج کریں۔")}
              </p>
            </div>
            <button
              onClick={handleAddBank}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t("+ Add Bank Account", "+ نیا بینک شامل کریں")}</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2.5">{t("Account Name", "اکاؤنٹ کا نام")}</th>
                  <th className="px-4 py-2.5">{t("Type", "قسم")}</th>
                  <th className="px-4 py-2.5">{t("Bank / Branch", "بینک کا نام")}</th>
                  <th className="px-4 py-2.5">{t("Account # / IBAN", "اکاؤنٹ نمبر")}</th>
                  <th className="px-4 py-2.5 text-right">{t("Opening Balance (Rs.)", "ابتدائی بیلنس (روپے)")}</th>
                  <th className="px-4 py-2.5 text-center">{t("Action", "عمل")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {cashBankList.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => {
                          const updated = [...cashBankList];
                          updated[idx].name = e.target.value;
                          setCashBankList(updated);
                        }}
                        className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={row.type}
                        onChange={(e) => {
                          const updated = [...cashBankList];
                          updated[idx].type = e.target.value as "CASH" | "BANK";
                          setCashBankList(updated);
                        }}
                        className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      >
                        <option value="CASH">{t("Cash", "کیش")}</option>
                        <option value="BANK">{t("Bank", "بینک")}</option>
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={row.bankName || ""}
                        disabled={row.type === "CASH"}
                        onChange={(e) => {
                          const updated = [...cashBankList];
                          updated[idx].bankName = e.target.value;
                          setCashBankList(updated);
                        }}
                        placeholder={row.type === "CASH" ? "N/A" : "e.g. Meezan Bank"}
                        className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white disabled:opacity-40"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={row.accountNumber || ""}
                        disabled={row.type === "CASH"}
                        onChange={(e) => {
                          const updated = [...cashBankList];
                          updated[idx].accountNumber = e.target.value;
                          setCashBankList(updated);
                        }}
                        placeholder={row.type === "CASH" ? "N/A" : "01020304050"}
                        className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white disabled:opacity-40"
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={row.balance}
                        onChange={(e) => {
                          const updated = [...cashBankList];
                          updated[idx].balance = Number(e.target.value) || 0;
                          setCashBankList(updated);
                        }}
                        className="w-36 text-right rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </td>
                    <td className="px-4 py-2 text-center">
                      {cashBankList.length > 1 && (
                        <button
                          onClick={() => {
                            setCashBankList(cashBankList.filter((_, i) => i !== idx));
                          }}
                          className="rounded p-1 text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
              {t("Total Liquid Cash & Bank:", "کل نقد و بینک بیلنس:")}
            </span>
            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
              {formatMoney(totals.cashTotal + totals.bankTotal)}
            </span>
          </div>
        </div>
      )}

      {/* SECTION 3: OPENING STOCK / INVENTORY */}
      {activeSection === "INVENTORY" && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex flex-wrap justify-between items-center gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {t("Opening Inventory & Stock Valuation", "موجودہ اسٹاک اور مالیت کا اندراج")}
              </h3>
              <p className="text-xs text-slate-500">
                {t(
                  "List existing items physically in shop or warehouse with quantities and purchase/cost rates.",
                  "دکان یا گودام میں موجود اشیاء کی تعداد اور لاگت ریٹ درج کریں۔"
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleAddInventoryRow}
                className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-700 shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{t("+ Add Stock Item", "+ نیا آئٹم شامل کریں")}</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2.5">#</th>
                  <th className="px-4 py-2.5">{t("Product / Item Name", "پروڈکٹ کا نام")} *</th>
                  <th className="px-4 py-2.5">{t("SKU / Barcode", "ایس کے یو")}</th>
                  <th className="px-4 py-2.5 text-right">{t("Opening Qty", "تعداد")}</th>
                  <th className="px-4 py-2.5 text-right">{t("Cost Price (Rs.)", "لاگت قیمت")}</th>
                  <th className="px-4 py-2.5 text-right">{t("Total Valuation (Rs.)", "کل مالیت")}</th>
                  <th className="px-4 py-2.5 text-center">{t("Action", "عمل")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {inventoryList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">
                      {t("No opening items added yet. Click '+ Add Stock Item' above.", "ابھی کوئی اسٹاک آئٹم شامل نہیں۔ اوپر بٹن پر کلک کریں۔")}
                    </td>
                  </tr>
                ) : (
                  inventoryList.map((row, idx) => {
                    const rowVal = Number(row.quantity || 0) * Number(row.unitCost || 0);
                    return (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-2 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={row.name}
                            onChange={(e) => {
                              const updated = [...inventoryList];
                              updated[idx].name = e.target.value;
                              setInventoryList(updated);
                            }}
                            placeholder="e.g. Cotton Yarn 20s"
                            className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={row.sku}
                            onChange={(e) => {
                              const updated = [...inventoryList];
                              updated[idx].sku = e.target.value;
                              setInventoryList(updated);
                            }}
                            placeholder="SKU"
                            className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={row.quantity}
                            onChange={(e) => {
                              const updated = [...inventoryList];
                              updated[idx].quantity = Number(e.target.value) || 0;
                              setInventoryList(updated);
                            }}
                            className="w-24 text-right rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={row.unitCost}
                            onChange={(e) => {
                              const updated = [...inventoryList];
                              updated[idx].unitCost = Number(e.target.value) || 0;
                              setInventoryList(updated);
                            }}
                            className="w-28 text-right rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          />
                        </td>
                        <td className="px-4 py-2 text-right font-black text-slate-800 dark:text-slate-100 font-mono">
                          {formatMoney(rowVal)}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <button
                            onClick={() => {
                              setInventoryList(inventoryList.filter((_, i) => i !== idx));
                            }}
                            className="rounded p-1 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
              {t("Total Opening Stock Valuation (Account 1200):", "کل موجودہ اسٹاک مالیت (اکاؤنٹ 1200):")}
            </span>
            <span className="text-sm font-black text-purple-600 dark:text-purple-400">
              {formatMoney(totals.inventoryTotal)}
            </span>
          </div>
        </div>
      )}

      {/* SECTION 4: CUSTOMER RECEIVABLES */}
      {activeSection === "CUSTOMERS" && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {t("Opening Accounts Receivable (Customers)", "کسٹمرز کے سابقہ بقایا جات (وصولیاں)")}
              </h3>
              <p className="text-xs text-slate-500">
                {t(
                  "Enter existing customers who owe money to the business before starting in this software.",
                  "ان تمام گاہکوں کے نام اور واجب الوصول رقم درج کریں جنہوں نے پرانے کھاتے کے پیسے دینے ہیں۔"
                )}
              </p>
            </div>
            <button
              onClick={handleAddCustomerRow}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t("+ Add Customer", "+ نیا کسٹمر شامل کریں")}</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2.5">#</th>
                  <th className="px-4 py-2.5">{t("Customer Legal Name", "کسٹمر کا نام")} *</th>
                  <th className="px-4 py-2.5">{t("Phone / Mobile", "فون نمبر")}</th>
                  <th className="px-4 py-2.5">{t("NTN / CNIC", "این ٹی این / شناختی کارڈ")}</th>
                  <th className="px-4 py-2.5 text-right">{t("Opening Receivable (Rs.)", "واجب الوصول بقایا (روپے)")}</th>
                  <th className="px-4 py-2.5 text-center">{t("Action", "عمل")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {customersList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400">
                      {t("No customers with opening balance added yet.", "ابھی کوئی کسٹمر شامل نہیں۔ اوپر بٹن پر کلک کریں۔")}
                    </td>
                  </tr>
                ) : (
                  customersList.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-2 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={row.name}
                          onChange={(e) => {
                            const updated = [...customersList];
                            updated[idx].name = e.target.value;
                            setCustomersList(updated);
                          }}
                          placeholder="e.g. Al-Madina Trading"
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={row.phone || ""}
                          onChange={(e) => {
                            const updated = [...customersList];
                            updated[idx].phone = e.target.value;
                            setCustomersList(updated);
                          }}
                          placeholder="0300-1234567"
                          className="w-32 rounded-lg border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={row.ntn || row.cnic || ""}
                          onChange={(e) => {
                            const updated = [...customersList];
                            const v = e.target.value;
                            if (v.length > 8) updated[idx].cnic = v;
                            else updated[idx].ntn = v;
                            setCustomersList(updated);
                          }}
                          placeholder="NTN or CNIC"
                          className="w-36 rounded-lg border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={row.balance}
                          onChange={(e) => {
                            const updated = [...customersList];
                            updated[idx].balance = Number(e.target.value) || 0;
                            setCustomersList(updated);
                          }}
                          className="w-36 text-right rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={() => {
                            setCustomersList(customersList.filter((_, i) => i !== idx));
                          }}
                          className="rounded p-1 text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
              {t("Total Accounts Receivable (Account 1100):", "کل واجب الوصول وصولیاں (اکاؤنٹ 1100):")}
            </span>
            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
              {formatMoney(totals.receivablesTotal)}
            </span>
          </div>
        </div>
      )}

      {/* SECTION 5: SUPPLIER PAYABLES */}
      {activeSection === "SUPPLIERS" && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {t("Opening Accounts Payable (Suppliers / Vendors)", "سپلائرز کے سابقہ واجبات (ادائیگیاں)")}
              </h3>
              <p className="text-xs text-slate-500">
                {t(
                  "Enter vendors to whom the business owes money for goods or raw material supplied prior to setup.",
                  "ان تمام سپلائرز کے نام اور واجب الادا رقم درج کریں جن کو پرانے مال کے پیسے دینے باقی ہیں۔"
                )}
              </p>
            </div>
            <button
              onClick={handleAddSupplierRow}
              className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700 shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{t("+ Add Supplier", "+ نیا سپلائر شامل کریں")}</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2.5">#</th>
                  <th className="px-4 py-2.5">{t("Supplier / Company Name", "سپلائر کا نام")} *</th>
                  <th className="px-4 py-2.5">{t("Phone / Mobile", "فون نمبر")}</th>
                  <th className="px-4 py-2.5 text-right">{t("Opening Payable (Rs.)", "واجب الادا بقایا (روپے)")}</th>
                  <th className="px-4 py-2.5 text-center">{t("Action", "عمل")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {suppliersList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-400">
                      {t("No suppliers with opening payable added yet.", "ابھی کوئی سپلائر شامل نہیں۔ اوپر بٹن پر کلک کریں۔")}
                    </td>
                  </tr>
                ) : (
                  suppliersList.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-2 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={row.name}
                          onChange={(e) => {
                            const updated = [...suppliersList];
                            updated[idx].name = e.target.value;
                            setSuppliersList(updated);
                          }}
                          placeholder="e.g. National Fabrics"
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={row.phone || ""}
                          onChange={(e) => {
                            const updated = [...suppliersList];
                            updated[idx].phone = e.target.value;
                            setSuppliersList(updated);
                          }}
                          placeholder="0321-7654321"
                          className="w-36 rounded-lg border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={row.balance}
                          onChange={(e) => {
                            const updated = [...suppliersList];
                            updated[idx].balance = Number(e.target.value) || 0;
                            setSuppliersList(updated);
                          }}
                          className="w-36 text-right rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={() => {
                            setSuppliersList(suppliersList.filter((_, i) => i !== idx));
                          }}
                          className="rounded p-1 text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
              {t("Total Accounts Payable (Account 2010):", "کل واجب الادا ادائیگیاں (اکاؤنٹ 2010):")}
            </span>
            <span className="text-sm font-black text-rose-600 dark:text-rose-400">
              {formatMoney(totals.payablesTotal)}
            </span>
          </div>
        </div>
      )}

      {/* Floating Save Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 sm:left-64">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-500">
              {t("Assets:", "اثاثے:")} <strong className="text-slate-900 dark:text-white font-mono">{formatMoney(totals.totalAssets)}</strong>
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-xs font-bold text-slate-500">
              {t("Liab + Capital:", "واجبات و سرمایہ:")} <strong className="text-slate-900 dark:text-white font-mono">{formatMoney(totals.totalCredits)}</strong>
            </span>
            {!totals.isBalanced && (
              <span className="hidden sm:inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                <AlertTriangle className="h-3 w-3" />
                <span>Diff: {formatMoney(Math.abs(totals.difference))}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!totals.isBalanced && (
              <button
                onClick={handleAutoBalanceCapital}
                className="flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{t("Auto-Balance", "متوازن کریں")}</span>
              </button>
            )}

            <button
              onClick={handleSaveOpeningBalances}
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-black text-white shadow-md hover:bg-emerald-700 disabled:opacity-50 transition"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? t("Posting...", "پوسٹ ہو رہا ہے...") : t("Save & Post Opening Balances", "ابتدائی کھاتہ محفوظ اور پوسٹ کریں")}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
