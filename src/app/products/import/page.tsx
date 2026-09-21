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
  AlertTriangle,
  ArrowRight,
  Download,
  RotateCcw,
  RefreshCw,
  Layers,
  FileDown,
} from "lucide-react";
import { IMPORTABLE_FIELDS } from "@/services/productImportService";
import { useAuth } from "@/context/AuthContext";

export default function BulkProductImportPage() {
  const router = useRouter();
  const { activeCompany } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stepper: 1. Upload -> 2. Map -> 3. Preview -> 4. Validate -> 5. Import -> 6. Results
  const [step, setStep] = useState<number>(1);

  // Upload State
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [fileSize, setFileSize] = useState<string>("");
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);

  // Mapping State
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  // Validation State
  const [isValidating, setIsValidating] = useState(false);
  const [duplicateStrategy, setDuplicateStrategy] = useState<"UPDATE" | "SKIP">("UPDATE");
  const [validationResult, setValidationResult] = useState<{
    totalRows: number;
    validRows: number;
    warningRows: number;
    errorRows: number;
    rows: any[];
    errors: any[];
    warnings: any[];
  } | null>(null);

  // Import Execution State
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{
    importedCount: number;
    updatedCount: number;
    skippedCount: number;
  } | null>(null);

  // Simple CSV Parser for browser
  const parseCsvText = (text: string) => {
    const lines = text
      .split(/\r\n|\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      throw new Error("CSV file must contain a header row and at least one data row.");
    }

    // Parse header with quote handling
    const parseLine = (line: string) => {
      const result = [];
      let current = "";
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseLine(lines[0]);
    const rows: Record<string, any>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);
      const rowObj: Record<string, any> = {};
      for (let j = 0; j < headers.length; j++) {
        rowObj[headers[j]] = values[j] !== undefined ? values[j] : "";
      }
      rows.push(rowObj);
    }

    return { headers, rows };
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setFileName(uploadedFile.name);
    setFileSize((uploadedFile.size / 1024).toFixed(1) + " KB");

    try {
      const text = await uploadedFile.text();
      const { headers, rows } = parseCsvText(text);

      setCsvHeaders(headers);
      setRawRows(rows);

      // Call detection endpoint for smart alias mapping
      const res = await fetch("/api/products/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "detect", headers }),
      });

      const json = await res.json();
      if (json.success) {
        setColumnMapping(json.mapping);
      }

      setStep(2); // Advance to mapping step
    } catch (err: any) {
      alert(`CSV Parsing Error: ${err.message}`);
    }
  };

  const downloadSampleTemplate = () => {
    const csvContent =
      "Product Name,SKU,Category,HS Code,UOM,Sales Tax %,Retail Price,Wholesale Price,Purchase Price,Quantity\n" +
      "Apple iPhone 15 Pro 128GB,IPH-15P-128,Smartphones,8517.13,pcs,18,335000,310000,295000,10\n" +
      "Samsung 45W Type-C Adapter,CHG-SAM-45W,Accessories,8517.79,pcs,18,6500,5200,4800,25\n" +
      "USB-C to Lightning Cable,CAB-LTG-1M,Accessories,8544.42,pcs,18,2200,1600,1400,50\n";

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "smartbiz_products_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const runValidation = async () => {
    setIsValidating(true);
    try {
      const res = await fetch("/api/products/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "validate",
          rawRows,
          columnMapping,
          duplicateStrategy,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Validation failed");
      }

      setValidationResult(json.data);
      setStep(4);
    } catch (err: any) {
      alert(`Validation error: ${err.message}`);
    } finally {
      setIsValidating(false);
    }
  };

  const runImport = async () => {
    if (!validationResult) return;
    setIsImporting(true);
    setStep(5);

    // Simulated progress tick for UX
    let p = 10;
    const timer = setInterval(() => {
      p = Math.min(p + 20, 90);
      setImportProgress(p);
    }, 150);

    try {
      const res = await fetch("/api/products/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "commit",
          validRows: validationResult.rows,
          duplicateStrategy,
        }),
      });

      clearInterval(timer);
      setImportProgress(100);

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Import failed");
      }

      setImportResult(json.data);
      setStep(6);
    } catch (err: any) {
      clearInterval(timer);
      alert(`Import error: ${err.message}`);
      setStep(4);
    } finally {
      setIsImporting(false);
    }
  };

  const downloadErrorReport = async () => {
    if (!validationResult?.errors || validationResult.errors.length === 0) return;

    try {
      const res = await fetch("/api/products/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "error_report",
          errors: validationResult.errors,
        }),
      });

      const json = await res.json();
      if (json.success && json.csv) {
        const blob = new Blob([json.csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `import_errors_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error("Error downloading report:", err);
    }
  };

  const stepsList = [
    { num: 1, title: "Upload" },
    { num: 2, title: "Map Columns" },
    { num: 3, title: "Preview" },
    { num: 4, title: "Validate" },
    { num: 5, title: "Import" },
    { num: 6, title: "Results" },
  ];

  return (
    <div className="space-y-6 pb-24 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <Link
            href="/products"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Products</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">
            Bulk Product Import Wizard
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Import inventory catalogs via CSV/XLSX with automated HS Code fallback and duplicate protection.
          </p>
        </div>

        <button
          onClick={downloadSampleTemplate}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Download Sample Template</span>
        </button>
      </div>

      {/* Step Indicator */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex items-center justify-between">
          {stepsList.map((s, idx) => {
            const isDone = step > s.num;
            const isCurrent = step === s.num;

            return (
              <React.Fragment key={s.num}>
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition ${
                      isDone
                        ? "bg-emerald-500 text-white"
                        : isCurrent
                        ? "bg-indigo-600 text-white ring-4 ring-indigo-100"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {isDone ? "✓" : s.num}
                  </div>
                  <span
                    className={`hidden sm:inline text-xs font-medium ${
                      isCurrent ? "text-slate-900 font-bold" : "text-slate-500"
                    }`}
                  >
                    {s.title}
                  </span>
                </div>
                {idx < stepsList.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 ${
                      isDone ? "bg-emerald-500" : "bg-slate-200"
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* STEP 1: UPLOAD FILE */}
      {step === 1 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xs text-center space-y-6">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".csv, text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-12 bg-slate-50/50 hover:bg-indigo-50/20 transition group space-y-4"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 group-hover:scale-105 transition">
              <UploadCloud className="h-7 w-7" />
            </div>

            <div>
              <p className="text-sm font-bold text-slate-900">
                Drag & Drop or Click to Upload CSV File
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Accepted formats: .CSV, .XLSX (UTF-8 encoded) • Maximum file size: 10MB
              </p>
            </div>

            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition"
            >
              Browse Local File
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-left flex items-start gap-3">
            <Layers className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-600 space-y-1">
              <p className="font-bold text-slate-900">Smart HS Code Inheritance during Import</p>
              <p>
                If your CSV row includes an HS Code, it will be preserved. If absent, the wizard
                automatically falls back to Category defaults or Organization defaults (
                <span className="font-mono text-indigo-600 font-semibold">
                  {activeCompany?.defaultHsCode || "8517.13"}
                </span>
                ). Records with zero HS Code resolution will be flagged for review.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: MAP COLUMNS */}
      {step === 2 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Step 2: Map CSV Columns</h2>
              <p className="text-[11px] text-slate-500">
                File: <strong className="text-slate-900">{fileName}</strong> ({fileSize}) • {rawRows.length} rows detected
              </p>
            </div>

            <button
              onClick={() => setStep(1)}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Change File
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {csvHeaders.map((header) => {
              const currentMapped = columnMapping[header] || "";

              return (
                <div
                  key={header}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200"
                >
                  <div className="min-w-0 pr-3">
                    <span className="text-xs font-bold text-slate-900 block truncate">{header}</span>
                    <span className="text-[10px] text-slate-500 font-mono">Sample: &quot;{rawRows[0]?.[header] || "—"}&quot;</span>
                  </div>

                  <select
                    value={currentMapped}
                    onChange={(e) =>
                      setColumnMapping((prev) => ({ ...prev, [header]: e.target.value }))
                    }
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none shadow-2xs"
                  >
                    <option value="">Ignore this column</option>
                    {IMPORTABLE_FIELDS.map((f) => (
                      <option key={f.field} value={f.field}>
                        {f.label} {f.required ? "*" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              onClick={() => setStep(1)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 shadow-2xs"
            >
              Back
            </button>

            <button
              onClick={() => setStep(3)}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition"
            >
              <span>Continue to Preview</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: PREVIEW */}
      {step === 3 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Step 3: Preview First 10 Rows</h2>
              <p className="text-[11px] text-slate-500">
                Confirm your mapped data columns before running full rule validation
              </p>
            </div>

            <span className="text-xs text-slate-500 font-mono">
              Previewing 10 of {rawRows.length} Rows
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-[10px] uppercase font-bold text-slate-500">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  {Object.entries(columnMapping).map(([orig, target]) => {
                    if (!target) return null;
                    const def = IMPORTABLE_FIELDS.find((f) => f.field === target);
                    return (
                      <th key={orig} className="py-2.5 px-3">
                        {def?.label || orig}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {rawRows.slice(0, 10).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60">
                    <td className="py-2 px-3 font-mono text-slate-400">{idx + 1}</td>
                    {Object.entries(columnMapping).map(([orig, target]) => {
                      if (!target) return null;
                      return (
                        <td key={orig} className="py-2 px-3">
                          {String(row[orig] || "—")}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              onClick={() => setStep(2)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 shadow-2xs"
            >
              Back to Mapping
            </button>

            <button
              onClick={runValidation}
              disabled={isValidating}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isValidating ? "animate-spin" : ""}`} />
              <span>{isValidating ? "Validating Records..." : "Validate Products"}</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: VALIDATE */}
      {step === 4 && validationResult && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900">Step 4: Validation Summary</h2>
            <p className="text-[11px] text-slate-500">
              Review data validation statistics, HS Code inheritance, and duplicate rules
            </p>
          </div>

          {/* 4 Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-500">Total Rows</span>
              <p className="mt-1 text-2xl font-bold font-mono text-slate-900">
                {validationResult.totalRows}
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-center">
              <span className="text-[10px] uppercase font-bold text-emerald-800">Valid Rows</span>
              <p className="mt-1 text-2xl font-bold font-mono text-emerald-700">
                {validationResult.validRows}
              </p>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-center">
              <span className="text-[10px] uppercase font-bold text-amber-800">Warnings</span>
              <p className="mt-1 text-2xl font-bold font-mono text-amber-700">
                {validationResult.warningRows}
              </p>
            </div>

            <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 text-center">
              <span className="text-[10px] uppercase font-bold text-rose-800">Errors</span>
              <p className="mt-1 text-2xl font-bold font-mono text-rose-700">
                {validationResult.errorRows}
              </p>
            </div>
          </div>

          {/* Duplicate Resolution Strategy */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold text-slate-900">Duplicate Product Strategy</h3>
              <p className="text-[11px] text-slate-500">
                How should existing products matched by SKU or barcode be handled?
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDuplicateStrategy("UPDATE")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  duplicateStrategy === "UPDATE"
                    ? "bg-indigo-600 text-white shadow-2xs"
                    : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                Update Existing
              </button>
              <button
                type="button"
                onClick={() => setDuplicateStrategy("SKIP")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  duplicateStrategy === "SKIP"
                    ? "bg-indigo-600 text-white shadow-2xs"
                    : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                Skip Duplicates
              </button>
            </div>
          </div>

          {/* Errors list if any */}
          {validationResult.errorRows > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-500" />
                  <span className="text-xs font-bold text-rose-700">
                    {validationResult.errorRows} Errors Detected (Rows cannot be imported)
                  </span>
                </div>

                <button
                  onClick={downloadErrorReport}
                  className="inline-flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-800 font-semibold"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download Error Report (CSV)</span>
                </button>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-2xl border border-rose-200 bg-rose-50/40 p-3">
                {validationResult.errors.map((err: any, idx: number) => (
                  <div key={idx} className="text-xs text-slate-800 flex items-start gap-2">
                    <span className="font-mono text-rose-600 font-bold shrink-0">Row {err.row}:</span>
                    <div>
                      <strong className="text-rose-900">{err.error}</strong> in field &apos;{err.field}&apos;
                      <p className="text-[11px] text-slate-500">Fix: {err.suggestedFix}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Bar */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              onClick={() => setStep(3)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 shadow-2xs"
            >
              Back to Preview
            </button>

            <button
              onClick={runImport}
              disabled={validationResult.validRows === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition disabled:opacity-50"
            >
              <UploadCloud className="h-4 w-4" />
              <span>Import {validationResult.validRows} Valid Products</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: IMPORT IN PROGRESS */}
      {step === 5 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center space-y-6 shadow-xs">
          <RefreshCw className="h-10 w-10 text-indigo-600 animate-spin mx-auto" />
          <div>
            <h2 className="text-lg font-bold text-slate-900">Importing Products to Database...</h2>
            <p className="text-xs text-slate-500 mt-1">
              Committing records with resolved HS codes and updating inventory ledgers.
            </p>
          </div>

          <div className="w-full max-w-md mx-auto bg-slate-100 rounded-full h-3 overflow-hidden">
            <div
              className="bg-indigo-600 h-full transition-all duration-300 rounded-full"
              style={{ width: `${importProgress}%` }}
            />
          </div>
          <span className="text-xs font-mono text-indigo-600 font-bold">{importProgress}%</span>
        </div>
      )}

      {/* STEP 6: RESULTS */}
      {step === 6 && importResult && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-6 shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200">
            <CheckCircle2 className="h-8 w-8" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900">Import Successfully Finished!</h2>
            <p className="text-xs text-slate-500 mt-1">
              Your product catalog has been updated in the database.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <span className="text-[10px] uppercase font-bold text-emerald-700">Created</span>
              <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
                {importResult.importedCount}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <span className="text-[10px] uppercase font-bold text-indigo-700">Updated</span>
              <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
                {importResult.updatedCount}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <span className="text-[10px] uppercase font-bold text-slate-500">Skipped</span>
              <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
                {importResult.skippedCount}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 pt-4">
            {(validationResult?.errorRows ?? 0) > 0 && (
              <button
                onClick={downloadErrorReport}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
              >
                <Download className="h-4 w-4" />
                <span>Download Error Report</span>
              </button>
            )}

            <Link
              href="/products"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition"
            >
              <span>View Product Registry</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
