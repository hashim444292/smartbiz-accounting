"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  Plus,
  ArrowLeft,
  Search,
  Check,
  Edit2,
  Trash2,
  ShieldCheck,
  Building2,
  AlertCircle,
  X,
  LogIn,
  Receipt,
  ShoppingCart,
  ShoppingBag,
  Wallet,
  Coins,
  Boxes,
  Truck,
  Package,
  BarChart3,
  BookOpen,
  Sparkles,
  Store,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { BrandPageLoader, TableSkeleton } from "@/components/ui/loader";

const USER_FEATURE_MODULES = [
  { id: "sales", label: "Sales & Invoicing", urdu: "سیلز اور انوائس بلز", desc: "کسٹمر بلنگ اور انوائسز", icon: Receipt },
  { id: "pos", label: "POS Counter (بل کاؤنٹر)", urdu: "پی او ایس ریٹیل بلنگ", desc: "فاسٹ ریٹیل کاؤنٹر اور بارکوڈ اسکین", icon: ShoppingCart },
  { id: "purchases", label: "Purchases & Bills", urdu: "خریداری اور سپلائر بلز", desc: "سپلائر بلنگ اور پرچیز واؤچرز", icon: ShoppingBag },
  { id: "payments", label: "Cash & Payments", urdu: "پیسے وصولی و ادائیگی", desc: "کسٹمر کیش وصولی اور سپلائر ادائیگیاں", icon: Wallet },
  { id: "expenses", label: "Daily Expenses", urdu: "دکان کے روزمرہ خرچے", desc: "چائے، بجلی، کرایہ، متفرق اخراجات", icon: Coins },
  { id: "inventory", label: "Inventory & Stock", urdu: "اسٹاک اور گودام مینجمنٹ", desc: "اسٹاک کاؤنٹ اور ویئرہاؤس موومنٹ", icon: Boxes },
  { id: "customers", label: "Customers (Khata)", urdu: "گاہکوں کا ادھار کھاتہ", desc: "گاہکوں کا لیجر، ادھار اور بیلنس", icon: Users },
  { id: "suppliers", label: "Suppliers (Khata)", urdu: "سپلائرز کا ادھار کھاتہ", desc: "سپلائرز کا کھاتہ اور واجب الادا رقوم", icon: Truck },
  { id: "products", label: "Products & Rates", urdu: "سامان و ریٹ لسٹ", desc: "آئٹم لسٹ، قیمتیں اور بارکوڈز", icon: Package },
  { id: "reports", label: "Closing & Reports", urdu: "کھاتہ بندش و منافع رپورٹ", desc: "روزمرہ رجسٹر، نفع نقصان اور بیلنس شیٹ", icon: BarChart3 },
  { id: "compliance", label: "FBR POS Digital", urdu: "FBR ڈیجیٹل انوائسنگ", desc: "ایف بی آر لائیو انوائسنگ و کیو آر کوڈ", icon: ShieldCheck },
  { id: "accounting", label: "General Ledger", urdu: "ڈبل انٹری جنرل لیجر", desc: "چارٹ آف اکاؤنٹس، جرنل واؤچرز، لیجر", icon: BookOpen },
  { id: "aiEntry", label: "AI Invoice Reader", urdu: "AI بل اسکینر", desc: "کیمرہ یا فائل سے خودکار بل اسکیننگ", icon: Sparkles },
  { id: "branches", label: "Sub-Branches", urdu: "آؤٹ لیٹس و برانچز", desc: "متعدد دکانیں اور برانچز کا انتظام", icon: Store },
];

