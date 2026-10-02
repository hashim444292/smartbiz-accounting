import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, getSession } from "@/lib/auth";
import { fallbackStore, storeUpdateUser, storeDeleteUser } from "@/lib/fallbackStore";

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (session && session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { success: false, error: "Access denied. Only Super Admin can modify user accounts." },
        { status: 403 }
      );
    }

    const { id } = params;
    const body = await req.json();
    const { name, role, email, password, companyIds, allowedModules, platformRole } = body;

    // Database update
    try {
      const existingUser = await prisma.user.findUnique({ where: { id } });
      if (!existingUser) {
        return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
      }

      // 1. Prevent promoting any non-super admin to SUPER_ADMIN
      if (
        (role === "SUPER_ADMIN" || platformRole === "SUPER_ADMIN") &&
        existingUser.role !== "SUPER_ADMIN" &&
        (existingUser as any).platformRole !== "SUPER_ADMIN"
      ) {
        return NextResponse.json(
          { success: false, error: "The SUPER_ADMIN role is protected and cannot be assigned to another user." },
          { status: 400 }
        );
      }

      // 2. Prevent removing SUPER_ADMIN from the master account
      const isMasterAdmin =
        existingUser.role === "SUPER_ADMIN" || (existingUser as any).platformRole === "SUPER_ADMIN";
      if (isMasterAdmin && (role && role !== "SUPER_ADMIN" || platformRole && platformRole !== "SUPER_ADMIN")) {
        return NextResponse.json(
          { success: false, error: "The master SUPER_ADMIN account role cannot be changed." },
          { status: 400 }
        );
      }

      const updateData: any = {};
      if (name) updateData.name = name;
      if (role && !isMasterAdmin) updateData.role = role;
      if (platformRole && !isMasterAdmin) updateData.platformRole = platformRole;
      if (email) updateData.email = email.toLowerCase().trim();
      if (password) updateData.passwordHash = await hashPassword(password);
      if (Array.isArray(allowedModules)) updateData.allowedModules = allowedModules;

      const updated = await prisma.user.update({
        where: { id },
        data: updateData,
      });

      if (Array.isArray(companyIds)) {
        await prisma.businessMember.deleteMany({ where: { userId: id } });
        for (const bId of companyIds) {
          await prisma.businessMember.create({
            data: {
              userId: id,
              businessId: bId,
              role: role || updated.role,
            },
          });
        }
      }

      return NextResponse.json({
        success: true,
        data: updated,
        message: "User updated successfully",
      });
    } catch {
      // Fallback
      const updates: any = {};
      if (name) updates.name = name;
      if (role) updates.role = role;
      if (platformRole) updates.platformRole = platformRole;
      if (email) updates.email = email.toLowerCase().trim();
      if (password) updates.password = password;
      if (Array.isArray(companyIds)) updates.companyIds = companyIds;
      if (Array.isArray(allowedModules)) updates.allowedModules = allowedModules;

      const updated = storeUpdateUser(id, updates);
      if (!updated) {
        return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        data: updated,
        message: "User updated successfully",
        fallback: true,
      });
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update user" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const session = await getSession();

    if (session && session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { success: false, error: "Access denied. Only Super Admin can delete user accounts." },
        { status: 403 }
      );
    }

    if (session && session.userId === id) {
      return NextResponse.json(
        { success: false, error: "You cannot delete your own account while logged in" },
        { status: 400 }
      );
    }

    // Database delete
    try {
      const targetUser = await prisma.user.findUnique({ where: { id } });
      if (targetUser?.role === "SUPER_ADMIN" || (targetUser as any)?.platformRole === "SUPER_ADMIN") {
        return NextResponse.json(
          { success: false, error: "Cannot delete the master Super Admin account." },
          { status: 400 }
        );
      }

      await prisma.businessMember.deleteMany({ where: { userId: id } });
      await prisma.user.delete({ where: { id } });
      return NextResponse.json({ success: true, message: "User deleted successfully" });
    } catch {
      // Fallback
      const deleted = storeDeleteUser(id);
      if (!deleted) {
        return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, message: "User deleted successfully", fallback: true });
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete user" },
      { status: 500 }
    );
  }
}
