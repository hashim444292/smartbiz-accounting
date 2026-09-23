"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  ShoppingBag,
  Boxes,
  Users,
  Truck,
  Wallet,
  Coins,
  BookOpen,
  ShieldCheck,
  Package,
  UploadCloud,
  Sparkles,
  BarChart3,
  Building2,
  UserCheck,
  Settings,
  Store,
  History,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface NavItem {
  name: string;
  sublabel?: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  roles?: string[];
  moduleKey?: string;
}

interface NavGroup {
  section: string;
  items: NavItem[];
}

const TENANT_NAVIGATION_GROUPS: NavGroup[] = [
  {
    section: "بنیادی ڈیش بورڈ • OVERVIEW",
    items: [
      { name: "Executive Dashboard", sublabel: "مرکزی ڈیش بورڈ", href: "/", icon: LayoutDashboard },
    ],
  },
  {
    section: "روزمرہ کا کام • DAILY WORK",
    items: [
      { name: "Sales & Invoices", sublabel: "مال بیچیں (کسٹمر بل)", href: "/sales", icon: Receipt, moduleKey: "sales" },
      { name: "Purchases & Bills", sublabel: "مال خریدیں (سپلائر بل)", href: "/purchases", icon: ShoppingBag, moduleKey: "purchases" },
      { name: "Cash & Payments", sublabel: "پیسے وصولی و ادائیگی", href: "/payments", icon: Wallet, moduleKey: "accounting" },
      { name: "Daily Expenses", sublabel: "دکان کے روزمرہ خرچے", href: "/expenses", icon: Coins, moduleKey: "accounting" },
    ],
  },
  {
    section: "کھاتہ و اسٹاک • STOCK & KHATA",
    items: [
      { name: "Inventory & Stock", sublabel: "دکان کا مال و اسٹاک", href: "/inventory", icon: Boxes, moduleKey: "inventory" },
      { name: "Customers (Receivables)", sublabel: "گاہکوں کا ادھار کھاتہ", href: "/customers", icon: Users, moduleKey: "sales" },
      { name: "Suppliers (Payables)", sublabel: "سپلائرز کا ادھار کھاتہ", href: "/suppliers", icon: Truck, moduleKey: "purchases" },
      { name: "Products & Rates", sublabel: "سامان و آئٹم ریٹ لسٹ", href: "/products", icon: Package, moduleKey: "inventory" },
    ],
  },
  {
    section: "ٹیکس اور رپورٹس • REPORTS & TAX",
    items: [
      { name: "Closing & Reports", sublabel: "کھاتہ بندش و منافع رپورٹ", href: "/reports", icon: BarChart3, roles: ["SUPER_ADMIN", "OWNER_ADMIN", "ACCOUNTANT"], moduleKey: "reports" },
      { name: "FBR POS Digital", sublabel: "FBR ڈیجیٹل انوائسنگ", href: "/compliance/fbr", icon: ShieldCheck, badge: "FBR Live", moduleKey: "compliance" },
      { name: "General Ledger", sublabel: "ڈبل انٹری جنرل لیجر", href: "/accounting", icon: BookOpen, roles: ["SUPER_ADMIN", "OWNER_ADMIN", "ACCOUNTANT"], moduleKey: "accounting" },
      { name: "AI Invoice Reader", sublabel: "انوائس اسکینر", href: "/ai-entry", icon: Sparkles, moduleKey: "aiEntry" },
    ],
  },
  {
    section: "ادارہ و ترتیبات • ORGANIZATION",
    items: [
      { name: "Sub-Branches", sublabel: "آؤٹ لیٹس و برانچز", href: "/branches", icon: Store, roles: ["SUPER_ADMIN", "OWNER_ADMIN"] },
      { name: "Activity Log", sublabel: "آڈٹ ٹریک لاگ", href: "/audit-logs", icon: History, roles: ["SUPER_ADMIN", "OWNER_ADMIN", "ACCOUNTANT"] },
      { name: "Settings & Defaults", sublabel: "کمپنی سیٹنگز", href: "/settings", icon: Settings, roles: ["SUPER_ADMIN", "OWNER_ADMIN"] },
    ],
  },
];

