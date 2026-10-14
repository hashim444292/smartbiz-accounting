export interface FbrRowActionVisibility {
  showJson: boolean;
  showViewQr: boolean;
  showCreditNote: boolean;
  showHitFbr: boolean;
  showSettle: boolean;
  showEdit: boolean;
  showDelete: boolean;
  showReverse: boolean;
}

export function getFbrRowActionVisibility(
  inv: {
    status?: string | null;
    fbrStatus?: string | null;
    fbrInvoiceNumber?: string | null;
    paymentStatus?: string | null;
    remainingAmount?: number | null;
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

  const isSuccess = inv.fbrStatus === "SUCCESS" || Boolean(inv.fbrInvoiceNumber);
  const isPending = (!inv.fbrStatus || inv.fbrStatus === "PENDING") && !inv.fbrInvoiceNumber;
  const isFullyPaid = inv.paymentStatus === "PAID" || Number(inv.remainingAmount || 0) <= 0;
  const isEligibleToHit = isPending && isFullyPaid && !isSuccess;

  return {
    showJson: true,
    showViewQr: isSuccess,
    showCreditNote: isSuccess && !isDI,
    showHitFbr: isEligibleToHit,
    showSettle: !isSuccess && !isEligibleToHit,
    showEdit: !isSuccess,
    showDelete: !isSuccess,
    showReverse: !isDI && inv.status !== "CANCELLED" && !isSuccess,
  };
}
