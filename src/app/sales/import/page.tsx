"use client";

import React, { useState, useRef, useEffect } from "react";
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
  Check,
  Zap,
  Lock,
  Layers,
  ShieldCheck,
  Package,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

interface Parsed27Row {
  date: string;
  invoiceNumber?: string;
  scenario: string;
  customerName: string;
  customerNtn?: string;
  customerCnic?: string;
  hsCode: string;
  productName: string;
  productRemarks?: string;
  uom: string;
  quantity: number;
  rate: number;
  taxRate: number;
  taxValue: number;
  extraTax: number;
  extraTaxValue: number;
  exclusiveValue: number;
  discountRate: number;
  discountValue: number;
  discount2Rate: number;
  discount2Value: number;
  advanceIncomeTaxRate: number;
  totalIncomeTax: number;
  totalAmount: number;
  sroSchedule?: string;
  sroItem?: string;
  aboveRemarks?: string;
  isInCatalog: boolean;
  isValid: boolean;
  validationError?: string;
}

// Intelligent date normalizer supporting YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, Excel serial dates, etc.
function normalizeDate(input: any): string {
  if (!input) return new Date().toISOString().slice(0, 10);
  const trimmed = String(input).trim();
  if (!trimmed) return new Date().toISOString().slice(0, 10);

  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // If YYYY/MM/DD
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(trimmed)) {
    const parts = trimmed.split("/");
    return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
  }

  // If DD/MM/YYYY, MM/DD/YYYY, or DD-MM-YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const part1 = parseInt(dmyMatch[1], 10);
    const part2 = parseInt(dmyMatch[2], 10);
    const year = dmyMatch[3];

    // If part1 > 12 -> must be DD/MM/YYYY (part1 is Day, part2 is Month)
    if (part1 > 12 && part2 <= 12) {
      return `${year}-${String(part2).padStart(2, "0")}-${String(part1).padStart(2, "0")}`;
    }
    // If part2 > 12 -> must be MM/DD/YYYY (part1 is Month, part2 is Day)
    if (part2 > 12 && part1 <= 12) {
      return `${year}-${String(part1).padStart(2, "0")}-${String(part2).padStart(2, "0")}`;
    }
    // Ambiguous (e.g. 9/1/2026, 9/2/2026, 9/12/2026) -> In Excel, M/D/YYYY is standard: part1 is Month (9=Sept), part2 is Day
    return `${year}-${String(part1).padStart(2, "0")}-${String(part2).padStart(2, "0")}`;
  }

  // If Excel Serial Number (e.g. 45571)
  if (/^\d{5}$/.test(trimmed)) {
    const serial = parseInt(trimmed, 10);
    const date = new Date((serial - 25569) * 86400 * 1000);
    if (!isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
  }

  // Try standard parse
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  return new Date().toISOString().slice(0, 10);
}

