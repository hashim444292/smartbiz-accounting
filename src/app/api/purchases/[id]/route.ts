import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { fallbackStore, storeUpdatePurchase } from "@/lib/fallbackStore";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  try {
    const businessId = await getActiveBusinessId(req);

    const purchase = await prisma.purchase.findFirst({
      where: { id, businessId },
      include: { supplier: true, items: true, branch: true },
    });

    if (!purchase) {
      return NextResponse.json({ success: false, error: "Purchase not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: purchase });
  } catch {
    const businessId = await getActiveBusinessId(req);
    const purchase = fallbackStore.purchases.find((p) => p.id === id && p.businessId === businessId);

    if (!purchase) {
      return NextResponse.json({ success: false, error: "Purchase not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: purchase, fallback: true });
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
    const editReason = body.editReason || "Purchase order modified by administrator";

    const existing = await prisma.purchase.findFirst({
      where: { id, businessId },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Purchase not found" }, { status: 404 });
    }

    const previousSnapshot = {
      supplierName: existing.supplierName,
      totalAmount: existing.totalAmount.toString(),
      paidAmount: existing.paidAmount.toString(),
      notes: existing.notes,
    };

    const updatedPurchase = await prisma.$transaction(async (tx) => {
      const updated = await tx.purchase.update({
        where: { id },
        data: {
          supplierName: body.supplierName !== undefined ? body.supplierName : existing.supplierName,
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
        include: { supplier: true, items: true, branch: true },
      });

      await tx.auditLog.create({
        data: {
          businessId,
          userId: editorId,
          userName: editorName,
          userEmail: editorEmail,
          branchId: existing.branchId,
          action: "UPDATE_PURCHASE",
          entity: "Purchase",
          entityId: id,
          details: `Modified Purchase Order #${existing.purchaseNumber} (Reason: ${editReason})`,
          changes: JSON.stringify({
            previous: previousSnapshot,
            updated: {
              supplierName: updated.supplierName,
              totalAmount: updated.totalAmount.toString(),
              paidAmount: updated.paidAmount.toString(),
              notes: updated.notes,
            },
          }),
        },
      });

      return updated;
    });

    return NextResponse.json({ success: true, data: updatedPurchase });
  } catch {
    const session = await getSession();
    const updated = storeUpdatePurchase(
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
      return NextResponse.json({ success: false, error: "Purchase not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updated, fallback: true });
  }
}
