import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
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
