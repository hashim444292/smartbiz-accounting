"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  Plus,
  Package,
  Menu,
  Building2,
  Users,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";

interface BottomNavProps {
  onOpenMenu: () => void;
}

export function BottomNav({ onOpenMenu }: BottomNavProps) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { user, isInspectingClient } = useAuth();
  const isPlatformMode = (user?.role === "SUPER_ADMIN" || user?.role === "ADMIN") && !isInspectingClient;

  // Don't render on login page
  if (pathname === "/login") return null;

  // Tenant mode routes
  const isHomeActive = pathname === "/";
  const isSalesActive = pathname.startsWith("/sales") && pathname !== "/sales/create";
  const isCreateSaleActive = pathname === "/sales/create";
  const isProductsActive = pathname.startsWith("/products");

  // Platform Admin mode routes
  const isAdminHomeActive = pathname === "/admin";
  const isCompaniesActive = pathname.startsWith("/admin/companies");
  const isUsersActive = pathname.startsWith("/admin/users");

  return (
    <nav
      aria-label="Mobile Navigation"
      data-no-print
      className="print:hidden fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-slate-200/90 bg-white/95 px-2 backdrop-blur-md shadow-[0_-4px_16px_rgba(0,0,0,0.06)] dark:border-slate-800 dark:bg-[#111827]/95 lg:hidden pb-[env(safe-area-inset-bottom)]"
    >
      {/* 1. Dashboard / Home / Admin */}
      <Link
        href={isPlatformMode ? "/admin" : "/"}
        className={`flex flex-1 flex-col items-center justify-center py-1 transition-colors ${
          (isPlatformMode ? isAdminHomeActive : isHomeActive)
            ? "text-indigo-600 dark:text-indigo-400 font-bold"
            : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
        }`}
      >
        <div className={`p-1 rounded-xl transition ${(isPlatformMode ? isAdminHomeActive : isHomeActive) ? "bg-indigo-50 dark:bg-indigo-950/60" : ""}`}>
          <LayoutDashboard className="h-5 w-5" />
        </div>
        <span className="text-[10px] tracking-tight mt-0.5">
          {isPlatformMode ? t("Admin", "ایڈمن") : t("Home", "ہوم")}
        </span>
      </Link>

      {/* 2. Companies (Platform) / Sales (Tenant) */}
      <Link
        href={isPlatformMode ? "/admin/companies" : "/sales"}
        className={`flex flex-1 flex-col items-center justify-center py-1 transition-colors ${
          (isPlatformMode ? isCompaniesActive : isSalesActive)
            ? "text-indigo-600 dark:text-indigo-400 font-bold"
            : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
        }`}
      >
        <div className={`p-1 rounded-xl transition ${(isPlatformMode ? isCompaniesActive : isSalesActive) ? "bg-indigo-50 dark:bg-indigo-950/60" : ""}`}>
          {isPlatformMode ? <Building2 className="h-5 w-5" /> : <Receipt className="h-5 w-5" />}
        </div>
        <span className="text-[10px] tracking-tight mt-0.5">
          {isPlatformMode ? t("Companies", "کمپنیاں") : t("Sales", "سیلز")}
        </span>
      </Link>

      {/* 3. Center Elevated Action: + New Company (Platform) / + New Sale (Tenant) */}
      <div className="flex flex-1 flex-col items-center justify-center -mt-5">
        <Link
          href={isPlatformMode ? "/admin/companies" : "/sales/create"}
          aria-label={isPlatformMode ? "Add New Company" : "Create New Invoice"}
          className={`flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-500/30 ring-4 ring-white dark:ring-[#111827] active:scale-95 transition-transform ${
            (!isPlatformMode && isCreateSaleActive) ? "ring-indigo-300 dark:ring-indigo-800" : ""
          }`}
        >
          <Plus className="h-6 w-6 stroke-[2.5]" />
        </Link>
        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 mt-1">
          {isPlatformMode ? t("New Co.", "نئی کمپنی") : t("New Bill", "نیا بل")}
        </span>
      </div>

      {/* 4. Users (Platform) / Products (Tenant) */}
      <Link
        href={isPlatformMode ? "/admin/users" : "/products"}
        className={`flex flex-1 flex-col items-center justify-center py-1 transition-colors ${
          (isPlatformMode ? isUsersActive : isProductsActive)
            ? "text-indigo-600 dark:text-indigo-400 font-bold"
            : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
        }`}
      >
        <div className={`p-1 rounded-xl transition ${(isPlatformMode ? isUsersActive : isProductsActive) ? "bg-indigo-50 dark:bg-indigo-950/60" : ""}`}>
          {isPlatformMode ? <Users className="h-5 w-5" /> : <Package className="h-5 w-5" />}
        </div>
        <span className="text-[10px] tracking-tight mt-0.5">
          {isPlatformMode ? t("Users", "صارفین") : t("Products", "پروڈکٹس")}
        </span>
      </Link>

      {/* 5. Menu Drawer */}
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open Navigation Menu"
        className="flex flex-1 flex-col items-center justify-center py-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
      >
        <div className="p-1 rounded-xl">
          <Menu className="h-5 w-5" />
        </div>
        <span className="text-[10px] tracking-tight mt-0.5">
          {t("Menu", "مینو")}
        </span>
      </button>
    </nav>
  );
}
