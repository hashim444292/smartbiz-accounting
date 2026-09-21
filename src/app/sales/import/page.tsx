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
  FileDown,
  Layers,
  Check,
  Zap,
  Lock,
  Wallet,
  Building
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ParsedInvoiceRow {
  date: string;
  customerName: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentMethod: string;
  paymentStatus: "PAID" | "PARTIAL" | "UNPAID";
  notes?: string;
  isValid: boolean;
  validationError?: string;
}

export default function BulkSalesImportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [parsedRows, setParsedRows] = useState<ParsedInvoiceRow[]>([]);
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
      "Date,Customer Name,Product Name,Quantity,Unit Price,Tax Rate,Paid Amount,Payment Method,Payment Status,Notes\n" +
      "2026-09-16,Ali Traders,Samsung Galaxy A55,2,85000,18,200600,CASH,PAID,Regular cash sale\n" +
      "2026-09-16,Kashif Electronics,Infinix Note 40,3,45000,18,50000,BANK,PARTIAL,Partial advance payment\n" +
      "2026-09-16,Bilal Motors,AGS Battery 100Ah,1,28000,18,0,CREDIT,UNPAID,Full credit sale udhar\n" +
      "2026-09-16,Walk-in Customer,Wireless Earbuds ANC,4,6500,18,30680,CASH,PAID,Walk in customer sale\n";

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "sales_invoices_sample_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export All Invoices to CSV
  const exportAllInvoices = async () => {
    try {
      const res = await fetch("/api/sales");
      const json = await res.json();
      if (!json.success || !json.data) {
        alert("Failed to fetch invoices for export");
        return;
      }

      const headers = [
        "Invoice Number",
        "Date",
        "Customer Name",
        "Goods Subtotal",
        "Sales Tax",
        "POS Fee",
        "Total Amount",
        "Paid Amount",
        "Accounts Receivable (Balance)",
        "Payment Status",
        "Payment Method",
        "FBR Status",
        "FBR Invoice Number",
      ];

      const rows = json.data.map((inv: any) => [
        inv.invoiceNumber,
        new Date(inv.date).toLocaleDateString(),
        `"${(inv.customerName || "").replace(/"/g, '""')}"`,
        Number(inv.subtotal || 0).toFixed(2),
        Number(inv.salesTax || inv.taxAmount || 0).toFixed(2),
        Number(inv.posFee || 0).toFixed(2),
        Number(inv.totalAmount || 0).toFixed(2),
        Number(inv.paidAmount || 0).toFixed(2),
        Number(inv.remainingAmount || 0).toFixed(2),
        inv.paymentStatus || "PAID",
        inv.paymentMethod || "CASH",
        inv.fbrStatus || "PENDING",
        inv.fbrInvoiceNumber || "Un-transmitted",
      ]);

      const csvContent = [headers.join(","), ...rows.map((r: any[]) => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `All_Sales_Invoices_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e: any) {
      alert("Error exporting invoices: " + e.message);
    }
  };

  // CSV Parser
  const parseCsvText = (text: string) => {
    const lines = text
      .split(/\r\n|\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      throw new Error("CSV file must contain a header row and at least one data row.");
    }

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

    const header = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
    const rows: ParsedInvoiceRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);
      if (values.length < 3) continue;

      const getVal = (possibleKeys: string[]) => {
        for (const k of possibleKeys) {
          const idx = header.findIndex((h) => h.includes(k));
          if (idx !== -1 && values[idx] !== undefined) return values[idx];
        }
        return "";
      };

      const dateStr = getVal(["date"]) || new Date().toISOString().slice(0, 10);
      const customerName = getVal(["customer", "client", "buyer"]) || "Walk-in Customer";
      const productName = getVal(["product", "item", "description"]) || "General Merchandise";
      const qty = Math.max(1, Number(getVal(["qty", "quantity"]) || 1));
      const price = Number(getVal(["price", "rate", "unitprice"]) || 0);
      const taxRate = Number(getVal(["tax", "taxrate", "gst"]) || 18);

      const subtotal = qty * price;
      const taxAmount = subtotal * (taxRate / 100);
      const totalAmount = subtotal + taxAmount;

      const rawPaid = getVal(["paid", "paidamount", "deposit"]);
      const rawStatus = (getVal(["status", "paymentstatus"]) || "").toUpperCase();

      let paid = rawPaid !== "" ? Number(rawPaid) : totalAmount;
      if (rawStatus === "UNPAID" || rawStatus === "CREDIT") paid = 0;
      if (paid > totalAmount) paid = totalAmount;

      const remaining = Math.max(0, totalAmount - paid);
      const paymentStatus: "PAID" | "PARTIAL" | "UNPAID" =
        remaining === 0 ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID";

      const paymentMethod = (getVal(["method", "paymentmethod"]) || (paid > 0 ? "CASH" : "CREDIT")).toUpperCase();
      const notes = getVal(["notes", "memo", "remarks"]);

      const isValid = price > 0 && productName.length > 0;
      const validationError = price <= 0 ? "Unit price must be greater than 0" : undefined;

      rows.push({
        date: dateStr,
        customerName,
        productName,
        quantity: qty,
        unitPrice: price,
        taxRate,
        subtotal,
        taxAmount,
        totalAmount,
        paidAmount: paid,
        remainingAmount: remaining,
        paymentMethod,
        paymentStatus,
        notes,
        isValid,
        validationError,
      });
    }

    return rows;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    setFile(f);
    setFileName(f.name);
    setParsingError(null);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const parsed = parseCsvText(text);
        setParsedRows(parsed);
      } catch (err: any) {
        setParsingError(err.message || "Failed to parse CSV file");
        setParsedRows([]);
      }
    };
    reader.readAsText(f);
  };

  // Submit parsed invoices to backend
  const handleExecuteImport = async () => {
    if (parsedRows.length === 0) return;
    setIsImporting(true);
    setParsingError(null);

    try {
      const validPayload = parsedRows
        .filter((r) => r.isValid)
        .map((r) => ({
          date: r.date,
          customerName: r.customerName,
          items: [
            {
              productName: r.productName,
              quantity: r.quantity,
              unitPrice: r.unitPrice,
              taxRate: r.taxRate,
            },
          ],
          paidAmount: r.paidAmount,
          paymentMethod: r.paymentMethod,
          paymentStatus: r.paymentStatus,
          notes: r.notes,
        }));

      const res = await fetch("/api/sales/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoices: validPayload }),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Failed to import invoices");
      }

      setImportResult({
        importedCount: json.importedCount,
        errorCount: json.errorCount,
        message: json.message,
      });
    } catch (err: any) {
      setParsingError(err.message || "Error importing invoices");
    } finally {
      setIsImporting(false);
    }
  };

  // Aggregated Stats for Preview
  const totalSubtotal = parsedRows.reduce((acc, r) => acc + r.subtotal, 0);
  const totalTax = parsedRows.reduce((acc, r) => acc + r.taxAmount, 0);
  const grandTotal = parsedRows.reduce((acc, r) => acc + r.totalAmount, 0);
  const totalPaid = parsedRows.reduce((acc, r) => acc + r.paidAmount, 0);
  const totalReceivables = parsedRows.reduce((acc, r) => acc + r.remainingAmount, 0);

  const readyToHitCount = parsedRows.filter((r) => r.paymentStatus === "PAID").length;
  const awaitingPaymentCount = parsedRows.filter((r) => r.paymentStatus !== "PAID").length;

  return (
    <div className="space-y-6 pb-24 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/sales"
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50 shadow-2xs"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                Data Management
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Bulk Invoicing & Export Center
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">
              Bulk Upload & Download Sales Invoices
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload multiple sales invoices via CSV/Excel, automatically calculate 18% GST and Accounts Receivable, and export all invoices on demand.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={downloadSampleTemplate}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            <span>Download CSV Template</span>
          </button>

          <button
            onClick={exportAllInvoices}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 shadow-sm transition"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download All Invoices (CSV)</span>
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {importResult && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950 space-y-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-emerald-600 p-2 text-white">
              <Check className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-base text-emerald-900">
                {importResult.message}
              </h4>
              <p className="text-xs text-emerald-700 mt-0.5">
                All imported sales have been recorded in the general ledger, stock deducted, and accounts receivable balances updated.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Link
              href="/compliance/fbr"
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 shadow-xs"
            >
              <Zap className="h-3.5 w-3.5" />
              <span>Open FBR Invoicing Queue</span>
            </Link>
            <Link
              href="/sales"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 shadow-2xs"
            >
              <span>View Invoices List</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {parsingError && (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-900">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
          <span>{parsingError}</span>
        </div>
      )}

      {/* Drag & Drop Upload Card */}
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-2xs hover:border-indigo-400 transition">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt"
          onChange={handleFileUpload}
          className="hidden"
        />

        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 mb-3">
          <UploadCloud className="h-7 w-7" />
        </div>

        <h3 className="text-base font-bold text-slate-900">
          {fileName ? fileName : "Upload CSV Sales Invoices File"}
        </h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
          Select or drag and drop your spreadsheet file. Supports standard columns: Date, Customer Name, Product, Quantity, Price, Tax Rate, and Paid Amount.
        </p>

        <div className="mt-5 flex items-center justify-center gap-3">
          <Button
            type="button"
            variant="primary"
            onClick={() => fileInputRef.current?.click()}
            className="bg-indigo-600 hover:bg-indigo-700 text-xs px-4 py-2"
          >
            <UploadCloud className="h-4 w-4 mr-1.5" />
            {fileName ? "Choose Another File" : "Browse CSV File"}
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={downloadSampleTemplate}
            className="text-xs px-3.5 py-2"
          >
            <FileSpreadsheet className="h-4 w-4 mr-1.5 text-emerald-600" />
            Sample CSV
          </Button>
        </div>
      </div>

      {/* Preview Section */}
      {parsedRows.length > 0 && (
        <div className="space-y-4">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Total Invoices</span>
              <p className="text-xl font-bold font-mono text-slate-900 mt-1">
                {parsedRows.length}
              </p>
              <span className="text-[10px] text-slate-500">Rows in CSV</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Gross Total</span>
              <p className="text-xl font-bold font-mono text-slate-900 mt-1">
                Rs {grandTotal.toLocaleString()}
              </p>
              <span className="text-[10px] text-indigo-600 font-medium">Incl. 18% GST (Rs {totalTax.toLocaleString()})</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Amount Paid</span>
              <p className="text-xl font-bold font-mono text-emerald-600 mt-1">
                Rs {totalPaid.toLocaleString()}
              </p>
              <span className="text-[10px] text-emerald-700 font-medium">Cash/Bank Inflow</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Accounts Receivable</span>
              <p className="text-xl font-bold font-mono text-rose-600 mt-1">
                Rs {totalReceivables.toLocaleString()}
              </p>
              <span className="text-[10px] text-rose-700 font-medium">Pending from buyers</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-200 shadow-2xs">
              <span className="text-[10px] text-indigo-800 font-bold uppercase">FBR Queue Status</span>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-700">
                  {readyToHitCount} Ready
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs font-bold text-amber-700">
                  {awaitingPaymentCount} Protected
                </span>
              </div>
              <span className="text-[10px] text-indigo-700 mt-0.5 block">Zero POS fees charged upfront</span>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
            <div className="text-xs text-slate-600">
              Ready to import <strong>{parsedRows.filter((r) => r.isValid).length}</strong> validated invoice(s) into your accounting ledger.
            </div>

            <Button
              type="button"
              variant="primary"
              onClick={handleExecuteImport}
              isLoading={isImporting}
              className="bg-indigo-600 hover:bg-indigo-700 text-xs px-5 py-2 shadow-sm"
            >
              <Zap className="h-4 w-4 mr-1.5" />
              Confirm & Import {parsedRows.filter((r) => r.isValid).length} Invoices
            </Button>
          </div>

          {/* Table Preview */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  <tr>
                    <th className="py-3 px-3">#</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Customer</th>
                    <th className="py-3 px-3">Product</th>
                    <th className="py-3 px-3 text-right">Qty</th>
                    <th className="py-3 px-3 text-right">Price</th>
                    <th className="py-3 px-3 text-right">Tax (18%)</th>
                    <th className="py-3 px-3 text-right">Total</th>
                    <th className="py-3 px-3 text-right">Paid</th>
                    <th className="py-3 px-3 text-right">Balance (AR)</th>
                    <th className="py-3 px-3 text-center">Payment Status</th>
                    <th className="py-3 px-3 text-center">FBR Queue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {parsedRows.map((row, idx) => {
                    const isFullyPaid = row.paymentStatus === "PAID";
                    return (
                      <tr key={idx} className="hover:bg-slate-50/60 transition">
                        <td className="py-2.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{row.date}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-900">{row.customerName}</td>
                        <td className="py-2.5 px-3 text-slate-800">{row.productName}</td>
                        <td className="py-2.5 px-3 text-right font-mono">{row.quantity}</td>
                        <td className="py-2.5 px-3 text-right font-mono">Rs {row.unitPrice.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-indigo-600">Rs {row.taxAmount.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">Rs {row.totalAmount.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-600 font-semibold">Rs {row.paidAmount.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-rose-600 font-semibold">Rs {row.remainingAmount.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              row.paymentStatus === "PAID"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : row.paymentStatus === "PARTIAL"
                                ? "bg-amber-50 text-amber-800 border border-amber-300"
                                : "bg-rose-50 text-rose-800 border border-rose-200"
                            }`}
                          >
                            {row.paymentStatus}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {isFullyPaid ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200">
                              <Zap className="h-2.5 w-2.5" /> Ready to Hit
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
                              <Lock className="h-2.5 w-2.5" /> Awaiting Pay
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
