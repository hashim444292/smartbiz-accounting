"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Building2,
  Users,
  Plus,
  ArrowRight,
  Sparkles,
  Layers,
  TrendingUp,
  Settings,
  CheckCircle2,
  ExternalLink,
  Banknote,
  DollarSign,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { BrandPageLoader, CardSkeleton } from "@/components/ui/loader";

export default function AdminDashboardPage() {
  const { user, activeCompany, switchCompany } = useAuth();
  const [companies, setCompanies] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [billingStats, setBillingStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [switchingCompanyId, setSwitchingCompanyId] = useState<string | null>(null);

  useEffect(() => {
    async function loadAdminData() {
      try {
        const [compRes, usrRes, billRes] = await Promise.all([
          fetch("/api/admin/companies").then((r) => r.json()),
          fetch("/api/admin/users").then((r) => r.json()),
          fetch("/api/admin/billing").then((r) => r.json()),
        ]);

        if (compRes.success) setCompanies(compRes.data || []);
        if (usrRes.success) setUsers(usrRes.data || []);
        if (billRes.success) setBillingStats(billRes.stats || null);
      } catch (err) {
        console.error("Failed to load admin data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadAdminData();
  }, []);

  const roleBadgeColor = (role?: string) => {
    switch (role) {
      case "SUPER_ADMIN":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300";
      case "OWNER_ADMIN":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
      case "ACCOUNTANT":
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
      default:
        return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <BrandPageLoader
          message="Loading SaaS Administration Center..."
          submessage="Retrieving tenant organizations, multi-company access, subscription billing, and user permissions..."
        />
        <CardSkeleton count={4} />
      </div>
    );
  }

  if (!loading && user?.role !== "SUPER_ADMIN") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 space-y-4">
        <div className="h-14 w-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
          <ShieldCheck className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Admin Portal Access Restricted
        </h2>
        <p className="text-xs text-slate-500 max-w-md">
          Only the Super Administrator has permission to access the central Admin Portal, company registrations, and user management.
        </p>
        <Link
          href="/"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition shadow-sm"
        >
          Return to Operational Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-xl bg-purple-500/20 border border-purple-400/30 px-3 py-1 text-xs font-bold text-purple-300 mb-3">
              <ShieldCheck className="h-4 w-4" />
              <span>Multi-Tenant Administration Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Enterprise Control Center
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
              Centralized administration to create and manage multiple companies, user accounts, role-based access permissions, and global ledger configurations.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-2.5 w-full sm:w-auto">
            <Link
              href="/admin/companies"
              className="inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-3.5 sm:px-4 py-2.5 text-xs font-bold text-white shadow-lg transition"
            >
              <Plus className="h-4 w-4" />
              <span>New Company</span>
            </Link>
            <Link
              href="/admin/users"
              className="inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl bg-purple-600 hover:bg-purple-500 px-3.5 sm:px-4 py-2.5 text-xs font-bold text-white shadow-lg transition"
            >
              <Users className="h-4 w-4" />
              <span>Manage Users</span>
            </Link>
            <Link
              href="/"
              className="col-span-2 sm:col-span-1 inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3.5 sm:px-4 py-2.5 text-xs font-bold text-white transition"
            >
              <span>Accounting App</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-600">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Registered Companies
                </p>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  {companies.length}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/40">
                <Building2 className="h-5 w-5" />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-3 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span>All active & isolated</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-600">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Total Users
                </p>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  {users.length}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-900/40">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-3">
              Role-based RBAC enforced
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-600">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Active Company
                </p>
                <p className="text-base font-bold text-slate-900 dark:text-white mt-1 truncate max-w-full sm:max-w-[170px]">
                  {activeCompany?.name || "HANIF Mobile"}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-3">
              Currently Selected
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-600">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Total Monthly Revenue (MRR)
                </p>
                <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  Rs {Number(billingStats?.totalMRR || 19000).toLocaleString()}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-900/40">
                <Banknote className="h-5 w-5" />
              </div>
            </div>
            <p className="text-[11px] text-emerald-600 font-semibold mt-3 flex items-center justify-between">
              <span>Rs {Number(billingStats?.collectedThisMonth || 0).toLocaleString()} collected</span>
              <span className="text-slate-400">ARR: Rs {Number((billingStats?.totalMRR || 19000) * 12).toLocaleString()}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Companies Directory (Left 2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-600" />
              <span>Registered Companies & Businesses</span>
            </h2>
            <Link
              href="/admin/companies"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <span>Manage All ({companies.length})</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {companies.map((comp) => {
              const isActive = comp.id === activeCompany?.id;
              return (
                <Card
                  key={comp.id}
                  className={`transition border-2 ${
                    isActive
                      ? "border-blue-500 shadow-md bg-blue-50/10 dark:bg-blue-950/20"
                      : "border-slate-200 hover:border-slate-300 dark:border-slate-800"
                  }`}
                >
                  <CardContent className="p-5 flex flex-col justify-between h-full">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          {comp.name}
                        </h3>
                        {isActive ? (
                          <Badge variant="default" className="bg-blue-600 text-white text-[10px]">
                            Active
                          </Badge>
                        ) : (
                          <button
                            disabled={switchingCompanyId !== null}
                            onClick={async () => {
                              setSwitchingCompanyId(comp.id);
                              await switchCompany(comp.id);
                              setSwitchingCompanyId(null);
                            }}
                            className="text-[10px] font-bold text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-1"
                          >
                            {switchingCompanyId === comp.id && (
                              <span className="inline-block h-2 w-2 animate-spin rounded-full border border-blue-600 border-t-transparent" />
                            )}
                            <span>{switchingCompanyId === comp.id ? "Switching..." : "Switch Here"}</span>
                          </button>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Owner: <span className="font-semibold text-slate-700 dark:text-slate-300">{comp.ownerName}</span>
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Phone: {comp.phone || "—"}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {comp.address || "Pakistan"}
                      </p>

                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col xs:flex-row xs:items-center justify-between gap-1 text-[11px] text-slate-500">
                        <span>Monthly Fee: <strong className="text-emerald-700 dark:text-emerald-400 font-bold">Rs {Number(comp.monthlyFee || 5000).toLocaleString()}</strong></span>
                        <span>Renewal: <strong className="text-slate-800 dark:text-slate-200">{comp.billingCycleEnd ? new Date(comp.billingCycleEnd).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—"}</strong></span>
                      </div>
                    </div>

                    <div className="mt-4 pt-2">
                      <button
                        disabled={switchingCompanyId !== null}
                        onClick={async () => {
                          if (isActive) return;
                          setSwitchingCompanyId(comp.id);
                          await switchCompany(comp.id);
                          setSwitchingCompanyId(null);
                        }}
                        className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                          isActive
                            ? "bg-blue-600 text-white shadow-sm"
                            : switchingCompanyId === comp.id
                            ? "bg-amber-50 text-amber-800 border border-amber-300 animate-pulse cursor-wait"
                            : "bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        }`}
                      >
                        {switchingCompanyId === comp.id ? (
                          <>
                            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
                            <span>Switching to {comp.name}...</span>
                          </>
                        ) : (
                          <>
                            <Building2 className="h-3.5 w-3.5" />
                            <span>{isActive ? "Currently Managing" : "Manage This Company"}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* System Users Preview (Right col) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-600" />
              <span>User Accounts</span>
            </h2>
            <Link
              href="/admin/users"
              className="text-xs font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1"
            >
              <span>All Users</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <Card>
            <CardHeader className="p-4 pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Active System Members
                </CardTitle>
                <Link
                  href="/admin/users"
                  className="inline-flex items-center gap-1 text-xs font-bold text-purple-600 hover:text-purple-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add</span>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {users.slice(0, 5).map((u) => (
                <div key={u.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition">
                  <div className="min-w-0 pr-2">
                    <p className="font-bold text-slate-800 dark:text-slate-200 truncate">
                      {u.name}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">{u.email}</p>
                  </div>
                  <span
                    className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-lg shrink-0 ${roleBadgeColor(
                      u.role
                    )}`}
                  >
                    {u.role}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Quick Admin Actions Box */}
          <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800/80 border-slate-200 dark:border-slate-700">
            <CardContent className="p-4 space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Admin Shortcuts
              </h3>
              <div className="space-y-1.5">
                <Link
                  href="/admin/companies"
                  className="w-full flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-blue-500 transition"
                >
                  <span className="flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 text-blue-600" />
                    <span>Company Directory & Settings</span>
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                </Link>

                <Link
                  href="/admin/users"
                  className="w-full flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-purple-500 transition"
                >
                  <span className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-purple-600" />
                    <span>Create & Manage Staff Logins</span>
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                </Link>

                <Link
                  href="/settings"
                  className="w-full flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-slate-400 transition"
                >
                  <span className="flex items-center gap-2">
                    <Settings className="h-3.5 w-3.5 text-slate-600" />
                    <span>Audit Logs & Period Locks</span>
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
