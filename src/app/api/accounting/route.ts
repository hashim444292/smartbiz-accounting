import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { fallbackStore } from "@/lib/fallbackStore";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const businessId = await getActiveBusinessId(req);

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({
        success: true,
        data: {
          accounts: fallbackStore.accounts.filter((a) => a.businessId === businessId),
          journals: fallbackStore.journalEntries.filter((j) => (j as any).businessId === businessId),
        },
        fallback: true,
      });
    }

    const [accounts, journals] = await Promise.all([
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
    ]);

    return NextResponse.json({ success: true, data: { accounts, journals } });
  } catch (error: any) {
    console.error("Accounting route error:", error?.message || error);
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
