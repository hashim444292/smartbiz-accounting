import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { getSession } from "@/lib/auth";
import { fallbackStore, storeGetBranches, storeAddBranch } from "@/lib/fallbackStore";
import { round2 } from "@/lib/decimal";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const businessId = await getActiveBusinessId(req);

    let branches: any[] = [];
    let sales: any[] = [];
    let expenses: any[] = [];
    let users: any[] = [];

    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("DB_TIMEOUT")), 200)
      );

      [branches, sales, expenses, users] = await Promise.race([
        Promise.all([
          prisma.branch.findMany({
            where: { businessId },
            orderBy: { createdAt: "asc" },
          }),
          prisma.sale.findMany({
            where: { businessId },
            select: { id: true, branchId: true, totalAmount: true },
          }),
          prisma.expense.findMany({
            where: { businessId },
            select: { id: true, branchId: true, amount: true },
          }),
          prisma.user.findMany({
            select: { id: true, name: true, email: true, role: true, branchId: true, isBranchManager: true },
          }),
        ]),
        timeoutPromise,
      ]);
    } catch {
      branches = storeGetBranches(businessId);
      sales = fallbackStore.sales.filter((s) => s.businessId === businessId);
      expenses = fallbackStore.expenses.filter((e) => e.businessId === businessId);
      users = fallbackStore.users.filter((u) => u.companyIds && u.companyIds.includes(businessId));
    }

    // Attach computed branch statistics
    const branchesWithStats = branches.map((b) => {
      const branchSales = sales.filter((s) => s.branchId === b.id);
      const branchExpenses = expenses.filter((e) => e.branchId === b.id);
      const branchStaff = users.filter((u) => u.branchId === b.id);

      const totalSales = branchSales.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);
      const totalExpenses = branchExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

      return {
        ...b,
        staffCount: branchStaff.length,
        staffMembers: branchStaff.map((u: any) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          isBranchManager: Boolean(u.isBranchManager),
        })),
        totalSales: round2(totalSales),
        totalExpenses: round2(totalExpenses),
        netProfit: round2(totalSales - totalExpenses),
      };
    });

    return NextResponse.json({
      success: true,
      data: branchesWithStats,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch branches" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (session && session.role !== "SUPER_ADMIN" && session.role !== "OWNER_ADMIN") {
      return NextResponse.json(
        { success: false, error: "Access denied. Only Business Owners and Super Admins can create branches." },
        { status: 403 }
      );
    }

    const businessId = await getActiveBusinessId(req);
    const body = await req.json();

    if (!body.name || !body.name.trim()) {
      return NextResponse.json(
        { success: false, error: "Branch name is required." },
        { status: 400 }
      );
    }

    // Validate Super Admin authorization gate
    let canCreateBranches = false;
    try {
      const comp = await prisma.business.findUnique({ where: { id: businessId } });
      canCreateBranches = Boolean(comp?.canCreateBranches);
    } catch {
      const comp = fallbackStore.companies.find((c) => c.id === businessId);
      canCreateBranches = Boolean(comp?.canCreateBranches);
    }

    if (!canCreateBranches && session?.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        {
          success: false,
          error: "Multi-Branch Management is not enabled for your company. Please contact the Super Admin to authorize sub-branches for your account.",
        },
        { status: 403 }
      );
    }

    const branchData = {
      businessId,
      name: body.name.trim(),
      code: body.code?.trim() || `BR-${Date.now().toString().slice(-3)}`,
      address: body.address?.trim() || null,
      city: body.city?.trim() || "Karachi",
      phone: body.phone?.trim() || null,
      email: body.email?.trim() || null,
      managerName: body.managerName?.trim() || null,
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
    };

    try {
      const newBranch = await prisma.branch.create({
        data: branchData,
      });
      return NextResponse.json({
        success: true,
        data: newBranch,
        message: "Branch created successfully",
      });
    } catch {
      const fallbackBranch = storeAddBranch(branchData);
      return NextResponse.json({
        success: true,
        data: fallbackBranch,
        message: "Branch created successfully in fallback store",
        fallback: true,
      });
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create branch" },
      { status: 500 }
    );
  }
}
