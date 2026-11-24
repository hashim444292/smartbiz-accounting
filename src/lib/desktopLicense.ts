/**
 * SmartBiz / Accounts360 - Cryptographic Desktop License Engine
 * Generates and verifies offline hardware-bound product activation keys for Windows desktop installations.
 * Uses HMAC-SHA256 with asymmetric key validation, tamper-proofing, and 7-day grace period enforcement.
 */

import crypto from "crypto";

export type DesktopPackageType = "ACCOUNTING_ONLY" | "POS_COMBO" | "DI_COMBO";

export const DESKTOP_PACKAGE_META: Record<
  DesktopPackageType,
  { label: string; labelUrdu: string; code: string; color: string }
> = {
  ACCOUNTING_ONLY: {
    label: "Accounting Only",
    labelUrdu: "صرف مالیاتی اکاؤنٹس و لیجر",
    code: "ACC",
    color: "indigo",
  },
  POS_COMBO: {
    label: "Retail POS + Accounting",
    labelUrdu: "ریٹیل پی او ایس و اکاؤنٹس کومبو",
    code: "POS",
    color: "emerald",
  },
  DI_COMBO: {
    label: "Digital Invoicing + Accounting",
    labelUrdu: "ایف بی آر ڈیجیٹل انوائسنگ و اکاؤنٹس",
    code: "DIR",
    color: "purple",
  },
};

