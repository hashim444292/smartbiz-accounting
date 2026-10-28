import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { fallbackStore } from "@/lib/fallbackStore";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const businessId = await getActiveBusinessId(req);
    const { id } = params;
    const body = await req.json();
    const { name, description } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ success: false, error: "Category name is required" }, { status: 400 });
    }

    const trimmedName = name.trim();

    if (process.env.DATABASE_URL) {
      try {
        const existingWithSameName = await prisma.expenseCategory.findFirst({
          where: {
            businessId,
            name: trimmedName,
            id: { not: id },
          },
        });
        if (existingWithSameName) {
          return NextResponse.json({ success: false, error: "Another category with this name already exists" }, { status: 400 });
        }

        const updated = await prisma.expenseCategory.update({
          where: { id },
          data: {
            name: trimmedName,
            description: description?.trim() || null,
          },
        });

        // Sync fallbackStore
        const storeIdx = fallbackStore.expenseCategories.findIndex((c) => c.id === id);
        if (storeIdx >= 0) {
          fallbackStore.expenseCategories[storeIdx].name = trimmedName;
          fallbackStore.expenseCategories[storeIdx].description = description?.trim() || null;
        }

        return NextResponse.json({ success: true, data: updated });
      } catch (e: any) {
        console.error("DB error updating expense category, falling back:", e);
      }
    }

    const storeIdx = fallbackStore.expenseCategories.findIndex((c) => c.id === id);
    if (storeIdx >= 0) {
      fallbackStore.expenseCategories[storeIdx].name = trimmedName;
      fallbackStore.expenseCategories[storeIdx].description = description?.trim() || null;
      return NextResponse.json({ success: true, data: fallbackStore.expenseCategories[storeIdx], fallback: true });
    }

    return NextResponse.json({ success: false, error: "Category not found" }, { status: 404 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const businessId = await getActiveBusinessId(req);
    const { id } = params;

    if (process.env.DATABASE_URL) {
      try {
        const expensesCount = await prisma.expense.count({ where: { categoryId: id } });
        if (expensesCount > 0) {
          return NextResponse.json({
            success: false,
            error: `Cannot delete category because it has ${expensesCount} expense records attached. Please reassign or delete those expenses first.`,
          }, { status: 400 });
        }

        await prisma.expenseCategory.delete({ where: { id } });

        const storeIdx = fallbackStore.expenseCategories.findIndex((c) => c.id === id);
        if (storeIdx >= 0) {
          fallbackStore.expenseCategories.splice(storeIdx, 1);
        }

        return NextResponse.json({ success: true, message: "Category deleted successfully" });
      } catch (e: any) {
        console.error("DB error deleting expense category, falling back:", e);
      }
    }

    const storeExpenseCount = fallbackStore.expenses.filter((e) => e.categoryId === id).length;
    if (storeExpenseCount > 0) {
      return NextResponse.json({
        success: false,
        error: `Cannot delete category because it has ${storeExpenseCount} expense records attached.`,
      }, { status: 400 });
    }

    const storeIdx = fallbackStore.expenseCategories.findIndex((c) => c.id === id);
    if (storeIdx >= 0) {
      fallbackStore.expenseCategories.splice(storeIdx, 1);
      return NextResponse.json({ success: true, message: "Category deleted successfully", fallback: true });
    }

    return NextResponse.json({ success: false, error: "Category not found" }, { status: 404 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
