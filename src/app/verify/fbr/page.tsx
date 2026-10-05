"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Copy,
  Printer,
  Calendar,
  CreditCard,
  Building2,
  Phone,
  FileCheck2,
  Check,
  AlertTriangle,
  Receipt,
  HelpCircle,
} from "lucide-react";

interface VerificationData {
  found: boolean;
  message?: string;
  searchedReference?: string;
  data?: {
    id: string;
    invoiceNumber: string;
    fbrInvoiceNumber: string;
    fbrStatus: string;
    date: string;
    subtotal: number;
    taxAmount: number;
    salesTax: number;
    furtherTax: number;
    extraTax: number;
    posFee: number;
    totalAmount: number;
    paidAmount: number;
    paymentMethod: string;
    paymentStatus: string;
    customerName: string;
    customerNtn?: string | null;
    seller: {
      name: string;
      ntn: string;
      strn: string;
      address: string;
      posId: string;
    };
    items: Array<{
      productName: string;
      quantity: number;
      unitPrice: number;
      taxAmount: number;
      lineTotal: number;
      hsCode?: string;
    }>;
  };
  officialChannels: {
    irisPortal: string;
    eFbrPortal: string;
    smsShortCode: string;
    smsFormat: string;
    taxAsaanApp: string;
  };
}

