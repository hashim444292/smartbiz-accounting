import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { storeAssignUserBranch } from "@/lib/fallbackStore";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (session && session.role !== "SUPER_ADMIN" && session.role !== "OWNER_ADMIN") {
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

    const targetBranchId = action === "unassign" ? null : branchId;

    try {
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { branchId: targetBranchId },
      });
      return NextResponse.json({
        success: true,
        data: updatedUser,
        message: action === "unassign" ? "User removed from branch" : "User assigned to branch successfully",
      });
    } catch {
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
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to assign user to branch" },
      { status: 500 }
    );
  }
}
