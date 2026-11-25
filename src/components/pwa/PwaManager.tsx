"use client";

import React, { useEffect, useRef, useState } from "react";
import { Download, MoreVertical, RefreshCw, Share, Smartphone, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "sb_pwa_prompt_dismissed_at";

export function PwaManager() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [platformHint, setPlatformHint] = useState<"native" | "ios" | "android-manual">("native");
  const [updateReady, setUpdateReady] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Never register Service Worker or show PWA install inside Electron Desktop App
    const isElectron =
      navigator.userAgent.includes("Electron") ||
      Boolean((window as any).electronAPI);
    if (isElectron) return;

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((window.navigator as any).standalone);

    // Register Service Worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          if (reg.waiting) {
            setWaitingWorker(reg.waiting);
            setUpdateReady(true);
          }
          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing;
            if (!newWorker) return;
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                setWaitingWorker(newWorker);
                setUpdateReady(true);
              }
            });
          });
        })
        .catch(() => {});
    }

    if (isStandalone) return;

    const ua = navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(ua) && !/crios|fxios/.test(ua);
    const isMobile = /android|iphone|ipad|ipod|mobile/.test(ua);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      deferredPromptRef.current = promptEvent;
      setDeferredPrompt(promptEvent);
      setPlatformHint("native");
      setShowInstallBanner(true);
    };

    const handleManualTrigger = () => {
      if (deferredPromptRef.current) {
        setPlatformHint("native");
      } else if (isIos) {
        setPlatformHint("ios");
      } else {
        setPlatformHint("android-manual");
      }
      setShowInstallBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("sb:open-pwa-install", handleManualTrigger);

    // Respect 7-day dismissal for automatic banner
    let isDismissed = false;
    try {
      const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (dismissedAt && Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) {
        isDismissed = true;
      }
    } catch {}

    // If on mobile and browser didn't auto-fire beforeinstallprompt within 2.5s, show helpful fallback banner
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    if (isMobile && !isDismissed) {
      fallbackTimer = setTimeout(() => {
        if (deferredPromptRef.current) return;
        setPlatformHint(isIos ? "ios" : "android-manual");
        setShowInstallBanner(true);
      }, 2500);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("sb:open-pwa-install", handleManualTrigger);
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShowInstallBanner(false);
    if (outcome === "dismissed") {
      try {
        localStorage.setItem(DISMISS_KEY, String(Date.now()));
      } catch {}
    }
  };

  const handleDismiss = () => {
    setShowInstallBanner(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
  };

  const handleApplyUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    }
    window.location.reload();
  };

  return (
    <>
      {/* Update Available Toast */}
      {updateReady && (
        <div className="print:hidden fixed top-16 right-3 z-50 flex items-center gap-2.5 rounded-xl border border-indigo-200 bg-white/95 px-3.5 py-2.5 text-xs shadow-xl backdrop-blur-md dark:border-indigo-800 dark:bg-slate-900/95">
          <RefreshCw className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span className="font-semibold text-slate-800 dark:text-slate-100">
            New version available
          </span>
          <button
            type="button"
            onClick={handleApplyUpdate}
            className="rounded-lg bg-indigo-600 px-2.5 py-1 font-bold text-white hover:bg-indigo-700 transition"
          >
            Refresh
          </button>
        </div>
      )}

      {/* Clean, Non-Intrusive Install App Pill */}
      {showInstallBanner && (
        <div className="print:hidden fixed bottom-20 lg:bottom-4 right-3 sm:right-4 z-40 max-w-[calc(100vw-24px)] sm:max-w-xs rounded-2xl border border-slate-200/90 bg-white/95 p-3 shadow-2xl backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/95">
          <div className="flex items-start gap-2.5">
            <img
              src="/icons/icon-192.png"
              alt="Accounts360"
              className="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate flex items-center gap-1">
                  <Smartphone className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                  <span>Install Accounts360 App</span>
                </p>
                <button
                  type="button"
                  onClick={handleDismiss}
                  aria-label="Dismiss install prompt"
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {platformHint === "native" && deferredPrompt ? (
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleInstall}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-indigo-700 shadow-xs transition"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Install Now</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400"
                  >
                    Later
                  </button>
                </div>
              ) : platformHint === "ios" ? (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                  Tap <Share className="inline h-3 w-3 text-indigo-600" /> then{" "}
                  <strong className="text-slate-700 dark:text-slate-200">Add to Home Screen</strong>.
                </p>
              ) : (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                  Browser menu <MoreVertical className="inline h-3 w-3 text-indigo-600" /> par tap karein aur{" "}
                  <strong className="text-slate-700 dark:text-slate-200">Install app / Add to Home screen</strong> select karein.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
