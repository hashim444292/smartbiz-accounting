import { describe, it, expect } from "vitest";

// Replicating invoice classification helper matching src/app/sales/[id]/page.tsx
export function evaluateInvoicePresentation(sale: {
  invoiceNumber: string;
  subtotal: number | string;
  totalAmount: number | string;
  salesTax?: number | string;
  taxAmount?: number | string;
  extraTax?: number | string;
  furtherTax?: number | string;
  fbrInvoiceNumber?: string | null;
  items?: Array<{
    quantity: number | string;
    unitPrice: number | string;
    taxRate?: number | string;
    taxAmount?: number | string;
  }>;
  notes?: string;
}) {
  let fbrMeta: any = null;
  if (sale.notes && typeof sale.notes === "string" && sale.notes.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(sale.notes);
      fbrMeta = parsed.fbrMeta || parsed;
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

  const isTaxInvoice = totalTax > 0 || itemsTax > 0;
  const realFbrInvoiceNumber = sale.fbrInvoiceNumber || fbrMeta?.fbrInvoiceNumber || null;

  const documentTitle = isTaxInvoice ? "TAX INVOICE" : "SALES INVOICE";
  const titleColor = isTaxInvoice ? "text-[#D32F2F]" : "text-slate-900";

  const showFbrRef = Boolean(realFbrInvoiceNumber || isTaxInvoice);
  const fbrRefDisplay = realFbrInvoiceNumber || (isTaxInvoice ? "Pending Transmission" : null);

  const showTaxColumns = isTaxInvoice;
  const showTaxSubtotals = isTaxInvoice;
  const showFbrVerificationBox = Boolean(isTaxInvoice || realFbrInvoiceNumber);
  const verifiedFbrNumber = realFbrInvoiceNumber || (isTaxInvoice ? "Pending FBR Transmission" : null);

  const footerText = (isTaxInvoice || realFbrInvoiceNumber)
    ? "SmartBiz Powered By Accounts360 | Verify invoice authenticity via FBR TaxAsaan App"
    : "SmartBiz Powered By Accounts360 | Computer-Generated Commercial Sales Invoice";

  const pdfFilename = `${isTaxInvoice ? "Tax" : "Sales"}_Invoice_${realFbrInvoiceNumber || sale.invoiceNumber}.pdf`;

  return {
    isTaxInvoice,
    realFbrInvoiceNumber,
    documentTitle,
    titleColor,
    showFbrRef,
    fbrRefDisplay,
    showTaxColumns,
    showTaxSubtotals,
    showFbrVerificationBox,
    verifiedFbrNumber,
    footerText,
    pdfFilename,
    baseTax,
    totalTax,
  };
}

describe("Invoice Presentation: Tax Invoice vs Commercial Sales Invoice", () => {
  it("Scenario 1: Non-tax walk-in customer sale (0% tax, no FBR transmission) should render clean SALES INVOICE", () => {
    const sale = {
      invoiceNumber: "INV-2026-00004",
      subtotal: 510000,
      totalAmount: 510000,
      salesTax: 0,
      taxAmount: 0,
      extraTax: 0,
      furtherTax: 0,
      fbrInvoiceNumber: null,
      items: [
        {
          quantity: 17,
          unitPrice: 30000,
          taxRate: 0,
          taxAmount: 0,
        },
      ],
    };

    const pres = evaluateInvoicePresentation(sale);

    expect(pres.isTaxInvoice).toBe(false);
    expect(pres.documentTitle).toBe("SALES INVOICE");
    expect(pres.titleColor).toBe("text-slate-900");
    // FBR Ref line should be suppressed when no tax and no real FBR number
    expect(pres.showFbrRef).toBe(false);
    expect(pres.fbrRefDisplay).toBeNull();
    // Tax Rate & Tax Amount columns omitted
    expect(pres.showTaxColumns).toBe(false);
    // Tax summary rows omitted
    expect(pres.showTaxSubtotals).toBe(false);
    // FBR verification red box completely hidden
    expect(pres.showFbrVerificationBox).toBe(false);
    // No dummy FBR number like 4130335232913DIB0LHR8628064
    expect(pres.verifiedFbrNumber).toBeNull();
    // Footer text indicates commercial sales invoice
    expect(pres.footerText).toContain("Computer-Generated Commercial Sales Invoice");
    expect(pres.pdfFilename).toBe("Sales_Invoice_INV-2026-00004.pdf");
  });

  it("Scenario 2: Statutory Tax Invoice with 18% sales tax (Pending transmission) should render TAX INVOICE", () => {
    const sale = {
      invoiceNumber: "INV-2026-00005",
      subtotal: 100000,
      totalAmount: 118000,
      salesTax: 18000,
      taxAmount: 18000,
      extraTax: 0,
      furtherTax: 0,
      fbrInvoiceNumber: null,
      items: [
        {
          quantity: 10,
          unitPrice: 10000,
          taxRate: 18,
          taxAmount: 18000,
        },
      ],
    };

    const pres = evaluateInvoicePresentation(sale);

    expect(pres.isTaxInvoice).toBe(true);
    expect(pres.documentTitle).toBe("TAX INVOICE");
    expect(pres.titleColor).toBe("text-[#D32F2F]");
    expect(pres.showFbrRef).toBe(true);
    expect(pres.fbrRefDisplay).toBe("Pending Transmission");
    expect(pres.showTaxColumns).toBe(true);
    expect(pres.showTaxSubtotals).toBe(true);
    expect(pres.showFbrVerificationBox).toBe(true);
    expect(pres.verifiedFbrNumber).toBe("Pending FBR Transmission");
    expect(pres.footerText).toContain("Verify invoice authenticity via FBR TaxAsaan App");
    expect(pres.pdfFilename).toBe("Tax_Invoice_INV-2026-00005.pdf");
  });

  it("Scenario 3: Successfully transmitted FBR Digital Invoice with real FBR number", () => {
    const sale = {
      invoiceNumber: "INV-2026-00006",
      subtotal: 200000,
      totalAmount: 236000,
      salesTax: 36000,
      taxAmount: 36000,
      fbrInvoiceNumber: "4220106071803DIB0LHR1234567",
      items: [
        {
          quantity: 2,
          unitPrice: 100000,
          taxRate: 18,
          taxAmount: 36000,
        },
      ],
    };

    const pres = evaluateInvoicePresentation(sale);

    expect(pres.isTaxInvoice).toBe(true);
    expect(pres.documentTitle).toBe("TAX INVOICE");
    expect(pres.showFbrRef).toBe(true);
    expect(pres.fbrRefDisplay).toBe("4220106071803DIB0LHR1234567");
    expect(pres.showFbrVerificationBox).toBe(true);
    expect(pres.verifiedFbrNumber).toBe("4220106071803DIB0LHR1234567");
    expect(pres.pdfFilename).toBe("Tax_Invoice_4220106071803DIB0LHR1234567.pdf");
  });

  it("Scenario 4: Retail POS sale with exempt/zero tax that was pushed to FBR POS tier-1", () => {
    // If POS pushes a zero tax sale to FBR and receives an FBR POS invoice number
    const sale = {
      invoiceNumber: "INV-2026-00007",
      subtotal: 5000,
      totalAmount: 5000,
      salesTax: 0,
      fbrInvoiceNumber: "FBR-POS-2026-00007",
      items: [
        {
          quantity: 1,
          unitPrice: 5000,
          taxRate: 0,
          taxAmount: 0,
        },
      ],
    };

    const pres = evaluateInvoicePresentation(sale);

    // It's not a tax invoice, but because it has a real FBR POS number, verification box shows that number
    expect(pres.isTaxInvoice).toBe(false);
    expect(pres.documentTitle).toBe("SALES INVOICE");
    expect(pres.showFbrRef).toBe(true);
    expect(pres.fbrRefDisplay).toBe("FBR-POS-2026-00007");
    expect(pres.showFbrVerificationBox).toBe(true);
    expect(pres.verifiedFbrNumber).toBe("FBR-POS-2026-00007");
    expect(pres.pdfFilename).toBe("Sales_Invoice_FBR-POS-2026-00007.pdf");
  });
});
