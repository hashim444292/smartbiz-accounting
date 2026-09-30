import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  fallbackStore,
  storeRecordSubscriptionPayment,
  storeGetBillingStats,
} from "@/lib/fallbackStore";
import { createSafeAuditLog } from "@/lib/auditHelper";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    if (session && session.role !== "SUPER_ADMIN" && session.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Access denied. SaaS billing is strictly restricted to Super Admin and Platform Admins." },
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
          billingCycleStart: true,
          billingCycleEnd: true,
          paymentStatus: true,
        },
      });

      if (dbBusinesses.length > 0) {
        const now = new Date();
        const totalMRR = dbBusinesses.reduce(
          (sum, b) =>
            sum +
            (b.monthlyFee !== null && b.monthlyFee !== undefined
              ? Number(b.monthlyFee)
              : 5000),
          0
        );
        const totalARR = totalMRR * 12;

        const activeCount = dbBusinesses.filter((b) => b.paymentStatus === "PAID").length;
        const dueCount = dbBusinesses.filter((b) => b.paymentStatus !== "PAID").length;
        const pendingDueAmount = dbBusinesses
          .filter((b) => b.paymentStatus !== "PAID")
          .reduce(
            (sum, b) =>
              sum +
              (b.monthlyFee !== null && b.monthlyFee !== undefined
                ? Number(b.monthlyFee)
                : 5000),
            0
          );

        const overdueCount = dbBusinesses.filter(
          (b) => b.billingCycleEnd && new Date(b.billingCycleEnd) < now
        ).length;

        const renewalsDueThisWeek = dbBusinesses.filter((b) => {
          if (!b.billingCycleEnd) return false;
          const end = new Date(b.billingCycleEnd);
          const diffDays = (end.getTime() - now.getTime()) / (1000 * 3600 * 24);
          return diffDays >= 0 && diffDays <= 7;
        }).length;

        const payments = fallbackStore.subscriptionPayments || [];
        const currentMonthName = now.toLocaleString("default", { month: "long", year: "numeric" });
        const collectedThisMonth = payments
          .filter((p: any) => p.period === currentMonthName || (p.date && new Date(p.date).getMonth() === now.getMonth()))
          .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

        const stats = {
          totalCompanies: dbBusinesses.length,
          totalMRR,
          totalARR,
          collectedThisMonth,
          pendingDueAmount,
          activeCount,
          dueCount,
          overdueCount,
          renewalsDueThisWeek,
        };

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
    if (session && session.role !== "SUPER_ADMIN" && session.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Access denied. Only Super Admin and Platform Admins can record subscription payments." },
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

    const now = new Date();
    let currentBiz: any = null;

    // 1. Primary Lookup in PostgreSQL Database
    try {
      currentBiz = await prisma.business.findUnique({
        where: { id: businessId },
      });
    } catch (dbErr) {
      console.warn("Could not find business in DB, checking fallbackStore:", dbErr);
    }

    // 2. Secondary Lookup in fallbackStore
    const fallbackComp = fallbackStore.companies.find((c) => c.id === businessId);

    if (!currentBiz && !fallbackComp) {
      return NextResponse.json(
        { success: false, error: "Company not found in directory." },
        { status: 404 }
      );
    }

    const companyName = currentBiz?.name || fallbackComp?.name || "Client Organization";
    const paymentAmount = amount
      ? Number(amount)
      : Number(currentBiz?.monthlyFee || fallbackComp?.monthlyFee || 5000);
    const paymentDate = date || now.toISOString();
    const billingPeriod =
      period || now.toLocaleString("default", { month: "long", year: "numeric" });

    // Calculate new billing cycle end (+30 days)
    const currentEnd = currentBiz?.billingCycleEnd
      ? new Date(currentBiz.billingCycleEnd)
      : fallbackComp?.billingCycleEnd
      ? new Date(fallbackComp.billingCycleEnd)
      : now;
    const baseDate = currentEnd > now ? currentEnd : now;
    const nextEnd = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    let updatedBiz: any = null;
    if (currentBiz) {
      try {
        updatedBiz = await prisma.business.update({
          where: { id: businessId },
          data: {
            paymentStatus: "PAID",
            billingCycleStart: baseDate,
            billingCycleEnd: nextEnd,
            monthlyFee: amount ? Number(amount) : undefined,
          },
        });

        await prisma.appSetting.upsert({
          where: { businessId_key: { businessId, key: "billing_payment_status" } },
          update: { value: "PAID" },
          create: { businessId, key: "billing_payment_status", value: "PAID" },
        }).catch(() => null);

        if (amount) {
          await prisma.appSetting.upsert({
            where: { businessId_key: { businessId, key: "monthly_fee" } },
            update: { value: String(amount) },
            create: { businessId, key: "monthly_fee", value: String(amount) },
          }).catch(() => null);
        }
      } catch (upErr) {
        console.warn("Failed to update business in DB:", upErr);
      }
    }

    // Update in fallback store if present
    if (fallbackComp) {
      fallbackComp.subscriptionStatus = "ACTIVE";
      fallbackComp.paymentStatus = "PAID";
      fallbackComp.billingCycleStart = baseDate.toISOString();
      fallbackComp.billingCycleEnd = nextEnd.toISOString();
      fallbackComp.lastPaymentDate = paymentDate;
      fallbackComp.lastPaymentAmount = paymentAmount;
    }

    // Generate subscription receipt for the ledger
    const receipt = {
      id: `SUB-REC-${Date.now().toString().slice(-6)}`,
      receiptNumber: reference || `REC-${Date.now().toString().slice(-6)}`,
      businessId,
      companyName,
      amount: paymentAmount,
      paymentMethod: paymentMethod || "BANK",
      period: billingPeriod,
      date: paymentDate,
      recordedBy: session?.name || "System Super Admin",
      reference: reference || `REC-${Date.now().toString().slice(-6)}`,
      notes: notes || `Monthly fee renewal for ${companyName} (${billingPeriod})`,
      createdAt: paymentDate,
    };

    if (!fallbackStore.subscriptionPayments) {
      fallbackStore.subscriptionPayments = [];
    }
    fallbackStore.subscriptionPayments.unshift(receipt);

    const stats = storeGetBillingStats();

    if (session) {
      try {
        await createSafeAuditLog(prisma, {
          businessId,
          userId: session.userId,
          userName: session.name || (session.role === "ADMIN" ? "Team Admin" : "Super Admin"),
          userEmail: session.email || "",
          action: "RECORD_SUBSCRIPTION_PAYMENT",
          entity: "Business",
          entityId: businessId,
          details: `Recorded subscription fee of Rs. ${paymentAmount} for "${companyName}" via ${paymentMethod || "BANK"} (Period: ${billingPeriod})`,
          changes: JSON.stringify({
            previous: {
              paymentStatus: currentBiz?.paymentStatus || "UNPAID",
              billingCycleEnd: currentBiz?.billingCycleEnd ? new Date(currentBiz.billingCycleEnd).toISOString().split("T")[0] : "—",
            },
            updated: {
              paymentStatus: "PAID",
              billingCycleEnd: nextEnd.toISOString().split("T")[0],
              paidAmount: `Rs. ${paymentAmount}`,
              paymentMethod: paymentMethod || "BANK",
              reference: reference || "N/A",
            },
          }),
        });
      } catch (auditErr) {
        console.warn("Failed to create audit log for billing payment:", auditErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Monthly subscription renewed for ${companyName}. New cycle end: ${nextEnd.toLocaleDateString()}.`,
      receipt,
      company: updatedBiz || fallbackComp || {
        id: businessId,
        name: companyName,
        billingCycleEnd: nextEnd.toISOString(),
        paymentStatus: "PAID",
      },
      stats,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to record subscription payment" },
      { status: 500 }
    );
  }
}
