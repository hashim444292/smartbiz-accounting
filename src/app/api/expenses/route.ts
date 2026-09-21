import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { createAndPostExpense } from "@/services/expenseService";
import { fallbackStore } from "@/lib/fallbackStore";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const businessId = await getActiveBusinessId(req);
    const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("DB_TIMEOUT")), 150));
    const [expenses, categories, accounts] = await Promise.race([
      Promise.all([
        prisma.expense.findMany({
          where: { businessId },
          include: { category: true, account: true },
          orderBy: { date: "desc" },
          take: 100,
        }),
        prisma.expenseCategory.findMany({
          where: { businessId },
          orderBy: { name: "asc" },
        }),
        prisma.cashBankAccount.findMany({
          where: { businessId, isActive: true },
        }),
      ]),
      timeoutPromise,
    ]);

    return NextResponse.json({ success: true, data: { expenses, categories, accounts } });
  } catch (error: any) {
    const businessId = await getActiveBusinessId(req);
    return NextResponse.json({
      success: true,
      data: {
        expenses: fallbackStore.expenses.filter((e) => e.businessId === businessId),
        categories: fallbackStore.expenseCategories.filter((c) => c.businessId === businessId),
        accounts: fallbackStore.cashBankAccounts.filter((a) => a.businessId === businessId),
      },
      fallback: true,
    });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  try {
    const businessId = await getActiveBusinessId(req);
    const expense = await createAndPostExpense({
      businessId,
      ...body,
    });

    return NextResponse.json({ success: true, data: expense });
  } catch (error: any) {
    const businessId = await getActiveBusinessId(req);
    const amt = Number(body.amount || 0);

    // Deduct from Cash/Bank account
    const isBank = body.paymentMethod === "BANK";
    const acc = fallbackStore.cashBankAccounts.find(
      (a) => a.businessId === businessId && (isBank ? a.type === "BANK" : a.type === "CASH")
    );
    if (acc) {
      acc.balance -= amt;
    }

    const cat = fallbackStore.expenseCategories.find((c) => c.id === body.categoryId && c.businessId === businessId);

    const newExpense = {
      id: `exp-${Date.now()}`,
      businessId,
      categoryId: body.categoryId,
      category: { name: cat?.name || "General" },
      date: body.date || new Date().toISOString(),
      description: body.description || "Business Expense",
      amount: amt,
      paymentMethod: body.paymentMethod || "CASH",
      paidTo: body.paidTo || null,
      notes: body.notes || null,
    };

    fallbackStore.expenses.unshift(newExpense);
    return NextResponse.json({ success: true, data: newExpense, fallback: true });
  }
}
