"use client";

import React from "react";

interface ReportPrintHeaderProps {
  title: string;
  subtitle?: string;
  reportDate?: string;
  periodLabel?: string;
  company?: {
    name?: string;
    legalName?: string;
    taxNumber?: string;
    strn?: string;
    address?: string;
    city?: string;
    phone?: string;
    email?: string;
  } | null;
  userName?: string;
  badgeText?: string;
  showOnScreen?: boolean;
}

export function ReportPrintHeader({
  title,
  subtitle,
  reportDate,
  periodLabel,
  company,
  userName,
  badgeText,
  showOnScreen = true,
}: ReportPrintHeaderProps) {
  const companyName = company?.legalName || company?.name || "Business Account";
  const ntn = company?.taxNumber;
  const strn = company?.strn;
  const address = company?.address || company?.city || "Karachi, Pakistan";
  const phone = company?.phone;
  const now = new Date();
  const printTimestamp = `${now.toLocaleDateString("en-GB")} ${now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })}`;

  return (
    <div
      className={`border-b-2 border-slate-900 pb-3 mb-4 text-slate-900 ${
        showOnScreen ? "" : "hidden print:block"
      }`}
    >
      {/* Top micro bar for print metadata */}
      <div className="flex justify-between items-center text-[10px] text-slate-500 border-b border-slate-200 pb-1 mb-2 font-mono">
        <span>
          Printing Date/Time: <strong className="text-slate-700">{printTimestamp}</strong>
        </span>
        <span>
          Printed By: <strong className="text-slate-700">{userName || "Authorized User"}</strong> • Currency: PKR (Rs)
        </span>
      </div>

      {/* Main Corporate Header Table / Flex */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-0.5">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight uppercase text-slate-900">
            {companyName}
          </h1>
          <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-600 font-medium">
            {address && <span>{address}</span>}
            {phone && <span>• Tel: {phone}</span>}
            {company?.email && <span>• Email: {company.email}</span>}
          </div>
          {(ntn || strn) && (
            <div className="flex flex-wrap items-center gap-x-2 text-[11px] font-mono text-slate-700 font-semibold pt-0.5">
              {ntn && <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 print:border-none print:p-0">NTN: {ntn}</span>}
              {strn && <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 print:border-none print:p-0">STRN: {strn}</span>}
            </div>
          )}
        </div>

        <div className="sm:text-right space-y-1">
          <div className="inline-block bg-slate-900 text-white font-extrabold text-xs sm:text-sm px-3 py-1 rounded tracking-wide uppercase print:bg-slate-900 print:text-white">
            {title}
          </div>
          {subtitle && (
            <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block">
              {subtitle}
            </p>
          )}
          {reportDate && (
            <div className="text-xs font-bold text-slate-900 font-mono">
              DATE: <span className="underline">{reportDate}</span>
            </div>
          )}
          {periodLabel && (
            <div className="text-[11px] font-semibold text-slate-700 font-mono">
              PERIOD: {periodLabel}
            </div>
          )}
          {badgeText && (
            <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 print:border-none print:p-0">
              {badgeText}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
