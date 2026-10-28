import { prisma } from "@/lib/prisma";
import { fallbackStore } from "@/lib/fallbackStore";

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
  if (!businessId) return;

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
