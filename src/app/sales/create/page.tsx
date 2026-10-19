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
  Package,
  Layers,
  FileText,
  CheckCheck,
  Loader2,
  Calendar,
  Globe,
  Search,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
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
  cnic?: string;
  province?: string;
  address?: string | null;
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

const COMMON_FBR_HS_CODES = [
  { code: "5201.0090", label: "Raw Cotton (Ginned / Textile)" },
  { code: "5208.1100", label: "Woven Fabrics of Cotton (Unbleached / Gray Cloth)" },
  { code: "5208.3200", label: "Woven Fabrics of Cotton (Dyed / Printed)" },
  { code: "5202.9900", label: "Cotton Waste / Yarn Waste" },
  { code: "5205.1100", label: "Cotton Yarn (Single Cotton Combed/Carded)" },
  { code: "6109.1000", label: "T-Shirts, Singlets & Vests (Cotton)" },
  { code: "6203.4200", label: "Men's / Boys' Trousers & Pants (Cotton)" },
  { code: "1001.1900", label: "Wheat / Grain / Agricultural Produce" },
  { code: "1006.3000", label: "Semi-Milled or Wholly Milled Rice" },
  { code: "1701.9900", label: "Refined White Sugar" },
  { code: "1515.9000", label: "Cooking Oil & Edible Vegetable Oils" },
  { code: "3401.1100", label: "Toilet Soap & Organic Surface-Active Products" },
  { code: "7207.1210", label: "Semi-Finished Products of Iron / Steel Billets" },
  { code: "8517.1390", label: "Smartphones & Cellular Mobile Phones" },
  { code: "8517.7900", label: "Parts of Telephone Sets & Mobile Accessories" },
  { code: "8471.3010", label: "Portable Digital Computers / Laptops" },
  { code: "2710.1240", label: "White Spirit / Solvents / Petrochemicals" },
  { code: "9812.0000", label: "Telecommunication & Information Technology Services" },
  { code: "9901.0000", label: "General Commercial Merchandise" },
];

function formatHsCodeInput(val: string): string {
  const cleaned = val.trim().replace(/[^0-9.]/g, "");
  if (!cleaned) return val;
  if (cleaned.includes(".")) {
    const [head, tail] = cleaned.split(".");
    return `${head.slice(0, 4)}.${(tail || "0000").padEnd(4, "0").slice(0, 4)}`;
  }
  if (cleaned.length === 8) {
    return `${cleaned.slice(0, 4)}.${cleaned.slice(4, 8)}`;
  }
  if (cleaned.length === 6) {
    return `${cleaned.slice(0, 4)}.${cleaned.slice(4, 6)}00`;
  }
  if (cleaned.length === 4) {
    return `${cleaned}.0000`;
  }
  return cleaned;
}

