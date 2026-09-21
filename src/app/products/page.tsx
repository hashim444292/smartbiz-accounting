"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Package,
  Plus,
  UploadCloud,
  Download,
  Search,
  Filter,
  Eye,
  Edit2,
  Archive,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  FolderPlus,
  Tag,
} from "lucide-react";
import { TableRowsSkeleton } from "@/components/ui/loader";
import { useAuth } from "@/context/AuthContext";
import { CategoryManagerModal } from "@/components/CategoryManagerModal";

export default function ProductsListPage() {
  const router = useRouter();
  const { activeCompany } = useAuth();

  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ACTIVE");

  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const qParams = new URLSearchParams({
        page: String(page),
        limit: "15",
        search,
        categoryId: selectedCategory,
        status: selectedStatus,
      });

      const res = await fetch(`/api/products?${qParams.toString()}`);
      const data = await res.json();
      if (data.success) {
        setProducts(data.products || []);
        setTotalPages(data.totalPages || 1);
        setTotalProducts(data.total || 0);
      }
    } catch (err) {
      console.error("Failed to load products:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadMeta = async () => {
    try {
      const res = await fetch(`/api/products?meta=true`);
      const data = await res.json();
      if (data.success && data.data?.categories) {
        setCategories(data.data.categories);
      }
    } catch (err) {
      console.error("Failed to load categories:", err);
    }
  };

  useEffect(() => {
    loadMeta();
  }, [activeCompany?.id]);

  useEffect(() => {
    loadProducts();
  }, [page, search, selectedCategory, selectedStatus, activeCompany?.id]);

  const handleArchive = async (id: string, currentlyArchived: boolean) => {
    try {
      const endpoint = currentlyArchived
        ? `/api/products/${id}?action=restore`
        : `/api/products/${id}`;
      const res = await fetch(endpoint, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setActionSuccess(currentlyArchived ? "Product restored to active" : "Product archived");
        setTimeout(() => setActionSuccess(null), 3000);
        loadProducts();
      }
    } catch (err) {
      console.error("Archive error:", err);
    }
  };

  const exportCsv = async () => {
    try {
      setIsExporting(true);
      // Fetch full catalog according to current filter or all
      const qParams = new URLSearchParams({
        page: "1",
        limit: "5000",
        search,
        categoryId: selectedCategory,
        status: selectedStatus,
      });

      const res = await fetch(`/api/products?${qParams.toString()}`);
      const data = await res.json();
      const listToExport = data.success && Array.isArray(data.products) && data.products.length > 0
        ? data.products
        : products;

      const headers = ["Name", "SKU", "Category", "HS Code", "UOM", "Retail Price", "Wholesale Price", "Purchase Price", "Stock", "Status"];
      const rows = listToExport.map((p: any) => [
        `"${(p.name || "").replace(/"/g, '""')}"`,
        `"${(p.sku || "").replace(/"/g, '""')}"`,
        `"${(p.category?.name || "Unassigned").replace(/"/g, '""')}"`,
        `"${p.hsCode || ""}"`,
        `"${p.uom || "pcs"}"`,
        p.retailPrice ?? p.sellingPrice ?? 0,
        p.wholesalePrice ?? 0,
        p.purchasePrice ?? 0,
        p.currentStock ?? 0,
        p.status || "ACTIVE",
      ]);

      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e: any) => e.join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `products_export_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Failed to export products:", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
              Master Data Catalog
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-slate-500 font-mono">
              Total {totalProducts} items registered
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">
            Products & HS Code Registry
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage inventory items, tariff classifications, tax profiles, and pricing tiers.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => setIsCategoryModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition"
          >
            <Tag className="h-3.5 w-3.5 text-indigo-600" />
            <span>Manage Categories</span>
          </button>

          <button
            type="button"
            onClick={exportCsv}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>{isExporting ? "Exporting..." : "Export CSV"}</span>
          </button>

          <Link
            href="/products/import"
            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition shadow-2xs"
          >
            <UploadCloud className="h-4 w-4" />
            <span>Import Products (CSV)</span>
          </Link>

          <Link
            href="/products/create"
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 shadow-indigo-100 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Add Product</span>
          </Link>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in font-medium">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search name, SKU, HS Code, barcode..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none transition"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none shadow-2xs"
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.defaultHsCode ? `(HS: ${c.defaultHsCode})` : ""}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none shadow-2xs"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active Only</option>
            <option value="ARCHIVED">Archived Only</option>
          </select>
        </div>
      </div>

      {/* Products Data Table */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] uppercase font-bold text-slate-500">
              <tr>
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-4">SKU / Code</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">HS Code</th>
                <th className="py-3 px-4">UOM</th>
                <th className="py-3 px-4 text-right">Tax Rate</th>
                <th className="py-3 px-4 text-right">Selling Price</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {loading ? (
                <TableRowsSkeleton rows={6} cols={9} />
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No products found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const isArchived = p.status === "ARCHIVED" || p.isActive === false;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-4">
                        <Link
                          href={`/products/${p.id}`}
                          className="font-semibold text-slate-900 hover:text-indigo-600 transition"
                        >
                          {p.name}
                        </Link>
                        {p.brand && (
                          <span className="block text-[10px] text-slate-400">{p.brand}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                        {p.sku || p.productCode || "—"}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {p.category?.name || "Unassigned"}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {p.hsCode ? (
                          <span className="inline-flex items-center gap-1 rounded bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 border border-indigo-200">
                            {p.hsCode}
                          </span>
                        ) : (
                          <span className="text-rose-500 text-[10px] font-bold">Missing</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500">{p.uom || p.unit || "pcs"}</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-700">
                        {p.salesTax ? `${p.salesTax}%` : "18%"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                        Rs {Number(p.sellingPrice || p.retailPrice || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded ${
                            isArchived
                              ? "bg-slate-100 text-slate-600 border border-slate-200"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          {isArchived ? "ARCHIVED" : "ACTIVE"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/products/${p.id}`}
                            className="rounded-lg p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                            title="View Details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Link>
                          <Link
                            href={`/products/${p.id}/edit`}
                            className="rounded-lg p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition"
                            title="Edit Product"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Link>
                          <button
                            onClick={() => handleArchive(p.id, isArchived)}
                            className={`rounded-lg p-1 transition ${
                              isArchived
                                ? "text-emerald-600 hover:bg-emerald-50"
                                : "text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            }`}
                            title={isArchived ? "Restore Product" : "Archive Product"}
                          >
                            {isArchived ? <RotateCcw className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Server-Side Pagination Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50/80 text-xs text-slate-600">
          <div>
            Showing Page <strong className="text-slate-900">{page}</strong> of <strong className="text-slate-900">{totalPages}</strong> ({totalProducts} total products)
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 shadow-2xs disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Previous</span>
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 shadow-2xs disabled:opacity-40"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Category Manager Modal */}
      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onCategoriesChanged={() => {
          loadMeta();
          loadProducts();
        }}
      />
    </div>
  );
}
