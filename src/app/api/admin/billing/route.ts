import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  fallbackStore,
  storeRecordSubscriptionPayment,
  storeGetBillingStats,
} from "@/lib/fallbackStore";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    if (session && session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { success: false, error: "Access denied. SaaS billing is strictly restricted to Super Admin." },
        { status: 403 }
      );
    }

    try {
      const dbBusinesses = await prisma.business.findMany({
        select: {
          id: true,
          name: true,
          monthlyFee: true,
          createdAt: true,
        },
      });

      if (dbBusinesses.length > 0) {
        const totalMRR = dbBusinesses.reduce((sum, b) => sum + (b.monthlyFee !== null && b.monthlyFee !== undefined ? Number(b.monthlyFee) : 5000), 0);
        const totalARR = totalMRR * 12;
        const stats = {
          totalCompanies: dbBusinesses.length,
          totalMRR,
          totalARR,
          collectedThisMonth: 0,
          pendingDueAmount: 0,
          activeCount: dbBusinesses.length,
          dueCount: 0,
          overdueCount: 0,
          renewalsDueThisWeek: 0,
        };
        const payments = fallbackStore.subscriptionPayments || [];

        return NextResponse.json({
          success: true,
          stats,
          payments,
          companiesCount: dbBusinesses.length,
        });
      }
    } catch (dbErr) {
      console.warn("Could not query businesses for billing stats from DB, using fallback:", dbErr);
    }

    const stats = storeGetBillingStats();
    const payments = fallbackStore.subscriptionPayments || [];

    return NextResponse.json({
      success: true,
      stats,
      payments,
      companiesCount: fallbackStore.companies.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load billing information" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (session && session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { success: false, error: "Access denied. Only Super Admin can record subscription payments." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { businessId, amount, date, period, paymentMethod, reference, notes } = body;

    if (!businessId) {
      return NextResponse.json(
        { success: false, error: "Target company (businessId) is required." },
        { status: 400 }
      );
    }

    const result = storeRecordSubscriptionPayment({
      businessId,
      amount: amount ? Number(amount) : undefined,
      date,
      period,
      paymentMethod,
      reference,
      notes,
      recordedBy: session?.name || "System Super Admin",
    });

    if (!result) {
      return NextResponse.json(
        { success: false, error: "Company not found in directory." },
        { status: 404 }
      );
    }

    const stats = storeGetBillingStats();

    return NextResponse.json({
      success: true,
      message: `Monthly subscription renewed for ${result.company.name}. New cycle end: ${new Date(result.company.billingCycleEnd).toLocaleDateString()}.`,
      receipt: result.receipt,
      company: result.company,
      stats,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to record subscription payment" },
      { status: 500 }
    );
  }
}
