"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatMoney } from "@/lib/decimal";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Plus,
  Trash2,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Calculator,
  Layers,
  Sparkles,
  Info,
  Check,
  Search,
  ArrowUpRight,
  ShieldCheck,
  Building2,
  Calendar,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { BrandPageLoader } from "@/components/ui/loader";
import { smartFetch, invalidateCache } from "@/lib/clientCache";

interface PurchaseItem {
  productId: string;
  productName: string;
  quantity: number | "";
  unitCost: number;
  previousCost: number;
  currentStock: number;
  previousSellingPrice: number;
  newSellingPrice: number;
  updateCatalogPrice: boolean;
  lineTotal: number;
  uom?: string;
}

export default function CreatePurchasePage() {
  const router = useRouter();
  const { user, activeCompany, branches, selectedBranch, activeBranchId, isBranchLocked } = useAuth();
  const { t, language } = useLanguage();
  const effectiveBranch = isBranchLocked ? user?.branchId : (selectedBranch?.id || activeBranchId || null);
  const [purchaseBranchId, setPurchaseBranchId] = useState<string>("");

  useEffect(() => {
    const bId = isBranchLocked ? (user?.branchId || "") : (selectedBranch?.id || activeBranchId || (branches[0]?.id || ""));
    setPurchaseBranchId(bId);
  }, [isBranchLocked, user?.branchId, selectedBranch?.id, activeBranchId, branches]);

  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [supplierId, setSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quick Add Supplier Modal State
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [newSupName, setNewSupName] = useState("");
  const [newSupBusiness, setNewSupBusiness] = useState("");
  const [newSupPhone, setNewSupPhone] = useState("");
  const [newSupAddress, setNewSupAddress] = useState("");
  const [isAddingSupplier, setIsAddingSupplier] = useState(false);

  // Quick Add Product Modal State
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newProdName, setNewProdName] = useState("");
  const [newProdSku, setNewProdSku] = useState("");
  const [newProdCost, setNewProdCost] = useState("");
  const [newProdPrice, setNewProdPrice] = useState("");
  const [newProdStock, setNewProdStock] = useState("");
  const [newProdUom, setNewProdUom] = useState("pcs");
  const [isAddingProduct, setIsAddingProduct] = useState(false);

  // Quick search term for filtering the catalog items
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [activeSearchRow, setActiveSearchRow] = useState<number | null>(null);
  const [highlightedProductIndex, setHighlightedProductIndex] = useState<number>(0);
  const [dropdownCoords, setDropdownCoords] = useState<{ top?: number; bottom?: number; left: number; width: number; maxHeight: number } | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      if (activeCompany?.id) {
        headers["x-business-id"] = activeCompany.id;
      }
      const branchToPass = isBranchLocked ? user?.branchId : (purchaseBranchId || effectiveBranch);
      if (branchToPass) {
        headers["x-branch-id"] = branchToPass;
      }

      const [supJson, prodJson] = await Promise.all([
        smartFetch("/api/suppliers", { headers, ttlMs: 0, skipCache: true }),
        smartFetch("/api/products?limit=250", { headers, ttlMs: 30000 }),
      ]);

      if (supJson.success && supJson.data && supJson.data.length > 0) {
        setSuppliers(supJson.data);
        setSupplierId(supJson.data[0].id);
        setSupplierName(supJson.data[0].name);
      }

      const prods: any[] = prodJson.products || prodJson.data || [];
      setProducts(prods);

      if (prods.length > 0) {
        const queryProdId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("productId") : null;
        const initialProd = queryProdId ? prods.find((p) => p.id === queryProdId) : null;
        if (initialProd) {
          const cost = Number(initialProd.purchasePrice || initialProd.costPrice || initialProd.averageCost || 0);
          const sellPrice = Number(initialProd.sellingPrice || initialProd.retailPrice || 0);
          const stock = Number(initialProd.currentStock || 0);
          setItems([
            {
              productId: initialProd.id,
              productName: initialProd.name,
              quantity: "",
              unitCost: cost,
              previousCost: cost,
              currentStock: stock,
              previousSellingPrice: sellPrice,
              newSellingPrice: sellPrice,
              updateCatalogPrice: true,
              lineTotal: 0,
            },
          ]);
        } else {
          // Start with blank product & blank quantity (POS/Wholesale style)
          setItems([
            {
              productId: "",
              productName: "",
              quantity: "",
              unitCost: 0,
              previousCost: 0,
              currentStock: 0,
              previousSellingPrice: 0,
              newSellingPrice: 0,
              updateCatalogPrice: true,
              lineTotal: 0,
            },
          ]);
        }
        setPaidAmount(0);
      } else {
        setItems([]);
      }
    } catch (err: any) {
      console.error(err);
      setError("Failed to load suppliers and products catalog.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeCompany?.id]);

  const filteredProducts = useMemo(() => {
    if (!productSearchTerm.trim()) return products;
    const term = productSearchTerm.toLowerCase();
    return products.filter(
      (p) =>
        p.name?.toLowerCase().includes(term) ||
        p.sku?.toLowerCase().includes(term) ||
        p.barcode?.toLowerCase().includes(term)
    );
  }, [products, productSearchTerm]);

  const matchingProducts = useMemo(() => {
    if (activeSearchRow === null || !items[activeSearchRow]) return [];
    const q = (items[activeSearchRow].productName || "").trim().toLowerCase();
    if (!q) return products.slice(0, 25);
    return products
      .filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          (p.sku ? p.sku.toLowerCase().includes(q) : false) ||
          (p.barcode ? p.barcode.toLowerCase().includes(q) : false)
      )
      .slice(0, 25);
  }, [activeSearchRow, items, products]);

  const updateDropdownCoords = useCallback((index: number) => {
    const el = document.getElementById(`purchase-product-input-${index}`);
    if (el) {
      const rect = el.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - 10;
      const openBelow = spaceBelow >= 100 || spaceBelow >= rect.top - 10;
      const maxHeight = openBelow
        ? Math.min(220, Math.max(90, spaceBelow))
        : Math.min(220, Math.max(90, rect.top - 14));
      const dropWidth = Math.min(window.innerWidth - 16, Math.max(rect.width, 320));
      setDropdownCoords({
        top: openBelow ? rect.bottom + 4 : undefined,
        bottom: openBelow ? undefined : window.innerHeight - rect.top + 4,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - dropWidth - 8)),
        width: dropWidth,
        maxHeight,
      });
    }
  }, []);

  const openProductDropdown = useCallback(
    (index: number) => {
      setActiveSearchRow(index);
      setHighlightedProductIndex(0);
      updateDropdownCoords(index);
      setTimeout(() => updateDropdownCoords(index), 20);
    },
    [updateDropdownCoords]
  );

  useEffect(() => {
    if (activeSearchRow === null) return;
    const handleScrollOrResize = () => updateDropdownCoords(activeSearchRow);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [activeSearchRow, updateDropdownCoords]);

  const selectProductForRow = useCallback(
    (index: number, prod: any) => {
      const cost = Number(prod.purchasePrice || prod.costPrice || prod.averageCost || 0);
      const sellPrice = Number(prod.sellingPrice || prod.retailPrice || 0);
      const stock = Number(prod.currentStock || 0);

      setItems((prev) => {
        const next = [...prev];
        const qtyNum = next[index]?.quantity === "" ? 0 : Number(next[index]?.quantity || 0);
        next[index] = {
          ...next[index],
          productId: prod.id,
          productName: prod.name,
          unitCost: cost,
          previousCost: cost,
          currentStock: stock,
          previousSellingPrice: sellPrice,
          newSellingPrice: sellPrice,
          updateCatalogPrice: true,
          lineTotal: qtyNum * cost,
          uom: (prod.uom || prod.unit || "PCS").toUpperCase(),
        };
        return next;
      });
      setActiveSearchRow(null);
      setDropdownCoords(null);
      setTimeout(() => {
        document.getElementById(`purchase-qty-input-${index}`)?.focus();
      }, 40);
    },
    []
  );

  const handleProductNameInput = (index: number, value: string) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        productName: value,
        productId: "",
      };
      return next;
    });
  };

  const handleQtyChange = (index: number, rawVal: string) => {
    setItems((prev) => {
      const next = [...prev];
      if (rawVal === "") {
        next[index] = { ...next[index], quantity: "", lineTotal: 0 };
      } else {
        const q = parseFloat(rawVal);
        const safeQty = isNaN(q) ? 0 : Math.max(0, q);
        next[index] = {
          ...next[index],
          quantity: isNaN(q) ? "" : safeQty,
          lineTotal: safeQty * next[index].unitCost,
        };
      }
      return next;
    });
  };

  const handleCostChange = (index: number, cost: number) => {
    const newItems = [...items];
    const safeCost = Math.max(0, cost);
    newItems[index].unitCost = safeCost;
    const qtyNum = newItems[index].quantity === "" ? 0 : Number(newItems[index].quantity || 0);
    newItems[index].lineTotal = qtyNum * safeCost;

    // Suggest new selling price if not yet customized or zero
    if (!newItems[index].newSellingPrice || newItems[index].newSellingPrice === 0) {
      newItems[index].newSellingPrice = Math.round(safeCost * 1.25);
    }

    setItems(newItems);
  };

  const handleSellingPriceChange = (index: number, price: number) => {
    const newItems = [...items];
    newItems[index].newSellingPrice = Math.max(0, price);
    setItems(newItems);
  };

  const handleToggleUpdateCatalog = (index: number, checked: boolean) => {
    const newItems = [...items];
    newItems[index].updateCatalogPrice = checked;
    setItems(newItems);
  };

  // Keyboard shortcuts: Alt+A (add item), F9 / Ctrl+Enter (save bill), F8 (save/print)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        handleAddItem();
      } else if (e.key === "F9" || ((e.ctrlKey || e.metaKey) && e.key === "Enter")) {
        e.preventDefault();
        (document.getElementById("purchase-create-form") as HTMLFormElement | null)?.requestSubmit();
      } else if (e.key === "F8") {
        e.preventDefault();
        const form = document.getElementById("purchase-create-form") as HTMLFormElement | null;
        if (form) {
          form.requestSubmit();
        } else {
          window.print();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [products]);

  const handleAddItem = (prodIdToSelect?: string) => {
    if (products.length === 0) {
      alert("No products found in catalog. Please create products in Products & Rates first.");
      return;
    }

    const targetProd = prodIdToSelect ? products.find((p) => p.id === prodIdToSelect) : null;

    if (targetProd) {
      const cost = Number(targetProd.purchasePrice || targetProd.costPrice || targetProd.averageCost || 0);
      const sellPrice = Number(targetProd.sellingPrice || targetProd.retailPrice || 0);
      const stock = Number(targetProd.currentStock || 0);

      setItems((prev) => [
        ...prev,
        {
          productId: targetProd.id,
          productName: targetProd.name,
          quantity: "",
          unitCost: cost,
          previousCost: cost,
          currentStock: stock,
          previousSellingPrice: sellPrice,
          newSellingPrice: sellPrice,
          updateCatalogPrice: true,
          lineTotal: 0,
          uom: (targetProd.uom || targetProd.unit || "PCS").toUpperCase(),
        },
      ]);
    } else {
      setItems((prev) => [
        ...prev,
        {
          productId: "",
          productName: "",
          quantity: "",
          unitCost: 0,
          previousCost: 0,
          currentStock: 0,
          previousSellingPrice: 0,
          newSellingPrice: 0,
          updateCatalogPrice: true,
          lineTotal: 0,
          uom: "PCS",
        },
      ]);
    }
  };

  const handleQuickCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupName.trim()) return;
    setIsAddingSupplier(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (activeCompany?.id) headers["x-business-id"] = activeCompany.id;
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: newSupName.trim(),
          businessName: newSupBusiness.trim() || undefined,
          phone: newSupPhone.trim() || undefined,
          address: newSupAddress.trim() || undefined,
          openingBalance: 0,
        }),
      });
      const result = await res.json();
      if (result.success && result.data) {
        const created = result.data;
        setSuppliers((prev) => [created, ...prev]);
        setSupplierId(created.id);
        setSupplierName(created.name);
        setShowAddSupplierModal(false);
        setNewSupName("");
        setNewSupBusiness("");
        setNewSupPhone("");
        setNewSupAddress("");
      } else {
        alert(result.error || "Failed to create supplier");
      }
    } catch (err: any) {
      alert(err.message || "Failed to create supplier");
    } finally {
      setIsAddingSupplier(false);
    }
  };

  const handleQuickCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim()) return;
    setIsAddingProduct(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (activeCompany?.id) headers["x-business-id"] = activeCompany.id;
      const cost = parseFloat(newProdCost) || 0;
      const price = parseFloat(newProdPrice) || (cost > 0 ? cost * 1.2 : 0);
      const stock = parseFloat(newProdStock) || 0;
      const res = await fetch("/api/products", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: newProdName.trim(),
          sku: newProdSku.trim() || `SKU-${Date.now().toString().slice(-6)}`,
          purchasePrice: cost,
          costPrice: cost,
          sellingPrice: price,
          retailPrice: price,
          currentStock: stock,
          openingQuantity: stock,
          uom: newProdUom || "pcs",
          hsCode: "8517.13",
          status: "ACTIVE",
        }),
      });
      const result = await res.json();
      if (result.success && (result.data || result.product)) {
        const created = result.data || result.product;
        setProducts((prev) => [created, ...prev]);
        setItems((prev) => [
          ...prev,
          {
            productId: created.id,
            productName: created.name,
            quantity: 1,
            unitCost: cost,
            previousCost: cost,
            currentStock: stock,
            previousSellingPrice: price,
            newSellingPrice: price,
            updateCatalogPrice: true,
            lineTotal: cost,
            uom: (newProdUom || "PCS").toUpperCase(),
          },
        ]);
        setShowAddProductModal(false);
        setNewProdName("");
        setNewProdSku("");
        setNewProdCost("");
        setNewProdPrice("");
        setNewProdStock("");
        setNewProdUom("pcs");
      } else {
        alert(result.error || "Failed to create product");
      }
    } catch (err: any) {
      alert(err.message || "Failed to create product");
    } finally {
      setIsAddingProduct(false);
    }
  };

  const totalAmount = items.reduce((acc, it) => acc + it.lineTotal, 0);
  const remainingPayable = Math.max(0, totalAmount - paidAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (activeCompany?.id) {
        headers["x-business-id"] = activeCompany.id;
      }
      const operatingBranchId = isBranchLocked ? (user?.branchId || null) : (purchaseBranchId || effectiveBranch || null);
      if (operatingBranchId) {
        headers["x-branch-id"] = operatingBranchId;
      }

      if (items.length === 0) {
        setError("Please add at least one registered product to the purchase bill.");
        setSubmitting(false);
        return;
      }

      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (!it.productId || it.productId === "__custom__") {
          setError(`Item #${i + 1}: Please select a product from the catalog.`);
          setSubmitting(false);
          return;
        }
        if (it.quantity === "" || Number(it.quantity) <= 0) {
          setError(`Item #${i + 1} (${it.productName || "Product"}): Quantity add karo (must be greater than 0).`);
          setSubmitting(false);
          return;
        }
      }

      const payload = {
        branchId: operatingBranchId,
        createdById: user?.userId,
        createdByName: user?.name,
        date: new Date(date),
        supplierId,
        supplierName,
        items: items.map((it) => ({
          productId: it.productId,
          productName: it.productName,
          quantity: Number(it.quantity),
          unitCost: it.unitCost,
          previousCost: it.previousCost,
          newSellingPrice: it.newSellingPrice,
          updateCatalogPrice: it.updateCatalogPrice,
        })),
        paidAmount,
        paymentMethod,
        dueDate: totalAmount - paidAmount > 0 && dueDate ? new Date(dueDate) : undefined,
        notes,
      };

      const res = await fetch("/api/purchases", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to record purchase bill.");

      invalidateCache();

      router.push("/purchases");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Helper metrics calculator
  const getItemAnalysis = (it: PurchaseItem) => {
    const qty = Number(it.quantity || 1);
    const newCost = Number(it.unitCost || 0);
    const oldCost = Number(it.previousCost || newCost);
    const oldStock = Number(it.currentStock || 0);
    const newSell = Number(it.newSellingPrice || 0);

    const costDiff = newCost - oldCost;
    const costDiffPct = oldCost > 0 ? (costDiff / oldCost) * 100 : 0;

    // Weighted Average Cost
    const totalQty = Math.max(0, oldStock) + qty;
    const totalCostValuation = (Math.max(0, oldStock) * oldCost) + (qty * newCost);
    const weightedAvg = totalQty > 0 ? totalCostValuation / totalQty : newCost;

    // Profit on new batch
    const newProfit = newSell - newCost;
    const newMarginPct = newSell > 0 ? (newProfit / newSell) * 100 : 0;

    // Profit on old stock
    const oldStockProfit = newSell - oldCost;
    const oldStockMarginPct = newSell > 0 ? (oldStockProfit / newSell) * 100 : 0;

    // Extra profit per unit from old stock
    const extraProfitPerUnit = oldStockProfit - newProfit; // equal to cost increase
    const totalOldStockExtra = extraProfitPerUnit * Math.max(0, oldStock);

    return {
      costDiff,
      costDiffPct,
      totalQty,
      weightedAvg,
      newProfit,
      newMarginPct,
      oldStockProfit,
      oldStockMarginPct,
      extraProfitPerUnit,
      totalOldStockExtra,
      hasOldStock: oldStock > 0,
      costChanged: Math.abs(costDiff) > 0.01,
      costIncreased: costDiff > 0.01,
      costDecreased: costDiff < -0.01,
    };
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <BrandPageLoader
          message="Loading Purchase Order Terminal..."
          submessage="Retrieving vendor accounts, product catalogs, and inventory valuation rates..."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/purchases"
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 transition shadow-2xs"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Record Purchase Bill
              </h1>
              <span className="rounded-md bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[11px] font-bold text-indigo-700 dark:bg-indigo-950/50 dark:border-indigo-800 dark:text-indigo-300">
                {activeCompany?.name || "Active Company"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Select existing catalog products or add new stock, track repurchasing price changes, recalculate weighted average costs, and update selling rates.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/purchases/import"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
          >
            Bulk Import (CSV)
          </Link>
        </div>
      </div>

      {/* Active Branch Scope Indicator & Receiving Officer Attribution */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 text-xs text-indigo-950 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-200">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white uppercase">
            {user?.name?.charAt(0) || "U"}
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-900 dark:text-white">{user?.name || "Purchaser"}</span>
              <span className="rounded bg-indigo-200/80 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-900 dark:bg-indigo-900 dark:text-indigo-200">
                {user?.role?.replace("_", " ") || "STAFF"}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">{t("Receiving Officer", "خریداری و وصولی کنندہ")}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Destination Outlet:</span>
          {isBranchLocked ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-3 py-1 font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
              <Building2 className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300" />
              <span>{user?.branchName || "Assigned Branch"} (LOCKED)</span>
            </span>
          ) : (
            <div className="min-w-[200px]">
              <select
                value={purchaseBranchId}
                onChange={(e) => setPurchaseBranchId(e.target.value)}
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

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-700 dark:bg-rose-950/40 shadow-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form
        id="purchase-create-form"
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
            e.preventDefault();
          }
        }}
        className="space-y-6"
      >
        {/* Supplier & Bill Metadata */}
        <Card className="shadow-xs border-slate-200 bg-white dark:bg-slate-900">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Supplier & Purchase Metadata
            </CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAddSupplierModal(true)}
              className="gap-1.5 text-xs font-semibold bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-300"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Supplier</span>
            </Button>
          </CardHeader>
          <CardContent className="pt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Select
                label="Select Supplier"
                value={supplierId}
                onChange={(e) => {
                  setSupplierId(e.target.value);
                  const s = suppliers.find((sup) => sup.id === e.target.value);
                  if (s) setSupplierName(s.name);
                }}
              >
                {suppliers.length === 0 ? (
                  <option value="">No suppliers registered yet</option>
                ) : (
                  [...suppliers]
                    .sort((a, b) => Number(b.currentBalance || 0) - Number(a.currentBalance || 0))
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {Number(s.currentBalance || 0) > 0
                          ? `⚠️ ${s.name} ${s.businessName ? `(${s.businessName})` : ""} (Pending Payable: ${formatMoney(s.currentBalance)})`
                          : `✅ ${s.name} ${s.businessName ? `(${s.businessName})` : ""} (All Clear: Rs 0)`}
                      </option>
                    ))
                )}
              </Select>
              {(() => {
                const selSup = suppliers.find((s) => s.id === supplierId);
                if (!selSup) return null;
                const due = Number(selSup.currentBalance || 0);
                return (
                  <div
                    className={`mt-1.5 flex items-center justify-between rounded-lg border px-3 py-1.5 text-xs ${
                      due > 0
                        ? "border-amber-200 bg-amber-50/80 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                        : "border-emerald-200 bg-emerald-50/80 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{due > 0 ? "⚠️" : "✅"}</span>
                      <span className="font-semibold">Supplier Ledger Balance:</span>
                      <span className="font-bold">
                        {due > 0 ? formatMoney(due) : "Rs 0.00 (All Dues Cleared)"}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
            <div>
              <Input
                label="Purchase Date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </CardContent>
        </Card>

        {/* Stock Items Section */}
        <Card className="shadow-xs border-slate-200 bg-white dark:bg-slate-900">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Purchased Products & Inventory Inward
                </CardTitle>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-mono font-bold text-slate-700">
                  {items.length} {items.length === 1 ? "Item" : "Items"}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Pick products from catalog to auto-fill pricing, or adjust buying costs with live weighted average and margin differentiation.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddProductModal(true)}
                className="gap-1.5 font-bold text-xs bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300"
              >
                <Plus className="h-3.5 w-3.5" /> New Product
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAddItem()}
                className="gap-1.5 font-bold text-xs bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-300"
              >
                <Plus className="h-3.5 w-3.5" /> Add Product Item
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {/* Quick Filter Bar for products */}
            <div className="px-4 py-2.5 bg-slate-50/75 border-b border-slate-100 dark:bg-slate-950/40 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Search className="h-3.5 w-3.5 text-slate-400" />
                <span>Search catalog to quickly add:</span>
                <input
                  type="text"
                  placeholder="Filter products (e.g., iPhone, Camon, Redmi)..."
                  value={productSearchTerm}
                  onChange={(e) => setProductSearchTerm(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-56 dark:border-slate-700 dark:bg-slate-900"
                />
              </div>

              {productSearchTerm && (
                <div className="flex items-center gap-1.5 overflow-x-auto max-w-full text-xs">
                  <span className="text-[11px] text-slate-400">Suggestions:</span>
                  {filteredProducts.slice(0, 3).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        handleAddItem(p.id);
                        setProductSearchTerm("");
                      }}
                      className="inline-flex items-center gap-1 rounded-md bg-white border border-indigo-200 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50 transition shadow-2xs"
                    >
                      <Plus className="h-3 w-3" /> {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Line items list */}
            {items.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <p className="text-xs text-slate-500 font-medium">
                  {products.length === 0
                    ? "No products registered in catalog yet. Please add a product in Products & Rates first."
                    : "No items added to this purchase bill yet."}
                </p>
                {products.length === 0 ? (
                  <Link
                    href="/products/create"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{t("Register New Product First", "پہلے پراڈکٹ ایڈ کریں")}</span>
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleAddItem()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add Product Item</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((item, idx) => {
                  const analysis = getItemAnalysis(item);

                  return (
                    <div
                      key={idx}
                      className="p-4 sm:p-5 hover:bg-slate-50/40 transition-colors space-y-3.5"
                    >
                      {/* Main Row Inputs */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end">
                        {/* Searchable Product Combobox (POS/Wholesale Style) */}
                        <div className="md:col-span-4 space-y-1">
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center justify-between">
                            <span>Product / Stock Item</span>
                            <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                              {item.productId ? `In Stock: ${item.currentStock} pcs` : t("Type to search...", "تلاش کریں...")}
                            </span>
                          </label>

                          <div className="relative">
                            <input
                              id={`purchase-product-input-${idx}`}
                              type="text"
                              value={item.productName}
                              onFocus={() => openProductDropdown(idx)}
                              onChange={(e) => {
                                handleProductNameInput(idx, e.target.value);
                                setHighlightedProductIndex(0);
                                openProductDropdown(idx);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "ArrowDown") {
                                  e.preventDefault();
                                  if (activeSearchRow !== idx) {
                                    openProductDropdown(idx);
                                  } else if (matchingProducts.length > 0) {
                                    setHighlightedProductIndex((prev) => {
                                      const next = Math.min(prev + 1, matchingProducts.length - 1);
                                      setTimeout(
                                        () => document.getElementById(`purchase-product-option-${next}`)?.scrollIntoView({ block: "nearest" }),
                                        0
                                      );
                                      return next;
                                    });
                                  }
                                } else if (e.key === "ArrowUp") {
                                  e.preventDefault();
                                  if (activeSearchRow === idx && matchingProducts.length > 0) {
                                    setHighlightedProductIndex((prev) => {
                                      const next = Math.max(prev - 1, 0);
                                      setTimeout(
                                        () => document.getElementById(`purchase-product-option-${next}`)?.scrollIntoView({ block: "nearest" }),
                                        0
                                      );
                                      return next;
                                    });
                                  }
                                } else if (e.key === "Enter") {
                                  e.preventDefault();
                                  if (activeSearchRow === idx && matchingProducts.length > 0) {
                                    const selectedProd = matchingProducts[highlightedProductIndex] || matchingProducts[0];
                                    const alreadyExactMatch =
                                      item.productId &&
                                      selectedProd &&
                                      item.productId === selectedProd.id &&
                                      (item.productName || "").trim().toLowerCase() === (selectedProd.name || "").trim().toLowerCase();
                                    if (!alreadyExactMatch) {
                                      selectProductForRow(idx, selectedProd);
                                      return;
                                    }
                                  }
                                  setActiveSearchRow(null);
                                  setDropdownCoords(null);
                                  document.getElementById(`purchase-qty-input-${idx}`)?.focus();
                                } else if (e.key === "Escape" || e.key === "Tab") {
                                  setActiveSearchRow(null);
                                  setDropdownCoords(null);
                                }
                              }}
                              placeholder={t("Type product name or SKU...", "پروڈکٹ کا نام لکھیں...")}
                              autoComplete="off"
                              className="w-full rounded-lg border border-slate-300 bg-white pl-2.5 pr-8 py-2 text-xs font-semibold text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                            />
                            <button
                              type="button"
                              tabIndex={-1}
                              onClick={() => {
                                if (activeSearchRow === idx) {
                                  setActiveSearchRow(null);
                                  setDropdownCoords(null);
                                } else {
                                  openProductDropdown(idx);
                                }
                              }}
                              className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                      {/* Inward Qty (Blank by default, Enter moves to Unit Cost) */}
                      <div className="md:col-span-2 space-y-1">
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                          Inward Qty
                        </label>
                        <input
                          id={`purchase-qty-input-${idx}`}
                          type="number"
                          min="1"
                          step="any"
                          value={item.quantity === "" ? "" : item.quantity}
                          onChange={(e) => handleQtyChange(idx, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              document.getElementById(`purchase-cost-input-${idx}`)?.focus();
                            }
                          }}
                          placeholder="0"
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-xs font-bold text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        />
                      </div>

                      {/* Unit Purchase Cost (New Buying) */}
                      <div className="md:col-span-2 space-y-1">
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center justify-between">
                          <span>Unit Cost (New Buying)</span>
                          {analysis.costChanged && (
                            <span
                              className={`text-[10px] font-bold px-1 rounded ${
                                analysis.costIncreased
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-emerald-100 text-emerald-800"
                              }`}
                            >
                              {analysis.costIncreased ? `+${analysis.costDiffPct.toFixed(1)}%` : `${analysis.costDiffPct.toFixed(1)}%`}
                            </span>
                          )}
                        </label>
                        <div className="relative">
                          <input
                            id={`purchase-cost-input-${idx}`}
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unitCost || ""}
                            onChange={(e) => handleCostChange(idx, parseFloat(e.target.value) || 0)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                document.getElementById(`purchase-sell-input-${idx}`)?.focus();
                              }
                            }}
                            placeholder="0"
                            className={`w-full rounded-lg border px-3 py-2 text-right text-xs font-mono font-bold text-slate-900 dark:bg-slate-900 dark:text-white ${
                              analysis.costIncreased
                                ? "border-amber-400 bg-amber-50/20"
                                : analysis.costDecreased
                                ? "border-emerald-400 bg-emerald-50/20"
                                : "border-slate-300 bg-white"
                            }`}
                          />
                        </div>
                      </div>

                      {/* New Selling Price & Update Catalog Checkbox */}
                      <div className="md:col-span-2 space-y-1">
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center justify-between">
                          <span>New Selling Price</span>
                          {item.newSellingPrice > 0 && item.unitCost > 0 && (
                            <span className="text-[10px] font-bold text-emerald-600">
                              {analysis.newMarginPct.toFixed(1)}% margin
                            </span>
                          )}
                        </label>
                        <input
                          id={`purchase-sell-input-${idx}`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.newSellingPrice || ""}
                          onChange={(e) => handleSellingPriceChange(idx, parseFloat(e.target.value) || 0)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              if (idx === items.length - 1) {
                                handleAddItem();
                                setTimeout(() => {
                                  document.getElementById(`purchase-product-input-${idx + 1}`)?.focus();
                                }, 60);
                              } else {
                                document.getElementById(`purchase-product-input-${idx + 1}`)?.focus();
                              }
                            }
                          }}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-right text-xs font-mono font-bold text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                          placeholder="e.g. 52000"
                        />
                      </div>

                      {/* Line Total & Remove */}
                      <div className="md:col-span-2 flex items-center justify-between gap-2">
                        <div className="space-y-1 text-right flex-1">
                          <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Line Total
                          </span>
                          <span className="block font-mono font-bold text-sm text-slate-900 dark:text-white tabular-nums">
                            {formatMoney(item.lineTotal)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => items.length > 1 && setItems(items.filter((_, i) => i !== idx))}
                          disabled={items.length <= 1}
                          className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-20 transition"
                          title="Remove item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Rich Pricing, Profit Margin & Stock Differentiation Card */}
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/40 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-3">
                          {/* Cost Shift Badge */}
                          <div className="inline-flex items-center gap-1.5 text-[11px]">
                            <span className="text-slate-500">Previous Cost:</span>
                            <span className="font-mono font-semibold text-slate-700">
                              Rs {item.previousCost.toLocaleString()}
                            </span>
                            <span className="text-slate-400">➔</span>
                            <span className="font-mono font-bold text-slate-900">
                              Rs {item.unitCost.toLocaleString()}
                            </span>
                            {analysis.costChanged && (
                              <span
                                className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 font-semibold text-[10px] ${
                                  analysis.costIncreased
                                    ? "bg-amber-100 text-amber-800 border border-amber-200"
                                    : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                }`}
                              >
                                {analysis.costIncreased ? (
                                  <TrendingUp className="h-3 w-3 inline" />
                                ) : (
                                  <TrendingDown className="h-3 w-3 inline" />
                                )}
                                {analysis.costIncreased ? "+" : ""}
                                Rs {Math.abs(analysis.costDiff).toLocaleString()} ({analysis.costDiffPct > 0 ? "+" : ""}
                                {analysis.costDiffPct.toFixed(1)}%)
                              </span>
                            )}
                          </div>

                          {/* Blended WAC */}
                          <div className="inline-flex items-center gap-1 rounded-md bg-blue-50/80 border border-blue-200 px-2 py-0.5 text-[11px] text-blue-900 font-medium dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300">
                            <Calculator className="h-3 w-3 text-blue-600" />
                            <span>Blended WAC:</span>
                            <strong className="font-mono font-bold text-blue-700 dark:text-blue-200">
                              Rs {Math.round(analysis.weightedAvg).toLocaleString()}
                            </strong>
                            <span className="text-[10px] text-blue-600">({analysis.totalQty} pcs blended)</span>
                          </div>
                        </div>

                        {/* Catalog Sync Checkbox */}
                        <label className="inline-flex items-center gap-2 cursor-pointer select-none text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={item.updateCatalogPrice}
                            onChange={(e) => handleToggleUpdateCatalog(idx, e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                          />
                          <span>Update Product Catalog Selling Price to Rs {item.newSellingPrice.toLocaleString()}</span>
                        </label>
                      </div>

                      {/* Dual Profit Margin Breakdown */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-800">
                        {/* New Batch Margin */}
                        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-[11px] dark:bg-slate-900 dark:border-slate-700">
                          <span className="text-slate-500">
                            New Batch Margin ({item.quantity} {item.uom || "units"} @ Rs {item.unitCost.toLocaleString()}):
                          </span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            Rs {analysis.newProfit.toLocaleString()} / {item.uom || "unit"} ({analysis.newMarginPct.toFixed(1)}%)
                          </span>
                        </div>

                        {/* Old Stock Margin (if any old stock exists) */}
                        <div
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-[11px] ${
                            analysis.hasOldStock && analysis.costIncreased
                              ? "bg-emerald-50/80 border-emerald-200 text-emerald-900 font-medium dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200"
                              : "bg-white border-slate-200 text-slate-700 dark:bg-slate-900 dark:border-slate-700"
                          }`}
                        >
                          <span className="flex items-center gap-1">
                            {analysis.hasOldStock && analysis.costIncreased && (
                              <Sparkles className="h-3 w-3 text-emerald-600" />
                            )}
                            Old Stock Margin ({item.currentStock} {item.uom || "units"} @ Rs {item.previousCost.toLocaleString()}):
                          </span>
                          <span className="font-mono font-bold">
                            Rs {analysis.oldStockProfit.toLocaleString()} / {item.uom || "unit"} ({analysis.oldStockMarginPct.toFixed(1)}%)
                          </span>
                        </div>
                      </div>

                      {/* Real-world Business Owner Insight Banner */}
                      {analysis.hasOldStock && analysis.costIncreased && (
                        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-100/60 border border-emerald-300 text-[11px] text-emerald-900 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-200 font-sans">
                          <Info className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                          <span>
                            <strong>Old Stock Advantage:</strong> Because you already own {item.currentStock} {item.uom || "units"} purchased at Rs {item.previousCost.toLocaleString()}, selling them at the new market rate (Rs {item.newSellingPrice.toLocaleString()}) earns you an extra <strong>Rs {analysis.extraProfitPerUnit.toLocaleString()} profit per {item.uom || "unit"}</strong> (+Rs {analysis.totalOldStockExtra.toLocaleString()} total windfall) compared to the newly purchased batch!
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
        </Card>

        {/* Viewport-fixed slim below-input floating dropdown for Purchase Product Search */}
        {activeSearchRow !== null && dropdownCoords !== null && (
          <>
            <div
              className="fixed inset-0 z-[9998] bg-transparent"
              onClick={() => {
                setActiveSearchRow(null);
                setDropdownCoords(null);
              }}
            />
            <div
              style={{
                position: "fixed",
                top: dropdownCoords.top !== undefined ? `${dropdownCoords.top}px` : "auto",
                bottom: dropdownCoords.bottom !== undefined ? `${dropdownCoords.bottom}px` : "auto",
                left: `${dropdownCoords.left}px`,
                width: `${dropdownCoords.width}px`,
                maxHeight: `${dropdownCoords.maxHeight}px`,
              }}
              className="z-[9999] overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 ring-1 ring-indigo-500/30"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
                <span className="flex items-center gap-1">
                  <Search className="h-3 w-3 text-indigo-600" />
                  {t("Products", "پروڈکٹس")} ({matchingProducts.length})
                  <span className="hidden md:inline">• ↑↓ Enter</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveSearchRow(null);
                    setDropdownCoords(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 text-xs px-1"
                >
                  ✕
                </button>
              </div>

              {matchingProducts.length === 0 ? (
                <div className="p-2.5 text-center text-xs text-slate-500 dark:text-slate-400">
                  <p className="font-semibold">{t("No catalog match found", "کیٹلاگ میں کوئی آئٹم نہیں ملا")}</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {matchingProducts.map((prod, pIdx) => {
                    const isHighlighted = pIdx === highlightedProductIndex;
                    const cost = Number(prod.purchasePrice || prod.costPrice || prod.averageCost || 0);
                    return (
                      <div
                        id={`purchase-product-option-${pIdx}`}
                        key={prod.id}
                        onMouseEnter={() => setHighlightedProductIndex(pIdx)}
                        onClick={() => {
                          if (activeSearchRow !== null) {
                            selectProductForRow(activeSearchRow, prod);
                          }
                        }}
                        className={`px-2.5 py-1.5 cursor-pointer transition flex items-center justify-between gap-2 text-left ${
                          isHighlighted
                            ? "bg-indigo-50 dark:bg-indigo-950/60 border-l-2 border-indigo-600"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                        }`}
                      >
                        <span
                          className={`text-xs font-semibold truncate flex-1 ${
                            isHighlighted ? "text-indigo-700 dark:text-indigo-300" : "text-slate-900 dark:text-white"
                          }`}
                        >
                          {prod.name}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 shrink-0 tabular-nums">
                          Qty: <strong className="text-slate-700 dark:text-slate-200">{prod.currentStock ?? 0}</strong>
                        </span>
                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 shrink-0 tabular-nums min-w-[70px] text-right">
                          Rs. {cost.toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* Payment & Bill Settlement Cards */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Payment Details */}
          <Card className="shadow-xs border-slate-200 bg-white dark:bg-slate-900">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Payment & Settlement
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div>
                <Select
                  label="Payment Method"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="CASH">Cash in Hand</option>
                  <option value="BANK">Bank Transfer / Online Account</option>
                </Select>
              </div>
              <div>
                <Input
                  label="Amount Paid to Supplier Immediately"
                  type="number"
                  step="0.01"
                  min="0"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <span>Quick Fill:</span>
                  <div className="space-x-1.5">
                    <button
                      type="button"
                      onClick={() => setPaidAmount(totalAmount)}
                      className="font-bold text-indigo-600 hover:underline"
                    >
                      Full Amount ({formatMoney(totalAmount)})
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => setPaidAmount(0)}
                      className="text-slate-600 hover:underline"
                    >
                      Credit / Unpaid (0)
                    </button>
                  </div>
                </div>
              </div>

              {/* Payment Promise Date (Due Date) for Remaining Payables */}
              {totalAmount - paidAmount > 0 && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3 text-xs dark:border-indigo-900/60 dark:bg-indigo-950/30">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      {t("Payment Due Date", "ادائیگی کی وعدہ تاریخ")}:
                    </span>
                    <span className="text-[11px] font-bold text-rose-600">
                      Payable: {formatMoney(totalAmount - paidAmount)}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center gap-2">
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      className="w-full rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-indigo-800 dark:bg-slate-900 dark:text-white"
                    />
                    <div className="flex items-center gap-1 flex-wrap shrink-0">
                      {[
                        { label: "+7 Days", days: 7 },
                        { label: "+15 Days", days: 15 },
                        { label: "+30 Days", days: 30 },
                      ].map((preset) => {
                        const target = new Date();
                        target.setDate(target.getDate() + preset.days);
                        const targetStr = target.toISOString().split("T")[0];
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => setDueDate(targetStr)}
                            className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                              dueDate === targetStr
                                ? "bg-indigo-600 text-white"
                                : "border border-indigo-200 bg-white text-indigo-800 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-slate-900 dark:text-indigo-300"
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <p className="mt-1.5 text-[10px] text-indigo-700/80 dark:text-indigo-400">
                    💡 {t("A dashboard reminder and alert will be triggered on this date to settle supplier payables.", "اس تاریخ پر ڈیش بورڈ اور سسٹم الرٹ میں ریمائنڈر ملے گا کہ سپلائر کو بقایا رقم ادا کرنی ہے۔")}
                  </p>
                </div>
              )}

              <div>
                <Input
                  label="Purchase Bill Notes / Tracking"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., Courier Bilty #, Warranty remarks, Batch No..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Financial Summary & Posting */}
          <Card className="shadow-xs border-slate-200 bg-slate-50/75 dark:bg-slate-900/50 flex flex-col justify-between">
            <CardHeader className="pb-3 border-b border-slate-200/60 dark:border-slate-800">
              <CardTitle className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Bill Summary & Accounts Impact
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <div className="flex justify-between text-base font-bold text-slate-900 dark:text-white">
                <span>Total Inward Bill</span>
                <span className="text-indigo-600 font-mono tabular-nums text-lg">
                  {formatMoney(totalAmount)}
                </span>
              </div>
              <div className="flex justify-between text-xs font-semibold text-emerald-600">
                <span>Disbursed Immediately</span>
                <span className="font-mono tabular-nums">{formatMoney(paidAmount)}</span>
              </div>
              <div className="flex justify-between text-xs font-bold text-rose-600 border-t border-slate-200 pt-2 dark:border-slate-800">
                <span>Added to Supplier Payable</span>
                <span className="font-mono tabular-nums">{formatMoney(remainingPayable)}</span>
              </div>

              <div className="rounded-xl bg-white border border-slate-200 p-3 text-[11px] text-slate-600 space-y-1 dark:bg-slate-900 dark:border-slate-800">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                  <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Automatic Double-Entry Posting:</span>
                </div>
                <p className="text-[10px] text-slate-500">
                  • Debit <strong>Merchandise Inventory (1200)</strong> for {formatMoney(totalAmount)}
                  <br />
                  • Credit <strong>Cash/Bank (1010/1020)</strong> for {formatMoney(paidAmount)}
                  <br />
                  • Credit <strong>Accounts Payable (2010)</strong> for {formatMoney(remainingPayable)}
                </p>
              </div>
            </CardContent>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full font-bold shadow-md bg-indigo-600 hover:bg-indigo-700 text-white"
                isLoading={submitting}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Post Purchase & Inward Stock
              </Button>
            </div>
          </Card>
        </div>
      </form>

      {/* Quick Add Supplier Modal */}
      <Modal
        isOpen={showAddSupplierModal}
        onClose={() => setShowAddSupplierModal(false)}
        title={t("Quick Add Supplier", "نیا سپلائر درج کریں")}
        description="Add a new vendor or supplier to your system without leaving this purchase bill."
        maxWidth="md"
      >
        <form onSubmit={handleQuickCreateSupplier} className="space-y-4">
          <Input
            label="Supplier / Contact Name *"
            value={newSupName}
            onChange={(e) => setNewSupName(e.target.value)}
            placeholder="e.g. Tariq Goods / Tariq Mahmood"
            required
            autoFocus
          />
          <Input
            label="Business / Company Name"
            value={newSupBusiness}
            onChange={(e) => setNewSupBusiness(e.target.value)}
            placeholder="e.g. Tariq Traders & Importers"
          />
          <Input
            label="Phone / Mobile Number"
            value={newSupPhone}
            onChange={(e) => setNewSupPhone(e.target.value)}
            placeholder="e.g. 0300-1234567"
          />
          <Input
            label="Address / City"
            value={newSupAddress}
            onChange={(e) => setNewSupAddress(e.target.value)}
            placeholder="e.g. Circular Road, Lahore"
          />
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAddSupplierModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isAddingSupplier}
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              Save Supplier
            </Button>
          </div>
        </form>
      </Modal>

      {/* Quick Add Product Modal */}
      <Modal
        isOpen={showAddProductModal}
        onClose={() => setShowAddProductModal(false)}
        title={t("Quick Add Product", "نیا پروڈکٹ درج کریں")}
        description="Add a new catalog product directly into your inventory and insert it into this purchase bill."
        maxWidth="lg"
      >
        <form onSubmit={handleQuickCreateProduct} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Input
                label="Product Name *"
                value={newProdName}
                onChange={(e) => setNewProdName(e.target.value)}
                placeholder="e.g. Steel Pipe 2 inch / A4 Paper Ream"
                required
                autoFocus
              />
            </div>
            <Input
              label="SKU / Barcode"
              value={newProdSku}
              onChange={(e) => setNewProdSku(e.target.value)}
              placeholder="e.g. PRD-9001 (auto if empty)"
            />
            <Select
              label="Unit of Measure"
              value={newProdUom}
              onChange={(e) => setNewProdUom(e.target.value)}
            >
              <option value="pcs">Pieces (pcs)</option>
              <option value="kg">Kilogram (kg)</option>
              <option value="box">Box / Carton</option>
              <option value="meter">Meter (m)</option>
              <option value="liter">Liter (L)</option>
              <option value="pack">Pack</option>
              <option value="bag">Bag / Bori</option>
            </Select>
            <Input
              label="Purchase / Cost Price (Rs) *"
              type="number"
              step="any"
              min="0"
              value={newProdCost}
              onChange={(e) => setNewProdCost(e.target.value)}
              placeholder="e.g. 500"
              required
            />
            <Input
              label="Selling / Retail Price (Rs)"
              type="number"
              step="any"
              min="0"
              value={newProdPrice}
              onChange={(e) => setNewProdPrice(e.target.value)}
              placeholder="e.g. 650 (optional)"
            />
            <Input
              label="Initial / Existing Stock"
              type="number"
              step="any"
              min="0"
              value={newProdStock}
              onChange={(e) => setNewProdStock(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAddProductModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isAddingProduct}
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              Save & Add to Bill
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
