import { NextRequest, NextResponse } from "next/server";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { prisma } from "@/lib/prisma";
import { fallbackStore, storeAddCategory } from "@/lib/fallbackStore";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const businessId = await getActiveBusinessId(req);

    try {
      let categories = await prisma.category.findMany({
        where: { businessId },
        include: { _count: { select: { products: true } } },
        orderBy: { name: "asc" },
      });

      // If DB has no categories for this company yet, initialize starter defaults
      if (categories.length === 0) {
        const defaults = [
          { name: "MIX MOBILE", defaultHsCode: "8517.13", description: "Mobile phones and devices" },
          { name: "OLD SHOP MOBILE", defaultHsCode: "8517.13", description: "Used and pre-owned smartphones" },
          { name: "ACCESSORIES", defaultHsCode: "8517.79", description: "Chargers, cables, cases and accessories" },
        ];
        for (const def of defaults) {
          try {
            await prisma.category.create({
              data: {
                businessId,
                name: def.name,
                defaultHsCode: def.defaultHsCode,
                description: def.description,
              },
            });
          } catch {}
        }
        categories = await prisma.category.findMany({
          where: { businessId },
          include: { _count: { select: { products: true } } },
          orderBy: { name: "asc" },
        });
      }

      return NextResponse.json({
        success: true,
        data: categories.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          defaultHsCode: c.defaultHsCode,
          productCount: c._count.products,
        })),
      });
    } catch {
      let list = fallbackStore.categories.filter((c) => c.businessId === businessId);

      if (list.length === 0) {
        storeAddCategory({
          businessId,
          name: "General Inventory",
          defaultHsCode: "9999.99",
          description: "General goods & merchandise",
        });
        list = fallbackStore.categories.filter((c) => c.businessId === businessId);
      }

      return NextResponse.json({
        success: true,
        data: list.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description || "",
          defaultHsCode: c.defaultHsCode || "9999.99",
          productCount: fallbackStore.products.filter((p) => p.categoryId === c.id && p.businessId === businessId).length,
        })),
      });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const businessId = await getActiveBusinessId(req);
    const body = await req.json();
    const name = (body.name || "").trim();

    if (!name) {
      return NextResponse.json({ success: false, error: "Category name is required" }, { status: 400 });
    }

    const defaultHsCode = (body.defaultHsCode || "8517.13").trim();
    const description = (body.description || "").trim();

    try {
      const created = await prisma.category.create({
        data: {
          businessId,
          name,
          defaultHsCode,
          description,
        },
      });

      return NextResponse.json({
        success: true,
        data: created,
        message: `Category "${name}" created successfully.`,
      });
    } catch (err: any) {
      // Check if duplicate
      const existing = fallbackStore.categories.find(
        (c) => c.businessId === businessId && c.name.toLowerCase() === name.toLowerCase()
      );
      if (existing) {
        return NextResponse.json({ success: false, error: `Category "${name}" already exists.` }, { status: 400 });
      }

      const newCat = storeAddCategory({
        businessId,
        name,
        defaultHsCode,
        description,
      });

      return NextResponse.json({
        success: true,
        data: newCat,
        message: `Category "${name}" created successfully.`,
      });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
