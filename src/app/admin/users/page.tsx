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
  Crown,
  Eye,
  Shield,
  Laptop,
  Lock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { BrandPageLoader, TableSkeleton } from "@/components/ui/loader";

const USER_FEATURE_MODULES = [
  { id: "sales", label: "Sales & Invoicing", urdu: "سیلز اور انوائس بلز", desc: "Customer invoices and sales records", descUrdu: "کسٹمر بلنگ اور انوائسز", icon: Receipt },
  { id: "pos", label: "POS Counter", urdu: "پی او ایس ریٹیل بلنگ", desc: "Fast retail cash counter and barcode scanner", descUrdu: "فاسٹ ریٹیل کاؤنٹر اور بارکوڈ اسکین", icon: ShoppingCart },
  { id: "purchases", label: "Purchases & Bills", urdu: "خریداری اور سپلائر بلز", desc: "Supplier bills and purchase vouchers", descUrdu: "سپلائر بلنگ اور پرچیز واؤچرز", icon: ShoppingBag },
  { id: "payments", label: "Cash & Payments", urdu: "پیسے وصولی و ادائیگی", desc: "Customer collections and vendor disbursements", descUrdu: "کسٹمر کیش وصولی اور سپلائر ادائیگیاں", icon: Wallet },
  { id: "expenses", label: "Daily Expenses", urdu: "دکان کے روزمرہ خرچے", desc: "Petty expenses, rent, utilities, and tea", descUrdu: "چائے، بجلی، کرایہ، متفرق اخراجات", icon: Coins },
  { id: "inventory", label: "Inventory & Stock", urdu: "اسٹاک اور گودام مینجمنٹ", desc: "Stock quantities and warehouse movements", descUrdu: "اسٹاک کاؤنٹ اور ویئرہاؤس موومنٹ", icon: Boxes },
  { id: "customers", label: "Customers (Receivables)", urdu: "گاہکوں کا ادھار کھاتہ", desc: "Customer ledgers, credit follow-ups, and balances", descUrdu: "گاہکوں کا لیجر، ادھار اور بیلنس", icon: Users },
  { id: "suppliers", label: "Suppliers (Payables)", urdu: "سپلائرز کا ادھار کھاتہ", desc: "Supplier ledgers and payable liabilities", descUrdu: "سپلائرز کا کھاتہ اور واجب الادا رقوم", icon: Truck },
  { id: "products", label: "Products & Rates", urdu: "سامان و ریٹ لسٹ", desc: "Product catalog, prices, and barcodes", descUrdu: "آئٹم لسٹ، قیمتیں اور بارکوڈز", icon: Package },
  { id: "reports", label: "Closing & Reports", urdu: "کھاتہ بندش و منافع رپورٹ", desc: "Daily registers, profit & loss, and balance sheet", descUrdu: "روزمرہ رجسٹر، نفع نقصان اور بیلنس شیٹ", icon: BarChart3 },
  { id: "compliance", label: "FBR POS Digital", urdu: "FBR ڈیجیٹل انوائسنگ", desc: "FBR live invoicing and QR code printing", descUrdu: "ایف بی آر لائیو انوائسنگ و کیو آر کوڈ", icon: ShieldCheck },
  { id: "accounting", label: "General Ledger", urdu: "ڈبل انٹری جنرل لیجر", desc: "Chart of accounts, journal vouchers, and ledgers", descUrdu: "چارٹ آف اکاؤنٹس، جرنل واؤچرز، لیجر", icon: BookOpen },
  { id: "aiEntry", label: "AI Invoice Reader", urdu: "AI بل اسکینر", desc: "Automated slip and invoice scanning", descUrdu: "کیمرہ یا فائل سے خودکار بل اسکیننگ", icon: Sparkles },
  { id: "branches", label: "Sub-Branches", urdu: "آؤٹ لیٹس و برانچز", desc: "Multi-branch and retail outlet management", descUrdu: "متعدد دکانیں اور برانچز کا انتظام", icon: Store },
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
  const { language, t } = useLanguage();
  const [users, setUsers] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"shops" | "webapp">("shops");
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [webappModalOpen, setWebappModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  // Shop User Form State
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "STAFF",
    platformRole: "TENANT_USER",
    companyIds: [] as string[],
    allowedModules: ["sales", "pos", "customers", "products"] as string[],
  });

  // WebApp User Form State
  const [webappFormData, setWebappFormData] = useState({
    name: "",
    email: "",
    password: "",
    platformRole: "WEBAPP_ADMIN",
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

  // Split Users into Shop/Tenant users vs WebApp Platform Team
  const shopUsers = users.filter(
    (u) =>
      (!u.platformRole || u.platformRole === "TENANT_USER") &&
      u.role !== "SUPER_ADMIN"
  );

  const webappUsers = users.filter(
    (u) =>
      u.role === "SUPER_ADMIN" ||
      u.platformRole === "SUPER_ADMIN" ||
      u.platformRole === "WEBAPP_ADMIN" ||
      u.platformRole === "WEBAPP_EDITOR" ||
      u.platformRole === "WEBAPP_VIEWER"
  );

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

  const handleCreateShopUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const sanitizedModules = isPosOrDiAllowed
        ? formData.allowedModules
        : formData.allowedModules.filter((m) => m !== "pos" && m !== "compliance");

      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          isPlatformUser: false,
          platformRole: "TENANT_USER",
          allowedModules: sanitizedModules,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setModalOpen(false);
        setFormData({
          name: "",
          email: "",
          password: "",
          role: "STAFF",
          platformRole: "TENANT_USER",
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

  const handleCreateWebappUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: webappFormData.name,
          email: webappFormData.email,
          password: webappFormData.password,
          isPlatformUser: true,
          platformRole: webappFormData.platformRole,
          companyIds: [],
          allowedModules: USER_FEATURE_MODULES.map((m) => m.id),
        }),
      });
      const data = await res.json();

      if (data.success) {
        setWebappModalOpen(false);
        setWebappFormData({
          name: "",
          email: "",
          password: "",
          platformRole: "WEBAPP_ADMIN",
        });
        await fetchUsersAndCompanies();
      } else {
        setFormError(data.error || "Failed to create WebApp user");
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
      const isWebappUser =
        (selectedUser.platformRole && selectedUser.platformRole !== "TENANT_USER") ||
        selectedUser.role === "SUPER_ADMIN";

      const payload: any = {
        name: formData.name,
        email: formData.email,
        platformRole: formData.platformRole,
      };

      if (formData.password) {
        payload.password = formData.password;
      }

      if (!isWebappUser) {
        const sanitizedModules = isPosOrDiAllowed
          ? formData.allowedModules
          : formData.allowedModules.filter((m) => m !== "pos" && m !== "compliance");
        payload.role = formData.role;
        payload.companyIds = formData.companyIds;
        payload.allowedModules = sanitizedModules;
      } else {
        payload.role = "ADMIN";
      }

      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
      platformRole: u.platformRole || (u.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "TENANT_USER"),
      companyIds: assignedIds,
      allowedModules: initialModules,
    });
    setFormError(null);
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

  const getPlatformRoleInfo = (platformRole?: string, role?: string) => {
    if (role === "SUPER_ADMIN" || platformRole === "SUPER_ADMIN") {
      return {
        label: "Super Admin (Master Owner)",
        urdu: "سپر ایڈمن (مالکِ سافٹ ویئر)",
        color: "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 border-amber-300 shadow-xs",
        icon: Crown,
        badgeText: "👑 SUPER ADMIN",
        desc: language === "ur" ? "پلیٹ فارم کا مکمل اور ناقابلِ تنسیخ مالک (ہاشم خان)" : "Master Owner and Super Admin of the entire platform",
      };
    }
    if (platformRole === "WEBAPP_ADMIN") {
      return {
        label: "WebApp Admin (Full Control)",
        urdu: "ویب ایپ ایڈمن (مکمل اختیارات)",
        color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-300",
        icon: ShieldCheck,
        badgeText: "🛡️ WEBAPP ADMIN",
        desc: language === "ur" ? "کمپنی مینجمنٹ، بلنگ تجدید، سبسکرپشن اور تکنیکی رسائی" : "Company management, subscription billing, and administrative access",
      };
    }
    if (platformRole === "WEBAPP_EDITOR") {
      return {
        label: "WebApp Editor (Support & Ops)",
        urdu: "ویب ایپ ایڈیٹر (کسٹمر سپورٹ)",
        color: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300",
        icon: Edit2,
        badgeText: "✏️ WEBAPP EDITOR",
        desc: language === "ur" ? "کلائنٹ ریکارڈز دیکھنا و ایڈٹ کرنا، کمپنیاں ڈیلیٹ کرنے کی اجازت نہیں" : "View and edit client records for customer support without deletion rights",
      };
    }
    if (platformRole === "WEBAPP_VIEWER") {
      return {
        label: "WebApp Viewer (Read-Only)",
        urdu: "ویب ایپ ویور (صرف معائنہ)",
        color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300",
        icon: Eye,
        badgeText: "👁️ WEBAPP VIEWER",
        desc: language === "ur" ? "پورٹل اور کلائنٹ ڈیٹا صرف دیکھ سکتا ہے، کسی تبدیلی کی اجازت نہیں" : "Read-only access to companies, audit reports, and billing",
      };
    }
    return {
      label: "Shop User",
      urdu: "دکان کا عملہ",
      color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200",
      icon: Users,
      badgeText: "🏪 SHOP USER",
      desc: language === "ur" ? "دکان کے لیے تفویض کردہ اختیارات" : "Role and permissions assigned for retail shop and accounting",
    };
  };

  // Filter Shop Users
  const filteredShopUsers = shopUsers.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.role.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (companyFilter !== "ALL") {
      if (!u.companies || u.companies.length === 0) return false;
      return u.companies.some((c: any) => c.id === companyFilter);
    }
    return true;
  });

  // Filter WebApp Team Users
  const filteredWebappUsers = webappUsers.filter((u) => {
    const pRole = u.platformRole || (u.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "");
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      pRole.toLowerCase().includes(search.toLowerCase());

    return matchesSearch;
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
            <span>User Directory & Platform Access Control</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage client shop staff permissions as well as SaaS internal webapp administrators, editors, and read-only viewers.
          </p>
        </div>

        {activeTab === "shops" ? (
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
                platformRole: "TENANT_USER",
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
            <span>{t("+ Add Shop User", "+ دکان یوزر بنائیں")}</span>
          </button>
        ) : (
          <button
            onClick={() => {
              setWebappFormData({
                name: "",
                email: "",
                password: "",
                platformRole: "WEBAPP_ADMIN",
              });
              setFormError(null);
              setWebappModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-indigo-700 transition"
          >
            <Plus className="h-4 w-4" />
            <span>{t("+ Add WebApp User", "+ ویب ایپ صارف بنائیں")}</span>
          </button>
        )}
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2">
        <button
          type="button"
          onClick={() => {
            setActiveTab("shops");
            setSearch("");
          }}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition ${
            activeTab === "shops"
              ? "border-purple-600 text-purple-700 dark:text-purple-400 bg-purple-50/60 dark:bg-purple-950/30 rounded-t-xl"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
          }`}
        >
          <Store className="h-4 w-4" />
          <span>🏪 {t("Shop & Client Users", "دکانوں و کمپنیوں کے یوزرز")}</span>
          <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-extrabold">
            {shopUsers.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("webapp");
            setSearch("");
          }}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition ${
            activeTab === "webapp"
              ? "border-indigo-600 text-indigo-700 dark:text-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-t-xl"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
          }`}
        >
          <Shield className="h-4 w-4" />
          <span>⚡ {t("WebApp Platform Team", "ویب ایپ ایڈمن و ٹیم")}</span>
          <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-extrabold">
            {webappUsers.length}
          </span>
        </button>
      </div>

      {/* TAB 1: SHOP & CLIENT USERS */}
      {activeTab === "shops" && (
        <div className="space-y-4">
          {/* Search & Company Filter */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 max-w-2xl">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search shop user by name, email, or role..."
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
                      {c.name} {c.packageType === "ACCOUNTING_ONLY" ? "(Accounting Only)" : c.packageType === "FBR_INVOICING_ONLY" ? "(FBR Invoicing Only)" : "(Full Suite)"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="text-xs text-slate-500">
              Showing: <strong className="text-slate-800 dark:text-slate-200">{filteredShopUsers.length}</strong> of {shopUsers.length} Shop Users
            </div>
          </div>

          {/* Shop Users Table */}
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900 text-slate-500">
                    <th className="py-3.5 px-4 font-bold uppercase tracking-wider">User Profile</th>
                    <th className="py-3.5 px-4 font-bold uppercase tracking-wider">Shop Role</th>
                    <th className="py-3.5 px-4 font-bold uppercase tracking-wider">{t("Allowed Modules", "اختیارات")}</th>
                    <th className="py-3.5 px-4 font-bold uppercase tracking-wider">Assigned Companies</th>
                    <th className="py-3.5 px-4 font-bold uppercase tracking-wider">Joined</th>
                    <th className="py-3.5 px-4 font-bold uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredShopUsers.map((u) => {
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
                            {hasModules ? (
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
                                Standard Permissions
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
                                  {c.packageType === "ACCOUNTING_ONLY" ? (
                                    <span className="text-[8px] bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 px-1 rounded font-bold">
                                      Acc
                                    </span>
                                  ) : c.packageType === "FBR_INVOICING_ONLY" ? (
                                    <span className="text-[8px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 px-1 rounded font-bold">
                                      FBR
                                    </span>
                                  ) : null}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">No Company Assigned</span>
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
                                <span>Active</span>
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
                                <span>{switchingId === u.id ? "Switching..." : "Login"}</span>
                              </button>
                            )}

                            <button
                              onClick={() => openEditModal(u)}
                              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
                              title="Edit User Role & Access"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>

                            {!isSelf && (
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

                  {filteredShopUsers.length === 0 && !loading && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                        No shop users found matching your search query.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 2: WEBAPP PLATFORM TEAM */}
      {activeTab === "webapp" && (
        <div className="space-y-4">
          {/* Platform Access Levels Guide Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50/80 via-purple-50/60 to-slate-50 dark:from-indigo-950/40 dark:via-purple-950/20 dark:to-slate-900 border border-indigo-200/80 dark:border-indigo-800/80 space-y-3">
            <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200 font-bold text-xs">
              <Shield className="h-4 w-4 text-indigo-600" />
              <span>{t("SaaS Platform Access Tiers", "ویب ایپ انٹرنل ایڈمنسٹریشن کی سطحیں")}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              {/* Super Admin */}
              <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-amber-200 dark:border-amber-900/60 shadow-xs">
                <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200 mb-1">
                  <Crown className="h-4 w-4 text-amber-500" />
                  <span>👑 Super Admin</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  {t(
                    "Master Owner: Unconditional control over the entire platform, databases, and all companies.",
                    "صرف ہاشم خان (Master Owner): پورے سافٹ ویئر، سرور، ڈیٹا بیس اور تمام کمپنیوں کے غیر مشروط مالک۔ یہ اکاؤنٹ کسی دوسرے کو نہیں دیا جا سکتا۔"
                  )}
                </p>
              </div>

              {/* WebApp Admin */}
              <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-indigo-200 dark:border-indigo-900/60 shadow-xs">
                <div className="flex items-center gap-1.5 font-bold text-indigo-900 dark:text-indigo-200 mb-1">
                  <ShieldCheck className="h-4 w-4 text-indigo-600" />
                  <span>🛡️ WebApp Admin</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  {t(
                    "Full Administrator: Manage client companies, subscription plans, billing, and system configuration.",
                    "فل ایڈمنسٹریٹر: تمام کلائنٹس، کمپنیاں، بلنگ پیکجز اور سیٹنگز تبدیل کرنے کے مکمل اختیارات۔ کلائنٹ کے اکاؤنٹ میں لاگ ان ہو کر مسئلہ حل کر سکتا ہے۔"
                  )}
                </p>
              </div>

              {/* WebApp Editor */}
              <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-blue-200 dark:border-blue-900/60 shadow-xs">
                <div className="flex items-center gap-1.5 font-bold text-blue-900 dark:text-blue-200 mb-1">
                  <Edit2 className="h-3.5 w-3.5 text-blue-600" />
                  <span>✏️ WebApp Editor</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  {t(
                    "Editor & Support: View and assist client records and ledger entries without company deletion rights.",
                    "ایڈیٹر و سپورٹ: کلائنٹ کمپنیوں کا ڈیٹا دیکھنا، واؤچرز درست کرنا اور سپورٹ دینا۔ کمپنیاں ڈیلیٹ کرنے یا ایڈمن اکاؤنٹس بنانے کی اجازت نہیں۔"
                  )}
                </p>
              </div>

              {/* WebApp Viewer */}
              <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-emerald-200 dark:border-emerald-900/60 shadow-xs">
                <div className="flex items-center gap-1.5 font-bold text-emerald-900 dark:text-emerald-200 mb-1">
                  <Eye className="h-4 w-4 text-emerald-600" />
                  <span>👁️ WebApp Viewer</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  {t(
                    "Read-Only Inspector: View company rosters, billing summaries, and audit reports without editing privileges.",
                    "صرف معائنہ (Read-Only): تمام کمپنیوں، سیلز، پرچیزز اور رپورٹس کو صرف دیکھنے کا اختیار۔ کسی بھی قسم کا ڈیٹا بدلنے یا ڈیلیٹ کرنے کی ممانعت۔"
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Search bar */}
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search webapp team by name, email, or role..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div className="text-xs text-slate-500">
              Platform Members: <strong className="text-slate-900 dark:text-white">{filteredWebappUsers.length}</strong>
            </div>
          </div>

          {/* WebApp Team Table */}
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900 text-slate-500">
                    <th className="py-3.5 px-4 font-bold uppercase tracking-wider">Member</th>
                    <th className="py-3.5 px-4 font-bold uppercase tracking-wider">{t("Platform Role", "اختیارات")}</th>
                    <th className="py-3.5 px-4 font-bold uppercase tracking-wider">Scope & Permission</th>
                    <th className="py-3.5 px-4 font-bold uppercase tracking-wider">Registered</th>
                    <th className="py-3.5 px-4 font-bold uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredWebappUsers.map((u) => {
                    const isSelf = currentLoggedUser?.userId === u.id;
                    const roleInfo = getPlatformRoleInfo(u.platformRole, u.role);
                    const isSuperAdmin = u.role === "SUPER_ADMIN" || u.platformRole === "SUPER_ADMIN";
                    const RoleIcon = roleInfo.icon;

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/60 transition">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`flex h-9 w-9 items-center justify-center rounded-xl font-bold shrink-0 ${
                                isSuperAdmin
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 ring-2 ring-amber-400"
                                  : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                              }`}
                            >
                              {isSuperAdmin ? "👑" : u.name ? u.name.charAt(0).toUpperCase() : "A"}
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
                          <div className="flex flex-col gap-0.5">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-lg border w-fit ${roleInfo.color}`}
                            >
                              <RoleIcon className="h-3.5 w-3.5 shrink-0" />
                              <span>{roleInfo.label}</span>
                            </span>
                            {language === "ur" && (
                              <span className="text-[10px] text-slate-400 font-urdu">{roleInfo.urdu}</span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-0.5 max-w-xs">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                              <Laptop className="h-3.5 w-3.5 text-indigo-500" />
                              <span>{t("Global Platform Access", "تمام پورٹل")}</span>
                            </span>
                            <span className="text-[10px] text-slate-500">{roleInfo.desc}</span>
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
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
                                title={`Switch session to ${u.name}`}
                              >
                                <LogIn className="h-3.5 w-3.5" />
                                <span>{switchingId === u.id ? "Switching..." : "Login"}</span>
                              </button>
                            )}

                            {isSuperAdmin ? (
                              <span
                                className="p-1.5 text-amber-500 cursor-not-allowed"
                                title="Master Super Admin role is protected permanently"
                              >
                                <Lock className="h-4 w-4" />
                              </span>
                            ) : (
                              <>
                                <button
                                  onClick={() => openEditModal(u)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
                                  title="Edit WebApp Role"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>

                                {!isSelf && (
                                  <button
                                    onClick={() => handleDeleteUser(u.id, u.name)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition"
                                    title="Delete WebApp User"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredWebappUsers.length === 0 && !loading && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                        No webapp team members found matching your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* MODAL 1: ADD SHOP USER MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                  <Store className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {t("Add New Shop User", "دکان ملازم کا اکاؤنٹ بنائیں")}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {t(
                      "Assign client company, shop role, and select allowed feature modules.",
                      "کمپنی، دکان رول اور فیچر ماڈیولز تفویض کریں۔"
                    )}
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

            <form onSubmit={handleCreateShopUser} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 scrollbar-thin">
              {/* Credentials */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    {t("Full Name *", "پورا نام *")}
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
                    {t("Email Address *", "ای میل ایڈریس *")}
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
                    {t("Initial Password *", "ابتدائی پاس ورڈ *")}
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

              {/* Step 2: Assign Company Access */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <label className="text-[11px] font-bold text-slate-900 dark:text-slate-100 uppercase block">
                      {t("Assign Company Access *", "کمپنی منتخب کریں *")}
                    </label>
                    <p className="text-[10px] text-slate-500">
                      {t(
                        "Selecting a company reveals modules based on its package (Accounting Only or Full Suite).",
                        "کمپنی منتخب کرنے پر اس کے پیکیج (Accounting Only یا Full Suite) کے مطابق اختیارات نظر آئیں گے۔"
                      )}
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
                            c.packageType === "FBR_INVOICING_ONLY"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300"
                              : isAccOnly
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300"
                              : "bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300"
                          }`}
                        >
                          {c.packageType === "FBR_INVOICING_ONLY"
                            ? "⚡ FBR Invoicing Only"
                            : isAccOnly
                            ? "📘 Accounting Only"
                            : "🚀 Full Suite"}
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
                    <span className="font-bold block">
                      {t("Company Package: Accounting Only", "کمپنی کا پیکیج: صرف اکاؤنٹنگ (Accounting Only)")}
                    </span>
                    <span className="text-[11px] text-blue-700 dark:text-blue-300">
                      {t(
                        "This company is restricted to Accounting Only. POS Retail Counter and FBR Digital Invoicing (DI) options have been automatically disabled.",
                        "اس کمپنی کے پاس صرف اکاؤنٹنگ اور کھاتہ کا پیکیج ہے۔ لہٰذا نیچے سے POS ریٹیل کاؤنٹر اور FBR ڈیجیٹل انوائسنگ (DI) کے اختیارات خودکار ہٹا دیے گئے ہیں۔"
                      )}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200 text-xs flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-purple-600" />
                  <span className="text-[11px]">
                    <strong>
                      {t("Company Package is Full Enterprise Suite:", "کمپنی کا پیکیج Full Enterprise Suite ہے:")}
                    </strong>{" "}
                    {t(
                      "POS counter, FBR Digital Invoicing, and all accounting modules can be assigned.",
                      "POS کاؤنٹر، FBR ڈیجیٹل انوائسنگ مع تمام اکاؤنٹنگ اختیارات تفویض کیے جا سکتے ہیں۔"
                    )}
                  </span>
                </div>
              )}

              {/* Granular Module Checkboxes Section */}
              <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-900 dark:text-slate-100 uppercase">
                      {t("Module & Tab Access Rights *", "اختیارات و ٹیب رسائی *")}
                    </label>
                    <p className="text-[10px] text-slate-500">
                      {t(
                        "Check all portal tabs and features this user is permitted to access:",
                        "پورٹل کے وہ تمام ٹیبز چیک کریں جن کی رسائی اس صارف کو دینی ہے:"
                      )}
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
                      {t("Select All", "تمام")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, allowedModules: [] })}
                      className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium transition text-[10px]"
                    >
                      {t("Clear", "خالی")}
                    </button>
                  </div>
                </div>

                {/* Quick Role Presets */}
                <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                    <span>⚡ {t("Quick Role Presets:", "فوری کردار منتخب کریں:")}</span>
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
                          <span>{language === "ur" ? preset.urdu : preset.name}</span>
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
                              <span>{language === "ur" ? mod.urdu : mod.label}</span>
                            </span>
                            {language === "ur" && (
                              <span className="text-[9px] font-semibold text-slate-400 shrink-0 font-urdu">
                                {mod.urdu}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {language === "ur" ? mod.descUrdu : mod.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Shop System Security Role */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Shop Security Role
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 font-semibold"
                >
                  <option value="STAFF">STAFF (Cashier / Operator / Field Staff)</option>
                  <option value="ACCOUNTANT">ACCOUNTANT (Accounts & Financial Management)</option>
                  <option value="OWNER_ADMIN">OWNER_ADMIN (Shop Owner / General Manager)</option>
                </select>
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
                  {submitting ? "Saving..." : "Create Shop User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD WEBAPP PLATFORM USER MODAL */}
      {webappModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl max-h-[92vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                  <Shield className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {t("Add WebApp Platform User", "نیا پلیٹ فارم صارف بنائیں")}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {t(
                      "Create internal SaaS administrative, support, or read-only operator accounts.",
                      "اندرونی SaaS ایڈمنسٹریشن، کسٹمر سپورٹ یا ویور اکاؤنٹس بنائیں۔"
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setWebappModalOpen(false)}
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

            <form onSubmit={handleCreateWebappUser} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 scrollbar-thin">
              {/* Credentials */}
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    {t("Full Name *", "پورا نام *")}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tariq Mehmood"
                    value={webappFormData.name}
                    onChange={(e) => setWebappFormData({ ...webappFormData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      {t("Email Address *", "ای میل ایڈریس *")}
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. tariq@smartbiz.com"
                      value={webappFormData.email}
                      onChange={(e) => setWebappFormData({ ...webappFormData, email: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      {t("Initial Password *", "ابتدائی پاس ورڈ *")}
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={webappFormData.password}
                      onChange={(e) => setWebappFormData({ ...webappFormData, password: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Platform Access Role Selection */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-2">
                <label className="block text-[11px] font-bold text-slate-900 dark:text-slate-100 uppercase">
                  {t("Select WebApp Access Level *", "پلیٹ فارم رول منتخب کریں *")}
                </label>

                <div className="space-y-2">
                  {/* Option 1: WebApp Admin */}
                  <label
                    className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition ${
                      webappFormData.platformRole === "WEBAPP_ADMIN"
                        ? "bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="platformRole"
                      value="WEBAPP_ADMIN"
                      checked={webappFormData.platformRole === "WEBAPP_ADMIN"}
                      onChange={(e) => setWebappFormData({ ...webappFormData, platformRole: e.target.value })}
                      className="mt-1 text-indigo-600 focus:ring-indigo-500 h-4 w-4 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                          <ShieldCheck className="h-4 w-4 text-indigo-600" />
                          <span>{t("🛡️ WebApp Admin (Full Access)", "🛡️ WebApp Admin (سافٹ ویئر ایڈمن - Full Access)")}</span>
                        </span>
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100 dark:bg-indigo-900/60 px-2 py-0.5 rounded-full">
                          Full Control
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                        {t(
                          "Register client shops, manage subscriptions and billing renewals, login as client users, and inspect system audit logs.",
                          "نئی کلائنٹ دکانیں رجسٹر کرنا، سبسکرپشن فیس اور بلنگ کی تجدید، یوزرز کے اکاؤنٹس میں لاگ ان ہونا اور سسٹم لاگز دیکھنا۔"
                        )}
                      </p>
                    </div>
                  </label>

                  {/* Option 2: WebApp Editor */}
                  <label
                    className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition ${
                      webappFormData.platformRole === "WEBAPP_EDITOR"
                        ? "bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/20 shadow-xs"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="platformRole"
                      value="WEBAPP_EDITOR"
                      checked={webappFormData.platformRole === "WEBAPP_EDITOR"}
                      onChange={(e) => setWebappFormData({ ...webappFormData, platformRole: e.target.value })}
                      className="mt-1 text-blue-600 focus:ring-blue-500 h-4 w-4 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                          <Edit2 className="h-4 w-4 text-blue-600" />
                          <span>{t("✏️ WebApp Editor (Support & Ops)", "✏️ WebApp Editor (ویب ایپ ایڈیٹر - Support & Ops)")}</span>
                        </span>
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 rounded-full">
                          Editor Access
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                        {t(
                          "View and edit client company records to assist with bookkeeping and administrative support. Cannot delete companies or users.",
                          "کلائنٹ کمپنیوں کے ریکارڈز دیکھنا، کھاتہ درست کرنے میں مدد کرنا اور کلائنٹ ایڈمن ترامیم کرنا۔ کمپنیاں یا ڈیٹا ڈیلیٹ کرنے کی ممانعت۔"
                        )}
                      </p>
                    </div>
                  </label>

                  {/* Option 3: WebApp Viewer */}
                  <label
                    className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition ${
                      webappFormData.platformRole === "WEBAPP_VIEWER"
                        ? "bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="platformRole"
                      value="WEBAPP_VIEWER"
                      checked={webappFormData.platformRole === "WEBAPP_VIEWER"}
                      onChange={(e) => setWebappFormData({ ...webappFormData, platformRole: e.target.value })}
                      className="mt-1 text-emerald-600 focus:ring-emerald-500 h-4 w-4 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                          <Eye className="h-4 w-4 text-emerald-600" />
                          <span>{t("👁️ WebApp Viewer (Read-Only)", "👁️ WebApp Viewer (ویب ایپ ویور - Read-Only)")}</span>
                        </span>
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-full">
                          Read-Only
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                        {t(
                          "Read-only access across portal sections, company counts, sales & purchase summaries, and audit logs. Modifying or deleting data is prohibited.",
                          "پورٹل کے تمام پورشنز، کمپنیوں کی تعداد، سیلز و پرچیزز کے خلاصے اور آڈٹ رپورٹس صرف دیکھ سکتا ہے۔ کسی قسم کی تبدیلی یا ڈیلیٹ بند ہے۔"
                        )}
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Super Admin Ownership Protection Alert */}
              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5">
                <Crown className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <span className="font-bold block">
                    {t("Super Admin Tier is Reserved:", "سپر ایڈمن (Super Admin) کا درجہ مخصوص ہے:")}
                  </span>
                  <span className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                    {t(
                      "The Super Admin tier is permanently reserved for Hashim Khan. For security reasons, no other user can be assigned the Super Admin role.",
                      "سپر ایڈمن کا درجہ ہمیشہ اور صرف ہاشم خان صاحب کا ہے۔ سیکیورٹی پروٹوکول کے تحت کوئی دوسرا صارف سپر ایڈمن نہیں بن سکتا۔"
                    )}
                  </span>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setWebappModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-md transition disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Create WebApp User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: EDIT USER MODAL (ADAPTS FOR SHOP VS WEBAPP) */}
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
                    Modify profile information, credentials, and access tier.
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

              {/* If WebApp User: Show Platform Role select */}
              {(selectedUser.platformRole && selectedUser.platformRole !== "TENANT_USER") ||
              selectedUser.role === "SUPER_ADMIN" ? (
                <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-2">
                  <label className="block text-[11px] font-bold text-slate-900 dark:text-slate-100 uppercase">
                    {t("Platform Role", "ویب ایپ انٹرنل رول")}
                  </label>

                  {selectedUser.role === "SUPER_ADMIN" || selectedUser.platformRole === "SUPER_ADMIN" ? (
                    <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
                      <Crown className="h-4 w-4 text-amber-600 shrink-0" />
                      <span className="font-bold">
                        👑 Super Admin (Master Account Protected - Role Cannot Be Modified)
                      </span>
                    </div>
                  ) : (
                    <select
                      value={formData.platformRole}
                      onChange={(e) => setFormData({ ...formData, platformRole: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 font-semibold"
                    >
                      <option value="WEBAPP_ADMIN">🛡️ WebApp Admin (Full SaaS Management & Support)</option>
                      <option value="WEBAPP_EDITOR">✏️ WebApp Editor (Client Support & Record Editing)</option>
                      <option value="WEBAPP_VIEWER">👁️ WebApp Viewer (Read-Only Access)</option>
                    </select>
                  )}
                </div>
              ) : (
                /* Else: Shop User fields */
                <>
                  {/* Assign Company Access */}
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <label className="text-[11px] font-bold text-slate-900 dark:text-slate-100 uppercase block">
                          {t("Assigned Companies", "کمپنی رسائی")}
                        </label>
                        <p className="text-[10px] text-slate-500">
                          {t(
                            "Selecting a company displays modules based on its package.",
                            "کمپنی منتخب کرنے پر اس کے پیکیج کے مطابق اختیارات نظر آئیں گے۔"
                          )}
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
                                c.packageType === "FBR_INVOICING_ONLY"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300"
                                  : isAccOnly
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300"
                                  : "bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300"
                              }`}
                            >
                              {c.packageType === "FBR_INVOICING_ONLY"
                                ? "⚡ FBR Invoicing Only"
                                : isAccOnly
                                ? "📘 Accounting Only"
                                : "🚀 Full Suite"}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Granular Module Checkboxes Section */}
                  <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-900 dark:text-slate-100 uppercase">
                          {t("Module & Tab Access Rights *", "اختیارات و ٹیب رسائی *")}
                        </label>
                        <p className="text-[10px] text-slate-500">
                          {t(
                            "Check all portal tabs and features this user is permitted to access:",
                            "پورٹل کے وہ تمام ٹیبز چیک کریں جن کی رسائی اس صارف کو دینی ہے:"
                          )}
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
                          {t("Select All", "تمام")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, allowedModules: [] })}
                          className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium transition text-[10px]"
                        >
                          {t("Clear", "خالی")}
                        </button>
                      </div>
                    </div>

                    {/* Quick Role Presets */}
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
                      <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                        <span>⚡ {t("Quick Role Presets:", "فوری کردار منتخب کریں:")}</span>
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
                              <span>{language === "ur" ? preset.urdu : preset.name}</span>
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
                                  <span>{language === "ur" ? mod.urdu : mod.label}</span>
                                </span>
                                {language === "ur" && (
                                  <span className="text-[9px] font-semibold text-slate-400 shrink-0 font-urdu">
                                    {mod.urdu}
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                {language === "ur" ? mod.descUrdu : mod.desc}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Shop Role */}
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
                    </select>
                  </div>
                </>
              )}

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
