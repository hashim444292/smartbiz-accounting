import { NextRequest, NextResponse } from "next/server";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { prisma } from "@/lib/prisma";
import { fallbackStore, storeDeleteCategory, storeUpdateCategory } from "@/lib/fallbackStore";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const businessId = await getActiveBusinessId(req);
    const categoryId = params.id;

    try {
      // Reassign products to null
      await prisma.product.updateMany({
        where: { categoryId, businessId },
        data: { categoryId: null },
      });

      await prisma.category.delete({
        where: { id: categoryId },
      });

      return NextResponse.json({
        success: true,
        message: "Category deleted successfully.",
      });
    } catch {
      const deleted = storeDeleteCategory(categoryId);
      if (!deleted) {
        return NextResponse.json({ success: false, error: "Category not found." }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        message: "Category deleted successfully.",
      });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const businessId = await getActiveBusinessId(req);
    const categoryId = params.id;
    const body = await req.json();

    const name = (body.name || "").trim();
    if (!name) {
      return NextResponse.json({ success: false, error: "Category name is required" }, { status: 400 });
    }

    try {
      const updated = await prisma.category.update({
        where: { id: categoryId },
        data: {
          name,
          defaultHsCode: body.defaultHsCode,
          description: body.description,
        },
      });

      return NextResponse.json({
        success: true,
        data: updated,
        message: `Category "${name}" updated successfully.`,
      });
    } catch {
      const updated = storeUpdateCategory(categoryId, {
        name,
        defaultHsCode: body.defaultHsCode,
        description: body.description,
      });

      if (!updated) {
        return NextResponse.json({ success: false, error: "Category not found." }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        data: updated,
        message: `Category "${name}" updated successfully.`,
      });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