const ROLE_PRESETS = [
  {
    name: "Platform Team Admin",
    urdu: "ٹیم ایڈمن (کمپنی مینجمنٹ و بلنگ)",
    role: "ADMIN",
    modules: [
      "sales",
      "pos",
      "purchases",
      "payments",
      "expenses",
      "inventory",
      "customers",
      "suppliers",
      "products",
      "reports",
      "compliance",
      "accounting",
      "aiEntry",
      "branches",
    ],
  },
  {
    name: "Cashier / POS",
    urdu: "کیشیئر / کاؤنٹر",
    role: "STAFF",
    modules: ["sales", "pos", "customers", "products"],
  },
  {
    name: "Salesman",
    urdu: "سیلز نمائندہ",
    role: "STAFF",
    modules: ["sales", "pos", "customers", "products", "payments"],
  },
  {
    name: "Accountant",
    urdu: "اکاؤنٹنٹ",
    role: "ACCOUNTANT",
    modules: [
      "sales",
      "purchases",
      "payments",
      "expenses",
      "customers",
      "suppliers",
      "products",
      "reports",
      "accounting",
    ],
  },
  {
    name: "Full Manager",
    urdu: "منیجر (تمام اختیارات)",
    role: "OWNER_ADMIN",
    modules: [
      "sales",
      "pos",
      "purchases",
      "payments",
      "expenses",
      "inventory",
      "customers",
      "suppliers",
      "products",
      "reports",
      "compliance",
      "accounting",
      "aiEntry",
      "branches",
    ],
  },
];

