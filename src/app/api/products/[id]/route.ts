import { NextRequest, NextResponse } from "next/server";
import { getProductById, updateProduct, archiveProduct, restoreProduct } from "@/services/productService";
import { prisma } from "@/lib/prisma";
import { fallbackStore } from "@/lib/fallbackStore";
import { getActiveBusinessId } from "@/lib/businessHelper";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const product = await getProductById(params.id);
    if (!product) {
      return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: product });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const updated = await updateProduct(params.id, body);
    return NextResponse.json({
      success: true,
      data: updated,
      message: "Product updated successfully",
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    if (action === "restore") {
      const restored = await restoreProduct(params.id);
      return NextResponse.json({ success: true, data: restored, message: "Product restored to active status" });
    }

    let businessId: string | null = null;
    try {
      businessId = await getActiveBusinessId(req);
    } catch {}

    // 1. Check if product is referenced in Sales or Purchases
    let canHardDelete = true;
    try {
      const [saleCount, purchaseCount] = await Promise.all([
        prisma.saleItem.count({ where: { productId: params.id } }),
        prisma.purchaseItem.count({ where: { productId: params.id } }),
      ]);
      if (saleCount > 0 || purchaseCount > 0) {
        canHardDelete = false;
      }
    } catch {
      canHardDelete = false;
    }

    if (canHardDelete) {
      try {
        await prisma.inventoryTransaction.deleteMany({ where: { productId: params.id } });
        await prisma.product.delete({
          where: {
            id: params.id,
            ...(businessId ? { businessId } : {}),
          },
        });

        const fIdx = fallbackStore.products.findIndex((p) => p.id === params.id);
        if (fIdx !== -1) fallbackStore.products.splice(fIdx, 1);

        return NextResponse.json({
          success: true,
          action: "DELETED",
          message: "Product completely deleted from catalog",
        });
      } catch {
        // Fallback to archive if foreign key or relation prevents hard delete
      }
    }

    const archived = await archiveProduct(params.id);
    const fIdx = fallbackStore.products.findIndex((p) => p.id === params.id);
    if (fIdx !== -1) {
      fallbackStore.products[fIdx].status = "ARCHIVED";
      fallbackStore.products[fIdx].isActive = false;
    }

    return NextResponse.json({
      success: true,
      action: "ARCHIVED",
      data: archived,
      message: "Product archived and removed from catalog",
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
