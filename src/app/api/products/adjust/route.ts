import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { performStockAdjustment } from "@/services/inventoryService";
import { fallbackStore } from "@/lib/fallbackStore";

export async function POST(req: NextRequest) {
  const body = await req.json();

  try {
    const businessId = await getActiveBusinessId(req);

    const result = await prisma.$transaction(async (tx) => {
      return await performStockAdjustment(tx, {
        businessId,
        productId: body.productId,
        targetStock: body.targetStock,
        reason: body.reason || "PHYSICAL_COUNT",
        notes: body.notes,
      });
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    if (error.message?.includes("Can't reach database server") || error.code === "P1001" || !process.env.DATABASE_URL) {
      const prod = fallbackStore.products.find((p) => p.id === body.productId);
      if (!prod) {
        return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });
      }

      const prev = prod.currentStock;
      const target = Number(body.targetStock);
      const diff = target - prev;
      prod.currentStock = target;

      const txRecord = {
        id: `itx-${Date.now()}`,
        productId: prod.id,
        product: { name: prod.name },
        type: "ADJUSTMENT",
        quantity: diff,
        unitCost: prod.averageCost,
        totalCost: Math.abs(diff) * prod.averageCost,
        date: new Date().toISOString(),
        notes: `Adjustment (${body.reason || "PHYSICAL_COUNT"}): ${prev} -> ${target}. ${body.notes || ""}`,
      };

      fallbackStore.inventoryTransactions.unshift(txRecord);

      return NextResponse.json({
        success: true,
        data: {
          product: prod,
          adjustmentQuantity: diff,
          newStock: target,
        },
        fallback: true,
      });
    }

    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
