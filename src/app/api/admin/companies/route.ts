import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fallbackStore, storeAddCompany } from "@/lib/fallbackStore";
import { getSession } from "@/lib/auth";
import { saveFbrConfig } from "@/services/fbrService";
import { createSafeAuditLog } from "@/lib/auditHelper";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    if (session && session.role !== "SUPER_ADMIN" && session.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Access denied. Only Super Admin and Platform Admins have access to company administration." },
        { status: 403 }
      );
    }
    if (!process.env.DATABASE_URL) {
      throw new Error("No database configured");
    }

    try {
      const companies = await prisma.business.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          settings: true,
          _count: {
            select: {
              members: true,
              products: true,
              sales: true,
              customers: true,
            },
          },
        },
      });

      const formatted = companies.map((c) => {
        const fbrMap: Record<string, string> = {};
        ((c as any).settings || []).forEach((s: any) => {
          fbrMap[s.key] = s.value;
        });
        const fbrToken = fbrMap["fbr_token"] || "";
        const fbrEnv = fbrMap["fbr_env"] || "sandbox";
        const fbrIntegrationType = fbrMap["fbr_integration_type"] || "DIGITAL_INVOICING";
        const fbrPosId = fbrMap["fbr_pos_id"] || "822646";
        const fbrScenarioId = fbrMap["fbr_scenario_id"] || "SN000";
        const fbrAutoSync = fbrMap["fbr_auto_sync"] === "true";

        return {
          id: c.id,
          name: c.name,
          ownerName: c.ownerName,
          phone: c.phone || "—",
          email: c.email || "—",
          address: c.address || "—",
          city: c.city || "Karachi",
          province: c.province || "Sindh",
          ntn: c.ntn || "—",
          strn: c.strn || "—",
          businessType: c.businessType || "Enterprise",
          defaultHsCode: c.defaultHsCode || "8517.13",
          defaultUom: c.defaultUom || "pcs",
          defaultTaxProfile: c.defaultTaxProfile || "Standard 18%",
          defaultSalesTax: Number(c.defaultSalesTax ?? 18),
          defaultFurtherTax: Number(c.defaultFurtherTax ?? 3),
          defaultExtraTax: Number(c.defaultExtraTax ?? 0),
          currency: c.currency,
          currencySymbol: c.currencySymbol,
          defaultPaymentTerms: c.defaultPaymentTerms,
          defaultTaxRate: Number(c.defaultTaxRate),
          monthlyFee: Number((c as any).monthlyFee ?? 5000),
          billingPlan: (c as any).billingPlan || "Standard Monthly",
          subscriptionStatus: (c as any).subscriptionStatus || "ACTIVE",
          paymentStatus: c.paymentStatus || "UNPAID",
          packageType: (c as any).packageType || "FULL_SUITE",
          fbrToken,
          fbrEnv,
          fbrIntegrationType,
          fbrPosId,
          fbrScenarioId,
          fbrAutoSync,
          fbrStatus: fbrToken ? "CONFIGURED" : "PENDING_SETUP",
          enabledModules: (c as any).enabledModules && (c as any).enabledModules.length > 0
            ? (c as any).enabledModules
            : (c as any).packageType === "ACCOUNTING_ONLY"
              ? ["sales", "purchases", "inventory", "accounting", "reports", "aiEntry", "bulkImport"]
              : (c as any).packageType === "FBR_INVOICING_ONLY"
                ? ["sales", "pos", "compliance", "bulkImport", "reports"]
                : [
                    "sales",
                    "pos",
                    "purchases",
                    "inventory",
                    "accounting",
                    "compliance",
                    "reports",
                    "aiEntry",
                    "bulkImport",
                  ],
          billingCycleStart: c.billingCycleStart ? c.billingCycleStart.toISOString() : c.createdAt.toISOString(),
          billingCycleEnd: c.billingCycleEnd ? c.billingCycleEnd.toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          lastPaymentDate: (c as any).lastPaymentDate || c.createdAt,
          lastPaymentAmount: Number((c as any).lastPaymentAmount ?? 5000),
          createdAt: c.createdAt,
          counts: {
            users: c._count.members,
            products: c._count.products,
            sales: c._count.sales,
            customers: c._count.customers,
          },
        };
      });

      return NextResponse.json({ success: true, data: formatted });
    } catch {
      // Fallback
      const formatted = fallbackStore.companies.map((c) => {
        const usersCount = fallbackStore.users.filter((u) =>
          u.companyIds.includes(c.id)
        ).length;
        const productsCount = fallbackStore.products.filter((p) => p.businessId === c.id).length;
        const salesCount = fallbackStore.sales.filter((s) => s.businessId === c.id).length;
        const customersCount = fallbackStore.customers.filter((cust) => cust.businessId === c.id).length;

        return {
          id: c.id,
          name: c.name,
          ownerName: c.ownerName,
          phone: c.phone || "—",
          email: c.email || "—",
          address: c.address || "—",
          city: c.city || "Karachi",
          province: c.province || "Sindh",
          ntn: c.ntn || "—",
          strn: c.strn || "—",
          businessType: c.businessType || "Enterprise",
          defaultHsCode: c.defaultHsCode || "8517.13",
          defaultUom: c.defaultUom || "pcs",
          defaultTaxProfile: c.defaultTaxProfile || "Standard 18%",
          defaultSalesTax: Number(c.defaultSalesTax ?? 18),
          defaultFurtherTax: Number(c.defaultFurtherTax ?? 3),
          defaultExtraTax: Number(c.defaultExtraTax ?? 0),
          currency: c.currency || "PKR",
          currencySymbol: c.currencySymbol || "Rs",
          defaultPaymentTerms: c.defaultPaymentTerms || 30,
          defaultTaxRate: c.defaultTaxRate || 18,
          monthlyFee: Number(c.monthlyFee ?? 5000),
          billingPlan: c.billingPlan || "Standard Monthly",
          subscriptionStatus: c.subscriptionStatus || "ACTIVE",
          enabledModules: c.enabledModules || [
            "sales",
            "purchases",
            "inventory",
            "accounting",
            "compliance",
            "reports",
            "aiEntry",
            "bulkImport",
          ],
          billingCycleStart: c.billingCycleStart || c.createdAt,
          billingCycleEnd: c.billingCycleEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          lastPaymentDate: c.lastPaymentDate || c.createdAt,
          lastPaymentAmount: Number(c.lastPaymentAmount ?? (c.monthlyFee ?? 5000)),
          createdAt: c.createdAt,
          counts: {
            users: usersCount,
            products: productsCount,
            sales: salesCount,
            customers: customersCount,
          },
        };
      });

      return NextResponse.json({ success: true, data: formatted, fallback: true });
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch companies" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (session && session.role !== "SUPER_ADMIN" && session.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Access denied. Only Super Admin and Platform Admins can register new companies." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      name,
      ownerName,
      phone,
      email,
      address,
      city = "Karachi",
      province = "Sindh",
      ntn,
      strn,
      businessType = "Enterprise",
      defaultHsCode = "8517.13",
      defaultUom = "pcs",
      defaultTaxProfile = "Standard 18%",
      defaultSalesTax = 18.00,
      defaultFurtherTax = 3.00,
      defaultExtraTax = 0.00,
      currency = "PKR",
      currencySymbol = "Rs",
      defaultPaymentTerms = 30,
      defaultTaxRate = 18.00,
      negativeStockPolicy = false,
      monthlyFee = 5000,
      billingPlan = "Standard Monthly",
      billingCycleStart,
      billingCycleEnd,
      paymentStatus = "UNPAID",
      packageType = "FULL_SUITE",
      enabledModules,
    } = body;

    if (!name || !ownerName) {
      return NextResponse.json(
        { success: false, error: "Company Name and Owner Name are required" },
        { status: 400 }
      );
    }

    const computedModules = Array.isArray(enabledModules) && enabledModules.length > 0
      ? (packageType === "ACCOUNTING_ONLY" 
          ? enabledModules.filter((m: string) => m !== "pos" && m !== "compliance")
          : packageType === "FBR_INVOICING_ONLY"
            ? ["sales", "pos", "compliance", "bulkImport", "reports"]
            : enabledModules)
      : (packageType === "ACCOUNTING_ONLY"
          ? ["sales", "purchases", "inventory", "accounting", "reports", "aiEntry", "bulkImport"]
          : packageType === "FBR_INVOICING_ONLY"
            ? ["sales", "pos", "compliance", "bulkImport", "reports"]
            : [
                "sales",
                "pos",
                "purchases",
                "inventory",
                "accounting",
                "compliance",
                "reports",
                "aiEntry",
                "bulkImport",
              ]);

    // Try DB
    try {
      const parsedStart = billingCycleStart ? new Date(billingCycleStart) : new Date();
      const parsedEnd = billingCycleEnd
        ? new Date(billingCycleEnd)
        : new Date(parsedStart.getTime() + 30 * 24 * 60 * 60 * 1000);

      const newBiz = await prisma.business.create({
        data: {
          name,
          ownerName,
          phone,
          email,
          address,
          city,
          province,
          ntn,
          strn,
          businessType,
          defaultHsCode: defaultHsCode || "8517.13",
          defaultUom: defaultUom || "pcs",
          defaultTaxProfile: defaultTaxProfile || "Standard 18%",
          defaultSalesTax: Number(defaultSalesTax),
          defaultFurtherTax: Number(defaultFurtherTax),
          defaultExtraTax: Number(defaultExtraTax),
          currency,
          currencySymbol,
          defaultPaymentTerms: Number(defaultPaymentTerms) || 30,
          defaultTaxRate: Number(defaultTaxRate) || 18,
          negativeStockPolicy: Boolean(negativeStockPolicy),
          monthlyFee: Number(monthlyFee) || 5000,
          billingCycleStart: parsedStart,
          billingCycleEnd: parsedEnd,
          paymentStatus: paymentStatus || "UNPAID",
          packageType: packageType || "FULL_SUITE",
          enabledModules: computedModules,
        },
      });

      // Save monthly fee to AppSetting as well
      await prisma.appSetting.upsert({
        where: { businessId_key: { businessId: newBiz.id, key: "monthly_fee" } },
        update: { value: String(monthlyFee || 5000) },
        create: { businessId: newBiz.id, key: "monthly_fee", value: String(monthlyFee || 5000) },
      }).catch(() => null);

      await prisma.appSetting.upsert({
        where: { businessId_key: { businessId: newBiz.id, key: "billing_payment_status" } },
        update: { value: paymentStatus || "UNPAID" },
        create: { businessId: newBiz.id, key: "billing_payment_status", value: paymentStatus || "UNPAID" },
      }).catch(() => null);

      await prisma.appSetting.upsert({
        where: { businessId_key: { businessId: newBiz.id, key: "software_package_type" } },
        update: { value: packageType || "FULL_SUITE" },
        create: { businessId: newBiz.id, key: "software_package_type", value: packageType || "FULL_SUITE" },
      }).catch(() => null);

      // Initialize zero-balance Cash in Hand and Bank accounts for the new company
      await prisma.cashBankAccount.upsert({
        where: { id: `${newBiz.id}-cash` },
        update: { balance: 0 },
        create: {
          id: `${newBiz.id}-cash`,
          businessId: newBiz.id,
          name: "Cash in Hand",
          type: "CASH",
          balance: 0,
          isDefault: true,
          isActive: true,
        },
      }).catch(() => null);

      await prisma.cashBankAccount.upsert({
        where: { id: `${newBiz.id}-bank` },
        update: { balance: 0 },
        create: {
          id: `${newBiz.id}-bank`,
          businessId: newBiz.id,
          name: "Company Bank Account",
          type: "BANK",
          balance: 0,
          isDefault: false,
          isActive: true,
        },
      }).catch(() => null);

      // Save FBR Digital Invoicing Configuration (Only for Full Suite)
      if (packageType !== "ACCOUNTING_ONLY" && (body.fbrToken || body.fbrEnv || body.fbrIntegrationType || body.fbrPosId || body.fbrScenarioId || body.fbrAutoSync !== undefined)) {
        await saveFbrConfig(newBiz.id, {
          token: body.fbrToken || "",
          environment: body.fbrEnv || "sandbox",
          integrationType: body.fbrIntegrationType || "DIGITAL_INVOICING",
          posId: body.fbrPosId || "822646",
          scenarioId: body.fbrScenarioId || "SN000",
          autoSync: Boolean(body.fbrAutoSync),
          sellerNtn: ntn,
          sellerBusinessName: name,
          sellerProvince: province,
          });
      }

      if (session) {
        try {
          await createSafeAuditLog(prisma, {
            businessId: newBiz.id,
            userId: session.userId,
            userName: session.name || (session.role === "ADMIN" ? "Team Admin" : "Super Admin"),
            userEmail: session.email || "",
            action: "CREATE_COMPANY",
            entity: "Business",
            entityId: newBiz.id,
            details: `Registered new company: "${name}" (Monthly Fee: Rs. ${monthlyFee}, Package: ${packageType || "FULL_SUITE"})`,
            changes: JSON.stringify({
              updated: {
                name,
                ownerName,
                monthlyFee: Number(monthlyFee),
                packageType: packageType || "FULL_SUITE",
                paymentStatus: paymentStatus || "UNPAID",
                phone: phone || "—",
                email: email || "—",
                city,
                province,
              },
            }),
          });
        } catch (auditErr) {
          console.warn("Failed to create audit log for company registration:", auditErr);
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          ...newBiz,
          fbrToken: body.fbrToken || "",
          fbrEnv: body.fbrEnv || "sandbox",
          fbrIntegrationType: body.fbrIntegrationType || "DIGITAL_INVOICING",
          fbrPosId: body.fbrPosId || "822646",
          fbrScenarioId: body.fbrScenarioId || "SN000",
          fbrAutoSync: Boolean(body.fbrAutoSync),
          fbrStatus: body.fbrToken ? "CONFIGURED" : "PENDING_SETUP",
          monthlyFee: Number(monthlyFee),
          billingPlan,
          packageType: packageType || "FULL_SUITE",
          enabledModules: computedModules,
          billingCycleEnd: billingCycleEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        message: "Company created successfully with FBR Digital Invoicing profile",
      });
    } catch {
      // Fallback
      const newCompany = storeAddCompany({
        name,
        ownerName,
        phone,
        email,
        address,
        city,
        province,
        ntn,
        strn,
        businessType,
        defaultHsCode: defaultHsCode || "8517.13",
        defaultUom: defaultUom || "pcs",
        defaultTaxProfile,
        defaultSalesTax,
        defaultFurtherTax,
        defaultExtraTax,
        currency,
        currencySymbol,
        defaultPaymentTerms,
        defaultTaxRate,
        negativeStockPolicy,
        monthlyFee: Number(monthlyFee),
        billingPlan,
        billingCycleStart: billingCycleStart || new Date().toISOString(),
        billingCycleEnd: billingCycleEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        paymentStatus: paymentStatus || "UNPAID",
        packageType: packageType || "FULL_SUITE",
        enabledModules: computedModules,
      });

      return NextResponse.json({
        success: true,
        data: newCompany,
        message: "Company created successfully in fallback store",
        fallback: true,
      });
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create company" },
      { status: 500 }
    );
  }
}
