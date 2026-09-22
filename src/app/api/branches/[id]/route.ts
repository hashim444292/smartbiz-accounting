import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { fallbackStore, storeUpdateBranch, storeDeleteBranch } from "@/lib/fallbackStore";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    let branch: any = null;
    let staffMembers: any[] = [];

    try {
      branch = await prisma.branch.findUnique({
        where: { id },
        include: {
          users: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      });
      if (branch) {
        staffMembers = branch.users || [];
      }
    } catch {
      branch = fallbackStore.branches?.find((b) => b.id === id) || null;
      if (branch) {
        staffMembers = fallbackStore.users
          .filter((u) => u.branchId === id)
          .map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role }));
      }
    }

    if (!branch) {
      return NextResponse.json({ success: false, error: "Branch not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        ...branch,
        staffMembers,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch branch" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (session && session.role !== "SUPER_ADMIN" && session.role !== "OWNER_ADMIN") {
      return NextResponse.json(
        { success: false, error: "Access denied. Only Business Owners and Super Admins can update branches." },
        { status: 403 }
      );
    }

    const { id } = params;
    const body = await req.json();

    const updates: any = {};
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.code !== undefined) updates.code = body.code.trim();
    if (body.address !== undefined) updates.address = body.address.trim();
    if (body.city !== undefined) updates.city = body.city.trim();
    if (body.phone !== undefined) updates.phone = body.phone.trim();
    if (body.email !== undefined) updates.email = body.email.trim();
    if (body.managerName !== undefined) updates.managerName = body.managerName.trim();
    if (body.isActive !== undefined) updates.isActive = Boolean(body.isActive);

    try {
      const updated = await prisma.branch.update({
        where: { id },
        data: updates,
      });
      return NextResponse.json({
        success: true,
        data: updated,
        message: "Branch updated successfully",
      });
    } catch {
      const updated = storeUpdateBranch(id, updates);
      if (!updated) {
        return NextResponse.json({ success: false, error: "Branch not found" }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        data: updated,
        message: "Branch updated successfully in fallback store",
        fallback: true,
      });
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update branch" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (session && session.role !== "SUPER_ADMIN" && session.role !== "OWNER_ADMIN") {
      return NextResponse.json(
        { success: false, error: "Access denied. Only Business Owners and Super Admins can remove branches." },
        { status: 403 }
      );
    }

    const { id } = params;

    try {
      await prisma.branch.delete({
        where: { id },
      });
      return NextResponse.json({
        success: true,
        message: "Branch removed successfully",
      });
    } catch {
      const deleted = storeDeleteBranch(id);
      if (!deleted) {
        return NextResponse.json({ success: false, error: "Branch not found" }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        message: "Branch removed successfully in fallback store",
        fallback: true,
      });
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete branch" },
      { status: 500 }
    );
  }
}
