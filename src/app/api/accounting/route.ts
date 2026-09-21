import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { fallbackStore } from "@/lib/fallbackStore";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const businessId = await getActiveBusinessId(req);
    const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("DB_TIMEOUT")), 150));

    const [accounts, journals] = await Promise.race([
      Promise.all([
        prisma.account.findMany({
          where: { businessId, isActive: true },
          orderBy: { code: "asc" },
        }),
        prisma.journalEntry.findMany({
          where: { businessId },
          include: {
            lines: {
              include: { account: true },
            },
          },
          orderBy: { date: "desc" },
          take: 100,
        }),
      ]),
      timeoutPromise,
    ]);

    return NextResponse.json({ success: true, data: { accounts, journals } });
  } catch (error: any) {
    const businessId = await getActiveBusinessId(req);
    return NextResponse.json({
      success: true,
      data: {
        accounts: fallbackStore.accounts.filter((a) => a.businessId === businessId),
        journals: fallbackStore.journalEntries.filter((j) => (j as any).businessId === businessId),
      },
      fallback: true,
    });
  }
}
