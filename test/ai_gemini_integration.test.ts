import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { signSessionToken, SessionPayload } from "@/lib/auth";
import { GET as getAiConfig } from "@/app/api/ai/extract/route";

describe("AI Gemini Integration & Security Hardening", () => {
  it("should recognize AQ. and AIza keys as valid Gemini keys and sk- as OpenAI keys", () => {
    const isGeminiKey = (k?: string | null): boolean => {
      if (!k) return false;
      const t = k.trim();
      return t.startsWith("AIza") || t.startsWith("AQ.") || (!t.startsWith("sk-") && t.length > 20);
    };

    const isOpenAiKey = (k?: string | null): boolean => {
      if (!k) return false;
      return k.trim().startsWith("sk-");
    };

    // Modern Google AI Studio Authorization Key (AQ. format)
    expect(isGeminiKey("AQ.Ab8MockKeyFormatForTesting1234567890abcdef")).toBe(true);
    expect(isOpenAiKey("AQ.Ab8MockKeyFormatForTesting1234567890abcdef")).toBe(false);

    // Legacy Google Gemini Key (AIza format)
    expect(isGeminiKey("AIzaSyDummyLegacyKey1234567890abcdef")).toBe(true);
    expect(isOpenAiKey("AIzaSyDummyLegacyKey1234567890abcdef")).toBe(false);

    // OpenAI Key (sk- format)
    expect(isGeminiKey("sk-proj-1234567890abcdef")).toBe(false);
    expect(isOpenAiKey("sk-proj-1234567890abcdef")).toBe(true);

    // Blank or invalid keys
    expect(isGeminiKey("")).toBe(false);
    expect(isGeminiKey(null)).toBe(false);
    expect(isGeminiKey("short")).toBe(false);
  });

  it("should return aiConfigured: true and defaultProvider: 'GEMINI' on authenticated GET /api/ai/extract", async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "AQ.MockKeyForTestingEnvironment1234567890";

    try {
      const payload: SessionPayload = {
        userId: "user-1",
        email: "test@example.com",
        name: "Test User",
        role: "ADMIN" as any,
        businessId: "biz-101",
        businessName: "Test Company",
        companyIds: ["biz-101"],
      };
      const validToken = signSessionToken(payload);

      // Mock authenticated session cookie
      const req = new NextRequest("http://localhost:3000/api/ai/extract", {
        method: "GET",
        headers: {
          cookie: `sb_auth_token=${validToken}`,
        },
      });

      const res = await getAiConfig(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.aiConfigured).toBe(true);
      expect(json.defaultProvider).toBe("GEMINI");
      // Strictly verify no raw secret is leaked in response
      expect(json).not.toHaveProperty("key");
      expect(json).not.toHaveProperty("apiKey");
      expect(json).not.toHaveProperty("GEMINI_API_KEY");
    } finally {
      process.env.GEMINI_API_KEY = originalKey;
    }
  });

  it("should reject unauthenticated GET /api/ai/extract with HTTP 401", async () => {
    const req = new NextRequest("http://localhost:3000/api/ai/extract", {
      method: "GET",
    });

    const res = await getAiConfig(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.success).toBe(false);
  });
});
