"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Menu,
  Plus,
  Building2,
  ChevronDown,
  Check,
  ShieldCheck,
  LogOut,
  Search,
  Receipt,
  Package,
  Users,
  KeyRound,
  X,
  ArrowRight,
  Sun,
  Moon,
  Monitor,
  Type,
} from "lucide-react";
import { DateRangeSelector } from "./DateRangeSelector";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const {
    user,
    activeCompany,
    companies,
    switchCompany,
    switchUser,
    logout,
    isInspectingClient,
    inspectCompany,
    exitInspection,
  } = useAuth();
  const { theme, resolvedTheme, setTheme, toggleTheme, font, setFont, fontOptions } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  // Company dropdown state
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [switchingCompanyId, setSwitchingCompanyId] = useState<string | null>(null);

  // User switcher dropdown state
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [switchingUserId, setSwitchingUserId] = useState<string | null>(null);

  // Theme switcher dropdown state
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  // Typography font switcher dropdown state
  const [fontMenuOpen, setFontMenuOpen] = useState(false);
  const fontMenuRef = useRef<HTMLDivElement>(null);

  // Global Quick Search state (Cmd + K)
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{
    invoices: any[];
    customers: any[];
    products: any[];
  }>({ invoices: [], customers: [], products: [] });
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) {
        setThemeMenuOpen(false);
      }
      if (fontMenuRef.current && !fontMenuRef.current.contains(event.target as Node)) {
        setFontMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard shortcut for Global Search (Cmd + K or Ctrl + K)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (e.key === "Escape" && searchOpen) {
        setSearchOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchOpen]);

  // Focus input when modal opens
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery("");
      setSearchResults({ invoices: [], customers: [], products: [] });
    }
  }, [searchOpen]);

  // Live search debounced query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults({ invoices: [], customers: [], products: [] });
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery.trim())}`);
        const data = await res.json();
        if (data.success) {
          setSearchResults(data.data);
        }
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const roleBadgeColor = (role?: string) => {
    switch (role) {
      case "SUPER_ADMIN":
        return "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800";
      case "OWNER_ADMIN":
        return "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800";
      case "ACCOUNTANT":
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
      default:
        return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700";
    }
  };

  const handleSelectResult = (url: string) => {
    setSearchOpen(false);
    router.push(url);
  };

  const QUICK_USERS = [
    { id: "usr-1", name: "System Super Admin", email: "admin@smartbiz.com", role: "SUPER_ADMIN", icon: "👑" },
    { id: "usr-2", name: "Muhammad Hanif (Owner)", email: "hanif@mobile.com", role: "OWNER_ADMIN", icon: "🏢" },
    { id: "usr-3", name: "Farhan Accountant", email: "accountant@smartbiz.com", role: "ACCOUNTANT", icon: "📊" },
    { id: "usr-4", name: "Bilal Cashier (Staff)", email: "staff@smartbiz.com", role: "STAFF", icon: "💼" },
  ];

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200/80 bg-white/95 px-3.5 sm:px-6 backdrop-blur-md dark:border-slate-800/90 dark:bg-[#111827]/95 transition-colors duration-150">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <button
            onClick={onMenuClick}
            aria-label="Toggle menu"
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 lg:hidden transition"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Company Context / Switcher */}
          {user?.role === "SUPER_ADMIN" ? (
            <div className="relative" ref={dropdownRef}>
              <button
                disabled={switchingCompanyId !== null}
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                  switchingCompanyId !== null
                    ? "bg-amber-50 text-amber-800 border-amber-300 animate-pulse cursor-wait"
                    : isInspectingClient
                    ? "border-amber-300 bg-amber-50/80 text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200"
                    : "border-indigo-200 bg-indigo-50/70 text-indigo-900 hover:bg-indigo-100/80 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300"
                }`}
                title={isInspectingClient ? "Click to switch inspected company or exit" : "Click to inspect a client company"}
              >
                {switchingCompanyId !== null ? (
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-600 border-t-transparent shrink-0" />
                ) : isInspectingClient ? (
                  <span className="text-amber-600 text-sm">🛠️</span>
                ) : (
                  <span className="text-indigo-600 dark:text-indigo-400 text-sm">👑</span>
                )}
                <div className="text-left max-w-[120px] sm:max-w-[200px] truncate">
                  <span className="block truncate leading-tight font-bold">
                    {switchingCompanyId !== null
                      ? "Switching Company..."
                      : isInspectingClient
                      ? activeCompany?.name || "Inspect Client"
                      : "SaaS Platform Admin"}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                    {isInspectingClient ? "Inspecting Client Books" : `${companies.length} Registered Tenants`}
                  </span>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400 ml-1 shrink-0" />
              </button>

              {dropdownOpen && (
                <div className="absolute left-0 mt-2 w-76 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-[#111827] z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      Multi-Tenant Workspace Inspector
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Inspect any client&apos;s operational accounting & POS
                    </p>
                  </div>

                  {isInspectingClient && (
                    <div className="p-1 mb-1">
                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          exitInspection();
                        }}
                        className="w-full flex items-center justify-between p-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-xs font-bold text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800 transition"
                      >
                        <span>← Return to Platform Admin Portal</span>
                        <span>✕</span>
                      </button>
                    </div>
                  )}

                  <div className="max-h-56 overflow-y-auto space-y-1">
                    {companies.map((c) => {
                      const isSelected = isInspectingClient && c.id === activeCompany?.id;
                      const isSwitching = switchingCompanyId === c.id;
                      return (
                        <button
                          key={c.id}
                          disabled={switchingCompanyId !== null}
                          onClick={async () => {
                            if (isSelected) {
                              setDropdownOpen(false);
                              return;
                            }
                            setSwitchingCompanyId(c.id);
                            await inspectCompany(c.id);
                            setSwitchingCompanyId(null);
                            setDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-medium transition ${
                            isSwitching
                              ? "bg-amber-50 text-amber-800 font-bold border border-amber-300 animate-pulse cursor-wait dark:bg-amber-950/60 dark:text-amber-200"
                              : isSelected
                              ? "bg-indigo-50 text-indigo-700 font-bold dark:bg-indigo-950/60 dark:text-indigo-300"
                              : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/70"
                          }`}
                        >
                          <div className="truncate pr-2">
                            <p className="truncate font-semibold flex items-center gap-1.5">
                              {c.name}
                              {isSwitching && (
                                <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
                              )}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-normal">
                              <span>Fee: Rs {Number(c.monthlyFee || 5000).toLocaleString()}/mo</span>
                              {c.defaultHsCode && (
                                <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">
                                  HS: {c.defaultHsCode}
                                </span>
                              )}
                            </div>
                          </div>
                          {isSwitching ? (
                            <span className="text-[10px] text-amber-600 font-bold">Opening...</span>
                          ) : isSelected ? (
                            <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                          ) : (
                            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold opacity-0 group-hover:opacity-100">Inspect</span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-1 pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between px-1">
                    <Link
                      href="/admin/companies"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-slate-800 font-semibold transition"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Register Company</span>
                    </Link>
                    <Link
                      href="/admin"
                      onClick={() => setDropdownOpen(false)}
                      className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-semibold px-2 transition"
                    >
                      Admin Center &rarr;
                    </Link>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Tenant User: Isolated to their own company only */
            <div className="flex items-center gap-2 rounded-xl border border-slate-200/90 bg-slate-50/80 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200">
              <Building2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <div className="text-left max-w-[130px] sm:max-w-[200px] truncate">
                <span className="block truncate font-bold leading-tight">
                  {activeCompany?.name || "Company Workspace"}
                </span>
                {activeCompany?.defaultHsCode && (
                  <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                    HS: {activeCompany.defaultHsCode}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Categorized Global Search Trigger */}
          <button
            onClick={() => setSearchOpen(true)}
            className="hidden md:flex items-center gap-2 rounded-xl border border-slate-200/90 bg-slate-100/70 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400 dark:hover:text-slate-200 transition w-60 lg:w-76 justify-between shadow-2xs"
          >
            <div className="flex items-center gap-2 truncate">
              <Search className="h-3.5 w-3.5 text-slate-400" />
              <span className="truncate">Search invoices, items, NTN...</span>
            </div>
            <kbd className="rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-500 shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 shrink-0">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right Nav Actions */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Mobile search button */}
          <button
            onClick={() => setSearchOpen(true)}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 md:hidden transition"
            title="Global Search"
          >
            <Search className="h-4 w-4" />
          </button>

          {/* Global Date Range Selector */}
          <DateRangeSelector />

          {/* Typography / Font Family Switcher */}
          <div className="relative" ref={fontMenuRef}>
            <button
              onClick={() => setFontMenuOpen(!fontMenuOpen)}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white transition shadow-2xs"
              title={`Typography: ${fontOptions.find((f) => f.id === font)?.name || "Font"} (Click to customize typeface)`}
            >
              <Type className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span className="hidden xl:inline text-[11px] font-bold">
                {fontOptions.find((f) => f.id === font)?.name || "Inter"}
              </span>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </button>

            {fontMenuOpen && (
              <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-[#111827] z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-2.5 py-1.5 mb-1 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Type className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                    ERP Typography
                  </p>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    Select enterprise typeface (persists automatically)
                  </p>
                </div>

                <div className="space-y-1">
                  {fontOptions.map((opt) => {
                    const isSelected = font === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => {
                          setFont(opt.id);
                          setFontMenuOpen(false);
                        }}
                        className={`w-full flex items-start justify-between rounded-xl p-2 text-left transition ${
                          isSelected
                            ? "bg-indigo-50 border border-indigo-200/80 dark:bg-indigo-950/60 dark:border-indigo-800/80"
                            : "hover:bg-slate-100 dark:hover:bg-slate-800/70 border border-transparent"
                        }`}
                      >
                        <div className="pr-2">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-xs font-bold ${opt.className} ${
                                isSelected
                                  ? "text-indigo-700 dark:text-indigo-300"
                                  : "text-slate-800 dark:text-slate-200"
                              }`}
                            >
                              {opt.name}
                            </span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-medium">
                              {opt.category}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                            {opt.description}
                          </p>
                        </div>
                        {isSelected && (
                          <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800 px-2 text-[10px] text-slate-400 leading-tight flex items-center gap-1">
                  <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">123</span>
                  <span>Ledgers & figures use JetBrains Mono tabular spacing.</span>
                </div>
              </div>
            )}
          </div>

          {/* Theme Switcher Toggle */}
          <div className="relative" ref={themeMenuRef}>
            <button
              onClick={() => setThemeMenuOpen(!themeMenuOpen)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white transition shadow-2xs"
              title={`Current theme: ${theme} (Click to toggle)`}
            >
              {resolvedTheme === "dark" ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4 text-slate-600" />
              )}
            </button>

            {themeMenuOpen && (
              <div className="absolute right-0 mt-2 w-36 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-800 dark:bg-[#111827] z-50 animate-in fade-in zoom-in-95 duration-100">
                <button
                  onClick={() => {
                    setTheme("light");
                    setThemeMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                    theme === "light"
                      ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
                      : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  <Sun className="h-3.5 w-3.5 text-amber-500" />
                  <span>Light</span>
                </button>
                <button
                  onClick={() => {
                    setTheme("dark");
                    setThemeMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                    theme === "dark"
                      ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
                      : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  <Moon className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Dark</span>
                </button>
                <button
                  onClick={() => {
                    setTheme("system");
                    setThemeMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                    theme === "system"
                      ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
                      : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  <Monitor className="h-3.5 w-3.5 text-slate-400" />
                  <span>System</span>
                </button>
              </div>
            )}
          </div>

          {/* Quick Action: Contextual Add Button */}
          {pathname?.startsWith("/purchases") ? (
            <Link
              href="/purchases/create"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 shadow-2xs transition hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300"
            >
              <Plus className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Add Purchase</span>
            </Link>
          ) : (
            <Link
              href="/products/create"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Package className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
              <span>Add Product</span>
            </Link>
          )}

          {/* Quick Action: FBR POS Sale */}
          <Link
            href="/compliance/fbr"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700 shadow-indigo-600/20"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>FBR POS Sale</span>
          </Link>

          {/* User Badge & Profile with Dropdown */}
          <div className="relative pl-1 border-l border-slate-200 dark:border-slate-800" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
            >
              <div className="hidden xl:flex flex-col items-end text-right">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">
                  {user?.name || "Guest User"}
                </span>
                <span
                  className={`inline-block px-1.5 py-0.2 text-[9px] font-bold rounded border ${roleBadgeColor(
                    user?.role
                  )}`}
                >
                  {user?.role || "USER"}
                </span>
              </div>

              <div
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-xs"
                title={`${user?.name || "User"} (${user?.role || ""})`}
              >
                {getInitials(user?.name)}
              </div>

              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>

            {/* User Profile Dropdown Menu */}
            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-800 dark:bg-[#111827] z-50 animate-in fade-in zoom-in-95">
                {/* Current User Header */}
                <Link
                  href="/profile"
                  onClick={() => setUserMenuOpen(false)}
                  className="block group border-b border-slate-100 dark:border-slate-800 pb-2.5 mb-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 -mx-1 px-1.5 pt-1 rounded-xl transition"
                  title="Click to view your profile and security settings"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 truncate">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-xs shrink-0 shadow-xs">
                        {getInitials(user?.name)}
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400 truncate transition">
                          {user?.name}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition shrink-0 ml-1">
                      View &rarr;
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] bg-slate-50 dark:bg-slate-900/60 px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-800 group-hover:border-indigo-100 dark:group-hover:border-indigo-900/50">
                    <span className="text-slate-500 dark:text-slate-400">
                      {user?.role === "SUPER_ADMIN" ? (isInspectingClient ? "Inspecting:" : "Scope:") : "Active Client:"}
                    </span>
                    <span className="font-bold text-indigo-700 dark:text-indigo-300 truncate max-w-[140px]">
                      {user?.role === "SUPER_ADMIN" ? (isInspectingClient ? activeCompany?.name : "Global SaaS Platform") : activeCompany?.name}
                    </span>
                  </div>
                </Link>

                {/* Switch User Account List - STRICTLY FOR SUPER ADMIN ONLY */}
                {user?.role === "SUPER_ADMIN" ? (
                  <>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1 mb-1">
                        Admin Switch User Account
                      </p>
                      {QUICK_USERS.map((qu) => {
                        const isCurrent = user?.email === qu.email || user?.userId === qu.id;
                        return (
                          <button
                            key={qu.id}
                            type="button"
                            onClick={async () => {
                              if (isCurrent) return;
                              setSwitchingUserId(qu.id);
                              await switchUser(qu.id);
                              setSwitchingUserId(null);
                              setUserMenuOpen(false);
                            }}
                            disabled={switchingUserId === qu.id}
                            className={`w-full flex items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-xs transition ${
                              isCurrent
                                ? "bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800"
                                : "text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                            }`}
                          >
                            <div className="truncate pr-2 flex items-center gap-2">
                              <span>{qu.icon}</span>
                              <div className="truncate">
                                <p className="truncate font-semibold">{qu.name}</p>
                                <p className="text-[10px] text-slate-400 truncate">{qu.email}</p>
                              </div>
                            </div>
                            {switchingUserId === qu.id ? (
                              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                            ) : isCurrent ? (
                              <span className="text-[9px] bg-indigo-600 text-white px-1.5 py-0.2 rounded font-bold">Current</span>
                            ) : (
                              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 opacity-0 hover:opacity-100">Switch</span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800 mt-2">
                      <Link
                        href="/profile"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 font-bold transition border border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800"
                      >
                        <KeyRound className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>My Profile & Password</span>
                      </Link>
                      <Link
                        href="/admin/users"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 font-medium transition"
                      >
                        <Users className="h-3.5 w-3.5 text-slate-500" />
                        <span>Manage User Accounts</span>
                      </Link>
                      <Link
                        href="/admin/companies"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 font-medium transition"
                      >
                        <Building2 className="h-3.5 w-3.5 text-slate-500" />
                        <span>Manage Companies / Clients</span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          logout();
                        }}
                        className="w-full flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30 font-semibold transition"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </>
                ) : (
                  /* Client Profile Menu - No User Switching, Only Profile, Settings & Logout */
                  <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <Link
                      href="/profile"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 font-bold transition border border-indigo-200 mb-1.5 shadow-2xs dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800"
                    >
                      <KeyRound className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>My Profile & Password</span>
                    </Link>

                    <Link
                      href="/settings"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 font-medium transition"
                    >
                      <Building2 className="h-3.5 w-3.5 text-slate-500" />
                      <span>Company Profile & Settings</span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30 font-semibold transition"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Categorized Global Search Modal */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 md:p-20 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-slate-800 dark:bg-[#111827] dark:text-white animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input Bar */}
            <div className="flex items-center border-b border-slate-200 px-4 py-3 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/50">
              <Search className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by invoice #, customer name, NTN, product, SKU, HS Code..."
                className="w-full bg-transparent px-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none font-sans dark:text-white dark:placeholder-slate-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <kbd
                onClick={() => setSearchOpen(false)}
                className="cursor-pointer ml-2 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-mono text-slate-500 hover:text-slate-800 shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              >
                ESC
              </kbd>
            </div>

            {/* Results Panel */}
            <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
              {isSearching && (
                <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                  Searching database...
                </div>
              )}

              {!isSearching && !searchQuery && (
                <div className="py-8 text-center text-slate-500 dark:text-slate-400 text-xs">
                  <p className="font-semibold text-slate-700 dark:text-slate-300">Quick Navigation Tips</p>
                  <p className="mt-1">
                    Try searching: <span className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold">INV-2026</span>,{" "}
                    <span className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold">8517.13</span>,{" "}
                    <span className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold">IPHONE</span>, or{" "}
                    <span className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold">REHMAN</span>
                  </p>
                </div>
              )}

              {!isSearching &&
                searchQuery &&
                searchResults.products.length === 0 &&
                searchResults.invoices.length === 0 &&
                searchResults.customers.length === 0 && (
                  <div className="py-8 text-center text-slate-500 dark:text-slate-400 text-xs">
                    No matching records found for &quot;{searchQuery}&quot;.
                  </div>
                )}

              {/* Categorized Invoices */}
              {searchResults.invoices.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    <Receipt className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Invoices & Sales</span>
                  </div>
                  <div className="mt-1 space-y-1">
                    {searchResults.invoices.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleSelectResult(item.url)}
                        className="group flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/70 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-slate-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">
                              {item.title}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                item.badge === "SUCCESS"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                                  : item.badge === "FAILED"
                                  ? "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800"
                                  : "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                              }`}
                            >
                              FBR {item.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">{item.subtitle}</p>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-1 transition" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Categorized Products */}
              {searchResults.products.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    <Package className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Products & Stock</span>
                  </div>
                  <div className="mt-1 space-y-1">
                    {searchResults.products.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleSelectResult(item.url)}
                        className="group flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/70 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-slate-900 group-hover:text-emerald-700 dark:text-white dark:group-hover:text-emerald-400">
                              {item.title}
                            </span>
                            <span className="text-[10px] font-mono bg-slate-100 text-indigo-700 border border-slate-200 px-1.5 py-0.5 rounded dark:bg-slate-800 dark:text-indigo-300 dark:border-slate-700">
                              {item.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">{item.subtitle}</p>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:translate-x-1 transition" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Categorized Customers */}
              {searchResults.customers.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    <Users className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Customers & Ledgers</span>
                  </div>
                  <div className="mt-1 space-y-1">
                    {searchResults.customers.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleSelectResult(item.url)}
                        className="group flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/70 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition"
                      >
                        <div>
                          <span className="font-semibold text-xs text-slate-900 group-hover:text-amber-700 dark:text-white dark:group-hover:text-amber-400">
                            {item.title}
                          </span>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">{item.subtitle}</p>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 group-hover:translate-x-1 transition" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