export default function UsersManagementPage() {
  const router = useRouter();
  const { user: currentLoggedUser, switchUser } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "STAFF",
    companyIds: [] as string[],
    allowedModules: ["sales", "pos", "customers", "products"] as string[],
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (currentLoggedUser && currentLoggedUser.role !== "SUPER_ADMIN") {
      router.replace("/");
    }
  }, [currentLoggedUser, router]);

  const fetchUsersAndCompanies = async () => {
    try {
      const [usrRes, compRes] = await Promise.all([
        fetch("/api/admin/users").then((r) => r.json()),
        fetch("/api/admin/companies").then((r) => r.json()),
      ]);

      if (usrRes.success) setUsers(usrRes.data || []);
      if (compRes.success) setCompanies(compRes.data || []);
    } catch (err) {
      console.error("Failed to load admin data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersAndCompanies();
  }, []);

  // Check assigned companies for current form state
  const assignedCompanies = companies.filter((c) => formData.companyIds.includes(c.id));

  // Determine if POS and DI (Digital Invoicing) are allowed based on selected company/companies
  const isPosOrDiAllowed =
    assignedCompanies.length === 0 ||
    assignedCompanies.some(
      (c) =>
        c.packageType === "FULL_SUITE" ||
        (c.enabledModules &&
          (c.enabledModules.includes("pos") || c.enabledModules.includes("compliance")))
    );

  // Available feature modules filtered strictly according to company package
  const availableModules = isPosOrDiAllowed
    ? USER_FEATURE_MODULES
    : USER_FEATURE_MODULES.filter((m) => m.id !== "pos" && m.id !== "compliance");

  // Available role presets filtered according to company package
  const availableRolePresets = isPosOrDiAllowed
    ? ROLE_PRESETS
    : ROLE_PRESETS.filter((p) => p.name !== "Cashier / POS").map((p) => ({
        ...p,
        modules: p.modules.filter((m) => m !== "pos" && m !== "compliance"),
      }));

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      // Ensure no forbidden modules if company is Accounting Only
      const sanitizedModules = isPosOrDiAllowed
        ? formData.allowedModules
        : formData.allowedModules.filter((m) => m !== "pos" && m !== "compliance");

      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, allowedModules: sanitizedModules }),
      });
      const data = await res.json();

      if (data.success) {
        setModalOpen(false);
        setFormData({
          name: "",
          email: "",
          password: "",
          role: "STAFF",
          companyIds: [],
          allowedModules: ["sales", "customers", "products"],
        });
        await fetchUsersAndCompanies();
      } else {
        setFormError(data.error || "Failed to create user");
      }
    } catch (err: any) {
      setFormError(err.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setFormError(null);
    setSubmitting(true);

    try {
      const sanitizedModules = isPosOrDiAllowed
        ? formData.allowedModules
        : formData.allowedModules.filter((m) => m !== "pos" && m !== "compliance");

      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, allowedModules: sanitizedModules }),
      });
      const data = await res.json();

      if (data.success) {
        setEditModalOpen(false);
        setSelectedUser(null);
        await fetchUsersAndCompanies();
      } else {
        setFormError(data.error || "Failed to update user");
      }
    } catch (err: any) {
      setFormError(err.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (currentLoggedUser && currentLoggedUser.userId === id) {
      alert("You cannot delete your own account while logged in.");
      return;
    }

    if (
      !confirm(
        `Are you sure you want to delete user "${name}"? Access will be immediately revoked.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (data.success) {
        await fetchUsersAndCompanies();
      } else {
        alert(data.error || "Failed to delete user");
      }
    } catch (err: any) {
      alert(err.message || "Failed to delete user");
    }
  };

  const openEditModal = (u: any) => {
    setSelectedUser(u);
    const assignedIds = u.companies ? u.companies.map((c: any) => c.id) : [];
    const assigned = companies.filter((c) => assignedIds.includes(c.id));
    const allowsPos =
      assigned.length === 0 ||
      assigned.some(
        (c) =>
          c.packageType === "FULL_SUITE" ||
          (c.enabledModules &&
            (c.enabledModules.includes("pos") || c.enabledModules.includes("compliance")))
      );

    let initialModules = allowsPos ? ["sales", "pos", "customers", "products"] : ["sales", "customers", "products"];
    if (Array.isArray(u.allowedModules) && u.allowedModules.length > 0) {
      initialModules = allowsPos
        ? u.allowedModules
        : u.allowedModules.filter((m: string) => m !== "pos" && m !== "compliance");
    } else if (u.role === "SUPER_ADMIN" || u.role === "OWNER_ADMIN") {
      initialModules = allowsPos
        ? USER_FEATURE_MODULES.map((m) => m.id)
        : USER_FEATURE_MODULES.filter((m) => m.id !== "pos" && m.id !== "compliance").map((m) => m.id);
    } else if (u.role === "ACCOUNTANT") {
      initialModules = [
        "sales",
        "purchases",
        "payments",
        "expenses",
        "customers",
        "suppliers",
        "products",
        "reports",
        "accounting",
      ];
    }

    setFormData({
      name: u.name || "",
      email: u.email || "",
      password: "",
      role: u.role || "STAFF",
      companyIds: assignedIds,
      allowedModules: initialModules,
    });
    setEditModalOpen(true);
  };

  const toggleCompanySelection = (id: string) => {
    setFormData((prev) => {
      const exists = prev.companyIds.includes(id);
      const nextIds = exists
        ? prev.companyIds.filter((item) => item !== id)
        : [...prev.companyIds, id];

      const assigned = companies.filter((c) => nextIds.includes(c.id));
      const allowsPos =
        assigned.length === 0 ||
        assigned.some(
          (c) =>
            c.packageType === "FULL_SUITE" ||
            (c.enabledModules &&
              (c.enabledModules.includes("pos") || c.enabledModules.includes("compliance")))
        );

      const nextAllowed = allowsPos
        ? prev.allowedModules
        : prev.allowedModules.filter((m) => m !== "pos" && m !== "compliance");

      return {
        ...prev,
        companyIds: nextIds,
        allowedModules: nextAllowed,
      };
    });
  };

  const toggleModuleSelection = (modId: string) => {
    setFormData((prev) => {
      const exists = prev.allowedModules.includes(modId);
      return {
        ...prev,
        allowedModules: exists
          ? prev.allowedModules.filter((item) => item !== modId)
          : [...prev.allowedModules, modId],
      };
    });
  };

  const applyRolePreset = (preset: (typeof ROLE_PRESETS)[0]) => {
    setFormData((prev) => ({
      ...prev,
      role: preset.role,
      allowedModules: [...preset.modules],
    }));
  };

  const roleBadgeColor = (role?: string) => {
    switch (role) {
      case "SUPER_ADMIN":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200";
      case "ADMIN":
        return "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border-indigo-200";
      case "OWNER_ADMIN":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200";
      case "ACCOUNTANT":
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200";
      default:
        return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200";
    }
  };

  const filtered = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.role.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (companyFilter !== "ALL") {
      if (!u.companies || u.companies.length === 0) {
        return u.role === "SUPER_ADMIN" || u.role === "ADMIN";
      }
      return u.companies.some((c: any) => c.id === companyFilter);
    }

    return true;
  });

  if (currentLoggedUser && currentLoggedUser.role !== "SUPER_ADMIN") {
    return (
      <div className="p-12 text-center">
        <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <AlertCircle className="mx-auto h-8 w-8 text-rose-500 mb-3" />
          <h2 className="text-base font-bold text-slate-900">Access Restricted</h2>
          <p className="text-xs text-slate-500 mt-1">
            User Accounts & Permissions Management is exclusively available to Platform Super Administrators.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <BrandPageLoader
          message="Loading User & Role Directory..."
          submessage="Retrieving multi-tenant users, role permissions, and company assignments..."
        />
        <TableSkeleton rows={6} cols={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Admin Portal</span>
          </Link>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <Users className="h-6 w-6 text-purple-600" />
            <span>User Accounts & Module Permissions Management</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Add team members, select exact tabs/features each user can access (POS, Sales, Purchases, Khata, Ledger), and assign corporate access.
          </p>
        </div>

        <button
          onClick={() => {
            const firstComp = companies.length > 0 ? companies[0] : null;
            const allowsPos =
              !firstComp ||
              firstComp.packageType === "FULL_SUITE" ||
              (firstComp.enabledModules &&
                (firstComp.enabledModules.includes("pos") || firstComp.enabledModules.includes("compliance")));

            setFormData({
              name: "",
              email: "",
              password: "",
              role: "STAFF",
              companyIds: firstComp ? [firstComp.id] : [],
              allowedModules: allowsPos
                ? ["sales", "pos", "customers", "products"]
                : ["sales", "customers", "products"],
            });
            setFormError(null);
            setModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-purple-700 transition"
        >
          <Plus className="h-4 w-4" />
          <span>Add New User</span>
        </button>
      </div>

      {/* Search & Company Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search user by name, email, or role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-500 whitespace-nowrap flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5 text-slate-400" />
              <span>Company:</span>
            </label>
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="ALL">All Companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.packageType === "ACCOUNTING_ONLY" ? "(Accounting Only)" : "(Full Suite)"}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-500">
          Showing: <strong className="text-slate-800 dark:text-slate-200">{filtered.length}</strong> of {users.length} Users
        </div>
      </div>

      {/* Users Data Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900 text-slate-500">
                <th className="py-3.5 px-4 font-bold uppercase tracking-wider">User Profile</th>
                <th className="py-3.5 px-4 font-bold uppercase tracking-wider">System Role</th>
                <th className="py-3.5 px-4 font-bold uppercase tracking-wider">Allowed Modules (اختیارات)</th>
                <th className="py-3.5 px-4 font-bold uppercase tracking-wider">Assigned Companies</th>
                <th className="py-3.5 px-4 font-bold uppercase tracking-wider">Joined</th>
                <th className="py-3.5 px-4 font-bold uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((u) => {
                const isSelf = currentLoggedUser?.userId === u.id;
                const hasModules = Array.isArray(u.allowedModules) && u.allowedModules.length > 0;
                return (
                  <tr key={u.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/60 transition">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-purple-700 font-bold dark:bg-purple-900/40 dark:text-purple-300 shrink-0">
                          {u.name ? u.name.charAt(0).toUpperCase() : "U"}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                            <span>{u.name}</span>
                            {isSelf && (
                              <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded font-bold">
                                You
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-slate-400">{u.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2.5 py-1 text-[10px] font-bold rounded-lg border ${roleBadgeColor(
                          u.role
                        )}`}
                      >
                        {u.role}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-1 max-w-[280px]">
                        {u.role === "SUPER_ADMIN" ? (
                          <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">
                            ⭐ Super Admin (Protected Master)
                          </span>
                        ) : u.role === "ADMIN" ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                              <ShieldCheck className="h-3.5 w-3.5" />
                              Platform Team Admin
                            </span>
                            <span className="text-[10px] text-slate-500">
                              Manages Companies, Billing & Auditing
                            </span>
                          </div>
                        ) : hasModules ? (
                          <div>
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800">
                                <ShieldCheck className="h-3 w-3" />
                                <span>{u.allowedModules.length} Modules Allowed</span>
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {u.allowedModules.slice(0, 4).map((modId: string) => {
                                const found = USER_FEATURE_MODULES.find((m) => m.id === modId);
                                return (
                                  <span
                                    key={modId}
                                    className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-medium text-slate-600 dark:text-slate-400"
                                  >
                                    {found ? found.label.split(" ")[0] : modId}
                                  </span>
                                );
                              })}
                              {u.allowedModules.length > 4 && (
                                <span className="text-[10px] text-slate-400 font-semibold self-center">
                                  +{u.allowedModules.length - 4} more
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">
                            Default Standard Permissions
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1 max-w-[240px]">
                        {u.companies && u.companies.length > 0 ? (
                          u.companies.map((c: any) => (
                            <span
                              key={c.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-medium text-slate-700 dark:text-slate-300"
                            >
                              <Building2 className="h-3 w-3 text-blue-500" />
                              <span className="truncate max-w-[120px]">{c.name}</span>
                              {c.packageType === "ACCOUNTING_ONLY" && (
                                <span className="text-[8px] bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 px-1 rounded font-bold">
                                  Acc
                                </span>
                              )}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">All Companies</span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-500">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isSelf ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-[11px] font-bold text-indigo-700">
                            <Check className="h-3 w-3" />
                            <span>Active Session</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={async () => {
                              setSwitchingId(u.id);
                              await switchUser(u.id);
                              setSwitchingId(null);
                            }}
                            disabled={switchingId === u.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
                            title={`Switch session to ${u.name} (${u.role})`}
                          >
                            <LogIn className="h-3.5 w-3.5" />
                            <span>{switchingId === u.id ? "Switching..." : "Login as User"}</span>
                          </button>
                        )}

                        <button
                          onClick={() => openEditModal(u)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
                          title="Edit User Role & Access"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>

                        {!isSelf && u.role !== "SUPER_ADMIN" && (
                          <button
                            onClick={() => handleDeleteUser(u.id, u.name)}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition"
                            title="Delete User"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                    No users found matching your search query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Add User Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Add New User Account (نیا صارف اکاؤنٹ بنائیں)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Enter credentials, assign company, and select allowed feature modules.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="m-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 shrink-0">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 scrollbar-thin">
              {/* Credentials */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Asad Ullah"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. asad@company.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Initial Password *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Step 2: Assign Company Access First (Drives available modules) */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <label className="text-[11px] font-bold text-slate-900 dark:text-slate-100 uppercase block">
                      Assign Company Access (کمپنی منتخب کریں) *
                    </label>
                    <p className="text-[10px] text-slate-500">
                      کمپنی منتخب کرنے پر اس کے پیکیج (Accounting Only یا Full Suite) کے مطابق اختیارات نظر آئیں گے۔
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({ ...formData, companyIds: companies.map((c) => c.id) })
                      }
                      className="text-purple-600 hover:underline font-semibold"
                    >
                      All
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, companyIds: [] })}
                      className="text-slate-500 hover:underline"
                    >
                      None
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5 max-h-28 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-2xl p-2.5 bg-slate-50 dark:bg-slate-800/60">
                  {companies.map((c) => {
                    const checked = formData.companyIds.includes(c.id);
                    const isAccOnly =
                      c.packageType === "ACCOUNTING_ONLY" ||
                      (c.enabledModules &&
                        !c.enabledModules.includes("pos") &&
                        !c.enabledModules.includes("compliance"));
                    return (
                      <label
                        key={c.id}
                        className={`flex items-center justify-between p-1.5 rounded-xl border text-xs cursor-pointer transition ${
                          checked
                            ? "bg-purple-50 dark:bg-purple-950/40 border-purple-300 text-purple-900 dark:text-purple-100 font-bold"
                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleCompanySelection(c.id)}
                            className="rounded text-purple-600 focus:ring-purple-500 h-3.5 w-3.5"
                          />
                          <span className="truncate">{c.name}</span>
                          <span className="text-[10px] text-slate-400 font-normal">({c.currency || "PKR"})</span>
                        </div>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            isAccOnly
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300"
                              : "bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300"
                          }`}
                        >
                          {isAccOnly ? "📘 Accounting Only" : "🚀 Full Suite"}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Package Feedback Alert */}
              {!isPosOrDiAllowed ? (
                <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 text-xs flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
                  <div>
                    <span className="font-bold block">کمپنی کا پیکیج: صرف اکاؤنٹنگ (Accounting Only)</span>
                    <span className="text-[11px] text-blue-700 dark:text-blue-300">
                      اس کمپنی کے پاس صرف اکاؤنٹنگ اور کھاتہ کا پیکیج ہے۔ لہٰذا نیچے سے POS ریٹیل کاؤنٹر اور FBR ڈیجیٹل انوائسنگ (DI) کے اختیارات خودکار ہٹا دیے گئے ہیں۔
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200 text-xs flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-purple-600" />
                  <span className="text-[11px]">
                    <strong>کمپنی کا پیکیج Full Enterprise Suite ہے:</strong> POS کاؤنٹر، FBR ڈیجیٹل انوائسنگ مع تمام اکاؤنٹنگ اختیارات تفویض کیے جا سکتے ہیں۔
                  </span>
                </div>
              )}

              {/* Granular Module Checkboxes Section */}
              <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-900 dark:text-slate-100 uppercase">
                      Module & Tab Access Rights (اختیارات و ٹیب رسائی) *
                    </label>
                    <p className="text-[10px] text-slate-500">
                      پورٹل کے وہ تمام ٹیبز چیک کریں جن کی رسائی اس صارف کو دینی ہے:
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          allowedModules: availableModules.map((m) => m.id),
                        })
                      }
                      className="px-2 py-0.5 rounded-md bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold border border-purple-200 transition text-[10px]"
                    >
                      Select All (تمام)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, allowedModules: [] })}
                      className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium transition text-[10px]"
                    >
                      Clear (خالی)
                    </button>
                  </div>
                </div>

                {/* Quick Role Presets */}
                <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                    <span>⚡ Quick Role Presets (فوری کردار منتخب کریں):</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {availableRolePresets.map((preset) => {
                      const isSelected =
                        formData.role === preset.role &&
                        preset.modules.every((m) => formData.allowedModules.includes(m)) &&
                        formData.allowedModules.length === preset.modules.length;
                      return (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => applyRolePreset(preset)}
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition flex items-center gap-1.5 ${
                            isSelected
                              ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                              : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-purple-300 hover:bg-purple-50/50"
                          }`}
                        >
                          <span>{preset.name}</span>
                          <span className="text-[9px] opacity-80 font-normal">({preset.urdu})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Checkboxes Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-2 border border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-900/60">
                  {availableModules.map((mod) => {
                    const isChecked = formData.allowedModules.includes(mod.id);
                    const ModIcon = mod.icon;
                    return (
                      <div
                        key={mod.id}
                        onClick={() => toggleModuleSelection(mod.id)}
                        className={`flex items-start gap-2.5 p-2 rounded-xl border text-xs cursor-pointer select-none transition ${
                          isChecked
                            ? "bg-purple-50/80 dark:bg-purple-950/40 border-purple-300 dark:border-purple-700/80 text-purple-900 dark:text-purple-100 shadow-xs"
                            : "bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="mt-0.5 rounded text-purple-600 focus:ring-purple-500 h-4 w-4 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-[11px] truncate flex items-center gap-1.5">
                              <ModIcon className="h-3 w-3 text-purple-600 shrink-0" />
                              <span>{mod.label}</span>
                            </span>
                            <span className="text-[9px] font-semibold text-slate-400 shrink-0 font-urdu">
                              {mod.urdu}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {mod.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 px-1">
                  <span>
                    منتخب شدہ ٹیبز:{" "}
                    <strong className="text-purple-600 font-bold">
                      {formData.allowedModules.length}
                    </strong>{" "}
                    / {availableModules.length}
                  </span>
                  <span className="italic text-slate-400">
                    صارف لاگ ان ہو کر صرف انہی منتخب ٹیبز کو دیکھ سکے گا
                  </span>
                </div>
              </div>

              {/* Underlying System Role */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  System Security Role
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 font-semibold"
                >
                  <option value="STAFF">STAFF (Cashier / Operator / Field Staff)</option>
                  <option value="ACCOUNTANT">ACCOUNTANT (Accounts & Financial Management)</option>
                  <option value="OWNER_ADMIN">OWNER_ADMIN (Shop Owner / General Manager)</option>
                  <option value="ADMIN">ADMIN (Platform Team Member - Manage Companies & Billing)</option>
                </select>

                {formData.role === "ADMIN" && (
                  <div className="mt-2.5 p-3 rounded-xl bg-indigo-50 border border-indigo-200 dark:bg-indigo-950/40 dark:border-indigo-800 text-[11px] text-indigo-900 dark:text-indigo-200">
                    <p className="font-bold flex items-center gap-1.5 mb-1 text-indigo-700 dark:text-indigo-300">
                      <ShieldCheck className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                      Team Admin Capabilities (کمپنی مینجمنٹ اختیارات)
                    </p>
                    <p className="leading-relaxed">
                      یہ یوزر سینٹرل ایڈمن سافٹ ویئر میں لاگ ان ہو کر نئی کمپنیاں رجسٹر، ماہانہ فیس تجدید (Billing)، اور کمپنی سیٹنگز تبدیل کر سکے گا۔ تمام ترامیم آڈٹ لاگ میں ریکارڈ ہوں گی تاکہ آپ دیکھ سکیں کہ کس نے کیا تبدیل کیا۔
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white shadow-md transition disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                  <Edit2 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Edit User & Permissions ({selectedUser.name})
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Modify feature tab access rights, system roles, and assigned businesses.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="m-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 shrink-0">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateUser} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 scrollbar-thin">
              {/* Credentials */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    New Password (optional)
                  </label>
                  <input
                    type="password"
                    placeholder="Leave blank to keep current"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Assign Company Access */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <label className="text-[11px] font-bold text-slate-900 dark:text-slate-100 uppercase block">
                      Assigned Companies (کمپنی رسائی)
                    </label>
                    <p className="text-[10px] text-slate-500">
                      کمپنی منتخب کرنے پر اس کے پیکیج (Accounting Only یا Full Suite) کے مطابق اختیارات نظر آئیں گے۔
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({ ...formData, companyIds: companies.map((c) => c.id) })
                      }
                      className="text-purple-600 hover:underline font-semibold"
                    >
                      All
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, companyIds: [] })}
                      className="text-slate-500 hover:underline"
                    >
                      None
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5 max-h-28 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-2xl p-2.5 bg-slate-50 dark:bg-slate-800/60">
                  {companies.map((c) => {
                    const checked = formData.companyIds.includes(c.id);
                    const isAccOnly =
                      c.packageType === "ACCOUNTING_ONLY" ||
                      (c.enabledModules &&
                        !c.enabledModules.includes("pos") &&
                        !c.enabledModules.includes("compliance"));
                    return (
                      <label
                        key={c.id}
                        className={`flex items-center justify-between p-1.5 rounded-xl border text-xs cursor-pointer transition ${
                          checked
                            ? "bg-purple-50 dark:bg-purple-950/40 border-purple-300 text-purple-900 dark:text-purple-100 font-bold"
                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleCompanySelection(c.id)}
                            className="rounded text-purple-600 focus:ring-purple-500 h-3.5 w-3.5"
                          />
                          <span className="truncate">{c.name}</span>
                          <span className="text-[10px] text-slate-400 font-normal">({c.currency || "PKR"})</span>
                        </div>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            isAccOnly
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300"
                              : "bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300"
                          }`}
                        >
                          {isAccOnly ? "📘 Accounting Only" : "🚀 Full Suite"}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Package Feedback Alert */}
              {!isPosOrDiAllowed ? (
                <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 text-xs flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
                  <div>
                    <span className="font-bold block">کمپنی کا پیکیج: صرف اکاؤنٹنگ (Accounting Only)</span>
                    <span className="text-[11px] text-blue-700 dark:text-blue-300">
                      اس کمپنی کے پاس صرف اکاؤنٹنگ اور کھاتہ کا پیکیج ہے۔ لہٰذا نیچے سے POS ریٹیل کاؤنٹر اور FBR ڈیجیٹل انوائسنگ (DI) کے اختیارات خودکار ہٹا دیے گئے ہیں۔
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200 text-xs flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-purple-600" />
                  <span className="text-[11px]">
                    <strong>کمپنی کا پیکیج Full Enterprise Suite ہے:</strong> POS کاؤنٹر، FBR ڈیجیٹل انوائسنگ مع تمام اکاؤنٹنگ اختیارات تفویض کیے جا سکتے ہیں۔
                  </span>
                </div>
              )}

              {/* Granular Module Checkboxes Section */}
              <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-900 dark:text-slate-100 uppercase">
                      Module & Tab Access Rights (اختیارات و ٹیب رسائی) *
                    </label>
                    <p className="text-[10px] text-slate-500">
                      پورٹل کے وہ تمام ٹیبز چیک کریں جن کی رسائی اس صارف کو دینی ہے:
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          allowedModules: availableModules.map((m) => m.id),
                        })
                      }
                      className="px-2 py-0.5 rounded-md bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold border border-purple-200 transition text-[10px]"
                    >
                      Select All (تمام)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, allowedModules: [] })}
                      className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium transition text-[10px]"
                    >
                      Clear (خالی)
                    </button>
                  </div>
                </div>

                {/* Quick Role Presets */}
                <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                    <span>⚡ Quick Role Presets (فوری کردار منتخب کریں):</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {availableRolePresets.map((preset) => {
                      const isSelected =
                        formData.role === preset.role &&
                        preset.modules.every((m) => formData.allowedModules.includes(m)) &&
                        formData.allowedModules.length === preset.modules.length;
                      return (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => applyRolePreset(preset)}
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition flex items-center gap-1.5 ${
                            isSelected
                              ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                              : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-purple-300 hover:bg-purple-50/50"
                          }`}
                        >
                          <span>{preset.name}</span>
                          <span className="text-[9px] opacity-80 font-normal">({preset.urdu})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Checkboxes Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-2 border border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-900/60">
                  {availableModules.map((mod) => {
                    const isChecked = formData.allowedModules.includes(mod.id);
                    const ModIcon = mod.icon;
                    return (
                      <div
                        key={mod.id}
                        onClick={() => toggleModuleSelection(mod.id)}
                        className={`flex items-start gap-2.5 p-2 rounded-xl border text-xs cursor-pointer select-none transition ${
                          isChecked
                            ? "bg-purple-50/80 dark:bg-purple-950/40 border-purple-300 dark:border-purple-700/80 text-purple-900 dark:text-purple-100 shadow-xs"
                            : "bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="mt-0.5 rounded text-purple-600 focus:ring-purple-500 h-4 w-4 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-[11px] truncate flex items-center gap-1.5">
                              <ModIcon className="h-3 w-3 text-purple-600 shrink-0" />
                              <span>{mod.label}</span>
                            </span>
                            <span className="text-[9px] font-semibold text-slate-400 shrink-0 font-urdu">
                              {mod.urdu}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {mod.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 px-1">
                  <span>
                    منتخب شدہ ٹیبز:{" "}
                    <strong className="text-purple-600 font-bold">
                      {formData.allowedModules.length}
                    </strong>{" "}
                    / {availableModules.length}
                  </span>
                  <span className="italic text-slate-400">
                    صارف لاگ ان ہو کر صرف انہی منتخب ٹیبز کو دیکھ سکے گا
                  </span>
                </div>
              </div>

              {/* Underlying System Role */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  System Security Role
                </label>
                <select
                  value={formData.role}
                  disabled={selectedUser?.role === "SUPER_ADMIN"}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {selectedUser?.role === "SUPER_ADMIN" ? (
                    <option value="SUPER_ADMIN">SUPER_ADMIN (Protected Master Account)</option>
                  ) : (
                    <>
                      <option value="STAFF">STAFF (Cashier / Operator / Field Staff)</option>
                      <option value="ACCOUNTANT">ACCOUNTANT (Accounts & Financial Management)</option>
                      <option value="OWNER_ADMIN">OWNER_ADMIN (Shop Owner / General Manager)</option>
                      <option value="ADMIN">ADMIN (Platform Team Member - Manage Companies & Billing)</option>
                    </>
                  )}
                </select>

                {formData.role === "ADMIN" && (
                  <div className="mt-2.5 p-3 rounded-xl bg-indigo-50 border border-indigo-200 dark:bg-indigo-950/40 dark:border-indigo-800 text-[11px] text-indigo-900 dark:text-indigo-200">
                    <p className="font-bold flex items-center gap-1.5 mb-1 text-indigo-700 dark:text-indigo-300">
                      <ShieldCheck className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                      Team Admin Capabilities (کمپنی مینجمنٹ اختیارات)
                    </p>
                    <p className="leading-relaxed">
                      یہ یوزر سینٹرل ایڈمن سافٹ ویئر میں لاگ ان ہو کر نئی کمپنیاں رجسٹر، ماہانہ فیس تجدید (Billing)، اور کمپنی سیٹنگز تبدیل کر سکے گا۔ تمام ترامیم آڈٹ لاگ میں ریکارڈ ہوں گی تاکہ آپ دیکھ سکیں کہ کس نے کیا تبدیل کیا۔
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white shadow-md transition disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Update Permissions"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
