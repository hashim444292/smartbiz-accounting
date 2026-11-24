/**
 * SmartBiz / Accounts360 - Offline Local License Storage & Verification Manager
 * Manages the client-side encrypted/signed license file stored in %APPDATA%/Accounts360/license.json
 * Enforces offline hardware lock and expiration grace period.
 */

import fs from "fs";
import path from "path";
import os from "os";
import { getMachineId } from "./hardwareId";
import { verifyLicenseKey, DesktopPackageType, LicenseVerificationResult } from "./desktopLicense";

export interface StoredDesktopLicense {
  licenseKey: string;
  machineId: string;
  packageType: DesktopPackageType;
  expiresAt: string;
  clientName?: string;
  activatedAt: string;
}

export interface LocalLicenseStatus {
  isDesktop: boolean;
  isActivated: boolean;
  machineId: string;
  packageType?: DesktopPackageType;
  expiresAt?: string;
  daysRemaining?: number;
  isGracePeriod?: boolean;
  isExpired?: boolean;
  clientName?: string;
  licenseKey?: string;
  error?: string;
}

/**
 * Returns the absolute path where the offline desktop license is stored.
 */
export function getDesktopLicenseFilePath(): string {
  // Allow environment override
  if (process.env.DESKTOP_LICENSE_FILE) {
    return path.resolve(process.env.DESKTOP_LICENSE_FILE);
  }

  // Windows: %APPDATA%/Accounts360/license.json
  if (process.platform === "win32" && process.env.APPDATA) {
    return path.join(process.env.APPDATA, "Accounts360", "license.json");
  }

  // Linux / macOS / Local Dev fallback
  const homeDir = os.homedir();
  return path.join(homeDir, ".accounts360", "license.json");
}

/**
 * Checks whether the current process is running in Desktop / Offline mode.
 */
export function isDesktopEnvironment(): boolean {
  if (process.env.ACCOUNTS360_DESKTOP === "true") return true;
  if (process.env.DESKTOP_MODE === "true") return true;
  if (process.env.ELECTRON_RUN_AS_NODE) return true;
  // If a local license file exists, treat desktop mode as active
  try {
    return fs.existsSync(getDesktopLicenseFilePath());
  } catch {
    return false;
  }
}

/**
 * Reads and cryptographically verifies the offline license stored on this PC.
 */
export function getLocalLicenseStatus(): LocalLicenseStatus {
  const currentMachineId = getMachineId();
  const filePath = getDesktopLicenseFilePath();
  const isDesktop = isDesktopEnvironment();

  if (!fs.existsSync(filePath)) {
    return {
      isDesktop,
      isActivated: false,
      machineId: currentMachineId,
      error: "No license key activated on this computer.",
    };
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const stored: StoredDesktopLicense = JSON.parse(raw);

    if (!stored.licenseKey) {
      return {
        isDesktop,
        isActivated: false,
        machineId: currentMachineId,
        error: "Corrupted license file.",
      };
    }

    // Verify key against physical machine hardware
    const check = verifyLicenseKey(stored.licenseKey, currentMachineId);

    if (!check.valid) {
      return {
        isDesktop,
        isActivated: false,
        machineId: currentMachineId,
        packageType: check.packageType,
        expiresAt: check.expiresAt,
        daysRemaining: check.daysRemaining,
        isGracePeriod: check.isGracePeriod,
        isExpired: check.isExpired,
        licenseKey: stored.licenseKey,
        clientName: stored.clientName,
        error: check.error || "Invalid license key signature.",
      };
    }

    return {
      isDesktop,
      isActivated: true,
      machineId: currentMachineId,
      packageType: check.packageType,
      expiresAt: check.expiresAt,
      daysRemaining: check.daysRemaining,
      isGracePeriod: check.isGracePeriod,
      isExpired: false,
      licenseKey: stored.licenseKey,
      clientName: stored.clientName,
    };
  } catch (err: any) {
    return {
      isDesktop,
      isActivated: false,
      machineId: currentMachineId,
      error: `Failed to read license: ${err.message}`,
    };
  }
}

/**
 * Activates and writes a new license key to the local machine storage.
 */
export function saveLocalLicense(
  licenseKey: string,
  clientName?: string
): LicenseVerificationResult {
  const currentMachineId = getMachineId();
  const check = verifyLicenseKey(licenseKey, currentMachineId);

  if (!check.valid) {
    throw new Error(check.error || "Invalid license key");
  }

  const filePath = getDesktopLicenseFilePath();
  const dirPath = path.dirname(filePath);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  const record: StoredDesktopLicense = {
    licenseKey: licenseKey.trim().toUpperCase(),
    machineId: currentMachineId,
    packageType: check.packageType!,
    expiresAt: check.expiresAt!,
    clientName: clientName?.trim() || "Local Business",
    activatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(filePath, JSON.stringify(record, null, 2), "utf8");
  return check;
}

/**
 * Removes local license (e.g. for re-activation or machine reset).
 */
export function clearLocalLicense(): void {
  const filePath = getDesktopLicenseFilePath();
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
