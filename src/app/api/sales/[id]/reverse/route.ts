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
        select: { id: true, businessId: true },
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

      const result = await reverseSale(id, reason, session.userId);
      return NextResponse.json({ success: true, data: result });
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

  if (fbSale.fbrInvoiceNumber?.includes("DI") || fbSale.fbrStatus === "SUCCESS") {
    return NextResponse.json(
      { success: false, error: "Credit Notes and Reversals are not permitted for FBR Digital Invoices." },
      { status: 400 }
    );
  }

  fbSale.status = "CANCELLED";

  // Restore product stock
  for (const it of fbSale.items || []) {
    const prod = fallbackStore.products.find((p) => p.id === it.productId);
    if (prod) {
      prod.currentStock += it.quantity;
    }
  }

  // Revert customer balance
  if (fbSale.customerId && fbSale.remainingAmount > 0) {
    const cust = fallbackStore.customers.find((c) => c.id === fbSale.customerId);
    if (cust) {
      cust.currentBalance = Math.max(0, cust.currentBalance - fbSale.remainingAmount);
    }
  }

  // Revert paid amount from Cash/Bank
  if (fbSale.paidAmount > 0) {
    const acc = fallbackStore.cashBankAccounts.find((a) => (fbSale.paymentMethod === "BANK" ? a.type === "BANK" : a.type === "CASH"));
    if (acc) {
      acc.balance -= fbSale.paidAmount;
    }
  }

  return NextResponse.json({ success: true, data: { sale: fbSale, reversalReason: reason }, fallback: true });
}