// Format CSV cell: dates and numbers should not be enclosed in quotes so Excel detects native types
function formatCsvCell(val: any): string {
  if (val === null || val === undefined) return "";
  const str = String(val).trim();
  // Don't quote dates or numeric values so Excel detects them as native types
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  if (/^-?\d+(\.\d+)?$/.test(str)) return str;
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export default function BulkSalesImportPage() {
  const router = useRouter();
  const { activeCompany } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isFbrInvoicingOnly = activeCompany?.packageType === "FBR_INVOICING_ONLY";
  const isAccountingOnly = activeCompany?.packageType === "ACCOUNTING_ONLY";

  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [parsedRows, setParsedRows] = useState<Parsed27Row[]>([]);
  const [parsingError, setParsingError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"ALL" | "VALID" | "ERRORS">("ALL");

  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    importedCount: number;
    errorCount?: number;
    message: string;
    errors?: any[];
  } | null>(null);

  // Fetch catalog products to verify inventory
  useEffect(() => {
    fetch("/api/products")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCatalogProducts(data);
        } else if (data?.products && Array.isArray(data.products)) {
          setCatalogProducts(data.products);
        }
      })
      .catch(() => {});
  }, []);

  // Download Sample Template with exact 26 FBR columns (Auto-generated invoices omit Invoice#)
  const downloadSampleTemplate = () => {
    const todayStr = new Date().toISOString().slice(0, 10);

    const headers = [
      "Date",
      "Scenario",
      "Customer Name",
      "Customer NTN",
      "Unregistered CNIC / NTN",
      "HS Code",
      "Product Description",
      "Product Remarks",
      "Uom (FBR)",
      "Quantity",
      "Rate",
      "Tax Rate %",
      "Tax Value",
      "Extra Tax",
      "ExtraTax Value",
      "Exclusive Value",
      "Discount%",
      "Discount Value",
      "Discount2%",
      "Discount Value 2",
      "Advance Income Tax%",
      "Total Income Tax",
      "Total Amount",
      "SRO Schedule#",
      "SRO Item#",
      "Above Remarks",
    ];

    const sampleRows = [
      [
        todayStr,
        "SN001",
        "Al-Madina Traders",
        "1234567-8",
        "",
        "8517.1390",
        "Samsung Galaxy A55",
        "256GB PTA Approved",
        "Numbers",
        "2",
        "85000",
        "18",
        "30600",
        "0",
        "0",
        "170000",
        "0",
        "0",
        "0",
        "0",
        "0.5",
        "850",
        "201450",
        "",
        "",
        "Registered corporate customer invoice",
      ],
      [
        todayStr,
        "SN002",
        "Kashif Electronics",
        "",
        "42101-1234567-1",
        "8517.1390",
        "Infinix Note 40",
        "Fast Charge 45W",
        "Numbers",
        "1",
        "45000",
        "18",
        "8100",
        "0",
        "0",
        "45000",
        "5",
        "2250",
        "0",
        "0",
        "1.0",
        "427.5",
        "51277.5",
        "",
        "",
        "Unregistered retail customer sale with CNIC",
      ],
      [
        todayStr,
        "SN002",
        "Walk-in Customer",
        "",
        "42201-9876543-2",
        "8471.3000",
        "Dell Latitude Laptop",
        "Core i7 16GB RAM",
        "Numbers",
        "1",
        "120000",
        "18",
        "21600",
        "0",
        "0",
        "120000",
        "0",
        "0",
        "0",
        "0",
        "0",
        "0",
        "141600",
        "",
        "",
        "Walk-in counter sale",
      ],
    ];

    // Prepend UTF-8 BOM (\uFEFF) and use CRLF (\r\n) so Microsoft Excel opens cleanly without encoding or date issues
    const csvContent =
      "\uFEFF" +
      headers.join(",") +
      "\r\n" +
      sampleRows.map((r) => r.map(formatCsvCell).join(",")).join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "fbr_bulk_sales_invoices_template.csv");
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
        "Extra Tax",
        "Total Amount",
        "Paid Amount",
        "Balance Receivable",
        "Payment Status",
        "Payment Method",
        "FBR Status",
        "FBR Invoice Number",
      ];

      const rows = json.data.map((inv: any) => [
        inv.invoiceNumber,
        new Date(inv.date).toISOString().slice(0, 10),
        `"${(inv.customerName || "").replace(/"/g, '""')}"`,
        Number(inv.subtotal || 0).toFixed(2),
        Number(inv.salesTax || inv.taxAmount || 0).toFixed(2),
        Number(inv.extraTax || 0).toFixed(2),
        Number(inv.totalAmount || 0).toFixed(2),
        Number(inv.paidAmount || 0).toFixed(2),
        Number(inv.remainingAmount || 0).toFixed(2),
        inv.paymentStatus || "PAID",
        inv.paymentMethod || "CASH",
        inv.fbrStatus || "PENDING",
        inv.fbrInvoiceNumber || "Un-transmitted",
      ]);

      const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r: any[]) => r.join(","))].join("\r\n");
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

  // Intelligent CSV / TSV Parser
  const parseCsvText = (text: string) => {
    const lines = text
      .split(/\r\n|\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      throw new Error("Uploaded file must contain a header row and at least one data row.");
    }

    // Determine delimiter (comma, tab, semicolon)
    const firstLine = lines[0];
    let delimiter = ",";
    if (firstLine.includes("\t") && firstLine.split("\t").length > firstLine.split(",").length) {
      delimiter = "\t";
    } else if (firstLine.includes(";") && firstLine.split(";").length > firstLine.split(",").length) {
      delimiter = ";";
    }

    const parseLine = (line: string) => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const rawHeaders = parseLine(lines[0]);
    const normalizedHeaders = rawHeaders.map((h) =>
      h.toLowerCase().replace(/[^a-z0-9]/g, "")
    );

    const rows: Parsed27Row[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);
      if (values.length < 2) continue;

      const getVal = (possibleKeys: string[]) => {
        for (const k of possibleKeys) {
          const idx = normalizedHeaders.findIndex((h) => h.includes(k));
          if (idx !== -1 && values[idx] !== undefined && values[idx] !== "") {
            return values[idx];
          }
        }
        return "";
      };

      const rawDate = getVal(["date", "invdate", "invoicedate"]);
      const date = normalizeDate(rawDate);
      const invoiceNumber = getVal(["invoicenum", "invoice#", "invoiceno", "inv#", "bill#"]);
      const scenario = getVal(["scenario"]) || "SN001";
      const customerName = getVal(["customername", "customer", "buyername", "buyer"]) || "Walk-in Customer";
      const customerNtn = getVal(["customerntn", "buyerntn", "ntn"]);
      const customerCnic = getVal(["unregisteredcnicntn", "cnic", "buyercnic", "unregistered"]);
      const hsCode = getVal(["hscode", "pctcode", "hs"]) || "8517.1390";
      const productName = getVal(["productdescription", "product", "itemdescription", "itemname", "item"]) || "General Merchandise";
      const productRemarks = getVal(["productremarks", "itemremarks", "itemspec"]);
      const uom = getVal(["uomfbr", "uom", "unit"]) || "Numbers";

      const quantity = Math.max(1, Number(getVal(["quantity", "qty"]) || 1));
      const rate = Number(getVal(["rate", "unitprice", "price"]) || 0);
      const taxRate = Number(getVal(["taxrate", "tax%", "gst%"]) || 18);
      const extraTax = Number(getVal(["extratax%"]) || 0);
      const discountRate = Number(getVal(["discount%", "discountrate"]) || 0);
      const discount2Rate = Number(getVal(["discount2%", "discount2rate"]) || 0);
      const advanceIncomeTaxRate = Number(getVal(["advanceincometax%", "incometax%"]) || 0);

      // Exclusive & Discount calculations
      const rawExclusive = getVal(["exclusivevalue", "subtotal"]);
      const exclusiveValue = rawExclusive !== "" ? Number(rawExclusive) : (quantity * rate);

      const rawDiscount = getVal(["discountvalue", "discount"]);
      const discountValue = rawDiscount !== "" ? Number(rawDiscount) : (exclusiveValue * (discountRate / 100));

      const rawDiscount2 = getVal(["discountvalue2", "discount2"]);
      const discount2Value = rawDiscount2 !== "" ? Number(rawDiscount2) : ((exclusiveValue - discountValue) * (discount2Rate / 100));

      const baseAfterDiscount = Math.max(0, exclusiveValue - discountValue - discount2Value);

      // Tax Calculations
      const rawTaxValue = getVal(["taxvalue", "taxamount", "salestax"]);
      const taxValue = rawTaxValue !== "" ? Number(rawTaxValue) : (baseAfterDiscount * (taxRate / 100));

      const rawExtraTaxVal = getVal(["extrataxvalue", "extrataxamount"]);
      const extraTaxValue = rawExtraTaxVal !== "" ? Number(rawExtraTaxVal) : (baseAfterDiscount * (extraTax / 100));

      const rawAdvanceTaxVal = getVal(["totalincometax", "advanceincometax", "incometax"]);
      const totalIncomeTax = rawAdvanceTaxVal !== "" ? Number(rawAdvanceTaxVal) : (baseAfterDiscount * (advanceIncomeTaxRate / 100));

      const rawTotalAmount = getVal(["totalamount", "total", "billamount"]);
      const totalAmount = rawTotalAmount !== ""
        ? Number(rawTotalAmount)
        : (baseAfterDiscount + taxValue + extraTaxValue + totalIncomeTax);

      const sroSchedule = getVal(["sroschedule", "sroscheduleno"]);
      const sroItem = getVal(["sroitem", "sroitemno"]);
      const aboveRemarks = getVal(["aboveremarks", "remarks", "notes"]);

      // Inventory Catalog Verification
      const pNameLower = productName.toLowerCase().trim();
      const inCatalog = catalogProducts.some(
        (p) =>
          p.name?.toLowerCase().trim() === pNameLower ||
          (p.sku && p.sku.toLowerCase().trim() === pNameLower)
      );

      let isValid = true;
      let validationError: string | undefined = undefined;

      if (rate <= 0) {
        isValid = false;
        validationError = "Unit Rate must be greater than 0.";
      } else if (!productName || productName.trim().length === 0) {
        isValid = false;
        validationError = "Product Description is required.";
      } else if (!isFbrInvoicingOnly && !inCatalog) {
        // Enforce inventory existence for Accounting & Full Suite editions
        isValid = false;
        validationError = `Product "${productName}" not found in Inventory Catalog. Must be registered in inventory before sale.`;
      }

      rows.push({
        date,
        invoiceNumber: invoiceNumber || undefined,
        scenario,
        customerName,
        customerNtn: customerNtn || undefined,
        customerCnic: customerCnic || undefined,
        hsCode,
        productName,
        productRemarks: productRemarks || undefined,
        uom,
        quantity,
        rate,
        taxRate,
        taxValue,
        extraTax,
        extraTaxValue,
        exclusiveValue,
        discountRate,
        discountValue,
        discount2Rate,
        discount2Value,
        advanceIncomeTaxRate,
        totalIncomeTax,
        totalAmount,
        sroSchedule: sroSchedule || undefined,
        sroItem: sroItem || undefined,
        aboveRemarks: aboveRemarks || undefined,
        isInCatalog: inCatalog,
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
        setParsingError(err.message || "Failed to parse spreadsheet file");
        setParsedRows([]);
      }
    };
    reader.readAsText(f);
  };

  // Submit parsed rows to backend
  const handleExecuteImport = async () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) return;

    setIsImporting(true);
    setParsingError(null);

    try {
      const payload = validRows.map((r) => ({
        date: r.date,
        invoiceNumber: r.invoiceNumber,
        scenario: r.scenario,
        customerName: r.customerName,
        customerNtn: r.customerNtn,
        customerCnic: r.customerCnic,
        hsCode: r.hsCode,
        productName: r.productName,
        productRemarks: r.productRemarks,
        uom: r.uom,
        quantity: r.quantity,
        rate: r.rate,
        taxRate: r.taxRate,
        taxValue: r.taxValue,
        extraTax: r.extraTax,
        extraTaxValue: r.extraTaxValue,
        exclusiveValue: r.exclusiveValue,
        discountRate: r.discountRate,
        discountValue: r.discountValue,
        discount2Rate: r.discount2Rate,
        discount2Value: r.discount2Value,
        advanceIncomeTaxRate: r.advanceIncomeTaxRate,
        totalIncomeTax: r.totalIncomeTax,
        totalAmount: r.totalAmount,
        sroSchedule: r.sroSchedule,
        sroItem: r.sroItem,
        aboveRemarks: r.aboveRemarks,
        notes: r.aboveRemarks,
      }));

      const res = await fetch("/api/sales/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoices: payload }),
      });

      const json = await res.json();
      if (!res.ok && !json.success) {
        throw new Error(json.error || json.message || "Failed to import sales invoices");
      }

      setImportResult({
        importedCount: json.importedCount || 0,
        errorCount: json.errorCount || 0,
        message: json.message || `Successfully imported ${json.importedCount} sales invoices.`,
        errors: json.errors,
      });
    } catch (err: any) {
      setParsingError(err.message || "Error importing invoices");
    } finally {
      setIsImporting(false);
    }
  };

  // Totals & KPI metrics
  const validCount = parsedRows.filter((r) => r.isValid).length;
  const errorCount = parsedRows.filter((r) => !r.isValid).length;

  const totalExclusive = parsedRows.reduce((acc, r) => acc + r.exclusiveValue, 0);
  const totalTax = parsedRows.reduce((acc, r) => acc + r.taxValue, 0);
  const totalAdvanceTax = parsedRows.reduce((acc, r) => acc + r.totalIncomeTax, 0);
  const grandTotal = parsedRows.reduce((acc, r) => acc + r.totalAmount, 0);

  const displayedRows =
    activeTab === "ALL"
      ? parsedRows
      : activeTab === "VALID"
      ? parsedRows.filter((r) => r.isValid)
      : parsedRows.filter((r) => !r.isValid);

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
                Bulk Invoicing Engine
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                26 FBR Compliant Columns
              </span>
              <span className="text-slate-300">•</span>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                  isFbrInvoicingOnly
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : "bg-blue-50 text-blue-800 border-blue-200"
                }`}
              >
                {isFbrInvoicingOnly
                  ? "Digital Invoicing (Zero Inventory Check)"
                  : "Accounting & POS (Strict Catalog & Stock Verification)"}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">
              Bulk Upload & Download Sales Invoices
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload spreadsheets with full FBR parameters (Scenario, NTN, CNIC, HS Code, UOM, Tax, Extra Tax, Advance Income Tax, SRO).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={downloadSampleTemplate}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            <span>Download Official Template</span>
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

      {/* Package Rule Banner */}
      <div
        className={`rounded-2xl p-4 border text-xs flex items-start gap-3 ${
          isFbrInvoicingOnly
            ? "bg-amber-50/70 border-amber-200 text-amber-900"
            : "bg-blue-50/70 border-blue-200 text-blue-900"
        }`}
      >
        <Info className="h-5 w-5 shrink-0 mt-0.5 text-indigo-600" />
        <div className="space-y-1">
          <span className="font-bold">
            {isFbrInvoicingOnly
              ? "Simple Digital Invoicing Mode:"
              : "Accounting & POS Enterprise Mode:"}
          </span>
          <p className="leading-relaxed">
            {isFbrInvoicingOnly
              ? "In this edition, stock management is disabled. You can import any products freely without registering them in advance. All invoices are stored and queued for FBR compliance."
              : "In this edition, stock and inventory are fully managed. Every product in the uploaded spreadsheet MUST already exist in your Inventory Catalog (by Name or SKU) to deduct stock and prevent negative discrepancies. Unregistered products will be flagged with an error."}
          </p>
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
                {isFbrInvoicingOnly
                  ? "Invoices have been saved directly to your sales queue, ready for FBR submission and print."
                  : "All imported sales have been registered, stock deducted from inventory, and accounts ledger updated."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            {!isAccountingOnly && (
              <Link
                href="/compliance/fbr"
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 shadow-xs"
              >
                <Zap className="h-3.5 w-3.5" />
                <span>Open FBR Invoicing Queue</span>
              </Link>
            )}
            <Link
              href="/sales"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 shadow-2xs"
            >
              <span>View All Invoices</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Parsing / Validation Error Alert */}
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
          accept=".csv,.tsv,.txt"
          onChange={handleFileUpload}
          className="hidden"
        />

        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 mb-3">
          <UploadCloud className="h-7 w-7" />
        </div>

        <h3 className="text-base font-bold text-slate-900">
          {fileName ? fileName : "Upload CSV / Excel Sales Invoices"}
        </h3>
        <p className="text-xs text-slate-500 max-w-xl mx-auto mt-1">
          Supports official 26 columns: Date, Scenario, Customer Name, NTN, CNIC, HS Code, Product Description, Remarks, UOM, Quantity, Rate, Taxes, Discounts, Advance Tax, and SRO details.
        </p>

        <div className="mt-5 flex items-center justify-center gap-3">
          <Button
            type="button"
            variant="primary"
            onClick={() => fileInputRef.current?.click()}
            className="bg-indigo-600 hover:bg-indigo-700 text-xs px-4 py-2"
          >
            <UploadCloud className="h-4 w-4 mr-1.5" />
            {fileName ? "Choose Another File" : "Browse Spreadsheet File"}
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={downloadSampleTemplate}
            className="text-xs px-3.5 py-2"
          >
            <FileSpreadsheet className="h-4 w-4 mr-1.5 text-emerald-600" />
            Download Sample CSV
          </Button>
        </div>
      </div>

      {/* Preview Section */}
      {parsedRows.length > 0 && (
        <div className="space-y-4">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Total Rows</span>
              <p className="text-xl font-bold font-mono text-slate-900 mt-1">
                {parsedRows.length}
              </p>
              <span className="text-[10px] text-slate-500">In file</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Exclusive Value</span>
              <p className="text-xl font-bold font-mono text-slate-900 mt-1">
                Rs {totalExclusive.toLocaleString()}
              </p>
              <span className="text-[10px] text-slate-500">Excl. Sales Tax</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Sales Tax (GST)</span>
              <p className="text-xl font-bold font-mono text-indigo-600 mt-1">
                Rs {totalTax.toLocaleString()}
              </p>
              <span className="text-[10px] text-indigo-700 font-medium">Standard 18%</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Advance Income Tax</span>
              <p className="text-xl font-bold font-mono text-amber-600 mt-1">
                Rs {totalAdvanceTax.toLocaleString()}
              </p>
              <span className="text-[10px] text-amber-700 font-medium">Sec 236G / 236H</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Grand Total</span>
              <p className="text-xl font-bold font-mono text-emerald-600 mt-1">
                Rs {grandTotal.toLocaleString()}
              </p>
              <span className="text-[10px] text-emerald-700 font-medium">Net Payable</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-200 shadow-2xs">
              <span className="text-[10px] text-indigo-800 font-bold uppercase">Validation Status</span>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-700">
                  {validCount} Valid
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs font-bold text-rose-700">
                  {errorCount} Errors
                </span>
              </div>
              <span className="text-[10px] text-indigo-700 mt-0.5 block">
                {isFbrInvoicingOnly ? "Digital Invoicing Ready" : "Inventory Verified"}
              </span>
            </div>
          </div>

          {/* Action & Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab("ALL")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  activeTab === "ALL"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                All Rows ({parsedRows.length})
              </button>
              <button
                onClick={() => setActiveTab("VALID")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  activeTab === "VALID"
                    ? "bg-emerald-600 text-white"
                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                }`}
              >
                Ready to Import ({validCount})
              </button>
              {errorCount > 0 && (
                <button
                  onClick={() => setActiveTab("ERRORS")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    activeTab === "ERRORS"
                      ? "bg-rose-600 text-white"
                      : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                  }`}
                >
                  Errors ({errorCount})
                </button>
              )}
            </div>

            <Button
              type="button"
              variant="primary"
              onClick={handleExecuteImport}
              isLoading={isImporting}
              disabled={validCount === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-xs px-5 py-2 shadow-sm"
            >
              <Zap className="h-4 w-4 mr-1.5" />
              Confirm & Import {validCount} Valid Invoices
            </Button>
          </div>

          {/* Table Preview */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="overflow-x-auto max-h-[550px] overflow-y-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  <tr>
                    <th className="py-3 px-3">#</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Scenario</th>
                    <th className="py-3 px-3">Customer & NTN/CNIC</th>
                    <th className="py-3 px-3">Product Description</th>
                    <th className="py-3 px-3">HS Code</th>
                    <th className="py-3 px-3">UOM</th>
                    <th className="py-3 px-3 text-right">Qty</th>
                    <th className="py-3 px-3 text-right">Rate</th>
                    <th className="py-3 px-3 text-right">Exclusive</th>
                    <th className="py-3 px-3 text-right">Tax (Val)</th>
                    <th className="py-3 px-3 text-right">Income Tax</th>
                    <th className="py-3 px-3 text-right">Total Amount</th>
                    <th className="py-3 px-3 text-center">Status / Inventory</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {displayedRows.map((row, idx) => {
                    return (
                      <tr
                        key={idx}
                        className={`hover:bg-slate-50/70 transition ${
                          !row.isValid ? "bg-rose-50/40" : ""
                        }`}
                      >
                        <td className="py-2.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{row.date}</td>
                        <td className="py-2.5 px-3">
                          <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                            {row.scenario}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900">{row.customerName}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {row.customerNtn ? `NTN: ${row.customerNtn}` : row.customerCnic ? `CNIC: ${row.customerCnic}` : "Unregistered"}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-slate-800">{row.productName}</div>
                          {row.productRemarks && (
                            <div className="text-[10px] text-slate-400 truncate max-w-xs">
                              {row.productRemarks}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-indigo-700">
                          {row.hsCode}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 text-[11px]">{row.uom}</td>
                        <td className="py-2.5 px-3 text-right font-mono">{row.quantity}</td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          Rs {row.rate.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-900 font-medium">
                          Rs {row.exclusiveValue.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-indigo-600">
                          Rs {row.taxValue.toLocaleString()}
                          <span className="text-[9px] text-slate-400 block font-normal">
                            ({row.taxRate}%)
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-amber-600">
                          Rs {row.totalIncomeTax.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          Rs {row.totalAmount.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {row.isValid ? (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                isFbrInvoicingOnly
                                  ? "bg-amber-50 text-amber-800 border border-amber-200"
                                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              }`}
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              {isFbrInvoicingOnly ? "Digital Invoicing" : "Catalog Verified"}
                            </span>
                          ) : (
                            <span
                              title={row.validationError}
                              className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200 cursor-help"
                            >
                              <AlertTriangle className="h-3 w-3" />
                              {row.validationError?.includes("catalog") ? "Not in Inventory" : "Invalid Data"}
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
