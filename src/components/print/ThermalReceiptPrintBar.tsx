"use client";

import React, { useEffect, useState } from "react";
import { Printer } from "lucide-react";

export type PrintPaperFormat = "A4" | "80mm" | "58mm";

export interface DesktopPrinterInfo {
  name: string;
  displayName?: string;
  isDefault?: boolean;
}

const FORMAT_STORAGE_KEY = "accounts360_print_format";
const PRINTER_STORAGE_KEY = "accounts360_thermal_printer";

export function usePrintSettings() {
  const [printFormat, setPrintFormatState] = useState<PrintPaperFormat>("A4");
  const [selectedPrinter, setSelectedPrinterState] = useState<string>("");
  const [printers, setPrinters] = useState<DesktopPrinterInfo[]>([]);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    try {
      const savedFormat = localStorage.getItem(FORMAT_STORAGE_KEY) as PrintPaperFormat | null;
      if (savedFormat === "A4" || savedFormat === "80mm" || savedFormat === "58mm") {
        setPrintFormatState(savedFormat);
      }
      const savedPrinter = localStorage.getItem(PRINTER_STORAGE_KEY);
      if (savedPrinter) {
        setSelectedPrinterState(savedPrinter);
      }
    } catch {}

    const desktopApi = (window as any).accounts360Desktop;
    if (desktopApi?.isDesktop) {
      setIsDesktop(true);
      desktopApi
        .getPrinters?.()
        .then((list: DesktopPrinterInfo[]) => {
          if (Array.isArray(list)) setPrinters(list);
        })
        .catch(() => {});
    }
  }, []);

  const setPrintFormat = (fmt: PrintPaperFormat) => {
    setPrintFormatState(fmt);
    try {
      localStorage.setItem(FORMAT_STORAGE_KEY, fmt);
    } catch {}
  };

  const setSelectedPrinter = (printerName: string) => {
    setSelectedPrinterState(printerName);
    try {
      localStorage.setItem(PRINTER_STORAGE_KEY, printerName);
    } catch {}
  };

  const triggerPrint = async () => {
    const desktopApi = (window as any).accounts360Desktop;
    if (desktopApi?.isDesktop && printFormat !== "A4" && desktopApi.printThermal) {
      const widthMicrons = printFormat === "58mm" ? 58000 : 80000;
      const res = await desktopApi.printThermal({
        deviceName: selectedPrinter || "",
        widthMicrons,
        silent: Boolean(selectedPrinter),
      });
      if (res?.success) return;
    }
    window.print();
  };

  return {
    printFormat,
    setPrintFormat,
    selectedPrinter,
    setSelectedPrinter,
    printers,
    isDesktop,
    triggerPrint,
  };
}

