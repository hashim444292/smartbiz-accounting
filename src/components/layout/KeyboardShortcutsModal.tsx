"use client";

import React from "react";
import { Modal } from "@/components/ui/modal";
import { Keyboard, Navigation, FileText } from "lucide-react";

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GLOBAL_SHORTCUTS = [
  { keys: ["Alt", "D"], label: "Dashboard", urdu: "ڈیش بورڈ" },
  { keys: ["Alt", "S"], label: "New Sale Invoice", urdu: "نئی سیل انوائس" },
  { keys: ["Alt", "P"], label: "New Purchase Bill", urdu: "نیا خریداری بل" },
  { keys: ["Alt", "C"], label: "Cash & Payments", urdu: "کیش و ادائیگیاں" },
  { keys: ["Alt", "E"], label: "Daily Expenses", urdu: "اخراجات" },
  { keys: ["Alt", "I"], label: "Inventory & Stock", urdu: "اسٹاک" },
  { keys: ["Alt", "R"], label: "Financial Reports", urdu: "رپورٹس" },
  { keys: ["Ctrl", "K"], label: "Quick Global Search", urdu: "فوری تلاش" },
  { keys: ["F10"], label: "Toggle Shortcuts Help", urdu: "شارٹ کٹ مینو" },
];

const INVOICE_SHORTCUTS = [
  { keys: ["F1"], label: "Purchase Bills / Cost History", urdu: "خریداری بلز ہسٹری" },
  { keys: ["F2"], label: "Sales Invoices / Party Rates", urdu: "فروخت ریٹس ہسٹری" },
  { keys: ["Alt", "A"], label: "Add New Item Row", urdu: "نیا آئٹم شامل کریں" },
  { keys: ["F9"], label: "Save & Post Invoice / Bill", urdu: "محفوظ کریں (Save)" },
  { keys: ["Ctrl", "Enter"], label: "Quick Save & Post", urdu: "فوری محفوظ کریں" },
  { keys: ["F8"], label: "Save & Print Receipt", urdu: "محفوظ اور پرنٹ کریں" },
  { keys: ["↑", "↓", "Enter"], label: "Navigate List & Jump Next Field", urdu: "لسٹ اور اگلے خانے میں جائیں" },
  { keys: ["Esc"], label: "Close Dropdown / Modal", urdu: "بند کریں" },
];

function KeyCap({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 text-[11px] font-mono font-bold text-slate-700 bg-slate-100 border border-slate-300 rounded shadow-[0_1px_0_rgba(0,0,0,0.08)] dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600">
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Keyboard Shortcuts (کی بورڈ شارٹ کٹس)"
      description="Fast keyboard navigation across the entire software without using the mouse."
      maxWidth="2xl"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
        {/* Global Navigation */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 border-b border-slate-200 dark:border-slate-800 pb-1.5">
            <Navigation className="h-3.5 w-3.5" />
            <span>Global Navigation</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {GLOBAL_SHORTCUTS.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between py-2 gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {item.label}
                  </div>
                  <div className="text-[10px] text-slate-400">{item.urdu}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {item.keys.map((k, ki) => (
                    <React.Fragment key={ki}>
                      {ki > 0 && <span className="text-[10px] text-slate-400">+</span>}
                      <KeyCap>{k}</KeyCap>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Invoice & Bill Entry */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 border-b border-slate-200 dark:border-slate-800 pb-1.5">
            <FileText className="h-3.5 w-3.5" />
            <span>Sales & Purchase Entry</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {INVOICE_SHORTCUTS.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between py-2 gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {item.label}
                  </div>
                  <div className="text-[10px] text-slate-400">{item.urdu}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {item.keys.map((k, ki) => (
                    <React.Fragment key={ki}>
                      {ki > 0 && <span className="text-[10px] text-slate-400">+</span>}
                      <KeyCap>{k}</KeyCap>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <Keyboard className="h-3.5 w-3.5 text-slate-400" />
          <span>Press <KeyCap>F10</KeyCap> or <KeyCap>Shift</KeyCap> + <KeyCap>?</KeyCap> anytime to open this guide.</span>
        </span>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 transition"
        >
          Close
        </button>
      </div>
    </Modal>
  );
}
