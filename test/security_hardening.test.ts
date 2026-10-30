import { describe, it, expect, beforeEach } from "vitest";
import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";
import { signSessionToken, verifySessionToken, SessionPayload } from "@/lib/auth";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { checkLoginRateLimit, recordFailedLogin, resetLoginRateLimit } from "@/lib/rateLimit";
import { extractFromImage } from "@/services/ocrService";
import { POST as resetTransactionsRoute } from "@/app/api/admin/companies/reset-transactions/route";
import { GET as getCompaniesRoute, POST as postCompaniesRoute } from "@/app/api/admin/companies/route";
import { PUT as putCompanyRoute, DELETE as deleteCompanyRoute } from "@/app/api/admin/companies/[id]/route";
import { GET as getUsersRoute, POST as postUsersRoute } from "@/app/api/admin/users/route";
import { PUT as putUserRoute, DELETE as deleteUserRoute } from "@/app/api/admin/users/[id]/route";
import { POST as assignBranchRoute } from "@/app/api/branches/[id]/assign/route";
import { POST as switchCompanyRoute } from "@/app/api/auth/switch-company/route";
import { POST as aiExtractRoute } from "@/app/api/ai/extract/route";
import { fallbackStore } from "@/lib/fallbackStore";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-accounting-jwt-key-2026";

