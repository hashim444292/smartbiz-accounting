import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { ACTIVE_BIZ_COOKIE, ACTIVE_BRANCH_COOKIE, TOKEN_NAME, verifySessionToken } from "@/lib/auth";
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

  // 2. Read from next/headers cookies() store (Server Components & Route Handlers)
  try {
    const cookieStore = cookies();
    const activeBiz = cookieStore.get(ACTIVE_BIZ_COOKIE)?.value;
    if (activeBiz) return activeBiz;

    const token = cookieStore.get(TOKEN_NAME)?.value;
    if (token) {
      const session = verifySessionToken(token);
      if (session?.businessId) return session.businessId;
    }
  } catch {}

  // 3. Fallback: Find default or first business in system
  try {
    const firstBiz = await prisma.business.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (firstBiz?.id) return firstBiz.id;
  } catch {
    // DB not connected, fallback to in-memory fallbackStore
    if (fallbackStore.companies && fallbackStore.companies.length > 0) {
      return fallbackStore.companies[0].id;
    }
  }

  return "biz-101";
}

/**
 * Resolves the active branch ID for multi-branch accounting:
 * - If user has role STAFF and is locked to a branch, returns that branch strictly (user cannot switch).
 * - If user is OWNER_ADMIN or SUPER_ADMIN, returns selected branch from query (?branchId=), header (x-branch-id), or cookie (sb_active_branch_id).
 * - If "all" or empty or null, returns null (meaning Consolidated / All Branches).
 */
export async function getActiveBranchId(
  req?: NextRequest,
  sessionOverride?: { role?: string; branchId?: string | null } | null
): Promise<{
  branchId: string | null;
  isLockedToBranch: boolean;
}> {
  let userSessionBranchId: string | null = sessionOverride?.branchId ?? null;
  let userRole: string | null = sessionOverride?.role ?? null;

  if (!sessionOverride) {
    try {
      let token: string | undefined;
      if (req) {
        token = req.cookies.get(TOKEN_NAME)?.value;
      }
      if (!token) {
        const cookieStore = cookies();
        token = cookieStore.get(TOKEN_NAME)?.value;
      }
      if (token) {
        const session = verifySessionToken(token);
        if (session) {
          userRole = session.role;
          userSessionBranchId = session.branchId || null;
        }
      }
    } catch {}
  }

  // If user is locked to a branch (STAFF / branch user), enforce it strictly
  if (userSessionBranchId && userRole !== "SUPER_ADMIN" && userRole !== "OWNER_ADMIN") {
    return {
      branchId: userSessionBranchId,
      isLockedToBranch: true,
    };
  }

  // Otherwise, user has authority across branches: check query param, header, or cookie
  if (req) {
    const queryBranch = req.nextUrl?.searchParams?.get("branchId");
    if (queryBranch) {
      return {
        branchId: queryBranch === "all" ? null : queryBranch,
        isLockedToBranch: false,
      };
    }

    const headerBranch = req.headers.get("x-branch-id");
    if (headerBranch) {
      return {
        branchId: headerBranch === "all" ? null : headerBranch,
        isLockedToBranch: false,
      };
    }

    const cookieBranch = req.cookies.get(ACTIVE_BRANCH_COOKIE)?.value;
    if (cookieBranch) {
      return {
        branchId: cookieBranch === "all" ? null : cookieBranch,
        isLockedToBranch: false,
      };
    }
  }

  try {
    const cookieStore = cookies();
    const cookieBranch = cookieStore.get(ACTIVE_BRANCH_COOKIE)?.value;
    if (cookieBranch) {
      return {
        branchId: cookieBranch === "all" ? null : cookieBranch,
        isLockedToBranch: false,
      };
    }
  } catch {}

  return {
    branchId: null,
    isLockedToBranch: false,
  };
}
