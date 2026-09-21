import { NextRequest, NextResponse } from "next/server";
import { getSession, signSessionToken, setSessionCookie, setActiveBusinessCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fallbackStore, storeSetActiveCompany } from "@/lib/fallbackStore";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { businessId } = body;

    if (!businessId) {
      return NextResponse.json(
        { success: false, error: "Business ID is required" },
        { status: 400 }
      );
    }

    let companyName = "Company";
    let found = false;

    // 1. Fast-path: Check fallback store first (< 1ms)
    const fbBiz = fallbackStore.companies.find((c) => c.id === businessId);
    if (fbBiz) {
      companyName = fbBiz.name;
      found = true;
      storeSetActiveCompany(businessId);
    }

    // 2. Check DB with short timeout if not in fallback
    if (!found) {
      try {
        const bizPromise = prisma.business.findUnique({ where: { id: businessId } });
        const timeoutPromise = new Promise<null>((_, reject) => setTimeout(() => reject(new Error("DB_TIMEOUT")), 150));
        const biz: any = await Promise.race([bizPromise, timeoutPromise]);
        if (biz) {
          companyName = biz.name;
          found = true;
        }
      } catch {
        // Ignore DB error / offline
      }
    }

    // 3. Fallback active company
    storeSetActiveCompany(businessId);
    fallbackStore.activeBusinessId = businessId;

    // Refresh session if present
    let newToken: string | null = null;
    const session = await getSession();
    if (session) {
      const updatedPayload: any = {
        ...session,
        businessId,
        businessName: companyName,
      };
      delete updatedPayload.iat;
      delete updatedPayload.exp;
      newToken = signSessionToken(updatedPayload);
    } else {
      // Create session for default admin user with this businessId
      const adminUser = fallbackStore.users[0];
      const payload: any = {
        userId: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        role: adminUser.role as any,
        businessId,
        businessName: companyName,
        companyIds: adminUser.companyIds,
      };
      newToken = signSessionToken(payload);
    }

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
    });

    if (newToken) {
      response.cookies.set("sb_auth_token", newToken, {
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
        httpOnly: true,
        sameSite: "lax",
      });
    }

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to switch company" },
      { status: 500 }
    );
  }
}
