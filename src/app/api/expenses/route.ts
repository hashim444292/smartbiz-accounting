import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveBusinessId, getActiveBranchId } from "@/lib/businessHelper";
import { createAndPostExpense } from "@/services/expenseService";
import { fallbackStore } from "@/lib/fallbackStore";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const businessId = await getActiveBusinessId(req);
    const { branchId, isLockedToBranch } = await getActiveBranchId(req);
    const whereClause: any = { businessId };
    if (branchId) {
      whereClause.branchId = branchId;
    }

    const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("DB_TIMEOUT")), 150));
    const [expenses, categories, accounts] = await Promise.race([
      Promise.all([
        prisma.expense.findMany({
          where: whereClause,
          include: { category: true, account: true, branch: true },
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

    return NextResponse.json({ success: true, data: { expenses, categories, accounts, branchId, isLockedToBranch } });
  } catch (error: any) {
    const businessId = await getActiveBusinessId(req);
    const { branchId, isLockedToBranch } = await getActiveBranchId(req);
    let filtered = fallbackStore.expenses.filter((e) => e.businessId === businessId);
    if (branchId) {
      filtered = filtered.filter((e) => e.branchId === branchId);
    }
    return NextResponse.json({
      success: true,
      data: {
        expenses: filtered,
        categories: fallbackStore.expenseCategories.filter((c) => c.businessId === businessId),
        accounts: fallbackStore.cashBankAccounts.filter((a) => a.businessId === businessId),
        branchId,
        isLockedToBranch,
      },
      fallback: true,
    });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  try {
    const session = await getSession();
    const businessId = await getActiveBusinessId(req);
    const { branchId: activeBranchId } = await getActiveBranchId(req);
    const effectiveBranchId = body.branchId || activeBranchId || null;
    const createdById = session?.userId || body.createdById || "usr-3";
    const createdByName = session?.name || body.createdByName || "Farhan Accountant";

    const expense = await createAndPostExpense({
      businessId,
      branchId: effectiveBranchId,
      createdById,
      createdByName,
      ...body,
    });

    return NextResponse.json({ success: true, data: expense });
  } catch (error: any) {
    const session = await getSession();
    const businessId = await getActiveBusinessId(req);
    const { branchId: activeBranchId } = await getActiveBranchId(req);
    const effectiveBranchId = body.branchId || activeBranchId || null;
    const branchObj = fallbackStore.branches?.find((b) => b.id === effectiveBranchId);
    const amt = Number(body.amount || 0);
    const createdById = session?.userId || body.createdById || "usr-3";
    const createdByName = session?.name || body.createdByName || "Farhan Accountant";

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
      branchId: effectiveBranchId,
      branchName: branchObj?.name || null,
      categoryId: body.categoryId,
      category: { name: cat?.name || "General" },
      date: body.date || new Date().toISOString(),
      description: body.description || "Business Expense",
      amount: amt,
      paymentMethod: body.paymentMethod || "CASH",
      paidTo: body.paidTo || null,
      notes: body.notes || null,
      createdById,
      createdByName,
      updatedById: null,
      updatedByName: null,
      isEdited: false,
      editCount: 0,
      editReason: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    fallbackStore.expenses.unshift(newExpense);

    if (!fallbackStore.auditLogs) fallbackStore.auditLogs = [];
    fallbackStore.auditLogs.unshift({
      id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      businessId,
      userId: createdById,
      userName: createdByName,
      branchId: effectiveBranchId,
      action: "CREATE_EXPENSE",
      entity: "Expense",
      entityId: newExpense.id,
      details: `Recorded Expense: ${newExpense.description} - Rs ${amt.toLocaleString()}`,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, data: newExpense, fallback: true });
  }
}
