"use client";

import React from "react";
import { ShieldCheck, RefreshCw, Loader2 } from "lucide-react";

export function LoadingSpinner({
  size = "md",
  className = "",
  label,
}: {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  label?: string;
}) {
  const sizeClasses = {
    xs: "h-3.5 w-3.5 border",
    sm: "h-4 w-4 border-2",
    md: "h-6 w-6 border-2",
    lg: "h-8 w-8 border-[3px]",
    xl: "h-12 w-12 border-4",
  }[size];

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <div
        className={`${sizeClasses} rounded-full border-slate-200 border-t-indigo-600 dark:border-slate-800 dark:border-t-indigo-400 animate-spin shrink-0`}
      />
      {label && <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>}
    </div>
  );
}

export function TopLoadingBar({ active = true }: { active?: boolean }) {
  if (!active) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-slate-100/30 overflow-hidden dark:bg-slate-900/30 backdrop-blur-xs">
      <div className="h-full w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 relative overflow-hidden">
        <div className="absolute inset-0 bg-white/30 animate-shimmer" />
      </div>
    </div>
  );
}

export function BrandPageLoader({
  message = "Loading SmartBiz ERP...",
  submessage = "Synchronizing ledger, vouchers, and tax records",
  minHeight = "min-h-[55vh]",
}: {
  message?: string;
  submessage?: string;
  minHeight?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center p-6 ${minHeight}`}>
      <div className="relative mb-6">
        {/* Ambient Glow */}
        <div className="absolute -inset-2 rounded-3xl bg-gradient-to-tr from-indigo-600/20 via-purple-600/20 to-teal-500/20 blur-xl animate-pulse" />

        {/* Shield Icon Container with Rotating Ring */}
        <div className="relative h-16 w-16 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200/90 dark:border-slate-800 shadow-elevation flex items-center justify-center">
          <div className="absolute -inset-1 rounded-2xl border-2 border-dashed border-indigo-500/30 dark:border-indigo-400/30 animate-[spin_8s_linear_infinite]" />
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-700 flex items-center justify-center text-white shadow-xs">
            <ShieldCheck className="h-6 w-6" />
          </div>
        </div>

        {/* Floating Mini Spinner */}
        <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-white dark:bg-[#151f32] border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-center">
          <Loader2 className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 animate-spin" />
        </div>
      </div>

      <div className="max-w-sm space-y-2">
        <h3 className="text-base font-bold text-slate-900 dark:text-white font-sans tracking-tight">
          {message}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          {submessage}
        </p>
      </div>

      {/* Slim Progress Bar */}
      <div className="mt-6 w-48 h-1.5 rounded-full bg-slate-200/80 dark:bg-slate-800 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-indigo-600 to-teal-400 rounded-full animate-indeterminate" />
      </div>
    </div>
  );
}

export function CardSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card dark:border-slate-800/80 dark:bg-[#111827] space-y-3 relative overflow-hidden"
        >
          {/* Shimmer overlay */}
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_infinite] bg-gradient-to-r from-transparent via-slate-100/60 to-transparent dark:via-slate-800/40" />

          <div className="flex items-center justify-between">
            <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded-md animate-pulse" />
            <div className="h-8 w-8 rounded-xl bg-slate-100 dark:bg-slate-800/80 animate-pulse" />
          </div>

          <div className="space-y-1.5 pt-1">
            <div className="h-6 w-28 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
            <div className="h-2.5 w-16 bg-slate-100 dark:bg-slate-800/60 rounded-md animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card dark:border-slate-800/80 dark:bg-[#111827] space-y-4 relative overflow-hidden">
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-slate-100/50 to-transparent dark:via-slate-800/30" />

      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="h-4 w-44 bg-slate-200 dark:bg-slate-800 rounded-md animate-pulse" />
          <div className="h-3 w-64 bg-slate-100 dark:bg-slate-800/60 rounded-md animate-pulse" />
        </div>
        <div className="h-7 w-28 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
      </div>

      <div className="h-64 sm:h-72 w-full flex items-end justify-between gap-3 pt-6 px-4 border-b border-slate-100 dark:border-slate-800">
        {[40, 65, 30, 85, 55, 75, 45, 90, 60, 80, 50, 95].map((h, idx) => (
          <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
            <div
              className="w-full rounded-t-lg bg-slate-200 dark:bg-slate-800 animate-pulse transition-all duration-300"
              style={{ height: `${h}%` }}
            />
            <div className="h-2 w-4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 8 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-card dark:border-slate-800/80 dark:bg-[#111827] overflow-hidden relative">
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-slate-100/40 to-transparent dark:via-slate-800/30" />

      <div className="border-b border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/40 flex items-center justify-between">
        <div className="h-4 w-36 bg-slate-200 dark:bg-slate-800 rounded-md animate-pulse" />
        <div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded-md animate-pulse" />
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="p-4 flex items-center justify-between gap-4">
            <div className="h-3.5 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            <div className="h-3 w-16 bg-slate-100 dark:bg-slate-800/60 rounded animate-pulse" />
            <div className="h-3.5 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            <div className="h-3.5 w-20 bg-slate-200 dark:bg-slate-800 rounded animate-pulse hidden sm:block" />
            <div className="h-5 w-16 bg-slate-100 dark:bg-slate-800 rounded-full animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TableRowsSkeleton({ rows = 6, cols = 8 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="animate-pulse border-b border-slate-100 dark:border-slate-800/60">
          {Array.from({ length: cols }).map((_, c) => {
            const widthClass =
              c === 0
                ? "w-28 sm:w-36"
                : c === cols - 1
                ? "w-16 ml-auto"
                : c % 2 === 0
                ? "w-20"
                : "w-16";
            return (
              <td key={c} className="px-4 py-3.5">
                <div
                  className={`h-4 rounded-md bg-slate-200 dark:bg-slate-800 ${widthClass}`}
                />
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