export function PrintFormatSelector({
  printFormat,
  setPrintFormat,
  selectedPrinter,
  setSelectedPrinter,
  printers,
  isDesktop,
}: {
  printFormat: PrintPaperFormat;
  setPrintFormat: (fmt: PrintPaperFormat) => void;
  selectedPrinter: string;
  setSelectedPrinter: (name: string) => void;
  printers: DesktopPrinterInfo[];
  isDesktop: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-1 shadow-2xs dark:border-slate-700 dark:bg-slate-900">
      <Printer className="h-3.5 w-3.5 text-slate-500 ml-1" />
      <select
        aria-label="Print Paper Size"
        value={printFormat}
        onChange={(e) => setPrintFormat(e.target.value as PrintPaperFormat)}
        className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none dark:text-slate-200 cursor-pointer py-0.5 pr-1"
      >
        <option value="A4">A4 Full Page</option>
        <option value="80mm">80mm Thermal (3&quot;)</option>
        <option value="58mm">58mm Mini Thermal (2&quot;)</option>
      </select>

      {isDesktop && printFormat !== "A4" && printers.length > 0 && (
        <select
          aria-label="Select Thermal Printer"
          value={selectedPrinter}
          onChange={(e) => setSelectedPrinter(e.target.value)}
          className="max-w-[160px] border-l border-slate-200 pl-2 bg-transparent text-[11px] font-medium text-indigo-700 focus:outline-none dark:border-slate-700 dark:text-indigo-300 cursor-pointer py-0.5"
        >
          <option value="">Ask Printer (Dialog)</option>
          {printers.map((p) => (
            <option key={p.name} value={p.name}>
              {p.displayName || p.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

export interface ThermalSlipItem {
  name: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxAmount?: number;
  total: number;
}

export function ThermalReceiptSlip({
  format,
  docTitle,
  docNumber,
  dateStr,
  businessName,
  businessAddress,
  businessPhone,
  businessNtn,
  partyLabel,
  partyName,
  partyPhone,
  items,
  subtotal,
  discount = 0,
  tax = 0,
  totalAmount,
  paidAmount = 0,
  balanceAmount = 0,
  paymentMethod,
  fbrInvoiceNumber,
  notes,
}: {
  format: "80mm" | "58mm";
  docTitle: string;
  docNumber: string;
  dateStr: string;
  businessName: string;
  businessAddress?: string;
  businessPhone?: string;
  businessNtn?: string;
  partyLabel: string;
  partyName: string;
  partyPhone?: string;
  items: ThermalSlipItem[];
  subtotal: number;
  discount?: number;
  tax?: number;
  totalAmount: number;
  paidAmount?: number;
  balanceAmount?: number;
  paymentMethod?: string;
  fbrInvoiceNumber?: string | null;
  notes?: string | null;
}) {
  const widthCss = format === "58mm" ? "58mm" : "80mm";
  const fontSizeClass = format === "58mm" ? "text-[10px]" : "text-[11px]";

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: ${widthCss} auto;
            margin: 2mm;
          }
          body {
            background: #ffffff !important;
          }
        }
      `}</style>
      <div
        className={`mx-auto bg-white text-black font-mono ${fontSizeClass} leading-tight p-3 border border-dashed border-slate-300 shadow-sm print:border-0 print:shadow-none print:p-0 print:m-0`}
        style={{ width: widthCss, maxWidth: "100%" }}
      >
        {/* Business Header */}
        <div className="text-center border-b border-dashed border-black pb-2 mb-2">
          <div className="font-bold text-sm uppercase tracking-wide">{businessName}</div>
          {businessAddress && <div className="text-[10px] mt-0.5">{businessAddress}</div>}
          {businessPhone && <div className="text-[10px]">Tel: {businessPhone}</div>}
          {businessNtn && <div className="text-[10px]">NTN: {businessNtn}</div>}
          <div className="mt-1.5 inline-block border border-black px-2 py-0.5 font-bold uppercase text-[10px]">
            {docTitle}
          </div>
        </div>

        {/* Meta Info */}
        <div className="space-y-0.5 border-b border-dashed border-black pb-2 mb-2">
          <div className="flex justify-between">
            <span className="font-bold">No:</span>
            <span className="font-bold">{docNumber}</span>
          </div>
          <div className="flex justify-between">
            <span>Date:</span>
            <span>{dateStr}</span>
          </div>
          <div className="flex justify-between">
            <span>{partyLabel}:</span>
            <span className="font-bold text-right truncate max-w-[60%]">{partyName}</span>
          </div>
          {partyPhone && (
            <div className="flex justify-between">
              <span>Phone:</span>
              <span>{partyPhone}</span>
            </div>
          )}
          {paymentMethod && (
            <div className="flex justify-between">
              <span>Mode:</span>
              <span>{paymentMethod}</span>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="border-b border-dashed border-black pb-1.5 mb-2">
          <div className="flex justify-between font-bold border-b border-black pb-1 mb-1">
            <span className="w-[46%]">Item</span>
            <span className="w-[14%] text-right">Qty</span>
            <span className="w-[18%] text-right">Rate</span>
            <span className="w-[22%] text-right">Amt</span>
          </div>
          <div className="space-y-1">
            {items.map((item, idx) => (
              <div key={idx} className="flex justify-between items-start gap-1">
                <span className="w-[46%] break-words">{item.name}</span>
                <span className="w-[14%] text-right">{item.quantity}</span>
                <span className="w-[18%] text-right">{Math.round(item.unitPrice).toLocaleString()}</span>
                <span className="w-[22%] text-right font-bold">{Math.round(item.total).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="space-y-0.5 border-b border-dashed border-black pb-2 mb-2">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>Rs {Math.round(subtotal).toLocaleString()}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between">
              <span>Discount:</span>
              <span>-Rs {Math.round(discount).toLocaleString()}</span>
            </div>
          )}
          {tax > 0 && (
            <div className="flex justify-between">
              <span>Tax / GST:</span>
              <span>Rs {Math.round(tax).toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-xs border-t border-black pt-1 mt-1">
            <span>NET TOTAL:</span>
            <span>Rs {Math.round(totalAmount).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Paid:</span>
            <span>Rs {Math.round(paidAmount).toLocaleString()}</span>
          </div>
          {balanceAmount > 0 && (
            <div className="flex justify-between font-bold">
              <span>Balance Due:</span>
              <span>Rs {Math.round(balanceAmount).toLocaleString()}</span>
            </div>
          )}
        </div>

        {fbrInvoiceNumber && (
          <div className="text-center border-b border-dashed border-black pb-2 mb-2">
            <div className="font-bold text-[10px]">FBR Invoice #</div>
            <div className="font-bold text-[10px] break-all">{fbrInvoiceNumber}</div>
          </div>
        )}

        {notes && (
          <div className="text-[10px] border-b border-dashed border-black pb-1.5 mb-1.5">
            Note: {notes}
          </div>
        )}

        <div className="text-center text-[10px] pt-1">
          <div className="font-bold">Thank You for Your Business!</div>
          <div className="text-[9px] mt-0.5">Powered by Accounts360</div>
        </div>
      </div>
    </>
  );
}
