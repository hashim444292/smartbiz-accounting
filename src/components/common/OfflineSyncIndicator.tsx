"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronDown,
  Database,
  CloudOff,
} from "lucide-react";
import {
  getOfflineQueue,
  syncOfflineQueue,
  clearOfflineQueue,
  OfflineAction,
} from "@/lib/offlineSync";
import { useLanguage } from "@/context/LanguageContext";
import { invalidateCache } from "@/lib/clientCache";

export function OfflineSyncIndicator() {
  const { t, language } = useLanguage();
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [queue, setQueue] = useState<OfflineAction[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const refreshState = () => {
    if (typeof navigator !== "undefined") {
      setIsOnline(navigator.onLine);
    }
    setQueue(getOfflineQueue());
  };

  useEffect(() => {
    refreshState();

    const handleOnline = () => {
      setIsOnline(true);
      // Auto-drive offline queue when connection is restored
      triggerAutoSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      refreshState();
    };

    const handleQueueChanged = (e: any) => {
      if (e.detail?.queue) {
        setQueue(e.detail.queue);
      } else {
        setQueue(getOfflineQueue());
      }
    };

    const handleSyncCompleted = (e: any) => {
      invalidateCache("/api/products");
      invalidateCache("/api/sales");
      invalidateCache("/api/accounting");
      invalidateCache("/api/reports/profit-loss");
      refreshState();
      setSyncMessage(
        language === "ur"
          ? `کامیابی: ${e.detail?.syncedCount || 1} آف لائن تبدیلیاں سرور سے ہم آہنگ ہو گئیں۔`
          : `Success: ${e.detail?.syncedCount || 1} offline transaction(s) synchronized to server.`
      );
      setTimeout(() => setSyncMessage(null), 4000);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("smartbiz_offline_queue_changed", handleQueueChanged);
    window.addEventListener("smartbiz_offline_sync_completed", handleSyncCompleted);

    // Periodic auto-sync check every 25 seconds
    const interval = setInterval(() => {
      if (navigator.onLine && getOfflineQueue().length > 0 && !isSyncing) {
        triggerAutoSync();
      }
    }, 25000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("smartbiz_offline_queue_changed", handleQueueChanged);
      window.removeEventListener("smartbiz_offline_sync_completed", handleSyncCompleted);
      clearInterval(interval);
    };
  }, [language, isSyncing]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  const triggerAutoSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await syncOfflineQueue();
      if (res.syncedCount > 0) {
        invalidateCache("/api/products");
        invalidateCache("/api/sales");
        invalidateCache("/api/accounting");
        invalidateCache("/api/reports/profit-loss");
      }
    } catch (err) {
      console.warn("Auto-sync error:", err);
    } finally {
      setIsSyncing(false);
      refreshState();
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const res = await syncOfflineQueue();
      if (res.syncedCount > 0) {
        invalidateCache("/api/products");
        invalidateCache("/api/sales");
        invalidateCache("/api/accounting");
        invalidateCache("/api/reports/profit-loss");
        setSyncMessage(
          language === "ur"
            ? `کامیابی: ${res.syncedCount} تبدیلیاں منتقل ہو گئیں۔`
            : `Success: ${res.syncedCount} offline record(s) synced.`
        );
      } else if (res.errors.length > 0) {
        setSyncMessage(res.errors[0]?.error || "Sync incomplete");
      }
    } catch (err: any) {
      setSyncMessage(err.message || "Failed to sync");
    } finally {
      setIsSyncing(false);
      refreshState();
    }
  };

  const pendingCount = queue.length;

  return (
    <div className="relative" ref={menuRef}>
      {/* Indicator Pill Trigger */}
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition shadow-2xs ${
          !isOnline
            ? "bg-rose-50 border-rose-300 text-rose-700 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-300 animate-pulse"
            : pendingCount > 0
            ? "bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-300"
            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300"
        }`}
        title={
          !isOnline
            ? "Offline Mode - Data is safely buffering locally"
            : pendingCount > 0
            ? `${pendingCount} offline records awaiting sync`
            : "Live Connection - Auto-synced"
        }
      >
        {!isOnline ? (
          <>
            <WifiOff className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
            <span className="hidden sm:inline font-bold">Offline</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-bold">
                {pendingCount}
              </span>
            )}
          </>
        ) : pendingCount > 0 ? (
          <>
            <RefreshCw className={`h-3.5 w-3.5 text-amber-600 ${isSyncing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline font-bold">
              {isSyncing ? "Syncing..." : `${pendingCount} Pending`}
            </span>
            <span className="px-1.5 py-0.2 rounded-full bg-amber-600 text-white text-[10px] font-bold">
              {pendingCount}
            </span>
          </>
        ) : (
          <>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="hidden xl:inline text-[11px] font-medium text-slate-600 dark:text-slate-400">
              Auto-Sync
            </span>
          </>
        )}
      </button>

      {/* Dropdown Menu */}
      {menuOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xl dark:border-slate-800 dark:bg-[#111827] z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                  {t("Data Synchronization & Offline Vault", "ڈیٹا خودکار مطابقت و آف لائن تحفظ")}
                </h4>
                <p className="text-[10px] text-slate-500">
                  {isOnline ? "● Internet Connected" : "○ Disconnected (Local Buffer Active)"}
                </p>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                isOnline
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                  : "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800"
              }`}
            >
              {isOnline ? "ONLINE" : "OFFLINE"}
            </span>
          </div>

          {syncMessage && (
            <div className="my-2.5 p-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-medium dark:bg-indigo-950/50 dark:border-indigo-800 dark:text-indigo-200">
              {syncMessage}
            </div>
          )}

          {/* Pending Queue List */}
          <div className="my-2.5 max-h-48 overflow-y-auto space-y-1.5">
            {pendingCount === 0 ? (
              <div className="py-4 text-center">
                <CheckCircle2 className="h-7 w-7 text-emerald-500 mx-auto mb-1" />
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {t("All Records Fully Synchronized", "تمام ریکارڈز محفوظ اور ہم آہنگ ہیں")}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {t("All sales, damage, and ledger transactions are in live parity.", "سیلز، نقصان اور جنرل لیجر مکمل طور پر ہم آہنگ ہیں۔")}
                </p>
              </div>
            ) : (
              queue.map((item) => (
                <div
                  key={item.id}
                  className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs dark:bg-slate-800/60 dark:border-slate-700 flex items-center justify-between"
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-bold text-slate-900 dark:text-white truncate">{item.actionName}</p>
                    <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                    PENDING
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
            {pendingCount > 0 ? (
              <>
                <button
                  onClick={clearOfflineQueue}
                  className="text-[11px] text-slate-500 hover:text-rose-600 transition underline"
                >
                  Clear Buffer
                </button>
                <button
                  onClick={handleManualSync}
                  disabled={isSyncing || !isOnline}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                  <span>{isSyncing ? "Syncing..." : "Sync Now (ابھی ہم آہنگ کریں)"}</span>
                </button>
              </>
            ) : (
              <p className="text-[11px] text-slate-500 w-full text-center">
                System automatically replays pending offline data upon connection recovery.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
