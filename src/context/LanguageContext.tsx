"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type Language = "en" | "ur";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (en: string, ur?: string) => string;
  isUrdu: boolean;
}

const DICTIONARY: Record<string, string> = {
  // Navigation & Sections
  "Executive Dashboard": "مرکزی ڈیش بورڈ",
  "Sales & Invoices": "سیلز اور انوائسز",
  "POS Counter": "پی او ایس کاؤنٹر",
  "Purchases & Bills": "خریداری اور بلز",
  "Purchases & Inward Stock": "خریداری اور انوارڈ اسٹاک",
  "Cash & Payments": "کیش اور ادائیگیاں",
  "Daily Expenses": "روزمرہ کے اخراجات",
  "Inventory & Stock": "انونٹری اور اسٹاک",
  "Customers (Receivables)": "کسٹمرز (وصولیاں)",
  "Suppliers (Payables)": "سپلائرز (واجبات)",
  "Products & Rates": "پروڈکٹس اور ریٹس",
  "Closing & Reports": "رپورٹس اور کھاتہ بندش",
  "FBR POS Digital": "ایف بی آر ڈیجیٹل",
  "General Ledger": "جنرل لیجر",
  "AI Invoice Reader": "اے آئی انوائس ریڈر",
  "Branches & Staff": "برانچز اور اسٹاف",
  "Activity Log": "ایکٹیویٹی لاگ",
  "Settings & Defaults": "سیٹنگز",

  // Sections
  "OVERVIEW": "بنیادی جائزہ",
  "DAILY WORK": "روزمرہ امور",
  "STOCK & KHATA": "اسٹاک اور کھاتہ",
  "REPORTS & TAX": "رپورٹس اور ٹیکس",
  "ORGANIZATION": "ادارہ اور ترتیبات",

  // Dates & Presets
  "All": "تمام",
  "All Dates": "تمام تاریخیں",
  "Today": "آج",
  "Yesterday": "گزشتہ کل",
  "This Week": "اس ہفتے",
  "This Month": "اس ماہ",
  "This Year": "اس سال",
  "Last 30 Days": "گزشتہ 30 دن",
  "Custom": "کسٹم",
  "Custom Date Range": "مخصوص تاریخیں",
  "From Date": "تاریخ سے",
  "To Date": "تاریخ تک",

  // Accounting & Financials
  "Opening Balance": "ابتدائی بقایا",
  "Closing Balance": "اختتامی بقایا",
  "Debit": "ڈیبٹ",
  "Credit": "کریڈٹ",
  "Running Balance": "رواں بقایا",
  "Net Movement": "خالص ردوبدل",
  "Total Debits": "کل ڈیبٹ",
  "Total Credits": "کل کریڈٹ",
  "Total Sales": "کل سیلز",
  "Total Purchases": "کل خریداری",
  "Total Paid": "کل ادا شدہ",
  "Remaining Payable": "بقیہ واجب الادا",
  "Remaining Receivable": "بقیہ واجب الوصول",
  "Current Balance": "موجودہ بیلنس",
  "Paid": "ادا شدہ",
  "Partial": "جزوی ادا",
  "Unpaid": "غیر ادا شدہ",

  // Actions & Buttons
  "Add": "نیا شامل کریں",
  "Add Purchase": "نئی خریداری شامل کریں",
  "Add Sale": "نئی سیلز شامل کریں",
  "Export CSV": "ایکسپورٹ CSV",
  "Print": "پرنٹ کریں",
  "Print Statement": "کھاتہ اسٹیٹمنٹ پرنٹ کریں",
  "Refresh": "تازہ کریں",
  "Save": "محفوظ کریں",
  "Cancel": "منسوخ",
  "Search": "تلاش کریں...",
  "View Full Ledger": "مکمل کھاتہ دیکھیں",
  "Customer Ledger": "گاہک کا کھاتہ",
  "Vendor Ledger": "سپلائر کا کھاتہ",
  "Chart of Accounts": "کھاتوں کی فہرست",
  "Trial Balance": "میزان پرتال",
  "General Journal": "روزنامچہ",
};

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (en: string) => en,
  isUrdu: false,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    try {
      const savedLang = localStorage.getItem("sb_lang") as Language;
      if (savedLang === "en" || savedLang === "ur") {
        setLanguageState(savedLang);
      }
    } catch {}
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem("sb_lang", lang);
    } catch {}
  };

  const toggleLanguage = () => {
    setLanguage(language === "en" ? "ur" : "en");
  };

  const t = (en: string, ur?: string): string => {
    if (language === "ur") {
      return ur || DICTIONARY[en] || en;
    }
    return en;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        toggleLanguage,
        t,
        isUrdu: language === "ur",
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
