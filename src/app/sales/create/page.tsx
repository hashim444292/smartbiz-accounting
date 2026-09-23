"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatMoney, round2, toDecimal } from "@/lib/decimal";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { BrandPageLoader } from "@/components/ui/loader";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Lock,
  ShieldCheck,
  Receipt,
  Banknote,
  Building,
  CreditCard,
  Check,
  Zap,
  Wallet,
  UserCheck,
  AlertTriangle,
  BadgeAlert,
  Building2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { smartFetch, invalidateCache } from "@/lib/clientCache";

interface ProductOption {
  id: string;
  name: string;
  sku: string | null;
  uom?: string;
  unit?: string;
  sellingPrice: number;
  purchasePrice?: number;
  currentStock: number;
  hsCode?: string | null;
  categoryId?: string | null;
}

interface CustomerOption {
  id: string;
  code?: string;
  name: string;
  businessName?: string | null;
  phone?: string | null;
  taxStatus?: string;
  currentBalance: number;
  ntn?: string;
}

interface CategoryOption {
  id: string;
  name: string;
  defaultHsCode?: string | null;
}

interface SaleLineItem {
  productId: string;
  productName: string;
  sku: string;
  hsCode: string;
  uom: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  taxableAmount: number;
  lineTotal: number;
  availableStock: number;
}

type BuyerTaxStatus = "EXEMPT" | "REGISTERED" | "UNREGISTERED";
type PaymentMethod = "CASH" | "BANK" | "CHEQUE" | "POS_DIGITAL";
type PaymentMode = "FULL" | "PARTIAL" | "CREDIT";

