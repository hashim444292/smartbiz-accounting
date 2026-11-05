import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveBusinessId, getActiveBranchId } from "@/lib/businessHelper";
import { performStockAdjustment } from "@/services/inventoryService";
import { fallbackStore, storeAdjustStock } from "@/lib/fallbackStore";
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

    const result = await prisma.$transaction(async (tx) => {
      let targetStock = body.targetStock;
      if (body.deductQuantity !== undefined && body.deductQuantity !== null) {
        const product = await tx.product.findUnique({ where: { id: body.productId } });
        if (!product) throw new Error("Product not found");
        const current = Number(product.currentStock || 0);
        const deduct = Math.max(0, Number(body.deductQuantity));
        targetStock = Math.max(0, current - deduct);
      }

      return await performStockAdjustment(tx, {
        businessId,
        branchId: effectiveBranchId,
        productId: body.productId,
        targetStock,
        reason: body.reason || "DAMAGE",
        notes: body.notes,
        createdById,
        createdByName,
      });
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    if (error.message?.includes("Can't reach database server") || error.code === "P1001" || !process.env.DATABASE_URL) {
      try {
        const session = await getSession();
        const businessId = await getActiveBusinessId(req);
        const { branchId: activeBranchId, isLockedToBranch } = await getActiveBranchId(req);
        const effectiveBranchId = isLockedToBranch ? activeBranchId : (body.branchId || activeBranchId || null);
        const createdById = session?.userId || body.createdById || "usr-2";
        const createdByName = session?.name || body.createdByName || "Muhammad Hanif";

        const adjResult = storeAdjustStock(
          {
            businessId,
            branchId: effectiveBranchId,
            productId: body.productId,
            targetStock: body.targetStock,
            deductQuantity: body.deductQuantity,
            reason: body.reason,
            notes: body.notes,
            createdById,
            createdByName,
          },
          { userId: createdById, name: createdByName, email: session?.email }
        );

        return NextResponse.json({
          success: true,
          data: adjResult,
          fallback: true,
        });
      } catch (storeErr: any) {
        return NextResponse.json({ success: false, error: storeErr.message }, { status: 400 });
      }
    }

    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
