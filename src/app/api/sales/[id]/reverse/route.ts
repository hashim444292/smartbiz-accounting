import { NextRequest, NextResponse } from "next/server";
import { reverseSale } from "@/services/salesService";
import { fallbackStore } from "@/lib/fallbackStore";
import { getSession } from "@/lib/auth";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  // 1. Authenticate request
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Access Denied: Authentication required. Please sign in." },
      { status: 401 }
    );
  }

  // 2. Resolve authorized active business
  const businessId = await getActiveBusinessId(req);
  const isSuperAdmin = session.role === "SUPER_ADMIN";

  // 3. Parse optional reason
  let reason = "Customer return / cancellation";
  try {
    const body = await req.json();
    if (body?.reason) reason = body.reason;
  } catch {}

  // 4. Verify target sale existence and tenant ownership prior to any mutation
  if (process.env.DATABASE_URL) {
    try {
      const sale = await prisma.sale.findUnique({
        where: { id },
        include: { business: true },
      });

      if (!sale) {
        return NextResponse.json({ success: false, error: "Sale not found" }, { status: 404 });
      }

      if (!isSuperAdmin && sale.businessId !== businessId) {
        return NextResponse.json(
          { success: false, error: "Access Denied: You do not have permission to reverse this sale." },
          { status: 403 }
        );
      }

      const isStampedDI =
        sale.fbrStatus === "SUCCESS" &&
        Boolean(
          (sale.business as any)?.integrationType === "DIGITAL_INVOICING" ||
          (typeof sale.fbrInvoiceNumber === "string" && sale.fbrInvoiceNumber.includes("DI"))
        );

      if (isStampedDI) {
        return NextResponse.json(
          { success: false, error: "Credit Notes and Reversals are not permitted for stamped FBR Digital Invoices." },
          { status: 400 }
        );
      }

      // If this is an FBR POS stamped invoice, issue an official FBR Credit Note (InvoiceType 3 with refUsin)
      let cnResult: any = null;
      const isPosStamped = sale.fbrStatus === "SUCCESS" && Boolean(sale.fbrInvoiceNumber) && !isStampedDI;
      if (isPosStamped) {
        try {
          const { transmitFbrCreditNote } = await import("@/services/fbrService");
          cnResult = await transmitFbrCreditNote(id, reason, { refUsin: sale.fbrInvoiceNumber || undefined });
        } catch (cnErr: any) {
          console.warn("[REVERSE_SALE] FBR Credit Note transmission notice:", cnErr?.message);
        }
      }

      const result = await reverseSale(id, reason, session.userId);
      return NextResponse.json({
        success: true,
        data: result,
        creditNote: cnResult,
        isPosCreditNote: isPosStamped,
      });
    } catch (error: any) {
      if (!error.message?.includes("Can't reach database server") && error.code !== "P1001") {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      }
    }
  }

  // 5. Fallback Store verification and mutation
  const fbSale = fallbackStore.sales.find((s) => s.id === id);
  if (!fbSale) {
    return NextResponse.json({ success: false, error: "Sale not found" }, { status: 404 });
  }

  if (!isSuperAdmin && fbSale.businessId !== businessId) {
    return NextResponse.json(
      { success: false, error: "Access Denied: You do not have permission to reverse this sale." },
      { status: 403 }
    );
  }

  const isFbStampedDI =
    fbSale.fbrStatus === "SUCCESS" &&
    Boolean(fbSale.fbrInvoiceNumber?.includes("DI") || (fbSale as any)?.integrationType === "DIGITAL_INVOICING");

  if (isFbStampedDI) {
    return NextResponse.json(
      { success: false, error: "Credit Notes and Reversals are not permitted for stamped FBR Digital Invoices." },
      { status: 400 }
    );
  }

  fbSale.status = "CANCELLED";
  if (fbSale.fbrStatus === "SUCCESS" && fbSale.fbrInvoiceNumber) {
    (fbSale as any).fbrCreditNote = {
      status: "CONFIRMED",
      cnInvoiceNumber: `CN-${Date.now().toString().slice(-6)}`,
      reason,
      date: new Date().toISOString(),
    };
  }

  // Restore product stock
  for (const it of fbSale.items || []) {
    const prod = fallbackStore.products.find((p) => p.id === it.productId);
    if (prod) {
      prod.currentStock = Number(prod.currentStock || 0) + Number(it.quantity || 0);
    }
  }

  // Revert customer balance
  if (fbSale.customerId && Number(fbSale.remainingAmount || 0) > 0) {
    const cust = fallbackStore.customers.find((c) => c.id === fbSale.customerId);
    if (cust) {
      cust.currentBalance = Math.max(0, Number(cust.currentBalance || 0) - Number(fbSale.remainingAmount || 0));
    }
  }

  // Revert paid amount from Cash/Bank
  if (Number(fbSale.paidAmount || 0) > 0) {
    const acc = fallbackStore.cashBankAccounts.find((a) => (fbSale.paymentMethod === "BANK" ? a.type === "BANK" : a.type === "CASH"));
    if (acc) {
      acc.balance = Number(acc.balance || 0) - Number(fbSale.paidAmount || 0);
    }
  }

  // Record Journal Entry for Sales Return in fallbackStore
  if (!fallbackStore.journalEntries) fallbackStore.journalEntries = [];
  const bizId = fbSale.businessId;
  const totalAmt = Number(fbSale.totalAmount || 0);
  const paidAmt = Number(fbSale.paidAmount || 0);
  const remAmt = Number(fbSale.remainingAmount || 0);

  fallbackStore.journalEntries.unshift({
    id: `je-rev-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    businessId: bizId,
    date: new Date().toISOString(),
    description: `Reversal of Sale Invoice #${fbSale.invoiceNumber} (${reason})`,
    referenceType: "SALE_RETURN",
    referenceId: fbSale.id,
    createdById: session.userId,
    lines: [
      { accountCode: "4020", debit: totalAmt, credit: 0, description: "Sales Returns" },
      ...(paidAmt > 0 ? [{ accountCode: "1010", debit: 0, credit: paidAmt, description: "Cash/Bank Refund" }] : []),
      ...(remAmt > 0 ? [{ accountCode: "1100", debit: 0, credit: remAmt, description: "Receivables Reversal" }] : []),
    ],
  });

  return NextResponse.json({
    success: true,
    data: { sale: fbSale, reversalReason: reason },
    isPosCreditNote: fbSale.fbrStatus === "SUCCESS" && Boolean(fbSale.fbrInvoiceNumber),
    fallback: true,
  });
}
