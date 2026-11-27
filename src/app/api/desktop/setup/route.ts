import { NextRequest, NextResponse } from "next/server";
import {
  isDesktopSetupComplete,
  getDesktopBusinessInfo,
  initializeDesktopBusiness,
} from "@/lib/desktopDatabase";
import { getLocalLicenseStatus } from "@/lib/desktopStorage";
import { signSessionToken, setSessionCookie, setActiveBusinessCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/desktop/setup
 * Inspects if initial business setup has been completed on this desktop installation.
 */
export async function GET() {
  try {
    const license = getLocalLicenseStatus();
    const info = getDesktopBusinessInfo();

    return NextResponse.json({
      success: true,
      isDesktop: license.isDesktop,
      isActivated: license.isActivated,
      packageType: license.packageType || "ACCOUNTING_ONLY",
      isSetupComplete: info.isSetupComplete,
      business: info.business ? { name: info.business.name, email: info.business.email } : null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to inspect desktop setup status" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/desktop/setup
 * Completes client business onboarding and owner account creation.
 */
export async function POST(req: NextRequest) {
  try {
    const license = getLocalLicenseStatus();
    if (!license.isActivated) {
      return NextResponse.json(
        { success: false, error: "Please activate your software license key before setting up your business." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { businessName, ownerName, phone, city, email, password } = body;

    if (!businessName || !ownerName || !email) {
      return NextResponse.json(
        { success: false, error: "Business name, owner name, and email are required." },
        { status: 400 }
      );
    }

    const setupResult = initializeDesktopBusiness({
      businessName,
      ownerName,
      phone,
      city,
      email,
      password: password || "123456",
      packageType: license.packageType || "ACCOUNTING_ONLY",
    });

    if (!setupResult.success || !setupResult.user) {
      return NextResponse.json(
        { success: false, error: setupResult.error || "Failed to initialize business ledger." },
        { status: 500 }
      );
    }

    // Automatically authenticate the client as the owner
    const sessionPayload = {
      userId: setupResult.user.id,
      email: setupResult.user.email,
      name: setupResult.user.name,
      role: setupResult.user.role,
      platformRole: "TENANT_USER",
      businessId: setupResult.business.id,
      businessName: setupResult.business.name,
      companyIds: [setupResult.business.id],
      branchId: null,
      branchName: null,
      canCreateBranches: true,
      allowedModules: [],
    };

    const token = signSessionToken(sessionPayload);
    setSessionCookie(token);
    setActiveBusinessCookie(setupResult.business.id);

    return NextResponse.json({
      success: true,
      user: sessionPayload,
      message: "Business setup successfully completed! Welcome to Accounts360.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to complete setup" },
      { status: 500 }
    );
  }
}
