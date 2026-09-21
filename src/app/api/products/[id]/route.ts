import { NextRequest, NextResponse } from "next/server";
import { getProductById, updateProduct, archiveProduct, restoreProduct } from "@/services/productService";

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

    const archived = await archiveProduct(params.id);
    return NextResponse.json({ success: true, data: archived, message: "Product archived successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
