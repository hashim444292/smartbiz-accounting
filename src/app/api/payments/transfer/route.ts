import { NextRequest, NextResponse } from "next/server";
import { getActiveBusinessId, getActiveBranchId } from "@/lib/businessHelper";
import { transferFunds } from "@/services/paymentService";
import { fallbackStore, storeTransferFunds } from "@/lib/fallbackStore";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();

  try {
    const session = await getSession();
    const businessId = await getActiveBusinessId(req);
    const { branchId: activeBranchId, isLockedToBranch } = await getActiveBranchId(req);
    const effectiveBranchId = isLockedToBranch ? activeBranchId : (body.branchId || activeBranchId || null);
    const createdById = session?.userId || body.createdById || "usr-2";
    const createdByName = session?.name || body.createdByName || "Muhammad Hanif";

    const transfer = await transferFunds({
      businessId,
      branchId: effectiveBranchId,
      fromAccountId: body.fromAccountId,
      toAccountId: body.toAccountId,
      amount: body.amount,
      referenceNumber: body.referenceNumber,
      notes: body.notes,
      createdById,
      createdByName,
    });

    return NextResponse.json({ success: true, data: transfer });
  } catch (error: any) {
    if (error.message?.includes("Can't reach database server") || error.code === "P1001" || !process.env.DATABASE_URL) {
      try {
        const session = await getSession();
        const businessId = await getActiveBusinessId(req);
        const { branchId: activeBranchId, isLockedToBranch } = await getActiveBranchId(req);
        const effectiveBranchId = isLockedToBranch ? activeBranchId : (body.branchId || activeBranchId || null);
        const createdById = session?.userId || body.createdById || "usr-2";
        const createdByName = session?.name || body.createdByName || "Muhammad Hanif";

        const newTransfer = storeTransferFunds(
          {
            businessId,
            ...body,
            branchId: effectiveBranchId,
            createdById,
            createdByName,
          },
          { userId: createdById, name: createdByName, email: session?.email }
        );

        return NextResponse.json({ success: true, data: newTransfer, fallback: true });
      } catch (storeErr: any) {
        return NextResponse.json({ success: false, error: storeErr.message }, { status: 400 });
      }
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