export default function CreateSalePage() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const { user, activeCompany, branches, selectedBranch, activeBranchId, isBranchLocked } = useAuth();
  const isAccountingOnly = activeCompany?.packageType === "ACCOUNTING_ONLY" || (activeCompany?.enabledModules && !activeCompany.enabledModules.includes("compliance"));
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
  const [tenantName, setTenantName] = useState<string>("SmartBiz Enterprise");
  const [orgHsCode, setOrgHsCode] = useState<string>(activeCompany?.defaultHsCode || "5201.0090");
  const [invoiceNumberPreview, setInvoiceNumberPreview] = useState<string>("INV-2026-AUTO");
  const [loadingOptions, setLoadingOptions] = useState<boolean>(true);

  useEffect(() => {
    if (activeCompany?.defaultHsCode) {
      setOrgHsCode(activeCompany.defaultHsCode);
    }
  }, [activeCompany?.defaultHsCode]);

  // Form Header State
  const [customerId, setCustomerId] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("Walk in (Walk in)");
  const [walkInName, setWalkInName] = useState<string>("");
  const [walkInPhone, setWalkInPhone] = useState<string>("");
  const [buyerTaxStatus, setBuyerTaxStatus] = useState<BuyerTaxStatus>("EXEMPT");
  const [fbrInvoiceType, setFbrInvoiceType] = useState<"TIER1_POS" | "DIGITAL_INVOICING">("TIER1_POS");
  const [registeredFbrType, setRegisteredFbrType] = useState<"TIER1_POS" | "DIGITAL_INVOICING" | "BOTH">("TIER1_POS");
  const [postToFbr, setPostToFbr] = useState<boolean>(true);
  const [date, setDate] = useState<string>(new Date().toISOString().split("T")[0]);

  // Line Items State
  const [items, setItems] = useState<SaleLineItem[]>([]);

  // Payment & Settlement State
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("FULL");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [overallDiscount, setOverallDiscount] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [dueDate, setDueDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Submission State & Validation
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearFieldError = (fieldName: string) => {
    setFieldErrors((prev) => {
      if (!prev[fieldName]) return prev;
      const copy = { ...prev };
      delete copy[fieldName];
      return copy;
    });
  };

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
    hsCode: activeCompany?.defaultHsCode || "5201.0090",
  });

  // Manage & Delete Catalog Products State
  const [isManageProductsModalOpen, setIsManageProductsModalOpen] = useState<boolean>(false);
  const [manageProductSearch, setManageProductSearch] = useState<string>("");
  const [isDeleteProductConfirmOpen, setIsDeleteProductConfirmOpen] = useState<boolean>(false);
  const [productToDelete, setProductToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeletingProduct, setIsDeletingProduct] = useState<boolean>(false);
  const [productDeleteMessage, setProductDeleteMessage] = useState<string | null>(null);

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
    cnic: "",
    province: "Sindh",
    address: "",
  });

  // Success Modal State
  const [savedInvoiceResult, setSavedInvoiceResult] = useState<any | null>(null);

  // Multi-Piece Split Invoicing State
  const [invoiceSplitMode, setInvoiceSplitMode] = useState<"CONSOLIDATED" | "SPLIT_PER_PIECE">("CONSOLIDATED");
  const [isSplitDecisionModalOpen, setIsSplitDecisionModalOpen] = useState<boolean>(false);
  const [batchSavedResult, setBatchSavedResult] = useState<any | null>(null);
  const [isProcessingSplit, setIsProcessingSplit] = useState<boolean>(false);

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

      // Tax rate based on Buyer Tax Status (Digital Invoicing strictly disallows 0% tax)
      const isDiMode = fbrInvoiceType === "DIGITAL_INVOICING";
      const tr = isDiMode ? 18 : (currentBuyerStatus === "EXEMPT" ? 0 : 18);
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
    [orgHsCode, fbrInvoiceType]
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

        const fetchFbr = isAccountingOnly
          ? Promise.resolve({ success: false })
          : smartFetch("/api/compliance/fbr", { headers, ttlMs: 15000 }).catch(() => ({}));

        const [metaJson, prodJson, custJson, fbrJson] = await Promise.all([
          smartFetch("/api/products?meta=true", { headers, ttlMs: 60000 }).catch(() => ({})),
          smartFetch("/api/products?limit=100&status=ACTIVE", { headers, ttlMs: 25000 }).catch(() => ({})),
          smartFetch("/api/customers", { headers, ttlMs: 0, skipCache: true }).catch(() => ({})),
          fetchFbr,
        ]);

        if (!isAccountingOnly && (fbrJson as any)?.success && (fbrJson as any)?.data?.config) {
          const cfg = (fbrJson as any).data.config;
          const regType: "TIER1_POS" | "DIGITAL_INVOICING" | "BOTH" =
            cfg.integrationType === "DIGITAL_INVOICING"
              ? "DIGITAL_INVOICING"
              : cfg.integrationType === "BOTH"
              ? "BOTH"
              : "TIER1_POS";
          setRegisteredFbrType(regType);
          if (regType === "DIGITAL_INVOICING") {
            setFbrInvoiceType("DIGITAL_INVOICING");
          } else {
            setFbrInvoiceType("TIER1_POS");
          }
        }

        // 1. Organization & Categories
        let currentOrgHs = activeCompany?.defaultHsCode || "5201.0090";
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

        // 2. Products (active only)
        const prodList: ProductOption[] = (prodJson.products || prodJson.data || []).filter(
          (p: any) => p.status !== "ARCHIVED" && p.isActive !== false
        );
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
              productName: "Commercial Merchandise Item",
              sku: "SKU-ITEM-01",
              hsCode: currentOrgHs,
              uom: "PCS",
              quantity: 1,
              unitPrice: 1000,
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
    const effectiveStatus: BuyerTaxStatus =
      fbrInvoiceType === "DIGITAL_INVOICING" && newStatus === "EXEMPT" ? "REGISTERED" : newStatus;
    setBuyerTaxStatus(effectiveStatus);
    setItems((prevItems) => prevItems.map((it) => recalculateItem(it, effectiveStatus)));
  };

  // When switching to Digital Invoicing mode, automatically ensure no 0% tax exists
  useEffect(() => {
    if (fbrInvoiceType === "DIGITAL_INVOICING") {
      if (buyerTaxStatus === "EXEMPT") {
        setBuyerTaxStatus("REGISTERED");
      }
      setItems((prevItems) =>
        prevItems.map((it) => {
          if (!it.taxRate || it.taxRate <= 0) {
            return recalculateItem(it, "REGISTERED");
          }
          return it;
        })
      );
    }
  }, [fbrInvoiceType, buyerTaxStatus, recalculateItem]);

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

    if (selectedValue === "__MANAGE_PRODUCTS__") {
      setIsManageProductsModalOpen(true);
      return;
    }

    if (!selectedValue) {
      setItems((prev) => {
        const next = [...prev];
        next[index] = {
          ...next[index],
          productId: "",
          availableStock: 0,
        };
        return next;
      });
      return;
    }

    const prod = products.find((p) => p.id === selectedValue);
    if (!prod) return;

    clearFieldError(`item_${index}_product`);
    clearFieldError("items");

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

  // Filter products for the Manage Products modal
  const filteredManageProducts = useMemo(() => {
    if (!manageProductSearch.trim()) return products;
    const q = manageProductSearch.toLowerCase().trim();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.hsCode && p.hsCode.toLowerCase().includes(q))
    );
  }, [products, manageProductSearch]);

  // Execute Product Deletion from Catalog
  const handleConfirmDeleteProduct = async () => {
    if (!productToDelete) return;
    setIsDeletingProduct(true);
    try {
      const headers: Record<string, string> = {};
      if (activeCompany?.id) headers["x-business-id"] = activeCompany.id;

      const res = await fetch(`/api/products/${productToDelete.id}`, {
        method: "DELETE",
        headers,
      });
      const data = await res.json();
      if (data.success) {
        invalidateCache("/api/products");
        // Remove from local products list
        setProducts((prev) => prev.filter((p) => p.id !== productToDelete.id));

        // Clear selection in any line items that were using this product
        setItems((prev) =>
          prev.map((it) =>
            it.productId === productToDelete.id
              ? { ...it, productId: "", availableStock: 0 }
              : it
          )
        );

        setProductDeleteMessage(
          language === "ur"
            ? `پروڈکٹ '${productToDelete.name}' کیٹلاگ سے کامیابی کے ساتھ ہٹا دی گئی ہے۔`
            : `Product '${productToDelete.name}' removed from catalog.`
        );
        setTimeout(() => setProductDeleteMessage(null), 3500);
      } else {
        alert(data.error || "Failed to delete product.");
      }
    } catch (err: any) {
      alert(err.message || "Network error deleting product.");
    } finally {
      setIsDeletingProduct(false);
      setIsDeleteProductConfirmOpen(false);
      setProductToDelete(null);
    }
  };

  // Update Line Item Fields
  const handleItemFieldChange = (index: number, field: keyof SaleLineItem, value: any) => {
    if (field === "productName") clearFieldError(`item_${index}_product`);
    if (field === "hsCode") clearFieldError(`item_${index}_hscode`);
    if (field === "quantity") clearFieldError(`item_${index}_quantity`);
    if (field === "unitPrice") clearFieldError(`item_${index}_price`);
    if (field === "discountPercent") clearFieldError(`item_${index}_disc`);
    clearFieldError("items");

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

  // Auto-format HS Code on blur if digits entered
  const handleHsCodeBlur = (index: number) => {
    setItems((prev) => {
      const next = [...prev];
      const raw = next[index]?.hsCode;
      if (raw) {
        const formatted = formatHsCodeInput(raw);
        if (formatted !== raw) {
          next[index] = recalculateItem(
            {
              ...next[index],
              hsCode: formatted,
            },
            buyerTaxStatus
          );
        }
      }
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

  // POS Service Charge (SRO 1006(I)): Rs. 1.00 for Retail POS; Rs. 0.00 for Digital Invoicing, Local Sale & Pure Accounting
  const posFee = (isAccountingOnly || !postToFbr) ? 0.0 : (fbrInvoiceType === "TIER1_POS" ? 1.0 : 0.0);

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

  // Total Pieces across all line items
  const totalPieces = useMemo(() => {
    return items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
  }, [items]);

  // Reset form to initial clean state immediately after creation
  const resetForm = useCallback(() => {
    setCustomerId("");
    const isDi = fbrInvoiceType === "DIGITAL_INVOICING";
    setCustomerName(isDi ? "" : "Walk in (Walk in)");
    setWalkInName("");
    setWalkInPhone("");
    const initialTaxStatus: BuyerTaxStatus = isDi ? "REGISTERED" : "EXEMPT";
    setBuyerTaxStatus(initialTaxStatus);
    setOverallDiscount(0);
    setNotes("");
    setPaymentMode("FULL");
    setPaymentMethod("CASH");
    setDate(new Date().toISOString().split("T")[0]);
    setInvoiceSplitMode("CONSOLIDATED");
    setError(null);

    if (products.length > 0) {
      const defaultProd = products[0];
      const initialItem = recalculateItem(
        {
          productId: defaultProd.id,
          productName: defaultProd.name,
          sku: defaultProd.sku || "SKU-" + defaultProd.id,
          hsCode: defaultProd.hsCode || orgHsCode,
          uom: (defaultProd.uom || defaultProd.unit || "PCS").toUpperCase(),
          quantity: 1,
          unitPrice: Number(defaultProd.sellingPrice || 0),
          discountPercent: 0,
          availableStock: Number(defaultProd.currentStock || 10),
        },
        initialTaxStatus
      );
      setItems([initialItem]);
    } else {
      setItems([]);
    }
  }, [products, orgHsCode, recalculateItem, fbrInvoiceType]);

  // Change payment mode handler
  const handleSetPaymentMode = (mode: PaymentMode) => {
    setPaymentMode(mode);
    if (mode === "FULL") {
      setPaidAmount(totalPayable);
      setWalkInName("");
      setWalkInPhone("");
    } else if (mode === "CREDIT") {
      setPaidAmount(0);
      if (!dueDate) {
        const defDue = new Date();
        defDue.setDate(defDue.getDate() + 7);
        setDueDate(defDue.toISOString().split("T")[0]);
      }
    } else if (mode === "PARTIAL") {
      setPaidAmount(Math.round(totalPayable / 2)); // Default 50% deposit
      if (!dueDate) {
        const defDue = new Date();
        defDue.setDate(defDue.getDate() + 7);
        setDueDate(defDue.toISOString().split("T")[0]);
      }
    }
  };

  // Quick Customer Creation Handler
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustomerSaveError(null);
    const name = newCustomerForm.name.trim();
    if (!name) {
      setCustomerSaveError("Customer name is required.");
      return;
    }

    const lowerName = name.toLowerCase();
    if (lowerName === "walk in" || lowerName === "walk-in" || lowerName.startsWith("walk in") || lowerName.startsWith("walk-in")) {
      setCustomerSaveError("Walk-in customer name is not permitted in Digital Invoicing.");
      return;
    }

    const cleanNtn = newCustomerForm.ntn.trim().replace(/[^0-9]/g, "");
    const cleanCnic = newCustomerForm.cnic.trim().replace(/[^0-9]/g, "");

    if (fbrInvoiceType === "DIGITAL_INVOICING") {
      if (newCustomerForm.taxStatus === "REGISTERED") {
        if (!cleanNtn || cleanNtn.length < 7) {
          setCustomerSaveError("Valid 7-8 digit NTN is required for Registered Taxpayer in Digital Invoicing.");
          return;
        }
      } else {
        if (cleanCnic.length !== 13 && cleanNtn.length < 7) {
          setCustomerSaveError("Valid 13-digit CNIC (or 7-8 digit NTN) is required for Digital Invoicing.");
          return;
        }
      }
    }

    try {
      setIsSavingCustomer(true);
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name,
          businessName: newCustomerForm.businessName.trim() || null,
          phone: newCustomerForm.phone.trim() || null,
          email: newCustomerForm.email.trim() || null,
          address: newCustomerForm.address.trim() || null,
          ntn: cleanNtn || null,
          cnic: cleanCnic || null,
          province: newCustomerForm.province || "Sindh",
          taxStatus: newCustomerForm.taxStatus,
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
      const effStatus = fbrInvoiceType === "DIGITAL_INVOICING" && newCustomerForm.taxStatus === "EXEMPT"
        ? "REGISTERED"
        : newCustomerForm.taxStatus;
      setBuyerTaxStatus(effStatus);
      handleBuyerTaxStatusChange(effStatus);
      setIsAddCustomerModalOpen(false);
      setNewCustomerForm({
        name: "",
        businessName: "",
        phone: "",
        email: "",
        taxStatus: fbrInvoiceType === "DIGITAL_INVOICING" ? "REGISTERED" : "UNREGISTERED",
        ntn: "",
        cnic: "",
        province: "Sindh",
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
      const prodHeaders: Record<string, string> = { "Content-Type": "application/json" };
      if (activeCompany?.id) prodHeaders["x-business-id"] = activeCompany.id;
      const res = await fetch("/api/products", {
        method: "POST",
        headers: prodHeaders,
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

  // Form Validation
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // 1. Invoice Date
    if (!date) {
      errors["date"] = t("Invoice date is required", "انوائس کی تاریخ منتخب کریں");
    }

    // 2. Line Items
    if (!items || items.length === 0) {
      errors["items"] = t("Please add at least one line item to generate the invoice.", "بل بنانے کے لیے کم از کم ایک آئٹم شامل کریں۔");
    } else {
      items.forEach((it, idx) => {
        if (!it.productName.trim()) {
          errors[`item_${idx}_product`] = t(`Item #${idx + 1} name is required`, `آئٹم #${idx + 1} کا نام درج کریں`);
        }
        if (Number(it.quantity) <= 0 || isNaN(Number(it.quantity))) {
          errors[`item_${idx}_quantity`] = t(`Item #${idx + 1} quantity must be greater than 0`, `آئٹم #${idx + 1} کی مقدار 0 سے زیادہ ہونی چاہیے`);
        }
        if (Number(it.unitPrice) < 0 || isNaN(Number(it.unitPrice))) {
          errors[`item_${idx}_price`] = t(`Item #${idx + 1} price cannot be negative`, `آئٹم #${idx + 1} کی قیمت منفی نہیں ہو سکتی`);
        }
        if (Number(it.discountPercent) < 0 || Number(it.discountPercent) > 100) {
          errors[`item_${idx}_disc`] = t("Discount must be between 0% and 100%", "ڈسکاؤنٹ 0 سے 100% کے درمیان ہونا چاہیے");
        }
      });
    }

    // 3. Customer & Receivable balance validation
    const actualPaid = paymentMode === "CREDIT" ? 0 : Number(paidAmount || 0);
    const remaining = Math.max(0, totalPayable - actualPaid);

    // Digital Invoicing Strict Rules (No walk-in, valid NTN/CNIC required, no 0% tax)
    if (!isAccountingOnly && postToFbr && fbrInvoiceType === "DIGITAL_INVOICING") {
      if (!customerId) {
        errors["customer"] = t(
          "FBR Digital Invoicing requires a registered buyer. Walk-in customers are not allowed in Digital Invoicing.",
          "ایف بی آر ڈیجیٹل انوائسنگ کے لیے رجسٹرڈ کسٹمر لازمی ہے۔ واک اِن کسٹمر کی اجازت نہیں ہے۔"
        );
      } else {
        const cust = customers.find((c) => c.id === customerId);
        const cleanNtn = (cust?.ntn || "").replace(/[^0-9]/g, "");
        const cleanCnic = ((cust as any)?.cnic || "").replace(/[^0-9]/g, "");
        if (cleanNtn.length < 7 && cleanCnic.length !== 13) {
          errors["customer"] = t(
            `Customer "${cust?.name || ""}" must have a valid 7-8 digit NTN or 13-digit CNIC for FBR Digital Invoicing.`,
            `ڈیجیٹل انوائسنگ کے لیے کسٹمر کا درست 7-8 ہندسوں پر مشتمل NTN یا 13 ہندسوں کا CNIC ہونا لازمی ہے۔`
          );
        }
      }

      // Strictly disallow 0% tax in Digital Invoicing
      items.forEach((it, idx) => {
        if (!it.taxRate || Number(it.taxRate) <= 0) {
          errors[`item_${idx}_tax`] = t(
            `Digital Invoicing does not permit 0% tax. Line item #${idx + 1} ("${it.productName}") must have a valid sales tax rate (e.g. 18%).`,
            `ڈیجیٹل انوائسنگ میں 0% ٹیکس کی اجازت نہیں ہے۔ آئٹم #${idx + 1} ("${it.productName}") پر ٹیکس ریٹ ہونا لازمی ہے۔`
          );
        }
      });

      // Strictly require valid HS/PCT Code in Digital Invoicing (prevent irreversible PRAL errors)
      items.forEach((it, idx) => {
        const hsClean = (it.hsCode || "").trim().replace(/[^0-9]/g, "");
        if (!hsClean || hsClean.length < 4) {
          errors[`item_${idx}_hscode`] = t(
            `Line item #${idx + 1} requires a valid 4-to-8 digit FBR HS/PCT code (e.g. 5201.0090, 5208.1100).`,
            `آئٹم #${idx + 1} کے لیے درست ایف بی آر ایچ ایس کوڈ درج کرنا لازمی ہے۔`
          );
        }
      });
    } else {
      if (!customerId && remaining > 0) {
        if (!walkInName.trim()) {
          errors["walkInName"] = t("Customer name is required for credit balance", "ادھار / باقی رقم کے لیے خریدار کا نام درج کرنا لازمی ہے");
        }
        if (!walkInPhone.trim()) {
          errors["walkInPhone"] = t("Customer phone number is required for credit follow-up", "باقی رقم فالو اپ کے لیے خریدار کا فون نمبر درج کریں");
        }
      }

      if (buyerTaxStatus === "REGISTERED" && customerId) {
        const cust = customers.find((c) => c.id === customerId);
        if (cust && !cust.ntn && !(cust as any).cnic) {
          errors["customer"] = t("NTN or CNIC is required for Registered Taxpayer", "رجسٹرڈ خریدار کے لیے کسٹمر کا NTN یا CNIC ہونا لازمی ہے");
        }
      }
    }

    // 4. Payment validations
    if (actualPaid < 0) {
      errors["paidAmount"] = t("Paid amount cannot be negative", "ادا کردہ رقم منفی نہیں ہو سکتی");
    }
    if (actualPaid > totalPayable) {
      errors["paidAmount"] = t("Paid amount cannot exceed total bill", "ادا کردہ رقم کل بل سے زیادہ نہیں ہو سکتی");
    }
    if (paymentMode === "PARTIAL" && actualPaid <= 0) {
      errors["paidAmount"] = t("Please specify paid amount for partial payment", "جزوی ادائیگی کے لیے ادا شدہ رقم درج کریں");
    }
    if (Number(overallDiscount) < 0) {
      errors["overallDiscount"] = t("Discount cannot be negative", "ڈسکاؤنٹ رقم منفی نہیں ہو سکتی");
    }
    if (Number(overallDiscount) > grossSubtotal) {
      errors["overallDiscount"] = t("Discount cannot exceed subtotal", "اضافی ڈسکاؤنٹ کل رقم سے زیادہ نہیں ہو سکتا");
    }

    // 5. Due date validation
    if (remaining > 0 && dueDate && date && dueDate < date) {
      errors["dueDate"] = t("Due date cannot be earlier than invoice date", "رقم وصولی کی تاریخ بل کی تاریخ کے بعد ہونی چاہیے");
    }

    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      const firstErrorMessage = Object.values(errors)[0];
      setError(firstErrorMessage);
      return false;
    }

    return true;
  };

  // Submit & Save Invoice (With full Accounts Receivable & Multi-Piece Split Invoicing support)
  const handleSubmitInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    // Digital Invoicing (FBR DI / B2B) ALWAYS generates a single consolidated invoice.
    // Multi-piece split invoicing is strictly for Retail POS (TIER1_POS) where items are sold in discrete pieces (PCS).
    const isDigitalInvoice = fbrInvoiceType === "DIGITAL_INVOICING" || activeCompany?.packageType === "FBR_INVOICING_ONLY";
    const isDiscretePieceUnit = items.every((it) => {
      const u = (it.uom || "").toUpperCase();
      return u === "PCS" || u === "PIECE" || u === "PIECES" || u === "UNIT" || u === "UNITS" || !u;
    });

    if (!isDigitalInvoice && isDiscretePieceUnit && totalPieces > 1) {
      setIsSplitDecisionModalOpen(true);
      return;
    }

    // Default single invoice submission
    await executeSubmit("CONSOLIDATED");
  };

  const executeSubmit = async (selectedMode: "CONSOLIDATED" | "SPLIT_PER_PIECE") => {
    setIsSplitDecisionModalOpen(false);
    setError(null);

    if (!validateForm()) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const actualPaid = paymentMode === "CREDIT" ? 0 : Number(paidAmount || 0);
    const remaining = Math.max(0, totalPayable - actualPaid);

    const finalCustomerName = !customerId
      ? (remaining > 0 && walkInName.trim() ? `${walkInName.trim()} (Walk-in)` : "Walk in (Walk in)")
      : (customerName || "Walk in (Walk in)");

    const operatingBranchId = isBranchLocked ? (user?.branchId || null) : (saleBranchId || effectiveBranch || null);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (activeCompany?.id) headers["x-business-id"] = activeCompany.id;
    if (operatingBranchId) headers["x-branch-id"] = operatingBranchId;

    if (selectedMode === "CONSOLIDATED") {
      try {
        setSubmitting(true);

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
            uom: it.uom || "PCS",
            unitPrice: it.unitPrice,
            discount: it.discountAmount,
            taxRate: it.taxRate,
            hsCode: it.hsCode ? it.hsCode.trim() : (orgHsCode || "5201.0090"),
          })),
          overallDiscount: Number(overallDiscount || 0),
          taxAmount: gstAmount + furtherTaxAmount,
          salesTax: gstAmount,
          furtherTax: furtherTaxAmount,
          extraTax: 0,
          posFee: (isAccountingOnly || !postToFbr) ? 0 : posFee,
          invoiceType: (isAccountingOnly || !postToFbr) ? "STANDARD" : fbrInvoiceType,
          paidAmount: actualPaid,
          paymentMethod: actualPaid > 0 ? paymentMethod : "CREDIT",
          dueDate: remaining > 0 && dueDate ? new Date(dueDate) : undefined,
          notes: notes.trim() || undefined,
          fbrStatus: (isAccountingOnly || !postToFbr) ? "NOT_APPLICABLE" : "PENDING",
          fbrInvoiceNumber: null,
          fbrQrCode: null,
        };

        const res = await fetch("/api/sales", {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });

        const json = await res.json();
        if (!json.success) {
          throw new Error(json.error || "Failed to post sales invoice");
        }

        invalidateCache();

        // Immediately refetch customer balances so dropdown reflects new ledger balance hand-to-hand
        try {
          const custRes = await fetch("/api/customers", { headers, cache: "no-store" });
          const custData = await custRes.json();
          if (custData.success && Array.isArray(custData.data)) {
            setCustomers(custData.data);
          }
        } catch (e) {
          console.error("Failed to refresh customers post-sale:", e);
        }

        // Save data for modal view BEFORE clearing form
        const modalData = {
          ...json.data,
          grossSubtotal,
          totalDiscount,
          taxableAmount,
          gstAmount,
          furtherTaxAmount,
          posFee: (isAccountingOnly || !postToFbr) ? 0 : posFee,
          fbrInvoiceType,
          postToFbr: !isAccountingOnly && postToFbr,
          totalPayable,
          actualPaid,
          remainingReceivable: remaining,
          paymentMode,
          items: [...items],
          customerName: finalCustomerName,
          paymentMethod: actualPaid > 0 ? paymentMethod : "CREDIT",
          date,
        };

        // IMMEDIATELY RESET FORM: completely clear previous data so user can never accidentally duplicate!
        resetForm();

        // Show Save & Queued Dialog
        setSavedInvoiceResult(modalData);
      } catch (err: any) {
        setError(err.message || "Failed to save sales invoice");
      } finally {
        setSubmitting(false);
      }
    } else {
      // selectedMode === "SPLIT_PER_PIECE"
      try {
        setSubmitting(true);
        setIsProcessingSplit(true);

        const splitPayloads: any[] = [];
        let pieceIndex = 0;

        for (const it of items) {
          const qty = Math.max(1, Math.round(Number(it.quantity || 1)));
          const unitPrice = Number(it.unitPrice || 0);
          const itemDiscPerPiece = round2(toDecimal(it.discountAmount || 0).div(qty)).toNumber();
          const overallDiscPerPiece = round2(toDecimal(Number(overallDiscount || 0)).div(totalPieces)).toNumber();

          const pieceTaxable = Math.max(0, unitPrice - itemDiscPerPiece - overallDiscPerPiece);
          const pieceGst = buyerTaxStatus === "EXEMPT" ? 0 : round2(toDecimal(pieceTaxable).mul(0.18)).toNumber();
          const pieceFurther = buyerTaxStatus === "UNREGISTERED" ? round2(toDecimal(pieceTaxable).mul(0.03)).toNumber() : 0;
          const piecePosFee = (isAccountingOnly || !postToFbr) ? 0 : (fbrInvoiceType === "TIER1_POS" ? 1.0 : 0.0);
          const pieceTotal = pieceTaxable + pieceGst + pieceFurther + piecePosFee;

          let piecePaid = 0;
          if (paymentMode === "FULL") {
            piecePaid = pieceTotal;
          } else if (paymentMode === "CREDIT") {
            piecePaid = 0;
          } else {
            piecePaid = round2(toDecimal(actualPaid).div(totalPieces)).toNumber();
          }

          for (let q = 0; q < qty; q++) {
            pieceIndex++;
            splitPayloads.push({
              branchId: operatingBranchId,
              createdById: user?.userId,
              createdByName: user?.name,
              date: new Date(date),
              customerId: customerId || null,
              customerName: finalCustomerName,
              customerPhone: !customerId && remaining > 0 && walkInPhone.trim() ? walkInPhone.trim() : undefined,
              buyerTaxStatus,
              items: [
                {
                  productId: it.productId || (products[0]?.id ?? "prod-default"),
                  productName: it.productName,
                  quantity: 1,
                  uom: it.uom || "PCS",
                  unitPrice: it.unitPrice,
                  discount: itemDiscPerPiece,
                  taxRate: it.taxRate,
                  hsCode: it.hsCode ? it.hsCode.trim() : (orgHsCode || "5201.0090"),
                },
              ],
              overallDiscount: overallDiscPerPiece,
              taxAmount: pieceGst + pieceFurther,
              salesTax: pieceGst,
              furtherTax: pieceFurther,
              extraTax: 0,
              posFee: piecePosFee,
              invoiceType: (isAccountingOnly || !postToFbr) ? "STANDARD" : fbrInvoiceType,
              paidAmount: piecePaid,
              paymentMethod: piecePaid > 0 ? paymentMethod : "CREDIT",
              dueDate: remaining > 0 && dueDate ? new Date(dueDate) : undefined,
              notes: notes.trim()
                ? `${notes.trim()} (Piece ${pieceIndex}/${totalPieces})`
                : `Piece ${pieceIndex} of ${totalPieces}`,
              fbrStatus: (isAccountingOnly || !postToFbr) ? "NOT_APPLICABLE" : "PENDING",
              fbrInvoiceNumber: null,
              fbrQrCode: null,
            });
          }
        }

        const res = await fetch("/api/sales", {
          method: "POST",
          headers,
          body: JSON.stringify({
            bulk: true,
            invoices: splitPayloads,
          }),
        });

        const json = await res.json();
        if (!json.success) {
          throw new Error(json.error || "Failed to post split invoices");
        }

        invalidateCache();

        // Immediately refetch customer balances so dropdown reflects new ledger balance hand-to-hand
        try {
          const custRes = await fetch("/api/customers", { headers, cache: "no-store" });
          const custData = await custRes.json();
          if (custData.success && Array.isArray(custData.data)) {
            setCustomers(custData.data);
          }
        } catch (e) {
          console.error("Failed to refresh customers post-split sale:", e);
        }

        const createdList: any[] = json.data || [];
        const firstInv = createdList[0];
        const lastInv = createdList[createdList.length - 1];

        const batchModalData = {
          totalCount: createdList.length,
          firstInvoiceNumber: firstInv?.invoiceNumber || "INV-001",
          lastInvoiceNumber: lastInv?.invoiceNumber || `INV-${String(createdList.length).padStart(3, "0")}`,
          totalPieces,
          totalAmount: totalPayable,
          actualPaid,
          remainingReceivable: remaining,
          customerName: finalCustomerName,
          paymentMode,
          postToFbr: !isAccountingOnly && postToFbr,
          invoices: createdList,
        };

        // IMMEDIATELY RESET FORM: clear all fields so background is clean!
        resetForm();

        // Show Batch Success Modal
        setBatchSavedResult(batchModalData);
      } catch (err: any) {
        setError(err.message || "Failed to save split sales invoices");
      } finally {
        setSubmitting(false);
        setIsProcessingSplit(false);
      }
    }
  };

  if (loadingOptions) {
    return (
      <div className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:px-8 space-y-6">
        <BrandPageLoader
          message="Loading Sales Invoice Terminal..."
          submessage={
            isAccountingOnly
              ? "Fetching customer directory, inventory catalog, and price list..."
              : "Fetching customer directory, inventory catalog, and FBR fiscal rules..."
          }
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8 space-y-6">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <Link
              href="/sales"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                {isAccountingOnly ? t("New Sales Invoice", "نئی سیلز انوائس") : t("Sales Tax Invoice", "سیلز ٹیکس انوائس")}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {activeCompany?.name || "SmartBiz Accounting"}
                {selectedBranch?.name ? ` • ${selectedBranch.name}` : ""}
              </p>
            </div>
          </div>

          {/* Compact Branch Switcher if user has multiple branches */}
          {branches.length > 1 && !isBranchLocked && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">{t("Branch:", "برانچ:")}</span>
              <select
                value={saleBranchId}
                onChange={(e) => setSaleBranchId(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    🏢 {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Product Catalog Action Notification Banner */}
        {productDeleteMessage && (
          <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-900 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{productDeleteMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setProductDeleteMessage(null)}
              className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 text-xs font-bold"
            >
              ✕
            </button>
          </div>
        )}

        <form onSubmit={handleSubmitInvoice} className="space-y-6 pb-20 lg:pb-0">
          {/* Top Card: Invoice Number, Date, Customer (Buyer), Buyer Tax Status */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Column 1: INVOICE NUMBER */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t("Invoice Number", "انوائس نمبر")}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    value={invoiceNumberPreview}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300 cursor-not-allowed"
                  />
                  <Lock className="absolute right-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                </div>
              </div>

              {/* Column 2: INVOICE DATE */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    <span>{t("Invoice Date", "تاریخ")}</span>
                  </span>
                  {date !== new Date().toISOString().split("T")[0] && (
                    <button
                      type="button"
                      onClick={() => setDate(new Date().toISOString().split("T")[0])}
                      className="text-[11px] font-semibold text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {t("Today", "آج")}
                    </button>
                  )}
                </div>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    clearFieldError("date");
                  }}
                  className={`w-full rounded-xl border bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 dark:bg-slate-900 dark:text-slate-200 ${
                    fieldErrors["date"]
                      ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500 bg-rose-50/20"
                      : "border-slate-200 focus:border-blue-500 focus:ring-blue-500 dark:border-slate-800"
                  }`}
                />
                {fieldErrors["date"] && (
                  <p className="text-[10px] font-semibold text-rose-500">{fieldErrors["date"]}</p>
                )}
              </div>

              {/* Column 3: CUSTOMER (BUYER) * */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span>
                    {t("Customer", "گاہک / کسٹمر")} <span className="text-rose-500">*</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerSaveError(null);
                      setIsAddCustomerModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400"
                  >
                    <Plus className="h-3 w-3" /> {t("+ Add Customer", "نیا کسٹمر")}
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
                      clearFieldError("customer");
                      if (!val) {
                        if (fbrInvoiceType === "DIGITAL_INVOICING") {
                          setCustomerName("");
                          return;
                        }
                        setCustomerName("Walk in (Walk in)");
                        handleBuyerTaxStatusChange("EXEMPT");
                        if (!isAccountingOnly && registeredFbrType === "BOTH") {
                          setFbrInvoiceType("TIER1_POS");
                        }
                      } else {
                        const c = customers.find((cust) => cust.id === val);
                        if (c) {
                          setCustomerName(c.name);
                          if (c.taxStatus === "REGISTERED" || c.taxStatus === "EXEMPT" || c.taxStatus === "UNREGISTERED") {
                            const effStatus: BuyerTaxStatus =
                              fbrInvoiceType === "DIGITAL_INVOICING" && c.taxStatus === "EXEMPT"
                                ? "REGISTERED"
                                : (c.taxStatus as BuyerTaxStatus);
                            handleBuyerTaxStatusChange(effStatus);
                          }
                          if (!isAccountingOnly && registeredFbrType === "BOTH") {
                            if (c.taxStatus === "REGISTERED" || (c as any).ntn) {
                              setFbrInvoiceType("DIGITAL_INVOICING");
                            } else {
                              setFbrInvoiceType("TIER1_POS");
                            }
                          }
                        }
                      }
                    }}
                    className={`w-full rounded-xl border bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 dark:bg-slate-900 dark:text-slate-200 ${
                      fieldErrors["customer"]
                        ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500 bg-rose-50/20"
                        : "border-slate-200 focus:border-blue-500 focus:ring-blue-500 dark:border-slate-800"
                    }`}
                  >
                    {fbrInvoiceType === "DIGITAL_INVOICING" ? (
                      <option value="" disabled>
                        {t("-- Select Registered Customer (Walk-in Prohibited in DI) --", "-- رجسٹرڈ کسٹمر منتخب کریں (DI میں واک اِن منع ہے) --")}
                      </option>
                    ) : (
                      <option value="">{t("Walk-in Customer (Exempt)", "عام گاہک (Walk-in) — چھوٹ")}</option>
                    )}
                    {[...customers]
                      .sort((a, b) => Number(b.currentBalance || 0) - Number(a.currentBalance || 0))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {Number(c.currentBalance || 0) > 0
                            ? `⚠️ ${c.name} ${c.businessName ? `(${c.businessName})` : c.phone ? `(${c.phone})` : ""} — ${c.ntn ? `NTN: ${c.ntn}` : (c as any).cnic ? `CNIC: ${(c as any).cnic}` : c.taxStatus || "Customer"} (Balance Due: Rs ${Number(c.currentBalance).toLocaleString()})`
                            : `✅ ${c.name} ${c.businessName ? `(${c.businessName})` : c.phone ? `(${c.phone})` : ""} — ${c.ntn ? `NTN: ${c.ntn}` : (c as any).cnic ? `CNIC: ${(c as any).cnic}` : c.taxStatus || "Customer"} (All Clear: Rs 0)`}
                        </option>
                      ))}
                    <option value="__ADD_NEW__" className="font-bold text-blue-600">
                      ➕ {t("+ Add New Customer", "+ نیا کسٹمر بنائیں")}
                    </option>
                  </select>
                </div>

                {/* Selected Customer Pill Preview & Ledger Balance */}
                <div className="flex items-center justify-between rounded-lg border border-slate-200/80 bg-slate-50 px-2.5 py-1 text-[11px] dark:border-slate-800 dark:bg-slate-800/40">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {customerName || (fbrInvoiceType === "DIGITAL_INVOICING" ? "No Customer Selected" : "Walk in")}
                    </span>
                    {selectedCustomer?.ntn ? (
                      <span className="rounded bg-blue-100 px-1.5 py-0.2 text-[9px] font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                        NTN: {selectedCustomer.ntn}
                      </span>
                    ) : (selectedCustomer as any)?.cnic ? (
                      <span className="rounded bg-slate-200 px-1.5 py-0.2 text-[9px] font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                        CNIC: {(selectedCustomer as any).cnic}
                      </span>
                    ) : null}
                    <span className="rounded bg-slate-200 px-1.5 py-0.2 text-[10px] font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                      {buyerTaxStatus === "EXEMPT" ? "Exempt" : buyerTaxStatus === "REGISTERED" ? "Taxpayer" : "Non-taxpayer"}
                    </span>
                  </div>
                  {selectedCustomer ? (
                    Number(selectedCustomer.currentBalance || 0) > 0 ? (
                      <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300">
                        ⚠️ Due: Rs {Number(selectedCustomer.currentBalance).toLocaleString()}
                      </span>
                    ) : (
                      <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300">
                        ✅ No Dues: Rs 0
                      </span>
                    )
                  ) : (
                    <span className="text-[10px] text-slate-500">
                      {fbrInvoiceType === "DIGITAL_INVOICING" ? "Registration Required" : "Walk-in"}
                    </span>
                  )}
                </div>

                {fbrInvoiceType === "DIGITAL_INVOICING" && !customerId && (
                  <div className="mt-1 flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                    <span>⚠️ Digital Invoicing requires a registered customer with NTN or CNIC.</span>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerSaveError(null);
                        setIsAddCustomerModalOpen(true);
                      }}
                      className="font-bold underline text-blue-700 dark:text-blue-400 shrink-0 ml-2"
                    >
                      + Register Buyer
                    </button>
                  </div>
                )}

                {fieldErrors["customer"] && (
                  <p className="text-[10px] font-semibold text-rose-500 mt-1">
                    ⚠️ {fieldErrors["customer"]}
                  </p>
                )}

                {/* Walk-in Customer Details: ONLY displayed when Partial / Credit Sale has remaining balance in POS mode */}
                {!customerId && remainingReceivable > 0 && fbrInvoiceType !== "DIGITAL_INVOICING" && (
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

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-0.5">
                          Buyer / Walk-in Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={walkInName}
                          onChange={(e) => {
                            setWalkInName(e.target.value);
                            clearFieldError("walkInName");
                          }}
                          placeholder="e.g. Muhammad Kashif"
                          className={`w-full rounded-lg border bg-white px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 ${
                            fieldErrors["walkInName"] || (!walkInName.trim() && remainingReceivable > 0)
                              ? "border-rose-400 focus:border-rose-600 focus:ring-rose-600 bg-rose-50/30"
                              : "border-slate-300 focus:border-indigo-600 focus:ring-indigo-600"
                          } dark:bg-slate-900 dark:border-slate-700 dark:text-white`}
                        />
                        {fieldErrors["walkInName"] && (
                          <p className="text-[10px] font-semibold text-rose-500 mt-0.5">
                            {fieldErrors["walkInName"]}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-0.5">
                          Mobile / WhatsApp # <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={walkInPhone}
                          onChange={(e) => {
                            setWalkInPhone(e.target.value);
                            clearFieldError("walkInPhone");
                          }}
                          placeholder="e.g. 0300-1234567"
                          className={`w-full rounded-lg border bg-white px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 ${
                            fieldErrors["walkInPhone"]
                              ? "border-rose-400 focus:border-rose-600 focus:ring-rose-600 bg-rose-50/30"
                              : "border-slate-300 focus:border-indigo-600 focus:ring-indigo-600"
                          } dark:bg-slate-900 dark:border-slate-700 dark:text-white`}
                        />
                        {fieldErrors["walkInPhone"] && (
                          <p className="text-[10px] font-semibold text-rose-500 mt-0.5">
                            {fieldErrors["walkInPhone"]}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Column 3: BUYER TAX STATUS */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t("Tax Category", "ٹیکس کیٹیگری")}
                </label>
                <select
                  value={buyerTaxStatus}
                  onChange={(e) => handleBuyerTaxStatusChange(e.target.value as BuyerTaxStatus)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                >
                  {fbrInvoiceType !== "DIGITAL_INVOICING" && (
                    <option value="EXEMPT">{t("Exempt / Regular Consumer (0% Tax)", "عام کسٹمر / چھوٹ (0% Tax)")}</option>
                  )}
                  <option value="REGISTERED">{t("Registered Taxpayer (18% Sales Tax)", "رجسٹرڈ ٹیکس دہندہ (18% Sales Tax)")}</option>
                  <option value="UNREGISTERED">{t("Unregistered Business (18% + 3% Further Tax)", "غیر رجسٹرڈ بزنس (18% + 3% Further Tax)")}</option>
                </select>
              </div>
            </div>

            {/* FBR Reporting Toggle - Only for Full Suite */}
            {!isAccountingOnly && (
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className={`h-4 w-4 ${postToFbr ? "text-emerald-600" : "text-slate-400"}`} />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {t("FBR Reporting:", "FBR میں رپورٹنگ:")}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPostToFbr(true)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                      postToFbr
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>{t("✓ FBR Invoice (Transmit)", "✓ FBR انوائس (بھیجیں)")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPostToFbr(false)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                      !postToFbr
                        ? "bg-slate-800 text-white shadow-xs dark:bg-slate-700"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    <span>{t("Local Invoice Only", "صرف لوکل بل (Local Sale)")}</span>
                  </button>

                  {postToFbr && (
                    <div className="flex items-center gap-1 ml-2 border-l border-slate-200 pl-3 dark:border-slate-700">
                      {registeredFbrType === "TIER1_POS" && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-indigo-50 border border-indigo-200 text-indigo-700 dark:bg-indigo-950/60 dark:border-indigo-800 dark:text-indigo-300">
                          <Building2 className="w-3.5 h-3.5" />
                          <span>🏪 FBR Mode: Retail POS (+Rs. 1)</span>
                        </span>
                      )}
                      {registeredFbrType === "DIGITAL_INVOICING" && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-blue-50 border border-blue-200 text-blue-700 dark:bg-blue-950/60 dark:border-blue-800 dark:text-blue-300">
                          <Globe className="w-3.5 h-3.5" />
                          <span>🌐 FBR Mode: Digital Invoicing</span>
                        </span>
                      )}
                      {registeredFbrType === "BOTH" && (
                        <>
                          <button
                            type="button"
                            onClick={() => setFbrInvoiceType("TIER1_POS")}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                              fbrInvoiceType === "TIER1_POS"
                                ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
                                : "text-slate-500 hover:text-slate-800"
                            }`}
                          >
                            Retail POS (+Rs. 1)
                          </button>
                          <button
                            type="button"
                            onClick={() => setFbrInvoiceType("DIGITAL_INVOICING")}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                              fbrInvoiceType === "DIGITAL_INVOICING"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                                : "text-slate-500 hover:text-slate-800"
                            }`}
                          >
                            Digital Invoicing
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Line Items Table Section */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
            {/* Table Header Section Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-white">
                  {t("Items List", "اشیاء کی تفصیل")}
                </h2>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {items.length} {items.length === 1 ? "Item" : "Items"}
                </span>
              </div>

              <Button
                type="button"
                onClick={handleAddItem}
                variant="primary"
                size="sm"
                className="bg-blue-600 text-xs font-semibold hover:bg-blue-700 shadow-sm"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> {t("+ Add Item", "+ آئٹم شامل کریں")}
              </Button>
            </div>

            {/* Global items error if list is empty */}
            {fieldErrors["items"] && (
              <div className="bg-rose-50 border-b border-rose-200 px-5 py-2.5 text-xs font-bold text-rose-700 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{fieldErrors["items"]}</span>
              </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800/40 dark:border-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="py-3 pl-4 pr-2 w-10 text-center">#</th>
                    <th className="py-3 px-3 min-w-[240px]">{t("Product / Item", "آئٹم کا نام")}</th>
                    <th className="py-3 px-2 w-32 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span>{t("HS Code", "ایچ ایس کوڈ")}</span>
                        <span className="text-[9px] px-1 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-mono font-bold">FBR</span>
                      </div>
                    </th>
                    <th className="py-3 px-2 w-20 text-center">{t("UOM", "یونٹ")}</th>
                    <th className="py-3 px-2 w-20 text-center">{t("Qty", "تعداد")}</th>
                    <th className="py-3 px-2 w-32 text-right">{t("Price", "قیمت")}</th>
                    <th className="py-3 px-2 w-20 text-center">{t("Discount %", "ڈسکاؤنٹ %")}</th>
                    <th className="py-3 px-2 w-16 text-center">{t("Tax %", "ٹیکس %")}</th>
                    <th className="py-3 px-3 w-28 text-right">{t("Taxable", "ٹیکس ایبل")}</th>
                    <th className="py-3 px-3 w-32 text-right">{t("Total", "کل رقم")}</th>
                    <th className="py-3 pl-2 pr-4 w-10 text-center"></th>
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
                          placeholder={t("Type item name or pick from catalog...", "آئٹم کا نام لکھیں یا لسٹ سے چنیں...")}
                          className={`w-full rounded-lg border px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none dark:bg-slate-900 dark:text-white ${
                            fieldErrors[`item_${idx}_product`]
                              ? "border-rose-400 focus:border-rose-600 bg-rose-50/20"
                              : "border-slate-200 focus:border-blue-500 dark:border-slate-700"
                          }`}
                        />
                        {fieldErrors[`item_${idx}_product`] && (
                          <p className="text-[10px] font-semibold text-rose-500">
                            {fieldErrors[`item_${idx}_product`]}
                          </p>
                        )}

                        {/* Product Dropdown Selector with Quick Add & Delete */}
                        <div className="flex items-center gap-1.5">
                          <select
                            value={it.productId}
                            onChange={(e) => handleProductSelect(idx, e.target.value)}
                            className="w-full rounded-md border border-slate-200 bg-slate-50/80 px-2 py-1 text-[11px] text-slate-600 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 truncate"
                          >
                            <option value="">{t("Select from catalog...", "کیٹلاگ سے منتخب کریں...")}</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} {p.sku ? `(${p.sku})` : ""} — Rs. {p.sellingPrice?.toLocaleString()} ({p.currentStock ?? 0} {p.uom || p.unit || "pcs"})
                              </option>
                            ))}
                            <option value="__ADD_NEW__" className="font-bold text-blue-600">
                              ➕ {t("+ Create New Product", "+ نیا پروڈکٹ بنائیں")}
                            </option>
                            <option value="__MANAGE_PRODUCTS__" className="font-bold text-rose-600 dark:text-rose-400">
                              🗑️ {t("Manage / Delete Catalog Products...", "پروڈکٹس مینیج یا ڈیلیٹ کریں...")}
                            </option>
                          </select>

                          <button
                            type="button"
                            title={t("Add New Product to Catalog", "کیٹلاگ میں نیا پروڈکٹ شامل کریں")}
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
                            className="rounded-md border border-blue-200 bg-blue-50 p-1 text-blue-600 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300 shrink-0"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>

                          {it.productId && it.productId !== "" && (
                            <button
                              type="button"
                              title={t("Delete this product from catalog", "اس پروڈکٹ کو کیٹلاگ سے حذف کریں")}
                              onClick={() => {
                                const found = products.find((p) => p.id === it.productId);
                                setProductToDelete({
                                  id: it.productId,
                                  name: found?.name || it.productName || "Product",
                                });
                                setIsDeleteProductConfirmOpen(true);
                              }}
                              className="rounded-md border border-rose-200 bg-rose-50 p-1 text-rose-600 hover:bg-rose-100 hover:text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-400 shrink-0 transition"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="text-[10px] text-slate-400 flex items-center gap-2">
                          {it.availableStock > 0 && (
                            <span>{t("Stock:", "اسٹاک:")} <strong className="text-slate-600 dark:text-slate-300">{it.availableStock} {it.uom}</strong></span>
                          )}
                          {it.sku && <span>SKU: {it.sku}</span>}
                          {it.hsCode && <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">HS: {it.hsCode}</span>}
                        </div>
                      </td>

                      {/* HS / PCT CODE */}
                      <td className="py-3 px-2 text-center align-top pt-4">
                        <div className="space-y-1">
                          <input
                            type="text"
                            value={it.hsCode || ""}
                            onChange={(e) => handleItemFieldChange(idx, "hsCode", e.target.value)}
                            onBlur={() => handleHsCodeBlur(idx)}
                            placeholder={orgHsCode || "5201.0090"}
                            list="fbr-hs-code-list"
                            title={t("FBR Harmonized Tariff / PCT Code (e.g. 5208.1100, 5201.0090)", "ایف بی آر ایچ ایس کوڈ")}
                            className={`w-full rounded-lg border px-2 py-1.5 text-center font-mono text-xs font-semibold focus:outline-none dark:bg-slate-900 ${
                              fieldErrors[`item_${idx}_hscode`]
                                ? "border-rose-400 focus:border-rose-600 bg-rose-50/20 text-rose-700 dark:text-rose-300"
                                : "border-slate-200 bg-white text-slate-800 focus:border-blue-500 dark:border-slate-700 dark:text-slate-200"
                            }`}
                          />
                          {fieldErrors[`item_${idx}_hscode`] && (
                            <p className="text-[9px] font-semibold text-rose-500 text-center leading-tight">
                              {fieldErrors[`item_${idx}_hscode`]}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* UOM */}
                      <td className="py-3 px-2 text-center align-top pt-4">
                        <select
                          value={it.uom}
                          onChange={(e) => handleItemFieldChange(idx, "uom", e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center text-xs font-semibold text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                          <option value="PCS">PCS (Pieces / Units)</option>
                          <option value="KG">KG (Kilograms)</option>
                          <option value="MTR">MTR (Meters)</option>
                          <option value="LTR">LTR (Liters)</option>
                          <option value="BOX">BOX (Boxes / Cartons)</option>
                          <option value="PACK">PACK (Packets)</option>
                          <option value="TON">TON (Metric Tons)</option>
                          <option value="BAG">BAG (Bags / Bori)</option>
                          <option value="DOZEN">DOZEN (12 Units)</option>
                          <option value="GRAM">GRAM (Grams)</option>
                          <option value="PAIR">PAIR (Pairs)</option>
                          <option value="ROLL">ROLL (Rolls / Thaan)</option>
                          <option value="SQM">SQM (Square Meters)</option>
                          <option value="UNIT">UNIT (Numbers)</option>
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
                          className={`w-full rounded-lg border px-2 py-1.5 text-center text-xs font-bold text-slate-900 focus:outline-none dark:bg-slate-900 dark:text-white ${
                            fieldErrors[`item_${idx}_quantity`]
                              ? "border-rose-400 focus:border-rose-600 bg-rose-50/30"
                              : "border-slate-200 focus:border-blue-500 dark:border-slate-700"
                          }`}
                        />
                        {fieldErrors[`item_${idx}_quantity`] && (
                          <p className="text-[9px] font-semibold text-rose-500 text-center mt-0.5">
                            {fieldErrors[`item_${idx}_quantity`]}
                          </p>
                        )}
                      </td>

                      {/* UNIT PRICE (PKR) */}
                      <td className="py-3 px-2 text-right align-top pt-4">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={it.unitPrice || ""}
                          onChange={(e) => handleItemFieldChange(idx, "unitPrice", e.target.value)}
                          className={`w-full rounded-lg border px-2.5 py-1.5 text-right text-xs font-semibold tabular-nums text-slate-900 focus:outline-none dark:bg-slate-900 dark:text-white ${
                            fieldErrors[`item_${idx}_price`]
                              ? "border-rose-400 focus:border-rose-600 bg-rose-50/30"
                              : "border-slate-200 focus:border-blue-500 dark:border-slate-700"
                          }`}
                        />
                        {fieldErrors[`item_${idx}_price`] && (
                          <p className="text-[9px] font-semibold text-rose-500 text-right mt-0.5">
                            {fieldErrors[`item_${idx}_price`]}
                          </p>
                        )}
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
                          className={`w-full rounded-lg border px-2 py-1.5 text-center text-xs font-medium text-slate-800 focus:outline-none dark:bg-slate-900 dark:text-white ${
                            fieldErrors[`item_${idx}_disc`]
                              ? "border-rose-400 focus:border-rose-600 bg-rose-50/30"
                              : "border-slate-200 focus:border-blue-500 dark:border-slate-700"
                          }`}
                        />
                        {fieldErrors[`item_${idx}_disc`] && (
                          <p className="text-[9px] font-semibold text-rose-500 text-center mt-0.5">
                            {fieldErrors[`item_${idx}_disc`]}
                          </p>
                        )}
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

            {/* FBR Harmonized System (HS / PCT) Codes Datalist */}
            <datalist id="fbr-hs-code-list">
              {COMMON_FBR_HS_CODES.map((hs) => (
                <option key={hs.code} value={hs.code}>
                  {hs.code} — {hs.label}
                </option>
              ))}
            </datalist>
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleSetPaymentMode("FULL")}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition ${
                      paymentMode === "FULL"
                        ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 shadow-xs"
                        : "border-slate-200 bg-white hover:bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900"
                    }`}
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <div>
                      <div className="font-bold text-xs">{t("Full Payment", "مکمل کیش / بینک")}</div>
                      <span className="text-[10px] text-slate-400">{t("100% Paid (Cash/Bank)", "مکمل ادا شدہ")}</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSetPaymentMode("PARTIAL")}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition ${
                      paymentMode === "PARTIAL"
                        ? "border-amber-500 bg-amber-50/60 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 shadow-xs"
                        : "border-slate-200 bg-white hover:bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900"
                    }`}
                  >
                    <Wallet className="h-4 w-4 text-amber-600 shrink-0" />
                    <div>
                      <div className="font-bold text-xs">{t("Partial Payment", "کچھ رقم وصول (ایڈوانس)")}</div>
                      <span className="text-[10px] text-slate-400">{t("Advance / Partial Deposit", "جزوی ایڈوانس")}</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSetPaymentMode("CREDIT")}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition ${
                      paymentMode === "CREDIT"
                        ? "border-rose-500 bg-rose-50/60 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200 shadow-xs"
                        : "border-slate-200 bg-white hover:bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900"
                    }`}
                  >
                    <CreditCard className="h-4 w-4 text-rose-600 shrink-0" />
                    <div>
                      <div className="font-bold text-xs">{t("Full Credit (Udhaar)", "مکمل ادھار")}</div>
                      <span className="text-[10px] text-slate-400">{t("100% Receivable", "100% ادھار رقم")}</span>
                    </div>
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

                {/* Due Date / Payment Promise Date for Receivables */}
                {remainingReceivable > 0 && (
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3.5 text-xs dark:border-indigo-900/60 dark:bg-indigo-950/30">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 font-bold text-indigo-950 dark:text-indigo-200">
                        <Calendar className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        <span>{t("Payment Promise Date (Due Date):", "رقم وصولی کی وعدہ تاریخ:")}</span>
                      </div>
                      <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                        Receivable: Rs {remainingReceivable.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type="date"
                          value={dueDate}
                          onChange={(e) => {
                            setDueDate(e.target.value);
                            clearFieldError("dueDate");
                          }}
                          min={date || new Date().toISOString().split("T")[0]}
                          className={`w-full rounded-lg border px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 dark:bg-slate-900 dark:text-white ${
                            fieldErrors["dueDate"]
                              ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20 bg-rose-50/20"
                              : "border-indigo-300 bg-white focus:ring-indigo-500/20 dark:border-indigo-800"
                          }`}
                        />
                        {fieldErrors["dueDate"] && (
                          <p className="text-[10px] font-semibold text-rose-500 mt-1">
                            {fieldErrors["dueDate"]}
                          </p>
                        )}
                      </div>

                      {/* Quick Presets */}
                      <div className="flex items-center gap-1 flex-wrap">
                        {[
                          { label: "Today", days: 0 },
                          { label: "+3 Days", days: 3 },
                          { label: "+7 Days", days: 7 },
                          { label: "+15 Days", days: 15 },
                          { label: "+30 Days", days: 30 },
                        ].map((preset) => {
                          const target = new Date();
                          target.setDate(target.getDate() + preset.days);
                          const targetStr = target.toISOString().split("T")[0];
                          const isSelected = dueDate === targetStr;
                          return (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => {
                                setDueDate(targetStr);
                                clearFieldError("dueDate");
                              }}
                              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                                isSelected
                                  ? "bg-indigo-600 text-white shadow-xs"
                                  : "border border-indigo-200 bg-white text-indigo-800 hover:bg-indigo-100/70 dark:border-indigo-800 dark:bg-slate-900 dark:text-indigo-300"
                              }`}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <p className="mt-2 text-[10px] text-indigo-700/80 dark:text-indigo-400">
                      💡 {t("On this date, a customer receivable reminder will appear on the dashboard.", "اس تاریخ پر ڈیش بورڈ اور نوٹیفکیشن الرٹ میں گاہک کا نام اور وصولی کی یاد دہانی پاپ ہوگی۔")}
                    </p>
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

                {/* Payment Terms & Remarks */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    {t("Payment Terms / Remarks", "ادائیگی کی شرائط / ریمارکس")}
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={remainingReceivable > 0 ? (language === "ur" ? "مثلاً: 15 دن میں بقایا رقم ادا کریں گے" : "e.g. Will pay remaining balance in 15 days") : (language === "ur" ? "اختیاری ریمارکس / نوٹس..." : "Optional remarks / notes...")}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                  />
                </div>
              </div>
            </div>

            {/* Right Column (5 cols): TAX & PAYMENT SUMMARY */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    {t("Payment Summary", "بل کی تفصیل")}
                  </h3>
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
                  <div className="space-y-1 py-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Additional Special Discount (PKR)</span>
                      <input
                        type="number"
                        min="0"
                        value={overallDiscount || ""}
                        onChange={(e) => {
                          setOverallDiscount(Number(e.target.value) || 0);
                          clearFieldError("overallDiscount");
                        }}
                        placeholder="0"
                        className={`w-24 rounded-lg border px-2 py-1 text-right text-xs font-semibold focus:outline-none dark:bg-slate-800 dark:text-white ${
                          fieldErrors["overallDiscount"]
                            ? "border-rose-400 focus:border-rose-500 bg-rose-50/20"
                            : "border-slate-200 focus:border-blue-500 dark:border-slate-700"
                        }`}
                      />
                    </div>
                    {fieldErrors["overallDiscount"] && (
                      <p className="text-[10px] font-semibold text-rose-500 text-right">
                        {fieldErrors["overallDiscount"]}
                      </p>
                    )}
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

                  {/* FBR Compliance Fee - Only for Full Suite when postToFbr is true */}
                  {!isAccountingOnly && postToFbr && (
                    fbrInvoiceType === "TIER1_POS" ? (
                      <div className="flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50/80 p-2.5 text-indigo-900 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-200">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold">FBR POS Fee [SRO 1006(I)]</span>
                          <span className="rounded bg-indigo-200/80 px-1.5 py-0.5 text-[10px] font-bold text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                            Retail POS
                          </span>
                        </div>
                        <span className="font-bold tabular-nums text-xs text-indigo-700 dark:text-indigo-300">
                          PKR 1.00
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 text-slate-700 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold">FBR Digital Invoicing Fee</span>
                          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                            Digital Invoicing (B2B)
                          </span>
                        </div>
                        <span className="font-mono text-[11px] text-slate-500">
                          Rs 0.00 (Statutory Tax % only)
                        </span>
                      </div>
                    )
                  )}

                  {!isAccountingOnly && !postToFbr && (
                    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 text-slate-700 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold">FBR Reporting</span>
                        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                          Local Sale Only
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-slate-500">
                        Not posted to FBR
                      </span>
                    </div>
                  )}
                </div>

                {/* Total Payable Block */}
                <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white">
                        Total Payable
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {isAccountingOnly || !postToFbr
                          ? "Net goods + sales taxes"
                          : fbrInvoiceType === "TIER1_POS"
                          ? "Net goods + sales taxes + Rs. 1 POS fee"
                          : "Net goods + federal sales taxes"}
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
                  <div className="space-y-1">
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
                            const val = Number(e.target.value) || 0;
                            setPaidAmount(val);
                            clearFieldError("paidAmount");
                            if (val === totalPayable) setPaymentMode("FULL");
                            else if (val === 0) setPaymentMode("CREDIT");
                            else setPaymentMode("PARTIAL");
                          }}
                          className={`w-32 rounded-lg border px-2.5 py-1 text-right text-xs font-bold text-slate-900 focus:outline-none dark:bg-slate-900 dark:text-white disabled:bg-slate-100 disabled:opacity-60 ${
                            fieldErrors["paidAmount"]
                              ? "border-rose-400 focus:border-rose-500 bg-rose-50/20"
                              : "border-slate-300 focus:border-blue-500 dark:border-slate-700"
                          }`}
                        />
                      </div>
                    </div>
                    {fieldErrors["paidAmount"] && (
                      <p className="text-[10px] font-semibold text-rose-500 text-right">
                        {fieldErrors["paidAmount"]}
                      </p>
                    )}
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

                {/* Prominent Error Banner above Submit Button */}
                {(error || Object.keys(fieldErrors).length > 0) && (
                  <div className="rounded-xl border border-rose-300 bg-rose-50 p-3.5 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200 space-y-1.5 shadow-xs">
                    <div className="flex items-center gap-2 font-bold text-rose-700 dark:text-rose-300">
                      <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                      <span>{t("Please correct the following errors:", "براہ کرم درج ذیل غلطیوں کو درست کریں:")}</span>
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 text-[11px] pl-1 text-rose-700 dark:text-rose-300">
                      {error && <li>{error}</li>}
                      {Object.entries(fieldErrors)
                        .filter(([_, msg]) => msg !== error)
                        .map(([k, msg]) => (
                          <li key={k}>{msg}</li>
                        ))}
                    </ul>
                  </div>
                )}

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
                    {submitting
                      ? (isProcessingSplit ? t(`Generating ${totalPieces} Invoices...`, `بل بن رہے ہیں (${totalPieces} Invoices)...`) : t("Saving Invoice...", "بل محفوظ ہو رہا ہے..."))
                      : t("Save Invoice", "بل محفوظ کریں")}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Sticky Bottom Action Bar */}
          <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between gap-3 border-t border-slate-200/90 bg-white/95 px-4 py-3 shadow-2xl backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 lg:hidden">
            <div className="min-w-0 flex-1">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {totalPieces} {totalPieces === 1 ? "Item" : "Items"} • {t("Total", "کل رقم")}
              </span>
              <span className="truncate text-base font-black tabular-nums text-slate-900 dark:text-white">
                PKR {totalPayable.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <Button
              type="submit"
              variant="primary"
              size="md"
              className="shrink-0 bg-blue-600 px-5 py-2.5 font-bold shadow-md hover:bg-blue-700"
              isLoading={submitting}
            >
              <CheckCircle2 className="mr-1.5 h-4 w-4" />
              {submitting ? t("Saving...", "محفوظ ہو رہا ہے...") : t("Save Invoice", "بل محفوظ کریں")}
            </Button>
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
                <option value="PCS">PCS (Pieces / Units)</option>
                <option value="KG">KG (Kilograms)</option>
                <option value="MTR">MTR (Meters)</option>
                <option value="LTR">LTR (Liters)</option>
                <option value="BOX">BOX (Boxes / Cartons)</option>
                <option value="PACK">PACK (Packets)</option>
                <option value="TON">TON (Metric Tons)</option>
                <option value="BAG">BAG (Bags / Bori)</option>
                <option value="DOZEN">DOZEN (12 Units)</option>
                <option value="GRAM">GRAM (Grams)</option>
                <option value="PAIR">PAIR (Pairs)</option>
                <option value="ROLL">ROLL (Rolls / Thaan)</option>
                <option value="SQM">SQM (Square Meters)</option>
                <option value="UNIT">UNIT (Numbers)</option>
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

            {!isAccountingOnly && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  HS / PCT Code (FBR Fiscal Compliance)
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    value={newProductForm.hsCode}
                    onChange={(e) => setNewProductForm({ ...newProductForm, hsCode: e.target.value })}
                    placeholder={orgHsCode || "5201.0090"}
                    list="fbr-hs-code-list"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Select from tariff list or enter any custom 8-digit FBR PCT code (e.g. <strong>5201.0090</strong>, <strong>5208.1100</strong>). Default: <strong>{orgHsCode}</strong>
                </p>
              </div>
            )}
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

      {/* MANAGE / DELETE CATALOG PRODUCTS MODAL */}
      <Modal
        isOpen={isManageProductsModalOpen}
        onClose={() => {
          setIsManageProductsModalOpen(false);
          setManageProductSearch("");
        }}
        title={t("Manage Catalog Products", "کیٹلاگ پروڈکٹس مینیج / ڈیلیٹ کریں")}
        description={t(
          "Delete or remove unwanted/test products so your sales catalog stays clean and unbloated.",
          "غیر ضروری یا ٹیسٹ پروڈکٹس کو یہاں سے ڈیلیٹ کریں تاکہ لسٹ صاف رہے۔"
        )}
        maxWidth="lg"
      >
        <div className="space-y-4">
          {productDeleteMessage && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              {productDeleteMessage}
            </div>
          )}

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={manageProductSearch}
              onChange={(e) => setManageProductSearch(e.target.value)}
              placeholder={t("Filter catalog products by name or SKU...", "نام یا SKU سے پروڈکٹ تلاش کریں...")}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Products List */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {filteredManageProducts.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                {manageProductSearch.trim() ? "No products matching your search." : "No products in catalog."}
              </div>
            ) : (
              filteredManageProducts.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                  <div className="min-w-0 pr-3">
                    <p className="font-bold text-xs text-slate-900 dark:text-white truncate">{p.name}</p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                      {p.sku && <span>SKU: {p.sku}</span>}
                      <span>•</span>
                      <span>Rs. {Number(p.sellingPrice || 0).toLocaleString()}</span>
                      <span>•</span>
                      <span>{p.currentStock ?? 0} {(p.uom || p.unit || "PCS").toUpperCase()}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isDeletingProduct}
                    onClick={() => {
                      setProductToDelete({ id: p.id, name: p.name });
                      setIsDeleteProductConfirmOpen(true);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-400 shrink-0 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>{t("Delete", "حذف کریں")}</span>
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsManageProductsModalOpen(false);
                setManageProductSearch("");
              }}
            >
              {t("Done", "مکمل")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* DELETE PRODUCT CONFIRMATION MODAL */}
      <Modal
        isOpen={isDeleteProductConfirmOpen}
        onClose={() => {
          if (!isDeletingProduct) {
            setIsDeleteProductConfirmOpen(false);
            setProductToDelete(null);
          }
        }}
        title={t("Confirm Delete Product", "پروڈکٹ ڈیلیٹ کرنے کی تصدیق")}
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 text-xs text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">
                {t(
                  `Are you sure you want to delete "${productToDelete?.name}"?`,
                  `کیا آپ واقعی "${productToDelete?.name}" کو ڈیلیٹ کرنا چاہتے ہیں؟`
                )}
              </p>
              <p className="text-[11px] text-rose-800/90 dark:text-rose-300 leading-relaxed">
                {t(
                  "This will remove the product from your catalog and sales dropdowns so it doesn't take up unnecessary space.",
                  "یہ پروڈکٹ کیٹلاگ اور لسٹ سے ہٹا دی جائے گی تاکہ لسٹ میں غیر ضروری جگہ نہ لے۔"
                )}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isDeletingProduct}
              onClick={() => {
                setIsDeleteProductConfirmOpen(false);
                setProductToDelete(null);
              }}
            >
              {t("Cancel", "منسوخ")}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isDeletingProduct}
              onClick={handleConfirmDeleteProduct}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              {isDeletingProduct ? (
                <span className="flex items-center gap-1.5">
                  <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent animate-spin rounded-full" />
                  {t("Deleting...", "حذف ہو رہا ہے...")}
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("Yes, Delete Product", "ہاں، ڈیلیٹ کریں")}
                </span>
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* QUICK ADD CUSTOMER MODAL */}
      <Modal
        isOpen={isAddCustomerModalOpen}
        onClose={() => setIsAddCustomerModalOpen(false)}
        title="+ Register New Customer (Digital Invoicing Ready)"
        description="Add a verified client profile with NTN/CNIC tax credentials and immediately select them for this sales invoice"
      >
        <form onSubmit={handleSaveCustomer} className="space-y-4">
          {customerSaveError && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs font-medium text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{customerSaveError}</span>
            </div>
          )}

          {fbrInvoiceType === "DIGITAL_INVOICING" && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
              <span className="font-bold">🌐 FBR Digital Invoicing Requirement:</span> Walk-in / anonymous buyers are prohibited. Register the legal customer/business name along with either a 7-8 digit NTN (for registered) or 13-digit CNIC (for unregistered), and tax jurisdiction province.
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Customer / Contact Person <span className="text-rose-500">*</span>
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
                Business / Company Name
              </label>
              <input
                type="text"
                value={newCustomerForm.businessName}
                onChange={(e) => setNewCustomerForm({ ...newCustomerForm, businessName: e.target.value })}
                placeholder="e.g. Mehmood Traders"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Buyer Tax Status <span className="text-rose-500">*</span>
              </label>
              <select
                value={newCustomerForm.taxStatus}
                onChange={(e) => setNewCustomerForm({ ...newCustomerForm, taxStatus: e.target.value as BuyerTaxStatus })}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="UNREGISTERED">Unregistered Buyer (CNIC Required)</option>
                <option value="REGISTERED">Sales Tax Registered (NTN Required)</option>
                {fbrInvoiceType !== "DIGITAL_INVOICING" && (
                  <option value="EXEMPT">Exempt Supplies (0% Tax)</option>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Province (FBR Jurisdiction) <span className="text-rose-500">*</span>
              </label>
              <select
                value={newCustomerForm.province}
                onChange={(e) => setNewCustomerForm({ ...newCustomerForm, province: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="Sindh">Sindh</option>
                <option value="Punjab">Punjab</option>
                <option value="Khyber Pakhtunkhwa">Khyber Pakhtunkhwa</option>
                <option value="Balochistan">Balochistan</option>
                <option value="Islamabad Capital Territory">Islamabad Capital Territory</option>
                <option value="Gilgit-Baltistan">Gilgit-Baltistan</option>
                <option value="Azad Jammu & Kashmir">Azad Jammu & Kashmir</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                {newCustomerForm.taxStatus === "REGISTERED"
                  ? "NTN Number (7-8 digits) *"
                  : "NTN (Optional if CNIC provided)"}
              </label>
              <input
                type="text"
                value={newCustomerForm.ntn}
                onChange={(e) => setNewCustomerForm({ ...newCustomerForm, ntn: e.target.value })}
                placeholder="e.g. 1234567-8"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                {newCustomerForm.taxStatus === "UNREGISTERED" && fbrInvoiceType === "DIGITAL_INVOICING"
                  ? "CNIC (13 digits without dashes) *"
                  : "CNIC (13 digits without dashes)"}
              </label>
              <input
                type="text"
                value={newCustomerForm.cnic}
                onChange={(e) => setNewCustomerForm({ ...newCustomerForm, cnic: e.target.value })}
                placeholder="e.g. 4210112345671"
                maxLength={15}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Phone Number
              </label>
              <input
                type="text"
                value={newCustomerForm.phone}
                onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                placeholder="0300 1234567"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Email
              </label>
              <input
                type="email"
                value={newCustomerForm.email}
                onChange={(e) => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })}
                placeholder="buyer@domain.com"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Complete Business Address
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

      {/* MULTI-ITEM INVOICING DECISION ASK MODAL (POS ONLY) */}
      <Modal
        isOpen={isSplitDecisionModalOpen}
        onClose={() => setIsSplitDecisionModalOpen(false)}
        title={t("Select Invoicing Mode for Multi-Item Sale", "انوائس جنریشن کا طریقہ منتخب کریں")}
        description={t(`Choose whether to create a single invoice or separate invoices per ${(items[0]?.uom || "PCS").toUpperCase() === "PCS" ? "piece" : "unit"}`, `ایک مشترکہ بل یا ہر ${(items[0]?.uom || "PCS").toUpperCase()} کا الگ بل منتخب کریں`)}
        maxWidth="lg"
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/80 p-4 text-xs text-indigo-950 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200 flex items-start gap-3">
            <Package className="h-5 w-5 text-indigo-600 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="font-bold text-sm">
                {language === "ur"
                  ? `کل تعداد: ${totalPieces} ${(items[0]?.uom || "PCS").toUpperCase()} | کل رقم: PKR ${totalPayable.toLocaleString("en-PK", { minimumFractionDigits: 2 })}`
                  : `Total Quantity: ${totalPieces} ${(items[0]?.uom || "PCS").toUpperCase()} | Total Amount: PKR ${totalPayable.toLocaleString("en-PK", { minimumFractionDigits: 2 })}`}
              </p>
              <p className="text-[11px] text-indigo-800/90 dark:text-indigo-300 leading-relaxed">
                {language === "ur" ? (
                  <>آپ کے بل میں کل <strong>{totalPieces} {(items[0]?.uom || "PCS").toUpperCase()}</strong> شامل ہیں۔ کیا آپ ان تمام کا ایک ہی مشترکہ بل بنانا چاہتے ہیں یا ہر یونٹ کا الگ الگ انوائس جنریٹ کرنا چاہتے ہیں؟</>
                ) : (
                  <>Your sale contains <strong>{totalPieces} {(items[0]?.uom || "PCS").toUpperCase()}</strong>. Would you like to create 1 single consolidated bill or generate separate invoices for each unit?</>
                )}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Option 1: Consolidated Single Invoice */}
            <button
              type="button"
              onClick={() => executeSubmit("CONSOLIDATED")}
              className="flex flex-col items-start p-4 rounded-2xl border-2 border-blue-500 bg-blue-50/50 hover:bg-blue-100/60 text-left transition group shadow-xs dark:bg-blue-950/30 dark:border-blue-700"
            >
              <div className="flex items-center gap-2 font-bold text-sm text-blue-950 dark:text-blue-200">
                <FileText className="h-5 w-5 text-blue-600 shrink-0" />
                <span>{t("Single Consolidated Invoice", "ایک ہی بل بنائیں")}</span>
              </div>
              <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 mt-0.5">
                {t("(1 Combined Invoice)", "(1 مشترکہ بل)")}
              </span>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                {language === "ur"
                  ? <>تمام {totalPieces} {(items[0]?.uom || "PCS").toUpperCase()} کا صرف <strong>1 مشترکہ بل</strong> بنے گا۔</>
                  : <>Only <strong>1 combined invoice</strong> will be created for all {totalPieces} items.</>}
              </p>
              {!isAccountingOnly && postToFbr && fbrInvoiceType === "TIER1_POS" && (
                <div className="mt-3 inline-flex items-center gap-1 rounded-lg bg-emerald-100/80 px-2.5 py-1 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  {t("💳 FBR POS Fee: PKR 1.00 (1 Bill)", "💳 FBR POS فیس: صرف PKR 1.00 (1 بل)")}
                </div>
              )}
            </button>

            {/* Option 2: Split per piece */}
            <button
              type="button"
              onClick={() => executeSubmit("SPLIT_PER_PIECE")}
              className="flex flex-col items-start p-4 rounded-2xl border-2 border-indigo-600 bg-indigo-50/60 hover:bg-indigo-100/60 text-left transition group shadow-xs dark:bg-indigo-950/40 dark:border-indigo-600"
            >
              <div className="flex items-center gap-2 font-bold text-sm text-indigo-950 dark:text-indigo-200">
                <Layers className="h-5 w-5 text-indigo-600 shrink-0" />
                <span>{t(`Separate Invoice Per ${(items[0]?.uom || "PCS").toUpperCase() === "PCS" ? "Piece" : "Unit"}`, `ہر ${(items[0]?.uom || "PCS").toUpperCase()} کا الگ بل بنائیں`)}</span>
              </div>
              <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 mt-0.5">
                {t(`(${totalPieces} Separate Invoices)`, `(${totalPieces} الگ الگ انوائسز)`)}
              </span>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                {language === "ur"
                  ? <>ہر یونٹ کا الگ بل بنے گا (کل <strong>{totalPieces} انوائسز</strong> بنیں گی {!isAccountingOnly && postToFbr ? "اور FBR میں الگ الگ شوٹ ہوں گی" : "اور کھاتے میں درج ہوں گی"})۔</>
                  : <>Each item will generate its own invoice (total <strong>{totalPieces} invoices</strong>{!isAccountingOnly && postToFbr ? " sent individually to FBR" : " logged in ledger"}).</>}
              </p>
              {!isAccountingOnly && postToFbr && fbrInvoiceType === "TIER1_POS" && (
                <div className="mt-3 inline-flex items-center gap-1 rounded-lg bg-indigo-100/80 px-2.5 py-1 text-[11px] font-bold text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
                  {t(`💳 FBR POS Fee: PKR 1.00 per invoice (Total PKR ${totalPieces}.00)`, `💳 FBR POS فیس: PKR 1.00 فی انوائس (کل PKR ${totalPieces}.00)`)}
                </div>
              )}
            </button>
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsSplitDecisionModalOpen(false)}
            >
              {t("Cancel", "منسوخ کریں")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* BATCH SEPARATE INVOICES CREATED SUCCESS MODAL */}
      {batchSavedResult && (
        <Modal
          isOpen={true}
          onClose={() => setBatchSavedResult(null)}
          title={t(`${batchSavedResult.totalCount} Invoices Created Successfully!`, `${batchSavedResult.totalCount} انوائسز کامیابی کے ساتھ بن گئیں!`)}
          description={t(`${batchSavedResult.totalCount} Separate Invoices Generated Successfully`, `${batchSavedResult.totalCount} الگ الگ انوائسز تیار ہو گئیں`)}
          maxWidth="2xl"
        >
          <div className="space-y-5">
            {/* Header Badge */}
            <div className="flex items-center justify-between rounded-2xl bg-indigo-50 border border-indigo-200 p-4 text-indigo-900 dark:bg-indigo-950/40 dark:border-indigo-900 dark:text-indigo-200">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-indigo-600 p-2 text-white shadow-xs">
                  <CheckCheck className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">
                    {t(`${batchSavedResult.totalCount} Separate Invoices Ready`, `${batchSavedResult.totalCount} الگ الگ انوائسز تیار ہو گئیں`)}
                  </h4>
                  <p className="text-xs text-indigo-700 dark:text-indigo-300 font-mono mt-0.5">
                    {t("Invoice Range:", "بل رینج:")} <strong>{batchSavedResult.firstInvoiceNumber}</strong> {t("to", "سے")} <strong>{batchSavedResult.lastInvoiceNumber}</strong>
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">{t("Customer:", "گاہک / کسٹمر:")}</span>
                <span className="font-bold text-xs text-indigo-950 dark:text-indigo-200">
                  {batchSavedResult.customerName}
                </span>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs dark:bg-slate-900 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 font-bold uppercase">{t("Total Invoices", "کل انوائسز")}</span>
                <p className="text-base font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">
                  {batchSavedResult.totalCount} {t("Invoices", "بل")}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs dark:bg-slate-900 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 font-bold uppercase">{t("Total Amount", "کل رقم")}</span>
                <p className="text-sm font-bold font-mono text-slate-900 dark:text-white mt-0.5">
                  PKR {batchSavedResult.totalAmount?.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs dark:bg-slate-900 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 font-bold uppercase">{t("Paid", "وصول شدہ")}</span>
                <p className="text-sm font-bold font-mono text-emerald-600 mt-0.5">
                  PKR {batchSavedResult.actualPaid?.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs dark:bg-slate-900 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 font-bold uppercase">{t("Receivable", "بقایا رقم")}</span>
                <p className="text-sm font-bold font-mono text-rose-600 mt-0.5">
                  PKR {batchSavedResult.remainingReceivable?.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {/* FBR Status or Local Sale status */}
            {!isAccountingOnly && batchSavedResult.postToFbr ? (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3.5 text-xs text-indigo-950 dark:bg-indigo-950/30 dark:border-indigo-900 dark:text-indigo-200 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-indigo-800 dark:text-indigo-300">
                  <Zap className="h-4 w-4" />
                  <span>{t("FBR Invoicing Queue (Ready to Transmit):", "FBR انوائسنگ کیو:")}</span>
                </div>
                <p className="leading-relaxed">
                  {language === "ur"
                    ? <>یہ تمام <strong>{batchSavedResult.totalCount} انوائسز</strong> FBR انوائسنگ کیو میں شامل ہو چکی ہیں۔ آپ FBR ٹیب میں جا کر تمام بلوں کو ایک ہی کلک میں FBR پر شوٹ (Batch Transmit) کر سکتے ہیں یا الگ الگ بھیج سکتے ہیں۔</>
                    : <>All <strong>{batchSavedResult.totalCount} invoices</strong> are queued in your FBR Invoicing tab. You can transmit all of them in a single batch click or send individually.</>}
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                <span className="font-bold">{t("Local Sales Ledger:", "لوکل کھاتہ:")} </span>
                <span>
                  {t(`All ${batchSavedResult.totalCount} invoices were successfully recorded in your sales register and inventory stock.`, `یہ تمام ${batchSavedResult.totalCount} بل کامیابی سے آپ کے سیلز رجسٹر اور اسٹاک میں اپ ڈیٹ ہو چکے ہیں۔`)}
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push("/sales")}
              >
                {t(`View Sales List (${batchSavedResult.totalCount} Invoices)`, `سیلز لسٹ دیکھیں (${batchSavedResult.totalCount} انوائسز)`)}
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setBatchSavedResult(null)}
                >
                  {t("+ Create New Invoice", "+ نیا بل بنائیں")}
                </Button>

                {!isAccountingOnly && batchSavedResult.postToFbr && (
                  <Button
                    type="button"
                    variant="primary"
                    className="bg-indigo-600 hover:bg-indigo-700 shadow-sm"
                    onClick={() => router.push("/compliance/fbr")}
                  >
                    <Zap className="h-4 w-4 mr-1.5" /> {t("Open FBR Queue & Shoot", "FBR کیو کھولیں اور شوٹ کریں")}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* INVOICE SAVED MODAL WITH RECEIVABLE DETAILS */}
      {savedInvoiceResult && (
        <Modal
          isOpen={true}
          onClose={() => setSavedInvoiceResult(null)}
          title={isAccountingOnly ? "Sales Invoice Created & Saved Successfully" : "Sales Invoice Saved & Queued for FBR Invoicing"}
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
            <div className={`grid ${(!savedInvoiceResult.postToFbr || isAccountingOnly) ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-4"} gap-3 text-xs`}>
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
              {!isAccountingOnly && savedInvoiceResult.postToFbr && (
                <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs dark:bg-slate-900 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">{fbrInvoiceType === "DIGITAL_INVOICING" ? "Digital Invoicing Fee" : "FBR POS Fee"}</span>
                  <p className="text-sm font-bold font-mono text-slate-500 mt-0.5">
                    {savedInvoiceResult.posFee > 0 ? `Rs ${savedInvoiceResult.posFee.toFixed(2)}` : "Rs 0.00 (Exempt)"}
                  </p>
                </div>
              )}
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

            {/* FBR Status Explanation vs Local Sale Confirmation */}
            {!isAccountingOnly && savedInvoiceResult.postToFbr ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                <span className="font-semibold text-slate-800 dark:text-slate-200">FBR Invoicing Status: </span>
                {savedInvoiceResult.remainingReceivable > 0 ? (
                  <span className="text-amber-800 dark:text-amber-300 font-medium">
                    This is a Partial / Credit sale. Under tax safeguards, it is placed in the FBR Tab under <strong>"Awaiting Full Payment"</strong> and blocked from FBR transmission until the customer pays the remaining balance of PKR {savedInvoiceResult.remainingReceivable?.toLocaleString()}.
                  </span>
                ) : (
                  <span>
                    This invoice is fully paid and queued in your FBR Invoicing tab under <strong>"Ready to Hit FBR"</strong>.
                  </span>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                <span className="font-bold">{t("Local Sale (Internal Ledger):", "لوکل سیل کھاتہ:")} </span>
                <span>
                  {t("This invoice was successfully posted to your sales register and customer ledger. It was not added to the FBR transmission queue.", "یہ بل کامیابی کے ساتھ آپ کے سیلز رجسٹر اور کسٹمر کھاتے میں درج ہو چکا ہے۔ یہ بل FBR لسٹ میں شامل نہیں کیا گیا ہے۔")}
                </span>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => router.push("/sales")}
                >
                  View Sales List
                </Button>
                {savedInvoiceResult.id && (
                  <Button
                    type="button"
                    variant="outline"
                    className="border-indigo-300 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300"
                    onClick={() => window.open(`/sales/${savedInvoiceResult.id}?print=true`, "_blank")}
                  >
                    <Receipt className="h-4 w-4 mr-1.5 text-indigo-600" />
                    Print Invoice / Receipt
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setSavedInvoiceResult(null)}
                >
                  + Create Another Invoice
                </Button>
                {!isAccountingOnly && savedInvoiceResult.postToFbr && (
                  <Button
                    type="button"
                    variant="primary"
                    className="bg-indigo-600 hover:bg-indigo-700 shadow-sm"
                    onClick={() => router.push("/compliance/fbr")}
                  >
                    <Zap className="h-4 w-4 mr-1.5" /> Open FBR Invoicing Tab
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
