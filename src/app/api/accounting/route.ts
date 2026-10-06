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
          suppliers: fallbackStore.suppliers.filter((s) => s.businessId === businessId),
          customers: fallbackStore.customers.filter((c) => c.businessId === businessId),
          purchases: fallbackStore.purchases.filter((p) => p.businessId === businessId),
          payments: fallbackStore.payments.filter((p) => p.businessId === businessId),
        },
        fallback: true,
      });
    }

    const [accounts, journals, suppliers, customers, purchases, payments] = await Promise.all([
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
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 500,
      }),
      prisma.supplier.findMany({
        where: { businessId, isActive: true },
        include: {
          purchases: { orderBy: { date: "desc" } },
          payments: { orderBy: { date: "desc" } },
        },
        orderBy: { name: "asc" },
      }),
      prisma.customer.findMany({
        where: { businessId, isActive: true },
        include: {
          sales: { orderBy: { date: "desc" } },
          payments: { orderBy: { date: "desc" } },
        },
        orderBy: { name: "asc" },
      }),
      prisma.purchase.findMany({
        where: { businessId },
        include: { items: true, supplier: true },
        orderBy: { date: "desc" },
      }),
      prisma.payment.findMany({
        where: { businessId },
        include: { customer: true, supplier: true, account: true },
        orderBy: { date: "desc" },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        accounts,
        journals,
        suppliers,
        customers,
        purchases,
        payments,
      },
    });
  } catch (error: any) {
    console.error("Accounting route error:", error?.message || error);
    const businessId = await getActiveBusinessId(req);
    return NextResponse.json({
      success: true,
      data: {
        accounts: fallbackStore.accounts.filter((a) => a.businessId === businessId),
        journals: fallbackStore.journalEntries.filter((j) => (j as any).businessId === businessId),
        suppliers: fallbackStore.suppliers.filter((s) => s.businessId === businessId),
        customers: fallbackStore.customers.filter((c) => c.businessId === businessId),
        purchases: fallbackStore.purchases.filter((p) => p.businessId === businessId),
        payments: fallbackStore.payments.filter((p) => p.businessId === businessId),
      },
      fallback: true,
    });
  }
}