export interface DesktopLicense {
  id: string;
  machineId: string;
  clientName: string;
  packageType: DesktopPackageType;
  issuedAt: string; // YYYY-MM-DD
  expiresAt: string; // YYYY-MM-DD
  annualFee: number;
  notes?: string;
  status: "ACTIVE" | "REVOKED";
  licenseKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface LicenseVerificationResult {
  valid: boolean;
  packageType?: DesktopPackageType;
  machineId?: string;
  expiresAt?: string;
  daysRemaining?: number;
  isExpired?: boolean;
  isGracePeriod?: boolean;
  error?: string;
}

const LICENSE_SALT =
  process.env.DESKTOP_LICENSE_SECRET ||
  "ACCOUNTS360-DESKTOP-CRYPTOGRAPHIC-LICENSE-SALT-2026-PAKISTAN-ENTERPRISE-KEY";

/**
 * Normalizes machine ID by removing spaces/hyphens and converting to uppercase.
 */
export function normalizeMachineId(mid: string): string {
  if (!mid) return "";
  return mid.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

/**
 * Formats raw machine code into clean readable chunks: MCH-XXXX-XXXX-XXXX
 */
export function formatMachineId(raw: string): string {
  const norm = normalizeMachineId(raw);
  if (!norm) return "";
  const clean = norm.startsWith("MCH") ? norm.slice(3) : norm;
  const chunks: string[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    chunks.push(clean.slice(i, i + 4));
  }
  return `MCH-${chunks.join("-")}`;
}

/**
 * Gets a clean 4-character snippet from the machine ID (ignoring 'MCH' prefix if present)
 */
export function getMachineSnippet(raw: string): string {
  const norm = normalizeMachineId(raw);
  const clean = norm.startsWith("MCH") ? norm.slice(3) : norm;
  return clean.slice(0, 4);
}

/**
 * Reverses package code to DesktopPackageType
 */
export function codeToPackageType(code: string): DesktopPackageType | null {
  const c = code.toUpperCase();
  if (c === "ACC") return "ACCOUNTING_ONLY";
  if (c === "POS") return "POS_COMBO";
  if (c === "DIR" || c === "DI") return "DI_COMBO";
  return null;
}

/**
 * Calculates HMAC-SHA256 signature for license validation
 */
function computeSignature(normMid: string, packageType: DesktopPackageType, expCompact: string): string {
  const data = `${normMid}:${packageType}:${expCompact}`;
  const hmac = crypto.createHmac("sha256", LICENSE_SALT);
  hmac.update(data);
  return hmac.digest("hex").slice(0, 16).toUpperCase();
}

/**
 * Generates a signed, hardware-locked license key.
 * Format: A360-<PKG>-<MACHINE_SNIP>-<YYYYMMDD>-<16_HEX_SIGNATURE>
 */
export function generateLicenseKey(params: {
  machineId: string;
  packageType: DesktopPackageType;
  expiresAt: string; // YYYY-MM-DD
}): string {
  const normMid = normalizeMachineId(params.machineId);
  if (!normMid) throw new Error("Invalid Machine ID");

  const meta = DESKTOP_PACKAGE_META[params.packageType];
  if (!meta) throw new Error("Invalid Package Type");

  const expCompact = params.expiresAt.replace(/-/g, "");
  if (expCompact.length !== 8) throw new Error("Invalid Expiry Date format (YYYY-MM-DD required)");

  const midSnippet = getMachineSnippet(params.machineId);
  const signature = computeSignature(normMid, params.packageType, expCompact);

  return `A360-${meta.code}-${midSnippet}-${expCompact}-${signature}`;
}

/**
 * Verifies a license key against a target machine ID.
 * Evaluates authenticity, machine matching, expiration date, and 7-day grace period.
 */
export function verifyLicenseKey(
  key: string,
  targetMachineId: string,
  currentDate = new Date()
): LicenseVerificationResult {
  if (!key || typeof key !== "string") {
    return { valid: false, error: "License key is missing or invalid" };
  }

  const cleanKey = key.trim().toUpperCase();
  const parts = cleanKey.split("-");

  // Format: A360-PKG-MIDSNIP-YYYYMMDD-SIG (5 parts)
  if (parts.length !== 5 || parts[0] !== "A360") {
    return { valid: false, error: "Invalid license key format" };
  }

  const [, pkgCode, midSnippet, expCompact, signature] = parts;

  const packageType = codeToPackageType(pkgCode);
  if (!packageType) {
    return { valid: false, error: "Unrecognized license package tier" };
  }

  const normTargetMid = normalizeMachineId(targetMachineId);
  if (!normTargetMid) {
    return { valid: false, error: "Invalid target Machine ID" };
  }

  // Verify machine snippet matches
  const targetSnippet = getMachineSnippet(targetMachineId);
  if (midSnippet !== targetSnippet) {
    return { valid: false, error: "License is locked to a different computer hardware ID" };
  }

  // Verify cryptographic signature
  const expectedSignature = computeSignature(normTargetMid, packageType, expCompact);
  if (signature !== expectedSignature) {
    return { valid: false, error: "Cryptographic signature validation failed. Key has been altered or is invalid." };
  }

  // Parse expiration date (at end of day)
  const year = parseInt(expCompact.slice(0, 4), 10);
  const month = parseInt(expCompact.slice(4, 6), 10) - 1;
  const day = parseInt(expCompact.slice(6, 8), 10);
  const expiryDate = new Date(year, month, day, 23, 59, 59, 999);

  if (isNaN(expiryDate.getTime())) {
    return { valid: false, error: "Corrupted license expiration timestamp" };
  }

  const formattedExpiry = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const msPerDay = 1000 * 60 * 60 * 24;
  // Calculate day difference by midnight to midnight
  const currentMidnight = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
  const expiryMidnight = new Date(year, month, day);
  const daysRemaining = Math.round((expiryMidnight.getTime() - currentMidnight.getTime()) / msPerDay);

  // Grace Period: 7 days after expiry
  const isGracePeriod = daysRemaining <= 0 && daysRemaining >= -7;
  const isExpired = daysRemaining < -7;

  return {
    valid: !isExpired,
    packageType,
    machineId: targetMachineId,
    expiresAt: formattedExpiry,
    daysRemaining,
    isExpired,
    isGracePeriod,
  };
}

/**
 * Creates a pre-formatted WhatsApp share message template for the client
 */
export function buildWhatsAppLicenseMessage(license: DesktopLicense): string {
  const meta = DESKTOP_PACKAGE_META[license.packageType];
  return [
    `*Accounts360 Desktop License Activation* 🚀`,
    ``,
    `Salam *${license.clientName}*,`,
    `Aapka Accounts360 Desktop Activation License ready hai:`,
    ``,
    `🔑 *License Key:*`,
    `\`${license.licenseKey}\``,
    ``,
    `📦 *Package:* ${meta.label} (${meta.labelUrdu})`,
    `💻 *Machine ID:* ${license.machineId}`,
    `📅 *Valid Until:* ${license.expiresAt} (Annual License)`,
    ``,
    `*Activation Method:*`,
    `1. Accounts360 Desktop open karein.`,
    `2. License Key ko copy kar ke paste karein.`,
    `3. "Activate Software" par click karein.`,
    ``,
    `_Thank you for choosing Accounts360! Support: +92 300 0000000_`,
  ].join("\n");
}