export default function CreateSalePage() {
  const router = useRouter();
  const { user, activeCompany, branches, selectedBranch, activeBranchId, isBranchLocked } = useAuth();
  const effectiveBranch = isBranchLocked ? user?.branchId : (selectedBranch?.id || activeBranchId || null);
  const [saleBranchId, setSaleBranchId] = useState<string>("");

  useEffect(() => {
    const bId = isBranchLocked ? (user?.branchId || "") : (selectedBranch?.id || activeBranchId || (branches[0]?.id || ""));
    setSaleBranchId(bId);
  }, [isBranchLocked, user?.branchId, selectedBranch?.id, activeBranchId, branches]);

  // Master Data State
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [tenantName, setTenantName] = useState<string>("ABC Electronics (Pvt) Ltd");
  const [orgHsCode, setOrgHsCode] = useState<string>("8517.13");
  const [invoiceNumberPreview, setInvoiceNumberPreview] = useState<string>("ABC-2026-AUTO");
  const [loadingOptions, setLoadingOptions] = useState<boolean>(true);

  // Form Header State
  const [customerId, setCustomerId] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("Walk in (Walk in)");
  const [walkInName, setWalkInName] = useState<string>("");
  const [walkInPhone, setWalkInPhone] = useState<string>("");
  const [buyerTaxStatus, setBuyerTaxStatus] = useState<BuyerTaxStatus>("EXEMPT");
  const [date, setDate] = useState<string>(new Date().toISOString().split("T")[0]);

  // Line Items State
  const [items, setItems] = useState<SaleLineItem[]>([]);

  // Payment & Settlement State
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("FULL");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [overallDiscount, setOverallDiscount] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");

  // Submission State
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Quick Add Product Modal State
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState<boolean>(false);
  const [activeItemIndexForProduct, setActiveItemIndexForProduct] = useState<number | null>(null);
  const [isSavingProduct, setIsSavingProduct] = useState<boolean>(false);
  const [productSaveError, setProductSaveError] = useState<string | null>(null);
  const [newProductForm, setNewProductForm] = useState({
    name: "",
    sku: "",
    categoryId: "",
    uom: "PCS",
    sellingPrice: "",
    purchasePrice: "",
    openingQuantity: "10",
    hsCode: "8517.13",
  });

  // Quick Add Customer Modal State
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState<boolean>(false);
  const [isSavingCustomer, setIsSavingCustomer] = useState<boolean>(false);
  const [customerSaveError, setCustomerSaveError] = useState<string | null>(null);
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: "",
    businessName: "",
    phone: "",
    email: "",
    taxStatus: "UNREGISTERED" as BuyerTaxStatus,
    ntn: "",
    address: "",
  });

  // Success Modal State
  const [savedInvoiceResult, setSavedInvoiceResult] = useState<any | null>(null);

  // Selected Customer Object
  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === customerId) || null;
  }, [customers, customerId]);

  // Helper to calculate line item numbers
  const recalculateItem = useCallback(
    (item: Partial<SaleLineItem>, currentBuyerStatus: BuyerTaxStatus): SaleLineItem => {
      const q = Math.max(0, Number(item.quantity || 1));
      const p = Math.max(0, Number(item.unitPrice || 0));
      const discPct = Math.min(100, Math.max(0, Number(item.discountPercent || 0)));

      const sub = q * p;
      const discAmt = round2(toDecimal(sub).mul(discPct).div(100)).toNumber();
      const taxable = Math.max(0, sub - discAmt);

      // Tax rate based on Buyer Tax Status
      const tr = currentBuyerStatus === "EXEMPT" ? 0 : 18;
      const taxAmt = round2(toDecimal(taxable).mul(tr).div(100)).toNumber();
      const lineTotal = taxable + taxAmt;

      return {
        productId: item.productId || "",
        productName: item.productName || "",
        sku: item.sku || "",
        hsCode: item.hsCode || orgHsCode,
        uom: item.uom || "PCS",
        quantity: q,
        unitPrice: p,
        discountPercent: discPct,
        discountAmount: discAmt,
        taxRate: tr,
        taxAmount: taxAmt,
        taxableAmount: taxable,
        lineTotal: lineTotal,
        availableStock: item.availableStock || 0,
      };
    },
    [orgHsCode]
  );

  // Load Initial Metadata, Products, Customers
  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoadingOptions(true);
        const headers: Record<string, string> = {};
        if (activeCompany?.id) headers["x-business-id"] = activeCompany.id;
        const branchToPass = isBranchLocked ? user?.branchId : (saleBranchId || effectiveBranch);
        if (branchToPass) headers["x-branch-id"] = branchToPass;

        const [metaJson, prodJson, custJson] = await Promise.all([
          smartFetch("/api/products?meta=true", { headers, ttlMs: 60000 }).catch(() => ({})),
          smartFetch("/api/products?limit=100", { headers, ttlMs: 25000 }).catch(() => ({})),
          smartFetch("/api/customers", { headers, ttlMs: 25000 }).catch(() => ({})),
        ]);

        // 1. Organization & Categories
        let currentOrgHs = "8517.13";
        if (metaJson.success && metaJson.data?.organization) {
          const org = metaJson.data.organization;
          if (org.name) setTenantName(org.name);
          if (org.defaultHsCode) {
            currentOrgHs = org.defaultHsCode;
            setOrgHsCode(org.defaultHsCode);
          }
          const prefix = (org.name || "ABC").substring(0, 3).toUpperCase();
          setInvoiceNumberPreview(`${prefix}-2026-AUTO`);
        }

        if (metaJson.success && metaJson.data?.categories) {
          setCategories(metaJson.data.categories);
        }

        // 2. Products
        const prodList: ProductOption[] = prodJson.products || prodJson.data || [];
        setProducts(prodList);

        // 3. Customers
        const custList: CustomerOption[] = custJson.data || [];
        setCustomers(custList);

        // Pre-fill initial item
        if (prodList.length > 0) {
          const firstProd =
            prodList.find((p) => p.name.toLowerCase().includes("galaxy") || p.name.toLowerCase().includes("s25")) ||
            prodList[0];

          const initialItem = recalculateItem(
            {
              productId: firstProd.id,
              productName: firstProd.name,
              sku: firstProd.sku || "SKU-" + firstProd.id,
              hsCode: firstProd.hsCode || currentOrgHs,
              uom: (firstProd.uom || firstProd.unit || "PCS").toUpperCase(),
              quantity: 1,
              unitPrice: Number(firstProd.sellingPrice || 285000),
              discountPercent: 0,
              availableStock: Number(firstProd.currentStock || 10),
            },
            "EXEMPT"
          );
          setItems([initialItem]);
        } else {
          const initialItem = recalculateItem(
            {
              productId: "",
              productName: "Galaxy Smartphone S25 256GB",
              sku: "SKU-S25-256",
              hsCode: currentOrgHs,
              uom: "PCS",
              quantity: 1,
              unitPrice: 285000,
              discountPercent: 0,
              availableStock: 50,
            },
            "EXEMPT"
          );
          setItems([initialItem]);
        }
      } catch (err) {
        console.error("Failed to load sales invoice options:", err);
      } finally {
        setLoadingOptions(false);
      }
    }

    loadInitialData();
  }, [recalculateItem]);

  // Synchronize Line Item Tax Rates when Buyer Tax Status changes
  const handleBuyerTaxStatusChange = (newStatus: BuyerTaxStatus) => {
    setBuyerTaxStatus(newStatus);
    setItems((prevItems) => prevItems.map((it) => recalculateItem(it, newStatus)));
  };

  // Keyboard shortcut Alt+A to add item
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        handleAddItem();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [products, buyerTaxStatus, orgHsCode]);

  // Handle Product Selection for a Row
  const handleProductSelect = (index: number, selectedValue: string) => {
    if (selectedValue === "__ADD_NEW__") {
      setActiveItemIndexForProduct(index);
      setNewProductForm({
        name: "",
        sku: `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
        categoryId: categories[0]?.id || "",
        uom: "PCS",
        sellingPrice: "",
        purchasePrice: "",
        openingQuantity: "10",
        hsCode: orgHsCode,
      });
      setProductSaveError(null);
      setIsAddProductModalOpen(true);
      return;
    }

    const prod = products.find((p) => p.id === selectedValue);
    if (!prod) return;

    setItems((prev) => {
      const next = [...prev];
      next[index] = recalculateItem(
        {
          ...next[index],
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku || `PRD-${prod.id}`,
          uom: (prod.uom || prod.unit || "PCS").toUpperCase(),
          unitPrice: Number(prod.sellingPrice || 0),
          hsCode: prod.hsCode || orgHsCode,
          availableStock: Number(prod.currentStock || 0),
        },
        buyerTaxStatus
      );
      return next;
    });
  };

  // Update Line Item Fields
  const handleItemFieldChange = (index: number, field: keyof SaleLineItem, value: any) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = recalculateItem(
        {
          ...next[index],
          [field]: value,
        },
        buyerTaxStatus
      );
      return next;
    });
  };

  // Add Item Row
  const handleAddItem = () => {
    const defaultProd = products[0];
    const newItem = recalculateItem(
      {
        productId: defaultProd ? defaultProd.id : "",
        productName: defaultProd ? defaultProd.name : "",
        sku: defaultProd?.sku || "",
        hsCode: defaultProd?.hsCode || orgHsCode,
        uom: (defaultProd?.uom || defaultProd?.unit || "PCS").toUpperCase(),
        quantity: 1,
        unitPrice: defaultProd ? Number(defaultProd.sellingPrice || 0) : 0,
        discountPercent: 0,
        availableStock: defaultProd ? Number(defaultProd.currentStock || 0) : 10,
      },
      buyerTaxStatus
    );
    setItems((prev) => [...prev, newItem]);
  };

  // Remove Item Row
  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Financial Calculations
  const grossSubtotal = items.reduce((acc, it) => acc + it.quantity * it.unitPrice, 0);
  const totalItemDiscounts = items.reduce((acc, it) => acc + it.discountAmount, 0);
  const totalDiscount = totalItemDiscounts + Number(overallDiscount || 0);
  const taxableAmount = Math.max(0, grossSubtotal - totalDiscount);

  // Sales Tax (GST)
  const gstAmount =
    buyerTaxStatus === "EXEMPT"
      ? 0
      : round2(toDecimal(taxableAmount).mul(0.18)).toNumber();

  // Further Tax under Section 3(1A) (3% for Unregistered buyers)
  const furtherTaxAmount =
    buyerTaxStatus === "UNREGISTERED"
      ? round2(toDecimal(taxableAmount).mul(0.03)).toNumber()
      : 0;

  // POS Fee is 0 initially (charged only upon manual FBR hit in FBR tab)
  const posFee = 0.0;

  // Total Payable at creation time
  const totalPayable = taxableAmount + gstAmount + furtherTaxAmount + posFee;

  // Dynamic Payment Mode & Accounts Receivable synchronization
  useEffect(() => {
    if (paymentMode === "FULL") {
      setPaidAmount(totalPayable);
    } else if (paymentMode === "CREDIT") {
      setPaidAmount(0);
    } else if (paymentMode === "PARTIAL") {
      // Keep existing paid amount or clamp
      if (paidAmount > totalPayable) {
        setPaidAmount(totalPayable);
      }
    }
  }, [totalPayable, paymentMode]);

  const remainingReceivable = Math.max(0, totalPayable - Number(paidAmount || 0));

  // Change payment mode handler
  const handleSetPaymentMode = (mode: PaymentMode) => {
    setPaymentMode(mode);
    if (mode === "FULL") {
      setPaidAmount(totalPayable);
      setWalkInName("");
      setWalkInPhone("");
    } else if (mode === "CREDIT") {
      setPaidAmount(0);
    } else if (mode === "PARTIAL") {
      setPaidAmount(Math.round(totalPayable / 2)); // Default 50% deposit
    }
  };

  // Quick Customer Creation Handler
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustomerSaveError(null);
    if (!newCustomerForm.name.trim()) {
      setCustomerSaveError("Customer name is required.");
      return;
    }

    try {
      setIsSavingCustomer(true);
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCustomerForm.name.trim(),
          businessName: newCustomerForm.businessName.trim() || null,
          phone: newCustomerForm.phone.trim() || null,
          email: newCustomerForm.email.trim() || null,
          address: newCustomerForm.address.trim() || null,
          openingBalance: 0,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to register customer");
      }

      const createdCust: CustomerOption = data.data;
      invalidateCache("/api/customers");
      setCustomers((prev) => [createdCust, ...prev]);
      setCustomerId(createdCust.id);
      setCustomerName(createdCust.name);
      setBuyerTaxStatus(newCustomerForm.taxStatus);
      handleBuyerTaxStatusChange(newCustomerForm.taxStatus);
      setIsAddCustomerModalOpen(false);
      setNewCustomerForm({
        name: "",
        businessName: "",
        phone: "",
        email: "",
        taxStatus: "UNREGISTERED",
        ntn: "",
        address: "",
      });
    } catch (err: any) {
      setCustomerSaveError(err.message || "Error creating customer");
    } finally {
      setIsSavingCustomer(false);
    }
  };

  // Quick Product Creation Handler
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setProductSaveError(null);
    if (!newProductForm.name.trim()) {
      setProductSaveError("Product name is required.");
      return;
    }
    const sellP = Number(newProductForm.sellingPrice);
    if (isNaN(sellP) || sellP <= 0) {
      setProductSaveError("Valid selling price is required.");
      return;
    }

    try {
      setIsSavingProduct(true);
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProductForm.name.trim(),
          sku: newProductForm.sku.trim() || null,
          categoryId: newProductForm.categoryId || undefined,
          uom: newProductForm.uom.toLowerCase(),
          unit: newProductForm.uom.toLowerCase(),
          sellingPrice: sellP,
          purchasePrice: Number(newProductForm.purchasePrice || sellP * 0.85),
          openingQuantity: Number(newProductForm.openingQuantity || 10),
          hsCode: newProductForm.hsCode || orgHsCode,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to create product in catalog");
      }

      const createdProduct: ProductOption = data.data;
      invalidateCache("/api/products");
      setProducts((prev) => [createdProduct, ...prev]);

      // If triggered from a line item, populate that line item
      if (activeItemIndexForProduct !== null) {
        setItems((prev) => {
          const next = [...prev];
          next[activeItemIndexForProduct] = recalculateItem(
            {
              ...next[activeItemIndexForProduct],
              productId: createdProduct.id,
              productName: createdProduct.name,
              sku: createdProduct.sku || `PRD-${createdProduct.id}`,
              uom: (createdProduct.uom || createdProduct.unit || "PCS").toUpperCase(),
              unitPrice: Number(createdProduct.sellingPrice || sellP),
              hsCode: createdProduct.hsCode || orgHsCode,
              availableStock: Number(createdProduct.currentStock || newProductForm.openingQuantity || 10),
            },
            buyerTaxStatus
          );
          return next;
        });
      }

      setIsAddProductModalOpen(false);
      setActiveItemIndexForProduct(null);
    } catch (err: any) {
      setProductSaveError(err.message || "Error creating product");
    } finally {
      setIsSavingProduct(false);
    }
  };

  // Submit & Save Invoice (With full Accounts Receivable support)
  const handleSubmitInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (items.length === 0) {
      setError("Please add at least one line item to generate the invoice.");
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.productName.trim()) {
        setError(`Item #${i + 1} has no description or product selected.`);
        return;
      }
      if (it.quantity <= 0) {
        setError(`Item #${i + 1} quantity must be greater than 0.`);
        return;
      }
    }

    try {
      setSubmitting(true);

      const actualPaid = paymentMode === "CREDIT" ? 0 : Number(paidAmount || 0);
      const remaining = Math.max(0, totalPayable - actualPaid);

      if (!customerId && remaining > 0 && !walkInName.trim()) {
        setError("Please enter the Walk-in Customer's Name so the remaining receivable can be clearly tracked in their ledger.");
        return;
      }

      const finalCustomerName = !customerId
        ? (remaining > 0 && walkInName.trim() ? `${walkInName.trim()} (Walk-in)` : "Walk in (Walk in)")
        : (customerName || "Walk in (Walk in)");

      const operatingBranchId = isBranchLocked ? (user?.branchId || null) : (saleBranchId || effectiveBranch || null);

      const payload = {
        branchId: operatingBranchId,
        createdById: user?.userId,
        createdByName: user?.name,
        date: new Date(date),
        customerId: customerId || null,
        customerName: finalCustomerName,
        customerPhone: !customerId && remaining > 0 && walkInPhone.trim() ? walkInPhone.trim() : undefined,
        buyerTaxStatus,
        items: items.map((it) => ({
          productId: it.productId || (products[0]?.id ?? "prod-default"),
          productName: it.productName,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          discount: it.discountAmount,
          taxRate: it.taxRate,
          hsCode: it.hsCode || orgHsCode,
        })),
        overallDiscount: Number(overallDiscount || 0),
        taxAmount: gstAmount + furtherTaxAmount,
        salesTax: gstAmount,
        furtherTax: furtherTaxAmount,
        extraTax: 0,
        posFee: 0, // No POS fee added upfront
        paidAmount: actualPaid,
        paymentMethod: actualPaid > 0 ? paymentMethod : "CREDIT",
        notes: notes.trim() || undefined,
        fbrStatus: "PENDING",
        fbrInvoiceNumber: null,
        fbrQrCode: null,
      };

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (activeCompany?.id) headers["x-business-id"] = activeCompany.id;
      if (operatingBranchId) headers["x-branch-id"] = operatingBranchId;

      const res = await fetch("/api/sales", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Failed to post sales invoice");
      }

      invalidateCache("/api/sales");
      invalidateCache("/api/products");
      invalidateCache("/api/dashboard");
      invalidateCache("/api/accounting");

      // Show Save & Queued Dialog with Accounts Receivable breakdown
      setSavedInvoiceResult({
        ...json.data,
        grossSubtotal,
        totalDiscount,
        taxableAmount,
        gstAmount,
        furtherTaxAmount,
        posFee: 0,
        totalPayable,
        actualPaid,
        remainingReceivable: remaining,
        paymentMode,
        items,
        customerName: finalCustomerName,
        paymentMethod: actualPaid > 0 ? paymentMethod : "CREDIT",
        date,
      });
    } catch (err: any) {
      setError(err.message || "Failed to save sales invoice");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingOptions) {
    return (
      <div className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:px-8 space-y-6">
        <BrandPageLoader
          message="Loading Sales Invoice Terminal..."
          submessage="Fetching customer directory, inventory catalog, and FBR fiscal rules..."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8 space-y-6">
        {/* Top Header Banner */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-5 dark:border-slate-800">
          <div className="flex items-center gap-4">
            <Link
              href="/sales"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                  Create Sales Tax Invoice
                </h1>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  Commercial Sale
                </span>
                <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  Tenant: {tenantName}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Cash, Partial Payment & Account Receivable (Credit) supported • Queued for manual FBR Invoicing
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50/80 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-300">
              <Lock className="h-3 w-3 text-blue-600 dark:text-blue-400" />
              <span>Org Default HS: <strong className="font-mono font-bold">{orgHsCode}</strong></span>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-300">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              <span>FBR Invoicing Queue (Manual Hit)</span>
            </div>
          </div>
        </div>

        {/* Active Branch Scope Indicator & Cashier Attribution */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 text-xs text-indigo-950 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-200">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white uppercase">
              {user?.name?.charAt(0) || "U"}
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-900 dark:text-white">{user?.name || "Cashier"}</span>
                <span className="rounded bg-indigo-200/80 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-900 dark:bg-indigo-900 dark:text-indigo-200">
                  {user?.role?.replace("_", " ") || "STAFF"}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Billing Officer (فروخت کنندہ)</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Terminal Outlet:</span>
            {isBranchLocked ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-3 py-1 font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                <Building2 className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300" />
                <span>{user?.branchName || "Assigned Branch"} (LOCKED)</span>
              </span>
            ) : (
              <div className="min-w-[200px]">
                <select
                  value={saleBranchId}
                  onChange={(e) => setSaleBranchId(e.target.value)}
                  className="w-full rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-900 dark:border-indigo-800 dark:bg-slate-900 dark:text-white"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      🏢 {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmitInvoice} className="space-y-6">
          {/* Top Card: Invoice Number, Customer (Buyer), Buyer Tax Status */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {/* Column 1: INVOICE NUMBER */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  <span>INVOICE NUMBER</span>
                  <span className="flex items-center gap-1 text-[11px] font-normal text-slate-400">
                    <Lock className="h-3 w-3" /> System Locked
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    value={invoiceNumberPreview}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300"
                  />
                  <Lock className="absolute right-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                </div>
                <p className="text-[11px] text-slate-400 italic">
                  Sequential fiscal number generated on save
                </p>
              </div>

              {/* Column 2: CUSTOMER (BUYER) * */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  <span>
                    CUSTOMER (BUYER) <span className="text-rose-500">*</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerSaveError(null);
                      setIsAddCustomerModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400"
                  >
                    <Plus className="h-3 w-3" /> + Add New Customer
                  </button>
                </div>

                <div className="relative">
                  <select
                    value={customerId}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "__ADD_NEW__") {
                        setCustomerSaveError(null);
                        setIsAddCustomerModalOpen(true);
                        return;
                      }
                      setCustomerId(val);
                      if (!val) {
                        setCustomerName("Walk in (Walk in)");
                        handleBuyerTaxStatusChange("EXEMPT");
                      } else {
                        const c = customers.find((cust) => cust.id === val);
                        if (c) {
                          setCustomerName(c.name);
                          if (c.taxStatus === "REGISTERED" || c.taxStatus === "EXEMPT" || c.taxStatus === "UNREGISTERED") {
                            handleBuyerTaxStatusChange(c.taxStatus);
                          }
                        }
                      }
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                  >
                    <option value="">Walk in (Walk in) — Exempt</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.businessName ? `(${c.businessName})` : c.phone ? `(${c.phone})` : ""} — {c.taxStatus || "Customer"} (Balance: Rs {c.currentBalance?.toLocaleString()})
                      </option>
                    ))}
                    <option value="__ADD_NEW__" className="font-bold text-blue-600">
                      ➕ + Add New Customer...
                    </option>
                  </select>
                </div>

                {/* Selected Customer Pill Preview & Ledger Balance */}
                <div className="flex items-center justify-between rounded-lg border border-slate-200/80 bg-slate-50 px-2.5 py-1 text-[11px] dark:border-slate-800 dark:bg-slate-800/40">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {customerName}
                    </span>
                    <span className="rounded bg-amber-100 px-1.5 py-0.2 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                      {buyerTaxStatus === "EXEMPT" ? "Exempt" : buyerTaxStatus === "REGISTERED" ? "Taxpayer" : "Non-taxpayer"}
                    </span>
                  </div>
                  {selectedCustomer ? (
                    <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300">
                      Ledger: Rs {selectedCustomer.currentBalance?.toLocaleString()}
                    </span>
                  ) : (
                    <span className="rounded bg-slate-200/80 px-1.5 py-0.2 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                      Walk-in
                    </span>
                  )}
                </div>

                {/* Walk-in Customer Details: ONLY displayed when Partial / Credit Sale has remaining balance */}
                {!customerId && remainingReceivable > 0 && (
                  <div className="mt-2 rounded-xl border border-amber-300 bg-amber-50/80 p-3 text-xs space-y-2.5 transition animate-in fade-in dark:border-amber-800 dark:bg-amber-950/40 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                        <UserCheck className="h-4 w-4 text-indigo-600 shrink-0" />
                        <span>Walk-in Customer Name & Phone:</span>
                      </div>
                      <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800">
                        Receivable: PKR {remainingReceivable.toLocaleString()}
                      </span>
                    </div>

                    <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-tight">
                      ⚠️ <strong>Partial / Credit Sale:</strong> Customer ka name aur phone number likhein taake pata chale kis se remaining amount leni hai aur ledger me show ho.
                    </p>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-0.5">
                          Buyer / Walk-in Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={walkInName}
                          onChange={(e) => setWalkInName(e.target.value)}
                          placeholder="e.g. Muhammad Kashif, Ali Raza"
                          className={`w-full rounded-lg border bg-white px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 ${
                            !walkInName.trim()
                              ? "border-rose-400 focus:border-rose-600 focus:ring-rose-600 bg-rose-50/30"
                              : "border-slate-300 focus:border-indigo-600 focus:ring-indigo-600"
                          } dark:bg-slate-900 dark:border-slate-700 dark:text-white`}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-0.5">
                          Mobile / WhatsApp #
                        </label>
                        <input
                          type="text"
                          value={walkInPhone}
                          onChange={(e) => setWalkInPhone(e.target.value)}
                          placeholder="e.g. 0300-1234567"
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="pt-0.5 text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span>
                        Invoice aur Customers (Receivables) tab me <strong className="text-indigo-700 dark:text-indigo-300">{walkInName.trim() ? `${walkInName.trim()} (Walk-in)` : "Walk-in Customer Name"}</strong> ke naam se balance record hoga.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Column 3: BUYER TAX STATUS */}
              <div className="space-y-1.5">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  BUYER TAX STATUS
                </div>
                <select
                  value={buyerTaxStatus}
                  onChange={(e) => handleBuyerTaxStatusChange(e.target.value as BuyerTaxStatus)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                >
                  <option value="EXEMPT">Exempt Supplies (6th Schedule — 0% Tax)</option>
                  <option value="REGISTERED">Registered Taxpayer (18% Sales Tax)</option>
                  <option value="UNREGISTERED">Unregistered Buyer (18% + 3% Further Tax)</option>
                </select>
                <p className="text-[11px] text-slate-400">
                  Determines statutory sales tax rate and Section 3(1A) Further Tax
                </p>
              </div>
            </div>
          </div>

          {/* Line Items Table Section */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
            {/* Table Header Section Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-white">
                  INVOICE LINE ITEMS
                </h2>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {items.length} {items.length === 1 ? "Item" : "Items"}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300">
                  <Lock className="h-2.5 w-2.5" /> Locked Org HS: {orgHsCode}
                </span>
              </div>

              <Button
                type="button"
                onClick={handleAddItem}
                variant="primary"
                size="sm"
                className="bg-blue-600 text-xs font-semibold hover:bg-blue-700 shadow-sm"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Item (Alt+A)
              </Button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800/40 dark:border-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="py-3 pl-4 pr-2 w-10 text-center">#</th>
                    <th className="py-3 px-3 min-w-[280px]">ITEM DESCRIPTION & CATALOG</th>
                    <th className="py-3 px-3 w-36 text-center">HS / PCT CODE</th>
                    <th className="py-3 px-2 w-24 text-center">UOM</th>
                    <th className="py-3 px-2 w-20 text-center">QTY</th>
                    <th className="py-3 px-2 w-32 text-right">UNIT PRICE (PKR)</th>
                    <th className="py-3 px-2 w-20 text-center">DISC %</th>
                    <th className="py-3 px-2 w-20 text-center">TAX %</th>
                    <th className="py-3 px-3 w-32 text-right">TAXABLE</th>
                    <th className="py-3 px-3 w-32 text-right">TOTAL (PKR)</th>
                    <th className="py-3 pl-2 pr-4 w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition">
                      {/* # Index */}
                      <td className="py-3 pl-4 pr-2 text-center font-semibold text-slate-400">
                        {idx + 1}
                      </td>

                      {/* ITEM DESCRIPTION & CATALOG */}
                      <td className="py-3 px-3 space-y-1.5">
                        <input
                          type="text"
                          value={it.productName}
                          onChange={(e) => handleItemFieldChange(idx, "productName", e.target.value)}
                          placeholder="Enter item description or pick from catalog below"
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        />

                        {/* Product Dropdown Selector with Quick Add */}
                        <div className="flex items-center gap-1.5">
                          <select
                            value={it.productId}
                            onChange={(e) => handleProductSelect(idx, e.target.value)}
                            className="w-full rounded-md border border-slate-200 bg-slate-50/80 px-2 py-1 text-[11px] text-slate-600 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 truncate"
                          >
                            <option value="">Select from catalog...</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} {p.sku ? `(${p.sku})` : ""} — Rs. {p.sellingPrice?.toLocaleString()} ({p.currentStock ?? 0} {p.uom || p.unit || "pcs"})
                              </option>
                            ))}
                            <option value="__ADD_NEW__" className="font-bold text-blue-600">
                              ➕ + Add New Product to Catalog...
                            </option>
                          </select>

                          <button
                            type="button"
                            title="Add New Product to Catalog"
                            onClick={() => {
                              setActiveItemIndexForProduct(idx);
                              setNewProductForm({
                                name: it.productName || "",
                                sku: `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
                                categoryId: categories[0]?.id || "",
                                uom: it.uom || "PCS",
                                sellingPrice: it.unitPrice ? String(it.unitPrice) : "",
                                purchasePrice: "",
                                openingQuantity: "10",
                                hsCode: it.hsCode || orgHsCode,
                              });
                              setProductSaveError(null);
                              setIsAddProductModalOpen(true);
                            }}
                            className="rounded-md border border-blue-200 bg-blue-50 p-1 text-blue-600 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {it.availableStock > 0 && (
                          <div className="text-[10px] text-slate-400 flex items-center gap-2">
                            <span>In Stock: <strong className="text-slate-600 dark:text-slate-300">{it.availableStock} {it.uom}</strong></span>
                            {it.sku && <span>SKU: {it.sku}</span>}
                          </div>
                        )}
                      </td>

                      {/* HS / PCT CODE */}
                      <td className="py-3 px-3 text-center align-top pt-4">
                        <div className="relative inline-block w-full">
                          <input
                            type="text"
                            readOnly
                            value={it.hsCode || orgHsCode}
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-center text-xs font-mono font-bold text-slate-700 focus:outline-none dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300"
                          />
                          <Lock className="absolute right-2 top-2 h-3 w-3 text-slate-400" />
                        </div>
                        <p className="text-[9px] text-slate-400 mt-1">HS Code set by org admin</p>
                      </td>

                      {/* UOM */}
                      <td className="py-3 px-2 text-center align-top pt-4">
                        <select
                          value={it.uom}
                          onChange={(e) => handleItemFieldChange(idx, "uom", e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center text-xs font-semibold text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                          <option value="PCS">PCS</option>
                          <option value="KG">KG</option>
                          <option value="BOX">BOX</option>
                          <option value="PACK">PACK</option>
                          <option value="MTR">MTR</option>
                          <option value="UNIT">UNIT</option>
                        </select>
                      </td>

                      {/* QTY */}
                      <td className="py-3 px-2 text-center align-top pt-4">
                        <input
                          type="number"
                          min="1"
                          step="any"
                          value={it.quantity || ""}
                          onChange={(e) => handleItemFieldChange(idx, "quantity", e.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-center text-xs font-bold text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        />
                      </td>

                      {/* UNIT PRICE (PKR) */}
                      <td className="py-3 px-2 text-right align-top pt-4">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={it.unitPrice || ""}
                          onChange={(e) => handleItemFieldChange(idx, "unitPrice", e.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-right text-xs font-semibold tabular-nums text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        />
                      </td>

                      {/* DISC % */}
                      <td className="py-3 px-2 text-center align-top pt-4">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={it.discountPercent || ""}
                          onChange={(e) => handleItemFieldChange(idx, "discountPercent", e.target.value)}
                          placeholder="0"
                          className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-center text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        />
                      </td>

                      {/* TAX % */}
                      <td className="py-3 px-2 text-center align-top pt-4">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-center text-xs font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300">
                          {it.taxRate}%
                        </div>
                      </td>

                      {/* TAXABLE */}
                      <td className="py-3 px-3 text-right align-top pt-5 font-semibold text-slate-700 tabular-nums dark:text-slate-300">
                        PKR {it.taxableAmount.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* TOTAL (PKR) */}
                      <td className="py-3 px-3 text-right align-top pt-5 font-bold text-slate-900 tabular-nums dark:text-white">
                        PKR {it.lineTotal.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Trash action */}
                      <td className="py-3 pl-2 pr-4 text-center align-top pt-4">
                        <button
                          type="button"
                          disabled={items.length <= 1}
                          onClick={() => handleRemoveItem(idx)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-rose-950/40"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Grid: Payment Methods & Guarantee (Left) vs Tax & Payment Summary (Right) */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left Column (7 cols): Payment Mode Selector + Settlement Method + Guarantee */}
            <div className="space-y-6 lg:col-span-7">
              {/* Payment Mode Selector: Full, Partial, Credit Sale */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Payment Terms & Settlement Type
                  </h3>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    paymentMode === "FULL"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : paymentMode === "PARTIAL"
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                      : "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
                  }`}>
                    {paymentMode === "FULL" ? "100% Full Payment" : paymentMode === "PARTIAL" ? "Partial Deposit + Receivable" : "100% Account Receivable (Credit)"}
                  </span>
                </div>

                {/* 3 Payment Mode Toggle Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => handleSetPaymentMode("FULL")}
                    className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition ${
                      paymentMode === "FULL"
                        ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 shadow-sm"
                        : "border-slate-200 bg-white hover:bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>Full Payment</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      Customer pays 100% today in Cash or Bank
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSetPaymentMode("PARTIAL")}
                    className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition ${
                      paymentMode === "PARTIAL"
                        ? "border-amber-500 bg-amber-50/60 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 shadow-sm"
                        : "border-slate-200 bg-white hover:bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <Wallet className="h-4 w-4 text-amber-600" />
                      <span>Partial Payment</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      Pays advance/deposit; balance to Receivable
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSetPaymentMode("CREDIT")}
                    className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition ${
                      paymentMode === "CREDIT"
                        ? "border-rose-500 bg-rose-50/60 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200 shadow-sm"
                        : "border-slate-200 bg-white hover:bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <CreditCard className="h-4 w-4 text-rose-600" />
                      <span>Full Credit Sale</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      Rs. 0 paid today; 100% to Customer Receivable
                    </p>
                  </button>
                </div>

                {/* Credit / Receivable Warning for Walk-in Customers */}
                {remainingReceivable > 0 && !customerId && (
                  <div className={`flex items-start gap-2.5 rounded-xl p-3 text-xs border ${
                    walkInName.trim()
                      ? "bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-200"
                      : "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-200"
                  }`}>
                    {walkInName.trim() ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                    )}
                    <div className="flex-1 space-y-1">
                      {walkInName.trim() ? (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-emerald-950 dark:text-emerald-300">Walk-in Customer Identified:</span>
                            <span className="font-semibold text-emerald-800 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded text-[11px]">
                              {walkInName.trim()} (Walk-in)
                            </span>
                          </div>
                          <p className="text-[11px] text-emerald-800/90 dark:text-emerald-300/80 leading-relaxed">
                            Outstanding balance of <strong>PKR {remainingReceivable.toLocaleString()}</strong> will automatically be tracked under this customer in Receivables & Ledger.
                          </p>
                        </>
                      ) : (
                        <>
                          <span className="font-bold">Walk-in Name Required for Credit / Receivable Sale:</span>
                          <p className="text-[11px] text-amber-800/90 leading-relaxed">
                            You have <strong>PKR {remainingReceivable.toLocaleString()}</strong> remaining as Accounts Receivable. Please enter the Walk-in Customer Name above so their balance is tracked in Receivables, or register a permanent customer below.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setCustomerSaveError(null);
                              setIsAddCustomerModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 font-bold text-blue-700 underline text-[11px] pt-0.5"
                          >
                            <Plus className="h-3 w-3" /> Register & Select Customer Now
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Payment Channel Buttons (Enabled when paidAmount > 0) */}
                {paidAmount > 0 && (
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Received Amount Payment Channel
                    </label>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("CASH")}
                        className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-xs font-semibold transition ${
                          paymentMethod === "CASH"
                            ? "border-blue-600 bg-blue-50/60 text-blue-700 shadow-sm dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-300"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                        }`}
                      >
                        <Banknote className="h-4 w-4" />
                        <span>Cash</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod("BANK")}
                        className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-xs font-semibold transition ${
                          paymentMethod === "BANK"
                            ? "border-blue-600 bg-blue-50/60 text-blue-700 shadow-sm dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-300"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                        }`}
                      >
                        <Building className="h-4 w-4" />
                        <span>Bank Transfer</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod("CHEQUE")}
                        className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-xs font-semibold transition ${
                          paymentMethod === "CHEQUE"
                            ? "border-blue-600 bg-blue-50/60 text-blue-700 shadow-sm dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-300"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                        }`}
                      >
                        <Receipt className="h-4 w-4" />
                        <span>Cheque</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod("POS_DIGITAL")}
                        className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-xs font-semibold transition ${
                          paymentMethod === "POS_DIGITAL"
                            ? "border-blue-600 bg-blue-50/60 text-blue-700 shadow-sm dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-300"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                        }`}
                      >
                        <CreditCard className="h-4 w-4" />
                        <span>POS Card</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Additional Notes & Date */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Invoice Date
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Payment Terms / Remarks
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={remainingReceivable > 0 ? "e.g. Due within 15 days, credit agreement" : "Optional transaction remarks..."}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                    />
                  </div>
                </div>
              </div>

              {/* Pakistani Tax Compliance Guarantee (SRO 1006(I)) Banner */}
              <div className="flex items-start gap-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4.5 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                    Pakistani Tax Compliance Guarantee (SRO 1006(I))
                  </h4>
                  <p className="text-xs leading-relaxed text-emerald-800/90 dark:text-emerald-300/80">
                    All commercial line item HS Codes are locked strictly to your organization's authorized default (<strong className="font-mono font-bold text-emerald-950 dark:text-white">{orgHsCode}</strong>). Supplies to non-registered buyers automatically include statutory 3% Further Tax under Section 3(1A) of the Sales Tax Act, 1990.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column (5 cols): TAX & PAYMENT SUMMARY */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    TAX & PAYMENT SUMMARY
                  </h3>
                  <span className="text-[11px] font-mono font-medium text-slate-400">
                    FBR SRO 1006(I)
                  </span>
                </div>

                <div className="space-y-2.5 text-xs">
                  {/* Gross Total (Subtotal) */}
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                    <span>Gross Total (Subtotal)</span>
                    <span className="font-semibold text-slate-900 tabular-nums dark:text-slate-200">
                      PKR {grossSubtotal.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Trade Discount */}
                  <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                    <span>Trade Discount</span>
                    <span className="font-semibold tabular-nums">
                      {totalDiscount > 0 ? `- PKR ${totalDiscount.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "PKR 0.00"}
                    </span>
                  </div>

                  {/* Overall Discount Input */}
                  <div className="flex items-center justify-between py-1 text-[11px] text-slate-500">
                    <span>Additional Special Discount (PKR)</span>
                    <input
                      type="number"
                      min="0"
                      value={overallDiscount || ""}
                      onChange={(e) => setOverallDiscount(Number(e.target.value) || 0)}
                      placeholder="0"
                      className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-right text-xs font-semibold focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  {/* Taxable Amount */}
                  <div className="flex items-center justify-between border-t border-slate-100 pt-2 font-semibold text-slate-800 dark:border-slate-800 dark:text-slate-200">
                    <span>Taxable Amount</span>
                    <span className="tabular-nums">
                      PKR {taxableAmount.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Sales Tax (GST) */}
                  <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                    <div className="flex items-center gap-1.5">
                      <span>Sales Tax (GST)</span>
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                        {buyerTaxStatus === "EXEMPT" ? "8th Sched (0% Tax)" : "18% Standard"}
                      </span>
                    </div>
                    <span className="font-semibold tabular-nums">
                      PKR {gstAmount.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Further Tax (Sec 3(1A)) */}
                  <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                    <div className="flex items-center gap-1.5">
                      <span>Further Tax (Sec 3(1A))</span>
                      {buyerTaxStatus === "UNREGISTERED" && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          3% Non-taxpayer
                        </span>
                      )}
                    </div>
                    <span className="font-semibold tabular-nums">
                      PKR {furtherTaxAmount.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* FBR POS Fee [SRO 1006(I)] Rs. 0.00 until Hit */}
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 text-slate-700 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold">FBR POS Fee [SRO 1006(I)]</span>
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                        Pending FBR Hit
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-slate-500">
                      Rs 0.00 (Rs. 1/- charged when hit)
                    </span>
                  </div>
                </div>

                {/* Total Payable Block (WITHOUT Rs. 1 added upfront) */}
                <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white">
                        Total Payable
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Net goods + federal sales taxes
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black text-blue-600 dark:text-blue-400 tabular-nums">
                        PKR {totalPayable.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Detailed Settlement & Accounts Receivable Breakdown Card */}
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-xs dark:border-slate-800 dark:bg-slate-800/40">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      Amount Paid Today
                    </span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        max={totalPayable}
                        step="any"
                        disabled={paymentMode === "CREDIT"}
                        value={paymentMode === "CREDIT" ? 0 : paidAmount}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(totalPayable, Number(e.target.value) || 0));
                          setPaidAmount(val);
                          if (val === totalPayable) setPaymentMode("FULL");
                          else if (val === 0) setPaymentMode("CREDIT");
                          else setPaymentMode("PARTIAL");
                        }}
                        className="w-32 rounded-lg border border-slate-300 px-2.5 py-1 text-right text-xs font-bold text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white disabled:bg-slate-100 disabled:opacity-60"
                      />
                    </div>
                  </div>

                  {/* Quick percentage shortcuts for partial deposits */}
                  <div className="flex items-center justify-end gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => handleSetPaymentMode("FULL")}
                      className={`rounded px-2 py-0.5 text-[10px] font-bold transition ${
                        paymentMode === "FULL"
                          ? "bg-emerald-600 text-white"
                          : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      100% Paid
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMode("PARTIAL");
                        setPaidAmount(Math.round(totalPayable / 2));
                      }}
                      className={`rounded px-2 py-0.5 text-[10px] font-bold transition ${
                        paymentMode === "PARTIAL" && paidAmount === Math.round(totalPayable / 2)
                          ? "bg-amber-600 text-white"
                          : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      50% Deposit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetPaymentMode("CREDIT")}
                      className={`rounded px-2 py-0.5 text-[10px] font-bold transition ${
                        paymentMode === "CREDIT"
                          ? "bg-rose-600 text-white"
                          : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      0% Paid (Credit)
                    </button>
                  </div>

                  {/* Customer Accounts Receivable Result */}
                  <div className="border-t border-slate-200/80 pt-2.5 space-y-1.5">
                    <div className="flex items-center justify-between font-bold">
                      <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                        <BadgeAlert className="h-4 w-4 text-rose-500" />
                        <span>Customer Account Receivable:</span>
                      </div>
                      <span className={`text-sm tabular-nums font-black ${
                        remainingReceivable > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600"
                      }`}>
                        PKR {remainingReceivable.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    {remainingReceivable > 0 ? (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        This amount will be debited to <strong>Accounts Receivable (1100)</strong> and recorded in <strong>{customerName}</strong>'s balance.
                      </p>
                    ) : (
                      <p className="text-[11px] text-emerald-600 font-medium">
                        Invoice is paid in full. Zero remaining receivable.
                      </p>
                    )}
                  </div>
                </div>

                {/* Submit Action Button */}
                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="w-full bg-blue-600 py-3 text-sm font-bold shadow-md hover:bg-blue-700"
                    isLoading={submitting}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {submitting ? "Saving Invoice to Queue..." : "Generate Sale Invoice (Queue in FBR Tab)"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* QUICK ADD PRODUCT MODAL */}
      <Modal
        isOpen={isAddProductModalOpen}
        onClose={() => setIsAddProductModalOpen(false)}
        title="+ Add New Product to Catalog"
        description="Register a product in your catalog with its official HS Code and instant stock entry"
      >
        <form onSubmit={handleSaveProduct} className="space-y-4">
          {productSaveError && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs font-medium text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{productSaveError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Product Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={newProductForm.name}
                onChange={(e) => setNewProductForm({ ...newProductForm, name: e.target.value })}
                placeholder="e.g. Galaxy S25 Ultra 512GB"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                SKU / Barcode
              </label>
              <input
                type="text"
                value={newProductForm.sku}
                onChange={(e) => setNewProductForm({ ...newProductForm, sku: e.target.value })}
                placeholder="e.g. SAM-S25-512"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Category
              </label>
              <select
                value={newProductForm.categoryId}
                onChange={(e) => setNewProductForm({ ...newProductForm, categoryId: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">Select Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Selling Price (PKR) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                required
                min="1"
                step="any"
                value={newProductForm.sellingPrice}
                onChange={(e) => setNewProductForm({ ...newProductForm, sellingPrice: e.target.value })}
                placeholder="e.g. 285000"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Cost / Purchase Price (PKR)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={newProductForm.purchasePrice}
                onChange={(e) => setNewProductForm({ ...newProductForm, purchasePrice: e.target.value })}
                placeholder="e.g. 260000"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Unit of Measure (UOM)
              </label>
              <select
                value={newProductForm.uom}
                onChange={(e) => setNewProductForm({ ...newProductForm, uom: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="PCS">PCS</option>
                <option value="KG">KG</option>
                <option value="BOX">BOX</option>
                <option value="PACK">PACK</option>
                <option value="MTR">MTR</option>
                <option value="UNIT">UNIT</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Initial Stock Quantity
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={newProductForm.openingQuantity}
                onChange={(e) => setNewProductForm({ ...newProductForm, openingQuantity: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                HS / PCT Code (FBR Fiscal Compliance)
              </label>
              <div className="relative mt-1">
                <input
                  type="text"
                  value={newProductForm.hsCode}
                  onChange={(e) => setNewProductForm({ ...newProductForm, hsCode: e.target.value })}
                  placeholder={orgHsCode}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <Lock className="absolute right-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Default inherited from organization HS Code standard: <strong>{orgHsCode}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsAddProductModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
              isLoading={isSavingProduct}
            >
              Save & Insert Into Invoice
            </Button>
          </div>
        </form>
      </Modal>

      {/* QUICK ADD CUSTOMER MODAL */}
      <Modal
        isOpen={isAddCustomerModalOpen}
        onClose={() => setIsAddCustomerModalOpen(false)}
        title="+ Register New Customer"
        description="Add a new client/buyer profile and immediately select them for this sales invoice"
      >
        <form onSubmit={handleSaveCustomer} className="space-y-4">
          {customerSaveError && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs font-medium text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{customerSaveError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Customer / Person Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={newCustomerForm.name}
                onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                placeholder="e.g. Tariq Mehmood"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Business / Shop Name
              </label>
              <input
                type="text"
                value={newCustomerForm.businessName}
                onChange={(e) => setNewCustomerForm({ ...newCustomerForm, businessName: e.target.value })}
                placeholder="e.g. Mehmood Telecom"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Phone Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={newCustomerForm.phone}
                onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                placeholder="0300 1234567"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Buyer Tax Status
              </label>
              <select
                value={newCustomerForm.taxStatus}
                onChange={(e) => setNewCustomerForm({ ...newCustomerForm, taxStatus: e.target.value as BuyerTaxStatus })}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="UNREGISTERED">Unregistered Buyer (18% + 3% Further Tax)</option>
                <option value="REGISTERED">Registered Taxpayer (18% Sales Tax)</option>
                <option value="EXEMPT">Exempt Supplies (0% Tax)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                NTN / CNIC Number
              </label>
              <input
                type="text"
                value={newCustomerForm.ntn}
                onChange={(e) => setNewCustomerForm({ ...newCustomerForm, ntn: e.target.value })}
                placeholder="e.g. 1234567-8 or 42101-xxxxxxx-x"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Address / City
              </label>
              <input
                type="text"
                value={newCustomerForm.address}
                onChange={(e) => setNewCustomerForm({ ...newCustomerForm, address: e.target.value })}
                placeholder="Shop #12, Saddar Market, Karachi"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsAddCustomerModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
              isLoading={isSavingCustomer}
            >
              Save & Select Customer
            </Button>
          </div>
        </form>
      </Modal>

      {/* INVOICE SAVED & PLACED IN FBR QUEUE MODAL WITH RECEIVABLE DETAILS */}
      {savedInvoiceResult && (
        <Modal
          isOpen={true}
          onClose={() => setSavedInvoiceResult(null)}
          title="Sales Invoice Saved & Queued for FBR Invoicing"
          description="Invoice is posted in your accounting ledger with real-time Accounts Receivable tracking."
          maxWidth="2xl"
        >
          <div className="space-y-5">
            {/* Header Stamp */}
            <div className="flex items-center justify-between rounded-2xl bg-indigo-50 border border-indigo-200 p-4 text-indigo-900 dark:bg-indigo-950/40 dark:border-indigo-900 dark:text-indigo-200">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-indigo-600 p-2 text-white">
                  <Check className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">Invoice #{savedInvoiceResult.invoiceNumber} Created</h4>
                  <p className="text-xs text-indigo-700 dark:text-indigo-300">
                    Customer: <strong>{savedInvoiceResult.customerName}</strong>
                  </p>
                </div>
              </div>
              <div className="text-right font-mono text-xs">
                <span className="block font-bold text-slate-500">PAYMENT STATUS:</span>
                <span className={`rounded px-2 py-0.5 font-bold border ${
                  savedInvoiceResult.remainingReceivable === 0
                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                    : savedInvoiceResult.actualPaid > 0
                    ? "bg-amber-100 text-amber-800 border-amber-300"
                    : "bg-rose-100 text-rose-800 border-rose-300"
                }`}>
                  {savedInvoiceResult.remainingReceivable === 0
                    ? "PAID IN FULL"
                    : savedInvoiceResult.actualPaid > 0
                    ? "PARTIALLY PAID"
                    : "UNPAID (100% CREDIT)"}
                </span>
              </div>
            </div>

            {/* Financial Totals Breakdown Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs dark:bg-slate-900 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Total Invoice</span>
                <p className="text-sm font-bold font-mono text-slate-900 dark:text-white mt-0.5">
                  PKR {savedInvoiceResult.totalPayable?.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs dark:bg-slate-900 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Amount Paid Today</span>
                <p className="text-sm font-bold font-mono text-emerald-600 mt-0.5">
                  PKR {savedInvoiceResult.actualPaid?.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs dark:bg-slate-900 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Account Receivable</span>
                <p className="text-sm font-bold font-mono text-rose-600 mt-0.5">
                  PKR {savedInvoiceResult.remainingReceivable?.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs dark:bg-slate-900 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 font-bold uppercase">FBR POS Fee</span>
                <p className="text-sm font-bold font-mono text-slate-500 mt-0.5">
                  Rs 0.00 (Uncharged)
                </p>
              </div>
            </div>

            {/* Accounts Receivable Ledger Confirmation Banner */}
            {savedInvoiceResult.remainingReceivable > 0 && (
              <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 text-xs text-rose-950 dark:bg-rose-950/30 dark:border-rose-900 dark:text-rose-200 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-rose-800 dark:text-rose-300">
                  <BadgeAlert className="h-4 w-4" />
                  <span>Accounts Receivable Ledger Posting:</span>
                </div>
                <p className="text-rose-800/90 dark:text-rose-300/80 leading-relaxed">
                  <strong>PKR {savedInvoiceResult.remainingReceivable?.toLocaleString()}</strong> has been debited to <strong>Accounts Receivable (Account 1100)</strong> and recorded in <strong>{savedInvoiceResult.customerName}</strong>'s balance sheet ledger.
                </p>
              </div>
            )}

            {/* FBR Status Explanation */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              <span className="font-semibold text-slate-800 dark:text-slate-200">FBR Invoicing Status: </span>
              {savedInvoiceResult.remainingReceivable > 0 ? (
                <span className="text-amber-800 dark:text-amber-300 font-medium">
                  This is a Partial / Credit sale. Under tax safeguards, it is placed in the FBR Tab under <strong>"Awaiting Full Payment"</strong> and blocked from FBR transmission until the customer pays the remaining balance of PKR {savedInvoiceResult.remainingReceivable?.toLocaleString()}.
                </span>
              ) : (
                <span>
                  This invoice is fully paid and queued in your FBR Invoicing tab under <strong>"Ready to Hit FBR"</strong> without upfront POS fee charges.
                </span>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push("/sales")}
              >
                View Sales Invoices List
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setSavedInvoiceResult(null);
                    window.location.reload();
                  }}
                >
                  Create Another Invoice
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  className="bg-indigo-600 hover:bg-indigo-700 shadow-sm"
                  onClick={() => router.push("/compliance/fbr")}
                >
                  <Zap className="h-4 w-4 mr-1.5" /> Open FBR Invoicing Tab
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