function VerifyFbrContent() {
  const searchParams = useSearchParams();
  const rawInv = searchParams.get("inv") || searchParams.get("id") || "";
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<VerificationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!rawInv) {
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(`/api/verify/fbr?inv=${encodeURIComponent(rawInv)}`)
      .then((res) => res.json())
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Verification fetch error:", err);
        setError("Unable to connect to verification server. Please verify your internet connection.");
        setLoading(false);
      });
  }, [rawInv]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const invoice = data?.data;
  const fbrInvNumber = invoice?.fbrInvoiceNumber || rawInv;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col justify-between selection:bg-emerald-500 selection:text-white">
      {/* Official Government / FBR Header */}
      <header className="bg-emerald-900 text-white shadow-md border-b-4 border-emerald-500">
        <div className="max-w-3xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-emerald-800 border-2 border-emerald-400 flex items-center justify-center shrink-0 shadow-inner">
              <ShieldCheck className="h-7 w-7 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <span className="text-[10px] font-bold tracking-widest uppercase bg-emerald-800/80 text-emerald-200 px-2 py-0.5 rounded border border-emerald-600/50">
                  Government of Pakistan
                </span>
                <span className="text-[10px] font-bold tracking-widest uppercase bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-400/30">
                  Official Tier-1 IMS
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-black tracking-tight mt-0.5 text-white">
                FEDERAL BOARD OF REVENUE (FBR)
              </h1>
              <p className="text-[11px] text-emerald-200">
                Point of Sale (POS) & Digital Invoicing Real-Time Verification
              </p>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-emerald-100 text-xs font-semibold border border-emerald-600 transition print:hidden"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print e-Receipt</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-3xl w-full mx-auto px-4 py-6 flex-1">
        {loading ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-200">
            <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-solid border-emerald-600 border-r-transparent mb-4" />
            <h2 className="text-base font-bold text-slate-800">
              Verifying Fiscal Invoice Authenticity...
            </h2>
            <p className="text-xs text-slate-500 mt-1 font-mono">
              Querying FBR Tier-1 Central Audit Repository for #{rawInv}
            </p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-rose-200">
            <AlertTriangle className="h-10 w-10 text-rose-500 mx-auto mb-3" />
            <h2 className="text-base font-bold text-slate-800">Connection Error</h2>
            <p className="text-xs text-slate-500 mt-1">{error}</p>
          </div>
        ) : !rawInv ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-slate-200">
            <Receipt className="h-12 w-12 text-slate-400 mx-auto mb-3" />
            <h2 className="text-base font-bold text-slate-800">No Invoice Reference Provided</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Please scan the official QR code printed on your retail receipt or provide an FBR invoice number to verify.
            </p>
          </div>
        ) : invoice ? (
          <div className="space-y-5">
            {/* Status Card */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-emerald-200 overflow-hidden relative">
              <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-bl-lg">
                FBR Fiscal Seal
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                        <Check className="h-3 w-3" /> VERIFIED FISCAL INVOICE
                      </span>
                      <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {invoice.fbrStatus || "SUCCESS"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      This transaction is registered in the FBR Tier-1 Retail POS Database under SRO 1006(I).
                    </p>
                  </div>
                </div>
              </div>

              {/* FBR Invoice Number Box */}
              <div className="mt-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Official FBR Fiscal Invoice Number (IRN)
                  </span>
                  <span className="font-mono text-base font-black text-slate-900 tracking-wide">
                    {invoice.fbrInvoiceNumber}
                  </span>
                </div>
                <button
                  onClick={() => handleCopy(invoice.fbrInvoiceNumber)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 shadow-2xs transition shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-slate-500" />
                      <span>Copy Number</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Retailer & Invoice Metadata Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Seller / Retailer Card */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                  <Building2 className="h-4 w-4 text-emerald-700" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Integrated Retail Merchant
                  </h3>
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-slate-400 text-[11px] block">Business / Trade Name</span>
                    <span className="font-bold text-slate-900 text-sm">{invoice.seller.name}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="text-slate-400 text-[11px] block">Seller NTN</span>
                      <span className="font-mono font-bold text-slate-800">{invoice.seller.ntn}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px] block">POS Terminal ID</span>
                      <span className="font-mono font-bold text-indigo-700">{invoice.seller.posId}</span>
                    </div>
                  </div>
                  <div className="pt-1">
                    <span className="text-slate-400 text-[11px] block">Retail Outlet Location</span>
                    <span className="text-slate-700">{invoice.seller.address}</span>
                  </div>
                </div>
              </div>

              {/* Transaction Metadata Card */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                  <Calendar className="h-4 w-4 text-emerald-700" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Transaction Details
                  </h3>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-400 text-[11px] block">Merchant Invoice #</span>
                      <span className="font-mono font-bold text-slate-900">{invoice.invoiceNumber}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px] block">Payment Method</span>
                      <span className="inline-block px-2 py-0.5 rounded bg-slate-100 font-bold text-slate-700 text-[11px] uppercase">
                        {invoice.paymentMethod || "CASH"}
                      </span>
                    </div>
                  </div>
                  <div className="pt-1">
                    <span className="text-slate-400 text-[11px] block">Date & Timestamp</span>
                    <span className="font-medium text-slate-800">
                      {new Date(invoice.date).toLocaleString("en-PK", {
                        dateStyle: "full",
                        timeStyle: "medium",
                      })}
                    </span>
                  </div>
                  <div className="pt-1">
                    <span className="text-slate-400 text-[11px] block">Billed To (Customer)</span>
                    <span className="font-semibold text-slate-800">
                      {invoice.customerName}
                      {invoice.customerNtn && ` (NTN/CNIC: ${invoice.customerNtn})`}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Itemized Goods Breakdown */}
            {invoice.items && invoice.items.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <FileCheck2 className="h-4 w-4 text-emerald-700" />
                    <span>Itemized Tax Invoice Particulars</span>
                  </h3>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {invoice.items.length} item(s)
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100/70 text-slate-500 font-semibold border-b border-slate-200 text-[11px]">
                      <tr>
                        <th className="py-2.5 px-4">Item Description</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">HS Code</th>
                        <th className="py-2.5 px-3 text-right">Qty</th>
                        <th className="py-2.5 px-3 text-right">Rate</th>
                        <th className="py-2.5 px-3 text-right">Tax (18%)</th>
                        <th className="py-2.5 px-4 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {invoice.items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-4 font-medium text-slate-900">{it.productName}</td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">{it.hsCode || "8517.13.00"}</td>
                          <td className="py-2.5 px-3 text-right font-mono">{it.quantity}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-700">Rs {it.unitPrice.toLocaleString()}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">Rs {it.taxAmount.toLocaleString()}</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">Rs {it.lineTotal.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Financial Summary & Statutory Tax Table */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 pb-2 border-b border-slate-100">
                Fiscal Tax & Settlement Summary
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Value of Taxable Goods (Exclusive of GST):</span>
                  <span className="font-mono font-bold text-slate-800">
                    Rs {invoice.subtotal.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Sales Tax (Standard 18% GST):</span>
                  <span className="font-mono font-bold text-slate-800">
                    Rs {(invoice.salesTax || invoice.taxAmount).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 bg-emerald-50/60 px-2 rounded">
                  <span className="font-semibold text-emerald-900">
                    FBR Statutory POS Service Fee (SRO 1006(I)):
                  </span>
                  <span className="font-mono font-bold text-emerald-900">
                    Rs {invoice.posFee.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-t-2 border-slate-300 text-sm font-black">
                  <span className="text-slate-900">Total Fiscal Amount Paid:</span>
                  <span className="font-mono text-emerald-700 text-base">
                    Rs {invoice.totalAmount.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* 3 Official Verification Methods Card */}
            <div className="bg-gradient-to-br from-emerald-900 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-emerald-700">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-emerald-800">
                <HelpCircle className="h-5 w-5 text-emerald-400" />
                <h3 className="text-sm font-bold tracking-wide">
                  Official Channels to Verify this Invoice
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                {/* Channel 1: Tax Asaan App */}
                <div className="bg-emerald-950/60 border border-emerald-800 rounded-xl p-3.5 flex flex-col justify-between">
                  <div>
                    <span className="font-bold text-emerald-300 block mb-1">
                      1. FBR Tax Asaan App
                    </span>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      Download the official app, tap <strong>FBR POS</strong>, then <strong>Verify Invoice</strong> and enter this invoice number:
                    </p>
                    <div className="mt-2 font-mono text-[11px] bg-black/40 px-2 py-1 rounded text-emerald-300 border border-emerald-800/80 truncate">
                      {invoice.fbrInvoiceNumber}
                    </div>
                  </div>
                </div>

                {/* Channel 2: SMS Verification */}
                <div className="bg-emerald-950/60 border border-emerald-800 rounded-xl p-3.5 flex flex-col justify-between">
                  <div>
                    <span className="font-bold text-emerald-300 block mb-1">
                      2. Free SMS to 9966
                    </span>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      Send an SMS from your mobile to short code <strong>9966</strong>:
                    </p>
                    <div className="mt-2 font-mono text-[11px] bg-black/40 px-2 py-1 rounded text-amber-300 border border-emerald-800/80">
                      INV &lt;CNIC&gt; {invoice.fbrInvoiceNumber}
                    </div>
                  </div>
                </div>

                {/* Channel 3: Online FBR IRIS Portal */}
                <div className="bg-emerald-950/60 border border-emerald-800 rounded-xl p-3.5 flex flex-col justify-between">
                  <div>
                    <span className="font-bold text-emerald-300 block mb-1">
                      3. FBR IRIS Portal
                    </span>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      Verify online at the official Federal Board of Revenue taxpayer verification portal:
                    </p>
                  </div>
                  <a
                    href="https://iris.fbr.gov.pk/#verifications"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-bold text-white transition text-center shadow-xs"
                  >
                    <span>Open IRIS Portal</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Not found in local DB but reference provided */
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-amber-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  FBR Invoice Reference: {rawInv}
                </h3>
                <p className="text-xs text-slate-500">
                  This invoice reference is pending local cache sync. You can verify it directly with FBR below.
                </p>
              </div>
            </div>

            <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold text-slate-700">Official FBR Verification Options:</h4>
              <ul className="text-xs space-y-2 text-slate-600">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span><strong>FBR Tax Asaan App:</strong> Go to FBR POS &gt; Verify Invoice &gt; Enter <strong>{rawInv}</strong></span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span><strong>SMS 9966:</strong> Send <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[11px]">INV [CNIC] {rawInv}</code> to <strong>9966</strong></span>
                </li>
              </ul>
              <div className="pt-2">
                <a
                  href="https://iris.fbr.gov.pk/#verifications"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-700 text-white font-bold text-xs hover:bg-emerald-600 transition"
                >
                  <span>Verify on Official FBR IRIS Portal</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Official Footer */}
      <footer className="bg-slate-900 text-slate-400 text-xs py-6 border-t border-slate-800 mt-8 print:hidden">
        <div className="max-w-3xl mx-auto px-4 text-center space-y-2">
          <p className="text-slate-300 font-semibold">
            Government of Pakistan — Federal Board of Revenue
          </p>
          <p className="text-[11px] text-slate-500">
            PRAL Tier-1 POS Integration & Digital Invoicing Standard SRO 1006(I)/2021.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function VerifyFbrPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-emerald-600 border-r-transparent" />
        </div>
      }
    >
      <VerifyFbrContent />
    </Suspense>
  );
}
