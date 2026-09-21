import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { ACTIVE_BIZ_COOKIE, TOKEN_NAME, verifySessionToken } from "@/lib/auth";
import { fallbackStore } from "@/lib/fallbackStore";
import { NextRequest } from "next/server";

/**
 * Resolves the active business/company ID, respecting selected company cookie and user session.
 */
export async function getActiveBusinessId(req?: NextRequest): Promise<string> {
  // 1. Try to read from explicit NextRequest headers or cookies if passed
  if (req) {
    const reqHeader = req.headers.get("x-business-id");
    if (reqHeader) return reqHeader;

    const reqCookie = req.cookies.get(ACTIVE_BIZ_COOKIE)?.value;
    if (reqCookie) return reqCookie;

    const token = req.cookies.get(TOKEN_NAME)?.value;
    if (token) {
      const session = verifySessionToken(token);
      if (session?.businessId) return session.businessId;
    }
  }

  // 2. Try to read from Next.js server-side cookies()
  try {
    const cookieStore = cookies();
    const cookieBiz = cookieStore.get(ACTIVE_BIZ_COOKIE)?.value;
    if (cookieBiz) return cookieBiz;

    const token = cookieStore.get(TOKEN_NAME)?.value;
    if (token) {
      const session = verifySessionToken(token);
      if (session?.businessId) return session.businessId;
    }
  } catch {
    // cookies() might fail in certain non-request contexts
  }

  // 3. Fallback store active business
  if (fallbackStore.activeBusinessId) {
    return fallbackStore.activeBusinessId;
  }
  if (fallbackStore.business?.id) {
    return fallbackStore.business.id;
  }

  // 4. Check Prisma database for existing business
  try {
    const business = await prisma.business.findFirst({
      orderBy: { createdAt: "asc" },
    });
    if (business) return business.id;

    // Create default business if none exists
    const created = await prisma.business.create({
      data: {
        name: "HANIF Mobile Center",
        ownerName: "Muhammad Hanif",
        currency: "PKR",
        currencySymbol: "Rs",
        country: "Pakistan",
        defaultPaymentTerms: 30,
        defaultTaxRate: 0,
        negativeStockPolicy: false,
      },
    });
    return created.id;
  } catch {
    return fallbackStore.business?.id || "biz-101";
  }
}
