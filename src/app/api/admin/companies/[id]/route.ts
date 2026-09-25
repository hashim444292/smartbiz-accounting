import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fallbackStore, storeUpdateCompany, storeDeleteCompany } from "@/lib/fallbackStore";
import { getSession } from "@/lib/auth";
import { saveFbrConfig, getFbrConfig } from "@/services/fbrService";

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (session && session.role !== "SUPER_ADMIN" && session.role !== "OWNER_ADMIN") {
      return NextResponse.json(
        { success: false, error: "Access denied. Insufficient permissions to update company settings." },
        { status: 403 }
      );
    }

    const { id } = params;
    const body = await req.json();

    try {
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
        },
      });

      // Update FBR Digital Invoicing Configuration
      let fbrConfig = null;
      if (
        body.fbrToken !== undefined ||
        body.fbrEnv !== undefined ||
        body.fbrPosId !== undefined ||
        body.fbrScenarioId !== undefined ||
        body.fbrAutoSync !== undefined
      ) {
        fbrConfig = await saveFbrConfig(id, {
          token: body.fbrToken,
          environment: body.fbrEnv,
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
