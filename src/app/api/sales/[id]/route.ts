import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { fallbackStore, storeUpdateSale } from "@/lib/fallbackStore";
import { getSession } from "@/lib/auth";
import { createSafeAuditLog } from "@/lib/auditHelper";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  try {
    const businessId = await getActiveBusinessId(req);

    const sale = await prisma.sale.findFirst({
      where: { id, businessId },
      include: { customer: true, items: true, branch: true },
    });

    if (!sale) {
      return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: sale });
  } catch {
    const businessId = await getActiveBusinessId(req);
    const sale = fallbackStore.sales.find((s) => s.id === id && s.businessId === businessId);

    if (!sale) {
      return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: sale, fallback: true });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const body = await req.json();

  try {
    const session = await getSession();
    const businessId = await getActiveBusinessId(req);
    const editorId = session?.userId || "usr-2";
    const editorName = session?.name || "Administrator";
    const editorEmail = session?.email || "admin@smartbiz.com";
    const editReason = body.editReason || "Invoice details modified by administrator";

    const existing = await prisma.sale.findFirst({
      where: { id, businessId },
      include: { items: true },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
    }

    const newTotal = body.totalAmount !== undefined ? Number(body.totalAmount) : Number(existing.totalAmount);
    const newPaid = body.paidAmount !== undefined ? Number(body.paidAmount) : Number(existing.paidAmount);
    const newRemaining = Math.max(0, newTotal - newPaid);

    let newPaymentStatus = body.paymentStatus;
    if (!newPaymentStatus) {
      if (newPaid >= newTotal && newTotal > 0) newPaymentStatus = "PAID";
      else if (newPaid > 0) newPaymentStatus = "PARTIAL";
      else newPaymentStatus = "UNPAID";
    }

    const previousSnapshot = {
      date: existing.date,
      customerName: existing.customerName,
      totalAmount: existing.totalAmount.toString(),
      paidAmount: existing.paidAmount.toString(),
      paymentStatus: existing.paymentStatus,
      paymentMethod: existing.paymentMethod,
      fbrInvoiceNumber: existing.fbrInvoiceNumber,
      notes: existing.notes,
    };

    const updateData: any = {
      customerName: body.customerName !== undefined ? body.customerName : existing.customerName,
      notes: body.notes !== undefined ? body.notes : existing.notes,
      paymentMethod: body.paymentMethod !== undefined ? body.paymentMethod : existing.paymentMethod,
      paymentStatus: newPaymentStatus,
      totalAmount: newTotal,
      paidAmount: newPaid,
      remainingAmount: newRemaining,
      isEdited: true,
      editCount: { increment: 1 },
      updatedById: editorId,
      updatedByName: editorName,
      editReason,
      updatedAt: new Date(),
    };

    if (body.date) {
      updateData.date = new Date(body.date);
    }
    if (body.dueDate !== undefined) {
      updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    }
    if (body.discountAmount !== undefined) {
      updateData.discountAmount = Number(body.discountAmount);
    }
    if (body.fbrStatus !== undefined) {
      updateData.fbrStatus = body.fbrStatus;
    }
    if (body.fbrInvoiceNumber !== undefined) {
      updateData.fbrInvoiceNumber = body.fbrInvoiceNumber;
      if (body.fbrInvoiceNumber) {
        updateData.fbrQrCode = `https://e.fbr.gov.pk/verify?inv=${encodeURIComponent(body.fbrInvoiceNumber)}&pos=${encodeURIComponent(existing.branchId || "POS-101")}&amt=${newTotal}`;
      }
    }

    const updatedSale = await prisma.$transaction(async (tx) => {
      const updated = await tx.sale.update({
        where: { id },
        data: updateData,
        include: { customer: true, items: true, branch: true },
      });

      await createSafeAuditLog(tx, {
        businessId,
        userId: editorId,
        userName: editorName,
        userEmail: editorEmail,
        branchId: existing.branchId,
        action: "UPDATE_SALE",
        entity: "Sale",
        entityId: id,
        details: `Modified Sale Invoice #${existing.invoiceNumber} (Reason: ${editReason})`,
        changes: JSON.stringify({
          previous: previousSnapshot,
          updated: {
            date: updated.date,
            customerName: updated.customerName,
            totalAmount: updated.totalAmount.toString(),
            paidAmount: updated.paidAmount.toString(),
            paymentStatus: updated.paymentStatus,
            paymentMethod: updated.paymentMethod,
            fbrInvoiceNumber: updated.fbrInvoiceNumber,
            notes: updated.notes,
          },
        }),
      });

      return updated;
    });

    return NextResponse.json({ success: true, data: updatedSale });
  } catch {
    const session = await getSession();
    const updated = storeUpdateSale(
      id,
      body,
      {
        userId: session?.userId,
        name: session?.name,
        email: session?.email,
      },
      body.editReason
    );

    if (!updated) {
      return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updated, fallback: true });
  }
}
