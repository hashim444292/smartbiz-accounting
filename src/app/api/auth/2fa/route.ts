import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { getSession } from "@/lib/auth";
import {
  generateTotpSecret,
  generateOtpAuthUri,
  verifyTotpCode,
  getUserTwoFactorConfig,
  saveUserTwoFactorConfig,
  clearUserTwoFactorConfig,
} from "@/lib/totp";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session?.userId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const config = await getUserTwoFactorConfig(session.userId);
  return NextResponse.json({
    success: true,
    enabled: Boolean(config?.enabled),
  });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session?.userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { action, code } = body || {};

    if (action === "SETUP") {
      const secret = generateTotpSecret();
      const otpauthUri = generateOtpAuthUri(
        secret,
        session.email || session.userId,
        "Accounts360"
      );
      const qrDataUrl = await QRCode.toDataURL(otpauthUri, {
        width: 220,
        margin: 2,
      });

      // Save pending secret (enabled remains false until user verifies first 6-digit code)
      await saveUserTwoFactorConfig(session.userId, session.businessId, {
        enabled: false,
        secret,
        updatedAt: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        secret,
        qrDataUrl,
        otpauthUri,
      });
    }

    if (action === "ENABLE") {
      const config = await getUserTwoFactorConfig(session.userId);
      if (!config?.secret) {
        return NextResponse.json(
          { success: false, error: "Please initiate 2FA setup first." },
          { status: 400 }
        );
      }

      if (!verifyTotpCode(config.secret, String(code || ""))) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid 6-digit Google Authenticator code. Please check your phone time and try again.",
          },
          { status: 400 }
        );
      }

      await saveUserTwoFactorConfig(session.userId, session.businessId, {
        enabled: true,
        secret: config.secret,
        updatedAt: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        enabled: true,
        message: "Google Authenticator 2FA is now enabled for your account.",
      });
    }

    if (action === "DISABLE") {
      const config = await getUserTwoFactorConfig(session.userId);
      if (!config?.enabled || !config?.secret) {
        return NextResponse.json({
          success: true,
          enabled: false,
          message: "2FA is already disabled.",
        });
      }

      if (!verifyTotpCode(config.secret, String(code || ""))) {
        return NextResponse.json(
          {
            success: false,
            error: "Valid 6-digit Google Authenticator code is required to disable 2FA.",
          },
          { status: 400 }
        );
      }

      await clearUserTwoFactorConfig(session.userId);

      return NextResponse.json({
        success: true,
        enabled: false,
        message: "Google Authenticator 2FA has been disabled.",
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action. Use SETUP, ENABLE, or DISABLE." },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "2FA configuration error" },
      { status: 500 }
    );
  }
}
