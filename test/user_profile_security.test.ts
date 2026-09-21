import { describe, it, expect, beforeEach } from "vitest";
import { fallbackStore, storeUpdateUser } from "@/lib/fallbackStore";
import { hashPassword, comparePassword } from "@/lib/auth";
import { POST as changePasswordHandler } from "@/app/api/auth/change-password/route";
import { GET as getProfileHandler, PUT as updateProfileHandler } from "@/app/api/auth/profile/route";
import { NextRequest } from "next/server";

describe("User Profile & Password Security Suite", () => {
  beforeEach(() => {
    // Reset test user usr-2 (Muhammad Hanif)
    const hanif = fallbackStore.users.find((u) => u.id === "usr-2");
    if (hanif) {
      hanif.password = "hanif123";
      hanif.name = "Muhammad Hanif (Owner)";
    }
  });

  it("should securely hash and verify passwords using bcrypt", async () => {
    const rawPass = "SecretSecurePass123!";
    const hash = await hashPassword(rawPass);
    expect(hash).not.toBe(rawPass);
    expect(hash.startsWith("$2")).toBe(true);

    const match = await comparePassword(rawPass, hash);
    expect(match).toBe(true);

    const wrongMatch = await comparePassword("WrongPassword123", hash);
    expect(wrongMatch).toBe(false);
  });

  it("should fetch user profile details with assigned companies", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/profile", {
      method: "GET",
    });

    const res = await getProfileHandler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.user).toBeDefined();
    expect(data.user.email).toBeDefined();
    expect(data.user.role).toBeDefined();
    expect(Array.isArray(data.user.companies)).toBe(true);
    expect(data.user.companies.length).toBeGreaterThan(0);
  });

  it("should reject password change when current password is missing or empty", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({
        currentPassword: "",
        newPassword: "NewSecretPassword123",
        confirmPassword: "NewSecretPassword123",
      }),
    });

    const res = await changePasswordHandler(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain("Current password is required");
  });

  it("should reject password change when new password is less than 6 characters", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({
        currentPassword: "admin123",
        newPassword: "123",
        confirmPassword: "123",
      }),
    });

    const res = await changePasswordHandler(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain("at least 6 characters");
  });

  it("should reject password change when new password and confirm password do not match", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({
        currentPassword: "admin123",
        newPassword: "ValidPassword123",
        confirmPassword: "DifferentPassword456",
      }),
    });

    const res = await changePasswordHandler(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain("do not match");
  });

  it("should reject password change when new password is same as current password", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({
        currentPassword: "admin123",
        newPassword: "admin123",
        confirmPassword: "admin123",
      }),
    });

    const res = await changePasswordHandler(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain("cannot be the same");
  });

  it("should reject password change when current password is invalid", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({
        currentPassword: "completely_wrong_current_password_999",
        newPassword: "BrandNewPassword2026",
        confirmPassword: "BrandNewPassword2026",
      }),
    });

    const res = await changePasswordHandler(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain("Current password is incorrect");
  });

  it("should successfully update password when current password is valid", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({
        currentPassword: "admin123",
        newPassword: "BrandNewSuperSecret2026!",
        confirmPassword: "BrandNewSuperSecret2026!",
      }),
    });

    const res = await changePasswordHandler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toContain("successfully");

    // Verify user in store has new password
    const adminUser = fallbackStore.users.find((u) => u.id === "usr-1");
    expect(adminUser?.password).toBe("BrandNewSuperSecret2026!");

    // Restore admin password for other tests/demo
    adminUser!.password = "admin123";
  });

  it("should update display name via PUT /api/auth/profile", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/profile", {
      method: "PUT",
      body: JSON.stringify({
        name: "Muhammad Hanif Executive",
      }),
    });

    const res = await updateProfileHandler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.name).toBe("Muhammad Hanif Executive");
  });
});
