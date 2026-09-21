"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Package,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Percent,
  Layers,
  Save,
  Tag,
  UploadCloud,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { CategoryManagerModal } from "@/components/CategoryManagerModal";
import { BrandPageLoader } from "@/components/ui/loader";

export default function CreateProductPage() {
  const router = useRouter();
  const { activeCompany } = useAuth();

  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<any[]>([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [orgDefaults, setOrgDefaults] = useState<{
    defaultHsCode?: string;
    defaultUom?: string;
    defaultTaxProfile?: string;
    defaultSalesTax?: number;
    defaultFurtherTax?: number;
    defaultExtraTax?: number;
  }>({});

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    productCode: "",
    barcode: "",
    categoryId: "",
    brand: "",
    description: "",
    uom: "pcs",
    hsCode: "",
    taxProfile: "Standard 18%",
    salesTax: 18.0,
    furtherTax: 0.0,
    extraTax: 0.0,
    retailPrice: "",
    wholesalePrice: "",
    purchasePrice: "",
    openingQuantity: "",
    minStockLevel: "5",
    maxStockLevel: "",
    status: "ACTIVE",
  });

  const [hsCodeSource, setHsCodeSource] = useState<"PRODUCT" | "CATEGORY" | "ORGANIZATION" | "MISSING">("ORGANIZATION");
  const [isHsCodeCustom, setIsHsCodeCustom] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Load organization defaults and categories
  useEffect(() => {
    async function loadMeta() {
      try {
        const res = await fetch("/api/products?meta=true");
        const json = await res.json();
        if (json.success && json.data) {
          setCategories(json.data.categories || []);
          const org = json.data.organization || {};
          setOrgDefaults(org);

          // Initial inheritance from org default
          const defaultHs = org.defaultHsCode || "8517.13";
          setFormData((prev) => ({
            ...prev,
            hsCode: defaultHs,
            uom: org.defaultUom || "pcs",
            salesTax: org.defaultSalesTax ?? 18.0,
            furtherTax: org.defaultFurtherTax ?? 0.0,
            extraTax: org.defaultExtraTax ?? 0.0,
          }));
          setHsCodeSource("ORGANIZATION");
        }
      } catch (err) {
        console.error("Failed to load product metadata:", err);
      } finally {
        setLoading(false);
      }
    }
    loadMeta();
  }, [activeCompany?.id]);

  // Dynamic HS Code resolution when category changes
  const handleCategoryChange = (catId: string) => {
    setFormData((prev) => {
      const selectedCat = categories.find((c) => c.id === catId);
      let newHsCode = prev.hsCode;
      let newSource: any = hsCodeSource;

      if (!isHsCodeCustom) {
        if (selectedCat && selectedCat.defaultHsCode) {
          newHsCode = selectedCat.defaultHsCode;
          newSource = "CATEGORY";
        } else if (orgDefaults.defaultHsCode) {
          newHsCode = orgDefaults.defaultHsCode;
          newSource = "ORGANIZATION";
        } else {
          newHsCode = "";
          newSource = "MISSING";
        }
      }

      setHsCodeSource(newSource);
      return {
        ...prev,
        categoryId: catId,
        hsCode: newHsCode,
      };
    });
  };

  // User manually edits the HS Code field
  const handleHsCodeInput = (value: string) => {
    setFormData((prev) => ({ ...prev, hsCode: value }));
    if (value.trim().length > 0) {
      setIsHsCodeCustom(true);
      setHsCodeSource("PRODUCT");
    } else {
      setIsHsCodeCustom(false);
      // Revert to category or org default
      const selectedCat = categories.find((c) => c.id === formData.categoryId);
      if (selectedCat?.defaultHsCode) {
        setFormData((prev) => ({ ...prev, hsCode: selectedCat.defaultHsCode }));
        setHsCodeSource("CATEGORY");
      } else if (orgDefaults.defaultHsCode) {
        setFormData((prev) => ({ ...prev, hsCode: orgDefaults.defaultHsCode! }));
        setHsCodeSource("ORGANIZATION");
      } else {
        setHsCodeSource("MISSING");
      }
    }
  };

  // Reset to default HS Code
  const handleResetToDefault = () => {
    setIsHsCodeCustom(false);
    const selectedCat = categories.find((c) => c.id === formData.categoryId);
    if (selectedCat?.defaultHsCode) {
      setFormData((prev) => ({ ...prev, hsCode: selectedCat.defaultHsCode }));
      setHsCodeSource("CATEGORY");
    } else if (orgDefaults.defaultHsCode) {
      setFormData((prev) => ({ ...prev, hsCode: orgDefaults.defaultHsCode! }));
      setHsCodeSource("ORGANIZATION");
    } else {
      setFormData((prev) => ({ ...prev, hsCode: "" }));
      setHsCodeSource("MISSING");
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = "Product Name is required.";
    }
    if (!formData.hsCode?.trim()) {
      newErrors.hsCode = "Valid HS Code is required for tax & FBR compliance.";
    }
    if (!formData.retailPrice || Number(formData.retailPrice) < 0) {
      newErrors.retailPrice = "Valid retail selling price is required.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async (asDraft = false) => {
    if (!validate()) return;

    setIsSaving(true);
    setSaveSuccess(null);

    try {
      const payload = {
        ...formData,
        status: asDraft ? "DRAFT" : formData.status,
        retailPrice: Number(formData.retailPrice || 0),
        wholesalePrice: Number(formData.wholesalePrice || formData.retailPrice || 0),
        purchasePrice: Number(formData.purchasePrice || 0),
        salesTax: Number(formData.salesTax || 18),
        furtherTax: Number(formData.furtherTax || 0),
        extraTax: Number(formData.extraTax || 0),
      };

      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to save product");
      }

      setSaveSuccess(`Product '${json.data.name}' saved with HS Code ${json.data.hsCode}`);
      setTimeout(() => {
        router.push("/products");
      }, 1200);
    } catch (err: any) {
      setErrors((prev) => ({ ...prev, submit: err.message }));
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <BrandPageLoader
          message="Loading Product Catalog Configuration..."
          submessage="Fetching business tax profiles, HS Code categories, and inventory defaults..."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <Link
            href="/products"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Products</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">
            Add New Product
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Create an inventory item with automated HS Code classification and FBR tax rules.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/products/import"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition shadow-2xs"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Bulk Import (CSV)</span>
          </Link>

          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-right shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Org Default HS Code
            </span>
            <span className="font-mono text-xs font-bold text-indigo-600">
              {orgDefaults.defaultHsCode || "8517.13"}
            </span>
          </div>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <span className="font-semibold">{saveSuccess}</span>
        </div>
      )}

      {errors.submit && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
          <span>{errors.submit}</span>
        </div>
      )}

      {/* SECTION 1: PRODUCT INFORMATION */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            1. Product Information
          </h2>
          <p className="text-[11px] text-slate-500">Basic identification and categorization</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Product Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Samsung Galaxy S25 Ultra 512GB"
              className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none ${
                errors.name ? "border-rose-500" : "border-slate-200 focus:border-indigo-500"
              }`}
            />
            {errors.name && <p className="text-[11px] text-rose-500 mt-1">{errors.name}</p>}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                Category
              </label>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(true)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition"
              >
                <Tag className="w-3 h-3" />
                <span>+ Add / Manage Categories</span>
              </button>
            </div>
            <select
              value={formData.categoryId}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none shadow-2xs"
            >
              <option value="">Select Category...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.defaultHsCode ? `(HS: ${c.defaultHsCode})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Brand / Manufacturer
            </label>
            <input
              type="text"
              value={formData.brand}
              onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
              placeholder="e.g. Apple, Samsung, Tecno"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              SKU (Stock Keeping Unit)
            </label>
            <input
              type="text"
              value={formData.sku}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              placeholder="e.g. SAM-S25U-512"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 font-mono placeholder-slate-400 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Barcode / EAN
            </label>
            <input
              type="text"
              value={formData.barcode}
              onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
              placeholder="e.g. 8901234567890"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 font-mono placeholder-slate-400 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description / Specifications
            </label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional notes, warranty or specifications..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* SECTION 2: CLASSIFICATION & HS CODE INHERITANCE */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            2. Classification & HS Code
          </h2>
          <p className="text-[11px] text-slate-500">
            Harmonized System tariff code and unit of measurement
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* HS Code with Interactive Inheritance Feedback */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">
                HS Code <span className="text-rose-500">*</span>
              </label>
              {isHsCodeCustom && (
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Use Default</span>
                </button>
              )}
            </div>

            <input
              type="text"
              value={formData.hsCode}
              onChange={(e) => handleHsCodeInput(e.target.value)}
              placeholder="e.g. 8517.13"
              className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-xs text-slate-900 font-mono placeholder-slate-400 focus:outline-none ${
                errors.hsCode ? "border-rose-500" : "border-slate-200 focus:border-indigo-500"
              }`}
            />

            {/* Dynamic Source Indicator */}
            <div className="mt-2 flex items-center gap-1.5 text-[11px]">
              <span className="text-slate-400 font-mono">↳</span>
              {hsCodeSource === "ORGANIZATION" && (
                <span className="text-indigo-700 font-medium bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  Using organization default ({orgDefaults.defaultHsCode || "8517.13"})
                </span>
              )}
              {hsCodeSource === "CATEGORY" && (
                <span className="text-purple-700 font-medium bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                  Using category default ({formData.hsCode})
                </span>
              )}
              {hsCodeSource === "PRODUCT" && (
                <span className="text-amber-800 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Custom product HS Code (Overriding default)
                </span>
              )}
            </div>
            {errors.hsCode && <p className="text-[11px] text-rose-500 mt-1">{errors.hsCode}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Unit of Measure (UOM)
            </label>
            <select
              value={formData.uom}
              onChange={(e) => setFormData({ ...formData, uom: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none shadow-2xs"
            >
              <option value="pcs">Pieces (pcs)</option>
              <option value="box">Box (box)</option>
              <option value="kg">Kilograms (kg)</option>
              <option value="meter">Meters (meter)</option>
              <option value="pack">Pack (pack)</option>
            </select>
            <p className="text-[10px] text-slate-500 mt-1">Default UOM: {orgDefaults.defaultUom || "pcs"}</p>
          </div>
        </div>
      </div>

      {/* SECTION 3: PRICING */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            3. Pricing
          </h2>
          <p className="text-[11px] text-slate-500">
            Define customer retail price, wholesale price, and acquisition cost
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Retail Price (PKR) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              value={formData.retailPrice}
              onChange={(e) => setFormData({ ...formData, retailPrice: e.target.value })}
              placeholder="0.00"
              className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-xs text-slate-900 font-mono placeholder-slate-400 focus:outline-none ${
                errors.retailPrice ? "border-rose-500" : "border-slate-200 focus:border-indigo-500"
              }`}
            />
            {errors.retailPrice && <p className="text-[11px] text-rose-500 mt-1">{errors.retailPrice}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Wholesale Price (PKR)
            </label>
            <input
              type="number"
              value={formData.wholesalePrice}
              onChange={(e) => setFormData({ ...formData, wholesalePrice: e.target.value })}
              placeholder="0.00"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 font-mono placeholder-slate-400 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Purchase Cost (PKR)
            </label>
            <input
              type="number"
              value={formData.purchasePrice}
              onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
              placeholder="0.00"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 font-mono placeholder-slate-400 focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* SECTION 4: TAX CONFIGURATION */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            4. FBR Sales Tax Profile
          </h2>
          <p className="text-[11px] text-slate-500">
            Automated tax calculation for POS billing and invoices
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tax Profile
            </label>
            <select
              value={formData.taxProfile}
              onChange={(e) => setFormData({ ...formData, taxProfile: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none shadow-2xs"
            >
              <option value="Standard 18%">Standard 18% Sales Tax</option>
              <option value="Exempt 0%">Exempt / 0% Tax</option>
              <option value="Reduced Rate">Reduced Rate</option>
              <option value="Third Schedule">3rd Schedule (Retail Price)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Sales Tax (%)
            </label>
            <input
              type="number"
              value={formData.salesTax}
              onChange={(e) => setFormData({ ...formData, salesTax: Number(e.target.value) })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900 font-mono focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Further Tax (%)
            </label>
            <input
              type="number"
              value={formData.furtherTax}
              onChange={(e) => setFormData({ ...formData, furtherTax: Number(e.target.value) })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900 font-mono focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Extra Tax (%)
            </label>
            <input
              type="number"
              value={formData.extraTax}
              onChange={(e) => setFormData({ ...formData, extraTax: Number(e.target.value) })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900 font-mono focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* SECTION 5: STATUS */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Item Status</h2>
          <p className="text-[11px] text-slate-500">
            Active items appear in POS billing and inventory transactions
          </p>
        </div>

        <select
          value={formData.status}
          onChange={(e) => setFormData({ ...formData, status: e.target.value })}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none shadow-2xs"
        >
          <option value="ACTIVE">ACTIVE</option>
          <option value="ARCHIVED">ARCHIVED</option>
        </select>
      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md px-4 py-3 sm:px-8 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link
            href="/products"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition shadow-2xs"
          >
            Cancel
          </Link>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={isSaving}
              className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition disabled:opacity-50"
            >
              Save as Draft
            </button>

            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 shadow-indigo-100 transition disabled:opacity-50"
            >
              <Package className="h-4 w-4" />
              <span>{isSaving ? "Saving Product..." : "Save Product"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Category Manager Modal */}
      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        defaultHsCode={orgDefaults.defaultHsCode || "8517.13"}
        onCategoriesChanged={(cats) => setCategories(cats)}
        onSelectCategory={(catId) => handleCategoryChange(catId)}
      />
    </div>
  );
}
