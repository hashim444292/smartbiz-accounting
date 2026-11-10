"use client";

import React, { useState, useEffect, useMemo } from "react";
import { formatMoney } from "@/lib/decimal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  X,
  Plus,
  Trash2,
  Calendar,
  User,
  Phone,
  MapPin,
  CreditCard,
  Percent,
  Hash,
  ShieldAlert,
  DollarSign,
  Check,
  RotateCcw,
  Lock,
  FileText,
  Layers,
  Search,
  AlertTriangle,
  Building,
  Wallet,
  CheckCircle2,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

export interface EditItemRow {
  id: string;
  productId: string;
  productName: string;
  sku?: string;
  hsCode?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
  costPrice?: number;
}

interface SalesEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: any | null;
  onSuccess: (updatedSale: any) => void;
  onDelete?: (sale: any) => void;
  products?: any[];
  customers?: any[];
}

export function SalesEditModal({
  isOpen,
  onClose,
  sale,
  onSuccess,
  onDelete,
  products: initialProducts,
  customers: initialCustomers,
}: SalesEditModalProps) {
  const { t, language } = useLanguage();

  // Catalogs
  const [products, setProducts] = useState<any[]>(initialProducts || []);
  const [customers, setCustomers] = useState<any[]>(initialCustomers || []);
  const [loadingCatalogs, setLoadingCatalogs] = useState(false);

  // Invoice Header Fields
  const [date, setDate] = useState("");
  const [dueDate, setDueDate] = useState("");

  // Customer Information
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerNtn, setCustomerNtn] = useState("");
  const [customerCnic, setCustomerCnic] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");

  // Line Items
  const [items, setItems] = useState<EditItemRow[]>([]);

  // Financial Totals
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [posFee, setPosFee] = useState<number>(0);

  // Payment Settlement
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paymentStatus, setPaymentStatus] = useState<"PAID" | "PARTIAL" | "UNPAID">("PAID");

  // FBR Settings
  const [fbrStatus, setFbrStatus] = useState("PENDING");
  const [fbrInvoiceNumber, setFbrInvoiceNumber] = useState("");

  // Notes & Audit
  const [notes, setNotes] = useState("");
  const [editReason, setEditReason] = useState("");

  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper date formatter (YYYY-MM-DD)
  const formatDateOnly = (d?: string | Date | null) => {
    if (!d) return "";
    const str = String(d);
    if (str.includes("T")) return str.split("T")[0];
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return "";
    return dt.toISOString().slice(0, 10);
  };

  // Fetch catalogs on open if not provided
  useEffect(() => {
    if (!isOpen) return;

    if (!initialProducts || initialProducts.length === 0) {
      setLoadingCatalogs(true);
      fetch("/api/products?limit=250&status=ACTIVE")
        .then((res) => res.json())
        .then((json) => {
          if (json.success && Array.isArray(json.data)) {
            setProducts(json.data);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingCatalogs(false));
    } else {
      setProducts(initialProducts);
    }

    if (!initialCustomers || initialCustomers.length === 0) {
      fetch("/api/customers")
        .then((res) => res.json())
        .then((json) => {
          if (json.success && Array.isArray(json.data)) {
            setCustomers(json.data);
          }
        })
        .catch(() => {});
    } else {
      setCustomers(initialCustomers);
    }
  }, [isOpen, initialProducts, initialCustomers]);

  // Initialize state when sale changes
  useEffect(() => {
    if (!sale) return;

    setDate(formatDateOnly(sale.date));
    setDueDate(sale.dueDate ? formatDateOnly(sale.dueDate) : "");
    setCustomerId(sale.customerId || "");
    setCustomerName(sale.customerName || "");

    // Extract customer contact info from customer record or notes
    let parsedNotes: any = {};
    let rawNotes = sale.notes || "";
    try {
      parsedNotes = JSON.parse(sale.notes);
      rawNotes = parsedNotes.memo || parsedNotes.notes || "";
    } catch {
      rawNotes = sale.notes || "";
    }

    const phone = sale.customer?.phone || parsedNotes.customerPhone || parsedNotes.fbrMeta?.buyerPhone || "";
    const ntn = sale.customer?.ntn || parsedNotes.customerNtn || parsedNotes.fbrMeta?.buyerNTN || "";
    const cnic = sale.customer?.cnic || parsedNotes.customerCnic || parsedNotes.fbrMeta?.buyerCNIC || "";
    const addr = sale.customer?.address || parsedNotes.customerAddress || parsedNotes.fbrMeta?.buyerAddress || "";

    setCustomerPhone(phone);
    setCustomerNtn(ntn);
    setCustomerCnic(cnic);
    setCustomerAddress(addr);
    setNotes(rawNotes);

    // Initialize line items
    if (Array.isArray(sale.items) && sale.items.length > 0) {
      setItems(
        sale.items.map((it: any, index: number) => {
          const qty = Number(it.quantity || 1);
          const price = Number(it.unitPrice || 0);
          const disc = Number(it.discount || 0);
          const rate = Number(it.taxRate || 0);
          const base = Math.max(0, qty * price - disc);
          const tax = Number(it.taxAmount ?? (base * rate) / 100);
          const lt = Number(it.lineTotal ?? base + tax);

          return {
            id: it.id || `item-${index}-${Date.now()}`,
            productId: it.productId || "",
            productName: it.productName || it.product?.name || "Product",
            sku: it.sku || it.product?.sku || "",
            hsCode: it.hsCode || it.product?.hsCode || "",
            quantity: qty,
            unitPrice: price,
            discount: disc,
            taxRate: rate,
            taxAmount: tax,
            lineTotal: lt,
            costPrice: Number(it.costPrice || 0),
          };
        })
      );
    } else {
      // Default single item if invoice had no itemized rows
      const singleTotal = Number(sale.totalAmount || 0);
      setItems([
        {
          id: `item-0-${Date.now()}`,
          productId: "",
          productName: "Merchandise Sale",
          sku: "",
          hsCode: "8517.13",
          quantity: 1,
          unitPrice: singleTotal,
          discount: Number(sale.discountAmount || 0),
          taxRate: 0,
          taxAmount: Number(sale.taxAmount || 0),
          lineTotal: singleTotal,
          costPrice: 0,
        },
      ]);
    }

    setDiscountAmount(Number(sale.discountAmount || 0));
    setPosFee(Number(sale.posFee || 0));
    setPaidAmount(Number(sale.paidAmount || 0));
    setPaymentMethod(sale.paymentMethod || "CASH");
    setPaymentStatus(sale.paymentStatus || "PAID");
    setFbrStatus(sale.fbrStatus || "PENDING");
    setFbrInvoiceNumber(sale.fbrInvoiceNumber || "");
    setEditReason("");
    setError(null);
  }, [sale]);

  // Live Financial Calculations
  const calculations = useMemo(() => {
    let subtotal = 0;
    let itemDiscounts = 0;
    let totalTax = 0;

    items.forEach((it) => {
      const q = Number(it.quantity || 0);
      const p = Number(it.unitPrice || 0);
      const d = Number(it.discount || 0);
      const rate = Number(it.taxRate || 0);

      subtotal += q * p;
      itemDiscounts += d;
      const base = Math.max(0, q * p - d);
      const tax = (base * rate) / 100;
      totalTax += tax;
    });

    const billDiscount = Number(discountAmount || 0);
    const fee = Number(posFee || 0);
    const grandTotal = Math.max(0, subtotal - itemDiscounts - billDiscount + totalTax + fee);
    const safePaid = Number(paidAmount || 0);
    const remainingReceivable = Math.max(0, grandTotal - safePaid);

    return {
      subtotal,
      itemDiscounts,
      totalTax,
      grandTotal,
      remainingReceivable,
    };
  }, [items, discountAmount, posFee, paidAmount]);

  // Handle Registered Customer Dropdown Change
  const handleCustomerSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setCustomerId(val);

    if (!val) {
      // Walk-in / Unregistered
      if (customerName === "Walk-in Retail Customer" || !customerName) {
        setCustomerName("Walk-in Retail Customer");
      }
      return;
    }

    const found = customers.find((c) => c.id === val);
    if (found) {
      setCustomerName(found.name || "");
      if (found.phone) setCustomerPhone(found.phone);
      if (found.ntn) setCustomerNtn(found.ntn);
      if (found.cnic) setCustomerCnic(found.cnic);
      if (found.address) setCustomerAddress(found.address);
    }
  };

  // Item Field Change Handler with live line re-calculation
  const handleItemChange = (
    index: number,
    field: keyof EditItemRow,
    value: any
  ) => {
    setItems((prev) => {
      const copy = [...prev];
      const item = { ...copy[index] };

      if (field === "productId") {
        item.productId = value;
        const prod = products.find((p) => p.id === value);
        if (prod) {
          item.productName = prod.name;
          item.sku = prod.sku || "";
          item.hsCode = prod.hsCode || "";
          item.unitPrice = Number(prod.sellingPrice || item.unitPrice || 0);
          item.taxRate = Number(prod.taxRate || prod.salesTax || 0);
          item.costPrice = Number(prod.costPrice || prod.averageCost || 0);
        }
      } else {
        (item as any)[field] = value;
      }

      // Recompute line total and tax
      const q = field === "quantity" ? Number(value || 0) : Number(item.quantity || 0);
      const p = field === "unitPrice" ? Number(value || 0) : Number(item.unitPrice || 0);
      const d = field === "discount" ? Number(value || 0) : Number(item.discount || 0);
      const rate = field === "taxRate" ? Number(value || 0) : Number(item.taxRate || 0);

      const base = Math.max(0, q * p - d);
      const tax = (base * rate) / 100;
      item.taxAmount = tax;
      item.lineTotal = base + tax;

      copy[index] = item;
      return copy;
    });
  };

  // Add Item Row
  const handleAddItem = () => {
    const defaultProd = products[0];
    const defaultPrice = Number(defaultProd?.sellingPrice || 0);
    const defaultTax = Number(defaultProd?.taxRate || defaultProd?.salesTax || 0);

    const newItem: EditItemRow = {
      id: `new-${Date.now()}-${Math.random()}`,
      productId: defaultProd?.id || "",
      productName: defaultProd?.name || "New Product",
      sku: defaultProd?.sku || "",
      hsCode: defaultProd?.hsCode || "8517.13",
      quantity: 1,
      unitPrice: defaultPrice,
      discount: 0,
      taxRate: defaultTax,
      taxAmount: (defaultPrice * defaultTax) / 100,
      lineTotal: defaultPrice + (defaultPrice * defaultTax) / 100,
      costPrice: Number(defaultProd?.costPrice || 0),
    };

    setItems((prev) => [...prev, newItem]);
  };

  // Remove Item Row
  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      alert(language === "ur" ? "انوائس میں کم از کم ایک پروڈکٹ کا ہونا ضروری ہے" : "Invoice must contain at least one item.");
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Quick Settlement Buttons
  const handleQuickPayFull = () => {
    setPaidAmount(calculations.grandTotal);
    setPaymentStatus("PAID");
    if (paymentMethod === "CREDIT") setPaymentMethod("CASH");
  };

  const handleQuickCredit = () => {
    setPaidAmount(0);
    setPaymentStatus("UNPAID");
    setPaymentMethod("CREDIT");
  };

  // Form Submit Handler
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sale) return;

    if (!editReason.trim()) {
      setError(language === "ur" ? "ترمیم کی وجہ درج کرنا لازمی ہے" : "Please provide an edit reason for the software audit trail.");
      return;
    }

    if (items.length === 0) {
      setError(language === "ur" ? "کم از کم ایک پروڈکٹ شامل کریں" : "Please include at least one product item.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        date: date ? new Date(`${date}T12:00:00Z`).toISOString() : sale.date,
        dueDate: dueDate ? new Date(`${dueDate}T12:00:00Z`).toISOString() : null,
        customerId: customerId || null,
        customerName: customerName.trim() || "Walk-in Retail Customer",
        customerPhone: customerPhone.trim() || null,
        customerNtn: customerNtn.trim() || null,
        customerCnic: customerCnic.trim() || null,
        customerAddress: customerAddress.trim() || null,
        items: items.map((it) => ({
          productId: it.productId,
          productName: it.productName,
          sku: it.sku || null,
          hsCode: it.hsCode || null,
          quantity: Number(it.quantity || 1),
          unitPrice: Number(it.unitPrice || 0),
          discount: Number(it.discount || 0),
          taxRate: Number(it.taxRate || 0),
          taxAmount: Number(it.taxAmount || 0),
          lineTotal: Number(it.lineTotal || 0),
          costPrice: Number(it.costPrice || 0),
        })),
        subtotal: calculations.subtotal,
        discountAmount: discountAmount,
        taxAmount: calculations.totalTax,
        salesTax: calculations.totalTax,
        posFee: posFee,
        totalAmount: calculations.grandTotal,
        paidAmount: paidAmount,
        paymentStatus: paymentStatus,
        paymentMethod: paymentMethod,
        fbrStatus: fbrStatus,
        fbrInvoiceNumber: fbrInvoiceNumber.trim() || null,
        notes: notes,
        editReason: editReason.trim(),
      };

      const res = await fetch(`/api/sales/${sale.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to update sale invoice.");
      }

      onSuccess(json.data);
      onClose();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred while saving invoice changes.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !sale) return null;

  const isFbrStamped = sale.fbrStatus === "SUCCESS" || Boolean(sale.fbrInvoiceNumber);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div
        className="relative w-full max-w-5xl bg-white dark:bg-[#0F172A] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-6 transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/40">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                  {language === "ur" ? "سیل انوائس میں مکمل ترمیم" : "Edit Sale Invoice"}
                </h2>
                <Badge variant="outline" className="font-mono font-bold text-xs bg-white dark:bg-slate-800">
                  #{sale.invoiceNumber}
                </Badge>
                {isFbrStamped && (
                  <Badge variant="success" className="text-[10px] font-bold flex items-center gap-1">
                    <CheckCircle2 className="h-2.5 w-2.5" /> FBR Stamped
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {language === "ur"
                  ? "تمام آئٹمز، قیمتیں، گاہک، ادائیگی اور ایف بی آر تفصیلات میں باآسانی ترمیم کریں"
                  : "All products, quantities, prices, customer details, payment & tax options are fully editable"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-6 max-h-[76vh] overflow-y-auto">
          {/* Creator Attribution Info Card */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <User className="h-3.5 w-3.5 text-slate-400" />
              <span>
                <strong>{t("Original Creator", "بنایا گیا بذریعہ")}:</strong>{" "}
                {sale.createdByName || "System Admin"}
              </span>
            </div>
            {sale.isEdited && (
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-medium">
                <RotateCcw className="h-3 w-3" />
                <span>
                  Previous edit ({sale.editCount || 1}x) by {sale.updatedByName || "Staff"}
                </span>
              </div>
            )}
          </div>

          {/* SECTION 1: Customer & Invoice Details */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-100 dark:border-slate-800">
              <User className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                {t("Customer & Invoice Info", "گاہک اور انوائس کی معلومات")}
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t("Invoice Date", "انوائس تاریخ")} *
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                />
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t("Payment Due Date", "واجب الادا تاریخ")}
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                />
              </div>

              {/* Registered Customer Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t("Registered Khata Account", "رجسٹرڈ گاہک کھاتہ")}
                </label>
                <select
                  value={customerId}
                  onChange={handleCustomerSelect}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                >
                  <option value="">{t("Walk-in Retail / Custom", "عام گاہک (Walk-in)")}</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Customer Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t("Customer Name", "گاہک کا نام")} *
                </label>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Customer Name"
                  required
                />
              </div>

              {/* Customer Phone */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t("Customer Phone", "فون نمبر")}
                </label>
                <Input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="e.g. 0300-1234567"
                />
              </div>

              {/* Customer NTN / STRN */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t("Customer NTN / STRN", "NTN / STRN نمبر")}
                </label>
                <Input
                  value={customerNtn}
                  onChange={(e) => setCustomerNtn(e.target.value)}
                  placeholder="e.g. 1234567-8"
                  className="font-mono text-xs"
                />
              </div>

              {/* Customer CNIC */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t("Customer CNIC", "شناختی کارڈ نمبر (13 ہندسے)")}
                </label>
                <Input
                  value={customerCnic}
                  onChange={(e) => setCustomerCnic(e.target.value)}
                  placeholder="e.g. 42301-1234567-1"
                  className="font-mono text-xs"
                />
              </div>

              {/* Customer Address */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t("Customer Address", "پتہ")}
                </label>
                <Input
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="e.g. Shop 4, Clifton, Karachi"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: Line Items (Products Table) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  {t("Products & Services (Line Items)", "مصنوعات اور آئٹم وار تفصیلات")} ({items.length})
                </h3>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddItem}
                className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 dark:border-indigo-800 dark:hover:bg-indigo-950/40 text-xs py-1 px-2.5 flex items-center gap-1 shadow-2xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{t("Add Product / Item", "نیا آئٹم شامل کریں")}</span>
              </Button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                  <tr>
                    <th className="py-2.5 px-3 w-8">#</th>
                    <th className="py-2.5 px-3 min-w-[200px]">{t("Product / Service", "پروڈکٹ / آئٹم")}</th>
                    <th className="py-2.5 px-3 w-28 text-center">{t("Quantity", "تعداد")}</th>
                    <th className="py-2.5 px-3 w-28 text-right">{t("Price (Rs)", "قیمت")}</th>
                    <th className="py-2.5 px-3 w-24 text-right">{t("Disc (Rs)", "ڈسکاؤنٹ")}</th>
                    <th className="py-2.5 px-3 w-24 text-center">{t("Tax %", "ٹیکس")}</th>
                    <th className="py-2.5 px-3 w-28 text-right">{t("Line Total", "کل رقم")}</th>
                    <th className="py-2.5 px-3 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-[#0F172A]">
                  {items.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                      <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>

                      {/* Product Selector / Name */}
                      <td className="py-2 px-3">
                        <div className="space-y-1">
                          <select
                            value={item.productId}
                            onChange={(e) => handleItemChange(idx, "productId", e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                          >
                            <option value="">{t("Select Catalog Product...", "پروڈکٹ منتخب کریں...")}</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} {p.sku ? `[${p.sku}]` : ""} - Rs {Number(p.sellingPrice || 0).toLocaleString()}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={item.productName}
                            onChange={(e) => handleItemChange(idx, "productName", e.target.value)}
                            placeholder="Custom Product Description"
                            className="w-full rounded-md border border-slate-200 bg-slate-50/50 px-2 py-1 text-[11px] text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 focus:outline-none"
                            required
                          />
                        </div>
                      </td>

                      {/* Quantity */}
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, "quantity", Number(e.target.value) || 0)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-center font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                          required
                        />
                      </td>

                      {/* Unit Price */}
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unitPrice}
                          onChange={(e) => handleItemChange(idx, "unitPrice", Number(e.target.value) || 0)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-right font-mono font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                          required
                        />
                      </td>

                      {/* Item Discount */}
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.discount}
                          onChange={(e) => handleItemChange(idx, "discount", Number(e.target.value) || 0)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-right font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                        />
                      </td>

                      {/* Tax Rate */}
                      <td className="py-2 px-3">
                        <select
                          value={item.taxRate}
                          onChange={(e) => handleItemChange(idx, "taxRate", Number(e.target.value) || 0)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-1.5 py-1.5 text-xs text-center font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                        >
                          <option value="0">0% Exempt</option>
                          <option value="18">18% GST</option>
                          <option value="1">1%</option>
                          <option value="5">5%</option>
                          <option value="10">10%</option>
                        </select>
                      </td>

                      {/* Line Total */}
                      <td className="py-2 px-3 text-right">
                        <div className="font-mono font-bold text-slate-900 dark:text-white">
                          Rs {Number(item.lineTotal || 0).toLocaleString()}
                        </div>
                        {item.taxAmount > 0 && (
                          <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono">
                            +Rs {Number(item.taxAmount || 0).toFixed(1)} tax
                          </div>
                        )}
                      </td>

                      {/* Remove Button */}
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition"
                          title="Delete this line item"
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

          {/* SECTION 3: Financial Summary & Discounts */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/30 space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-200 dark:border-slate-800">
              <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                {t("Financial Totals & Bill Calculations", "کل حساب کتاب اور ڈسکاؤنٹ")}
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              {/* Goods Subtotal */}
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {t("Goods Subtotal", "سب ٹوٹل")}
                </span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-sm">
                  Rs {calculations.subtotal.toLocaleString()}
                </span>
              </div>

              {/* Item Discounts */}
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {t("Item Discounts", "آئٹم ڈسکاؤنٹس")}
                </span>
                <span className="font-mono font-bold text-amber-600 text-sm">
                  -Rs {calculations.itemDiscounts.toLocaleString()}
                </span>
              </div>

              {/* Bill-Level Additional Discount */}
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t("Bill Discount (Rs)", "اضافی ڈسکاؤنٹ")}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                />
              </div>

              {/* Sales Tax */}
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {t("Sales Tax (GST)", "سیلز ٹیکس")}
                </span>
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                  +Rs {calculations.totalTax.toLocaleString()}
                </span>
              </div>

              {/* POS Fee */}
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t("FBR POS Fee (Rs)", "FBR فیس")}
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={posFee}
                  onChange={(e) => setPosFee(Number(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                />
              </div>

              {/* Grand Total */}
              <div className="bg-indigo-600 text-white p-2.5 rounded-xl shadow-xs">
                <span className="block text-[11px] font-semibold text-indigo-100">
                  {t("Grand Total", "کل قابل ادا رقم")}
                </span>
                <span className="font-mono font-extrabold text-base">
                  Rs {calculations.grandTotal.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 4: Payment Settlement & Khata */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  {t("Payment Settlement & Khata", "ادائیگی اور کھاتہ")}
                </h3>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleQuickPayFull}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 transition"
                >
                  ⚡ 100% Full Paid
                </button>
                <button
                  type="button"
                  onClick={handleQuickCredit}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 hover:bg-rose-200 dark:bg-rose-950/60 dark:text-rose-300 transition"
                >
                  0% Paid (Credit)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Paid Amount */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t("Paid Amount (Rs)", "ادا شدہ رقم")} *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={paidAmount}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0;
                    setPaidAmount(val);
                    if (val >= calculations.grandTotal && calculations.grandTotal > 0) setPaymentStatus("PAID");
                    else if (val > 0) setPaymentStatus("PARTIAL");
                    else setPaymentStatus("UNPAID");
                  }}
                  required
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                />
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t("Payment Method", "طریقہ ادائیگی")}
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                >
                  <option value="CASH">{t("Cash (نقد)", "نقد")}</option>
                  <option value="BANK_TRANSFER">{t("Bank Transfer (بینک ٹرانسفر)", "بینک")}</option>
                  <option value="ONLINE">{t("Online / Card (آن لائن)", "آن لائن")}</option>
                  <option value="CHEQUE">{t("Cheque (چیک)", "چیک")}</option>
                  <option value="CREDIT">{t("Credit / Udhaar (ادھار)", "ادھار")}</option>
                </select>
              </div>

              {/* Payment Status */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t("Payment Status", "ادائیگی کی صورتحال")}
                </label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                >
                  <option value="PAID">{t("PAID (مکمل ادا)", "مکمل ادا")}</option>
                  <option value="PARTIAL">{t("PARTIAL (جزوی ادا)", "جزوی ادا")}</option>
                  <option value="UNPAID">{t("UNPAID (ادھار)", "ادھار")}</option>
                </select>
              </div>

              {/* Remaining Receivable Khata Balance */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t("Remaining Receivable", "بقایا رقم / کھاتہ")}
                </label>
                <div
                  className={`rounded-xl border px-3 py-2 text-xs font-mono font-bold ${
                    calculations.remainingReceivable > 0
                      ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
                      : "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                  }`}
                >
                  Rs {calculations.remainingReceivable.toLocaleString()}
                  {calculations.remainingReceivable > 0 ? " (Udhaar)" : " (Fully Paid)"}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 5: FBR Statutory & POS Info */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900/50 dark:bg-blue-950/20 space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-blue-200/60 dark:border-blue-900/60">
              <span className="block text-xs font-bold text-blue-900 dark:text-blue-200 uppercase tracking-wider">
                {t("FBR Statutory & POS Settings", "FBR ٹیکس و ڈیجیٹل انوائسنگ تفصیلات")}
              </span>
              {isFbrStamped && (
                <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                  ⚡ Stamped on FBR Server
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  FBR Status
                </label>
                <select
                  value={fbrStatus}
                  onChange={(e) => setFbrStatus(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                >
                  <option value="PENDING">{t("PENDING (منتظر ترسیل)", "منتظر")}</option>
                  <option value="SUCCESS">{t("SUCCESS (تصدیق شدہ)", "کامیاب")}</option>
                  <option value="FAILED">{t("FAILED (ناکام)", "ناکام")}</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  FBR Official Stamped Invoice Number
                </label>
                <Input
                  value={fbrInvoiceNumber}
                  onChange={(e) => setFbrInvoiceNumber(e.target.value)}
                  placeholder="e.g. 201327FJ5V3432560"
                  className="font-mono text-xs"
                />
              </div>
            </div>
          </div>

          {/* SECTION 6: Notes & Remarks */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t("Invoice Remarks / Notes", "انوائس نوٹس / ریمارکس")}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Terms, delivery instructions, warranty notes..."
              rows={2}
              className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:bg-slate-900 dark:text-white dark:border-slate-700"
            />
          </div>

          {/* SECTION 7: Mandatory Audit Reason */}
          <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-3.5 dark:border-amber-800 dark:bg-amber-950/40 space-y-1.5">
            <label className="block text-xs font-bold text-amber-900 dark:text-amber-200">
              {t("Reason for Editing (Required for Audit Trail)", "ترمیم کی وجہ درج کرنا لازمی ہے")} *
            </label>
            <p className="text-[11px] text-amber-700 dark:text-amber-400">
              {t(
                "This modification will be permanently logged in the software Audit Trail with your name and timestamp.",
                "یہ تبدیلی سافٹ ویئر آڈٹ ٹریل میں آپ کے نام، تاریخ اور سابقہ ریکارڈ کے ساتھ محفوظ ہو جائے گی۔"
              )}
            </p>
            <textarea
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              placeholder={t(
                "e.g. Corrected product quantity, changed customer name, updated payment...",
                "مثال: پروڈکٹ کی تعداد درست کی گئی، گاہک کا نام یا فون نمبر تبدیل کیا گیا..."
              )}
              rows={2}
              required
              className="w-full rounded-lg border border-amber-300 bg-white p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:bg-slate-900 dark:text-white dark:border-amber-700"
            />
          </div>

          {/* Action Buttons Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
            <div>
              {!isFbrStamped && onDelete && (
                <Button
                  type="button"
                  variant="outline"
                  className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 text-xs shadow-2xs"
                  onClick={() => onDelete(sale)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  {t("Delete Invoice", "انوائس ڈیلیٹ کریں")}
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
                {t("Cancel", "منسوخ")}
              </Button>
              <Button type="submit" variant="primary" isLoading={saving} className="bg-indigo-600 hover:bg-indigo-700 text-xs px-4">
                {t("Save All Changes", "تمام ترامیم محفوظ کریں")}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
