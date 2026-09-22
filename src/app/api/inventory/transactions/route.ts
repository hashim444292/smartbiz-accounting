import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveBusinessId, getActiveBranchId } from "@/lib/businessHelper";
import { fallbackStore } from "@/lib/fallbackStore";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const businessId = await getActiveBusinessId(req);
    const { branchId: activeBranchId, isLockedToBranch } = await getActiveBranchId(req);
    const { searchParams } = new URL(req.url);

    const productId = searchParams.get("productId");
    const type = searchParams.get("type");
    const requestedBranchId = searchParams.get("branchId");
    const effectiveBranchId = requestedBranchId || activeBranchId || undefined;

    const where: any = { businessId };
    if (productId) where.productId = productId;
    if (type) where.type = type;
    if (effectiveBranchId) where.branchId = effectiveBranchId;

    const transactions = await prisma.inventoryTransaction.findMany({
      where,
      include: {
        product: true,
        branch: true,
      },
      orderBy: { date: "desc" },
      take: 100,
    });

    return NextResponse.json({
      success: true,
      data: transactions,
      branchId: effectiveBranchId,
      isLockedToBranch,
    });
  } catch (error: any) {
    const businessId = await getActiveBusinessId(req);
    const { branchId: activeBranchId, isLockedToBranch } = await getActiveBranchId(req);
    const { searchParams } = new URL(req.url);

    const productId = searchParams.get("productId");
    const type = searchParams.get("type");
    const requestedBranchId = searchParams.get("branchId");
    const effectiveBranchId = requestedBranchId || activeBranchId || undefined;

    let list = fallbackStore.inventoryTransactions.filter(
      (t) => t.businessId === businessId
    );
    if (productId) list = list.filter((t) => t.productId === productId);
    if (type) list = list.filter((t) => t.type === type);
    if (effectiveBranchId) list = list.filter((t) => t.branchId === effectiveBranchId);

    return NextResponse.json({
      success: true,
      data: list,
      branchId: effectiveBranchId,
      isLockedToBranch,
      fallback: true,
    });
  }
}
