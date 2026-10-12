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

export function getFbrRowActionVisibility(inv: {
  status?: string | null;
  fbrStatus?: string | null;
  fbrInvoiceNumber?: string | null;
  paymentStatus?: string | null;
  remainingAmount?: number | null;
}): FbrRowActionVisibility {
  const isSuccess = inv.fbrStatus === "SUCCESS" || Boolean(inv.fbrInvoiceNumber);
  const isPending = (!inv.fbrStatus || inv.fbrStatus === "PENDING") && !inv.fbrInvoiceNumber;
  const isFullyPaid = inv.paymentStatus === "PAID" || Number(inv.remainingAmount || 0) <= 0;
  const isEligibleToHit = isPending && isFullyPaid && !isSuccess;

  return {
    showJson: true,
    showViewQr: isSuccess,
    showCreditNote: isSuccess,
    showHitFbr: isEligibleToHit,
    showSettle: !isSuccess && !isEligibleToHit,
    showEdit: true,
    showDelete: true,
    showReverse: inv.status !== "CANCELLED" && !isSuccess,
  };
}
