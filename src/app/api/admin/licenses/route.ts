import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fallbackStore } from "@/lib/fallbackStore";
import { createSafeAuditLog } from "@/lib/auditHelper";
import {
  DesktopLicense,
  DesktopPackageType,
  generateLicenseKey,
  verifyLicenseKey,
  formatMachineId,
  buildWhatsAppLicenseMessage,
} from "@/lib/desktopLicense";

export const dynamic = "force-dynamic";

const REGISTRY_KEY = "desktop_licenses_registry";

async function getLicensesRegistry(): Promise<DesktopLicense[]> {
  try {
    const setting = await prisma.appSetting.findFirst({
      where: { key: REGISTRY_KEY },
    });
    if (setting?.value) {
      const list = JSON.parse(setting.value);
      return Array.isArray(list) ? list : [];
    }
  } catch {}

  const mem = (fallbackStore as any).appSettings?.get(REGISTRY_KEY);
  if (mem) {
    try {
      const list = JSON.parse(mem);
      return Array.isArray(list) ? list : [];
    } catch {}
  }
  return [];
}

async function saveLicensesRegistry(list: DesktopLicense[]): Promise<void> {
  const json = JSON.stringify(list);
  try {
    const existing = await prisma.appSetting.findFirst({
      where: { key: REGISTRY_KEY },
    });
    if (existing) {
      await prisma.appSetting.update({
        where: { id: existing.id },
        data: { value: json },
      });
    } else {
      const biz = await prisma.business.findFirst({ select: { id: true } });
      if (biz) {
        await prisma.appSetting.create({
          data: {
            businessId: biz.id,
            key: REGISTRY_KEY,
            value: json,
          },
        });
      }
    }
  } catch {}

  if (!(fallbackStore as any).appSettings) {
    (fallbackStore as any).appSettings = new Map();
  }
  (fallbackStore as any).appSettings.set(REGISTRY_KEY, json);
}