const PLATFORM_ADMIN_GROUPS: NavGroup[] = [
  {
    section: "PLATFORM SAAS CONTROL",
    items: [
      { name: "Admin Dashboard", href: "/admin", icon: LayoutDashboard },
      { name: "Client Companies & MRR", href: "/admin/companies", icon: Building2 },
      { name: "User Accounts & Roles", href: "/admin/users", icon: UserCheck },
      { name: "Activity Log (آڈٹ لاگ)", href: "/audit-logs", icon: History },
      { name: "Platform Settings & Audit", href: "/settings", icon: Settings },
    ],
  },
];

export function Sidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const { user, activeCompany, companies, isInspectingClient, inspectCompany, exitInspection } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Read saved collapse state from localStorage if available
  useEffect(() => {
    try {
      const saved = localStorage.getItem("sb_sidebar_collapsed");
      if (saved !== null) {
        setIsCollapsed(saved === "true");
      }
    } catch {}
  }, []);

  const toggleCollapse = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    try {
      localStorage.setItem("sb_sidebar_collapsed", String(nextState));
      window.dispatchEvent(new Event("storage"));
    } catch {}
  };

  const userRole = user?.role || "STAFF";
  const isPlatformMode = userRole === "SUPER_ADMIN" && !isInspectingClient;
  const currentGroups = isPlatformMode ? PLATFORM_ADMIN_GROUPS : TENANT_NAVIGATION_GROUPS;

  const isItemActive = (href: string) => {
    if (href === "/" || href === "/admin") {
      return pathname === href;
    }
    const cleanHref = href.split("?")[0].split("#")[0];
    return pathname === cleanHref || pathname.startsWith(`${cleanHref}/`);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden animate-in fade-in"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col border-r border-slate-200/90 bg-white text-slate-700 shadow-subtle transition-all duration-300 ease-in-out dark:border-slate-800/90 dark:bg-[#111827] dark:text-slate-300 lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } ${isCollapsed ? "w-20" : "w-64"}`}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-slate-200/80 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/40">
          <Link href={isPlatformMode ? "/admin" : "/"} className="flex items-center gap-3 overflow-hidden">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white font-bold shadow-xs transition ${
                isPlatformMode
                  ? "bg-slate-900 border border-slate-700 dark:bg-slate-800 dark:border-slate-600"
                  : "bg-indigo-600 border border-indigo-500/80 shadow-indigo-600/20"
              }`}
            >
              <ShieldCheck className="h-5 w-5" />
            </div>
            {!isCollapsed && (
              <div className="leading-none overflow-hidden text-ellipsis whitespace-nowrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white font-sans">
                    SmartBiz
                  </span>
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide border ${
                      isPlatformMode
                        ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800"
                        : "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800"
                    }`}
                  >
                    {isPlatformMode ? "PLATFORM" : "ERP"}
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                  {isPlatformMode ? "SaaS Multi-Tenant Admin" : "Accounting & FBR Suite"}
                </span>
              </div>
            )}
          </Link>

          {/* Desktop Collapse Toggle */}
          <button
            onClick={toggleCollapse}
            aria-label={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            className="hidden lg:flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700"
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Support / Inspection Mode Callout */}
        {!isCollapsed && isInspectingClient && (
          <div className="p-3 bg-amber-50 border-b border-amber-200 text-xs dark:bg-amber-950/40 dark:border-amber-900">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                Support Inspection Mode
              </span>
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            </div>
            <p className="font-bold text-slate-900 dark:text-white truncate">{activeCompany?.name}</p>
            <button
              onClick={exitInspection}
              className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 px-2 bg-white hover:bg-amber-100/80 border border-amber-300 rounded-xl text-[11px] font-bold text-amber-900 transition shadow-2xs dark:bg-amber-900/60 dark:text-amber-200 dark:border-amber-700"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Return to Platform Admin</span>
            </button>
          </div>
        )}

        {/* Active Client Badge for normal tenant users */}
        {!isCollapsed && !isPlatformMode && !isInspectingClient && activeCompany && (
          <div className="px-3.5 py-2.5 bg-indigo-50/50 border-b border-indigo-100/70 dark:bg-indigo-950/25 dark:border-indigo-900/40 flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-600 dark:text-indigo-400 block">
                Active Client
              </span>
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {activeCompany.name}
              </p>
            </div>
            {activeCompany.defaultHsCode && (
              <span className="shrink-0 text-[10px] font-mono bg-white px-1.5 py-0.5 rounded-md text-indigo-700 border border-indigo-200 shadow-2xs dark:bg-slate-900 dark:text-indigo-300 dark:border-indigo-800">
                HS {activeCompany.defaultHsCode}
              </span>
            )}
          </div>
        )}

        {/* Scrollable Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-3.5 space-y-4 scrollbar-thin">
          {currentGroups.map((group) => {
            const filteredItems = group.items.filter((item) => {
              // 1. Role filter
              if (item.roles && userRole !== "SUPER_ADMIN" && !item.roles.includes(userRole)) {
                return false;
              }
              // 2. Module gating per company
              if (item.moduleKey && activeCompany?.enabledModules) {
                if (!activeCompany.enabledModules.includes(item.moduleKey)) {
                  return false;
                }
              }
              return true;
            });

            if (filteredItems.length === 0) return null;

            return (
              <div key={group.section} className="space-y-1">
                {/* Section Header */}
                {!isCollapsed ? (
                  <h3 className="px-2.5 text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
                    {group.section}
                  </h3>
                ) : (
                  <div className="my-2 border-t border-slate-200 dark:border-slate-800 mx-2" />
                )}

                {/* Items */}
                <div className="space-y-0.5">
                  {filteredItems.map((item) => {
                    const active = isItemActive(item.href);
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={onClose}
                        title={isCollapsed ? item.name : undefined}
                        className={`group relative flex items-center gap-3 rounded-xl px-2.5 py-2 text-xs font-semibold transition-all ${
                          active
                            ? "bg-indigo-50/90 text-indigo-700 font-bold border border-indigo-100/90 shadow-2xs dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/60"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60 dark:hover:text-white"
                        } ${isCollapsed ? "justify-center px-0" : ""}`}
                      >
                        <Icon
                          className={`h-4 w-4 shrink-0 transition-colors ${
                            active
                              ? "text-indigo-600 dark:text-indigo-400"
                              : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300"
                          }`}
                        />
                        {!isCollapsed && (
                          <div className="flex flex-col min-w-0 flex-1 leading-snug text-left">
                            <span className="truncate tracking-tight font-semibold">
                              {item.name}
                            </span>
                            {item.sublabel && (
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-sans truncate font-normal">
                                {item.sublabel}
                              </span>
                            )}
                          </div>
                        )}
                        {!isCollapsed && item.badge && (
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                              active
                                ? "bg-indigo-600 text-white dark:bg-indigo-500"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Quick Inspection Section when in Super Admin Platform mode */}
          {isPlatformMode && !isCollapsed && (
            <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between px-2.5 mb-1">
                <h3 className="text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
                  Inspect Tenant Workspace
                </h3>
                <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded dark:bg-indigo-950/60 dark:text-indigo-300">
                  {companies.length}
                </span>
              </div>
              <div className="space-y-0.5">
                {companies.map((comp) => (
                  <button
                    key={comp.id}
                    onClick={async () => {
                      await inspectCompany(comp.id);
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left text-xs font-medium text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
                  >
                    <span className="truncate pr-2">{comp.name}</span>
                    <ExternalLink className="h-3 w-3 text-slate-400 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-slate-200/80 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/40">
          {!isCollapsed ? (
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {isPlatformMode ? "SaaS Multi-Tenant" : "FBR POS Live"}
                </span>
              </div>
              <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">v3.2</span>
            </div>
          ) : (
            <div className="flex justify-center">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="Live" />
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
