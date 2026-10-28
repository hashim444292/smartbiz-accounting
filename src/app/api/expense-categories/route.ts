import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { fallbackStore } from "@/lib/fallbackStore";

export const dynamic = "force-dynamic";

import { ensureDefaultCategories } from "@/services/expenseCategoryService";

export async function GET(req: NextRequest) {
  try {
    const businessId = await getActiveBusinessId(req);
    await ensureDefaultCategories(businessId);

    if (process.env.DATABASE_URL) {
      try {
        const categories = await prisma.expenseCategory.findMany({
          where: { businessId },
          orderBy: { name: "asc" },
        });
        return NextResponse.json({ success: true, data: categories });
      } catch (e) {
        console.error("DB error fetching expense categories, falling back:", e);
      }
    }

    const categories = fallbackStore.expenseCategories.filter((c) => c.businessId === businessId);
    return NextResponse.json({ success: true, data: categories, fallback: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const businessId = await getActiveBusinessId(req);
    const body = await req.json();
    const { name, description } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ success: false, error: "Category name is required" }, { status: 400 });
    }

    const trimmedName = name.trim();

    if (process.env.DATABASE_URL) {
      try {
        const existing = await prisma.expenseCategory.findUnique({
          where: { businessId_name: { businessId, name: trimmedName } },
        });
        if (existing) {
          return NextResponse.json({ success: false, error: "A category with this name already exists" }, { status: 400 });
        }

        const category = await prisma.expenseCategory.create({
          data: {
            businessId,
            name: trimmedName,
            description: description?.trim() || null,
            isDefault: false,
          },
        });

        // Also add to fallbackStore
        fallbackStore.expenseCategories.push({
          id: category.id,
          businessId,
          name: category.name,
          description: category.description,
          isDefault: false,
          createdAt: new Date(),
        } as any);

        return NextResponse.json({ success: true, data: category });
      } catch (e: any) {
        console.error("DB error creating expense category, falling back:", e);
      }
    }

    const existingStore = fallbackStore.expenseCategories.find(
      (c) => c.businessId === businessId && c.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (existingStore) {
      return NextResponse.json({ success: false, error: "A category with this name already exists" }, { status: 400 });
    }

    const newCategory = {
      id: `exp-cat-${Date.now()}`,
      businessId,
      name: trimmedName,
      description: description?.trim() || null,
      isDefault: false,
      createdAt: new Date(),
    };
    fallbackStore.expenseCategories.push(newCategory as any);

    return NextResponse.json({ success: true, data: newCategory, fallback: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
