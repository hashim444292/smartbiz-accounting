import { NextRequest, NextResponse } from "next/server";
import { getSession, getActiveBusinessCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fallbackStore } from "@/lib/fallbackStore";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    const reqCookie = req.cookies.get("sb_active_business_id")?.value;
    const activeCookie = reqCookie || getActiveBusinessCookie() || fallbackStore.activeBusinessId;

    // 1. If user is logged in
    if (session) {
      let accessibleCompanies: any[] = [];
      let activeCompany: any = null;

      try {
        if (session.role === "SUPER_ADMIN") {
          accessibleCompanies = await prisma.business.findMany({
            orderBy: { name: "asc" },
          });
        } else {
          const memberships = await prisma.businessMember.findMany({
            where: { userId: session.userId },
            include: { business: true },
          });
          accessibleCompanies = memberships.map((m: any) => m.business);
        }

        const targetId = activeCookie || session.businessId;
        activeCompany =
          accessibleCompanies.find((c) => c.id === targetId) ||
          accessibleCompanies[0] ||
          (await prisma.business.findUnique({ where: { id: targetId } }));
      } catch {
        // Fallback store
        if (session.role === "SUPER_ADMIN") {
          accessibleCompanies = fallbackStore.companies;
        } else {
          const userCompanyIds = session.companyIds || [session.businessId];
          accessibleCompanies = fallbackStore.companies.filter((c) =>
            userCompanyIds.includes(c.id)
          );
          if (accessibleCompanies.length === 0) {
            accessibleCompanies = [fallbackStore.companies[0]];
          }
        }

        const targetId = activeCookie || session.businessId;
        activeCompany =
          accessibleCompanies.find((c) => c.id === targetId) ||
          accessibleCompanies[0] ||
          fallbackStore.companies[0];
      }

      if (activeCompany) {
        fallbackStore.activeBusinessId = activeCompany.id;
        fallbackStore.business = activeCompany;
      }

      let branches: any[] = [];
      try {
        branches = await prisma.branch.findMany({
          where: { businessId: activeCompany.id, isActive: true },
          orderBy: { name: "asc" },
        });
      } catch {
        branches = fallbackStore.branches ? fallbackStore.branches.filter((b) => b.businessId === activeCompany.id && b.isActive) : [];
      }

      const liveUser = fallbackStore.users.find((u) => u.id === session.userId);

      return NextResponse.json({
        success: true,
        authenticated: true,
        user: {
          ...session,
          businessId: activeCompany?.id || session.businessId,
          businessName: activeCompany?.name || session.businessName,
          branchId: liveUser?.branchId !== undefined ? liveUser.branchId : (session.branchId || null),
          branchName: liveUser?.branchName !== undefined ? liveUser.branchName : (session.branchName || null),
          canCreateBranches: Boolean(activeCompany?.canCreateBranches),
        },
        activeCompany: activeCompany || {
          id: session.businessId,
          name: session.businessName,
        },
        companies: accessibleCompanies,
        branches,
      });
    }

    // 2. Unauthenticated default state (fallback for easy preview)
    const activeBiz =
      fallbackStore.companies.find((c) => c.id === activeCookie) ||
      fallbackStore.companies.find((c) => c.id === fallbackStore.activeBusinessId) ||
      fallbackStore.companies[0];

    fallbackStore.activeBusinessId = activeBiz.id;
    fallbackStore.business = activeBiz;

    const unauthBranches = fallbackStore.branches ? fallbackStore.branches.filter((b) => b.businessId === activeBiz.id && b.isActive) : [];

    return NextResponse.json({
      success: true,
      authenticated: false,
      user: {
        userId: "usr-1",
        email: "admin@smartbiz.com",
        name: "System Super Admin",
        role: "SUPER_ADMIN",
        businessId: activeBiz.id,
        businessName: activeBiz.name,
        companyIds: fallbackStore.companies.map((c) => c.id),
        branchId: null,
        branchName: null,
        canCreateBranches: Boolean(activeBiz.canCreateBranches),
      },
      activeCompany: activeBiz,
      companies: fallbackStore.companies,
      branches: unauthBranches,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch session" },
      { status: 500 }
    );
  }
}
