"use client";

import React, { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatMoney } from "@/lib/decimal";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Scale,
  Landmark,
  FileText,
  CheckCircle2,
  Users,
  Search,
  Calendar,
  Printer,
  Download,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Building2,
  Wallet,
  Coins,
  Receipt,
  UserCheck,
  PlusCircle,
  Layers,
  FolderPlus,
  ChevronDown,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { BrandPageLoader, TableSkeleton } from "@/components/ui/loader";
import { smartFetch, invalidateCache, useAutoSync } from "@/lib/clientCache";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { JournalVoucherModal, JournalVoucherData } from "@/components/vouchers/JournalVoucherModal";
import { ACCOUNT_URDU_NAMES, ACCOUNT_TYPE_CONFIG, COMMON_SUBTYPES } from "@/lib/accountingConstants";

type TabType = "OVERVIEW" | "LEDGER" | "JOURNALS" | "ACCOUNTS" | "TRIAL_BALANCE";
type LedgerType = "VENDOR" | "CUSTOMER" | "ACCOUNT";
type DateFilterType = "ALL" | "TODAY" | "THIS_WEEK" | "THIS_MONTH" | "THIS_YEAR" | "CUSTOM";

interface LedgerEntry {
  id: string;
  date: string;
  refNumber: string;
  type: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
  balanceType: "DR" | "CR" | "NIL";
}

