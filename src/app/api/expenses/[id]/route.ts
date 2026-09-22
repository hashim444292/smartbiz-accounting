import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { fallbackStore, storeUpdateExpense, storeDeleteExpense } from "@/lib/fallbackStore";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const body = await req.json();

  try {
    const session = await getSession();
    const businessId = await getActiveBusinessId(req);
    const editorId = session?.userId || "usr-2";
    const editorName = session?.name || "Administrator";
    const editorEmail = session?.email || "admin@smartbiz.com";
    const editReason = body.editReason || "Expense details modified by administrator";

    const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("DB_TIMEOUT")), 150));
    const existing = await Promise.race([
      prisma.expense.findFirst({
        where: { id, businessId },
      }),
      timeoutPromise,
    ]);

    if (!existing) {
      return NextResponse.json({ success: false, error: "Expense not found" }, { status: 404 });
    }

    const previousSnapshot = {
      description: existing.description,
      amount: existing.amount.toString(),
      paidTo: existing.paidTo,
    };

    const updatedExpense = await prisma.$transaction(async (tx) => {
      const updated = await tx.expense.update({
        where: { id },
        data: {
          description: body.description !== undefined ? body.description : existing.description,
          amount: body.amount !== undefined ? Number(body.amount) : existing.amount,
          paidTo: body.paidTo !== undefined ? body.paidTo : existing.paidTo,
          paymentMethod: body.paymentMethod !== undefined ? body.paymentMethod : existing.paymentMethod,
          categoryId: body.categoryId !== undefined ? body.categoryId : existing.categoryId,
          isEdited: true,
          editCount: { increment: 1 },
          updatedById: editorId,
          updatedByName: editorName,
          editReason,
          updatedAt: new Date(),
        },
        include: { category: true, account: true, branch: true },
      });

      await tx.auditLog.create({
        data: {
          businessId,
          userId: editorId,
          userName: editorName,
          userEmail: editorEmail,
          branchId: existing.branchId,
          action: "UPDATE_EXPENSE",
          entity: "Expense",
          entityId: id,
          details: `Modified Expense: ${existing.description} (Reason: ${editReason})`,
          changes: JSON.stringify({
            previous: previousSnapshot,
            updated: {
              description: updated.description,
              amount: updated.amount.toString(),
              paidTo: updated.paidTo,
            },
          }),
        },
      });

      return updated;
    });

    return NextResponse.json({ success: true, data: updatedExpense });
  } catch {
    const session = await getSession();
    const updated = storeUpdateExpense(
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
      return NextResponse.json({ success: false, error: "Expense not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updated, fallback: true });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  try {
    const session = await getSession();
    const businessId = await getActiveBusinessId(req);
    const editorId = session?.userId || "usr-2";
    const editorName = session?.name || "Administrator";
    const editorEmail = session?.email || "admin@smartbiz.com";

    const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("DB_TIMEOUT")), 150));
    const existing = await Promise.race([
      prisma.expense.findFirst({
        where: { id, businessId },
      }),
      timeoutPromise,
    ]);

    if (!existing) {
      return NextResponse.json({ success: false, error: "Expense not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.expense.delete({ where: { id } });

      await tx.auditLog.create({
        data: {
          businessId,
          userId: editorId,
          userName: editorName,
          userEmail: editorEmail,
          branchId: existing.branchId,
          action: "DELETE_EXPENSE",
          entity: "Expense",
          entityId: id,
          details: `Deleted Expense: ${existing.description} - Rs ${Number(existing.amount).toLocaleString()}`,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch {
    const session = await getSession();
    const businessId = await getActiveBusinessId(req);
    const deleted = storeDeleteExpense(id, businessId, {
      userId: session?.userId,
      name: session?.name,
      email: session?.email,
    });

    if (!deleted) {
      return NextResponse.json({ success: false, error: "Expense not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, fallback: true });
  }
}
