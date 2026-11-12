export interface FbrRowActionVisibility {
  showJson: boolean;
  showViewQr: boolean;
  showCreditNote: boolean;
  hasCreditNote: boolean;
  creditNoteNumber: string | null;
  creditNoteStatus: string | null;
  showHitFbr: boolean;
  showSettle: boolean;
  showEdit: boolean;
  showDelete: boolean;
  showReverse: boolean;
}

export interface CreditNoteInfo {
  hasCreditNote: boolean;
  creditNoteNumber: string | null;
  creditNoteStatus: string | null;
}

export function extractCreditNoteInfo(inv: {
  notes?: string | null;
  invoiceNumber?: string | null;
  status?: string | null;
  fbrCreditNoteStatus?: string | null;
  fbrCreditNoteNumber?: string | null;
  fbrCreditNoteInvoiceNumber?: string | null;
}): CreditNoteInfo {
  let hasCreditNote = false;
  let creditNoteNumber: string | null = null;
  let creditNoteStatus: string | null = null;

  if (inv.notes) {
    try {
      const parsed = typeof inv.notes === "string" ? JSON.parse(inv.notes) : inv.notes;
      const cn = parsed?.fbrCreditNote;
      if (cn && (cn.status === "SUCCESS" || Boolean(cn.cnInvoiceNumber) || cn.status === "PENDING_RECONCILIATION" || cn.status === "IN_FLIGHT")) {
        hasCreditNote = true;
        creditNoteNumber = cn.cnInvoiceNumber || null;
        creditNoteStatus = cn.status || "SUCCESS";
      }
    } catch {}
  }

  if (!hasCreditNote && inv.fbrCreditNoteNumber && !inv.fbrCreditNoteNumber.startsWith("CN-")) {
    hasCreditNote = true;
    creditNoteNumber = inv.fbrCreditNoteNumber;
    creditNoteStatus = inv.fbrCreditNoteStatus || "SUCCESS";
  }

  if (!hasCreditNote && inv.fbrCreditNoteInvoiceNumber && !inv.fbrCreditNoteInvoiceNumber.startsWith("CN-")) {
    hasCreditNote = true;
    creditNoteNumber = inv.fbrCreditNoteInvoiceNumber;
    creditNoteStatus = inv.fbrCreditNoteStatus || "SUCCESS";
  }

  return { hasCreditNote, creditNoteNumber, creditNoteStatus };
}

export function getFbrRowActionVisibility(
  inv: {
    invoiceNumber?: string | null;
    status?: string | null;
    fbrStatus?: string | null;
    fbrInvoiceNumber?: string | null;
    paymentStatus?: string | null;
    remainingAmount?: number | null;
    notes?: string | null;
    fbrCreditNoteStatus?: string | null;
    fbrCreditNoteNumber?: string | null;
    fbrCreditNoteInvoiceNumber?: string | null;
  },
  options?: {
    integrationType?: string | null;
    isDigitalInvoicing?: boolean;
  }
): FbrRowActionVisibility {
  const isDI =
    options?.isDigitalInvoicing === true ||
    options?.integrationType === "DIGITAL_INVOICING" ||
    (typeof inv.fbrInvoiceNumber === "string" && inv.fbrInvoiceNumber.includes("DI"));

  const { hasCreditNote, creditNoteNumber, creditNoteStatus } = extractCreditNoteInfo(inv);

  const isSuccess = inv.fbrStatus === "SUCCESS" || Boolean(inv.fbrInvoiceNumber);
  const isPending = (!inv.fbrStatus || inv.fbrStatus === "PENDING") && !inv.fbrInvoiceNumber;
  const isFailed = inv.fbrStatus === "FAILED" && !inv.fbrInvoiceNumber;
  const isFullyPaid = inv.paymentStatus === "PAID" || Number(inv.remainingAmount || 0) <= 0;
  const isEligibleToHit = (isPending || isFailed) && isFullyPaid && !isSuccess;

  return {
    showJson: true,
    showViewQr: isSuccess,
    showCreditNote: isSuccess && !isDI && !hasCreditNote,
    hasCreditNote,
    creditNoteNumber,
    creditNoteStatus,
    showHitFbr: isEligibleToHit,
    showSettle: !isSuccess && !isFullyPaid,
    showEdit: !isSuccess && !hasCreditNote,
    showDelete: !isSuccess && !hasCreditNote,
    showReverse: !isDI && inv.status !== "CANCELLED" && !isSuccess && !hasCreditNote,
  };
}
