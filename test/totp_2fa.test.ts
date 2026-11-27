import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));

import { signSessionToken, TOKEN_NAME } from "@/lib/auth";
import {
  generateTotpSecret,
  generateTotpCode,
  verifyTotpCode,
  clearUserTwoFactorConfig,
} from "@/lib/totp";
import { GET as get2FaStatus, POST as post2FaAction } from "@/app/api/auth/2fa/route";
import { POST as loginHandler } from "@/app/api/auth/login/route";

function createAuth2FaRequest(method: "GET" | "POST", body?: Record<string, unknown>) {
  const token = signSessionToken({
    userId: "usr-1",
    email: "admin@smartbiz.com",
    name: "System Admin",
    role: "SUPER_ADMIN",
    businessId: "biz-1",
    businessName: "SmartBiz Solutions",
  });

  return new NextRequest("http://localhost:3000/api/auth/2fa", {
    method,
    headers: {
      Cookie: `${TOKEN_NAME}=${token}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe("Google Authenticator (TOTP 2FA) Security Suite", () => {
  beforeEach(async () => {
    process.env.DATABASE_URL = "";
    await clearUserTwoFactorConfig("usr-1");
  });

  it("should generate valid Base32 secret and verify 6-digit TOTP codes", () => {
    const secret = generateTotpSecret();
    expect(secret.length).toBeGreaterThanOrEqual(32);

    const now = Date.now();
    const code = generateTotpCode(secret, now);
    expect(code).toMatch(/^\d{6}$/);
    expect(verifyTotpCode(secret, code, 1, now)).toBe(true);
    expect(verifyTotpCode(secret, "000000", 1, now) && code !== "000000").toBe(false);
  });

  it("should reject unauthenticated requests to /api/auth/2fa with 401", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/2fa", { method: "GET" });
    const res = await get2FaStatus(req);
    expect(res.status).toBe(401);
  });

  it("should allow normal login when 2FA is not enabled (no live disruption)", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@smartbiz.com",
        password: "admin123",
      }),
    });
    const res = await loginHandler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.user.email).toBe("admin@smartbiz.com");
  });

  it("should enforce 6-digit TOTP code on login once 2FA is enabled, and allow disabling with valid code", async () => {
    // 1. Setup 2FA
    const setupRes = await post2FaAction(createAuth2FaRequest("POST", { action: "SETUP" }));
    const setupData = await setupRes.json();
    expect(setupRes.status).toBe(200);
    expect(setupData.success).toBe(true);
    expect(setupData.secret).toBeDefined();
    expect(setupData.qrDataUrl).toContain("data:image/png;base64,");

    // 2. Reject invalid enable code
    const badEnableRes = await post2FaAction(
      createAuth2FaRequest("POST", { action: "ENABLE", code: "999999" })
    );
    if (generateTotpCode(setupData.secret) !== "999999") {
      expect(badEnableRes.status).toBe(400);
    }

    // 3. Enable with valid TOTP code
    const validCode = generateTotpCode(setupData.secret);
    const enableRes = await post2FaAction(
      createAuth2FaRequest("POST", { action: "ENABLE", code: validCode })
    );
    const enableData = await enableRes.json();
    expect(enableRes.status).toBe(200);
    expect(enableData.enabled).toBe(true);

    // 4. Login without TOTP code should return requires2FA: true (401)
    const loginNoOtpRes = await loginHandler(
      new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@smartbiz.com", password: "admin123" }),
      })
    );
    const loginNoOtpData = await loginNoOtpRes.json();
    expect(loginNoOtpRes.status).toBe(401);
    expect(loginNoOtpData.requires2FA).toBe(true);

    // 5. Login with valid TOTP code should succeed
    const loginWithOtpRes = await loginHandler(
      new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "admin@smartbiz.com",
          password: "admin123",
          totpCode: generateTotpCode(setupData.secret),
        }),
      })
    );
    const loginWithOtpData = await loginWithOtpRes.json();
    expect(loginWithOtpRes.status).toBe(200);
    expect(loginWithOtpData.success).toBe(true);

    // 6. Disable 2FA with valid TOTP code
    const disableRes = await post2FaAction(
      createAuth2FaRequest("POST", {
        action: "DISABLE",
        code: generateTotpCode(setupData.secret),
      })
    );
    const disableData = await disableRes.json();
    expect(disableRes.status).toBe(200);
    expect(disableData.enabled).toBe(false);
  });
});
