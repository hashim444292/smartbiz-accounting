import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { fallbackStore, storeGetAuditLogs } from "@/lib/fallbackStore";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const businessId = await getActiveBusinessId(req);
    const { searchParams } = new URL(req.url);
    const entity = searchParams.get("entity") || "ALL";
    const action = searchParams.get("action") || "ALL";
    const userId = searchParams.get("userId") || "ALL";

    const whereClause: any = { businessId };
    if (entity !== "ALL") whereClause.entity = entity;
    if (action !== "ALL") whereClause.action = action;
    if (userId !== "ALL") whereClause.userId = userId;

    const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("DB_TIMEOUT")), 150));
    const logs = await Promise.race([
      prisma.auditLog.findMany({
        where: whereClause,
        include: { user: true },
        orderBy: { createdAt: "desc" },
        take: 150,
      }),
      timeoutPromise,
    ]);

    return NextResponse.json({ success: true, data: logs });
  } catch {
    const businessId = await getActiveBusinessId(req);
    const { searchParams } = new URL(req.url);
    const entity = searchParams.get("entity") || "ALL";
    const action = searchParams.get("action") || "ALL";
    const userId = searchParams.get("userId") || "ALL";

    const logs = storeGetAuditLogs(businessId, { entity, action, userId });
    return NextResponse.json({ success: true, data: logs, fallback: true });
  }
}
