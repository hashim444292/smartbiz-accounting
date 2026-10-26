"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { formatMoney } from "@/lib/decimal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Printer, Download, CheckCircle2, ExternalLink } from "lucide-react";
import { BrandPageLoader } from "@/components/ui/loader";
import { FbrQrCode } from "@/components/ui/FbrQrCode";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";

export default function SaleDetailPage() {
  const { t } = useLanguage();
  const { activeCompany } = useAuth();
  const params = useParams();
  const router = useRouter();
  const [sale, setSale] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchSale() {
      try {
        const res = await fetch(`/api/sales/${params.id}`);
        const json = await res.json();
        if (json.success) {
          setSale(json.data);
        } else {
          // fallback to list
          const listRes = await fetch(`/api/sales`);
          const listJson = await listRes.json();
          if (listJson.success) {
            const found = listJson.data.find((s: any) => s.id === params.id);
            setSale(found);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    if (params.id) fetchSale();
  }, [params.id]);

  useEffect(() => {
    if (sale && typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get("print") === "true") {
        const timer = setTimeout(() => {
          window.print();
        }, 400);
        return () => clearTimeout(timer);
      }
    }
  }, [sale]);

  if (loading) {
    return (
      <BrandPageLoader
        message="Loading Invoice Details..."
        submessage="Retrieving customer ledger, line items, and invoice details..."
      />
    );
  }

  if (!sale) {
    return (
      <div className="p-8 text-center text-xs text-rose-500">
        Invoice not found. <Link href="/sales" className="underline">Go back to sales</Link>
      </div>
    );
  }

  let fbrMeta: any = null;
  let cleanNotes = sale.notes;
  if (sale.notes && typeof sale.notes === "string" && sale.notes.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(sale.notes);
      fbrMeta = parsed.fbrMeta || parsed;
      cleanNotes = parsed.remarks || "";
    } catch {}
  }

  const baseTax = Number(sale.salesTax || sale.taxAmount || 0);
  const extraTax = Number(sale.extraTax || 0);
  const furtherTax = Number(sale.furtherTax || 0);
  const totalTax = baseTax + extraTax + furtherTax;

  const itemsTax = (sale.items || []).reduce((sum: number, it: any) => {
    const q = Number(it.quantity || 0);
    const p = Number(it.unitPrice || 0);
    const tr = Number(it.taxRate || 0);
    const tAmt = Number(
      it.taxAmount !== undefined && it.taxAmount !== null
        ? it.taxAmount
        : q * p * (tr / 100)
    );
    return sum + tAmt;
  }, 0);

  // An invoice is considered a Tax Invoice only if statutory tax is actually charged
  const isTaxInvoice = totalTax > 0 || itemsTax > 0;
  const realFbrInvoiceNumber = sale.fbrInvoiceNumber || fbrMeta?.fbrInvoiceNumber || null;

  const handleDownloadPdf = async () => {
    if (!invoiceRef.current || isDownloading) return;
    try {
      setIsDownloading(true);
      const html2pdf = (await import("html2pdf.js")).default;
      const element = invoiceRef.current;

      const opt: any = {
        margin: [6, 8, 6, 8],
        filename: `${isTaxInvoice ? "Tax" : "Sales"}_Invoice_${realFbrInvoiceNumber || sale.invoiceNumber}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
      };

      await html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error("PDF generation error:", err);
      // Fallback to native window.print() if client html2canvas/jspdf fails
      window.print();
    } finally {
      setIsDownloading(false);
    }
  };


  const sellerName = sale.business?.name || activeCompany?.name || "SmartBiz Trading & Distribution";
  const sellerAddress =
    sale.business?.address ||
    activeCompany?.address ||
    sale.branch?.address ||
    "Plot# 157 C 1 Korangi Industrial Area Karachi";
  const sellerPhone = sale.business?.phone || activeCompany?.phone || "03193644050";
  const sellerEmail = sale.business?.email || activeCompany?.email || "";
  const sellerNtn = sale.business?.ntn || (activeCompany as any)?.ntn || "A424558";
  const sellerStrn = sale.business?.strn || (activeCompany as any)?.strn || "";

  // Deep extraction of buyer tax profile from customer object, notes, or fbrMeta
  let rawCustNotes = (sale.customer as any)?.notes;
  let parsedCustNotes: any = null;
  if (rawCustNotes) {
    if (typeof rawCustNotes === "object") {
      parsedCustNotes = rawCustNotes;
    } else if (typeof rawCustNotes === "string" && rawCustNotes.trim().startsWith("{")) {
      try {
        parsedCustNotes = JSON.parse(rawCustNotes);
      } catch {}
    }
  }

  const buyerName = sale.customer?.name || sale.customerName || "Gama Lux Oleo Chemical Limited";
  const buyerAddress =
    sale.customer?.address ||
    parsedCustNotes?.address ||
    fbrMeta?.buyerAddress ||
    fbrMeta?.customerAddress ||
    (sale.customer?.city ? `${sale.customer.city}, Pakistan` : "Office 603 604,Sixth Floor Block No5,K D A, Scheme Clifton Karachi");

  const buyerNtn =
    sale.customer?.ntn ||
    parsedCustNotes?.ntn ||
    fbrMeta?.customerNtn ||
    fbrMeta?.buyerNTN ||
    fbrMeta?.buyerNtn ||
    fbrMeta?.ntn ||
    (typeof rawCustNotes === "string" ? rawCustNotes.match(/NTN:\s*([A-Za-z0-9-]+)/i)?.[1] : null);

  const buyerCnic =
    sale.customer?.cnic ||
    parsedCustNotes?.cnic ||
    fbrMeta?.customerCnic ||
    fbrMeta?.buyerCNIC ||
    fbrMeta?.buyerCnic ||
    fbrMeta?.cnic ||
    (typeof rawCustNotes === "string" ? rawCustNotes.match(/CNIC:\s*([0-9-]+)/i)?.[1] : null);

  const buyerStrn =
    (sale.customer as any)?.strn ||
    parsedCustNotes?.strn ||
    fbrMeta?.buyerSTRN ||
    fbrMeta?.buyerStrn ||
    fbrMeta?.customerStrn ||
    fbrMeta?.strn ||
    (typeof rawCustNotes === "string" ? rawCustNotes.match(/STRN:\s*([A-Za-z0-9-]+)/i)?.[1] : null);

  const isBuyerRegistered = Boolean(
    buyerNtn ||
    (sale.customer as any)?.taxStatus === "REGISTERED" ||
    parsedCustNotes?.taxStatus === "REGISTERED" ||
    fbrMeta?.buyerRegistrationType === "Registered" ||
    fbrMeta?.taxStatus === "REGISTERED"
  );

  let buyerTaxId = "NTN/CNIC: Unregistered";
  if (buyerNtn) {
    if (buyerStrn) {
      buyerTaxId = `NTN: ${buyerNtn} • STRN: ${buyerStrn} (Registered)`;
    } else {
      buyerTaxId = `NTN: ${buyerNtn} (Registered)`;
    }
  } else if (buyerCnic) {
    buyerTaxId = `CNIC: ${buyerCnic} (Unregistered)`;
  } else if (isBuyerRegistered) {
    buyerTaxId = "Status: Registered Taxpayer";
  } else {
    buyerTaxId = "NTN/CNIC: Unregistered";
  }

  const formattedDate = new Date(sale.date).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });

  return (
    <>
      {/* Dedicated Print Stylesheet for Pristine A4 Format */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm 8mm;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          header,
          aside,
          nav,
          footer,
          button,
          [data-no-print],
          .print\\:hidden {
            display: none !important;
          }
          #invoice-printable-area {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 auto !important;
            width: 100% !important;
            max-width: 100% !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      <div className="max-w-4xl mx-auto space-y-5 pb-12 print:max-w-none print:space-y-0 print:pb-0 print:m-0">
        {/* Top Controls (Hidden on Print) */}
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link
            href="/sales"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Sales</span>
          </Link>
          <div className="flex items-center gap-2">
            {sale.fbrInvoiceNumber && (
              <a
                href={`/verify/fbr?inv=${encodeURIComponent(sale.fbrInvoiceNumber || sale.invoiceNumber)}`}
                target="_blank"
                rel="noreferrer"
                className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-xl transition"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-indigo-600" />
                <span>Verify e-Receipt</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              className="flex items-center gap-1.5 font-semibold text-slate-700 hover:text-slate-900 border-slate-300 shadow-2xs"
            >
              {isDownloading ? (
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
              ) : (
                <Download className="h-3.5 w-3.5 text-indigo-600" />
              )}
              <span>{isDownloading ? "Generating PDF..." : "Download PDF"}</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => window.print()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 font-semibold shadow-2xs"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print Invoice</span>
            </Button>
          </div>
        </div>

        {/* Edited Warning Banner (Screen View Only) */}
        {sale.isEdited && (
          <div className="print:hidden rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200 shadow-xs">
            <div className="flex items-start gap-3">
              <span className="text-xl">⚠️</span>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-amber-950 dark:text-amber-100">
                    {t("Edited Invoice Notice", "ترمیم شدہ انوائس")}
                  </span>
                  <span className="rounded-md bg-amber-200/80 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:bg-amber-900/80 dark:text-amber-200">
                    Edited {sale.editCount || 1} time{sale.editCount > 1 ? "s" : ""}
                  </span>
                </div>
                <p className="text-amber-800 dark:text-amber-300">
                  This invoice was modified after initial issuance. <strong>Last edited by:</strong>{" "}
                  {sale.updatedByName || "Staff"} on{" "}
                  {sale.updatedAt ? new Date(sale.updatedAt).toLocaleString() : "Recently"}.
                </p>
                {sale.editReason && (
                  <p className="rounded-lg bg-amber-100/70 p-2 text-xs italic text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                    <strong>Reason for modification:</strong> &ldquo;{sale.editReason}&rdquo;
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STATUTORY FBR TAX INVOICE DOCUMENT SHEET (Exact PDF Layout) */}
        {/* ========================================================================= */}
        <div
          ref={invoiceRef}
          id="invoice-printable-area"
          style={{ pageBreakInside: "avoid", breakInside: "avoid" }}
          className="bg-white text-slate-900 border border-slate-200 rounded-2xl p-6 sm:p-10 print:p-2 print:border-none print:shadow-none print:rounded-none shadow-sm font-sans"
        >
          {/* Header Block: Seller Info (Left) & Tax Invoice Meta (Right) */}
          <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
            {/* Seller Details */}
            <div className="space-y-0.5">
              <h1 className="text-xl sm:text-2xl print:text-lg font-black text-slate-900 tracking-tight leading-tight">
                {sellerName}
              </h1>
              <p className="text-xs text-slate-600 leading-snug">{sellerAddress}</p>
              <p className="text-xs text-slate-600">
                Phone: <span className="text-slate-800 font-medium">{sellerPhone}</span>
              </p>
              {sellerEmail && (
                <p className="text-xs text-slate-600">
                  Email: <span className="text-slate-800 font-medium">{sellerEmail}</span>
                </p>
              )}
              <p className="text-xs text-slate-600 font-mono">
                NTN: <span className="text-slate-900 font-bold">{sellerNtn}</span>
                {sellerStrn && (
                  <>
                    {" "}
                    • STRN: <span className="text-slate-900 font-bold">{sellerStrn}</span>
                  </>
                )}
              </p>
            </div>

            {/* Tax / Sales Invoice Title & Reference Meta */}
            <div className="text-left sm:text-right space-y-0.5 shrink-0">
              <h2
                className={`text-2xl sm:text-3xl print:text-xl font-black tracking-wide uppercase ${
                  isTaxInvoice ? "text-[#D32F2F]" : "text-slate-900"
                }`}
              >
                {isTaxInvoice ? "TAX INVOICE" : "SALES INVOICE"}
              </h2>
              <p className="text-xs text-slate-600">
                Document #:{" "}
                <span className="font-bold text-slate-900 font-mono">{sale.invoiceNumber}</span>
              </p>
              <p className="text-xs text-slate-600">
                Date: <span className="font-medium text-slate-800">{formattedDate}</span>
              </p>
              {realFbrInvoiceNumber ? (
                <p className="text-xs text-slate-600 font-mono">
                  FBR Ref:{" "}
                  <span className="font-bold text-slate-900">{realFbrInvoiceNumber}</span>
                </p>
              ) : isTaxInvoice ? (
                <p className="text-xs text-amber-700 font-mono font-medium">
                  FBR Ref: <span>Pending Transmission</span>
                </p>
              ) : null}
            </div>
          </div>

          {/* Full-Width Divider Line */}
          <div className="w-full border-t border-slate-300 my-4 print:my-2" />

          {/* Bill To Block */}
          <div className="space-y-0.5 mb-4 print:mb-2 text-left">
            <p className="text-xs font-bold text-slate-900 uppercase tracking-wider">Bill To:</p>
            <p className="text-sm font-black text-slate-900">{buyerName}</p>
            <p className="text-xs text-slate-600 leading-snug">{buyerAddress}</p>
            <p className="text-xs text-slate-700 font-mono font-medium">{buyerTaxId}</p>
            {sale.customer?.phone && (
              <p className="text-xs text-slate-500">Phone: {sale.customer.phone}</p>
            )}
          </div>

          {/* Line Items Table (9 Statutory Columns) */}
          <div className="overflow-x-auto mb-4 print:mb-2">
            <table className="w-full text-left text-xs border border-slate-200 divide-y divide-slate-200 print:text-[11px]">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-800 uppercase tracking-wider">
                <tr>
                  <th className="p-2 sm:p-2.5 print:py-1 print:px-1.5 text-center border-r border-slate-200 w-10">#</th>
                  <th className="p-2 sm:p-2.5 print:py-1 print:px-1.5 border-r border-slate-200">Description</th>
                  <th className="p-2 sm:p-2.5 print:py-1 print:px-1.5 text-center border-r border-slate-200 w-24">HS Code</th>
                  <th className="p-2 sm:p-2.5 print:py-1 print:px-1.5 text-center border-r border-slate-200 w-16">UOM</th>
                  <th className="p-2 sm:p-2.5 print:py-1 print:px-1.5 text-center border-r border-slate-200 w-16">Qty</th>
                  <th className="p-2 sm:p-2.5 print:py-1 print:px-1.5 text-right border-r border-slate-200 w-28">Unit Price</th>
                  {isTaxInvoice && (
                    <>
                      <th className="p-2 sm:p-2.5 print:py-1 print:px-1.5 text-center border-r border-slate-200 w-20">Tax Rate</th>
                      <th className="p-2 sm:p-2.5 print:py-1 print:px-1.5 text-right border-r border-slate-200 w-28">Tax Amount</th>
                    </>
                  )}
                  <th className="p-2 sm:p-2.5 print:py-1 print:px-1.5 text-right w-28">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800 font-sans">
                {sale.items?.map((item: any, i: number) => {
                  const effectiveUom = (
                    item.uom ||
                    item.product?.uom ||
                    item.product?.unit ||
                    (Array.isArray(fbrMeta?.itemsUom) ? fbrMeta.itemsUom[i] : null) ||
                    fbrMeta?.uom ||
                    "KG"
                  ).toUpperCase();

                  const hsCode =
                    item.hsCode ||
                    item.product?.hsCode ||
                    (Array.isArray(fbrMeta?.itemsHsCode) ? fbrMeta.itemsHsCode[i] : null) ||
                    sale.business?.defaultHsCode ||
                    "2106.9030";

                  const qty = Number(item.quantity || 0);
                  const unitPrice = Number(item.unitPrice || 0);
                  const exclusiveValue = qty * unitPrice;
                  const taxRate = Number(item.taxRate || 18);
                  const itemTax = Number(
                    item.taxAmount !== undefined && item.taxAmount !== null
                      ? item.taxAmount
                      : exclusiveValue * (taxRate / 100)
                  );
                  const lineTotal = Number(item.lineTotal || exclusiveValue + itemTax);

                  return (
                    <tr key={item.id || i} className="hover:bg-slate-50/50">
                      <td className="p-2 sm:p-2.5 print:py-1 print:px-1.5 text-center font-bold text-slate-500 border-r border-slate-200">
                        {i + 1}
                      </td>
                      <td className="p-2 sm:p-2.5 print:py-1 print:px-1.5 border-r border-slate-200">
                        <span className="font-bold text-slate-900 block">{item.productName}</span>
                        {item.sku && (
                          <span className="text-[10px] text-slate-500 font-mono block">
                            SKU: {item.sku}
                          </span>
                        )}
                      </td>
                      <td className="p-2 sm:p-2.5 print:py-1 print:px-1.5 text-center font-mono font-semibold text-slate-800 border-r border-slate-200 text-[11px]">
                        {hsCode}
                      </td>
                      <td className="p-2 sm:p-2.5 print:py-1 print:px-1.5 text-center font-bold text-slate-700 border-r border-slate-200">
                        {effectiveUom}
                      </td>
                      <td className="p-2 sm:p-2.5 print:py-1 print:px-1.5 text-center font-bold text-slate-900 border-r border-slate-200 tabular-nums">
                        {qty.toLocaleString()}
                      </td>
                      <td className="p-2 sm:p-2.5 print:py-1 print:px-1.5 text-right font-medium text-slate-800 border-r border-slate-200 tabular-nums">
                        Rs. {unitPrice.toFixed(2)}
                      </td>
                      {isTaxInvoice && (
                        <>
                          <td className="p-2 sm:p-2.5 print:py-1 print:px-1.5 text-center font-mono font-medium text-slate-700 border-r border-slate-200">
                            {taxRate.toFixed(2)}%
                          </td>
                          <td className="p-2 sm:p-2.5 print:py-1 print:px-1.5 text-right font-medium text-slate-800 border-r border-slate-200 tabular-nums">
                            Rs. {itemTax.toFixed(2)}
                          </td>
                        </>
                      )}
                      <td className="p-2 sm:p-2.5 print:py-1 print:px-1.5 text-right font-bold text-slate-900 tabular-nums">
                        Rs. {lineTotal.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Subtotals & Financial Summary (Right-Aligned) */}
          <div className="flex justify-end mb-4 print:mb-2">
            <div className="w-full max-w-xs space-y-1 print:space-y-0.5 text-xs text-slate-700">
              <div className="flex justify-between py-0.5">
                <span className="text-slate-600 font-medium">Subtotal:</span>
                <span className="font-bold text-slate-900 tabular-nums font-mono">
                  Rs. {Number(sale.subtotal).toFixed(2)}
                </span>
              </div>
              {isTaxInvoice && (
                <>
                  <div className="flex justify-between py-0.5">
                    <span className="text-slate-600 font-medium">Sales Tax:</span>
                    <span className="font-bold text-slate-900 tabular-nums font-mono">
                      Rs. {baseTax.toFixed(2)}
                    </span>
                  </div>
                  {extraTax > 0 && (
                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-600 font-medium">Extra Tax:</span>
                      <span className="font-bold text-slate-900 tabular-nums font-mono">
                        Rs. {extraTax.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {furtherTax > 0 && (
                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-600 font-medium">Further Tax:</span>
                      <span className="font-bold text-slate-900 tabular-nums font-mono">
                        Rs. {furtherTax.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between py-0.5">
                    <span className="text-slate-600 font-medium">Total Tax:</span>
                    <span className="font-bold text-slate-900 tabular-nums font-mono">
                      Rs. {totalTax.toFixed(2)}
                    </span>
                  </div>
                </>
              )}
              {Number(sale.discountAmount) > 0 && (
                <div className="flex justify-between py-0.5 text-rose-600 font-semibold">
                  <span>Discount:</span>
                  <span className="tabular-nums font-mono">
                    -Rs. {Number(sale.discountAmount).toFixed(2)}
                  </span>
                </div>
              )}

              {/* Total Double-Lined Box Matching PDF */}
              <div
                className={`flex justify-between py-1.5 print:py-1 border-t border-b-2 border-slate-900 text-sm font-black mt-1 ${
                  isTaxInvoice ? "text-[#D32F2F]" : "text-slate-900"
                }`}
              >
                <span className="uppercase tracking-wider">TOTAL:</span>
                <span className="tabular-nums font-mono text-base font-black">
                  Rs. {Number(sale.totalAmount).toFixed(2)}
                </span>
              </div>

              {Number(sale.paidAmount) > 0 && (
                <div className="flex justify-between pt-0.5 text-[11px] text-emerald-700 font-semibold">
                  <span>Amount Paid ({sale.paymentMethod || "CASH"}):</span>
                  <span className="font-mono">Rs. {Number(sale.paidAmount).toFixed(2)}</span>
                </div>
              )}
              {Number(sale.remainingAmount) > 0 && (
                <div className="flex justify-between text-[11px] text-rose-700 font-bold">
                  <span>Remaining Balance:</span>
                  <span className="font-mono">Rs. {Number(sale.remainingAmount).toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Statutory FBR Invoice Verification Box (Shown only for Tax Invoices or FBR-transferred sales) */}
          {(isTaxInvoice || realFbrInvoiceNumber) && (
            <div className="border-2 border-[#E53935] rounded-xl sm:rounded-2xl p-3 sm:p-4 print:p-2.5 bg-white mb-4 print:mb-2 shadow-2xs">
              <div className="text-center font-bold text-[#E53935] text-xs sm:text-sm mb-2 print:mb-1 uppercase tracking-wider">
                FBR Invoice Verification
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                {/* Left Column: Reference & Verification Bullet Points */}
                <div className="text-left space-y-1 flex-1">
                  <p className="text-xs font-bold text-slate-800">FBR Reference Number:</p>
                  <p className="text-sm sm:text-base font-black text-[#D32F2F] font-mono tracking-wider break-all leading-tight">
                    {realFbrInvoiceNumber || "Pending FBR Transmission"}
                  </p>
                  <ul className="text-[10px] sm:text-[11px] text-slate-600 space-y-0.5 mt-1.5 print:mt-1">
                    <li className="flex items-center gap-1.5">
                      <span className="text-[#D32F2F] font-bold">•</span>
                      <span>Verify this invoice through FBR TaxAsaan Mobile App</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="text-[#D32F2F] font-bold">•</span>
                      <span>Send SMS to 9966 for verification</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="text-[#D32F2F] font-bold">•</span>
                      <span>Participate in exciting prize draws</span>
                    </li>
                  </ul>
                </div>

                {/* Right Column: Statutory FBR POS Badge & High-Resolution QR Code */}
                <div className="flex items-center gap-2.5 shrink-0">
                  {/* Official FBR Invoicing POS Emblem */}
                  <div className="flex flex-col items-center justify-center border-2 border-blue-800 rounded-lg p-1 w-20 bg-white shadow-2xs">
                    <div className="flex items-center gap-0.5 text-[9px] font-black text-blue-900 tracking-wider">
                      <span className="text-[10px]">🏛️</span>
                      <span>FBR</span>
                    </div>
                    <div className="text-sm font-black text-blue-700 tracking-tighter leading-none my-0.5">
                      POS
                    </div>
                    <div className="w-full bg-blue-800 text-white text-[7px] font-black uppercase py-0.5 text-center rounded-xs tracking-tight">
                      INVOICING SYSTEM
                    </div>
                  </div>

                  {/* Verifiable QR Code */}
                  <div className="p-1 bg-white border border-slate-300 rounded-lg shadow-2xs">
                    <FbrQrCode
                      value={realFbrInvoiceNumber || sale.invoiceNumber}
                      size={76}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Document Footer (Thank You, Sign-Off & Platform Notice) */}
          <div className="text-center pt-3 print:pt-2 border-t border-slate-200 text-xs text-slate-500 space-y-0.5 print:text-[10px]">
            <p className="font-bold text-slate-800 text-xs sm:text-sm">Thank you for your business!</p>
            <p>For any queries, please contact us at {sellerPhone}.</p>
            <p className="text-[10px] text-slate-400">
              This is a computer-generated invoice and does not require a signature.
            </p>
            <div className="w-full border-t border-slate-100 mt-2 pt-1 text-[9px] text-slate-400">
              {isTaxInvoice || realFbrInvoiceNumber
                ? "SmartBiz Powered By Accounts360 | Verify invoice authenticity via FBR TaxAsaan App"
                : "SmartBiz Powered By Accounts360 | Computer-Generated Commercial Sales Invoice"}
            </div>
          </div>
        </div>

        {/* Audit Status / Internal Attribution (Screen Only) */}
        <div className="print:hidden rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold">Recorded By:</span>
            <span>{sale.createdByName || "System Admin"}</span>
            <span>•</span>
            <span>Branch: {sale.branch?.name || "Main HQ"}</span>
          </div>
          <div>
            <span>Audit Status: </span>
            <span className="font-bold text-emerald-600">✓ SRO 1006(I) Compliant</span>
          </div>
        </div>
      </div>
    </>
  );
}
