import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { getSession, hashPassword } from "@/lib/auth";
import {
  fallbackStore,
  storeGetCompanyUsers,
  storeAddCompanyUser,
} from "@/lib/fallbackStore";

export const dynamic = "force-dynamic";

/**
 * GET /api/branches/users
 * Returns all users belonging to the active company, including their assigned branch and manager status.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const businessId = await getActiveBusinessId(req);

    if (!process.env.DATABASE_URL) {
      const users = storeGetCompanyUsers(businessId);
      return NextResponse.json({ success: true, data: users, fallback: true });
    }

    try {
      const dbUsers = await prisma.user.findMany({
        where: {
          memberships: {
            some: { businessId },
          },
        },
        include: {
          branch: {
            select: { id: true, name: true, code: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      const formatted = dbUsers.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        phone: u.phone || null,
        isBranchManager: Boolean(u.isBranchManager),
        branchId: u.branchId || null,
        branchName: u.branch?.name || null,
        branchCode: u.branch?.code || null,
        createdAt: u.createdAt,
      }));

      return NextResponse.json({ success: true, data: formatted });
    } catch {
      // Fallback
      const users = storeGetCompanyUsers(businessId);
      return NextResponse.json({ success: true, data: users, fallback: true });
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch company users" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/branches/users
 * Allows Company Owner or Super Admin to create a new branch manager or staff user.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "OWNER_ADMIN" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json(
        { success: false, error: "Only Company Owners and Super Admins can add branch staff." },
        { status: 403 }
      );
    }

    const businessId = await getActiveBusinessId(req);
    const body = await req.json();
    const { name, email, password, role, branchId, phone, isBranchManager } = body;

    if (!name || !email) {
      return NextResponse.json(
        { success: false, error: "User name and email are required" },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();
    const assignedRole = role || "STAFF";

    try {
      const existingUser = await prisma.user.findUnique({
        where: { email: cleanEmail },
      });

      if (existingUser) {
        return NextResponse.json(
          { success: false, error: "A user with this email already exists in the system" },
          { status: 400 }
        );
      }

      const passwordHash = await hashPassword(password || "staff123");

      const createdUser = await prisma.user.create({
        data: {
          name,
          email: cleanEmail,
          passwordHash,
          role: assignedRole,
          phone: phone || null,
          isBranchManager: Boolean(isBranchManager),
          branchId: branchId || null,
          memberships: {
            create: {
              businessId,
              role: assignedRole,
            },
          },
        },
        include: {
          branch: {
            select: { id: true, name: true, code: true },
          },
        },
      });

      // If designated as Branch Manager, sync managerName on the branch
      if (isBranchManager && branchId) {
        await prisma.branch.update({
          where: { id: branchId },
          data: {
            managerName: name,
            ...(phone ? { phone } : {}),
          },
        }).catch(() => {});
      }

      return NextResponse.json({
        success: true,
        data: {
          id: createdUser.id,
          name: createdUser.name,
          email: createdUser.email,
          role: createdUser.role,
          phone: createdUser.phone,
          isBranchManager: createdUser.isBranchManager,
          branchId: createdUser.branchId,
          branchName: createdUser.branch?.name || null,
        },
      });
    } catch {
      // Fallback Store
      try {
        const fallbackUser = storeAddCompanyUser({
          businessId,
          name,
          email: cleanEmail,
          password: password || "staff123",
          role: assignedRole,
          branchId: branchId || null,
          phone: phone || null,
          isBranchManager: Boolean(isBranchManager),
        });

        return NextResponse.json({
          success: true,
          data: fallbackUser,
          fallback: true,
        });
      } catch (err: any) {
        return NextResponse.json(
          { success: false, error: err.message || "Failed to create user" },
          { status: 400 }
        );
      }
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Internal error creating branch user" },
      { status: 500 }
    );
  }
}
