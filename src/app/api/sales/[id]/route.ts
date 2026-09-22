import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { fallbackStore, storeUpdateSale } from "@/lib/fallbackStore";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  try {
    const businessId = await getActiveBusinessId(req);

    const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("DB_TIMEOUT")), 150));
    const sale = await Promise.race([
      prisma.sale.findFirst({
        where: { id, businessId },
        include: { customer: true, items: true, branch: true },
      }),
      timeoutPromise,
    ]);

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

    const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("DB_TIMEOUT")), 150));
    const existing = await Promise.race([
      prisma.sale.findFirst({
        where: { id, businessId },
        include: { items: true },
      }),
      timeoutPromise,
    ]);

    if (!existing) {
      return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
    }

    const previousSnapshot = {
      customerName: existing.customerName,
      totalAmount: existing.totalAmount.toString(),
      paidAmount: existing.paidAmount.toString(),
      notes: existing.notes,
    };

    const updatedSale = await prisma.$transaction(async (tx) => {
      const updated = await tx.sale.update({
        where: { id },
        data: {
          customerName: body.customerName !== undefined ? body.customerName : existing.customerName,
          notes: body.notes !== undefined ? body.notes : existing.notes,
          paymentMethod: body.paymentMethod !== undefined ? body.paymentMethod : existing.paymentMethod,
          paymentStatus: body.paymentStatus !== undefined ? body.paymentStatus : existing.paymentStatus,
          paidAmount: body.paidAmount !== undefined ? Number(body.paidAmount) : existing.paidAmount,
          remainingAmount:
            body.paidAmount !== undefined
              ? Math.max(0, Number(existing.totalAmount) - Number(body.paidAmount))
              : existing.remainingAmount,
          isEdited: true,
          editCount: { increment: 1 },
          updatedById: editorId,
          updatedByName: editorName,
          editReason,
          updatedAt: new Date(),
        },
        include: { customer: true, items: true, branch: true },
      });

      await tx.auditLog.create({
        data: {
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
              customerName: updated.customerName,
              totalAmount: updated.totalAmount.toString(),
              paidAmount: updated.paidAmount.toString(),
              notes: updated.notes,
            },
          }),
        },
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
