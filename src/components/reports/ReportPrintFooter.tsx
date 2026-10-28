"use client";

import React from "react";

interface ReportPrintFooterProps {
  showSignatures?: boolean;
  notes?: string;
}

export function ReportPrintFooter({
  showSignatures = true,
  notes,
}: ReportPrintFooterProps) {
  return (
    <div className="pt-4 mt-6 border-t border-slate-300 print:pt-2 print:mt-2.5 print:border-slate-800 text-slate-800 break-inside-avoid page-break-inside-avoid">
      {notes && (
        <div className="mb-3 text-xs text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-200 print:bg-transparent print:border-slate-300 print:p-1.5 print:text-[9px] print:mb-1.5">
          <strong className="text-slate-800">Auditor / Accounting Notes:</strong> {notes}
        </div>
      )}

      {showSignatures && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 text-center text-xs print:gap-3 print:pt-1.5">
          <div className="space-y-6 print:space-y-3.5">
            <div className="border-b border-slate-400 pb-1 print:border-slate-700" />
            <span className="font-bold uppercase tracking-wider text-[11px] text-slate-700 block print:text-[8.5px]">
              Prepared By
            </span>
          </div>

          <div className="space-y-6 print:space-y-3.5">
            <div className="border-b border-slate-400 pb-1 print:border-slate-700" />
            <span className="font-bold uppercase tracking-wider text-[11px] text-slate-700 block print:text-[8.5px]">
              Checked / Verified
            </span>
          </div>

          <div className="space-y-6 print:space-y-3.5">
            <div className="border-b border-slate-400 pb-1 print:border-slate-700" />
            <span className="font-bold uppercase tracking-wider text-[11px] text-slate-700 block print:text-[8.5px]">
              Chief Accountant
            </span>
          </div>

          <div className="space-y-6 print:space-y-3.5">
            <div className="border-b border-slate-400 pb-1 print:border-slate-700" />
            <span className="font-bold uppercase tracking-wider text-[11px] text-slate-700 block print:text-[8.5px]">
              Approved / Stamp
            </span>
          </div>
        </div>
      )}

      {/* Legal & System Verification Notice */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-[10px] text-slate-500 pt-3 mt-3 border-t border-slate-200 font-mono print:pt-1 print:mt-1 print:text-[8px]">
        <span>Accounts360 Live Cloud ERP • Computer-Generated Financial Document</span>
        <span>Valid without physical stamp when digitally reconciled • Page 1</span>
      </div>
    </div>
  );
}
