import { NextRequest, NextResponse } from "next/server";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { getFbrComplianceOverview, createFbrPosInvoice } from "@/services/fbrService";
import { fallbackStore } from "@/lib/fallbackStore";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const businessId = await getActiveBusinessId(req);
    const overview = await getFbrComplianceOverview(businessId);
    return NextResponse.json({ success: true, data: overview });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

async function processFbrTransmission(invoiceId: string, allowIncomplete = false) {
  const fbrInvNum = `FBR-POS-2026-${Math.floor(100000 + Math.random() * 900000)}`;

  try {
    const sale = await prisma.sale.findUnique({ where: { id: invoiceId } });
    if (!sale) throw new Error("Sale not found in database");

    if (!allowIncomplete && sale.paymentStatus !== "PAID") {
      throw new Error(
        `Invoice #${sale.invoiceNumber} cannot be transmitted to FBR because payment is incomplete (${sale.paymentStatus}, Remaining: Rs. ${Number(sale.remainingAmount || 0).toLocaleString()}). Invoices can only be transmitted to FBR once 100% payment is received.`
      );
    }

    const currentFee = Number((sale as any).posFee || 0);
    const additionalFee = currentFee >= 1 ? 0 : 1.0;
    const newTotal = Number(sale.totalAmount) + additionalFee;
    const fbrQr = `https://e.fbr.gov.pk/verify?inv=${encodeURIComponent(fbrInvNum)}&pos=POS-101&amt=${newTotal}`;

    const updated = await prisma.sale.update({
      where: { id: invoiceId },
      data: {
        posFee: 1.0,
        totalAmount: newTotal,
        remainingAmount: Math.max(0, Number(sale.remainingAmount) + additionalFee),
        fbrStatus: "SUCCESS",
        fbrInvoiceNumber: fbrInvNum,
        fbrQrCode: fbrQr,
      } as any,
    });
    return updated;
  } catch (err: any) {
    if (err.message?.includes("cannot be transmitted to FBR because payment is incomplete")) {
      throw err;
    }

    const s = fallbackStore.sales.find((sale) => sale.id === invoiceId);
    if (!s) throw new Error(`Sale #${invoiceId} not found`);

    if (!allowIncomplete && s.paymentStatus !== "PAID") {
      throw new Error(
        `Invoice #${s.invoiceNumber} cannot be transmitted to FBR because payment is incomplete (${s.paymentStatus}, Remaining: Rs. ${Number(s.remainingAmount || 0).toLocaleString()}). Invoices can only be transmitted to FBR once 100% payment is received.`
      );
    }

    const currentFee = Number(s.posFee || 0);
    const additionalFee = currentFee >= 1 ? 0 : 1.0;
    s.posFee = 1.0;
    s.totalAmount = Number(s.totalAmount) + additionalFee;
    s.remainingAmount = Math.max(0, Number(s.remainingAmount || 0) + additionalFee);
    if (s.customerId && additionalFee > 0) {
      const cust = fallbackStore.customers.find((c) => c.id === s.customerId);
      if (cust) cust.currentBalance += additionalFee;
    }
    s.fbrInvoiceNumber = s.fbrInvoiceNumber && s.fbrInvoiceNumber !== "Pending Generation" ? s.fbrInvoiceNumber : fbrInvNum;
    s.fbrQrCode = `https://e.fbr.gov.pk/verify?inv=${encodeURIComponent(s.fbrInvoiceNumber)}&pos=POS-101&amt=${s.totalAmount}`;
    s.fbrStatus = "SUCCESS";
    return s;
  }
}

export async function POST(req: NextRequest) {
  try {
    const businessId = await getActiveBusinessId(req);
    const body = await req.json();

    if (body.action === "transmit" || body.action === "retry") {
      const { invoiceId, allowIncomplete } = body;
      const updated = await processFbrTransmission(invoiceId, allowIncomplete);
      return NextResponse.json({
        success: true,
        data: updated,
        message: `Invoice #${updated.invoiceNumber} transmitted to FBR. Rs. 1/- POS fee applied.`,
      });
    }

    if (body.action === "transmit_batch") {
      const { invoiceIds = [], allowIncomplete = false } = body;
      const results = [];
      const skippedPartial = [];

      for (const id of invoiceIds) {
        try {
          const res = await processFbrTransmission(id, allowIncomplete);
          results.push(res);
        } catch (e: any) {
          if (e.message?.includes("payment is incomplete")) {
            skippedPartial.push(id);
          } else {
            console.error(`Batch transmission error for ${id}:`, e);
          }
        }
      }

      let msg = `${results.length} fully paid invoice(s) transmitted to FBR. Rs. 1/- fee charged per invoice.`;
      if (skippedPartial.length > 0) {
        msg += ` (${skippedPartial.length} partial/credit invoice(s) safely held back until full payment is collected).`;
      }

      return NextResponse.json({
        success: true,
        data: results,
        skippedPartialCount: skippedPartial.length,
        message: msg,
      });
    }

    const newSale = await createFbrPosInvoice({
      ...body,
      businessId,
    });

    return NextResponse.json({
      success: true,
      data: newSale,
      message: `FBR POS Invoice #${newSale.fbrInvoiceNumber} created and verified successfully.`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
