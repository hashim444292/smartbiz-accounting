import { NextRequest, NextResponse } from "next/server";
import {
  getLocalLicenseStatus,
  saveLocalLicense,
  clearLocalLicense,
} from "@/lib/desktopStorage";
import { getMachineId } from "@/lib/hardwareId";

/**
 * GET /api/desktop/license
 * Returns current machine hardware ID, activation status, package type, and days remaining.
 */
export async function GET() {
  try {
    const status = getLocalLicenseStatus();
    return NextResponse.json({
      success: true,
      ...status,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to inspect desktop license",
        machineId: getMachineId(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/desktop/license
 * Activates a cryptographic license key on this machine.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { licenseKey, clientName } = body;

    if (!licenseKey || typeof licenseKey !== "string") {
      return NextResponse.json(
        { success: false, error: "License key is required." },
        { status: 400 }
      );
    }

    const verification = saveLocalLicense(licenseKey, clientName);

    return NextResponse.json({
      success: true,
      message: "License activated successfully on this computer!",
      verification,
      status: getLocalLicenseStatus(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Activation failed" },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/desktop/license
 * Removes the local license key from this machine (for re-registration).
 */
export async function DELETE() {
  try {
    clearLocalLicense();
    return NextResponse.json({
      success: true,
      message: "Local license cleared.",
      status: getLocalLicenseStatus(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to clear license" },
      { status: 500 }
    );
  }
}