describe("Security Hardening Verification (VULN-01 to VULN-08)", () => {
  // ==========================================
  // VULN-01: JWT Signature & Expiration Verification
  // ==========================================
  describe("VULN-01: Cryptographic JWT Verification", () => {
    it("should accept valid cryptographically signed JWT tokens", () => {
      const payload: SessionPayload = {
        userId: "user-1",
        email: "test@example.com",
        name: "Test User",
        role: "ADMIN" as any,
        businessId: "biz-101",
        businessName: "Test Company",
        companyIds: ["biz-101"],
      };

      const token = signSessionToken(payload);
      const verified = verifySessionToken(token);
      expect(verified).not.toBeNull();
      expect(verified?.userId).toBe("user-1");
      expect(verified?.businessId).toBe("biz-101");
    });

    it("should reject forged JWT tokens signed with a malicious secret", () => {
      const forgedToken = jwt.sign(
        { userId: "attacker", role: "SUPER_ADMIN", businessId: "biz-101" },
        "attacker-evil-secret-key-12345"
      );

      const verified = verifySessionToken(forgedToken);
      expect(verified).toBeNull();
    });

    it("should reject tampered JWT payloads where payload was modified after signing", () => {
      const legitToken = signSessionToken({
        userId: "user-1",
        email: "user@example.com",
        name: "User",
        role: "TENANT_USER" as any,
        businessId: "biz-101",
        businessName: "Company",
      });

      const parts = legitToken.split(".");
      // Tamper the payload: change role from TENANT_USER to SUPER_ADMIN
      const payloadJson = Buffer.from(parts[1], "base64").toString("utf-8");
      const tamperedJson = payloadJson.replace("TENANT_USER", "SUPER_ADMIN");
      const tamperedB64 = Buffer.from(tamperedJson).toString("base64url");
      const tamperedToken = `${parts[0]}.${tamperedB64}.${parts[2]}`;

      const verified = verifySessionToken(tamperedToken);
      expect(verified).toBeNull();
    });

    it("should reject expired JWT tokens", () => {
      const expiredToken = jwt.sign(
        { userId: "user-1", role: "ADMIN", businessId: "biz-101" },
        JWT_SECRET,
        { expiresIn: "-10s" } // Expired 10 seconds ago
      );

      const verified = verifySessionToken(expiredToken);
      expect(verified).toBeNull();
    });
  });

  // ==========================================
  // VULN-02: BOLA / Multi-Tenant Isolation
  // ==========================================
  describe("VULN-02: Multi-Tenant BOLA Isolation (getActiveBusinessId)", () => {
    it("should forbid client-supplied x-business-id when user does not belong to that tenant", async () => {
      // Mock request from a user who only belongs to biz-101 attempting to access biz-103
      const token = signSessionToken({
        userId: "usr-regular",
        email: "staff@hanif.com",
        name: "Staff",
        role: "TENANT_USER" as any,
        businessId: "biz-101",
        businessName: "Hanif Mobile",
        companyIds: ["biz-101"],
      });

      const req = new NextRequest("http://localhost:3000/api/products", {
        headers: {
          "x-business-id": "biz-103", // Attacker tries to inject Al-Madina ID
          cookie: `sb_auth_token=${token}; sb_active_business_id=biz-103`,
        },
      });

      const activeId = await getActiveBusinessId(req);
      // Must NOT return the injected biz-103; must fallback safely to user's authorized company biz-101
      expect(activeId).toBe("biz-101");
      expect(activeId).not.toBe("biz-103");
    });

    it("should allow SUPER_ADMIN to legitimately access any tenant", async () => {
      const superAdminToken = signSessionToken({
        userId: "usr-superadmin",
        email: "admin@smartbiz.com",
        name: "Super Admin",
        role: "SUPER_ADMIN" as any,
        businessId: "biz-101",
        businessName: "Main",
        companyIds: ["biz-101", "biz-102", "biz-103"],
      });

      const req = new NextRequest("http://localhost:3000/api/products", {
        headers: {
          "x-business-id": "biz-103",
          cookie: `sb_auth_token=${superAdminToken}`,
        },
      });

      const activeId = await getActiveBusinessId(req);
      expect(activeId).toBe("biz-103");
    });
  });

  // ==========================================
  // VULN-03: Transaction Reset Privilege Authorization
  // ==========================================
  describe("VULN-03: Privileged Transaction Reset Protection", () => {
    it("should reject unauthenticated requests to reset transactions", async () => {
      const req = new NextRequest("http://localhost:3000/api/admin/companies/reset-transactions", {
        method: "POST",
        body: JSON.stringify({ companyId: "biz-101", confirmationText: "CONFIRM_RESET_ALL_DATA_PERMANENTLY" }),
      });

      const res = await resetTransactionsRoute(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain("Access denied");
    });

    it("should reject non-SUPER_ADMIN authenticated users from resetting transactions", async () => {
      const tenantAdminToken = signSessionToken({
        userId: "usr-tenant-admin",
        email: "owner@hanif.com",
        name: "Tenant Admin",
        role: "ADMIN" as any,
        businessId: "biz-101",
        businessName: "Hanif Mobile",
        companyIds: ["biz-101"],
      });

      const req = new NextRequest("http://localhost:3000/api/admin/companies/reset-transactions", {
        method: "POST",
        headers: {
          cookie: `sb_auth_token=${tenantAdminToken}`,
        },
        body: JSON.stringify({ companyId: "biz-101", confirmationText: "CONFIRM_RESET_ALL_DATA_PERMANENTLY" }),
      });

      const res = await resetTransactionsRoute(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });

  // ==========================================
  // VULN-04: Unauthenticated Admin Endpoints Rejection
  // ==========================================
  describe("VULN-04: Admin Endpoints Authentication Enforcement", () => {
    it("should reject unauthenticated GET /api/admin/companies", async () => {
      const req = new NextRequest("http://localhost:3000/api/admin/companies");
      const res = await getCompaniesRoute(req);
      expect(res.status).toBe(403);
    });

    it("should reject unauthenticated POST /api/admin/companies", async () => {
      const req = new NextRequest("http://localhost:3000/api/admin/companies", {
        method: "POST",
        body: JSON.stringify({ name: "Malicious Company" }),
      });
      const res = await postCompaniesRoute(req);
      expect(res.status).toBe(403);
    });

    it("should reject unauthenticated PUT /api/admin/companies/[id]", async () => {
      const req = new NextRequest("http://localhost:3000/api/admin/companies/biz-101", {
        method: "PUT",
        body: JSON.stringify({ name: "Hacked Name" }),
      });
      const res = await putCompanyRoute(req, { params: { id: "biz-101" } });
      expect(res.status).toBe(403);
    });

    it("should reject unauthenticated DELETE /api/admin/companies/[id]", async () => {
      const req = new NextRequest("http://localhost:3000/api/admin/companies/biz-101", {
        method: "DELETE",
      });
      const res = await deleteCompanyRoute(req, { params: { id: "biz-101" } });
      expect(res.status).toBe(403);
    });

    it("should reject unauthenticated GET /api/admin/users", async () => {
      const res = await getUsersRoute(new NextRequest("http://localhost:3000/api/admin/users"));
      expect(res.status).toBe(403);
    });

    it("should reject unauthenticated POST /api/admin/users", async () => {
      const req = new NextRequest("http://localhost:3000/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ name: "Attacker", email: "attacker@evil.com" }),
      });
      const res = await postUsersRoute(req);
      expect(res.status).toBe(403);
    });

    it("should reject unauthenticated PUT /api/admin/users/[id]", async () => {
      const req = new NextRequest("http://localhost:3000/api/admin/users/usr-1", {
        method: "PUT",
        body: JSON.stringify({ name: "Attacker Modified" }),
      });
      const res = await putUserRoute(req, { params: { id: "usr-1" } });
      expect(res.status).toBe(403);
    });

    it("should reject unauthenticated DELETE /api/admin/users/[id]", async () => {
      const req = new NextRequest("http://localhost:3000/api/admin/users/usr-1", {
        method: "DELETE",
      });
      const res = await deleteUserRoute(req, { params: { id: "usr-1" } });
      expect(res.status).toBe(403);
    });

    it("should reject unauthenticated POST /api/branches/[id]/assign", async () => {
      const req = new NextRequest("http://localhost:3000/api/branches/br-1/assign", {
        method: "POST",
        body: JSON.stringify({ userId: "usr-1", action: "assign" }),
      });
      const res = await assignBranchRoute(req, { params: { id: "br-1" } });
      expect(res.status).toBe(403);
    });
  });

  // ==========================================
  // VULN-05: Company Switch Authentication & Authorization
  // ==========================================
  describe("VULN-05: Company Switch Access Control", () => {
    it("should reject unauthenticated POST /api/auth/switch-company", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/switch-company", {
        method: "POST",
        body: JSON.stringify({ businessId: "biz-101" }),
      });

      const res = await switchCompanyRoute(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain("Authentication required");
    });

    it("should reject switching to a company the user does not belong to", async () => {
      const regularUserToken = signSessionToken({
        userId: "usr-user-only",
        email: "regular@hanif.com",
        name: "Regular Staff",
        role: "STAFF" as any,
        businessId: "biz-101",
        businessName: "Hanif Mobile",
        companyIds: ["biz-101"], // Only belongs to biz-101
      });

      const req = new NextRequest("http://localhost:3000/api/auth/switch-company", {
        method: "POST",
        headers: {
          cookie: `sb_auth_token=${regularUserToken}`,
        },
        body: JSON.stringify({ businessId: "biz-103" }), // Unauthorized tenant
      });

      const res = await switchCompanyRoute(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain("Access denied");
    });

    it("should allow switching to an authorized company", async () => {
      const multiCompanyUserToken = signSessionToken({
        userId: "usr-multi",
        email: "owner@group.com",
        name: "Group Owner",
        role: "ADMIN" as any,
        businessId: "biz-101",
        businessName: "Hanif Mobile",
        companyIds: ["biz-101", "biz-102"], // Belongs to both
      });

      const req = new NextRequest("http://localhost:3000/api/auth/switch-company", {
        method: "POST",
        headers: {
          cookie: `sb_auth_token=${multiCompanyUserToken}`,
        },
        body: JSON.stringify({ businessId: "biz-102" }),
      });

      const res = await switchCompanyRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.businessId).toBe("biz-102");
    });
  });

  // ==========================================
  // VULN-07: Image Upload Size and MIME Validation
  // ==========================================
  describe("VULN-07: AI Image Upload Size & MIME Type Validation", () => {
    it("should reject image payload exceeding the maximum allowed size (10MB)", async () => {
      // Create a dummy payload exceeding 14MB
      const hugeString = "data:image/jpeg;base64," + "A".repeat(15 * 1024 * 1024);

      await expect(
        extractFromImage({ imageUrl: hugeString })
      ).rejects.toThrow(/exceeds maximum allowed size/);
    });

    it("should reject unsupported MIME types (e.g. SVG or executable)", async () => {
      const unsupportedDataUrl = "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=";

      await expect(
        extractFromImage({ imageUrl: unsupportedDataUrl })
      ).rejects.toThrow(/Unsupported image format/);
    });

    it("should reject unauthenticated requests to /api/ai/extract", async () => {
      const req = new NextRequest("http://localhost:3000/api/ai/extract", {
        method: "POST",
        body: JSON.stringify({ text: "Test text transaction" }),
      });

      const res = await aiExtractRoute(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("should reject invalid MIME types at HTTP route layer", async () => {
      const token = signSessionToken({
        userId: "usr-1",
        email: "test@example.com",
        name: "User",
        role: "ADMIN" as any,
        businessId: "biz-101",
        businessName: "Company",
      });

      const req = new NextRequest("http://localhost:3000/api/ai/extract", {
        method: "POST",
        headers: {
          cookie: `sb_auth_token=${token}`,
        },
        body: JSON.stringify({
          imageUrl: "data:application/pdf;base64,JVBERi0xLjQK",
        }),
      });

      const res = await aiExtractRoute(req);
      expect(res.status).toBe(415);
      const json = await res.json();
      expect(json.error).toContain("Unsupported image format");
    });
  });

  // ==========================================
  // VULN-08: Login Rate Limiting
  // ==========================================
  describe("VULN-08: Sliding Window Login Rate Limiter", () => {
    const testKey = "test-rate-limit-client-ip-123";

    beforeEach(() => {
      resetLoginRateLimit(testKey);
    });

    it("should allow initial login attempts within limit", () => {
      const initial = checkLoginRateLimit(testKey);
      expect(initial.allowed).toBe(true);
      expect(initial.remainingAttempts).toBe(5);

      const attempt1 = recordFailedLogin(testKey);
      expect(attempt1.allowed).toBe(true);
      expect(attempt1.remainingAttempts).toBe(4);
    });

    it("should block requests after 5 consecutive failed attempts (429 Lockout)", () => {
      // Perform 5 failed attempts
      for (let i = 1; i <= 5; i++) {
        recordFailedLogin(testKey);
      }

      const blockedCheck = checkLoginRateLimit(testKey);
      expect(blockedCheck.allowed).toBe(false);
      expect(blockedCheck.remainingAttempts).toBe(0);
      expect(blockedCheck.retryAfterSeconds).toBeGreaterThan(0);
      expect(blockedCheck.retryAfterSeconds).toBeLessThanOrEqual(900); // 15 mins
    });

    it("should reset rate limit counters on successful authentication", () => {
      // 3 failed attempts
      recordFailedLogin(testKey);
      recordFailedLogin(testKey);
      recordFailedLogin(testKey);

      expect(checkLoginRateLimit(testKey).remainingAttempts).toBe(2);

      // Successful login resets counter
      resetLoginRateLimit(testKey);

      const afterReset = checkLoginRateLimit(testKey);
      expect(afterReset.allowed).toBe(true);
      expect(afterReset.remainingAttempts).toBe(5);
    });
  });
});
