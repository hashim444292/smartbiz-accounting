"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/decimal";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import { BrandPageLoader } from "@/components/ui/loader";

export default function BalanceSheetPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBS() {
      try {
        const res = await fetch("/api/dashboard");
        const json = await res.json();
        if (json.success) setData(json.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadBS();
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <BrandPageLoader
          message="Compiling Balance Sheet Statement..."
          submessage="Balancing Assets, Liabilities, and Owner's Equity accounts..."
        />
      </div>
    );
  }

  const cash = data?.cashBalance ?? 0;
  const bank = data?.bankBalance ?? 0;
  const receivables = data?.totalReceivables ?? 0;
  const inventory = data?.totalInventoryValue ?? 0;
  const totalAssets = cash + bank + receivables + inventory;

  const payables = data?.totalPayables ?? 60000;
  const otherLiab = 15000;
  const totalLiab = payables + otherLiab;

  const equity = totalAssets - totalLiab;

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
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Balance Sheet Statement</h2>
            <p className="text-xs text-slate-500">Statement of Financial Position: Assets = Liabilities + Owner Equity</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="h-3.5 w-3.5 mr-1" /> Print Statement
        </Button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 print:border-none print:p-0">
        <div className="border-b border-slate-200 pb-4 dark:border-slate-800">
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">Balance Sheet (Financial Position)</h1>
          <p className="text-xs text-slate-500">As of September 2026 • Prepared according to standard accounting principles</p>
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 py-6 text-xs">
          {/* Assets Side */}
          <div className="space-y-4">
            <h3 className="font-bold text-slate-900 dark:text-white uppercase text-[11px] pb-1 border-b border-slate-200 dark:border-slate-800">
              Assets
            </h3>
            <div className="space-y-2.5">
              <div className="flex justify-between">
                <span>Cash in Hand</span>
                <span className="tabular-nums font-semibold">{formatMoney(cash)}</span>
              </div>
              <div className="flex justify-between">
                <span>Bank Accounts</span>
                <span className="tabular-nums font-semibold">{formatMoney(bank)}</span>
              </div>
              <div className="flex justify-between">
                <span>Accounts Receivable</span>
                <span className="tabular-nums font-semibold">{formatMoney(receivables)}</span>
              </div>
              <div className="flex justify-between">
                <span>Merchandise Inventory Valuation</span>
                <span className="tabular-nums font-semibold">{formatMoney(inventory)}</span>
              </div>
            </div>
            <div className="border-t-2 border-slate-900 pt-3 flex justify-between font-black text-sm text-blue-600 dark:text-blue-400 dark:border-white">
              <span>TOTAL ASSETS</span>
              <span className="tabular-nums">{formatMoney(totalAssets)}</span>
            </div>
          </div>

          {/* Liabilities & Equity Side */}
          <div className="space-y-4">
            <h3 className="font-bold text-slate-900 dark:text-white uppercase text-[11px] pb-1 border-b border-slate-200 dark:border-slate-800">
              Liabilities & Equity
            </h3>
            <div className="space-y-2.5">
              <div className="flex justify-between">
                <span>Accounts Payable (Suppliers)</span>
                <span className="tabular-nums font-semibold text-rose-600">{formatMoney(payables)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax & Other Accrued Liabilities</span>
                <span className="tabular-nums font-semibold">{formatMoney(otherLiab)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-1 font-bold">
                <span>Total Liabilities</span>
                <span className="tabular-nums">{formatMoney(totalLiab)}</span>
              </div>

              <div className="pt-3">
                <p className="font-bold uppercase text-[10px] text-slate-400 mb-1">Owner's Equity</p>
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>Owner Capital & Retained Earnings</span>
                  <span className="tabular-nums font-semibold">{formatMoney(equity)}</span>
                </div>
              </div>
            </div>
            <div className="border-t-2 border-slate-900 pt-3 flex justify-between font-black text-sm text-blue-600 dark:text-blue-400 dark:border-white">
              <span>TOTAL LIABILITIES & EQUITY</span>
              <span className="tabular-nums">{formatMoney(totalLiab + equity)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
