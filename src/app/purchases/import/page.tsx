"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Download,
  RotateCcw,
  RefreshCw,
  FileDown,
  Building,
  Package,
  Check,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ParsedPurchaseRow {
  date: string;
  supplierName: string;
  productName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  paidAmount: number;
  remainingAmount: number;
  paymentMethod: string;
  paymentStatus: "PAID" | "PARTIAL" | "UNPAID";
  notes?: string;
  isValid: boolean;
  validationError?: string;
}

export default function BulkPurchasesImportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [parsedRows, setParsedRows] = useState<ParsedPurchaseRow[]>([]);
  const [parsingError, setParsingError] = useState<string | null>(null);

  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    importedCount: number;
    errorCount?: number;
    message: string;
  } | null>(null);

  // Template Downloader
  const downloadSampleTemplate = () => {
    const csvContent =
      "Date,Supplier Name,Product Name,Quantity,Unit Purchase Cost,Paid Amount,Payment Method,Payment Status,Notes\n" +
      "2026-09-16,AHMED TECH WHOLESALE,IPH 13 128GB APP,5,125000,625000,BANK,PAID,Direct vendor bulk inward\n" +
      "2026-09-16,NATIONAL MOBILE SUPPLIERS,CAMON 40 PRO,10,42000,200000,CASH,PARTIAL,Partial cash on delivery\n" +
      "2026-09-16,DUBAI CELLULAR WHOLESALE,IPH 15 PRO MAX 256GB,3,275000,0,BANK,UNPAID,30 days credit terms\n" +
      "2026-09-16,PAK CELLULAR DISTRIBUTORS,Wireless Fast Charger 20W,20,2200,44000,CASH,PAID,Accessories stock batch\n";

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "purchase_bills_sample_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export All Invoices to CSV
  const exportAllPurchases = async () => {
    try {
      const res = await fetch("/api/purchases");
      const json = await res.json();
      if (!json.success || !json.data) {
        alert("Failed to fetch purchases for export");
        return;
      }

      const headers = [
        "Purchase Number",
        "Date",
        "Supplier Name",
        "Total Cost",
        "Paid Amount",
        "Payable Balance",
        "Payment Status",
        "Payment Method",
        "Items Count",
      ];

      const rows = json.data.map((p: any) => [
        `"${p.purchaseNumber || ""}"`,
        `"${new Date(p.date).toISOString().slice(0, 10)}"`,
        `"${(p.supplierName || "").replace(/"/g, '""')}"`,
        Number(p.totalAmount || 0),
        Number(p.paidAmount || 0),
        Number(p.remainingAmount || 0),
        `"${p.paymentStatus || "UNPAID"}"`,
        `"${p.paymentMethod || "CASH"}"`,
        p.items?.length || 1,
      ]);

      const csvContent = [headers.join(","), ...rows.map((r: any) => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `all_purchases_export_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(err);
      alert("Error exporting purchases");
    }
  };

  // File parsing logic
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    processFile(selected);
  };

  const processFile = (fileToProcess: File) => {
    setFile(fileToProcess);
    setFileName(fileToProcess.name);
    setParsingError(null);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        parseCSVText(text);
      } catch (err: any) {
        setParsingError(err.message || "Failed to read CSV file content.");
      }
    };
    reader.readAsText(fileToProcess);
  };

  const parseCSVText = (csvString: string) => {
    const lines = csvString
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      setParsingError("CSV file must contain at least a header line and 1 data row.");
      return;
    }

    // Parse header
    const headers = lines[0]
      .split(",")
      .map((h) => h.replace(/^["']|["']$/g, "").trim().toLowerCase());

    const findColIdx = (keywords: string[]) => {
      return headers.findIndex((h) => keywords.some((k) => h.includes(k)));
    };

    const dateIdx = findColIdx(["date", "bill date", "purchase date"]);
    const supplierIdx = findColIdx(["supplier", "vendor", "party", "biller"]);
    const productIdx = findColIdx(["product", "item", "description", "model"]);
    const qtyIdx = findColIdx(["qty", "quantity", "units", "inward"]);
    const costIdx = findColIdx(["cost", "unit cost", "purchase cost", "price", "rate"]);
    const paidIdx = findColIdx(["paid", "amount paid", "cash paid"]);
    const methodIdx = findColIdx(["method", "payment method", "account", "type"]);
    const statusIdx = findColIdx(["status", "payment status"]);
    const notesIdx = findColIdx(["note", "remarks", "memo"]);

    const rows: ParsedPurchaseRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      // Handle quoted commas
      const cells: string[] = [];
      let inQuotes = false;
      let current = "";
      for (let c = 0; c < line.length; c++) {
        const char = line[c];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          cells.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      cells.push(current.trim());

      const cleanCell = (idx: number) => {
        if (idx === -1 || idx >= cells.length) return "";
        return (cells[idx] || "").replace(/^["']|["']$/g, "").trim();
      };

      const dateStr = cleanCell(dateIdx) || new Date().toISOString().slice(0, 10);
      const supplierName = cleanCell(supplierIdx) || "General Supplier";
      const productName = cleanCell(productIdx) || "Stock Item";
      const quantity = Math.max(1, parseFloat(cleanCell(qtyIdx)) || 1);
      const unitCost = Math.max(0, parseFloat(cleanCell(costIdx)) || 0);
      const totalCost = quantity * unitCost;

      const rawPaid = cleanCell(paidIdx);
      let paidAmount = rawPaid !== "" ? parseFloat(rawPaid) || 0 : totalCost;
      if (paidAmount > totalCost) paidAmount = totalCost;

      const remainingAmount = Math.max(0, totalCost - paidAmount);
      const rawStatus = cleanCell(statusIdx).toUpperCase();
      let paymentStatus: "PAID" | "PARTIAL" | "UNPAID" = "PAID";
      if (rawStatus.includes("UNPAID")) paymentStatus = "UNPAID";
      else if (rawStatus.includes("PARTIAL") || remainingAmount > 0) paymentStatus = "PARTIAL";
      else if (remainingAmount === 0) paymentStatus = "PAID";

      const paymentMethod = cleanCell(methodIdx).toUpperCase() || (paidAmount > 0 ? "CASH" : "BANK");
      const notes = cleanCell(notesIdx) || "Bulk imported purchase bill";

      let isValid = true;
      let validationError = "";

      if (!supplierName) {
        isValid = false;
        validationError = "Supplier name is required.";
      } else if (!productName) {
        isValid = false;
        validationError = "Product / Item name is required.";
      } else if (unitCost <= 0) {
        isValid = false;
        validationError = "Unit purchase cost must be greater than 0.";
      }

      rows.push({
        date: dateStr,
        supplierName,
        productName,
        quantity,
        unitCost,
        totalCost,
        paidAmount,
        remainingAmount,
        paymentMethod,
        paymentStatus,
        notes,
        isValid,
        validationError: isValid ? undefined : validationError,
      });
    }

    setParsedRows(rows);
  };

  // Perform Import
  const handleExecuteImport = async () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      alert("No valid purchase rows found to import.");
      return;
    }

    setIsImporting(true);
    setParsingError(null);

    try {
      const payload = {
        purchases: validRows.map((r) => ({
          date: r.date,
          supplierName: r.supplierName,
          items: [
            {
              productName: r.productName,
              quantity: r.quantity,
              unitCost: r.unitCost,
            },
          ],
          paidAmount: r.paidAmount,
          paymentMethod: r.paymentMethod,
          paymentStatus: r.paymentStatus,
          notes: r.notes,
        })),
      };

      const res = await fetch("/api/purchases/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setImportResult({
          importedCount: data.importedCount,
          errorCount: data.errorCount,
          message: data.message || `Successfully imported ${data.importedCount} purchase bills into system.`,
        });
      } else {
        setParsingError(data.error || "Failed to import purchase bills.");
      }
    } catch (err: any) {
      setParsingError(err.message || "Network error while importing purchases.");
    } finally {
      setIsImporting(false);
    }
  };

  const totalImportCost = parsedRows.reduce((acc, r) => acc + (r.isValid ? r.totalCost : 0), 0);
  const totalImportPaid = parsedRows.reduce((acc, r) => acc + (r.isValid ? r.paidAmount : 0), 0);
  const totalImportPayable = parsedRows.reduce((acc, r) => acc + (r.isValid ? r.remainingAmount : 0), 0);
  const validCount = parsedRows.filter((r) => r.isValid).length;
  const invalidCount = parsedRows.length - validCount;

  return (
    <div className="space-y-6 pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <Link
            href="/purchases"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-1 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Purchases & Inward Stock</span>
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5 dark:text-white">
            <UploadCloud className="h-6 w-6 text-indigo-600" />
            <span>Bulk Purchase Bills Import (CSV / Excel)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Import vendor bills, update stock balances with weighted average cost, and update supplier accounts payable.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={downloadSampleTemplate}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            <FileDown className="h-3.5 w-3.5 text-indigo-600" />
            <span>Download Sample CSV</span>
          </button>
          <button
            onClick={exportAllPurchases}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>Export All Purchases</span>
          </button>
        </div>
      </div>

      {/* Success Banner */}
      {importResult && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-800 dark:bg-emerald-950/40 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-600 p-2 text-white">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                  Bulk Import Completed Successfully!
                </h3>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                  {importResult.message}
                </p>
                <div className="flex items-center gap-4 mt-2 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                  <span>Bills Imported: {importResult.importedCount}</span>
                  {importResult.errorCount ? <span>Errors: {importResult.errorCount}</span> : null}
                </div>
              </div>
            </div>

            <Button
              onClick={() => router.push("/purchases")}
              variant="primary"
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              View Purchases List
            </Button>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {parsingError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700 flex items-center gap-2 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{parsingError}</span>
        </div>
      )}

      {/* Step 1: Upload Card */}
      {parsedRows.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xs dark:border-slate-800 dark:bg-slate-900 text-center">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".csv,text/csv,application/vnd.ms-excel"
            className="hidden"
          />

          <div className="max-w-md mx-auto space-y-4">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 dark:bg-indigo-950/60 dark:border-indigo-800">
              <FileSpreadsheet className="h-8 w-8" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Upload Purchase Bills CSV File
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Drag and drop your spreadsheet or click below to browse from your device.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="primary"
                size="md"
                className="gap-2 bg-indigo-600 hover:bg-indigo-700"
              >
                <UploadCloud className="h-4 w-4" />
                <span>Select CSV File</span>
              </Button>

              <button
                onClick={downloadSampleTemplate}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition dark:border-slate-800 dark:text-slate-200"
              >
                <Download className="h-3.5 w-3.5 text-slate-400" />
                <span>Download Sample</span>
              </button>
            </div>

            {/* Supported Columns Guide */}
            <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 text-left">
              <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider dark:text-slate-400 mb-2">
                Expected Columns in File:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-slate-500 font-mono">
                <span className="bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">Date</span>
                <span className="bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">Supplier Name</span>
                <span className="bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">Product Name</span>
                <span className="bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">Quantity</span>
                <span className="bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">Unit Purchase Cost</span>
                <span className="bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">Paid Amount (Optional)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Preview & Execution */}
      {parsedRows.length > 0 && (
        <div className="space-y-4">
          {/* Summary Metric Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[10px] font-bold uppercase text-slate-400">Total Rows Found</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">{parsedRows.length}</p>
              <span className="text-[10px] text-emerald-600 font-semibold">{validCount} valid rows</span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[10px] font-bold uppercase text-slate-400">Total Purchase Value</p>
              <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                Rs {totalImportCost.toLocaleString("en-PK")}
              </p>
              <span className="text-[10px] text-slate-400">Goods Inward Value</span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[10px] font-bold uppercase text-slate-400">Paid Outfront</p>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                Rs {totalImportPaid.toLocaleString("en-PK")}
              </p>
              <span className="text-[10px] text-slate-400">Cash / Bank Deduction</span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[10px] font-bold uppercase text-slate-400">Accounts Payable</p>
              <p className="text-lg font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                Rs {totalImportPayable.toLocaleString("en-PK")}
              </p>
              <span className="text-[10px] text-slate-400">Added to Supplier Ledgers</span>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200 dark:bg-slate-900/60 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                File: {fileName}
              </span>
              <span className="text-xs text-slate-400">({parsedRows.length} lines parsed)</span>
              {invalidCount > 0 && (
                <span className="bg-rose-50 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded border border-rose-200">
                  {invalidCount} issues
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setParsedRows([]);
                  setFile(null);
                  setFileName("");
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-100 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Upload Different File</span>
              </button>

              <Button
                onClick={handleExecuteImport}
                disabled={isImporting || validCount === 0}
                variant="primary"
                size="md"
                className="gap-2 bg-indigo-600 hover:bg-indigo-700"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Importing Purchases...</span>
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    <span>Import {validCount} Purchase Bills Now</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Parsed Rows Table */}
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto max-h-[480px]">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase font-bold text-slate-500 sticky top-0 dark:border-slate-800 dark:bg-slate-800/80">
                  <tr>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Supplier</th>
                    <th className="py-2.5 px-3">Product / Stock Item</th>
                    <th className="py-2.5 px-3 text-center">Inward Qty</th>
                    <th className="py-2.5 px-3 text-right">Unit Cost</th>
                    <th className="py-2.5 px-3 text-right">Total Cost</th>
                    <th className="py-2.5 px-3 text-right">Paid</th>
                    <th className="py-2.5 px-3 text-right">Payable</th>
                    <th className="py-2.5 px-3 text-center">Settlement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans dark:divide-slate-800">
                  {parsedRows.map((r, i) => (
                    <tr key={i} className={r.isValid ? "hover:bg-slate-50/60" : "bg-rose-50/40 hover:bg-rose-50/60"}>
                      <td className="py-2.5 px-3">
                        {r.isValid ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded">
                            <Check className="h-2.5 w-2.5" /> Ready
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded" title={r.validationError}>
                            <AlertCircle className="h-2.5 w-2.5" /> Error
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">{r.date}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                        {r.supplierName}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                        {r.productName}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-800 dark:text-slate-200">
                        {r.quantity}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                        Rs {r.unitCost.toLocaleString("en-PK")}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold font-mono text-slate-900 dark:text-white">
                        Rs {r.totalCost.toLocaleString("en-PK")}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-600">
                        Rs {r.paidAmount.toLocaleString("en-PK")}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-rose-600 font-semibold">
                        Rs {r.remainingAmount.toLocaleString("en-PK")}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          r.paymentStatus === "PAID"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : r.paymentStatus === "PARTIAL"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}>
                          {r.paymentStatus} ({r.paymentMethod})
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
