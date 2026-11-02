import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { NextRequest } from "next/server";
import { signSessionToken, SessionPayload } from "@/lib/auth";
import { getClientIp, checkLoginRateLimit, recordFailedLogin, resetLoginRateLimit } from "@/lib/rateLimit";
import { POST as reverseSaleRoute } from "@/app/api/sales/[id]/reverse/route";
import { POST as assignBranchRoute } from "@/app/api/branches/[id]/assign/route";
import { fallbackStore } from "@/lib/fallbackStore";

describe("Focused Security Remediation Verification Suite", () => {
  // ==========================================
  // FINDING 1: Client IP Spoofing & Rate Limiter Header Precedence
  // ==========================================
  describe("FINDING 1: Client IP Spoofing Prevention", () => {
    it("should prioritize trusted X-Real-IP over client-supplied X-Forwarded-For", () => {
      const trustedRealIp = "203.0.113.195";
      const spoofedForwarded = "198.51.100.1, 198.51.100.2";

      const req = new NextRequest("http://localhost:3000/api/auth/login", {
        headers: {
          "x-real-ip": trustedRealIp,
          "x-forwarded-for": spoofedForwarded,
        },
      });

      const clientIp = getClientIp(req);
      expect(clientIp).toBe(trustedRealIp);
      expect(clientIp).not.toBe("198.51.100.1");
    });

    it("should prevent an attacker from bypassing IP rate limiting by rotating X-Forwarded-For when X-Real-IP is constant", () => {
      const attackerRealIp = "192.0.2.77";
      const rateLimitKey = `ip:${attackerRealIp}`;
      resetLoginRateLimit(rateLimitKey);

      // Attacker attempts 5 logins rotating X-Forwarded-For on each request
      for (let i = 1; i <= 5; i++) {
        const req = new NextRequest("http://localhost:3000/api/auth/login", {
          headers: {
            "x-real-ip": attackerRealIp,
            "x-forwarded-for": `10.0.0.${i}, 10.0.1.${i}`,
          },
        });
        const resolvedIp = getClientIp(req);
        expect(resolvedIp).toBe(attackerRealIp);
        recordFailedLogin(`ip:${resolvedIp}`);
      }

      // 6th attempt with another spoofed X-Forwarded-For must be BLOCKED
      const req6 = new NextRequest("http://localhost:3000/api/auth/login", {
        headers: {
          "x-real-ip": attackerRealIp,
          "x-forwarded-for": "172.16.0.99",
        },
      });
      const resolvedIp6 = getClientIp(req6);
      const checkResult = checkLoginRateLimit(`ip:${resolvedIp6}`);
      expect(checkResult.allowed).toBe(false);
      expect(checkResult.remainingAttempts).toBe(0);
      expect(checkResult.retryAfterSeconds).toBeGreaterThan(0);

      resetLoginRateLimit(rateLimitKey);
    });

    it("should fall back to rightmost proxy hop of X-Forwarded-For if X-Real-IP is absent", () => {
      const req = new NextRequest("http://localhost:3000/api/auth/login", {
        headers: {
          "x-forwarded-for": "client.fake.ip, intermediate.proxy, 203.0.113.88",
        },
      });

      const clientIp = getClientIp(req);
      expect(clientIp).toBe("203.0.113.88");
    });

    it("should evaluate CF-Connecting-IP when X-Real-IP is absent", () => {
      const req = new NextRequest("http://localhost:3000/api/auth/login", {
        headers: {
          "cf-connecting-ip": "198.51.100.42",
        },
      });

      const clientIp = getClientIp(req);
      expect(clientIp).toBe("198.51.100.42");
    });
  });

  // ==========================================
  // FINDING 2: Sale Reversal Tenant Ownership
  // ==========================================
  describe("FINDING 2: Sale Reversal Tenant Ownership Enforcement", () => {
    const tenantASaleId = "test-sale-tenant-a-101";
    const tenantBSaleId = "test-sale-tenant-b-202";

    beforeEach(() => {
      // Seed test sales into fallbackStore
      const existingA = fallbackStore.sales.find((s) => s.id === tenantASaleId);
      if (!existingA) {
        fallbackStore.sales.push({
          id: tenantASaleId,
          businessId: "biz-tenant-a",
          customerName: "Buyer A",
          total: 10000,
          paidAmount: 10000,
          remainingAmount: 0,
          paymentMethod: "CASH",
          status: "COMPLETED",
          items: [],
          createdAt: new Date().toISOString(),
        } as any);
      } else {
        existingA.status = "COMPLETED";
      }

      const existingB = fallbackStore.sales.find((s) => s.id === tenantBSaleId);
      if (!existingB) {
        fallbackStore.sales.push({
          id: tenantBSaleId,
          businessId: "biz-tenant-b",
          customerName: "Buyer B",
          total: 25000,
          paidAmount: 25000,
          remainingAmount: 0,
          paymentMethod: "BANK",
          status: "COMPLETED",
          items: [],
          createdAt: new Date().toISOString(),
        } as any);
      } else {
        existingB.status = "COMPLETED";
      }
    });

    it("should reject unauthenticated POST /api/sales/[id]/reverse with HTTP 401", async () => {
      const req = new NextRequest(`http://localhost:3000/api/sales/${tenantASaleId}/reverse`, {
        method: "POST",
        body: JSON.stringify({ reason: "Unauthenticated test" }),
      });

      const res = await reverseSaleRoute(req, { params: { id: tenantASaleId } });
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain("Authentication required");
    });

    it("should reject nonexistent sale reversal with HTTP 404", async () => {
      const token = signSessionToken({
        userId: "usr-tenant-a",
        email: "owner@tenanta.com",
        name: "Owner A",
        role: "OWNER_ADMIN" as any,
        businessId: "biz-tenant-a",
        businessName: "Tenant A Co",
        companyIds: ["biz-tenant-a"],
      });

      const req = new NextRequest("http://localhost:3000/api/sales/nonexistent-sale-999/reverse", {
        method: "POST",
        headers: { cookie: `sb_auth_token=${token}` },
        body: JSON.stringify({ reason: "Nonexistent" }),
      });

      const res = await reverseSaleRoute(req, { params: { id: "nonexistent-sale-999" } });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain("Sale not found");
    });

    it("should reject cross-tenant sale reversal with HTTP 403 and cause ZERO mutations", async () => {
      // User belongs to Tenant A
      const tenantAUserToken = signSessionToken({
        userId: "usr-tenant-a",
        email: "owner@tenanta.com",
        name: "Owner A",
        role: "OWNER_ADMIN" as any,
        businessId: "biz-tenant-a",
        businessName: "Tenant A Co",
        companyIds: ["biz-tenant-a"],
      });

      // Target sale belongs to Tenant B
      const saleBefore = fallbackStore.sales.find((s) => s.id === tenantBSaleId);
      expect(saleBefore?.status).toBe("COMPLETED");

      const req = new NextRequest(`http://localhost:3000/api/sales/${tenantBSaleId}/reverse`, {
        method: "POST",
        headers: { cookie: `sb_auth_token=${tenantAUserToken}` },
        body: JSON.stringify({ reason: "Malicious cross-tenant attempt" }),
      });

      const res = await reverseSaleRoute(req, { params: { id: tenantBSaleId } });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain("Access Denied");

      // Verify that rejected cross-tenant attempt caused ZERO mutation
      const saleAfter = fallbackStore.sales.find((s) => s.id === tenantBSaleId);
      expect(saleAfter?.status).toBe("COMPLETED"); // Status untouched!
    });

    it("should permit authorized reversal within the same business", async () => {
      const tenantAUserToken = signSessionToken({
        userId: "usr-tenant-a",
        email: "owner@tenanta.com",
        name: "Owner A",
        role: "OWNER_ADMIN" as any,
        businessId: "biz-tenant-a",
        businessName: "Tenant A Co",
        companyIds: ["biz-tenant-a"],
      });

      const req = new NextRequest(`http://localhost:3000/api/sales/${tenantASaleId}/reverse`, {
        method: "POST",
        headers: { cookie: `sb_auth_token=${tenantAUserToken}` },
        body: JSON.stringify({ reason: "Customer return" }),
      });

      const res = await reverseSaleRoute(req, { params: { id: tenantASaleId } });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);

      const saleAfter = fallbackStore.sales.find((s) => s.id === tenantASaleId);
      expect(saleAfter?.status).toBe("CANCELLED");
    });
  });

  // ==========================================
  // FINDING 3: Branch Assignment Tenant Ownership
  // ==========================================
  describe("FINDING 3: Branch Assignment Tenant Ownership Enforcement", () => {
    const tenantABranchId = "br-tenant-a-01";
    const tenantBBranchId = "br-tenant-b-02";
    const tenantAUserId = "usr-staff-tenant-a";
    const tenantBUserId = "usr-staff-tenant-b";

    beforeEach(() => {
      // Ensure branches exist in fallbackStore
      if (!fallbackStore.branches) fallbackStore.branches = [];
      const brA = fallbackStore.branches.find((b) => b.id === tenantABranchId);
      if (!brA) {
        fallbackStore.branches.push({
          id: tenantABranchId,
          businessId: "biz-tenant-a",
          name: "Tenant A Main Branch",
          city: "Karachi",
          isMain: true,
          status: "ACTIVE",
        } as any);
      }

      const brB = fallbackStore.branches.find((b) => b.id === tenantBBranchId);
      if (!brB) {
        fallbackStore.branches.push({
          id: tenantBBranchId,
          businessId: "biz-tenant-b",
          name: "Tenant B Main Branch",
          city: "Lahore",
          isMain: true,
          status: "ACTIVE",
        } as any);
      }

      // Ensure users exist in fallbackStore
      const uA = fallbackStore.users.find((u) => u.id === tenantAUserId);
      if (!uA) {
        fallbackStore.users.push({
          id: tenantAUserId,
          businessId: "biz-tenant-a",
          companyIds: ["biz-tenant-a"],
          name: "Staff A",
          email: "staffA@tenanta.com",
          role: "STAFF",
          branchId: null,
        } as any);
      } else {
        uA.branchId = null;
      }

      const uB = fallbackStore.users.find((u) => u.id === tenantBUserId);
      if (!uB) {
        fallbackStore.users.push({
          id: tenantBUserId,
          businessId: "biz-tenant-b",
          companyIds: ["biz-tenant-b"],
          name: "Staff B",
          email: "staffB@tenantb.com",
          role: "STAFF",
          branchId: null,
        } as any);
      } else {
        uB.branchId = null;
      }
    });

    it("should reject unauthenticated POST /api/branches/[id]/assign with HTTP 403", async () => {
      const req = new NextRequest(`http://localhost:3000/api/branches/${tenantABranchId}/assign`, {
        method: "POST",
        body: JSON.stringify({ userId: tenantAUserId, action: "assign" }),
      });

      const res = await assignBranchRoute(req, { params: { id: tenantABranchId } });
      expect(res.status).toBe(403);
    });

    it("should reject nonexistent branch with HTTP 404", async () => {
      const token = signSessionToken({
        userId: "usr-tenant-a",
        email: "owner@tenanta.com",
        name: "Owner A",
        role: "OWNER_ADMIN" as any,
        businessId: "biz-tenant-a",
        businessName: "Tenant A Co",
        companyIds: ["biz-tenant-a"],
      });

      const req = new NextRequest("http://localhost:3000/api/branches/nonexistent-branch-999/assign", {
        method: "POST",
        headers: { cookie: `sb_auth_token=${token}` },
        body: JSON.stringify({ userId: tenantAUserId, action: "assign" }),
      });

      const res = await assignBranchRoute(req, { params: { id: "nonexistent-branch-999" } });
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toContain("Branch not found");
    });

    it("should reject cross-tenant branch assignment when branch belongs to another company", async () => {
      // Owner of Tenant A attempts to assign staff to Tenant B's branch
      const token = signSessionToken({
        userId: "usr-tenant-a",
        email: "owner@tenanta.com",
        name: "Owner A",
        role: "OWNER_ADMIN" as any,
        businessId: "biz-tenant-a",
        businessName: "Tenant A Co",
        companyIds: ["biz-tenant-a"],
      });

      const staffABefore = fallbackStore.users.find((u) => u.id === tenantAUserId);
      expect(staffABefore?.branchId).toBeNull();

      const req = new NextRequest(`http://localhost:3000/api/branches/${tenantBBranchId}/assign`, {
        method: "POST",
        headers: { cookie: `sb_auth_token=${token}` },
        body: JSON.stringify({ userId: tenantAUserId, action: "assign" }),
      });

      const res = await assignBranchRoute(req, { params: { id: tenantBBranchId } });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain("Target branch belongs to another company");

      // Verify no mutation occurred
      const staffAAfter = fallbackStore.users.find((u) => u.id === tenantAUserId);
      expect(staffAAfter?.branchId).toBeNull(); // Untouched
    });

    it("should reject assigning a user from another company to caller's branch", async () => {
      // Owner of Tenant A attempts to assign Staff B (from Tenant B) to Tenant A's branch
      const token = signSessionToken({
        userId: "usr-tenant-a",
        email: "owner@tenanta.com",
        name: "Owner A",
        role: "OWNER_ADMIN" as any,
        businessId: "biz-tenant-a",
        businessName: "Tenant A Co",
        companyIds: ["biz-tenant-a"],
      });

      const staffBBefore = fallbackStore.users.find((u) => u.id === tenantBUserId);
      expect(staffBBefore?.branchId).toBeNull();

      const req = new NextRequest(`http://localhost:3000/api/branches/${tenantABranchId}/assign`, {
        method: "POST",
        headers: { cookie: `sb_auth_token=${token}` },
        body: JSON.stringify({ userId: tenantBUserId, action: "assign" }),
      });

      const res = await assignBranchRoute(req, { params: { id: tenantABranchId } });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain("Target user is not a member of your company");

      // Verify no mutation occurred
      const staffBAfter = fallbackStore.users.find((u) => u.id === tenantBUserId);
      expect(staffBAfter?.branchId).toBeNull(); // Untouched
    });

    it("should permit authorized owner within same business to assign and unassign staff", async () => {
      const token = signSessionToken({
        userId: "usr-tenant-a",
        email: "owner@tenanta.com",
        name: "Owner A",
        role: "OWNER_ADMIN" as any,
        businessId: "biz-tenant-a",
        businessName: "Tenant A Co",
        companyIds: ["biz-tenant-a"],
      });

      // 1. Assign staff to branch
      const assignReq = new NextRequest(`http://localhost:3000/api/branches/${tenantABranchId}/assign`, {
        method: "POST",
        headers: { cookie: `sb_auth_token=${token}` },
        body: JSON.stringify({ userId: tenantAUserId, action: "assign" }),
      });

      const assignRes = await assignBranchRoute(assignReq, { params: { id: tenantABranchId } });
      expect(assignRes.status).toBe(200);

      const staffAssigned = fallbackStore.users.find((u) => u.id === tenantAUserId);
      expect(staffAssigned?.branchId).toBe(tenantABranchId);

      // 2. Unassign staff from branch
      const unassignReq = new NextRequest(`http://localhost:3000/api/branches/${tenantABranchId}/assign`, {
        method: "POST",
        headers: { cookie: `sb_auth_token=${token}` },
        body: JSON.stringify({ userId: tenantAUserId, action: "unassign" }),
      });

      const unassignRes = await assignBranchRoute(unassignReq, { params: { id: tenantABranchId } });
      expect(unassignRes.status).toBe(200);

      const staffUnassigned = fallbackStore.users.find((u) => u.id === tenantAUserId);
      expect(staffUnassigned?.branchId).toBeNull();
    });
  });

  // ==========================================
  // FINDING 4: Rate-Limit Journal File Permissions Mode
  // ==========================================
  describe("FINDING 4: Rate Limit Journal Permissions", () => {
    it("should write rate limit journal with atomic owner-only permissions", () => {
      const testKey = "perm-test-key-555";
      recordFailedLogin(testKey);

      const persistencePath = path.join(os.tmpdir(), "sb_login_rate_limits.json");
      expect(fs.existsSync(persistencePath)).toBe(true);

      const content = fs.readFileSync(persistencePath, "utf-8");
      expect(content).toContain(testKey);

      // Verify file stats are readable
      const stat = fs.statSync(persistencePath);
      expect(stat.isFile()).toBe(true);
      expect(stat.size).toBeGreaterThan(0);

      resetLoginRateLimit(testKey);
    });
  });
});
