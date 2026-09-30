import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { getSession } from "@/lib/auth";
import { fallbackStore, storeGetAuditLogs } from "@/lib/fallbackStore";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    const isPlatformAdmin = session?.role === "SUPER_ADMIN" || session?.role === "ADMIN";

    const { searchParams } = new URL(req.url);
    const reqBizId = searchParams.get("businessId");
    const entity = searchParams.get("entity") || "ALL";
    const action = searchParams.get("action") || "ALL";
    const userId = searchParams.get("userId") || "ALL";

    const whereClause: any = {};
    if (reqBizId && reqBizId !== "ALL") {
      whereClause.businessId = reqBizId;
    } else if (!isPlatformAdmin) {
      const activeBizId = await getActiveBusinessId(req);
      whereClause.businessId = activeBizId;
    }

    if (entity !== "ALL") whereClause.entity = entity;
    if (action !== "ALL") whereClause.action = action;
    if (userId !== "ALL") whereClause.userId = userId;

    if (!process.env.DATABASE_URL) {
      const activeBizId = whereClause.businessId || fallbackStore.activeBusinessId;
      const logs = storeGetAuditLogs(activeBizId, { entity, action, userId });
      return NextResponse.json({ success: true, data: logs, fallback: true });
    }

    const logs = await prisma.auditLog.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        business: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json({ success: true, data: logs });
  } catch (err: any) {
    console.error("Failed to load audit logs:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to load audit logs" },
      { status: 500 }
    );
  }
}
