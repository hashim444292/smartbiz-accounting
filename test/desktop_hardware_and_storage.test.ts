import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { getMachineId, _resetMachineIdCache } from "../src/lib/hardwareId";
import {
  generateLicenseKey,
  verifyLicenseKey,
} from "../src/lib/desktopLicense";
import {
  getLocalLicenseStatus,
  saveLocalLicense,
  clearLocalLicense,
  getDesktopLicenseFilePath,
} from "../src/lib/desktopStorage";

describe("Desktop Hardware Fingerprinting & Local Storage", () => {
  const tempTestFile = path.join(os.tmpdir(), `test_a360_license_${Date.now()}.json`);

  beforeEach(() => {
    process.env.DESKTOP_LICENSE_FILE = tempTestFile;
    _resetMachineIdCache();
  });

  afterEach(() => {
    delete process.env.DESKTOP_LICENSE_FILE;
    if (fs.existsSync(tempTestFile)) {
      try {
        fs.unlinkSync(tempTestFile);
      } catch {}
    }
  });

  it("1. getMachineId() returns properly formatted 17-char MCH code", () => {
    const mid = getMachineId();
    expect(mid).toMatch(/^MCH-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
  });

  it("2. getMachineId() is deterministic across repeated calls", () => {
    const mid1 = getMachineId();
    const mid2 = getMachineId();
    expect(mid1).toBe(mid2);

    // Reset internal cache to ensure recalculation also produces identical code
    _resetMachineIdCache();
    const mid3 = getMachineId();
    expect(mid3).toBe(mid1);
  });

  it("3. getLocalLicenseStatus() returns unactivated when file does not exist", () => {
    const status = getLocalLicenseStatus();
    expect(status.isActivated).toBe(false);
    expect(status.machineId).toMatch(/^MCH-/);
  });

  it("4. saveLocalLicense() stores and validates a matching key for Accounting Only", () => {
    const mid = getMachineId();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 365);
    const yyyy = futureDate.getFullYear();
    const mm = String(futureDate.getMonth() + 1).padStart(2, "0");
    const dd = String(futureDate.getDate()).padStart(2, "0");
    const expiryStr = `${yyyy}-${mm}-${dd}`;

    const key = generateLicenseKey({
      machineId: mid,
      packageType: "ACCOUNTING_ONLY",
      expiresAt: expiryStr,
    });
    const saveRes = saveLocalLicense(key, "Al-Madina Traders");

    expect(saveRes.valid).toBe(true);
    expect(saveRes.packageType).toBe("ACCOUNTING_ONLY");

    const status = getLocalLicenseStatus();
    expect(status.isActivated).toBe(true);
    expect(status.packageType).toBe("ACCOUNTING_ONLY");
    expect(status.clientName).toBe("Al-Madina Traders");
    expect(status.daysRemaining).toBeGreaterThanOrEqual(364);
  });

  it("5. saveLocalLicense() rejects key bound to another computer", () => {
    const foreignMid = "MCH-DEAD-BEEF-0001";
    const key = generateLicenseKey({
      machineId: foreignMid,
      packageType: "POS_COMBO",
      expiresAt: "2028-12-31",
    });

    expect(() => saveLocalLicense(key, "Thief Corp")).toThrow(
      /locked to a different computer/i
    );
  });

  it("6. clearLocalLicense() deletes local file cleanly", () => {
    const mid = getMachineId();
    const key = generateLicenseKey({
      machineId: mid,
      packageType: "DI_COMBO",
      expiresAt: "2029-01-01",
    });
    saveLocalLicense(key);

    expect(fs.existsSync(tempTestFile)).toBe(true);
    clearLocalLicense();
    expect(fs.existsSync(tempTestFile)).toBe(false);

    const status = getLocalLicenseStatus();
    expect(status.isActivated).toBe(false);
  });
});