async function logLicenseAudit(action: string, details: string, userId: string) {
  try {
    const biz = await prisma.business.findFirst({ select: { id: true } });
    if (biz) {
      await createSafeAuditLog(prisma, {
        businessId: biz.id,
        action,
        entity: "DESKTOP_LICENSE",
        details,
        userId,
      });
    }
  } catch {}
}

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * GET /api/admin/licenses
 * Lists all issued desktop licenses with computed lifecycle stats
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session || (session.role !== "SUPER_ADMIN" && session.role !== "ADMIN")) {
      return NextResponse.json(
        { success: false, error: "Access denied. Restricted to Platform Administrators." },
        { status: 403 }
      );
    }

    const licenses = await getLicensesRegistry();
    const today = new Date();

    // Compute live status and stats
    const enriched = licenses.map((lic) => {
      const v = verifyLicenseKey(lic.licenseKey, lic.machineId, today);
      return {
        ...lic,
        daysRemaining: v.daysRemaining ?? 0,
        isExpired: v.isExpired ?? false,
        isGracePeriod: v.isGracePeriod ?? false,
      };
    });

    const activeLicenses = enriched.filter((l) => l.status === "ACTIVE" && !l.isExpired);
    const expiringSoon = enriched.filter(
      (l) => l.status === "ACTIVE" && !l.isExpired && (l.daysRemaining ?? 0) <= 30 && (l.daysRemaining ?? 0) > 0
    );
    const expiredCount = enriched.filter((l) => l.status === "ACTIVE" && l.isExpired).length;
    const revokedCount = enriched.filter((l) => l.status === "REVOKED").length;
    const totalArr = activeLicenses.reduce((sum, l) => sum + (Number(l.annualFee) || 0), 0);

    return NextResponse.json({
      success: true,
      data: enriched,
      stats: {
        total: enriched.length,
        active: activeLicenses.length,
        expiringSoon: expiringSoon.length,
        expired: expiredCount,
        revoked: revokedCount,
        totalARR: totalArr,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to retrieve desktop licenses" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/licenses
 * Generates a new hardware-bound cryptographic desktop license
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "SUPER_ADMIN" && session.role !== "ADMIN")) {
      return NextResponse.json(
        { success: false, error: "Access denied. Restricted to Platform Administrators." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { clientName, machineId, packageType, durationDays = 365, annualFee = 25000, notes } = body;

    if (!clientName || typeof clientName !== "string" || !clientName.trim()) {
      return NextResponse.json({ success: false, error: "Client Name is required." }, { status: 400 });
    }

    if (!machineId || typeof machineId !== "string" || !machineId.trim()) {
      return NextResponse.json({ success: false, error: "Machine Hardware Code is required." }, { status: 400 });
    }

    const validPackages: DesktopPackageType[] = ["ACCOUNTING_ONLY", "POS_COMBO", "DI_COMBO"];
    if (!packageType || !validPackages.includes(packageType)) {
      return NextResponse.json({ success: false, error: "Valid Package Type is required." }, { status: 400 });
    }

    const now = new Date();
    const expiry = new Date(now.getTime() + (Number(durationDays) || 365) * 24 * 60 * 60 * 1000);

    const formattedMachine = formatMachineId(machineId);
    const issuedAt = formatDate(now);
    const expiresAt = formatDate(expiry);

    const licenseKey = generateLicenseKey({
      machineId: formattedMachine,
      packageType,
      expiresAt,
    });

    const newLicense: DesktopLicense = {
      id: `lic-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      machineId: formattedMachine,
      clientName: clientName.trim(),
      packageType,
      issuedAt,
      expiresAt,
      annualFee: Number(annualFee) || 0,
      notes: notes?.trim() || undefined,
      status: "ACTIVE",
      licenseKey,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    const registry = await getLicensesRegistry();
    registry.unshift(newLicense);
    await saveLicensesRegistry(registry);

    await logLicenseAudit(
      "CREATE",
      `Generated ${packageType} desktop license for "${newLicense.clientName}" (${newLicense.machineId}) expiring ${expiresAt}. Key: ${licenseKey}`,
      session.userId
    );

    const whatsappMessage = buildWhatsAppLicenseMessage(newLicense);

    return NextResponse.json({
      success: true,
      message: `Desktop license generated successfully for ${newLicense.clientName}.`,
      data: newLicense,
      whatsappMessage,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to generate desktop license" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/licenses
 * Actions: RENEW (+1 Year or custom days), REVOKE, DELETE
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "SUPER_ADMIN" && session.role !== "ADMIN")) {
      return NextResponse.json(
        { success: false, error: "Access denied. Restricted to Platform Administrators." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { id, action, durationDays = 365, annualFee, notes } = body;

    if (!id || !action) {
      return NextResponse.json({ success: false, error: "License ID and action are required." }, { status: 400 });
    }

    const registry = await getLicensesRegistry();
    const index = registry.findIndex((l) => l.id === id);

    if (index === -1) {
      return NextResponse.json({ success: false, error: "License not found." }, { status: 404 });
    }

    const target = registry[index];
    const now = new Date();

    if (action === "DELETE") {
      registry.splice(index, 1);
      await saveLicensesRegistry(registry);

      await logLicenseAudit(
        "DELETE",
        `Deleted desktop license record for "${target.clientName}" (${target.machineId})`,
        session.userId
      );

      return NextResponse.json({ success: true, message: "License record deleted successfully." });
    }

    if (action === "REVOKE") {
      target.status = "REVOKED";
      target.updatedAt = now.toISOString();
      if (notes) target.notes = notes;
      registry[index] = target;
      await saveLicensesRegistry(registry);

      await logLicenseAudit(
        "UPDATE",
        `Revoked desktop license for "${target.clientName}" (${target.machineId})`,
        session.userId
      );

      return NextResponse.json({ success: true, message: "License revoked successfully.", data: target });
    }

    if (action === "RENEW") {
      // Calculate renewal from max(today, currentExpiry)
      const currentExp = new Date(target.expiresAt);
      const baseDate = currentExp > now ? currentExp : now;
      const newExpiry = new Date(baseDate.getTime() + (Number(durationDays) || 365) * 24 * 60 * 60 * 1000);
      const newExpiresAt = formatDate(newExpiry);

      const newKey = generateLicenseKey({
        machineId: target.machineId,
        packageType: target.packageType,
        expiresAt: newExpiresAt,
      });

      target.expiresAt = newExpiresAt;
      target.licenseKey = newKey;
      target.status = "ACTIVE";
      target.updatedAt = now.toISOString();
      if (annualFee !== undefined) target.annualFee = Number(annualFee);
      if (notes) target.notes = notes;

      registry[index] = target;
      await saveLicensesRegistry(registry);

      await logLicenseAudit(
        "UPDATE",
        `Renewed desktop license for "${target.clientName}" (${target.machineId}) by ${durationDays} days until ${newExpiresAt}. New Key: ${newKey}`,
        session.userId
      );

      return NextResponse.json({
        success: true,
        message: `License renewed successfully until ${newExpiresAt}.`,
        data: target,
        whatsappMessage: buildWhatsAppLicenseMessage(target),
      });
    }

    return NextResponse.json({ success: false, error: "Invalid action specified." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update desktop license" },
      { status: 500 }
    );
  }
}
