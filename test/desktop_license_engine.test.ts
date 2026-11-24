import { describe, it, expect } from "vitest";
import {
  generateLicenseKey,
  verifyLicenseKey,
  normalizeMachineId,
  formatMachineId,
  buildWhatsAppLicenseMessage,
  DesktopLicense,
} from "../src/lib/desktopLicense";

describe("Desktop License Engine & Cryptographic Anti-Piracy Suite", () => {
  const sampleMachine = "MCH-8F29-A4B1-99C3";

  it("normalizes and formats hardware machine IDs cleanly", () => {
    const raw = "  mch-8f29-a4b1-99c3  ";
    expect(normalizeMachineId(raw)).toBe("MCH8F29A4B199C3");
    expect(formatMachineId(raw)).toBe("MCH-8F29-A4B1-99C3");
  });

  it("generates a valid 5-segment cryptographic key for Accounting Only", () => {
    const key = generateLicenseKey({
      machineId: sampleMachine,
      packageType: "ACCOUNTING_ONLY",
      expiresAt: "2027-11-24",
    });

    expect(key).toMatch(/^A360-ACC-8F29-20271124-[0-9A-F]{16}$/);

    const verified = verifyLicenseKey(key, sampleMachine, new Date("2026-11-24"));
    expect(verified.valid).toBe(true);
    expect(verified.packageType).toBe("ACCOUNTING_ONLY");
    expect(verified.expiresAt).toBe("2027-11-24");
    expect(verified.isExpired).toBe(false);
    expect(verified.isGracePeriod).toBe(false);
    expect(verified.daysRemaining).toBe(365);
  });

  it("generates and verifies POS and Digital Invoicing combo packages", () => {
    const posKey = generateLicenseKey({
      machineId: sampleMachine,
      packageType: "POS_COMBO",
      expiresAt: "2027-11-24",
    });
    expect(posKey).toContain("A360-POS-8F29-20271124-");
    expect(verifyLicenseKey(posKey, sampleMachine).packageType).toBe("POS_COMBO");

    const diKey = generateLicenseKey({
      machineId: sampleMachine,
      packageType: "DI_COMBO",
      expiresAt: "2027-11-24",
    });
    expect(diKey).toContain("A360-DIR-8F29-20271124-");
    expect(verifyLicenseKey(diKey, sampleMachine).packageType).toBe("DI_COMBO");
  });

  it("enforces strict machine-lock: rejects valid key on a different computer", () => {
    const keyForMachineA = generateLicenseKey({
      machineId: "MCH-8F29-A4B1-99C3",
      packageType: "POS_COMBO",
      expiresAt: "2027-11-24",
    });

    const pirateMachineB = "MCH-7B11-C2D3-88AA";
    const verification = verifyLicenseKey(keyForMachineA, pirateMachineB);

    expect(verification.valid).toBe(false);
    expect(verification.error).toBeDefined();
  });

  it("detects tampering: rejects key if expiry date or package was manually altered", () => {
    const genuineKey = generateLicenseKey({
      machineId: sampleMachine,
      packageType: "ACCOUNTING_ONLY",
      expiresAt: "2027-11-24",
    });

    // Hacker tries to change expiry to year 2035
    const tamperedDateKey = genuineKey.replace("20271124", "20351124");
    const res1 = verifyLicenseKey(tamperedDateKey, sampleMachine);
    expect(res1.valid).toBe(false);
    expect(res1.error).toContain("signature validation failed");

    // Hacker tries to upgrade package from ACC to POS
    const tamperedPkgKey = genuineKey.replace("-ACC-", "-POS-");
    const res2 = verifyLicenseKey(tamperedPkgKey, sampleMachine);
    expect(res2.valid).toBe(false);
    expect(res2.error).toContain("signature validation failed");
  });

  it("handles 7-day grace period and expiration accurately", () => {
    const key = generateLicenseKey({
      machineId: sampleMachine,
      packageType: "POS_COMBO",
      expiresAt: "2027-11-24",
    });

    // 1. Date before expiry: Valid
    const beforeExpiry = verifyLicenseKey(key, sampleMachine, new Date("2027-11-20"));
    expect(beforeExpiry.valid).toBe(true);
    expect(beforeExpiry.isExpired).toBe(false);
    expect(beforeExpiry.isGracePeriod).toBe(false);
    expect(beforeExpiry.daysRemaining).toBe(4);

    // 2. Date 3 days after expiry: Within 7-day Grace Period (app still operational)
    const duringGrace = verifyLicenseKey(key, sampleMachine, new Date("2027-11-27"));
    expect(duringGrace.valid).toBe(true);
    expect(duringGrace.isGracePeriod).toBe(true);
    expect(duringGrace.isExpired).toBe(false);

    // 3. Date 10 days after expiry: Grace period ended, completely locked
    const afterGrace = verifyLicenseKey(key, sampleMachine, new Date("2027-12-05"));
    expect(afterGrace.valid).toBe(false);
    expect(afterGrace.isExpired).toBe(true);
    expect(afterGrace.isGracePeriod).toBe(false);
  });

  it("formats WhatsApp share message containing client name, key, and instructions", () => {
    const sampleLicense: DesktopLicense = {
      id: "lic-101",
      machineId: "MCH-8F29-A4B1-99C3",
      clientName: "Adeel Textile Store",
      packageType: "POS_COMBO",
      issuedAt: "2026-11-24",
      expiresAt: "2027-11-24",
      annualFee: 25000,
      status: "ACTIVE",
      licenseKey: "A360-POS-8F29-20271124-7B9F1E2A4C6D8E0B",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const msg = buildWhatsAppLicenseMessage(sampleLicense);
    expect(msg).toContain("Adeel Textile Store");
    expect(msg).toContain("A360-POS-8F29-20271124-7B9F1E2A4C6D8E0B");
    expect(msg).toContain("Retail POS + Accounting");
    expect(msg).toContain("2027-11-24");
  });
});
