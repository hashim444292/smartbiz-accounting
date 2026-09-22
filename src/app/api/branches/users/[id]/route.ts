import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { getSession, hashPassword } from "@/lib/auth";
import {
  fallbackStore,
  storeUpdateCompanyUser,
  storeDeleteCompanyUser,
} from "@/lib/fallbackStore";

export const dynamic = "force-dynamic";

/**
 * PUT /api/branches/users/[id]
 * Updates branch staff details, manager designation, branch assignment, or password.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "OWNER_ADMIN" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json(
        { success: false, error: "Only Company Owners and Super Admins can update branch staff." },
        { status: 403 }
      );
    }

    const userId = params.id;
    const body = await req.json();
    const { name, email, role, branchId, phone, isBranchManager, password } = body;

    try {
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = email.toLowerCase().trim();
      if (role !== undefined) updateData.role = role;
      if (branchId !== undefined) updateData.branchId = branchId || null;
      if (phone !== undefined) updateData.phone = phone || null;
      if (isBranchManager !== undefined) updateData.isBranchManager = Boolean(isBranchManager);
      if (password) {
        updateData.passwordHash = await hashPassword(password);
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        include: {
          branch: { select: { id: true, name: true, code: true } },
        },
      });

      // Sync managerName on branch if designated
      if (isBranchManager && branchId) {
        await prisma.branch.update({
          where: { id: branchId },
          data: {
            managerName: updated.name,
            ...(updated.phone ? { phone: updated.phone } : {}),
          },
        }).catch(() => {});
      }

      return NextResponse.json({
        success: true,
        data: {
          id: updated.id,
          name: updated.name,
          email: updated.email,
          role: updated.role,
          phone: updated.phone,
          isBranchManager: updated.isBranchManager,
          branchId: updated.branchId,
          branchName: updated.branch?.name || null,
        },
      });
    } catch {
      // Fallback Store
      const updated = storeUpdateCompanyUser(userId, {
        name,
        email,
        role,
        branchId,
        phone,
        isBranchManager,
        password,
      });

      if (!updated) {
        return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        data: updated,
        fallback: true,
      });
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update branch user" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/branches/users/[id]
 * Deletes or removes staff from the company.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "OWNER_ADMIN" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json(
        { success: false, error: "Only Company Owners and Super Admins can remove branch staff." },
        { status: 403 }
      );
    }

    const businessId = await getActiveBusinessId(req);
    const userId = params.id;

    // Prevent deleting oneself
    if (session.userId === userId) {
      return NextResponse.json(
        { success: false, error: "You cannot delete your own account." },
        { status: 400 }
      );
    }

    try {
      // In DB, remove memberships for this business
      await prisma.businessMember.deleteMany({
        where: { userId, businessId },
      });

      // If user has no other memberships, delete user record
      const remainingMemberships = await prisma.businessMember.count({
        where: { userId },
      });

      if (remainingMemberships === 0) {
        await prisma.user.delete({ where: { id: userId } });
      } else {
        // Disassociate from branch
        await prisma.user.update({
          where: { id: userId },
          data: { branchId: null },
        });
      }

      return NextResponse.json({ success: true, message: "User removed successfully" });
    } catch {
      // Fallback
      try {
        const deleted = storeDeleteCompanyUser(userId, businessId);
        if (!deleted) {
          return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
        }
        return NextResponse.json({ success: true, message: "User removed successfully", fallback: true });
      } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 400 });
      }
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete user" },
      { status: 500 }
    );
  }
}
