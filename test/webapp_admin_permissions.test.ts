import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { signSessionToken, SessionPayload } from "@/lib/auth";
import { GET as getUsersRoute, POST as postUsersRoute } from "@/app/api/admin/users/route";
import { PUT as putUserRoute, DELETE as deleteUserRoute } from "@/app/api/admin/users/[id]/route";
import { POST as switchUserRoute } from "@/app/api/auth/switch-user/route";
import { fallbackStore } from "@/lib/fallbackStore";

describe("WebApp Admin Permissions & Super Admin Invisibility", () => {
  const superAdminPayload: SessionPayload = {
    userId: "usr-super-admin",
    email: "hashim@smartbiz.com",
    name: "Hashim Khan",
    role: "SUPER_ADMIN",
    platformRole: "SUPER_ADMIN",
    businessId: fallbackStore.companies[0].id,
    businessName: fallbackStore.companies[0].name,
    companyIds: fallbackStore.companies.map((c) => c.id),
  };

  const webappAdminPayload: SessionPayload = {
    userId: "usr-webapp-admin",
    email: "webapp.admin@smartbiz.com",
    name: "WebApp Administrator",
    role: "ADMIN",
    platformRole: "WEBAPP_ADMIN",
    businessId: fallbackStore.companies[0].id,
    businessName: fallbackStore.companies[0].name,
    companyIds: fallbackStore.companies.map((c) => c.id),
  };

  const regularStaffPayload: SessionPayload = {
    userId: "usr-staff",
    email: "cashier@smartbiz.com",
    name: "Cashier Bilal",
    role: "STAFF",
    platformRole: "TENANT_USER",
    businessId: fallbackStore.companies[0].id,
    businessName: fallbackStore.companies[0].name,
    companyIds: [fallbackStore.companies[0].id],
  };

  const createAuthedRequest = (url: string, payload: SessionPayload, options: RequestInit = {}) => {
    const token = signSessionToken(payload);
    const headers = new Headers(options.headers);
    headers.set("Cookie", `sb_auth_token=${token}`);
    return new NextRequest(url, { ...options, headers } as any);
  };

  it("should allow WebApp Admin to fetch user directory, but EXCLUDE Super Admin entirely", async () => {
    const req = createAuthedRequest("http://localhost:3000/api/admin/users", webappAdminPayload);
    const res = await getUsersRoute(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);

    // Verify zero Super Admin users are visible
    const superAdmins = json.data.filter(
      (u: any) => u.role === "SUPER_ADMIN" || u.platformRole === "SUPER_ADMIN"
    );
    expect(superAdmins.length).toBe(0);
  });

  it("should allow Super Admin to fetch user directory AND see Super Admin", async () => {
    const req = createAuthedRequest("http://localhost:3000/api/admin/users", superAdminPayload);
    const res = await getUsersRoute(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);

    const superAdmins = json.data.filter(
      (u: any) => u.role === "SUPER_ADMIN" || u.platformRole === "SUPER_ADMIN"
    );
    expect(superAdmins.length).toBeGreaterThan(0);
  });

  it("should reject regular staff from accessing /api/admin/users", async () => {
    const req = createAuthedRequest("http://localhost:3000/api/admin/users", regularStaffPayload);
    const res = await getUsersRoute(req);
    expect(res.status).toBe(403);
  });

  it("should allow WebApp Admin to create a normal Shop User", async () => {
    const testEmail = `shopuser_${Date.now()}@test.com`;
    const req = createAuthedRequest("http://localhost:3000/api/admin/users", webappAdminPayload, {
      method: "POST",
      body: JSON.stringify({
        name: "Shop Manager Test",
        email: testEmail,
        password: "password123",
        role: "OWNER_ADMIN",
        companyIds: [fallbackStore.companies[0].id],
        allowedModules: ["sales", "purchases", "accounting"],
      }),
    });

    const res = await postUsersRoute(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.email).toBe(testEmail);
  });

  it("should allow WebApp Admin to create another WebApp User", async () => {
    const testEmail = `webappsupport_${Date.now()}@test.com`;
    const req = createAuthedRequest("http://localhost:3000/api/admin/users", webappAdminPayload, {
      method: "POST",
      body: JSON.stringify({
        name: "Support Staff Test",
        email: testEmail,
        password: "password123",
        isPlatformUser: true,
        platformRole: "WEBAPP_EDITOR",
      }),
    });

    const res = await postUsersRoute(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.platformRole).toBe("WEBAPP_EDITOR");
  });

  it("should STRICTLY REJECT creating any user with SUPER_ADMIN role", async () => {
    const req = createAuthedRequest("http://localhost:3000/api/admin/users", webappAdminPayload, {
      method: "POST",
      body: JSON.stringify({
        name: "Fake Super Admin",
        email: `fakesuper_${Date.now()}@test.com`,
        password: "password123",
        role: "SUPER_ADMIN",
      }),
    });

    const res = await postUsersRoute(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toContain("Super Admin");
  });

  it("should forbid WebApp Admin from modifying Super Admin account", async () => {
    // Find super admin in fallback store
    const superAdmin = fallbackStore.users.find((u) => u.role === "SUPER_ADMIN");
    if (superAdmin) {
      const req = createAuthedRequest(
        `http://localhost:3000/api/admin/users/${superAdmin.id}`,
        webappAdminPayload,
        {
          method: "PUT",
          body: JSON.stringify({ name: "Hacked Super Admin" }),
        }
      );
      const res = await putUserRoute(req, { params: { id: superAdmin.id } });
      expect(res.status).toBe(403);
    }
  });

  it("should forbid WebApp Admin from deleting Super Admin account", async () => {
    const superAdmin = fallbackStore.users.find((u) => u.role === "SUPER_ADMIN");
    if (superAdmin) {
      const req = createAuthedRequest(
        `http://localhost:3000/api/admin/users/${superAdmin.id}`,
        webappAdminPayload,
        { method: "DELETE" }
      );
      const res = await deleteUserRoute(req, { params: { id: superAdmin.id } });
      expect(res.status).toBe(400);
    }
  });

  it("should forbid WebApp Admin from switching into Super Admin profile", async () => {
    const superAdmin = fallbackStore.users.find((u) => u.role === "SUPER_ADMIN");
    if (superAdmin) {
      const req = createAuthedRequest(
        "http://localhost:3000/api/auth/switch-user",
        webappAdminPayload,
        {
          method: "POST",
          body: JSON.stringify({ targetUserId: superAdmin.id }),
        }
      );
      const res = await switchUserRoute(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain("Super Admin");
    }
  });
});
