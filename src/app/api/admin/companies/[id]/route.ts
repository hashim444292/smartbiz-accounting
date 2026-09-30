import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fallbackStore, storeUpdateCompany, storeDeleteCompany } from "@/lib/fallbackStore";
import { getSession } from "@/lib/auth";
import { saveFbrConfig, getFbrConfig } from "@/services/fbrService";
import { createSafeAuditLog } from "@/lib/auditHelper";

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (session && session.role !== "SUPER_ADMIN" && session.role !== "ADMIN" && session.role !== "OWNER_ADMIN") {
      return NextResponse.json(
        { success: false, error: "Access denied. Insufficient permissions to update company settings." },
        { status: 403 }
      );
    }

    const { id } = params;
    const body = await req.json();

    try {
      const existing = await prisma.business.findUnique({
        where: { id },
        include: { settings: true },
      });

      const updated = await prisma.business.update({
        where: { id },
        data: {
          name: body.name,
          ownerName: body.ownerName,
          phone: body.phone,
          email: body.email,
          address: body.address,
          city: body.city,
          province: body.province,
          ntn: body.ntn,
          strn: body.strn,
          businessType: body.businessType,
          defaultHsCode: body.defaultHsCode,
          defaultUom: body.defaultUom,
          defaultTaxProfile: body.defaultTaxProfile,
          defaultSalesTax: body.defaultSalesTax !== undefined ? Number(body.defaultSalesTax) : undefined,
          defaultFurtherTax: body.defaultFurtherTax !== undefined ? Number(body.defaultFurtherTax) : undefined,
          defaultExtraTax: body.defaultExtraTax !== undefined ? Number(body.defaultExtraTax) : undefined,
          currency: body.currency,
          currencySymbol: body.currencySymbol,
          defaultPaymentTerms: body.defaultPaymentTerms ? Number(body.defaultPaymentTerms) : undefined,
          defaultTaxRate: body.defaultTaxRate !== undefined ? Number(body.defaultTaxRate) : undefined,
          negativeStockPolicy: body.negativeStockPolicy !== undefined ? Boolean(body.negativeStockPolicy) : undefined,
          canCreateBranches: body.canCreateBranches !== undefined ? Boolean(body.canCreateBranches) : undefined,
          monthlyFee: body.monthlyFee !== undefined ? Number(body.monthlyFee) : undefined,
          billingCycleStart: body.billingCycleStart ? new Date(body.billingCycleStart) : undefined,
          billingCycleEnd: body.billingCycleEnd ? new Date(body.billingCycleEnd) : undefined,
          paymentStatus: body.paymentStatus !== undefined ? body.paymentStatus : undefined,
          packageType: body.packageType !== undefined ? body.packageType : undefined,
          enabledModules: body.enabledModules !== undefined ? body.enabledModules : undefined,
        },
      });

      if (body.packageType !== undefined) {
        await prisma.appSetting.upsert({
          where: { businessId_key: { businessId: id, key: "software_package_type" } },
          update: { value: body.packageType },
          create: { businessId: id, key: "software_package_type", value: body.packageType },
        }).catch(() => null);
      }

      if (body.monthlyFee !== undefined) {
        await prisma.appSetting.upsert({
          where: { businessId_key: { businessId: id, key: "monthly_fee" } },
          update: { value: String(body.monthlyFee) },
          create: { businessId: id, key: "monthly_fee", value: String(body.monthlyFee) },
        }).catch(() => null);
      }

      if (body.paymentStatus !== undefined) {
        await prisma.appSetting.upsert({
          where: { businessId_key: { businessId: id, key: "billing_payment_status" } },
          update: { value: body.paymentStatus },
          create: { businessId: id, key: "billing_payment_status", value: body.paymentStatus },
        }).catch(() => null);
      }

      // Update FBR Digital Invoicing Configuration
      let fbrConfig = null;
      if (body.packageType === "ACCOUNTING_ONLY") {
        await saveFbrConfig(id, {
          token: "",
          autoSync: false,
        }).catch(() => null);
      } else if (
        body.fbrToken !== undefined ||
        body.fbrEnv !== undefined ||
        body.fbrIntegrationType !== undefined ||
        body.fbrPosId !== undefined ||
        body.fbrScenarioId !== undefined ||
        body.fbrAutoSync !== undefined
      ) {
        fbrConfig = await saveFbrConfig(id, {
          token: body.fbrToken,
          environment: body.fbrEnv,
          integrationType: body.fbrIntegrationType,
          posId: body.fbrPosId,
          scenarioId: body.fbrScenarioId,
          autoSync: body.fbrAutoSync !== undefined ? Boolean(body.fbrAutoSync) : undefined,
          sellerNtn: body.ntn,
          sellerBusinessName: body.name,
          sellerProvince: body.province,
          sellerAddress: body.address,
        });
      }

      if (body.enabledModules) {
        storeUpdateCompany(id, { enabledModules: body.enabledModules });
      }

      // Generate detailed audit diff for Admin / Super Admin activity tracking
      const previous: Record<string, any> = {};
      const updatedDiff: Record<string, any> = {};
      const changesList: string[] = [];

      if (existing) {
        const fieldsToCheck: Array<{ key: string; label: string; currentVal: any; newVal: any }> = [
          { key: "name", label: "Company Name", currentVal: existing.name, newVal: body.name },
          { key: "ownerName", label: "Owner Name", currentVal: existing.ownerName, newVal: body.ownerName },
          { key: "phone", label: "Phone", currentVal: existing.phone, newVal: body.phone },
          { key: "email", label: "Email", currentVal: existing.email, newVal: body.email },
          { key: "monthlyFee", label: "Monthly Fee", currentVal: existing.monthlyFee, newVal: body.monthlyFee !== undefined ? Number(body.monthlyFee) : undefined },
          { key: "paymentStatus", label: "Payment Status", currentVal: existing.paymentStatus, newVal: body.paymentStatus },
          { key: "packageType", label: "Software Package", currentVal: existing.packageType, newVal: body.packageType },
          { key: "billingCycleStart", label: "Billing Cycle Start", currentVal: existing.billingCycleStart ? new Date(existing.billingCycleStart).toISOString().split("T")[0] : null, newVal: body.billingCycleStart ? new Date(body.billingCycleStart).toISOString().split("T")[0] : undefined },
          { key: "billingCycleEnd", label: "Billing Cycle End", currentVal: existing.billingCycleEnd ? new Date(existing.billingCycleEnd).toISOString().split("T")[0] : null, newVal: body.billingCycleEnd ? new Date(body.billingCycleEnd).toISOString().split("T")[0] : undefined },
          { key: "ntn", label: "NTN", currentVal: existing.ntn, newVal: body.ntn },
          { key: "strn", label: "STRN", currentVal: existing.strn, newVal: body.strn },
          { key: "city", label: "City", currentVal: existing.city, newVal: body.city },
          { key: "province", label: "Province", currentVal: existing.province, newVal: body.province },
        ];

        for (const item of fieldsToCheck) {
          if (item.newVal !== undefined && item.newVal !== null && String(item.currentVal ?? "") !== String(item.newVal ?? "")) {
            previous[item.label] = item.currentVal ?? "—";
            updatedDiff[item.label] = item.newVal;
            changesList.push(`${item.label}: "${item.currentVal ?? "—"}" → "${item.newVal}"`);
          }
        }

        if (body.fbrToken !== undefined) {
          const prevFbr = (existing.settings || []).find((s: any) => s.key === "fbr_token")?.value || "";
          if (body.fbrToken !== prevFbr) {
            previous["FBR Token"] = prevFbr ? "***Configured***" : "Not Set";
            updatedDiff["FBR Token"] = body.fbrToken ? "***Updated***" : "Cleared";
            changesList.push("Updated FBR Auth Token");
          }
        }
      }

      if (session) {
        try {
          await createSafeAuditLog(prisma, {
            businessId: id,
            userId: session.userId,
            userName: session.name || (session.role === "ADMIN" ? "Team Admin" : "Super Admin"),
            userEmail: session.email || "",
            action: "UPDATE_COMPANY",
            entity: "Business",
            entityId: id,
            details: changesList.length > 0 
              ? `Modified company details: ${changesList.join("; ")}`
              : `Updated company profile settings for ${body.name || updated.name}`,
            changes: Object.keys(previous).length > 0 ? JSON.stringify({ previous, updated: updatedDiff }) : null,
          });
        } catch (auditErr) {
          console.warn("Failed to create audit log for company update:", auditErr);
        }
      }

      return NextResponse.json({
        success: true,
        data: { ...updated, fbrConfig, enabledModules: body.enabledModules },
        message: "Company and FBR settings updated successfully",
      });
    } catch {
      const updated = storeUpdateCompany(id, body);
      if (!updated) {
        return NextResponse.json({ success: false, error: "Company not found" }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        data: updated,
        message: "Company updated successfully in fallback store (existing products remain decoupled)",
        fallback: true,
      });
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update company" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (session && session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { success: false, error: "Access denied. Only Super Admin can delete companies." },
        { status: 403 }
      );
    }

    const { id } = params;

    // Database delete
    try {
      const count = await prisma.business.count();
      if (count <= 1) {
        return NextResponse.json(
          { success: false, error: "Cannot delete the only remaining company" },
          { status: 400 }
        );
      }

      await prisma.business.delete({ where: { id } });
      return NextResponse.json({ success: true, message: "Company deleted successfully" });
    } catch {
      // Fallback
      if (fallbackStore.companies.length <= 1) {
        return NextResponse.json(
          { success: false, error: "Cannot delete the only remaining company" },
          { status: 400 }
        );
      }

      const deleted = storeDeleteCompany(id);
      if (!deleted) {
        return NextResponse.json({ success: false, error: "Company not found" }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        message: "Company deleted successfully in fallback store",
        fallback: true,
      });
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete company" },
      { status: 500 }
    );
  }
}
