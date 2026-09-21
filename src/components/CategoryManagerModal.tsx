"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Tag, Layers, Check, AlertCircle, RefreshCw } from "lucide-react";

interface Category {
  id: string;
  name: string;
  description?: string;
  defaultHsCode?: string;
  productCount?: number;
}

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoriesChanged?: (categories: Category[]) => void;
  onSelectCategory?: (categoryId: string) => void;
  defaultHsCode?: string;
}

export function CategoryManagerModal({
  isOpen,
  onClose,
  onCategoriesChanged,
  onSelectCategory,
  defaultHsCode = "8517.13",
}: CategoryManagerModalProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New Category Form State
  const [name, setName] = useState("");
  const [hsCode, setHsCode] = useState(defaultHsCode);
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/categories");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setCategories(json.data);
        if (onCategoriesChanged) {
          onCategoriesChanged(json.data);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load categories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCategories();
      setHsCode(defaultHsCode);
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen, defaultHsCode]);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          defaultHsCode: hsCode.trim() || defaultHsCode,
          description: description.trim(),
        }),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Failed to create category");
      }

      setSuccessMsg(`Category "${name}" created successfully!`);
      setName("");
      setDescription("");

      // Refresh list
      const updatedListRes = await fetch("/api/categories");
      const updatedJson = await updatedListRes.json();
      if (updatedJson.success) {
        setCategories(updatedJson.data);
        if (onCategoriesChanged) onCategoriesChanged(updatedJson.data);
        if (onSelectCategory && json.data?.id) {
          onSelectCategory(json.data.id);
        }
      }
    } catch (err: any) {
      setError(err.message || "Error creating category");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCategory = async (cat: Category) => {
    if (
      !confirm(
        `Are you sure you want to delete category "${cat.name}"?\n\nExisting products will remain in your catalog but will become uncategorized.`
      )
    ) {
      return;
    }

    setDeletingId(cat.id);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/categories/${cat.id}`, {
        method: "DELETE",
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Failed to delete category");
      }

      setSuccessMsg(`Category "${cat.name}" deleted.`);

      // Refresh list
      const updatedListRes = await fetch("/api/categories");
      const updatedJson = await updatedListRes.json();
      if (updatedJson.success) {
        setCategories(updatedJson.data);
        if (onCategoriesChanged) onCategoriesChanged(updatedJson.data);
      }
    } catch (err: any) {
      setError(err.message || "Error deleting category");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Product Categories"
      description="Create custom product categories, configure default HS Codes, and delete unused categories."
      maxWidth="xl"
    >
      <div className="space-y-5 text-xs">
        {/* Alert Messages */}
        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-rose-900 font-medium">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-emerald-900 font-medium">
            <Check className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Add Category Form */}
        <form
          onSubmit={handleAddCategory}
          className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5 text-indigo-600" />
              <span>Add New Category</span>
            </h4>
            <span className="text-[10px] text-slate-500 font-medium">Custom User Categories</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Category Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Smart Watches, Audio, Laptops"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Default HS Code (FBR)
              </label>
              <input
                type="text"
                value={hsCode}
                onChange={(e) => setHsCode(e.target.value)}
                placeholder="e.g. 8517.13, 8517.62"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Description / Notes (Optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Wearable smart gadgets and tech accessories"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end pt-1">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-xs px-4"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Category
            </Button>
          </div>
        </form>

        {/* Existing Categories List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
              <Layers className="h-3.5 w-3.5 text-slate-500" />
              <span>Existing Categories ({categories.length})</span>
            </h4>
            <span className="text-[10px] text-slate-500">
              Click delete icon to remove unwanted category
            </span>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden max-h-60 overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center text-slate-400">Loading categories...</div>
            ) : categories.length === 0 ? (
              <div className="py-8 text-center text-slate-400">
                No categories found. Create your first category above!
              </div>
            ) : (
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase font-bold text-slate-500">
                  <tr>
                    <th className="py-2.5 px-3">Category Name</th>
                    <th className="py-2.5 px-3">Default HS Code</th>
                    <th className="py-2.5 px-3 text-center">Products</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {categories.map((cat) => (
                    <tr key={cat.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        <div>{cat.name}</div>
                        {cat.description && (
                          <div className="text-[10px] text-slate-400 font-normal">
                            {cat.description}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-indigo-600 font-medium">
                        {cat.defaultHsCode || "8517.13"}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 border border-slate-200">
                          {cat.productCount ?? 0} items
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(cat)}
                          disabled={deletingId === cat.id}
                          className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition"
                          title={`Delete category "${cat.name}"`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end pt-3 border-t border-slate-200">
          <Button type="button" variant="secondary" onClick={onClose} className="text-xs">
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}
