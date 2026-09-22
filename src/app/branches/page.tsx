"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Plus,
  ArrowLeft,
  Search,
  Check,
  Edit2,
  Trash2,
  ShieldAlert,
  Users,
  MapPin,
  Phone,
  Mail,
  UserCheck,
  TrendingUp,
  CreditCard,
  ExternalLink,
  DollarSign,
  AlertCircle,
  X,
  Store,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth, Branch } from "@/context/AuthContext";
import { BrandPageLoader } from "@/components/ui/loader";

export default function BranchesManagementPage() {
  const router = useRouter();
  const { user, activeCompany, switchBranch, activeBranchId, refreshSession } = useAuth();

  const [branches, setBranches] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<any | null>(null);

  // Form State
  const initialFormState = {
    name: "",
    code: "",
    address: "",
    city: "Karachi",
    phone: "",
    email: "",
    managerName: "",
    isActive: true,
  };
  const [formData, setFormData] = useState(initialFormState);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchBranchesAndStaff = async () => {
    try {
      setLoading(true);
      const [branchRes, staffRes] = await Promise.all([
        fetch("/api/branches").then((r) => r.json()),
        fetch("/api/admin/users").then((r) => r.json()).catch(() => ({ success: false, data: [] })),
      ]);

      if (branchRes.success) {
        setBranches(branchRes.data || []);
      }
      if (staffRes.success) {
        // Filter users belonging to this business
        const compUsers = (staffRes.data || []).filter((u: any) =>
          u.companyIds?.includes(activeCompany?.id || "")
        );
        setUsers(compUsers);
      }
    } catch (err) {
      console.error("Failed to load branches:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranchesAndStaff();
  }, [activeCompany?.id]);

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      if (data.success) {
        setAddModalOpen(false);
        setFormData(initialFormState);
        await fetchBranchesAndStaff();
        if (refreshSession) await refreshSession();
      } else {
        setFormError(data.error || "Failed to create branch");
      }
    } catch (err: any) {
      setFormError(err.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranch) return;
    setFormError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/branches/${selectedBranch.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      if (data.success) {
        setEditModalOpen(false);
        setSelectedBranch(null);
        await fetchBranchesAndStaff();
        if (refreshSession) await refreshSession();
      } else {
        setFormError(data.error || "Failed to update branch");
      }
    } catch (err: any) {
      setFormError(err.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBranch = async (branchId: string, name: string) => {
    if (!confirm(`Are you sure you want to remove or deactivate branch "${name}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/branches/${branchId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        await fetchBranchesAndStaff();
        if (refreshSession) await refreshSession();
      } else {
        alert(data.error || "Failed to delete branch");
      }
    } catch (err: any) {
      alert(err.message || "Network error");
    }
  };

  const handleAssignUser = async (userId: string, isCurrentlyAssigned: boolean) => {
    if (!selectedBranch) return;
    try {
      const res = await fetch(`/api/branches/${selectedBranch.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          action: isCurrentlyAssigned ? "unassign" : "assign",
        }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchBranchesAndStaff();
      } else {
        alert(data.error || "Failed to update user assignment");
      }
    } catch (err: any) {
      alert(err.message || "Network error");
    }
  };

  const openEdit = (b: any) => {
    setSelectedBranch(b);
    setFormData({
      name: b.name || "",
      code: b.code || "",
      address: b.address || "",
      city: b.city || "Karachi",
      phone: b.phone || "",
      email: b.email || "",
      managerName: b.managerName || "",
      isActive: b.isActive !== undefined ? b.isActive : true,
    });
    setEditModalOpen(true);
  };

  const openAssign = (b: any) => {
    setSelectedBranch(b);
    setAssignModalOpen(true);
  };

  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const canCreateBranches = Boolean(activeCompany?.canCreateBranches) || isSuperAdmin;

  const filteredBranches = branches.filter((b) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      b.name?.toLowerCase().includes(q) ||
      b.code?.toLowerCase().includes(q) ||
      b.city?.toLowerCase().includes(q) ||
      b.managerName?.toLowerCase().includes(q)
    );
  });

  const totalNetworkSales = branches.reduce((sum, b) => sum + (Number(b.totalSales) || 0), 0);
  const totalNetworkExpenses = branches.reduce((sum, b) => sum + (Number(b.totalExpenses) || 0), 0);
  const totalStaffAssigned = branches.reduce((sum, b) => sum + (b.staffCount || 0), 0);

  if (loading) {
    return <BrandPageLoader message="Loading sub-branches and outlets..." />;
  }

  // If company is NOT authorized by Super Admin:
  if (!canCreateBranches) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto py-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-black text-slate-900">
              Sub-Branches Management (ذیلی برانچز کا انتظام)
            </h1>
            <p className="text-xs text-slate-500">
              Company: {activeCompany?.name || "Your Company"}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-8 text-center space-y-4 shadow-sm">
          <div className="h-16 w-16 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h2 className="text-lg font-black text-amber-900">
              Multi-Branch Feature Locked (ملٹی برانچ فیچر غیر فعال ہے)
            </h2>
            <p className="text-xs text-amber-800 leading-relaxed">
              Your company account currently does not have authorization to create sub-branches. Sub-branch management is an enterprise multi-location feature authorized by the Super Admin.
            </p>
            <p className="text-xs font-urdu text-amber-900 font-semibold pt-1">
              اس فیچر کو فعال کروانے کے لیے برائے مہربانی پلیٹ فارم سپر ایڈمن سے رابطہ فرمائیں۔
            </p>
          </div>

          <div className="pt-4 flex items-center justify-center gap-3">
            <Link
              href="/"
              className="px-4 py-2 rounded-xl bg-white border border-amber-300 text-amber-900 font-bold text-xs hover:bg-amber-100 transition"
            >
              Back to Dashboard
            </Link>
            {isSuperAdmin && (
              <Link
                href="/admin/companies"
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition"
              >
                Go to Admin Companies to Enable
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition shadow-2xs"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900">
                Sub-Branches Management (ذیلی برانچز)
              </h1>
              <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200">
                Multi-Branch Active
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Managing outlets for: <span className="font-bold text-slate-800">{activeCompany?.name}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setFormData(initialFormState);
              setFormError(null);
              setAddModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition shadow-xs flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span>Add New Branch (نئی برانچ بنائیں)</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Total Sub-Branches
              </span>
              <div className="h-8 w-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Store className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">{branches.length}</span>
              <span className="text-[11px] font-semibold text-slate-500">locations</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 font-medium">
              {branches.filter((b) => b.isActive).length} currently active
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Network Sales (All Branches)
              </span>
              <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-600">
                Rs {totalNetworkSales.toLocaleString()}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Aggregated across all registered branches
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Network Expenses
              </span>
              <div className="h-8 w-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <CreditCard className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-rose-600">
                Rs {totalNetworkExpenses.toLocaleString()}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Total operational expenditure
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Branch Assigned Staff
              </span>
              <div className="h-8 w-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-purple-700">{totalStaffAssigned}</span>
              <span className="text-[11px] font-semibold text-slate-500">employees</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Locked to designated branch records
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search branch name, code, city, or manager..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 shadow-xs focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <button
          onClick={fetchBranchesAndStaff}
          className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition self-end sm:self-auto"
          title="Refresh List"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Branches Grid */}
      {filteredBranches.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center space-y-3">
          <Store className="h-10 w-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">No Sub-Branches Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Get started by adding your first branch or outlet for this company to enable branch-wise isolation and reporting.
          </p>
          <button
            onClick={() => setAddModalOpen(true)}
            className="mt-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition inline-flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span>Add Branch Now</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBranches.map((branch) => {
            const isCurrentActive = activeBranchId === branch.id;

            return (
              <Card
                key={branch.id}
                className={`border rounded-2xl bg-white transition hover:shadow-md ${
                  isCurrentActive ? "ring-2 ring-indigo-500 border-indigo-400" : "border-slate-200"
                }`}
              >
                <CardContent className="p-5 space-y-4">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-sm">{branch.name}</h3>
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {branch.code}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                        <span>{branch.address ? `${branch.address}, ` : ""}{branch.city || "Karachi"}</span>
                      </p>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        branch.isActive
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 text-slate-500 border-slate-200"
                      }`}
                    >
                      {branch.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>

                  {/* Manager & Contact */}
                  <div className="text-xs space-y-1 py-2 border-y border-slate-100">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-[11px] text-slate-400 font-medium">Manager:</span>
                      <span className="font-bold text-slate-800">{branch.managerName || "Not Assigned"}</span>
                    </div>
                    {branch.phone && (
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-[11px] text-slate-400 font-medium">Phone:</span>
                        <span className="font-medium text-slate-700">{branch.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Branch Accounting Snapshot */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Sales</span>
                      <p className="font-black text-slate-900 text-xs">
                        Rs {Number(branch.totalSales || 0).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Expenses</span>
                      <p className="font-black text-rose-600 text-xs">
                        Rs {Number(branch.totalExpenses || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Assigned Staff Members */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                        <Users className="h-3 w-3 text-slate-400" />
                        <span>Assigned Staff ({branch.staffCount || 0})</span>
                      </span>
                      <button
                        onClick={() => openAssign(branch)}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 hover:underline"
                      >
                        + Assign / Edit
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {branch.staffMembers && branch.staffMembers.length > 0 ? (
                        branch.staffMembers.map((m: any) => (
                          <span
                            key={m.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200"
                          >
                            <UserCheck className="h-2.5 w-2.5" />
                            <span>{m.name}</span>
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">No staff assigned yet</span>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                    <button
                      onClick={() => switchBranch(branch.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                        isCurrentActive
                          ? "bg-indigo-600 text-white shadow-2xs"
                          : "bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
                      }`}
                      title="Filter whole application to this branch"
                    >
                      <span>{isCurrentActive ? "✓ Active View" : "Switch to Branch"}</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(branch)}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                        title="Edit Branch"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteBranch(branch.id, branch.name)}
                        className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition"
                        title="Delete Branch"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ADD BRANCH MODAL */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Store className="h-5 w-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Add New Sub-Branch (نئی برانچ بنائیں)</h3>
              </div>
              <button
                onClick={() => setAddModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBranch} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Branch Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Saddar Main Branch"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Branch Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. KHI-01"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-mono focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    City / Location *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Karachi"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Manager Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Tariq Mehmood"
                    value={formData.managerName}
                    onChange={(e) => setFormData({ ...formData, managerName: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. +92 300 1234567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Branch Email
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. saddar@business.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Street Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. Shop 14, Saddar Mobile Market"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-700 transition shadow-sm flex items-center gap-1.5"
                >
                  {submitting ? "Creating..." : "Create Branch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT BRANCH MODAL */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Edit2 className="h-5 w-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Edit Branch (برانچ میں ترمیم)</h3>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateBranch} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Branch Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Branch Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-mono focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    City / Location *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Manager Name
                  </label>
                  <input
                    type="text"
                    value={formData.managerName}
                    onChange={(e) => setFormData({ ...formData, managerName: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Branch Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Street Address
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-700 transition shadow-sm flex items-center gap-1.5"
                >
                  {submitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGN USERS / STAFF MODAL */}
      {assignModalOpen && selectedBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Assign Staff to {selectedBranch.name}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Users assigned to this branch will only see and create records for this outlet.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAssignModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-3">
              <p className="text-xs text-slate-600 font-medium">
                Select company staff members to lock/assign to this branch:
              </p>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {users.map((u) => {
                  const isAssigned = u.branchId === selectedBranch.id;
                  const isAssignedOther = u.branchId && u.branchId !== selectedBranch.id;

                  return (
                    <div
                      key={u.id}
                      className={`flex items-center justify-between p-3 rounded-xl border transition ${
                        isAssigned
                          ? "bg-indigo-50/60 border-indigo-200"
                          : "bg-white border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-xs text-slate-900">{u.name}</p>
                          <Badge variant="outline" className="text-[9px]">
                            {u.role}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-slate-500">{u.email}</p>
                        {isAssignedOther && (
                          <p className="text-[10px] text-amber-600 font-semibold mt-0.5">
                            Assigned to: {u.branchName || "Another Branch"}
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => handleAssignUser(u.id, isAssigned)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                          isAssigned
                            ? "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
                            : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-2xs"
                        }`}
                      >
                        {isAssigned ? "Remove from Branch" : "Assign to Branch"}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="pt-4 flex items-center justify-end border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
