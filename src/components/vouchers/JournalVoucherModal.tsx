"use client";

import React from "react";
import { Modal } from "@/components/ui/modal";
import { Printer, Download, CheckCircle2, Building2, Calendar, FileText, ArrowRightLeft } from "lucide-react";
import { formatMoney } from "@/lib/decimal";
import { numberToWords } from "@/lib/numberToWords";

export interface JournalVoucherLine {
  id?: string;
  accountId?: string;
  accountCode?: string;
  accountName?: string;
  account?: {
    code?: string;
    name?: string;
  };
  debit: number;
  credit: number;
  description?: string;
}

export interface JournalVoucherData {
  id?: string;
  entryNumber: string;
  date: string | Date;
  referenceType?: string;
  referenceId?: string;
  referenceNumber?: string;
  description: string;
  depositorName?: string;
  fromAccountName?: string;
  toAccountName?: string;
  isBalanced?: boolean;
  status?: string;
  lines?: JournalVoucherLine[];
}

export interface JournalVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  voucher: JournalVoucherData | null;
  company?: {
    name?: string;
    legalName?: string;
    address?: string;
    phone?: string;
    email?: string;
    ntn?: string;
    strn?: string;
  } | null;
}

export function JournalVoucherModal({ isOpen, onClose, voucher, company }: JournalVoucherModalProps) {
  if (!voucher) return null;

  const voucherLines = voucher.lines || [];
  const totalDebit = voucherLines.reduce((acc, l) => acc + Number(l.debit || 0), 0);
  const totalCredit = voucherLines.reduce((acc, l) => acc + Number(l.credit || 0), 0);
  const balanceDiff = Math.round(Math.abs(totalDebit - totalCredit) * 100) / 100;
  const isVoucherBalanced = balanceDiff < 0.01 && voucherLines.length > 0;
  const isContra = voucher.referenceType === "CONTRA" || voucher.referenceType === "CASH_DEPOSIT" || voucher.referenceType === "TRANSFER";
  const voucherTitle = isContra ? "CONTRA VOUCHER (کاؤنٹرا واؤچر)" : "JOURNAL VOUCHER (جرنل واؤچر)";
  const voucherSubTitle = isContra ? "Cash & Bank Contra Transaction / نقد و بینک منتقلی" : "General Journal Entry / روزنامچہ اندراج";

  const companyName = company?.legalName || company?.name || "SmartBiz Business";
  const formattedDate = new Date(voucher.date).toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to print the journal voucher.");
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${voucher.entryNumber} - ${voucherTitle}</title>
          <meta charset="utf-8" />
          <style>
            @page {
              size: A4 portrait;
              margin: 15mm;
            }
            body {
              font-family: Arial, sans-serif;
              color: #1e293b;
              margin: 0;
              padding: 0;
              font-size: 12px;
              line-height: 1.4;
            }
            .voucher-container {
              border: 2px solid #0f172a;
              border-radius: 6px;
              padding: 20px;
              box-sizing: border-box;
            }
            .header-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 15px;
            }
            .company-name {
              font-size: 20px;
              font-weight: 800;
              color: #0f172a;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .company-meta {
              font-size: 10.5px;
              color: #475569;
              margin-top: 3px;
            }
            .voucher-title-badge {
              text-align: right;
            }
            .badge-title {
              display: inline-block;
              background-color: #0f172a;
              color: #ffffff;
              font-weight: 800;
              font-size: 14px;
              padding: 6px 14px;
              border-radius: 4px;
              letter-spacing: 0.5px;
            }
            .badge-sub {
              font-size: 10px;
              color: #64748b;
              margin-top: 4px;
              font-weight: 600;
            }
            .meta-box {
              width: 100%;
              border: 1px solid #cbd5e1;
              border-collapse: collapse;
              margin-bottom: 15px;
              background-color: #f8fafc;
            }
            .meta-box td {
              padding: 8px 10px;
              font-size: 11px;
              border: 1px solid #e2e8f0;
            }
            .meta-label {
              font-weight: 700;
              color: #475569;
              width: 15%;
            }
            .meta-val {
              font-weight: 600;
              color: #0f172a;
              width: 35%;
            }
            .narration-box {
              border: 1px solid #cbd5e1;
              background-color: #ffffff;
              padding: 10px 12px;
              border-radius: 4px;
              margin-bottom: 15px;
            }
            .narration-label {
              font-size: 10px;
              font-weight: 800;
              color: #475569;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 4px;
            }
            .narration-text {
              font-size: 12px;
              font-weight: 600;
              color: #0f172a;
            }
            .ledger-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 15px;
            }
            .ledger-table th {
              background-color: #0f172a;
              color: #ffffff;
              font-size: 10.5px;
              font-weight: 700;
              text-transform: uppercase;
              padding: 8px 10px;
              border: 1px solid #0f172a;
            }
            .ledger-table td {
              border: 1px solid #cbd5e1;
              padding: 8px 10px;
              font-size: 11.5px;
            }
            .ledger-table .account-code {
              font-family: monospace;
              font-weight: 700;
              color: #2563eb;
            }
            .ledger-table .account-name {
              font-weight: 700;
              color: #0f172a;
            }
            .ledger-table .line-desc {
              font-size: 10px;
              color: #64748b;
              margin-top: 2px;
            }
            .ledger-table .num-cell {
              text-align: right;
              font-family: monospace;
              font-weight: 700;
              font-size: 12px;
            }
            .totals-row td {
              background-color: #f1f5f9;
              font-weight: 800;
              font-size: 12px;
              border-top: 2px solid #0f172a;
              border-bottom: 2px solid #0f172a;
            }
            .words-box {
              border-left: 3px solid #2563eb;
              background-color: #eff6ff;
              padding: 8px 12px;
              border-radius: 2px;
              margin-bottom: 30px;
              font-size: 11.5px;
            }
            .words-label {
              font-weight: 800;
              color: #1e40af;
              margin-right: 6px;
            }
            .words-text {
              font-weight: 600;
              color: #1e3a8a;
              font-style: italic;
            }
            .sign-grid {
              display: table;
              width: 100%;
              margin-top: 40px;
            }
            .sign-cell {
              display: table-cell;
              width: 25%;
              text-align: center;
              padding: 0 10px;
            }
            .sign-line {
              border-top: 1.5px dashed #64748b;
              margin-bottom: 6px;
            }
            .sign-title {
              font-weight: 700;
              font-size: 10.5px;
              color: #1e293b;
            }
            .sign-sub {
              font-size: 9px;
              color: #64748b;
            }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="voucher-container">
            <table class="header-table">
              <tr>
                <td style="vertical-align: top;">
                  <div class="company-name">${companyName}</div>
                  <div class="company-meta">
                    ${company?.address ? `${company.address} • ` : ""}
                    ${company?.phone ? `Tel: ${company.phone} • ` : ""}
                    ${company?.ntn ? `NTN: ${company.ntn} ` : ""}
                    ${company?.strn ? `• STRN: ${company.strn}` : ""}
                  </div>
                </td>
                <td class="voucher-title-badge" style="vertical-align: top;">
                  <div class="badge-title">${isContra ? "CONTRA VOUCHER" : "JOURNAL VOUCHER"}</div>
                  <div class="badge-sub">${voucherSubTitle}</div>
                </td>
              </tr>
            </table>

            <table class="meta-box">
              <tr>
                <td class="meta-label">Voucher No:</td>
                <td class="meta-val" style="font-family: monospace; font-size: 12px; color: #2563eb;">${voucher.entryNumber}</td>
                <td class="meta-label">Voucher Date:</td>
                <td class="meta-val">${formattedDate}</td>
              </tr>
              <tr>
                <td class="meta-label">Ref / Slip #:</td>
                <td class="meta-val">${voucher.referenceNumber || voucher.referenceId || "—"}</td>
                <td class="meta-label">Status:</td>
                <td class="meta-val" style="color: ${isVoucherBalanced ? '#16a34a' : '#e11d48'}; font-weight: 700;">● ${isVoucherBalanced ? 'POSTED (Balanced)' : `UNBALANCED (Diff: Rs. ${balanceDiff.toLocaleString()})`}</td>
              </tr>
              ${
                voucher.depositorName
                  ? `<tr>
                      <td class="meta-label">Deposited By:</td>
                      <td class="meta-val" colspan="3">${voucher.depositorName}</td>
                    </tr>`
                  : ""
              }
            </table>

            <div class="narration-box">
              <div class="narration-label">Narration / Transaction Description (تفصیل):</div>
              <div class="narration-text">${voucher.description}</div>
            </div>

            <table class="ledger-table">
              <thead>
                <tr>
                  <th style="width: 15%;">Account Code</th>
                  <th style="width: 35%;">Account Title</th>
                  <th style="width: 26%;">Particulars</th>
                  <th style="width: 12%; text-align: right;">Debit (Rs.)</th>
                  <th style="width: 12%; text-align: right;">Credit (Rs.)</th>
                </tr>
              </thead>
              <tbody>
                ${voucherLines
                  .map((l) => {
                    const code = l.account?.code || l.accountCode || "—";
                    const name = l.account?.name || l.accountName || "Account";
                    return `
                    <tr>
                      <td class="account-code">${code}</td>
                      <td>
                        <div class="account-name">${name}</div>
                      </td>
                      <td>
                        <div class="line-desc">${l.description || "—"}</div>
                      </td>
                      <td class="num-cell">${Number(l.debit) > 0 ? Number(l.debit).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—"}</td>
                      <td class="num-cell">${Number(l.credit) > 0 ? Number(l.credit).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—"}</td>
                    </tr>
                  `;
                  })
                  .join("")}
                <tr class="totals-row">
                  <td colspan="3" style="text-align: right; padding-right: 15px;">TOTAL (میزان):</td>
                  <td class="num-cell">${totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td class="num-cell">${totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>

            <div class="words-box">
              <span class="words-label">Amount in Words:</span>
              <span class="words-text">${numberToWords(totalDebit > 0 ? totalDebit : totalCredit)}</span>
            </div>

            <div class="sign-grid">
              <div class="sign-cell">
                <div class="sign-line"></div>
                <div class="sign-title">Prepared By</div>
                <div class="sign-sub">تیار کنندہ</div>
              </div>
              <div class="sign-cell">
                <div class="sign-line"></div>
                <div class="sign-title">Checked / Verified By</div>
                <div class="sign-sub">پڑتال کنندہ</div>
              </div>
              <div class="sign-cell">
                <div class="sign-line"></div>
                <div class="sign-title">Approved By</div>
                <div class="sign-sub">منظور کنندہ</div>
              </div>
              <div class="sign-cell">
                <div class="sign-line"></div>
                <div class="sign-title">Deposited / Received By</div>
                <div class="sign-sub">بینک جمع کنندہ / وصول کنندہ</div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 300);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={voucherTitle} maxWidth="2xl">
      <div className="space-y-4 text-xs">
        {/* Top Action Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              {isContra ? <ArrowRightLeft className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
            </span>
            <div>
              <div className="font-mono font-bold text-sm text-blue-600 dark:text-blue-400">
                {voucher.entryNumber}
              </div>
              <div className="text-[11px] text-slate-400">{voucherSubTitle}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 font-bold text-white shadow-sm hover:bg-blue-700 transition"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print Voucher</span>
            </button>
          </div>
        </div>

        {/* Voucher Metadata Card */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/60">
          <div>
            <div className="text-[10px] font-bold uppercase text-slate-400">Date (تاریخ)</div>
            <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{formattedDate}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase text-slate-400">Ref / Slip # (سلپ نمبر)</div>
            <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 font-mono">
              {voucher.referenceNumber || voucher.referenceId || "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase text-slate-400">Type (قسم)</div>
            <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                <CheckCircle2 className="h-3 w-3" />
                {isContra ? "CONTRA" : "GENERAL"}
              </span>
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase text-slate-400">Status (حیثیت)</div>
            {isVoucherBalanced ? (
              <div className="font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5 font-bold">
                ● POSTED (Balanced)
              </div>
            ) : (
              <div className="font-semibold text-rose-600 dark:text-rose-400 mt-0.5 font-bold flex items-center gap-1">
                <span>⚠️ UNBALANCED</span>
                <span className="text-[10px] font-mono">({formatMoney(balanceDiff)})</span>
              </div>
            )}
          </div>
        </div>

        {/* Narration Box */}
        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 dark:border-blue-900/40 dark:bg-blue-950/20">
          <div className="text-[10px] font-bold uppercase text-blue-700 dark:text-blue-400 mb-1">
            Narration / Description (تفصیل):
          </div>
          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">
            {voucher.description}
          </div>
        </div>

        {/* Accounting Lines Table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/60">
              <tr>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Account Title</th>
                <th className="px-3 py-2">Line Memo</th>
                <th className="px-3 py-2 text-right">Debit (Rs)</th>
                <th className="px-3 py-2 text-right">Credit (Rs)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {voucherLines.map((line, idx) => {
                const code = line.account?.code || line.accountCode || "—";
                const name = line.account?.name || line.accountName || "Account";
                return (
                  <tr key={line.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="px-3 py-2 font-mono font-bold text-blue-600 dark:text-blue-400">{code}</td>
                    <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-200">{name}</td>
                    <td className="px-3 py-2 text-slate-500">{line.description || "—"}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                      {Number(line.debit) > 0 ? formatMoney(line.debit) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                      {Number(line.credit) > 0 ? formatMoney(line.credit) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-100/80 font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800/80 dark:text-white">
                <td colSpan={3} className="px-3 py-2 text-right uppercase tracking-wider">
                  {isVoucherBalanced ? (
                    <span>Total (میزان):</span>
                  ) : (
                    <span className="text-rose-600 dark:text-rose-400">
                      ⚠️ Total (Unbalanced Diff: {formatMoney(balanceDiff)}):
                    </span>
                  )}
                </td>
                <td className={`px-3 py-2 text-right font-mono tabular-nums ${isVoucherBalanced ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400 font-black"}`}>
                  {formatMoney(totalDebit)}
                </td>
                <td className={`px-3 py-2 text-right font-mono tabular-nums ${isVoucherBalanced ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400 font-black"}`}>
                  {formatMoney(totalCredit)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Amount in Words */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-2.5 text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
          <span className="font-bold text-slate-800 dark:text-slate-200 mr-2">Amount in Words:</span>
          <span className="italic font-medium">{numberToWords(totalDebit > 0 ? totalDebit : totalCredit)}</span>
        </div>

        {/* Signature placeholders */}
        <div className="grid grid-cols-4 gap-2 pt-4 border-t border-slate-200 text-center dark:border-slate-800">
          <div>
            <div className="h-8 border-b border-dashed border-slate-300 dark:border-slate-700"></div>
            <div className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mt-1">Prepared By</div>
            <div className="text-[9px] text-slate-400">تیار کنندہ</div>
          </div>
          <div>
            <div className="h-8 border-b border-dashed border-slate-300 dark:border-slate-700"></div>
            <div className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mt-1">Checked By</div>
            <div className="text-[9px] text-slate-400">پڑتال کنندہ</div>
          </div>
          <div>
            <div className="h-8 border-b border-dashed border-slate-300 dark:border-slate-700"></div>
            <div className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mt-1">Approved By</div>
            <div className="text-[9px] text-slate-400">منظور کنندہ</div>
          </div>
          <div>
            <div className="h-8 border-b border-dashed border-slate-300 dark:border-slate-700"></div>
            <div className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mt-1">Bank Depositor</div>
            <div className="text-[9px] text-slate-400">جمع کنندہ</div>
          </div>
        </div>

        {/* Footer buttons */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
          >
            <Printer className="h-4 w-4" />
            <span>Print Journal Voucher</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
