"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { DateRangeProvider } from "@/context/DateRangeContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";

function ShellContent({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";
  const { user, activeCompany, switchUser, isInspectingClient, exitInspection } = useAuth();

  useEffect(() => {
    try {
      const checkCollapsed = () => {
        const saved = localStorage.getItem("sb_sidebar_collapsed");
        if (saved !== null) {
          setIsCollapsed(saved === "true");
        }
      };
      checkCollapsed();
      window.addEventListener("storage", checkCollapsed);
      return () => window.removeEventListener("storage", checkCollapsed);
    } catch {}
  }, []);

  if (isLoginPage) {
    return <main className="min-h-screen w-full bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-slate-100">{children}</main>;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans antialiased text-slate-900 dark:bg-[#0B1120] dark:text-slate-100 transition-colors duration-150">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div
        className={`flex flex-col min-h-screen transition-all duration-300 ${
          isCollapsed ? "lg:pl-20" : "lg:pl-64"
        }`}
      >
        {/* Active Super Admin User Session Switching Banner */}
        {user && user.role !== "SUPER_ADMIN" && user.isSwitched && (
          <div className="bg-gradient-to-r from-purple-800 via-indigo-800 to-indigo-900 text-white px-4 py-2 text-xs flex items-center justify-between shadow-xs z-30 border-b border-indigo-700/50">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-purple-200">Active User Session:</span>
              <span className="font-bold underline">{user.name}</span>
              <span className="bg-white/15 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">{user.role}</span>
              <span className="text-purple-200 hidden sm:inline">• Active Client: {activeCompany?.name}</span>
            </div>
            <button
              onClick={() => switchUser("usr-1")}
              className="bg-white text-indigo-950 hover:bg-purple-50 text-[11px] font-extrabold px-3 py-1 rounded-xl transition shadow-xs flex items-center gap-1 shrink-0"
            >
              <span>👑</span>
              <span>Switch Back to Super Admin</span>
            </button>
          </div>
        )}

        {/* Super Admin Client Inspection Banner */}
        {user?.role === "SUPER_ADMIN" && isInspectingClient && (
          <div className="bg-gradient-to-r from-amber-700 via-amber-600 to-amber-700 text-white px-4 py-2 text-xs flex items-center justify-between shadow-xs z-30 border-b border-amber-600/60">
            <div className="flex items-center gap-2">
              <span className="bg-white/20 text-white px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider">
                🛡️ Client Inspection Mode
              </span>
              <span className="font-semibold text-amber-100 hidden sm:inline">
                Viewing Client Workspace:
              </span>
              <strong className="underline text-white font-bold">{activeCompany?.name}</strong>
              <span className="text-amber-200 text-[11px] hidden md:inline">
                (Changes affect this client&apos;s live ledger)
              </span>
            </div>
            <button
              onClick={exitInspection}
              className="bg-white text-amber-950 hover:bg-amber-50 text-xs font-black px-3 py-1 rounded-xl transition shadow-xs flex items-center gap-1.5 shrink-0"
            >
              <span>← Return to Platform Admin</span>
            </button>
          </div>
        )}

        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-3.5 sm:p-5 lg:p-6 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DateRangeProvider>
        <ShellContent>{children}</ShellContent>
      </DateRangeProvider>
    </AuthProvider>
  );
}
