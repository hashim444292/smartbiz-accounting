import { NextRequest, NextResponse } from "next/server";
import { getSession, signSessionToken, setSessionCookie, setActiveBusinessCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fallbackStore, storeSetActiveCompany } from "@/lib/fallbackStore";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required to switch company" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { businessId } = body;

    if (!businessId) {
      return NextResponse.json(
        { success: false, error: "Business ID is required" },
        { status: 400 }
      );
    }

    // Check authorization: SUPER_ADMIN can switch to any company.
    // Other users can only switch to companies they belong to.
    let isAuthorized =
      session.role === "SUPER_ADMIN" ||
      session.businessId === businessId ||
      Boolean(session.companyIds?.includes(businessId));

    if (!isAuthorized && process.env.DATABASE_URL) {
      try {
        const membership = await prisma.businessMember.findFirst({
          where: { userId: session.userId, businessId },
        });
        if (membership) {
          isAuthorized = true;
        }
      } catch (err: any) {
        console.error("switch-company membership check error:", err?.message || err);
      }
    }

    if (!isAuthorized) {
      const fbUser = fallbackStore.users.find((u) => u.id === session.userId);
      if (fbUser && (fbUser.businessId === businessId || fbUser.companyIds?.includes(businessId))) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: "Access denied. You do not have permission to access this company." },
        { status: 403 }
      );
    }

    let companyName = "Company";
    let found = false;

    // 1. Check DB first if configured
    if (process.env.DATABASE_URL) {
      try {
        const biz = await prisma.business.findUnique({ where: { id: businessId } });
        if (biz) {
          companyName = biz.name;
          found = true;
        }
      } catch (err: any) {
        console.error("switch-company DB lookup error:", err?.message || err);
      }
    }

    // 2. Fallback store if DB didn't find or errored
    if (!found) {
      const fbBiz = fallbackStore.companies.find((c) => c.id === businessId);
      if (fbBiz) {
        companyName = fbBiz.name;
        found = true;
      }
    }

    if (!found) {
      return NextResponse.json(
        { success: false, error: "Target company not found" },
        { status: 404 }
      );
    }

    // Sync in-memory fallback store as well
    storeSetActiveCompany(businessId);
    fallbackStore.activeBusinessId = businessId;

    // Refresh session with new active businessId
    const updatedPayload: any = {
      ...session,
      businessId,
      businessName: companyName,
      isSwitched: true,
    };
    delete updatedPayload.iat;
    delete updatedPayload.exp;
    const newToken = signSessionToken(updatedPayload);

    const isProd = process.env.NODE_ENV === "production";
    const response = NextResponse.json({
      success: true,
      businessId,
      businessName: companyName,
      message: `Active company switched to ${companyName}`,
    });

    response.cookies.set("sb_active_business_id", businessId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
      secure: isProd,
    });

    response.cookies.set("sb_auth_token", newToken, {
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to switch company" },
      { status: 500 }
    );
  }
}
