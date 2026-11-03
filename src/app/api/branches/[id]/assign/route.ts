import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { storeAssignUserBranch, fallbackStore } from "@/lib/fallbackStore";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession(req);
    if (!session || (session.role !== "SUPER_ADMIN" && session.role !== "OWNER_ADMIN" && session.role !== "ADMIN")) {
      return NextResponse.json(
        { success: false, error: "Access denied. Only Business Owners and Super Admins can assign users to branches." },
        { status: 403 }
      );
    }

    const { id: branchId } = params;
    const body = await req.json();
    const { userId, action } = body; // action: 'assign' | 'unassign'

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      );
    }

    const isSuperAdmin = session.role === "SUPER_ADMIN";
    const activeBizId = await getActiveBusinessId(req);
    const targetBranchId = action === "unassign" ? null : branchId;

    // 1. Verify tenant ownership in database if online
    if (process.env.DATABASE_URL) {
      try {
        const targetBranch = await prisma.branch.findUnique({
          where: { id: branchId },
          select: { id: true, businessId: true },
        });

        if (!targetBranch) {
          // Check fallbackStore before returning 404
          const fbBranch = fallbackStore.branches?.find((b) => b.id === branchId);
          if (!fbBranch) {
            return NextResponse.json({ success: false, error: "Branch not found" }, { status: 404 });
          }
        } else if (!isSuperAdmin && targetBranch.businessId !== activeBizId) {
          return NextResponse.json(
            { success: false, error: "Access denied. Target branch belongs to another company." },
            { status: 403 }
          );
        }

        const targetUser = await prisma.user.findUnique({
          where: { id: userId },
          include: { memberships: true },
        });

        if (!targetUser) {
          const fbUser = fallbackStore.users.find((u) => u.id === userId);
          if (!fbUser) {
            return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
          }
        } else if (!isSuperAdmin) {
          const userBelongsToBiz =
            targetUser.memberships?.some((m) => m.businessId === activeBizId) ||
            (targetUser as any).businessId === activeBizId ||
            (Array.isArray((targetUser as any).companyIds) && (targetUser as any).companyIds.includes(activeBizId));

          if (!userBelongsToBiz) {
            return NextResponse.json(
              { success: false, error: "Access denied. Target user is not a member of your company." },
              { status: 403 }
            );
          }
        }

        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data: { branchId: targetBranchId },
        });

        return NextResponse.json({
          success: true,
          data: updatedUser,
          message: action === "unassign" ? "User removed from branch" : "User assigned to branch successfully",
        });
      } catch (dbErr: any) {
        if (!dbErr.message?.includes("Can't reach database server") && dbErr.code !== "P1001") {
          return NextResponse.json(
            { success: false, error: dbErr.message || "Failed to assign user to branch" },
            { status: 400 }
          );
        }
      }
    }

    // 2. Fallback Store verification and mutation
    const fbBranch = fallbackStore.branches?.find((b) => b.id === branchId);
    if (!fbBranch) {
      return NextResponse.json({ success: false, error: "Branch not found" }, { status: 404 });
    }

    if (!isSuperAdmin && fbBranch.businessId !== activeBizId) {
      return NextResponse.json(
        { success: false, error: "Access denied. Target branch belongs to another company." },
        { status: 403 }
      );
    }

    const fbUser = fallbackStore.users.find((u) => u.id === userId);
    if (!fbUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    if (!isSuperAdmin) {
      const userBelongsToBiz =
        fbUser.businessId === activeBizId ||
        (fbUser.companyIds && fbUser.companyIds.includes(activeBizId));

      if (!userBelongsToBiz) {
        return NextResponse.json(
          { success: false, error: "Access denied. Target user is not a member of your company." },
          { status: 403 }
        );
      }
    }

    const fallbackUser = storeAssignUserBranch(userId, targetBranchId);
    if (!fallbackUser) {
      return NextResponse.json(
        { success: false, error: "User not found or assignment failed" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: fallbackUser,
      message: action === "unassign" ? "User removed from branch in fallback store" : "User assigned to branch in fallback store",
      fallback: true,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to assign user to branch" },
      { status: 500 }
    );
  }
}