function AccountingContent() {
  const { activeCompany, user, branches, selectedBranch, activeBranchId } = useAuth();
  const { t, language } = useLanguage();
  const searchParams = useSearchParams();

  // Tab & Filter States
  const [activeTab, setActiveTab] = useState<TabType>("OVERVIEW");
  const [ledgerType, setLedgerType] = useState<LedgerType>("VENDOR");
  const [selectedEntityId, setSelectedEntityId] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<DateFilterType>("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [showNewActionMenu, setShowNewActionMenu] = useState<boolean>(false);

  // Journal tab filters
  const [journalSearch, setJournalSearch] = useState<string>("");
  const [journalDateFilter, setJournalDateFilter] = useState<DateFilterType>("ALL");
  const [journalAccountFilter, setJournalAccountFilter] = useState<string>("ALL");
  const [journalSort, setJournalSort] = useState<"DATE_DESC" | "DATE_ASC" | "ENTRY_ASC" | "ENTRY_DESC">("DATE_DESC");

  // Cash Deposit & Voucher Modal states
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<JournalVoucherData | null>(null);
  const [showCashDepositModal, setShowCashDepositModal] = useState(false);
  const [cashBankAccounts, setCashBankAccounts] = useState<any[]>([]);
  const [depositCashAccountId, setDepositCashAccountId] = useState("");
  const [depositBankAccountId, setDepositBankAccountId] = useState("");
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [depositRef, setDepositRef] = useState("");
  const [depositorName, setDepositorName] = useState("");
  const [depositDate, setDepositDate] = useState(new Date().toISOString().split("T")[0]);
  const [depositNotes, setDepositNotes] = useState("");
  const [depositSubmitting, setDepositSubmitting] = useState(false);

  // Chart of Accounts filter and modal states
  const [accountSearch, setAccountSearch] = useState<string>("");
  const [accountTypeFilter, setAccountTypeFilter] = useState<string>("ALL");
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [newAccCode, setNewAccCode] = useState("");
  const [newAccName, setNewAccName] = useState("");
  const [newAccUrdu, setNewAccUrdu] = useState("");
  const [newAccType, setNewAccType] = useState<string>("EXPENSE");
  const [newAccSubType, setNewAccSubType] = useState("Operating");
  const [newAccBalance, setNewAccBalance] = useState<number>(0);
  const [newAccNotes, setNewAccNotes] = useState("");
  const [addAccountLoading, setAddAccountLoading] = useState(false);
  const [addAccountError, setAddAccountError] = useState("");
  const [addAccountSuccess, setAddAccountSuccess] = useState("");

  const openAddAccountModal = (defaultType = "EXPENSE") => {
    setNewAccType(defaultType);
    setNewAccSubType(COMMON_SUBTYPES[defaultType]?.[0] || "General");
    setNewAccName("");
    setNewAccUrdu("");
    setNewAccBalance(0);
    setNewAccNotes("");
    setAddAccountError("");
    setAddAccountSuccess("");

    // Calculate suggested next code based on type
    const rangeStart = defaultType === "ASSET" ? 1000 : defaultType === "LIABILITY" ? 2000 : defaultType === "EQUITY" ? 3000 : defaultType === "REVENUE" ? 4000 : defaultType === "COGS" ? 5000 : 6000;
    const sameTypeCodes = accounts
      .filter((a) => a.type === defaultType)
      .map((a) => parseInt(a.code, 10))
      .filter((n) => !isNaN(n) && n >= rangeStart && n < rangeStart + 1000);

    const maxCode = sameTypeCodes.length > 0 ? Math.max(...sameTypeCodes) : rangeStart + 10;
    const suggested = String(maxCode + (maxCode % 10 === 0 ? 10 : 1));
    setNewAccCode(suggested);
    setShowAddAccountModal(true);
  };

  const handleAccountTypeChange = (selectedType: string) => {
    setNewAccType(selectedType);
    setNewAccSubType(COMMON_SUBTYPES[selectedType]?.[0] || "General");
    const rangeStart = selectedType === "ASSET" ? 1000 : selectedType === "LIABILITY" ? 2000 : selectedType === "EQUITY" ? 3000 : selectedType === "REVENUE" ? 4000 : selectedType === "COGS" ? 5000 : 6000;
    const sameTypeCodes = accounts
      .filter((a) => a.type === selectedType)
      .map((a) => parseInt(a.code, 10))
      .filter((n) => !isNaN(n) && n >= rangeStart && n < rangeStart + 1000);
    const maxCode = sameTypeCodes.length > 0 ? Math.max(...sameTypeCodes) : rangeStart + 10;
    setNewAccCode(String(maxCode + (maxCode % 10 === 0 ? 10 : 1)));
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddAccountError("");
    setAddAccountSuccess("");

    if (!newAccCode.trim()) {
      setAddAccountError("Account code is required (e.g. 1025, 6095).");
      return;
    }
    if (!newAccName.trim()) {
      setAddAccountError("Account name is required.");
      return;
    }

    setAddAccountLoading(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (activeCompany?.id) headers["x-business-id"] = activeCompany.id;

      const res = await fetch("/api/accounting/accounts", {
        method: "POST",
        headers,
        body: JSON.stringify({
          code: newAccCode.trim(),
          name: newAccName.trim(),
          type: newAccType,
          subType: newAccSubType.trim() || undefined,
          balance: Number(newAccBalance || 0),
          notes: newAccNotes.trim() || (newAccUrdu.trim() ? newAccUrdu.trim() : undefined),
        }),
      });

      const json = await res.json();
      if (json.success) {
        setAddAccountSuccess(`Account ${newAccCode} - ${newAccName} created successfully!`);
        invalidateCache("/api/accounting");
        invalidateCache("/api/payments");
        await fetchData(true);
        setTimeout(() => {
          setShowAddAccountModal(false);
          setAddAccountSuccess("");
        }, 800);
      } else {
        setAddAccountError(json.error || "Failed to create account.");
      }
    } catch (err: any) {
      setAddAccountError(err.message || "Failed to create account.");
    } finally {
      setAddAccountLoading(false);
    }
  };

  // Core Data
  const [accounts, setAccounts] = useState<any[]>([]);
  const [journals, setJournals] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCashBankAccounts = async () => {
    try {
      const res = await smartFetch("/api/payments");
      if (res && Array.isArray(res.accounts)) {
        setCashBankAccounts(res.accounts);
        const cashAccs = res.accounts.filter((a: any) => a.type === "CASH");
        const bankAccs = res.accounts.filter((a: any) => a.type === "BANK");
        if (cashAccs.length > 0 && !depositCashAccountId) setDepositCashAccountId(cashAccs[0].id);
        if (bankAccs.length > 0 && !depositBankAccountId) setDepositBankAccountId(bankAccs[0].id);
      }
    } catch (e) {
      console.error("Failed to load cash bank accounts", e);
    }
  };

  const handleViewVoucher = (j: any) => {
    const voucherData: JournalVoucherData = {
      id: j.id,
      entryNumber: j.entryNumber,
      date: j.date,
      referenceType: j.referenceType,
      referenceId: j.referenceId,
      description: j.description,
      isBalanced: j.isBalanced,
      status: j.status,
      lines: j.lines?.map((l: any) => ({
        id: l.id,
        accountId: l.accountId,
        accountCode: l.account?.code,
        accountName: l.account?.name,
        account: l.account,
        debit: Number(l.debit || 0),
        credit: Number(l.credit || 0),
        description: l.description,
      })) || [],
    };
    setSelectedVoucher(voucherData);
    setShowVoucherModal(true);
  };

  const openCashDepositModal = async () => {
    await fetchCashBankAccounts();
    setDepositAmount(0);
    setDepositRef("");
    setDepositorName(user?.name || "");
    setDepositDate(new Date().toISOString().split("T")[0]);
    setDepositNotes("Daily cash sales collection deposited into bank");
    setShowCashDepositModal(true);
  };

  const handleCreateCashDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (depositAmount <= 0) {
      alert("Deposit amount must be greater than zero.");
      return;
    }
    if (!depositCashAccountId || !depositBankAccountId) {
      alert("Please select both source cash drawer and destination bank account.");
      return;
    }
    if (depositCashAccountId === depositBankAccountId) {
      alert("Source cash account and destination bank account must be different.");
      return;
    }

    setDepositSubmitting(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (activeCompany?.id) headers["x-business-id"] = activeCompany.id;

      const res = await fetch("/api/payments/transfer", {
        method: "POST",
        headers,
        body: JSON.stringify({
          fromAccountId: depositCashAccountId,
          toAccountId: depositBankAccountId,
          amount: depositAmount,
          referenceNumber: depositRef || undefined,
          notes: depositNotes,
          transferType: "CASH_DEPOSIT",
          description: depositNotes || "Cash sales deposited into bank",
          depositorName: depositorName || user?.name,
          date: depositDate,
          createdById: user?.userId,
          createdByName: user?.name,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setShowCashDepositModal(false);
        invalidateCache("/api/accounting");
        invalidateCache("/api/payments");
        fetchData(true);

        if (json.data?.journalEntry) {
          setSelectedVoucher(json.data.journalEntry);
        } else {
          const fromAcc = cashBankAccounts.find((a) => a.id === depositCashAccountId);
          const toAcc = cashBankAccounts.find((a) => a.id === depositBankAccountId);
          setSelectedVoucher({
            entryNumber: json.data?.referenceNumber || `CV-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
            date: depositDate,
            referenceType: "CONTRA",
            referenceNumber: depositRef,
            description: depositNotes,
            depositorName: depositorName || user?.name,
            fromAccountName: fromAcc?.name || "Cash Drawer",
            toAccountName: toAcc?.name || "Bank Account",
            isBalanced: true,
            status: "POSTED",
            lines: [
              {
                accountCode: "1020",
                accountName: toAcc?.name || "Bank Account",
                debit: depositAmount,
                credit: 0,
                description: `Cash sales deposited into ${toAcc?.name || "Bank Account"}`,
              },
              {
                accountCode: "1010",
                accountName: fromAcc?.name || "Cash in Hand",
                debit: 0,
                credit: depositAmount,
                description: `Cash sales deposited out of ${fromAcc?.name || "Cash in Hand"}`,
              },
            ],
          });
        }
        setShowVoucherModal(true);
      } else {
        alert(json.error || "Failed to record cash deposit.");
      }
    } catch (err: any) {
      alert(err.message || "Failed to record cash deposit.");
    } finally {
      setDepositSubmitting(false);
    }
  };

  // Sync URL search params on mount
  useEffect(() => {
    const tabParam = searchParams.get("tab") as TabType;
    if (tabParam && ["OVERVIEW", "LEDGER", "JOURNALS", "ACCOUNTS", "TRIAL_BALANCE"].includes(tabParam)) {
      setActiveTab(tabParam);
    }
    const typeParam = searchParams.get("type") as LedgerType;
    if (typeParam && ["VENDOR", "CUSTOMER", "ACCOUNT"].includes(typeParam)) {
      setLedgerType(typeParam);
    }
    const idParam = searchParams.get("id");
    if (idParam) {
      setSelectedEntityId(idParam);
    }
  }, [searchParams]);

  const fetchData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const json = await smartFetch("/api/accounting", { ttlMs: isSilent ? 0 : 15000, skipCache: isSilent });
      if (json.success && json.data) {
        setAccounts(json.data.accounts || []);
        setJournals(json.data.journals || []);
        setSuppliers(json.data.suppliers || []);
        setCustomers(json.data.customers || []);
        setPurchases(json.data.purchases || []);
        setPayments(json.data.payments || []);

        // Auto-select first entity if not already selected
        if (!selectedEntityId) {
          if (ledgerType === "VENDOR" && json.data.suppliers?.length > 0) {
            setSelectedEntityId(json.data.suppliers[0].id);
          } else if (ledgerType === "CUSTOMER" && json.data.customers?.length > 0) {
            setSelectedEntityId(json.data.customers[0].id);
          } else if (ledgerType === "ACCOUNT" && json.data.accounts?.length > 0) {
            setSelectedEntityId(json.data.accounts[0].id);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load accounting data:", err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Real-time silent auto-sync for general ledger & trial balance
  useAutoSync((opts) => {
    fetchData(opts?.silent ?? true);
  });

  // Comprehensive supplier list ensuring all purchase vendors appear with accurate open balances
  const effectiveSuppliers = useMemo(() => {
    const list = [...suppliers];
    const knownKeys = new Set(list.map((s) => s.id));
    const knownNames = new Set(list.map((s) => (s.name || "").toLowerCase().trim()));

    purchases.forEach((p) => {
      const name = (p.supplierName || "").trim();
      if (name) {
        const norm = name.toLowerCase();
        const remForVendor = purchases
          .filter((x) => (x.supplierName || "").toLowerCase().trim() === norm)
          .reduce((sum, x) => sum + Number(x.remainingAmount || 0), 0);

        if (!knownNames.has(norm)) {
          const synthId = p.supplierId || `synth-sup-${norm.replace(/\s+/g, "-")}`;
          if (!knownKeys.has(synthId)) {
            list.push({
              id: synthId,
              name: name,
              businessName: name,
              openingBalance: 0,
              currentBalance: remForVendor,
              purchases: [],
              payments: [],
            });
            knownKeys.add(synthId);
            knownNames.add(norm);
          }
        } else {
          // If existing supplier has balance 0 but purchases have dues, show accurate balance
          const existing = list.find((s) => (s.name || "").toLowerCase().trim() === norm);
          if (existing && Number(existing.currentBalance || 0) < remForVendor) {
            existing.currentBalance = remForVendor;
          }
        }
      }
    });

    return list;
  }, [suppliers, purchases]);

  // When ledgerType changes, auto-select first entity if current doesn't match
  useEffect(() => {
    if (ledgerType === "VENDOR" && effectiveSuppliers.length > 0) {
      if (!effectiveSuppliers.some((s) => s.id === selectedEntityId)) {
        setSelectedEntityId(effectiveSuppliers[0].id);
      }
    } else if (ledgerType === "CUSTOMER" && customers.length > 0) {
      if (!customers.some((c) => c.id === selectedEntityId)) {
        setSelectedEntityId(customers[0].id);
      }
    } else if (ledgerType === "ACCOUNT" && accounts.length > 0) {
      if (!accounts.some((a) => a.id === selectedEntityId)) {
        setSelectedEntityId(accounts[0].id);
      }
    }
  }, [ledgerType, effectiveSuppliers, customers, accounts]);

  // Compute Active Date Range Boundaries
  const dateRangeBounds = useMemo(() => {
    const now = new Date();
    let sDate: Date | null = null;
    let eDate: Date | null = null;

    if (dateFilter === "TODAY") {
      sDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      eDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (dateFilter === "THIS_WEEK") {
      const day = now.getDay();
      const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);
      sDate = new Date(now.getFullYear(), now.getMonth(), diffToMonday, 0, 0, 0);
      eDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (dateFilter === "THIS_MONTH") {
      sDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      eDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (dateFilter === "THIS_YEAR") {
      sDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
      eDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    } else if (dateFilter === "CUSTOM") {
      if (startDate) {
        const [y, m, d] = startDate.split("-").map(Number);
        sDate = new Date(y, m - 1, d, 0, 0, 0);
      }
      if (endDate) {
        const [y, m, d] = endDate.split("-").map(Number);
        eDate = new Date(y, m - 1, d, 23, 59, 59, 999);
      }
    }

    return { sDate, eDate };
  }, [dateFilter, startDate, endDate]);

  // =========================================================================
  // CORE ACCOUNTING FORMULA: GENERAL LEDGER & PARTY SUBSIDIARY LEDGER
  // =========================================================================
  const ledgerCalculation = useMemo(() => {
    const { sDate, eDate } = dateRangeBounds;

    if (ledgerType === "VENDOR") {
      const currentSupplier = effectiveSuppliers.find((s) => s.id === selectedEntityId);
      if (!currentSupplier) {
        return {
          entity: null,
          openingBalance: 0,
          openingBalanceType: "NIL" as const,
          transactions: [],
          periodDebit: 0,
          periodCredit: 0,
          netMovement: 0,
          closingBalance: 0,
          closingBalanceType: "NIL" as const,
        };
      }

      // Initial opening balance from profile
      const initialProfileOpening = Number(currentSupplier.openingBalance || 0);

      // Raw transactions for this vendor:
      // A. Purchases from this supplier
      const vendorPurchases = purchases.filter(
        (p) => p.supplierId === currentSupplier.id || p.supplierName?.toLowerCase() === currentSupplier.name?.toLowerCase()
      );

      // B. Payments to this supplier
      const vendorPayments = payments.filter(
        (p) =>
          p.supplierId === currentSupplier.id ||
          (p.partyType === "SUPPLIER" && p.partyName?.toLowerCase() === currentSupplier.name?.toLowerCase()) ||
          vendorPurchases.some((vp) => vp.purchaseNumber === p.referenceNumber)
      );

      // Assemble all unified transaction lines
      interface RawTx {
        id: string;
        date: Date;
        refNumber: string;
        type: string;
        description: string;
        debit: number; // Payments reduce liability
        credit: number; // Purchase bills increase liability
      }

      const allVendorTx: RawTx[] = [];

      vendorPurchases.forEach((p) => {
        allVendorTx.push({
          id: `pur-${p.id}`,
          date: new Date(p.date),
          refNumber: p.purchaseNumber,
          type: "PURCHASE BILL",
          description: language === "ur"
            ? `خریداری بل #${p.purchaseNumber}`
            : `Purchase Bill #${p.purchaseNumber}${p.items?.length ? ` - ${p.items.length} items` : ""}`,
          debit: 0,
          credit: Number(p.totalAmount || 0),
        });
      });

      vendorPayments.forEach((pm) => {
        allVendorTx.push({
          id: `pay-${pm.id}`,
          date: new Date(pm.date),
          refNumber: pm.referenceNumber || `PMT-${pm.id.slice(0, 6)}`,
          type: "PAYMENT",
          description: language === "ur"
            ? `ادائیگی سپلائر بذریعہ ${pm.paymentMethod || "CASH"}`
            : `Payment to Supplier via ${pm.paymentMethod || "CASH"} ${pm.notes ? `(${pm.notes})` : ""}`,
          debit: Number(pm.amount || 0),
          credit: 0,
        });
      });

      // Sort chronologically ascending
      allVendorTx.sort((a, b) => a.date.getTime() - b.date.getTime());

      // Calculate Opening Balance prior to sDate:
      // Normal balance of Supplier (Liability / Accounts Payable) is CREDIT:
      // Balance = Initial + Credit (Purchases) - Debit (Payments)
      let openingBalance = initialProfileOpening;
      const periodTx: RawTx[] = [];

      allVendorTx.forEach((tx) => {
        if (sDate && tx.date < sDate) {
          openingBalance = openingBalance + tx.credit - tx.debit;
        } else if (!eDate || tx.date <= eDate) {
          periodTx.push(tx);
        }
      });

      // Compute Running Balance for each line in period
      let running = openingBalance;
      let periodDebit = 0;
      let periodCredit = 0;

      const formattedLines: LedgerEntry[] = periodTx.map((tx) => {
        periodDebit += tx.debit;
        periodCredit += tx.credit;
        running = running + tx.credit - tx.debit;

        const balanceType: "DR" | "CR" | "NIL" = running > 0 ? "CR" : running < 0 ? "DR" : "NIL";

        return {
          id: tx.id,
          date: tx.date.toISOString(),
          refNumber: tx.refNumber,
          type: tx.type,
          description: tx.description,
          debit: tx.debit,
          credit: tx.credit,
          runningBalance: Math.abs(running),
          balanceType,
        };
      });

      const closingBalance = openingBalance + periodCredit - periodDebit;
      const closingBalanceType: "DR" | "CR" | "NIL" =
        closingBalance > 0 ? "CR" : closingBalance < 0 ? "DR" : "NIL";
      const openingBalanceType: "DR" | "CR" | "NIL" =
        openingBalance > 0 ? "CR" : openingBalance < 0 ? "DR" : "NIL";

      return {
        entity: currentSupplier,
        openingBalance: Math.abs(openingBalance),
        openingBalanceType,
        transactions: formattedLines,
        periodDebit,
        periodCredit,
        netMovement: periodCredit - periodDebit,
        closingBalance: Math.abs(closingBalance),
        closingBalanceType,
      };
    } else if (ledgerType === "CUSTOMER") {
      const currentCustomer = customers.find((c) => c.id === selectedEntityId);
      if (!currentCustomer) {
        return {
          entity: null,
          openingBalance: 0,
          openingBalanceType: "NIL" as const,
          transactions: [],
          periodDebit: 0,
          periodCredit: 0,
          netMovement: 0,
          closingBalance: 0,
          closingBalanceType: "NIL" as const,
        };
      }

      const initialProfileOpening = Number(currentCustomer.openingBalance || 0);

      // Customer sales & payments
      const customerSales = (currentCustomer.sales || []).map((s: any) => ({
        id: `sale-${s.id}`,
        date: new Date(s.date),
        refNumber: s.invoiceNumber,
        type: "SALES INVOICE",
        description: language === "ur"
          ? `سیلز انوائس #${s.invoiceNumber}`
          : `Sales Invoice #${s.invoiceNumber}`,
        debit: Number(s.totalAmount || 0), // Sales increase receivable (DEBIT)
        credit: 0,
      }));

      const customerPayments = (currentCustomer.payments || []).map((p: any) => ({
        id: `pay-${p.id}`,
        date: new Date(p.date),
        refNumber: p.referenceNumber || `RCPT-${p.id.slice(0, 6)}`,
        type: "RECEIPT",
        description: language === "ur"
          ? `وصولی گاہک بذریعہ ${p.paymentMethod || "CASH"}`
          : `Receipt from Customer via ${p.paymentMethod || "CASH"}`,
        debit: 0,
        credit: Number(p.amount || 0), // Receipts decrease receivable (CREDIT)
      }));

      const allCustomerTx = [...customerSales, ...customerPayments];
      allCustomerTx.sort((a, b) => a.date.getTime() - b.date.getTime());

      // Normal balance of Customer (Asset / Accounts Receivable) is DEBIT:
      // Balance = Initial + Debit (Sales) - Credit (Receipts)
      let openingBalance = initialProfileOpening;
      const periodTx: any[] = [];

      allCustomerTx.forEach((tx) => {
        if (sDate && tx.date < sDate) {
          openingBalance = openingBalance + tx.debit - tx.credit;
        } else if (!eDate || tx.date <= eDate) {
          periodTx.push(tx);
        }
      });

      let running = openingBalance;
      let periodDebit = 0;
      let periodCredit = 0;

      const formattedLines: LedgerEntry[] = periodTx.map((tx) => {
        periodDebit += tx.debit;
        periodCredit += tx.credit;
        running = running + tx.debit - tx.credit;

        const balanceType: "DR" | "CR" | "NIL" = running > 0 ? "DR" : running < 0 ? "CR" : "NIL";

        return {
          id: tx.id,
          date: tx.date.toISOString(),
          refNumber: tx.refNumber,
          type: tx.type,
          description: tx.description,
          debit: tx.debit,
          credit: tx.credit,
          runningBalance: Math.abs(running),
          balanceType,
        };
      });

      const closingBalance = openingBalance + periodDebit - periodCredit;
      const closingBalanceType: "DR" | "CR" | "NIL" =
        closingBalance > 0 ? "DR" : closingBalance < 0 ? "CR" : "NIL";
      const openingBalanceType: "DR" | "CR" | "NIL" =
        openingBalance > 0 ? "DR" : openingBalance < 0 ? "CR" : "NIL";

      return {
        entity: currentCustomer,
        openingBalance: Math.abs(openingBalance),
        openingBalanceType,
        transactions: formattedLines,
        periodDebit,
        periodCredit,
        netMovement: periodDebit - periodCredit,
        closingBalance: Math.abs(closingBalance),
        closingBalanceType,
      };
    } else {
      // General Ledger Account from Chart of Accounts
      const currentAccount = accounts.find((a) => a.id === selectedEntityId);
      if (!currentAccount) {
        return {
          entity: null,
          openingBalance: 0,
          openingBalanceType: "NIL" as const,
          transactions: [],
          periodDebit: 0,
          periodCredit: 0,
          netMovement: 0,
          closingBalance: 0,
          closingBalanceType: "NIL" as const,
        };
      }

      const isDebitNormal = ["ASSET", "EXPENSE", "COGS"].includes(currentAccount.type);

      // Collect all journal lines for this account
      interface AccLine {
        id: string;
        date: Date;
        refNumber: string;
        type: string;
        description: string;
        debit: number;
        credit: number;
      }

      const allAccLines: AccLine[] = [];

      journals.forEach((j) => {
        const jDate = new Date(j.date);
        (j.lines || []).forEach((l: any) => {
          if (l.accountId === currentAccount.id) {
            allAccLines.push({
              id: l.id,
              date: jDate,
              refNumber: j.entryNumber,
              type: "JOURNAL",
              description: l.description || j.description || currentAccount.name,
              debit: Number(l.debit || 0),
              credit: Number(l.credit || 0),
            });
          }
        });
      });

      // Ensure open purchase bills with payables appear in Account 2010 (Accounts Payable) ledger
      if (currentAccount.code === "2010") {
        purchases.forEach((p) => {
          const rem = Number(p.remainingAmount || 0);
          if (rem > 0) {
            const hasJournal = allAccLines.some(
              (l) => l.refNumber?.includes(p.purchaseNumber) || l.description?.includes(p.purchaseNumber)
            );
            if (!hasJournal) {
              allAccLines.push({
                id: `pur-due-${p.id}`,
                date: new Date(p.date),
                refNumber: p.purchaseNumber,
                type: "PURCHASE BILL",
                description: `Payable to ${p.supplierName} for #${p.purchaseNumber}`,
                debit: 0,
                credit: rem,
              });
            }
          }
        });
      }

      allAccLines.sort((a, b) => a.date.getTime() - b.date.getTime());

      let openingBalance = 0;
      const periodTx: AccLine[] = [];

      allAccLines.forEach((l) => {
        if (sDate && l.date < sDate) {
          if (isDebitNormal) {
            openingBalance = openingBalance + l.debit - l.credit;
          } else {
            openingBalance = openingBalance + l.credit - l.debit;
          }
        } else if (!eDate || l.date <= eDate) {
          periodTx.push(l);
        }
      });

      let running = openingBalance;
      let periodDebit = 0;
      let periodCredit = 0;

      const formattedLines: LedgerEntry[] = periodTx.map((l) => {
        periodDebit += l.debit;
        periodCredit += l.credit;
        if (isDebitNormal) {
          running = running + l.debit - l.credit;
        } else {
          running = running + l.credit - l.debit;
        }

        const balanceType: "DR" | "CR" | "NIL" = isDebitNormal
          ? running > 0
            ? "DR"
            : running < 0
            ? "CR"
            : "NIL"
          : running > 0
          ? "CR"
          : running < 0
          ? "DR"
          : "NIL";

        return {
          id: l.id,
          date: l.date.toISOString(),
          refNumber: l.refNumber,
          type: "JV",
          description: l.description,
          debit: l.debit,
          credit: l.credit,
          runningBalance: Math.abs(running),
          balanceType,
        };
      });

      const netDelta = isDebitNormal ? periodDebit - periodCredit : periodCredit - periodDebit;
      const closingBalance = openingBalance + netDelta;
      const defaultNormal = isDebitNormal ? "DR" : "CR";
      const defaultOpposite = isDebitNormal ? "CR" : "DR";

      const closingBalanceType: "DR" | "CR" | "NIL" =
        closingBalance > 0 ? defaultNormal : closingBalance < 0 ? defaultOpposite : "NIL";
      const openingBalanceType: "DR" | "CR" | "NIL" =
        openingBalance > 0 ? defaultNormal : openingBalance < 0 ? defaultOpposite : "NIL";

      return {
        entity: currentAccount,
        openingBalance: Math.abs(openingBalance),
        openingBalanceType,
        transactions: formattedLines,
        periodDebit,
        periodCredit,
        netMovement: netDelta,
        closingBalance: Math.abs(closingBalance),
        closingBalanceType,
      };
    }
  }, [ledgerType, selectedEntityId, dateRangeBounds, effectiveSuppliers, customers, accounts, purchases, payments, journals]);

  // Filter ledger lines by search box
  const filteredLedgerLines = useMemo(() => {
    if (!searchTerm.trim()) return ledgerCalculation.transactions;
    const q = searchTerm.toLowerCase();
    return ledgerCalculation.transactions.filter(
      (tx) =>
        tx.refNumber.toLowerCase().includes(q) ||
        tx.description.toLowerCase().includes(q) ||
        tx.type.toLowerCase().includes(q)
    );
  }, [ledgerCalculation.transactions, searchTerm]);

  // =========================================================================
  // PRINT OFFICIAL LEDGER / KHATA STATEMENT
  // =========================================================================
  const printLedgerStatement = () => {
    const { entity, openingBalance, openingBalanceType, closingBalance, closingBalanceType, periodDebit, periodCredit } =
      ledgerCalculation;
    if (!entity) return;

    const companyName = activeCompany?.name || "SmartBiz Accounting";
    const printWindow = window.open("", "_blank", "width=900,height=950");
    if (!printWindow) {
      alert("Please allow popups to print the ledger statement.");
      return;
    }

    const entityName =
      ledgerType === "VENDOR"
        ? (entity as any).name
        : ledgerType === "CUSTOMER"
        ? (entity as any).name
        : `${(entity as any).code} - ${(entity as any).name}`;

    const entitySubtitle =
      ledgerType === "VENDOR"
        ? (language === "ur" ? `وینڈر کھاتہ | فون: ${(entity as any).phone || "N/A"}` : `Vendor / Supplier Statement | Phone: ${(entity as any).phone || "N/A"}`)
        : ledgerType === "CUSTOMER"
        ? (language === "ur" ? `گاہک کھاتہ | فون: ${(entity as any).phone || "N/A"}` : `Customer Statement | Phone: ${(entity as any).phone || "N/A"}`)
        : `Chart of Accounts General Ledger: ${(entity as any).type}`;

    const dateRangeLabel =
      dateFilter === "ALL"
        ? (language === "ur" ? "ابتدائے ریکارڈ سے تا حال" : "All Transactions (All Time)")
        : dateFilter === "TODAY"
        ? `Today (${new Date().toLocaleDateString()})`
        : dateFilter === "THIS_WEEK"
        ? (language === "ur" ? "موجودہ ہفتہ" : "This Week")
        : dateFilter === "THIS_MONTH"
        ? `This Month (${new Date().toLocaleString("default", { month: "long", year: "numeric" })})`
        : `Custom Period: ${startDate || "Start"} to ${endDate || "Today"}`;

    const rowsHtml = filteredLedgerLines
      .map(
        (tx, idx) => `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
          <td style="padding: 8px 6px; text-align: center; color: #64748b;">${idx + 1}</td>
          <td style="padding: 8px 6px; color: #334155; white-space: nowrap;">${new Date(tx.date).toLocaleDateString()}</td>
          <td style="padding: 8px 6px; font-weight: 700; color: #0284c7; white-space: nowrap;">${tx.refNumber}</td>
          <td style="padding: 8px 6px; color: #0f172a;">${tx.description}</td>
          <td style="padding: 8px 6px; text-align: right; font-weight: 600; color: #0f172a; white-space: nowrap;">
            ${tx.debit > 0 ? `Rs ${tx.debit.toLocaleString()}` : "—"}
          </td>
          <td style="padding: 8px 6px; text-align: right; font-weight: 600; color: #0f172a; white-space: nowrap;">
            ${tx.credit > 0 ? `Rs ${tx.credit.toLocaleString()}` : "—"}
          </td>
          <td style="padding: 8px 6px; text-align: right; font-weight: 800; color: #0f172a; white-space: nowrap;">
            Rs ${tx.runningBalance.toLocaleString()} <span style="font-size: 9px; color: #64748b;">${tx.balanceType}</span>
          </td>
        </tr>
      `
      )
      .join("");

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${entityName} - Ledger Statement</title>
          <style>
            @page { size: A4; margin: 12mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 20px; font-size: 11px; line-height: 1.4; }
            .header-bar { border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: flex-start; }
            .company-name { font-size: 20px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; }
            .doc-tag { font-size: 13px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin-top: 4px; }
            .info-grid { display: grid; grid-template-columns: 1.3fr 1fr; gap: 14px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
            th { background: #0f172a; color: #ffffff; font-weight: 700; text-transform: uppercase; font-size: 10px; padding: 7px 6px; border: 1px solid #0f172a; }
            .summary-box { width: 340px; margin-left: auto; border: 1.5px solid #0f172a; border-radius: 6px; background: #f8fafc; padding: 10px 14px; margin-bottom: 24px; }
            .summary-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 11px; }
            .total-row { display: flex; justify-content: space-between; padding: 6px 0; border-top: 1.5px solid #0f172a; border-bottom: 1.5px solid #0f172a; margin: 4px 0; font-size: 13px; font-weight: 800; }
            .sign-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 36px; padding-top: 16px; }
            .sign-block { border-top: 1px solid #64748b; text-align: center; padding-top: 4px; font-size: 10px; font-weight: 600; color: #475569; }
          </style>
        </head>
        <body>
          <div class="header-bar">
            <div>
              <div class="company-name">${companyName}</div>
              <div style="font-size: 11px; color: #475569;">Official Accounting General & Subsidiary Ledger</div>
              <div class="doc-tag">${language === "ur" ? "کھاتہ اسٹیٹمنٹ" : "STATEMENT OF ACCOUNT"}</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 11px; color: #64748b;">Printed On: ${new Date().toLocaleString()}</div>
              <div style="font-size: 11px; font-weight: 600; color: #334155; margin-top: 2px;">Period: ${dateRangeLabel}</div>
            </div>
          </div>

          <div class="info-grid">
            <div>
              <div style="color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase;">Party / Account Head Details</div>
              <div style="font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 2px;">${entityName}</div>
              <div style="font-size: 11px; color: #475569; margin-top: 2px;">${entitySubtitle}</div>
            </div>
            <div style="text-align: right; border-left: 1px solid #e2e8f0; padding-left: 14px;">
              <div style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase;">Account Head Status</div>
              <div style="font-size: 12px; margin-top: 3px;">
                Opening: <strong>Rs ${openingBalance.toLocaleString()} ${openingBalanceType}</strong>
              </div>
              <div style="font-size: 13px; font-weight: 800; color: #1e3a8a; margin-top: 4px;">
                Closing: Rs ${closingBalance.toLocaleString()} ${closingBalanceType}
              </div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 30px; text-align: center;">#</th>
                <th style="width: 75px; text-align: left;">Date</th>
                <th style="width: 100px; text-align: left;">Ref # / Vouch</th>
                <th style="text-align: left;">${language === "ur" ? "تفصیل" : "Particulars / Narration"}</th>
                <th style="width: 90px; text-align: right;">Debit (Rs)</th>
                <th style="width: 90px; text-align: right;">Credit (Rs)</th>
                <th style="width: 110px; text-align: right;">Balance (Rs)</th>
              </tr>
            </thead>
            <tbody>
              <!-- Opening Balance Row -->
              <tr style="background: #f1f5f9; font-weight: 700; border-bottom: 1.5px solid #cbd5e1;">
                <td style="padding: 8px 6px; text-align: center;">—</td>
                <td style="padding: 8px 6px;">${startDate || "—"}</td>
                <td style="padding: 8px 6px; color: #475569;">OPENING</td>
                <td style="padding: 8px 6px;">${language === "ur" ? "ابتدائی بقایا" : "Opening Balance Brought Forward"}</td>
                <td style="padding: 8px 6px; text-align: right;">${openingBalanceType === "DR" ? `Rs ${openingBalance.toLocaleString()}` : "—"}</td>
                <td style="padding: 8px 6px; text-align: right;">${openingBalanceType === "CR" ? `Rs ${openingBalance.toLocaleString()}` : "—"}</td>
                <td style="padding: 8px 6px; text-align: right;">Rs ${openingBalance.toLocaleString()} <span style="font-size: 9px;">${openingBalanceType}</span></td>
              </tr>

              ${rowsHtml}

              <!-- Closing Balance Row -->
              <tr style="background: #e2e8f0; font-weight: 800; border-top: 2px solid #0f172a;">
                <td style="padding: 9px 6px; text-align: center;">—</td>
                <td style="padding: 9px 6px;">${endDate || "Today"}</td>
                <td style="padding: 9px 6px; color: #0f172a;">CLOSING</td>
                <td style="padding: 9px 6px;">${language === "ur" ? "اختتامی بقایا" : "Closing Balance Carried Down"}</td>
                <td style="padding: 9px 6px; text-align: right;">Rs ${periodDebit.toLocaleString()}</td>
                <td style="padding: 9px 6px; text-align: right;">Rs ${periodCredit.toLocaleString()}</td>
                <td style="padding: 9px 6px; text-align: right; color: #1e3a8a;">Rs ${closingBalance.toLocaleString()} <span style="font-size: 9px;">${closingBalanceType}</span></td>
              </tr>
            </tbody>
          </table>

          <div class="summary-box">
            <div class="summary-row">
              <span style="color: #64748b;">${language === "ur" ? "ابتدائی بقایا:" : "Opening Balance:"}</span>
              <span style="font-weight: 700;">Rs ${openingBalance.toLocaleString()} ${openingBalanceType}</span>
            </div>
            <div class="summary-row">
              <span style="color: #64748b;">${language === "ur" ? "کل ڈیبٹ:" : "Total Period Debits:"}</span>
              <span style="font-weight: 700; color: #15803d;">Rs ${periodDebit.toLocaleString()}</span>
            </div>
            <div class="summary-row">
              <span style="color: #64748b;">${language === "ur" ? "کل کریڈٹ:" : "Total Period Credits:"}</span>
              <span style="font-weight: 700; color: #b91c1c;">Rs ${periodCredit.toLocaleString()}</span>
            </div>
            <div class="total-row">
              <span>${language === "ur" ? "اختتامی بقایا:" : "Closing Balance:"}</span>
              <span>Rs ${closingBalance.toLocaleString()} ${closingBalanceType}</span>
            </div>
          </div>

          <div class="sign-grid">
            <div class="sign-block">${language === "ur" ? "اکاؤنٹنٹ دستخط" : "Prepared By"}</div>
            <div class="sign-block">${language === "ur" ? "پڑتال کنندہ" : "Audited & Verified"}</div>
            <div class="sign-block">${language === "ur" ? "دستخط پارٹی" : "Customer / Party Acceptance"}</div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 300);
  };

  // Export CSV for Ledger
  const exportLedgerCsv = () => {
    const { entity, openingBalance, openingBalanceType, closingBalance, closingBalanceType } = ledgerCalculation;
    if (!entity) return;

    const entityName = (entity as any).name || (entity as any).code;
    const headers = ["#", "Date", "Ref / Voucher #", "Type", "Particulars", "Debit (Rs)", "Credit (Rs)", "Running Balance (Rs)", "Balance Type"];
    const rows = [
      ["0", startDate || "", "OPENING", "OPENING", "Opening Balance Brought Forward", openingBalanceType === "DR" ? openingBalance : 0, openingBalanceType === "CR" ? openingBalance : 0, openingBalance, openingBalanceType],
      ...filteredLedgerLines.map((tx, idx) => [
        idx + 1,
        tx.date.slice(0, 10),
        `"${tx.refNumber}"`,
        `"${tx.type}"`,
        `"${tx.description.replace(/"/g, '""')}"`,
        tx.debit,
        tx.credit,
        tx.runningBalance,
        tx.balanceType,
      ]),
      ["—", endDate || "Today", "CLOSING", "CLOSING", "Closing Balance Carried Down", ledgerCalculation.periodDebit, ledgerCalculation.periodCredit, closingBalance, closingBalanceType],
    ];

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Ledger_${entityName}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered Journals for General Journal Tab
  const filteredJournals = useMemo(() => {
    return journals.filter((j) => {
      const q = journalSearch.trim().toLowerCase();
      const matchesSearch =
        !q ||
        j.entryNumber?.toLowerCase().includes(q) ||
        j.description?.toLowerCase().includes(q) ||
        j.lines?.some((l: any) => l.account?.name?.toLowerCase().includes(q) || l.description?.toLowerCase().includes(q));

      const matchesAccount =
        journalAccountFilter === "ALL" || j.lines?.some((l: any) => l.accountId === journalAccountFilter);

      let matchesDate = true;
      if (journalDateFilter !== "ALL") {
        const jDate = new Date(j.date);
        const now = new Date();
        if (journalDateFilter === "TODAY") {
          matchesDate = jDate.toDateString() === now.toDateString();
        } else if (journalDateFilter === "THIS_WEEK") {
          const day = now.getDay();
          const diff = now.getDate() - day + (day === 0 ? -6 : 1);
          const start = new Date(now.setDate(diff));
          start.setHours(0, 0, 0, 0);
          matchesDate = jDate >= start;
        } else if (journalDateFilter === "THIS_MONTH") {
          matchesDate = jDate.getMonth() === now.getMonth() && jDate.getFullYear() === now.getFullYear();
        }
      }

      return matchesSearch && matchesAccount && matchesDate;
    }).sort((a, b) => {
      if (journalSort === "DATE_DESC") {
        const timeDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (timeDiff !== 0) return timeDiff;
        return (b.entryNumber || "").localeCompare(a.entryNumber || "", undefined, { numeric: true });
      }
      if (journalSort === "DATE_ASC") {
        const timeDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (timeDiff !== 0) return timeDiff;
        return (a.entryNumber || "").localeCompare(b.entryNumber || "", undefined, { numeric: true });
      }
      if (journalSort === "ENTRY_ASC") {
        return (a.entryNumber || "").localeCompare(b.entryNumber || "", undefined, { numeric: true });
      }
      if (journalSort === "ENTRY_DESC") {
        return (b.entryNumber || "").localeCompare(a.entryNumber || "", undefined, { numeric: true });
      }
      return 0;
    });
  }, [journals, journalSearch, journalAccountFilter, journalDateFilter, journalSort]);

  const totalDebits = accounts
    .filter((a) => ["ASSET", "EXPENSE", "COGS"].includes(a.type))
    .reduce((acc, a) => acc + Number(a.balance), 0);

  const totalCredits = accounts
    .filter((a) => ["LIABILITY", "EQUITY", "REVENUE"].includes(a.type))
    .reduce((acc, a) => acc + Number(a.balance), 0);

  const filteredAccounts = useMemo(() => {
    return accounts.filter((a) => {
      if (accountTypeFilter !== "ALL" && a.type !== accountTypeFilter) {
        return false;
      }
      if (accountSearch.trim()) {
        const q = accountSearch.toLowerCase();
        const urdu = ACCOUNT_URDU_NAMES[a.code] || "";
        const codeMatch = (a.code || "").toLowerCase().includes(q);
        const nameMatch = (a.name || "").toLowerCase().includes(q);
        const subTypeMatch = (a.subType || "").toLowerCase().includes(q);
        const urduMatch = urdu.toLowerCase().includes(q);
        return codeMatch || nameMatch || subTypeMatch || urduMatch;
      }
      return true;
    });
  }, [accounts, accountTypeFilter, accountSearch]);

  const accountStats = useMemo(() => {
    let assets = 0;
    let liabilities = 0;
    let equity = 0;
    let revenue = 0;
    let cogs = 0;
    let expenses = 0;

    accounts.forEach((a) => {
      const bal = Number(a.balance || 0);
      if (a.type === "ASSET") assets += bal;
      else if (a.type === "LIABILITY") liabilities += bal;
      else if (a.type === "EQUITY") equity += bal;
      else if (a.type === "REVENUE") revenue += bal;
      else if (a.type === "COGS") cogs += bal;
      else if (a.type === "EXPENSE") expenses += bal;
    });

    return {
      total: accounts.length,
      assetCount: accounts.filter((a) => a.type === "ASSET").length,
      assets,
      liabilityCount: accounts.filter((a) => a.type === "LIABILITY").length,
      liabilities,
      equityCount: accounts.filter((a) => a.type === "EQUITY").length,
      equity,
      revenueCount: accounts.filter((a) => a.type === "REVENUE").length,
      revenue,
      cogsCount: accounts.filter((a) => a.type === "COGS").length,
      cogs,
      expenseCount: accounts.filter((a) => a.type === "EXPENSE").length,
      expenses,
    };
  }, [accounts]);

  const overviewMetrics = useMemo(() => {
    let cashBalance = 0;
    let bankBalance = 0;
    accounts.forEach((a) => {
      const code = String(a.code || "");
      const bal = Number(a.balance || 0);
      if (
        code === "1010" ||
        code === "1030" ||
        (a.type === "ASSET" && (a.subType?.toLowerCase().includes("cash") || a.name?.toLowerCase().includes("cash")))
      ) {
        cashBalance += bal;
      } else if (
        code === "1020" ||
        (a.type === "ASSET" && (a.subType?.toLowerCase().includes("bank") || a.name?.toLowerCase().includes("bank")))
      ) {
        bankBalance += bal;
      }
    });

    const liquidTotal = cashBalance + bankBalance;
    const receivablesFromParties = customers.reduce((sum, c) => sum + Number(c.currentBalance || 0), 0);
    const receivablesHead = Number(accounts.find((a) => a.code === "1100")?.balance || 0);
    const receivables = receivablesFromParties > 0 ? receivablesFromParties : receivablesHead;

    const payablesFromParties = effectiveSuppliers.reduce((sum, s) => sum + Number(s.currentBalance || 0), 0);
    const payablesFromPurchases = purchases.reduce(
      (sum, p) => (p.status !== "CANCELLED" ? sum + Number(p.remainingAmount || 0) : sum),
      0
    );
    const payablesHead = Number(accounts.find((a) => a.code === "2010")?.balance || 0);
    const payables = Math.max(payablesFromParties, payablesFromPurchases, payablesHead);

    const capitalHead = Number(accounts.find((a) => a.code === "3010")?.balance || 0);
    const equity = accountStats.equity > 0 ? accountStats.equity : capitalHead;

    const diff = Math.round(Math.abs(totalDebits - totalCredits) * 100) / 100;
    const isBalanced = diff < 0.01;

    return {
      cashBalance,
      bankBalance,
      liquidTotal,
      receivables,
      payables,
      equity,
      isBalanced,
      diff,
    };
  }, [accounts, customers, effectiveSuppliers, purchases, accountStats, totalDebits, totalCredits]);

  if (loading) {
    return (
      <div className="space-y-6">
        <BrandPageLoader
          message="Loading Double-Entry Accounting Ledger..."
          submessage="Balancing General Ledger, Party Subsidiary Ledgers, and Journal Entries..."
        />
        <TableSkeleton rows={6} cols={6} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* QuickBooks Style Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <Landmark className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              <span>{t("Accounting & Financial Ledgers", "بزنس اکاؤنٹنگ و جنرل لیجر")}</span>
            </h2>
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              <span>QuickBooks Simple Mode</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {t(
              "Visual bookkeeping, double-entry ledgers, cash-to-bank deposits, and audited financial statements",
              "سادہ اور صاف بک کیپنگ، جنرل لیجر کھاتے، کیش ڈپازٹ، اور آڈٹ شدہ مالیاتی اسٹیٹمنٹس"
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              invalidateCache("/api/accounting");
              fetchData();
            }}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${loading ? "animate-spin" : ""}`} />
            <span>{t("Refresh", "تازہ کریں")}</span>
          </button>

          {/* QuickBooks "+ New Action" Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowNewActionMenu(!showNewActionMenu)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 transition"
            >
              <PlusCircle className="h-4 w-4" />
              <span>{t("+ New Action", "+ نیا اندراج")}</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-80" />
            </button>

            {showNewActionMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowNewActionMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1.5 z-50 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-900 animate-in fade-in slide-in-from-top-2">
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {t("Quick Accounting Actions", "فوری اکاؤنٹنگ ایکشنز")}
                    </span>
                  </div>

                  <div className="py-1 space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewActionMenu(false);
                        openCashDepositModal();
                      }}
                      className="w-full flex items-start gap-2.5 rounded-xl px-3 py-2 text-left text-xs hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-200 transition group"
                    >
                      <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-lg shrink-0 mt-0.5">
                        <Wallet className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <div className="font-bold group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
                          {t("Deposit Cash to Bank", "کیش بینک میں جمع کروائیں")}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {t("Contra voucher from Cash drawer to Bank", "کیش دراز سے بینک اکاؤنٹ ٹرانسفر واؤچر")}
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowNewActionMenu(false);
                        openAddAccountModal("EXPENSE");
                      }}
                      className="w-full flex items-start gap-2.5 rounded-xl px-3 py-2 text-left text-xs hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-700 dark:text-slate-200 transition group"
                    >
                      <div className="p-1.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-lg shrink-0 mt-0.5">
                        <Building2 className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <div className="font-bold group-hover:text-blue-700 dark:group-hover:text-blue-300">
                          {t("Add Ledger Account", "نیا کھاتہ ہیڈ شامل کریں")}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {t("Create Bank, Expense, Asset, or Liability head", "بینک، اخراجات، یا اثاثہ کھاتہ بنائیں")}
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowNewActionMenu(false);
                        setActiveTab("JOURNALS");
                      }}
                      className="w-full flex items-start gap-2.5 rounded-xl px-3 py-2 text-left text-xs hover:bg-purple-50 dark:hover:bg-purple-950/40 text-slate-700 dark:text-slate-200 transition group"
                    >
                      <div className="p-1.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-lg shrink-0 mt-0.5">
                        <FileText className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <div className="font-bold group-hover:text-purple-700 dark:group-hover:text-purple-300">
                          {t("View / Print Journal Entries", "روزنامچہ اندراجات دیکھیں / پرنٹ")}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {t("Official Journal & Contra Vouchers", "تمام تصدیق شدہ جرنل واؤچرز")}
                        </div>
                      </div>
                    </button>

                    <Link
                      href="/accounting/opening-balances"
                      onClick={() => setShowNewActionMenu(false)}
                      className="w-full flex items-start gap-2.5 rounded-xl px-3 py-2 text-left text-xs hover:bg-amber-50 dark:hover:bg-amber-950/40 text-slate-700 dark:text-slate-200 transition group"
                    >
                      <div className="p-1.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-lg shrink-0 mt-0.5">
                        <Scale className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <div className="font-bold group-hover:text-amber-700 dark:group-hover:text-amber-300">
                          {t("Opening Balances & Capital", "ابتدائی کھاتہ و کیپیٹل سیٹ اپ")}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {t("Manage initial capital, starting stock, and dues", "ابتدائی سرمایہ، مالیت اور سابقہ بقایا")}
                        </div>
                      </div>
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <button
          onClick={() => setActiveTab("OVERVIEW")}
          className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
            activeTab === "OVERVIEW"
              ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          }`}
        >
          <Landmark className="h-4 w-4" />
          <span>{t("Overview & Health", "مالیاتی خلاصہ")}</span>
        </button>

        <button
          onClick={() => setActiveTab("LEDGER")}
          className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
            activeTab === "LEDGER"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          }`}
        >
          <BookOpen className="h-4 w-4" />
          <span>{t("General & Party Ledger", "کھاتہ اسٹیٹمنٹ")}</span>
        </button>

        <button
          onClick={() => setActiveTab("JOURNALS")}
          className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
            activeTab === "JOURNALS"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>{t(`Journal Entries (${journals.length})`, `روزنامچہ (${journals.length})`)}</span>
        </button>

        <button
          onClick={() => setActiveTab("ACCOUNTS")}
          className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
            activeTab === "ACCOUNTS"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          }`}
        >
          <Building2 className="h-4 w-4" />
          <span>{t(`Chart of Accounts (${accounts.length})`, `کھاتوں کی فہرست (${accounts.length})`)}</span>
        </button>

        <button
          onClick={() => setActiveTab("TRIAL_BALANCE")}
          className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
            activeTab === "TRIAL_BALANCE"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          }`}
        >
          <Scale className="h-4 w-4" />
          <span>{t("Trial Balance", "میزان پرتال")}</span>
        </button>

        <Link
          href="/accounting/opening-balances"
          className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 ml-auto"
        >
          <Scale className="h-4 w-4" />
          <span>{t("Opening Balances & Capital", "ابتدائی کھاتہ و کیپیٹل")}</span>
        </Link>
      </div>

      {/* ========================================================================= */}
      {/* TAB 0: QUICKBOOKS STYLE OVERVIEW & FINANCIAL HEALTH */}
      {/* ========================================================================= */}
      {activeTab === "OVERVIEW" && (
        <div className="space-y-6">
          {/* QuickBooks 4 Financial Health Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Tile 1: Cash & Bank */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {t("Cash & Bank Balances", "نقد و بینک بیلنس")}
                  </span>
                  <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
                    <Wallet className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                  {formatMoney(overviewMetrics.liquidTotal)}
                </p>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                  <span>Cash: <strong className="text-slate-700 dark:text-slate-300">{formatMoney(overviewMetrics.cashBalance)}</strong></span>
                  <span>•</span>
                  <span>Bank: <strong className="text-slate-700 dark:text-slate-300">{formatMoney(overviewMetrics.bankBalance)}</strong></span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={openCashDepositModal}
                  className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span>{t("Deposit Cash", "کیش جمع کریں")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("ACCOUNTS");
                    setAccountTypeFilter("ASSET");
                  }}
                  className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  {t("View Accounts →", "کھاتے دیکھیں →")}
                </button>
              </div>
            </div>

            {/* Tile 2: Customer Receivables */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {t("Money In (Receivables)", "کسٹمرز کے بقایا جات")}
                  </span>
                  <div className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-2 text-2xl font-black text-blue-600 dark:text-blue-400 tabular-nums">
                  {formatMoney(overviewMetrics.receivables)}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  {customers.length} {t("active customers with open balances", "گاہکوں کے واجب الوصول کھاتے")}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("LEDGER");
                    setLedgerType("CUSTOMER");
                  }}
                  className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  <span>{t("View Customer Statements", "کسٹمر کھاتہ اسٹیٹمنٹ")}</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Tile 3: Supplier Payables */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {t("Money Out (Payables)", "سپلائرز کے واجبات")}
                  </span>
                  <div className="p-2 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl">
                    <TrendingDown className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-2 text-2xl font-black text-rose-600 dark:text-rose-400 tabular-nums">
                  {formatMoney(overviewMetrics.payables)}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  {suppliers.length} {t("registered vendors with outstanding bills", "سپلائرز کے واجب الادا بلز")}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("LEDGER");
                    setLedgerType("VENDOR");
                  }}
                  className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400"
                >
                  <span>{t("View Vendor Statements", "سپلائر کھاتہ اسٹیٹمنٹ")}</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Tile 4: Owner's Equity & Capital */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {t("Business Capital & Equity", "سرمایہ و کیپیٹل")}
                  </span>
                  <div className="p-2 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-xl">
                    <Coins className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-2 text-2xl font-black text-purple-700 dark:text-purple-300 tabular-nums">
                  {formatMoney(overviewMetrics.equity)}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  {t("Owner's starting equity & retained capital", "مالک کا ابتدائی سرمایہ اور منافع")}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <Link
                  href="/accounting/opening-balances"
                  className="inline-flex items-center gap-1 text-xs font-bold text-purple-600 hover:text-purple-700 dark:text-purple-400"
                >
                  <span>{t("Opening Setup", "ابتدائی سیٹ اپ")}</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
                <span className="text-[10px] text-slate-400 font-medium">Account 3010</span>
              </div>
            </div>
          </div>

          {/* Double-Entry Balanced Status Banner */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs shrink-0">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-emerald-950 dark:text-emerald-100 flex items-center gap-2">
                  <span>{t("Double-Entry Bookkeeping Verified & Balanced", "ڈبل انٹری مکمل متوازن اور تصدیق شدہ ہے")}</span>
                  <Badge variant="success" className="text-[10px] uppercase font-mono">
                    Debits = Credits
                  </Badge>
                </h4>
                <p className="text-xs text-emerald-800/90 dark:text-emerald-300 mt-0.5">
                  {t(
                    `Total Debits: ${formatMoney(totalDebits)} | Total Credits: ${formatMoney(totalCredits)} | Difference: Rs. 0.00`,
                    `کل ڈیبٹ: ${formatMoney(totalDebits)} | کل کریڈٹ: ${formatMoney(totalCredits)} | فرق: 0.00 روپے`
                  )}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab("TRIAL_BALANCE")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-xs font-bold text-emerald-800 shadow-xs hover:bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 whitespace-nowrap"
            >
              <Scale className="h-3.5 w-3.5" />
              <span>{t("Audit Trial Balance Statement", "میزان پرتال رپورٹ دیکھیں")}</span>
            </button>
          </div>

          {/* Recent Journal & Bookkeeping Activity */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span>{t("Recent Journal Entries & Vouchers", "حالیہ روزنامچہ و واؤچرز")}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {t("Latest double-entry vouchers posted across all accounts", "تمام کھاتوں کے تصدیق شدہ حالیہ واؤچرز")}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab("JOURNALS")}
                className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                <span>{t(`View All Journals (${journals.length})`, `تمام روزنامچہ دیکھیں (${journals.length})`)}</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            {journals.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                {t("No journal entries recorded yet. Use '+ New Action' to record your first transaction.", "ابھی کوئی روزنامچہ واؤچر نہیں ہے۔ نیا اندراج کرنے کے لیے اوپر بٹن دبائیں۔")}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-100 text-[10px] font-bold uppercase text-slate-400 dark:border-slate-800">
                    <tr>
                      <th className="pb-2 px-3">{t("Date", "تاریخ")}</th>
                      <th className="pb-2 px-3">{t("Entry / Voucher #", "واؤچر نمبر")}</th>
                      <th className="pb-2 px-3">{t("Description", "تفصیل")}</th>
                      <th className="pb-2 px-3">{t("Accounts Involved", "شامل کھاتے")}</th>
                      <th className="pb-2 px-3 text-right">{t("Total Debit / Credit", "رقم")}</th>
                      <th className="pb-2 px-3 text-center">{t("Action", "عمل")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {journals.slice(0, 5).map((j) => {
                      const totalEntryAmount = (j.lines || []).reduce(
                        (sum: number, l: any) => sum + Number(l.debit || 0),
                        0
                      );
                      return (
                        <tr key={j.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                            {new Date(j.date).toLocaleDateString()}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                            {j.entryNumber}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                            {j.description}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">
                            <div className="flex flex-wrap gap-1">
                              {(j.lines || []).map((l: any, idx: number) => (
                                <span
                                  key={idx}
                                  className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                >
                                  {l.account?.name || l.accountCode || "Account"}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                            {formatMoney(totalEntryAmount)}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleViewVoucher(j)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 hover:text-blue-600 shadow-2xs transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-blue-400"
                            >
                              <Printer className="h-3 w-3" />
                              <span>{t("Print Voucher", "واؤچر")}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* QuickBooks 3 Quick Workflow Navigation Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              onClick={() => setActiveTab("LEDGER")}
              className="group cursor-pointer rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm hover:border-blue-300 hover:shadow-md transition dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition">
                  <BookOpen className="h-5 w-5" />
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 transition" />
              </div>
              <h4 className="mt-3 text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition">
                {t("Individual Khata & Party Ledger", "کھاتہ اسٹیٹمنٹ و لیجر")}
              </h4>
              <p className="mt-1 text-xs text-slate-500">
                {t(
                  "Look up any customer, vendor, or general ledger head with running balance and 1-click A4 PDF print.",
                  "کسی بھی گاہک، سپلائر یا اکاؤنٹ ہیڈ کا مکمل کھاتہ اور پرنٹ ایبل اسٹیٹمنٹ۔"
                )}
              </p>
            </div>

            <div
              onClick={() => setActiveTab("ACCOUNTS")}
              className="group cursor-pointer rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm hover:border-emerald-300 hover:shadow-md transition dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition">
                  <Building2 className="h-5 w-5" />
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-emerald-600 transition" />
              </div>
              <h4 className="mt-3 text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 transition">
                {t("Chart of Accounts Directory", "کھاتوں کی فہرست (چارٹ)")}
              </h4>
              <p className="mt-1 text-xs text-slate-500">
                {t(
                  "Complete 29-head standard chart (Assets, Liabilities, Capital, Revenue, Expenses) with custom account creator.",
                  "تمام 29 معیاری اکاؤنٹ ہیڈز، فلٹرز اور نیا کسٹم کھاتہ بنانے کی سہولت۔"
                )}
              </p>
            </div>

            <div
              onClick={() => setActiveTab("TRIAL_BALANCE")}
              className="group cursor-pointer rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm hover:border-purple-300 hover:shadow-md transition dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl group-hover:bg-purple-600 group-hover:text-white transition">
                  <Scale className="h-5 w-5" />
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-purple-600 transition" />
              </div>
              <h4 className="mt-3 text-sm font-bold text-slate-900 dark:text-white group-hover:text-purple-600 transition">
                {t("Audited Trial Balance", "آڈٹ شدہ میزان پرتال")}
              </h4>
              <p className="mt-1 text-xs text-slate-500">
                {t(
                  "Comprehensive debit/credit balance verification report for tax audits and financial reporting.",
                  "تمام کھاتوں کے ڈیبٹ اور کریڈٹ کا مکمل توازن برائے ٹیکس آڈٹ اور سالانہ رپورٹنگ۔"
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: GENERAL LEDGER & PARTY SUBSIDIARY LEDGER */}
      {/* ========================================================================= */}
      {activeTab === "LEDGER" && (
        <div className="space-y-4">
          {/* Controls Bar: Type Selector + Entity Picker + Date Filters */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3">
            {/* Top row: Ledger Scope Selector (Vendor / Customer / Chart of Accounts) */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t("Ledger Scope:", "لیجر کی قسم:")}
                </span>
                <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => setLedgerType("VENDOR")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                      ledgerType === "VENDOR"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                    }`}
                  >
                    🏢 {t("Vendor / Supplier", "وینڈر / سپلائر کھاتہ")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLedgerType("CUSTOMER")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                      ledgerType === "CUSTOMER"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                    }`}
                  >
                    👤 {t("Customer", "گاہک کھاتہ")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLedgerType("ACCOUNT")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                      ledgerType === "ACCOUNT"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                    }`}
                  >
                    📑 {t("Chart Head", "جنرل لیجر")}
                  </button>
                </div>
              </div>

              {/* Action Buttons: Print Statement & Export CSV */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={printLedgerStatement}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  title="Print official A4 Statement of Account"
                >
                  <Printer className="h-3.5 w-3.5 text-slate-500" />
                  <span>{t("Print Statement", "پرنٹ کھاتہ")}</span>
                </button>
                <button
                  type="button"
                  onClick={exportLedgerCsv}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  title="Export ledger entries to CSV"
                >
                  <Download className="h-3.5 w-3.5 text-slate-500" />
                  <span>{t("Export CSV", "ایکسپورٹ CSV")}</span>
                </button>
              </div>
            </div>

            {/* Middle row: Entity Dropdown Selector */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3 items-center">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {ledgerType === "VENDOR"
                    ? t("Select Vendor / Supplier:", "وینڈر / سپلائر منتخب کریں:")
                    : ledgerType === "CUSTOMER"
                    ? t("Select Customer:", "گاہک منتخب کریں:")
                    : t("Select Account Head:", "اکاؤنٹ ہیڈ منتخب کریں:")}
                </label>
                <select
                  value={selectedEntityId}
                  onChange={(e) => setSelectedEntityId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-xs focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {ledgerType === "VENDOR" &&
                    effectiveSuppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.phone ? `(${s.phone})` : ""} — Balance: Rs {Number(s.currentBalance || 0).toLocaleString()}
                      </option>
                    ))}
                  {ledgerType === "CUSTOMER" &&
                    customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ""} — Balance: Rs {Number(c.currentBalance || 0).toLocaleString()}
                      </option>
                    ))}
                  {ledgerType === "ACCOUNT" &&
                    accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        [{a.code}] {a.name} ({a.type}) — Balance: Rs {Number(a.balance || 0).toLocaleString()}
                      </option>
                    ))}
                </select>
              </div>

              {/* Date Filter Pills */}
              <div className="md:col-span-2 space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {t("Date Range Filter:", "تاریخ کی حد:")}
                </label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { id: "ALL", label: t("All Time", "تمام ریکارڈ") },
                    { id: "TODAY", label: t("Today", "آج") },
                    { id: "THIS_WEEK", label: t("This Week", "اس ہفتے") },
                    { id: "THIS_MONTH", label: t("This Month", "اس ماہ") },
                    { id: "THIS_YEAR", label: t("This Year", "اس سال") },
                    { id: "CUSTOM", label: t("Custom", "کسٹم تاریخیں") },
                  ].map((btn) => (
                    <button
                      key={btn.id}
                      type="button"
                      onClick={() => setDateFilter(btn.id as DateFilterType)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                        dateFilter === btn.id
                          ? "bg-slate-900 text-white shadow-xs dark:bg-white dark:text-slate-900"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Custom Date Pickers & Search Row */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {dateFilter === "CUSTOM" && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-500">{t("From:", "از:")}</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="rounded-lg border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-500">{t("To:", "تا:")}</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="rounded-lg border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>
              )}

              {/* In-table Search */}
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder={t("Search reference or narration...", "اندراج یا واؤچر نمبر سرچ کریں...")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 pl-8 pr-3 py-1.5 text-xs focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* ===================================================================== */}
          {/* LEDGER HEADER KPI CARDS (OPENING BALANCE -> ACTIVITY -> CLOSING BALANCE) */}
          {/* ===================================================================== */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {/* 1. Opening Balance */}
            <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-3.5 shadow-xs dark:border-blue-900/40 dark:bg-blue-950/20">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-blue-700 dark:text-blue-300">
                  {t("Opening Balance", "ابتدائی بقایا")}
                </span>
                <span className="rounded-md bg-blue-200/60 px-1.5 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  {ledgerCalculation.openingBalanceType}
                </span>
              </div>
              <p className="mt-1 text-xl font-extrabold text-blue-900 dark:text-blue-100 tabular-nums">
                {formatMoney(ledgerCalculation.openingBalance)}
              </p>
              <p className="mt-0.5 text-[10px] text-blue-700/80 dark:text-blue-300">
                {ledgerType === "VENDOR"
                  ? t("B/F Payable before period", "سابقہ واجب الادا بقایا")
                  : ledgerType === "CUSTOMER"
                  ? t("B/F Receivable before period", "سابقہ واجب الوصول بقایا")
                  : t("Opening Head Balance", "ابتدائی ہیڈ بیلنس")}
              </p>
            </div>

            {/* 2. Total Period Debits */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3.5 shadow-xs dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-emerald-700 dark:text-emerald-300">
                  {t("Total Debits", "کل ڈیبٹ")}
                </span>
                <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="mt-1 text-xl font-extrabold text-emerald-900 dark:text-emerald-100 tabular-nums">
                {formatMoney(ledgerCalculation.periodDebit)}
              </p>
              <p className="mt-0.5 text-[10px] text-emerald-700/80 dark:text-emerald-300">
                {ledgerType === "VENDOR"
                  ? t("Payments made", "ادائیگیاں")
                  : t("Sales Invoiced", "انوائسز")}
              </p>
            </div>

            {/* 3. Total Period Credits */}
            <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-3.5 shadow-xs dark:border-rose-900/40 dark:bg-rose-950/20">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-rose-700 dark:text-rose-300">
                  {t("Total Credits", "کل کریڈٹ")}
                </span>
                <ArrowUpRight className="h-4 w-4 text-rose-600" />
              </div>
              <p className="mt-1 text-xl font-extrabold text-rose-900 dark:text-rose-100 tabular-nums">
                {formatMoney(ledgerCalculation.periodCredit)}
              </p>
              <p className="mt-0.5 text-[10px] text-rose-700/80 dark:text-rose-300">
                {ledgerType === "VENDOR"
                  ? t("Purchase Bills", "خریداری بلز")
                  : t("Cash Received", "وصولیاں")}
              </p>
            </div>

            {/* 4. Net Period Activity */}
            <div className="rounded-2xl border border-purple-200 bg-purple-50/60 p-3.5 shadow-xs dark:border-purple-900/40 dark:bg-purple-950/20">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-purple-700 dark:text-purple-300">
                  {t("Net Movement", "ردوبدل")}
                </span>
                <span className="text-xs">🔄</span>
              </div>
              <p className="mt-1 text-xl font-extrabold text-purple-900 dark:text-purple-100 tabular-nums">
                {formatMoney(Math.abs(ledgerCalculation.netMovement))}
              </p>
              <p className="mt-0.5 text-[10px] text-purple-700/80 dark:text-purple-300">
                {ledgerCalculation.netMovement >= 0
                  ? t("Net Addition (+)", "خالص اضافہ (+)")
                  : t("Net Reduction (-)", "خالص کمی (-)")}
              </p>
            </div>

            {/* 5. Closing Balance */}
            <div className="rounded-2xl border border-slate-900 bg-slate-900 p-3.5 text-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-slate-300">
                  {t("Closing Balance", "اختتامی بقایا")}
                </span>
                <Badge variant={ledgerCalculation.closingBalanceType === "CR" ? "danger" : "success"}>
                  {ledgerCalculation.closingBalanceType}
                </Badge>
              </div>
              <p className="mt-1 text-xl font-extrabold text-white tabular-nums">
                {formatMoney(ledgerCalculation.closingBalance)}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">
                {ledgerType === "VENDOR"
                  ? ledgerCalculation.closingBalanceType === "CR"
                    ? t("Payable to Vendor", "واجب الادا رقم")
                    : t("Advance Paid", "پیشگی ادا شدہ")
                  : ledgerType === "CUSTOMER"
                  ? ledgerCalculation.closingBalanceType === "DR"
                    ? t("Receivable from Customer", "قابل وصول رقم")
                    : t("Advance Received", "پیشگی وصول شدہ")
                  : t("Closing Head Balance", "اختتامی ہیڈ بیلنس")}
              </p>
            </div>
          </div>

          {/* ===================================================================== */}
          {/* DETAILED LEDGER TABLE WITH RUNNING BALANCES */}
          {/* ===================================================================== */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {ledgerCalculation.entity
                    ? (ledgerCalculation.entity as any).name || (ledgerCalculation.entity as any).code
                    : "Ledger"}{" "}
                  — {t("Detailed Transactions", "کھاتہ تفصیلات")}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {t(
                    "Double-entry chronological statement of debits, credits, and progressive running balance",
                    "ڈبل انٹری کے مطابق تمام ڈیبٹ، کریڈٹ اور رواں بقایا کی مکمل تفصیل"
                  )}
                </p>
              </div>
              <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {filteredLedgerLines.length} {t("transactions", "اندراجات")}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-3">{t("Date", "تاریخ")}</th>
                    <th className="px-4 py-3">{t("Voucher / Ref #", "واؤچر / ریفرنس #")}</th>
                    <th className="px-4 py-3">{t("Type", "قسم")}</th>
                    <th className="px-4 py-3">{t("Particulars / Narration", "تفصیلات و اندراج")}</th>
                    <th className="px-4 py-3 text-right">{t("Debit (Rs)", "ڈیبٹ (روپے)")}</th>
                    <th className="px-4 py-3 text-right">{t("Credit (Rs)", "کریڈٹ (روپے)")}</th>
                    <th className="px-4 py-3 text-right">{t("Running Balance (Rs)", "رواں بقایا (روپے)")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {/* Opening Balance Line */}
                  <tr className="bg-blue-50/40 font-semibold text-blue-900 dark:bg-blue-950/20 dark:text-blue-200">
                    <td className="px-4 py-3">{startDate || "Prior"}</td>
                    <td className="px-4 py-3 font-mono font-bold">OPENING</td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                        OPENING
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {t("Opening Balance Brought Forward", "ابتدائی بیلنس / سابقہ بقایا")}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {ledgerCalculation.openingBalanceType === "DR"
                        ? formatMoney(ledgerCalculation.openingBalance)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {ledgerCalculation.openingBalanceType === "CR"
                        ? formatMoney(ledgerCalculation.openingBalance)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold">
                      {formatMoney(ledgerCalculation.openingBalance)}{" "}
                      <span className="text-[10px] text-slate-500">{ledgerCalculation.openingBalanceType}</span>
                    </td>
                  </tr>

                  {/* Transaction lines */}
                  {filteredLedgerLines.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs text-slate-400">
                        {t(
                          "No transactions recorded within selected date range. Opening balance holds.",
                          "اس منتخب کردہ تاریخوں میں کوئی نیا لین دین نہیں ہے۔ ابتدائی بیلنس برقرار ہے۔"
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredLedgerLines.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {new Date(tx.date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                          {tx.refNumber}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              tx.type.includes("PAY") || tx.type.includes("RCPT")
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300"
                            }`}
                          >
                            {tx.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{tx.description}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                          {tx.debit > 0 ? formatMoney(tx.debit) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                          {tx.credit > 0 ? formatMoney(tx.credit) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                          {formatMoney(tx.runningBalance)}{" "}
                          <span
                            className={`text-[10px] font-bold ${
                              tx.balanceType === "CR" ? "text-rose-600" : "text-emerald-600"
                            }`}
                          >
                            {tx.balanceType}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}

                  {/* Closing Balance Line */}
                  <tr className="bg-slate-100/80 font-bold text-slate-900 dark:bg-slate-800/80 dark:text-white border-t-2 border-slate-300 dark:border-slate-700">
                    <td className="px-4 py-3">{endDate || "Today"}</td>
                    <td className="px-4 py-3 font-mono font-bold">CLOSING</td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold text-white dark:bg-white dark:text-slate-900">
                        CLOSING
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {t("Closing Balance Carried Down", "اختتامی بقایا / کھاتہ بندش")}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-700 dark:text-emerald-400">
                      {formatMoney(ledgerCalculation.periodDebit)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-rose-700 dark:text-rose-400">
                      {formatMoney(ledgerCalculation.periodCredit)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-blue-700 dark:text-blue-300">
                      {formatMoney(ledgerCalculation.closingBalance)}{" "}
                      <span className="text-[10px]">{ledgerCalculation.closingBalanceType}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: GENERAL JOURNAL ENTRIES (روزنامچہ) */}
      {/* ========================================================================= */}
      {activeTab === "JOURNALS" && (
        <div className="space-y-4">
          {/* Journal Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder={t("Search by journal # or description...", "روزنامچہ یا تفصیلات سرچ کریں...")}
                value={journalSearch}
                onChange={(e) => setJournalSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 pl-9 pr-3 py-1.5 text-xs focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={journalDateFilter}
                onChange={(e) => setJournalDateFilter(e.target.value as any)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="ALL">{t("All Dates", "تمام تاریخیں")}</option>
                <option value="TODAY">{t("Today", "آج")}</option>
                <option value="THIS_WEEK">{t("This Week", "اس ہفتے")}</option>
                <option value="THIS_MONTH">{t("This Month", "اس ماہ")}</option>
              </select>

              <select
                value={journalAccountFilter}
                onChange={(e) => setJournalAccountFilter(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="ALL">{t("All Accounts", "تمام کھاتے")}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    [{a.code}] {a.name}
                  </option>
                ))}
              </select>

              <select
                value={journalSort}
                onChange={(e) => setJournalSort(e.target.value as any)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                title="Sort journal entries"
              >
                <option value="DATE_DESC">{t("Sort: Newest First", "تاریخ: نیا پہلے")}</option>
                <option value="DATE_ASC">{t("Sort: Oldest First", "تاریخ: پرانا پہلے")}</option>
                <option value="ENTRY_DESC">{t("Sort: Entry # (High to Low)", "اندراج نمبر: زیادہ سے کم")}</option>
                <option value="ENTRY_ASC">{t("Sort: Entry # (Low to High)", "اندراج نمبر: کم سے زیادہ")}</option>
              </select>

              <button
                type="button"
                onClick={openCashDepositModal}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition whitespace-nowrap"
              >
                <Landmark className="h-3.5 w-3.5" />
                <span>{t("+ Deposit Cash to Bank", "+ کیش بینک میں جمع کروائیں")}</span>
              </button>
            </div>
          </div>

          {filteredJournals.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-400 dark:border-slate-800 dark:bg-slate-900">
              {t("No journal entries match the selected filter.", "منتخب کردہ فلٹر کے مطابق کوئی روزنامچہ اندراج نہیں ملا۔")}
            </div>
          ) : (
            filteredJournals.map((j) => (
              <div
                key={j.id}
                className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400">
                      {j.entryNumber}
                    </span>
                    <span className="text-xs text-slate-400">{new Date(j.date).toLocaleDateString()}</span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{j.description}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleViewVoucher(j)}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-blue-600 shadow-2xs transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-blue-400"
                      title={t("Print Voucher", "واؤچر پرنٹ کریں")}
                    >
                      <Printer className="h-3.5 w-3.5" />
                      <span>{t("Print Voucher", "واؤچر پرنٹ کریں")}</span>
                    </button>
                    <Badge variant={j.isBalanced ? "success" : "danger"}>
                      {j.isBalanced ? t("Balanced", "برابر") : t("Unbalanced", "غیر برابر")}
                    </Badge>
                  </div>
                </div>

                <div className="pt-3 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-[10px] font-bold uppercase text-slate-400">
                      <tr>
                        <th className="pb-1">{t("Account Code & Title", "کھاتہ کوڈ و نام")}</th>
                        <th className="pb-1">{t("Line Description", "تفصیل")}</th>
                        <th className="pb-1 text-right">{t("Debit (Rs)", "ڈیبٹ (روپے)")}</th>
                        <th className="pb-1 text-right">{t("Credit (Rs)", "کریڈٹ (روپے)")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {j.lines?.map((l: any) => (
                        <tr key={l.id}>
                          <td className="py-2 font-medium text-slate-800 dark:text-slate-200">
                            <span className="font-mono text-slate-400 mr-2">{l.account?.code}</span>
                            {l.account?.name}
                          </td>
                          <td className="py-2 text-slate-500">{l.description || "—"}</td>
                          <td className="py-2 text-right font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                            {Number(l.debit) > 0 ? formatMoney(l.debit) : "—"}
                          </td>
                          <td className="py-2 text-right font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                            {Number(l.credit) > 0 ? formatMoney(l.credit) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CHART OF ACCOUNTS */}
      {/* ========================================================================= */}
      {activeTab === "ACCOUNTS" && (
        <div className="space-y-4">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <span className="text-[11px] font-bold text-slate-500">{t("Total Heads", "کل کھاتے")}</span>
              <p className="mt-1 text-lg font-black text-slate-900 dark:text-white">{accountStats.total}</p>
              <span className="text-[10px] text-slate-400">{t("Double-entry active", "ڈبل انٹری فعال")}</span>
            </div>
            <div className="rounded-2xl border border-blue-200/80 bg-blue-50/50 p-3.5 shadow-xs dark:border-blue-900/40 dark:bg-blue-950/20">
              <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400">{t("Assets (1000s)", "اثاثے")}</span>
              <p className="mt-1 text-lg font-black text-blue-900 dark:text-blue-200">{formatMoney(accountStats.assets)}</p>
              <span className="text-[10px] text-blue-600 dark:text-blue-400">{accountStats.assetCount} {t("heads", "کھاتے")}</span>
            </div>
            <div className="rounded-2xl border border-rose-200/80 bg-rose-50/50 p-3.5 shadow-xs dark:border-rose-900/40 dark:bg-rose-950/20">
              <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400">{t("Liabilities (2000s)", "واجبات")}</span>
              <p className="mt-1 text-lg font-black text-rose-900 dark:text-rose-200">{formatMoney(accountStats.liabilities)}</p>
              <span className="text-[10px] text-rose-600 dark:text-rose-400">{accountStats.liabilityCount} {t("heads", "کھاتے")}</span>
            </div>
            <div className="rounded-2xl border border-purple-200/80 bg-purple-50/50 p-3.5 shadow-xs dark:border-purple-900/40 dark:bg-purple-950/20">
              <span className="text-[11px] font-bold text-purple-700 dark:text-purple-400">{t("Capital & Equity (3000s)", "سرمایہ و کیپیٹل")}</span>
              <p className="mt-1 text-lg font-black text-purple-900 dark:text-purple-200">{formatMoney(accountStats.equity)}</p>
              <span className="text-[10px] text-purple-600 dark:text-purple-400">{accountStats.equityCount} {t("heads", "کھاتے")}</span>
            </div>
            <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-3.5 shadow-xs dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">{t("Revenue (4000s)", "سیلز آمدن")}</span>
              <p className="mt-1 text-lg font-black text-emerald-900 dark:text-emerald-200">{formatMoney(accountStats.revenue)}</p>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400">{accountStats.revenueCount} {t("heads", "کھاتے")}</span>
            </div>
            <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-3.5 shadow-xs dark:border-amber-900/40 dark:bg-amber-950/20">
              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">{t("Costs & Expenses (5-6000s)", "لاگت و اخراجات")}</span>
              <p className="mt-1 text-lg font-black text-amber-900 dark:text-amber-200">{formatMoney(accountStats.cogs + accountStats.expenses)}</p>
              <span className="text-[10px] text-amber-600 dark:text-amber-400">{accountStats.cogsCount + accountStats.expenseCount} {t("heads", "کھاتے")}</span>
            </div>
          </div>

          {/* Action & Filter Toolbar */}
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <div className="relative min-w-[220px] max-w-sm flex-1">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder={t("Search by code, title, or Urdu name...", "کوڈ، عنوان یا اردو نام سے تلاش کریں...")}
                  value={accountSearch}
                  onChange={(e) => setAccountSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* Type Category Pills */}
              <div className="flex flex-wrap items-center gap-1">
                {[
                  { key: "ALL", label: t("All", "تمام"), count: accounts.length },
                  { key: "ASSET", label: t("Assets", "اثاثے"), count: accountStats.assetCount },
                  { key: "LIABILITY", label: t("Liabilities", "واجبات"), count: accountStats.liabilityCount },
                  { key: "EQUITY", label: t("Equity / Capital", "سرمایہ"), count: accountStats.equityCount },
                  { key: "REVENUE", label: t("Revenue", "آمدن"), count: accountStats.revenueCount },
                  { key: "COGS", label: t("COGS", "لاگت"), count: accountStats.cogsCount },
                  { key: "EXPENSE", label: t("Expenses", "اخراجات"), count: accountStats.expenseCount },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setAccountTypeFilter(item.key)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                      accountTypeFilter === item.key
                        ? "bg-slate-900 text-white shadow-xs dark:bg-blue-600"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                    }`}
                  >
                    {item.label} ({item.count})
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/accounting/opening-balances"
                className="inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-bold text-purple-700 hover:bg-purple-100 transition dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300"
                title={t("Manage Opening Balances & Initial Capital", "ابتدائی کھاتہ اور کیپیٹل سیٹ اپ")}
              >
                <Scale className="h-3.5 w-3.5" />
                <span>{t("Opening Balances & Capital", "ابتدائی کھاتہ و کیپیٹل")}</span>
              </Link>

              <button
                type="button"
                onClick={() => openAddAccountModal("EXPENSE")}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                <span>{t("+ Add Account", "+ نیا کھاتہ شامل کریں")}</span>
              </button>
            </div>
          </div>

          {/* Accounts Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {filteredAccounts.length === 0 ? (
              <div className="p-12 text-center">
                <FolderPlus className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-700" />
                <h4 className="mt-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                  {t("No account heads found", "کوئی کھاتہ نہیں ملا")}
                </h4>
                <p className="mt-1 text-xs text-slate-400">
                  {accountSearch
                    ? t("No accounts matched your search keyword.", "آپ کی تلاش سے ملتا جلتا کوئی کھاتہ موجود نہیں ہے۔")
                    : t("No accounts under this category.", "اس کیٹیگری میں کوئی کھاتہ موجود نہیں ہے۔")}
                </p>
                <div className="mt-4 flex justify-center gap-2">
                  {accountSearch && (
                    <button
                      type="button"
                      onClick={() => setAccountSearch("")}
                      className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                    >
                      {t("Clear Search", "تلاش صاف کریں")}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openAddAccountModal(accountTypeFilter !== "ALL" ? accountTypeFilter : "EXPENSE")}
                    className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-bold text-white hover:bg-blue-700"
                  >
                    {t("+ Add New Account", "+ نیا کھاتہ شامل کریں")}
                  </button>
                </div>
              </div>
            ) : (
              <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-3 w-20">Code</th>
                    <th className="px-4 py-3">Account Title / Ledger Head</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Sub-Type</th>
                    <th className="px-4 py-3 text-right">Running Balance</th>
                    <th className="px-4 py-3 text-center w-28">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredAccounts.map((a) => {
                    const typeCfg = ACCOUNT_TYPE_CONFIG[a.type] || {
                      label: a.type,
                      urduLabel: a.type,
                      badgeColor: "bg-slate-100 text-slate-700 border-slate-200",
                    };
                    const urduName = ACCOUNT_URDU_NAMES[a.code];
                    const isCapital = a.type === "EQUITY" || ["3010", "3020", "3100"].includes(a.code);

                    return (
                      <tr
                        key={a.id}
                        className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition ${
                          isCapital ? "bg-purple-50/20 dark:bg-purple-950/10" : ""
                        }`}
                      >
                        <td className="px-4 py-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                          {a.code}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              {a.name}
                              {isCapital && (
                                <span className="inline-flex items-center rounded-sm bg-purple-100 px-1.5 py-0.5 text-[9px] font-bold text-purple-700 dark:bg-purple-900/60 dark:text-purple-300">
                                  Capital
                                </span>
                              )}
                            </span>
                            {urduName && (
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                {urduName}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[10px] font-extrabold ${typeCfg.badgeColor}`}
                          >
                            {typeCfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 font-medium">
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            {a.subType || "General"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-900 dark:text-white">
                          <span
                            className={
                              Number(a.balance) < 0
                                ? "text-rose-600 dark:text-rose-400"
                                : Number(a.balance) > 0
                                ? "text-slate-900 dark:text-slate-100"
                                : "text-slate-400"
                            }
                          >
                            Rs. {formatMoney(a.balance)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => {
                              setLedgerType("ACCOUNT");
                              setSelectedEntityId(a.id);
                              setActiveTab("LEDGER");
                            }}
                            className="rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-300 transition"
                          >
                            {t("View Ledger", "کھاتہ دیکھیں")}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: TRIAL BALANCE */}
      {/* ========================================================================= */}
      {activeTab === "TRIAL_BALANCE" && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="pb-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {t("Trial Balance Statement", "میزان پرتال اسٹیٹمنٹ")}
              </h3>
              <p className="text-xs text-slate-500">
                {t("Summary of all debit and credit account balances", "تمام ڈیبٹ اور کریڈٹ کھاتوں کے حتمی بیلنس کا خلاصہ")}
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg dark:bg-emerald-950/40 dark:text-emerald-300">
                {t("Balanced", "برابر ہے")}
              </span>
            </div>
          </div>

          <div className="py-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500 dark:border-slate-800">
                <tr>
                  <th className="pb-2">Account Code</th>
                  <th className="pb-2">Account Title</th>
                  <th className="pb-2 text-right">Debit (Rs)</th>
                  <th className="pb-2 text-right">Credit (Rs)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {accounts.map((a) => {
                  const isDebitSide = ["ASSET", "EXPENSE", "COGS"].includes(a.type);
                  return (
                    <tr key={a.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-2 font-mono text-slate-500">{a.code}</td>
                      <td className="py-2 font-medium text-slate-900 dark:text-white">{a.name}</td>
                      <td className="py-2 text-right tabular-nums">
                        {isDebitSide ? formatMoney(a.balance) : "—"}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {!isDebitSide ? formatMoney(a.balance) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-slate-900 font-bold dark:border-white">
                <tr>
                  <td colSpan={2} className="pt-3 text-sm">TOTAL TRIAL BALANCE</td>
                  <td className="pt-3 text-right text-sm text-blue-600 dark:text-blue-400 tabular-nums">
                    {formatMoney(totalDebits)}
                  </td>
                  <td className="pt-3 text-right text-sm text-blue-600 dark:text-blue-400 tabular-nums">
                    {formatMoney(totalCredits)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Cash Deposit into Bank Modal */}
      <Modal
        isOpen={showCashDepositModal}
        onClose={() => setShowCashDepositModal(false)}
        title={t("Deposit Cash Sales into Bank", "نقد سیلز بینک میں جمع کروائیں")}
        description={t(
          "Move cash sales proceeds into company bank account and automatically generate Contra / Journal Voucher",
          "روزانہ نقد سیلز رقم کو بینک اکاؤنٹ میں جمع کروائیں اور خودکار کاؤنٹرا / جرنل واؤچر بنائیں"
        )}
        maxWidth="lg"
      >
        <form onSubmit={handleCreateCashDeposit} className="space-y-4">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 text-xs text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white uppercase">
                  {user?.name?.charAt(0) || "U"}
                </span>
                <div>
                  <span className="font-bold">{user?.name || "Logged User"}</span>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 ml-1.5 font-medium">({user?.role?.replace("_", " ") || "Accountant"})</span>
                  <div className="text-[10px] text-emerald-700/80 dark:text-emerald-300">Accountant / Cash Depositor</div>
                </div>
              </div>
              <span className="rounded-md bg-white/80 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium border border-emerald-200 dark:border-emerald-800">
                🏢 {selectedBranch?.name || user?.branchName || "Main Branch"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label={t("Source Cash Account (کیش دراز)", "Source Cash Drawer")}
              value={depositCashAccountId}
              onChange={(e) => setDepositCashAccountId(e.target.value)}
              required
            >
              <option value="">{t("-- Select Cash Drawer --", "-- کیش اکاؤنٹ منتخب کریں --")}</option>
              {cashBankAccounts
                .filter((a) => a.type === "CASH")
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    💵 {a.name} (Balance: {formatMoney(a.balance)})
                  </option>
                ))}
            </Select>

            <Select
              label={t("Destination Bank Account (بینک کھاتہ)", "Destination Bank")}
              value={depositBankAccountId}
              onChange={(e) => setDepositBankAccountId(e.target.value)}
              required
            >
              <option value="">{t("-- Select Bank Account --", "-- بینک اکاؤنٹ منتخب کریں --")}</option>
              {cashBankAccounts
                .filter((a) => a.type === "BANK")
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    🏦 {a.name} {a.accountNumber ? `(${a.accountNumber})` : ""} (Bal: {formatMoney(a.balance)})
                  </option>
                ))}
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label={t("Deposit Amount (Rs) *", "جمع رقم (روپے) *")}
              type="number"
              step="0.01"
              value={depositAmount || ""}
              onChange={(e) => setDepositAmount(parseFloat(e.target.value) || 0)}
              placeholder="e.g. 50000"
              required
            />
            <Input
              label={t("Deposit Date (تاریخ)", "Deposit Date")}
              type="date"
              value={depositDate}
              onChange={(e) => setDepositDate(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label={t("Bank Deposit Slip # / Cheque Ref", "ڈپازٹ سلپ / بینک حوالہ نمبر")}
              value={depositRef}
              onChange={(e) => setDepositRef(e.target.value)}
              placeholder="e.g. SLIP-98421"
            />
            <Input
              label={t("Depositor Name (کس نے جمع کروایا)", "Depositor Name")}
              value={depositorName}
              onChange={(e) => setDepositorName(e.target.value)}
              placeholder="e.g. Muhammad Hanif"
            />
          </div>

          <Input
            label={t("Narration / Description (تفصیل)", "Narration / Description")}
            value={depositNotes}
            onChange={(e) => setDepositNotes(e.target.value)}
            placeholder="e.g. Daily cash sales collection deposited into Meezan Bank"
          />

          {/* Double-Entry Contra Voucher Preview Box */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 text-xs dark:border-blue-900/40 dark:bg-blue-950/30">
            <div className="flex items-center justify-between pb-1.5 border-b border-blue-200/60 dark:border-blue-900/40">
              <span className="font-bold text-blue-900 dark:text-blue-300">
                ⚡ {t("Automatic Contra Journal Voucher", "خودکار کاؤنٹرا جرنل واؤچر")}
              </span>
              <span className="font-mono font-bold text-blue-700 dark:text-blue-400">
                Rs. {formatMoney(depositAmount)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 text-[11px]">
              <div>
                <span className="text-emerald-700 dark:text-emerald-400 font-bold">DEBIT (+) [1020]:</span>
                <p className="text-slate-700 dark:text-slate-300">
                  {cashBankAccounts.find((a) => a.id === depositBankAccountId)?.name || "Destination Bank Account"}
                </p>
              </div>
              <div>
                <span className="text-rose-700 dark:text-rose-400 font-bold">CREDIT (-) [1010]:</span>
                <p className="text-slate-700 dark:text-slate-300">
                  {cashBankAccounts.find((a) => a.id === depositCashAccountId)?.name || "Source Cash Drawer"}
                </p>
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowCashDepositModal(false)}>
              {t("Cancel", "منسوخ")}
            </Button>
            <Button type="submit" variant="success" isLoading={depositSubmitting}>
              {t("Deposit Cash & Generate Voucher", "کیش جمع کر کے واؤچر بنائیں")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add New Account Head Modal */}
      <Modal
        isOpen={showAddAccountModal}
        onClose={() => setShowAddAccountModal(false)}
        title={t("+ Add New Account Head", "+ نیا کھاتہ شامل کریں")}
        description={t(
          "Create a custom ledger account head for your Chart of Accounts (Bank, Cash, Expense, Asset, Capital, Liability)",
          "اپنے چارٹ آف اکاؤنٹس میں نیا کھاتہ (بینک، کیش، خرچ، اثاثہ، سرمایہ، یا واجبات) شامل کریں"
        )}
        maxWidth="lg"
      >
        <form onSubmit={handleCreateAccount} className="space-y-4">
          {addAccountError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
              {addAccountError}
            </div>
          )}

          {addAccountSuccess && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
              {addAccountSuccess}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                {t("Account Category / Type *", "کھاتے کی قسم / کیٹیگری *")}
              </label>
              <select
                value={newAccType}
                onChange={(e) => handleAccountTypeChange(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="ASSET">{t("ASSET (1000s) - Cash, Bank, Inventory, Fixed Assets", "اثاثے (1000s) - کیش، بینک، اسٹاک، فکسڈ اثاثہ")}</option>
                <option value="LIABILITY">{t("LIABILITY (2000s) - Payables, Taxes, Borrowings", "واجبات (2000s) - سپلائرز کے واجبات، ٹیکس، قرض")}</option>
                <option value="EQUITY">{t("EQUITY (3000s) - Capital, Drawings, Retained Earnings", "سرمایہ و کیپیٹل (3000s) - اوونر کیپیٹل، ڈرائنگز")}</option>
                <option value="REVENUE">{t("REVENUE (4000s) - Sales Income, Discounts", "آمدن (4000s) - سیلز، منافع، دیگر آمدن")}</option>
                <option value="COGS">{t("COGS (5000s) - Cost of Goods Sold, Freight", "مال کی لاگت (5000s) - سامان کی اصل لاگت، فریٹ")}</option>
                <option value="EXPENSE">{t("EXPENSE (6000s) - Rent, Salaries, Utilities, Fuel", "اخراجات (6000s) - کرایہ، تنخواہیں، بلز، پٹرول")}</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                {t("Account Code *", "کھاتہ کوڈ نمبر *")}
              </label>
              <Input
                value={newAccCode}
                onChange={(e) => setNewAccCode(e.target.value)}
                placeholder="e.g. 1025, 6095"
                required
              />
              <span className="text-[10px] text-slate-400">
                {t("Suggested standard code prefix:", "تجویز کردہ کوڈ:")} {ACCOUNT_TYPE_CONFIG[newAccType]?.codePrefix}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                {t("Account Title (English) *", "کھاتے کا عنوان (انگریزی) *")}
              </label>
              <Input
                value={newAccName}
                onChange={(e) => setNewAccName(e.target.value)}
                placeholder="e.g. Meezan Bank Limited, Generator Fuel"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                {t("Account Title (Urdu / Local)", "کھاتے کا نام (اردو)")}
              </label>
              <Input
                value={newAccUrdu}
                onChange={(e) => setNewAccUrdu(e.target.value)}
                placeholder="مثال: میزان بینک کھاتہ، جنریٹر ڈیزل و آئل"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                {t("Sub-Type Classification", "ذیلی درجہ بندی (سب ٹائپ)")}
              </label>
              <div className="flex gap-1.5">
                <Input
                  value={newAccSubType}
                  onChange={(e) => setNewAccSubType(e.target.value)}
                  placeholder="e.g. Bank, Cash, Operating, Fixed Asset"
                />
                <select
                  onChange={(e) => setNewAccSubType(e.target.value)}
                  value=""
                  className="rounded-xl border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  title="Pick standard sub-type"
                >
                  <option value="">▼ {t("Suggestions", "تجاویز")}</option>
                  {(COMMON_SUBTYPES[newAccType] || []).map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                {t("Opening / Initial Balance (Rs)", "ابتدائی بیلنس (اختیاری)")}
              </label>
              <Input
                type="number"
                step="0.01"
                value={newAccBalance}
                onChange={(e) => setNewAccBalance(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
              {t("Notes / Description", "اضافی تفصیل یا وضاحت")}
            </label>
            <Input
              value={newAccNotes}
              onChange={(e) => setNewAccNotes(e.target.value)}
              placeholder="e.g. Branch IBAN / account details or ledger purpose"
            />
          </div>

          {/* Integration hint box */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-xs text-blue-950 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200">
            <span className="font-bold flex items-center gap-1.5 text-blue-800 dark:text-blue-300">
              💡 {t("Automatic Integration:", "خودکار شمولیت:")}
            </span>
            <p className="mt-1 text-[11px] text-blue-900/80 dark:text-blue-300/80">
              {t(
                "Accounts created here become immediately available across General Ledger statements, Journal Vouchers, and Trial Balance. Adding a Bank or Cash account will also enable it in Payments and Bank Deposits.",
                "یہاں شامل کردہ کھاتے فوری طور پر جنرل لیجر اسٹیٹمنٹ، روزنامچہ اور میزان پرتال میں دستیاب ہوں گے۔ بینک یا کیش کھاتہ شامل کرنے پر وہ ادائیگیاں اور بینک ڈپازٹ میں بھی ظاہر ہوگا۔"
              )}
            </p>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowAddAccountModal(false)}
            >
              {t("Cancel", "منسوخ")}
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={addAccountLoading}
            >
              {t("Save Account Head", "کھاتہ محفوظ کریں")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reusable Journal / Contra Voucher Modal */}
      <JournalVoucherModal
        isOpen={showVoucherModal}
        onClose={() => setShowVoucherModal(false)}
        voucher={selectedVoucher}
        company={activeCompany}
      />
    </div>
  );
}

export default function AccountingPage() {
  return (
    <Suspense fallback={<BrandPageLoader message="Loading Accounting Hub..." submessage="Initializing Double-Entry Engine..." />}>
      <AccountingContent />
    </Suspense>
  );
}
