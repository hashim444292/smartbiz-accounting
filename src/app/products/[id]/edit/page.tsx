"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Package,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Save,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { BrandPageLoader } from "@/components/ui/loader";

export default function EditProductPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params?.id as string;
  const { activeCompany } = useAuth();

  const [categories, setCategories] = useState<any[]>([]);
  const [orgDefaults, setOrgDefaults] = useState<any>({ defaultHsCode: "8517.13" });
  const [loading, setLoading] = useState(true);

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
    purchasePrice: 0,
    wholesalePrice: 0,
    retailPrice: 0,
    status: "ACTIVE",
  });

  const [isHsCodeCustom, setIsHsCodeCustom] = useState(false);
  const [hsCodeSource, setHsCodeSource] = useState<"ORGANIZATION" | "CATEGORY" | "PRODUCT">("PRODUCT");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [metaRes, prodRes] = await Promise.all([
          fetch("/api/products?meta=true"),
          fetch(`/api/products/${productId}`),
        ]);

        const metaJson = await metaRes.json();
        const prodJson = await prodRes.json();

        if (metaJson.success && metaJson.data) {
          setCategories(metaJson.data.categories || []);
          setOrgDefaults(metaJson.data.organization || { defaultHsCode: "8517.13" });
        }

        if (prodJson.success && prodJson.data) {
          const p = prodJson.data;
          setFormData({
            name: p.name || "",
            sku: p.sku || "",
            productCode: p.productCode || "",
            barcode: p.barcode || "",
            categoryId: p.categoryId || "",
            brand: p.brand || "",
            description: p.description || "",
            uom: p.uom || p.unit || "pcs",
            hsCode: p.hsCode || "",
            taxProfile: p.taxProfile || "Standard 18%",
            salesTax: Number(p.salesTax || 18),
            furtherTax: Number(p.furtherTax || 0),
            extraTax: Number(p.extraTax || 0),
            purchasePrice: Number(p.purchasePrice || 0),
            wholesalePrice: Number(p.wholesalePrice || 0),
            retailPrice: Number(p.sellingPrice || p.retailPrice || 0),
            status: p.status || (p.isActive ? "ACTIVE" : "ARCHIVED"),
          });

          // Check if current HS Code matches org default or category default
          const cat = metaJson.data?.categories?.find((c: any) => c.id === p.categoryId);
          if (cat?.defaultHsCode && p.hsCode === cat.defaultHsCode) {
            setHsCodeSource("CATEGORY");
            setIsHsCodeCustom(false);
          } else if (p.hsCode === metaJson.data?.organization?.defaultHsCode) {
            setHsCodeSource("ORGANIZATION");
            setIsHsCodeCustom(false);
          } else {
            setHsCodeSource("PRODUCT");
            setIsHsCodeCustom(true);
          }
        }
      } catch (err) {
        console.error("Failed to load product for editing:", err);
      } finally {
        setLoading(false);
      }
    }

    if (productId) loadData();
  }, [productId, activeCompany?.id]);

  const handleHsCodeInput = (value: string) => {
    setFormData((prev) => ({ ...prev, hsCode: value }));
    const selectedCat = categories.find((c) => c.id === formData.categoryId);
    const inheritedDefault = selectedCat?.defaultHsCode || orgDefaults.defaultHsCode;

    if (value.trim() === inheritedDefault?.trim()) {
      setIsHsCodeCustom(false);
      setHsCodeSource(selectedCat?.defaultHsCode ? "CATEGORY" : "ORGANIZATION");
    } else {
      setIsHsCodeCustom(true);
      setHsCodeSource("PRODUCT");
    }
  };

  const handleResetToDefault = () => {
    const selectedCat = categories.find((c) => c.id === formData.categoryId);
    const defaultHs = selectedCat?.defaultHsCode || orgDefaults.defaultHsCode || "8517.13";

    setFormData((prev) => ({ ...prev, hsCode: defaultHs }));
    setIsHsCodeCustom(false);
    setHsCodeSource(selectedCat?.defaultHsCode ? "CATEGORY" : "ORGANIZATION");
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setErrors({ name: "Product name is required" });
      return;
    }
    if (!formData.hsCode?.trim()) {
      setErrors({ hsCode: "HS Code is required" });
      return;
    }

    setIsSaving(true);
    setSaveSuccess(null);

    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to update product");
      }

      setSaveSuccess("Product updated successfully");
      setTimeout(() => {
        router.push(`/products/${productId}`);
      }, 1000);
    } catch (err: any) {
      setErrors({ submit: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <BrandPageLoader
          message="Loading Product Details..."
          submessage="Retrieving item SKU, pricing tiers, stock valuation, and FBR tax mapping..."
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
            href={`/products/${productId}`}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Product Details</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">
            Edit Product
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Modify product pricing, HS classification, or tax parameters.
          </p>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {errors.submit && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-rose-600" />
          <span>{errors.submit}</span>
        </div>
      )}

      {/* Basic Info */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
          Product Details
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Product Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
            <select
              value={formData.categoryId}
              onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
            >
              <option value="">Unassigned</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.defaultHsCode ? `(HS: ${c.defaultHsCode})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">SKU</label>
            <input
              type="text"
              value={formData.sku}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* HS Code & Classification */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
          HS Code & Classification
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">
                HS Code <span className="text-rose-500">*</span>
              </label>
              {isHsCodeCustom && (
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700"
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
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:border-indigo-500 focus:outline-none"
            />

            <div className="mt-2 text-[11px]">
              {hsCodeSource === "PRODUCT" && (
                <span className="text-amber-800 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Custom product HS Code
                </span>
              )}
              {hsCodeSource === "CATEGORY" && (
                <span className="text-indigo-700 font-medium bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  Using category default ({formData.hsCode})
                </span>
              )}
              {hsCodeSource === "ORGANIZATION" && (
                <span className="text-indigo-700 font-medium bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  Using organization default ({orgDefaults.defaultHsCode || "8517.13"})
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">UOM</label>
            <input
              type="text"
              value={formData.uom}
              onChange={(e) => setFormData({ ...formData, uom: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Pricing & Tax */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
          Pricing & Tax Rates
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Retail Price (PKR)</label>
            <input
              type="number"
              value={formData.retailPrice}
              onChange={(e) => setFormData({ ...formData, retailPrice: Number(e.target.value) })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Wholesale Price (PKR)</label>
            <input
              type="number"
              value={formData.wholesalePrice}
              onChange={(e) => setFormData({ ...formData, wholesalePrice: Number(e.target.value) })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Sales Tax (%)</label>
            <input
              type="number"
              value={formData.salesTax}
              onChange={(e) => setFormData({ ...formData, salesTax: Number(e.target.value) })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md shadow-lg px-4 py-3 sm:px-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link
            href={`/products/${productId}`}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition"
          >
            Cancel
          </Link>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2 text-xs font-bold text-white shadow-md hover:bg-indigo-700 shadow-indigo-600/30 transition disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>{isSaving ? "Saving..." : "Update Product"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
