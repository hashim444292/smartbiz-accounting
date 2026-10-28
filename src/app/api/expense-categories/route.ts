import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { fallbackStore } from "@/lib/fallbackStore";

export const dynamic = "force-dynamic";

export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: "Rent & Office Space (کرایہ دکان / گودام)", description: "Store and warehouse rent" },
  { name: "Salaries & Wages (تنخواہیں و اجرت)", description: "Staff monthly salaries and daily wages" },
  { name: "Electricity & Utilities (بجلی و یوٹیلیٹی)", description: "WAPDA / K-Electric, gas and water bills" },
  { name: "Mobile & Internet (موبائل و انٹرنیٹ)", description: "Office internet connection and mobile balance" },
  { name: "Transport & Fuel (ٹرانسپورٹ و پیٹرول)", description: "Delivery conveyance, vehicle fuel and cargo freight" },
  { name: "Office Supplies & Stationery (دفتری سامان)", description: "Receipt rolls, printer paper, toner and stationery" },
  { name: "Tea & Refreshments (چائے و ریفریشمنٹ)", description: "Daily guest tea, mineral water and staff refreshments" },
  { name: "Repairs & Maintenance (مرمت و مینٹیننس)", description: "Shop repairs, electrical fixes and hardware service" },
  { name: "Marketing & Promotion (مارکیٹنگ و تشہیر)", description: "Social media ads, banners and promotional printing" },
  { name: "Bank Charges & Taxes (بینک چارجز)", description: "Bank statement fee, cheque book charges and withholding" },
  { name: "General & Miscellaneous (متفرق اخراجات)", description: "Other general operational expenses" },
];

export async function ensureDefaultCategories(businessId: string) {
  if (process.env.DATABASE_URL) {
    try {
      const existing = await prisma.expenseCategory.count({ where: { businessId } });
      if (existing === 0) {
        for (const cat of DEFAULT_EXPENSE_CATEGORIES) {
          await prisma.expenseCategory.upsert({
            where: { businessId_name: { businessId, name: cat.name } },
            update: {},
            create: {
              businessId,
              name: cat.name,
              description: cat.description,
              isDefault: true,
            },
          });
        }
      }
    } catch (e) {
      console.error("Failed to seed default expense categories in DB:", e);
    }
  }

  // Also seed fallbackStore
  const storeCount = fallbackStore.expenseCategories.filter((c) => c.businessId === businessId).length;
  if (storeCount === 0) {
    DEFAULT_EXPENSE_CATEGORIES.forEach((cat, idx) => {
      fallbackStore.expenseCategories.push({
        id: `exp-cat-${businessId}-${idx + 1}`,
        businessId,
        name: cat.name,
        description: cat.description,
        isDefault: true,
        createdAt: new Date(),
      } as any);
    });
  }
}

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
