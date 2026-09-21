import { NextRequest, NextResponse } from "next/server";
import { getSession, signSessionToken, TOKEN_NAME, ACTIVE_BIZ_COOKIE } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fallbackStore, storeSetActiveCompany } from "@/lib/fallbackStore";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { targetUserId } = body;

    const session = await getSession();
    if (!session || (session.role !== "SUPER_ADMIN" && !session.isSwitched)) {
      return NextResponse.json(
        { success: false, error: "Access denied. Only Super Admin has permission to switch user profiles." },
        { status: 403 }
      );
    }

    if (!targetUserId) {
      return NextResponse.json(
        { success: false, error: "Target user ID is required" },
        { status: 400 }
      );
    }

    let targetUser: any = null;

    // 1. Try DB lookup
    try {
      targetUser = await prisma.user.findUnique({
        where: { id: targetUserId },
        include: {
          memberships: {
            include: { business: true },
          },
        },
      });
    } catch {
      // Prisma offline, fallback
    }

    // 2. Fallback store lookup
    if (!targetUser) {
      targetUser = fallbackStore.users.find(
        (u) => u.id === targetUserId || u.email.toLowerCase() === targetUserId.toLowerCase()
      );
    }

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: "User not found in system" },
        { status: 404 }
      );
    }

    // Determine target user's primary company
    let targetBizId =
      targetUser.companyIds?.[0] ||
      targetUser.memberships?.[0]?.businessId ||
      fallbackStore.companies[0].id;

    let targetBiz =
      fallbackStore.companies.find((c) => c.id === targetBizId) ||
      fallbackStore.companies[0];

    storeSetActiveCompany(targetBiz.id);

    const payload = {
      userId: targetUser.id,
      email: targetUser.email,
      name: targetUser.name,
      role: targetUser.role,
      businessId: targetBiz.id,
      businessName: targetBiz.name,
      companyIds: targetUser.companyIds || (targetUser.memberships?.map((m: any) => m.businessId)) || [targetBiz.id],
      isSwitched: targetUser.role !== "SUPER_ADMIN",
    };

    const token = signSessionToken(payload);

    const response = NextResponse.json({
      success: true,
      user: payload,
      activeCompany: targetBiz,
      message: "Session switched to " + targetUser.name + " (" + targetUser.role + ")",
    });

    response.cookies.set(TOKEN_NAME, token, {
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
      httpOnly: true,
      sameSite: "lax",
    });

    response.cookies.set(ACTIVE_BIZ_COOKIE, targetBiz.id, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to switch user" },
      { status: 500 }
    );
  }
}
