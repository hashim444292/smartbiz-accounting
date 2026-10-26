import { NextRequest, NextResponse } from "next/server";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fallbackStore } from "@/lib/fallbackStore";
import { getOpeningBalances, saveOpeningBalances } from "@/services/openingBalanceService";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const businessId = await getActiveBusinessId(req);
    const session = await getSession();

    // Check package
    let packageType = "FULL_SUITE";
    if (process.env.DATABASE_URL) {
      try {
        const biz = await prisma.business.findUnique({
          where: { id: businessId },
          select: { packageType: true, name: true },
        });
        if (biz?.packageType) packageType = biz.packageType;
      } catch {}
    }
    const fallbackBiz = fallbackStore.companies.find((c) => c.id === businessId);
    if (fallbackBiz?.packageType) packageType = fallbackBiz.packageType;

    if (packageType === "FBR_INVOICING_ONLY") {
      return NextResponse.json(
        {
          success: false,
          error: "Opening Balances & Capital setup is not available in FBR Digital Invoicing Only mode. It is available in Accounting and Full Suite packages.",
        },
        { status: 403 }
      );
    }

    const data = await getOpeningBalances(businessId);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("GET /api/accounting/opening-balances error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch opening balances" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const businessId = await getActiveBusinessId(req);
    const session = await getSession();

    // Authorize: Only Accountants, Admins, and Owners
    if (session?.role && !["SUPER_ADMIN", "ADMIN", "OWNER_ADMIN", "ACCOUNTANT"].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: "Access Denied: Only Accountants and Business Owners can configure Opening Balances." },
        { status: 403 }
      );
    }

    // Check package
    let packageType = "FULL_SUITE";
    if (process.env.DATABASE_URL) {
      try {
        const biz = await prisma.business.findUnique({
          where: { id: businessId },
          select: { packageType: true },
        });
        if (biz?.packageType) packageType = biz.packageType;
      } catch {}
    }
    const fallbackBiz = fallbackStore.companies.find((c) => c.id === businessId);
    if (fallbackBiz?.packageType) packageType = fallbackBiz.packageType;

    if (packageType === "FBR_INVOICING_ONLY") {
      return NextResponse.json(
        {
          success: false,
          error: "Opening Balances & Capital setup is not available in FBR Invoicing Only mode.",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const result = await saveOpeningBalances(businessId, body, {
      userId: session?.userId,
      userName: session?.name || "Accountant",
      userEmail: session?.email,
    });

    return NextResponse.json({
      success: true,
      message: "Opening Balances, Capital, and Stock successfully posted to General Ledger!",
      data: result,
    });
  } catch (error: any) {
    console.error("POST /api/accounting/opening-balances error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to save opening balances" },
      { status: 400 }
    );
  }
}
