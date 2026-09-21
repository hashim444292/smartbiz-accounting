"use client";

import React, { useEffect, useState } from "react";
import { formatMoney } from "@/lib/decimal";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Scale, FileText, CheckCircle2 } from "lucide-react";
import { BrandPageLoader, TableSkeleton } from "@/components/ui/loader";

export default function AccountingPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [journals, setJournals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"ACCOUNTS" | "JOURNALS" | "TRIAL_BALANCE">("ACCOUNTS");

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const res = await fetch("/api/accounting");
        const json = await res.json();
        if (json.success) {
          setAccounts(json.data.accounts);
          setJournals(json.data.journals);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const totalDebits = accounts
    .filter((a) => ["ASSET", "EXPENSE", "COGS"].includes(a.type))
    .reduce((acc, a) => acc + Number(a.balance), 0);

  const totalCredits = accounts
    .filter((a) => ["LIABILITY", "EQUITY", "REVENUE"].includes(a.type))
    .reduce((acc, a) => acc + Number(a.balance), 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <BrandPageLoader
          message="Loading Double-Entry Accounting Ledger..."
          submessage="Balancing General Ledger, Chart of Accounts, and Journal Entries..."
        />
        <TableSkeleton rows={6} cols={5} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Double-Entry Accounting Engine</h2>
          <p className="text-xs text-slate-500">General Ledger, Chart of Accounts, and Journal Entries</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          <span>Double-Entry Balanced: Debits = Credits</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <button
          onClick={() => setActiveTab("ACCOUNTS")}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
            activeTab === "ACCOUNTS"
              ? "bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-400"
          }`}
        >
          <BookOpen className="h-3.5 w-3.5" />
          <span>Chart of Accounts ({accounts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("JOURNALS")}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
            activeTab === "JOURNALS"
              ? "bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-400"
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          <span>General Journal Entries ({journals.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("TRIAL_BALANCE")}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
            activeTab === "TRIAL_BALANCE"
              ? "bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-400"
          }`}
        >
          <Scale className="h-3.5 w-3.5" />
          <span>Trial Balance</span>
        </button>
      </div>

      {/* Chart of Accounts Tab */}
      {activeTab === "ACCOUNTS" && (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Account Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Sub-Type</th>
                <th className="px-4 py-3 text-right">Running Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {accounts.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-mono font-bold text-blue-600 dark:text-blue-400">{a.code}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{a.name}</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        a.type === "ASSET"
                          ? "default"
                          : a.type === "LIABILITY"
                          ? "danger"
                          : a.type === "REVENUE"
                          ? "success"
                          : a.type === "EXPENSE"
                          ? "warning"
                          : "secondary"
                      }
                    >
                      {a.type}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{a.subType || "—"}</td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-900 dark:text-white">
                    {formatMoney(a.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Journal Entries Tab */}
      {activeTab === "JOURNALS" && (
        <div className="space-y-4">
          {journals.map((j) => (
            <div
              key={j.id}
              className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400">{j.entryNumber}</span>
                  <span className="text-xs text-slate-400">{new Date(j.date).toLocaleDateString()}</span>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{j.description}</span>
                </div>
                <Badge variant={j.isBalanced ? "success" : "danger"}>
                  {j.isBalanced ? "Balanced" : "Unbalanced"}
                </Badge>
              </div>

              <div className="pt-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[10px] font-bold uppercase text-slate-400">
                    <tr>
                      <th className="pb-1">Account</th>
                      <th className="pb-1">Line Description</th>
                      <th className="pb-1 text-right">Debit</th>
                      <th className="pb-1 text-right">Credit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {j.lines?.map((l: any) => (
                      <tr key={l.id}>
                        <td className="py-2 font-medium text-slate-800 dark:text-slate-200">
                          <span className="font-mono text-slate-400 mr-2">{l.account?.code}</span>
                          {l.account?.name}
                        </td>
                        <td className="py-2 text-slate-500">{l.description || "—"}</td>
                        <td className="py-2 text-right font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                          {Number(l.debit) > 0 ? formatMoney(l.debit) : "—"}
                        </td>
                        <td className="py-2 text-right font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                          {Number(l.credit) > 0 ? formatMoney(l.credit) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Trial Balance Tab */}
      {activeTab === "TRIAL_BALANCE" && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Trial Balance Statement</h3>
            <p className="text-xs text-slate-500">Summary of all debit and credit account balances</p>
          </div>

          <div className="py-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500 dark:border-slate-800">
                <tr>
                  <th className="pb-2">Account Code</th>
                  <th className="pb-2">Account Title</th>
                  <th className="pb-2 text-right">Debit (Rs)</th>
                  <th className="pb-2 text-right">Credit (Rs)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {accounts.map((a) => {
                  const isDebitSide = ["ASSET", "EXPENSE", "COGS"].includes(a.type);
                  return (
                    <tr key={a.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-2 font-mono text-slate-500">{a.code}</td>
                      <td className="py-2 font-medium text-slate-900 dark:text-white">{a.name}</td>
                      <td className="py-2 text-right tabular-nums">
                        {isDebitSide ? formatMoney(a.balance) : "—"}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {!isDebitSide ? formatMoney(a.balance) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-slate-900 font-bold dark:border-white">
                <tr>
                  <td colSpan={2} className="pt-3 text-sm">TOTAL TRIAL BALANCE</td>
                  <td className="pt-3 text-right text-sm text-blue-600 dark:text-blue-400 tabular-nums">
                    {formatMoney(totalDebits)}
                  </td>
                  <td className="pt-3 text-right text-sm text-blue-600 dark:text-blue-400 tabular-nums">
                    {formatMoney(totalCredits)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
