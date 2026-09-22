"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { TableRowsSkeleton } from "@/components/ui/loader";
import {
  History,
  Search,
  Filter,
  Eye,
  AlertCircle,
  CheckCircle2,
  Clock,
  User,
  RotateCcw,
  FileText,
  Building2,
  Trash2,
  Sparkles,
  RefreshCw,
} from "lucide-react";

interface AuditLogEntry {
  id: string;
  createdAt: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  action: string;
  entity: string;
  entityId?: string;
  branchId?: string;
  details?: string;
  changes?: string;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("ALL");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (entityFilter !== "ALL") params.append("entity", entityFilter);
      if (actionFilter !== "ALL") params.append("action", actionFilter);

      const res = await fetch(`/api/audit-logs?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setLogs(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [entityFilter, actionFilter]);

  const filteredLogs = logs.filter((log) => {
    const q = search.toLowerCase();
    const matchesUser =
      (log.userName && log.userName.toLowerCase().includes(q)) ||
      (log.userEmail && log.userEmail.toLowerCase().includes(q));
    const matchesDetails = log.details && log.details.toLowerCase().includes(q);
    const matchesEntity = log.entity && log.entity.toLowerCase().includes(q);
    const matchesAction = log.action && log.action.toLowerCase().includes(q);
    return !search || matchesUser || matchesDetails || matchesEntity || matchesAction;
  });

  const totalLogs = logs.length;
  const editCount = logs.filter((l) => l.action.includes("UPDATE") || l.action.includes("EDIT")).length;
  const createCount = logs.filter((l) => l.action.includes("CREATE")).length;
  const reverseCount = logs.filter((l) => l.action.includes("REVERSE") || l.action.includes("DELETE") || l.action.includes("CANCEL")).length;

  const parseChanges = (changesStr?: string) => {
    if (!changesStr) return null;
    try {
      return JSON.parse(changesStr);
    } catch {
      return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 dark:bg-indigo-950/60 dark:border-indigo-800 dark:text-indigo-400">
              <History className="h-4 w-4" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              System Activity & Audit Trail (آڈٹ لاگ)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Complete tamper-proof record of which staff created, edited, or modified invoices, purchases, and expenses across all branches.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
        >
          <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
          <span>Refresh Trail</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Tracked Actions</p>
          <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{totalLogs}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">All activity logs</p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/30">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">Edited / Modified Records</p>
          <p className="mt-1 text-2xl font-black text-amber-900 dark:text-amber-200">{editCount}</p>
          <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">⚠️ Invoices & vouchers updated</p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/30">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">Initial Creations</p>
          <p className="mt-1 text-2xl font-black text-emerald-900 dark:text-emerald-200">{createCount}</p>
          <p className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-0.5">Sales, purchases & expenses</p>
        </div>

        <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 shadow-sm dark:border-rose-900/40 dark:bg-rose-950/30">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-800 dark:text-rose-300">Reversals & Deletions</p>
          <p className="mt-1 text-2xl font-black text-rose-900 dark:text-rose-200">{reverseCount}</p>
          <p className="text-[10px] text-rose-700 dark:text-rose-400 mt-0.5">Cancellations & reversals</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by user, action, details, invoice #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-slate-50 pl-9 pr-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500">Entity:</span>
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">All Modules (تمام)</option>
              <option value="Sale">Sale Invoices (سیل انوائس)</option>
              <option value="Purchase">Purchases (خریداری)</option>
              <option value="Expense">Daily Expenses (اخراجات)</option>
              <option value="Branch">Branches (شاخیں)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500">Action:</span>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">All Actions</option>
              <option value="CREATE_SALE">Create Sale</option>
              <option value="UPDATE_SALE">Edit Sale (ترمیم)</option>
              <option value="REVERSE_SALE">Reverse Sale</option>
              <option value="CREATE_PURCHASE">Create Purchase</option>
              <option value="UPDATE_PURCHASE">Edit Purchase</option>
              <option value="CREATE_EXPENSE">Create Expense</option>
              <option value="UPDATE_EXPENSE">Edit Expense</option>
              <option value="DELETE_EXPENSE">Delete Expense</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">User (کس نے کیا)</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Details / Audit Notes</th>
                <th className="px-4 py-3 text-right">Changes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <TableRowsSkeleton rows={6} cols={6} />
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-slate-400">
                    No activity logs recorded matching your search filters.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isUpdate = log.action.includes("UPDATE") || log.action.includes("EDIT");
                  const isDeleteOrReverse = log.action.includes("DELETE") || log.action.includes("REVERSE") || log.action.includes("CANCEL");
                  const changesObj = parseChanges(log.changes);

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        <div className="leading-tight">
                          <p className="font-semibold text-slate-700 dark:text-slate-300">
                            {new Date(log.createdAt).toLocaleDateString()}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-slate-100 border border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 flex items-center justify-center text-[10px] font-bold shrink-0">
                            {(log.userName || "U").slice(0, 1).toUpperCase()}
                          </div>
                          <div className="leading-tight">
                            <p className="font-semibold text-slate-900 dark:text-white">
                              {log.userName || "System User"}
                            </p>
                            {log.userEmail && (
                              <p className="text-[10px] text-slate-400">{log.userEmail}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${
                            isUpdate
                              ? "bg-amber-50 text-amber-800 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                              : isDeleteOrReverse
                              ? "bg-rose-50 text-rose-800 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800"
                              : "bg-emerald-50 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                          }`}
                        >
                          {isUpdate ? "✏️ " : isDeleteOrReverse ? "⚠️ " : "✓ "}
                          {log.action}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {log.entity}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800 dark:text-slate-200 line-clamp-2">
                          {log.details || "—"}
                        </p>
                      </td>

