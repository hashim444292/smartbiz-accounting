import { NextRequest, NextResponse } from "next/server";
import { getSession, signSessionToken, setSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fallbackStore, storeUpdateUser } from "@/lib/fallbackStore";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    const userId = session?.userId || "usr-1";
    const userEmail = session?.email || "admin@smartbiz.com";

    let dbUser: any = null;
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("DB_TIMEOUT")), 150)
      );
      dbUser = await Promise.race([
        prisma.user.findFirst({
          where: { OR: [{ id: userId }, { email: userEmail }] },
          include: {
            memberships: {
              include: { business: true },
            },
          },
        }),
        timeoutPromise,
      ]);
    } catch {
      // Prisma offline or timed out
    }

    if (dbUser) {
      const assignedCompanies = dbUser.memberships.map((m: any) => ({
        id: m.business.id,
        name: m.business.name,
        role: m.role,
      }));

      const activeBizId = req.cookies.get("sb_active_business_id")?.value || session?.businessId || assignedCompanies[0]?.id;
      const activeBiz = assignedCompanies.find((c: any) => c.id === activeBizId) || assignedCompanies[0];

      return NextResponse.json({
        success: true,
        user: {
          id: dbUser.id,
          name: dbUser.name,
          email: dbUser.email,
          role: dbUser.role,
          createdAt: dbUser.createdAt,
          activeCompany: activeBiz || null,
          companies: assignedCompanies,
        },
      });
    }

    // Fallback Store
    const fallbackUser =
      fallbackStore.users.find(
        (u) => u.id === userId || u.email.toLowerCase() === userEmail.toLowerCase()
      ) || fallbackStore.users[0];

    const assignedCompanies =
      fallbackUser.role === "SUPER_ADMIN"
        ? fallbackStore.companies.map((c) => ({ id: c.id, name: c.name, role: fallbackUser.role }))
        : fallbackStore.companies
            .filter((c) => fallbackUser.companyIds.includes(c.id))
            .map((c) => ({ id: c.id, name: c.name, role: fallbackUser.role }));

    const activeBizId = req.cookies.get("sb_active_business_id")?.value || fallbackStore.activeBusinessId;
    const activeBiz = assignedCompanies.find((c) => c.id === activeBizId) || assignedCompanies[0] || fallbackStore.companies[0];

    return NextResponse.json({
      success: true,
      user: {
        id: fallbackUser.id,
        name: fallbackUser.name,
        email: fallbackUser.email,
        role: fallbackUser.role,
        createdAt: fallbackUser.createdAt,
        activeCompany: activeBiz || null,
        companies: assignedCompanies,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load profile" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    const userId = session?.userId || "usr-1";
    const body = await req.json();
    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: "Display name cannot be empty" },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();

    // 1. Update DB if available
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("DB_TIMEOUT")), 150)
      );
      await Promise.race([
        prisma.user.update({
          where: { id: userId },
          data: { name: trimmedName },
        }),
        timeoutPromise,
      ]);
    } catch {
      // Prisma offline, fallback
    }

    // 2. Update Fallback store
    const updatedStoreUser = storeUpdateUser(userId, { name: trimmedName });

    // 3. Update JWT cookie if session exists
    if (session) {
      const newPayload = {
        ...session,
        name: trimmedName,
      };
      const newToken = signSessionToken(newPayload);
      setSessionCookie(newToken);
    }

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
      name: trimmedName,
      user: updatedStoreUser,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update profile" },
      { status: 500 }
    );
  }
}
