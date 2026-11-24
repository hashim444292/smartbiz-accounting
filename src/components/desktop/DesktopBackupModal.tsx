"use client";

import React, { useState } from "react";
import {
  Download,
  Upload,
  Database,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";

interface DesktopBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DesktopBackupModal({ isOpen, onClose }: DesktopBackupModalProps) {
  const { t, language } = useLanguage();
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  if (!isOpen) return null;

  // Check if running in Electron environment
  const isElectron = typeof window !== "undefined" && Boolean((window as any).accounts360Desktop);

  const handleExportBackup = async () => {
    setDownloading(true);
    setFeedback(null);
    try {
      if (isElectron) {
        // Native Electron save dialog
        const res = await fetch("/api/desktop/backup");
        const payloadString = await res.text();
        const checksum = res.headers.get("X-Backup-Checksum") || "";
        const now = new Date();
        const filename = `Accounts360_Backup_${now.toISOString().slice(0, 10)}.sbz`;

        const saveRes = await (window as any).accounts360Desktop.exportBackupFile({
          filename,
          payloadString,
          checksum,
        });

        if (saveRes.success) {
          setFeedback({
            type: "success",
            message:
              language === "ur"
                ? `بیک اپ فائل کامیابی سے محفوظ ہو گئی: ${saveRes.filePath}`
                : `Backup successfully saved to: ${saveRes.filePath}`,
          });
        }
      } else {
        // Browser direct download
        const res = await fetch("/api/desktop/backup");
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Accounts360_Backup_${new Date().toISOString().slice(0, 10)}.sbz`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

        setFeedback({
          type: "success",
          message:
            language === "ur"
              ? "مکمل بیک اپ فائل ڈاؤنلوڈ ہو گئی ہے۔ اسے محفوظ مقام پر رکھیں۔"
              : "Complete backup file downloaded successfully. Keep it in a safe place.",
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "Failed to generate backup",
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm(t(
      "Are you sure you want to restore this backup? Your local records will be restored to the state of this backup file.",
      "کیا آپ واقعی یہ بیک اپ بحال کرنا چاہتے ہیں؟ آپ کا موجودہ کھاتہ اس فائل کی حالت پر بحال ہو جائے گا۔"
    ))) {
      e.target.value = "";
      return;
    }

    setRestoring(true);
    setFeedback(null);

    try {
      const text = await file.text();
      const res = await fetch("/api/desktop/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: text,
      });

      const json = await res.json();
      if (json.success) {
        setFeedback({
          type: "success",
          message:
            language === "ur"
              ? `بیک اپ کامیابی سے بحال ہو گیا! (${json.metadata?.businessName || "Business"})`
              : `Database successfully restored! (${json.metadata?.businessName || "Business"})`,
        });
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setFeedback({
          type: "error",
          message: json.error || "Failed to restore backup",
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "Network error while uploading backup",
      });
    } finally {
      setRestoring(false);
      e.target.value = "";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center">
              <Database className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {t("1-Click Database Backup & Restore", "ایک کلک ڈیٹا بیک اپ و بحالی")}
              </h3>
              <p className="text-[11px] text-slate-400">
                Offline .sbz Secure Snapshots
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xs font-bold px-2 py-1 rounded-lg"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Export Action Card */}
          <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-900/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-xs text-indigo-950 dark:text-indigo-200">
                <Download className="h-4 w-4 text-indigo-600" />
                <span>{t("Download Offline Backup (.sbz)", "مکمل بیک اپ فائل ڈاؤنلوڈ کریں")}</span>
              </div>
              <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-100 dark:bg-indigo-900/60 px-2 py-0.5 rounded-full">
                Encrypted & Signed
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              {t(
                "Exports a complete encrypted snapshot of all sales, purchases, customers khata, ledgers, and cash balances to an offline .sbz file.",
                "تمام سیلز، خریداری، کسٹمرز لیجر، کیش رجسٹر اور کھاتوں کا مکمل محفوظ بیک اپ تیار کرتا ہے۔"
              )}
            </p>
            <Button
              type="button"
              disabled={downloading}
              onClick={handleExportBackup}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 rounded-xl shadow-xs"
            >
              {downloading ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  {t("Exporting Complete Database...", "بیک اپ تیار ہو رہا ہے...")}
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  {t("Export Backup File Now", "ابھی بیک اپ فائل نکالیں")}
                </>
              )}
            </Button>
          </div>

          {/* Import Action Card */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-xs text-slate-800 dark:text-slate-200">
                <Upload className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                <span>{t("Restore Database from File", "فائل سے ڈیٹا بحال کریں")}</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                Checksum Verified
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              {t(
                "Restore your records from a previously exported .sbz backup file. Verified against cryptographic checksum before applying.",
                "پہلے سے محفوظ شدہ بیک اپ فائل منتخب کر کے تمام ڈیٹا بحال کریں۔ سسٹم خودکار طور پر فائل کے درست ہونے کی تصدیق کرے گا۔"
              )}
            </p>
            <label className="block">
              <input
                type="file"
                accept=".sbz,.json"
                disabled={restoring}
                onChange={handleFileSelect}
                className="hidden"
                id="sbz-file-upload-input"
              />
              <Button
                type="button"
                variant="outline"
                disabled={restoring}
                onClick={() => document.getElementById("sbz-file-upload-input")?.click()}
                className="w-full border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {restoring ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    {t("Verifying & Restoring Database...", "ڈیٹا بحال ہو رہا ہے...")}
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    {t("Select .sbz Backup File to Restore", "بیک اپ فائل منتخب کریں")}
                  </>
                )}
              </Button>
            </label>
          </div>

          {/* Feedback messages */}
          {feedback && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold flex items-start gap-2 ${
                feedback.type === "success"
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                  : "bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800"
              }`}
            >
              {feedback.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="text-xs font-bold px-4 h-8"
            >
              {t("Close", "بند کریں")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