                      <td className="px-4 py-3 text-right">
                        {changesObj ? (
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50 hover:text-indigo-800 dark:border-slate-800 dark:bg-slate-800 dark:text-indigo-400 dark:hover:bg-slate-700"
                            title="Inspect Changed Values"
                          >
                            <Eye className="h-3 w-3" />
                            <span>View Diff</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[10px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Changes / Diff Modal */}
      {selectedLog && (
        <Modal
          isOpen={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          title={`Audit Diff: ${selectedLog.action} (${selectedLog.entity})`}
        >
          <div className="space-y-4 text-xs">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Initiated By:</span>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {selectedLog.userName} ({selectedLog.userEmail || "No email"})
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Timestamp:</span>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {new Date(selectedLog.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Description / Reason:</span>
                <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">
                  {selectedLog.details}
                </p>
              </div>
            </div>

            {/* Structured Before / After Changes Inspector */}
            {(() => {
              const parsed = parseChanges(selectedLog.changes);
              if (!parsed) return <p className="text-slate-500">No snapshot details available.</p>;

              const previous = parsed.previous || {};
              const updated = parsed.updated || {};
              const allKeys = Array.from(new Set([...Object.keys(previous), ...Object.keys(updated)]));

              return (
                <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-[11px] font-bold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      <tr>
                        <th className="px-3 py-2">Field</th>
                        <th className="px-3 py-2 text-rose-700 dark:text-rose-400">Previous Value</th>
                        <th className="px-3 py-2 text-emerald-700 dark:text-emerald-400">Updated Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {allKeys.map((key) => {
                        const prevVal = String(previous[key] ?? "—");
                        const newVal = String(updated[key] ?? "—");
                        const hasChanged = prevVal !== newVal;

                        return (
                          <tr key={key} className={hasChanged ? "bg-amber-50/40 dark:bg-amber-950/20" : ""}>
                            <td className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-300 capitalize">
                              {key.replace(/([A-Z])/g, " $1")}
                            </td>
                            <td className="px-3 py-2 text-rose-700 dark:text-rose-300">
                              {prevVal}
                            </td>
                            <td className="px-3 py-2 text-emerald-700 dark:text-emerald-300 font-semibold">
                              {newVal}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setSelectedLog(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
