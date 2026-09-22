import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { Role } from "@prisma/client";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-accounting-jwt-key-2026";
export const TOKEN_NAME = "sb_auth_token";
export const ACTIVE_BIZ_COOKIE = "sb_active_business_id";
export const ACTIVE_BRANCH_COOKIE = "sb_active_branch_id";

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  role: Role;
  businessId: string;
  businessName: string;
  companyIds?: string[];
  branchId?: string | null;
  branchName?: string | null;
  canCreateBranches?: boolean;
  isSwitched?: boolean;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signSessionToken(payload: SessionPayload): string {
  const cleanPayload = { ...payload } as any;
  delete cleanPayload.iat;
  delete cleanPayload.exp;
  return jwt.sign(cleanPayload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(TOKEN_NAME)?.value;
    if (!token) return null;
    return verifySessionToken(token);
  } catch {
    return null;
  }
}

export async function requireAuth(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

export async function requireRole(allowedRoles: Role[]): Promise<SessionPayload> {
  const session = await requireAuth();
  if (session.role === "SUPER_ADMIN") {
    return session; // Super Admin has unrestricted access to everything
  }
  if (!allowedRoles.includes(session.role)) {
    throw new Error("FORBIDDEN: Insufficient permissions");
  }
  return session;
}

export function setSessionCookie(token: string) {
  const cookieStore = cookies();
  cookieStore.set(TOKEN_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export function setActiveBusinessCookie(businessId: string) {
  const cookieStore = cookies();
  cookieStore.set(ACTIVE_BIZ_COOKIE, businessId, {
    httpOnly: false, // accessible to client for quick state sync
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export function getActiveBusinessCookie(): string | null {
  try {
    const cookieStore = cookies();
    return cookieStore.get(ACTIVE_BIZ_COOKIE)?.value || null;
  } catch {
    return null;
  }
}

export function setActiveBranchCookie(branchId: string | null) {
  try {
    const cookieStore = cookies();
    if (!branchId || branchId === "all") {
      cookieStore.delete(ACTIVE_BRANCH_COOKIE);
    } else {
      cookieStore.set(ACTIVE_BRANCH_COOKIE, branchId, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
    }
  } catch {}
}

export function getActiveBranchCookie(): string | null {
  try {
    const cookieStore = cookies();
    const val = cookieStore.get(ACTIVE_BRANCH_COOKIE)?.value;
    return val && val !== "all" && val !== "" ? val : null;
  } catch {
    return null;
  }
}

export function clearSessionCookie() {
  const cookieStore = cookies();
  cookieStore.delete(TOKEN_NAME);
  cookieStore.delete(ACTIVE_BIZ_COOKIE);
  cookieStore.delete(ACTIVE_BRANCH_COOKIE);
}
