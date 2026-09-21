"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/decimal";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import { BrandPageLoader } from "@/components/ui/loader";

export default function CashFlowPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCF() {
      setLoading(true);
      try {
        const res = await fetch("/api/dashboard");
        const json = await res.json();
        if (json.success) setData(json.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadCF();
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <BrandPageLoader
          message="Calculating Cash Flow Statement..."
          submessage="Tracking cash inflows, vendor disbursements, and net operating liquidity..."
        />
      </div>
    );
  }

  const receipts = data?.paymentsReceived ?? 0;
  const disbursements = data?.paymentsMade ?? 0;
  const expenses = data?.totalExpenses ?? 0;
  const netOperatingCash = receipts - disbursements - expenses;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/reports"
            className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 dark:border-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Cash Flow Statement</h2>
            <p className="text-xs text-slate-500">Inflows and outflows across operational and financing activities</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="h-3.5 w-3.5 mr-1" /> Print Statement
        </Button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 print:border-none print:p-0">
        <div className="border-b border-slate-200 pb-4 dark:border-slate-800">
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">Statement of Cash Flows</h1>
          <p className="text-xs text-slate-500">For the period ended September 2026</p>
        </div>

        <div className="py-6 space-y-4 text-xs">
          <h3 className="font-bold text-slate-900 dark:text-white uppercase text-[11px] pb-1 border-b border-slate-200 dark:border-slate-800">
            Cash Flows from Operating Activities
          </h3>
          <div className="space-y-2.5">
            <div className="flex justify-between">
              <span>Cash received from customer receivables & cash sales</span>
              <span className="tabular-nums font-semibold text-emerald-600">+{formatMoney(receipts)}</span>
            </div>
            <div className="flex justify-between">
              <span>Cash paid to suppliers for merchandise purchases</span>
              <span className="tabular-nums font-semibold text-rose-600">-{formatMoney(disbursements)}</span>
            </div>
            <div className="flex justify-between">
              <span>Cash paid for daily business operating expenses</span>
              <span className="tabular-nums font-semibold text-rose-600">-{formatMoney(expenses)}</span>
            </div>
            <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-sm">
              <span>Net Cash Provided by Operating Activities</span>
              <span className="tabular-nums text-blue-600">{formatMoney(netOperatingCash)}</span>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-4 mt-6 dark:bg-slate-800/60 flex justify-between items-center text-sm font-black">
            <span>NET CHANGE IN PHYSICAL & BANK LIQUIDITY</span>
            <span className="text-emerald-600 tabular-nums">{formatMoney(netOperatingCash)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
