import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fallbackStore, storeAddCompany } from "@/lib/fallbackStore";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    if (session && session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { success: false, error: "Access denied. Only Super Admin has access to company administration." },
        { status: 403 }
      );
    }
    try {
      const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("DB_TIMEOUT")), 150));
      const companies = await Promise.race([
        prisma.business.findMany({
          orderBy: { createdAt: "desc" },
          include: {
            _count: {
              select: {
                members: true,
                products: true,
                sales: true,
                customers: true,
              },
            },
          },
        }),
        timeoutPromise,
      ]);

      const formatted = companies.map((c) => ({
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
        enabledModules: (c as any).enabledModules || [
          "sales",
          "purchases",
          "inventory",
          "accounting",
          "compliance",
          "reports",
          "aiEntry",
          "bulkImport",
        ],
        billingCycleStart: (c as any).billingCycleStart || c.createdAt,
        billingCycleEnd: (c as any).billingCycleEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        lastPaymentDate: (c as any).lastPaymentDate || c.createdAt,
        lastPaymentAmount: Number((c as any).lastPaymentAmount ?? 5000),
        createdAt: c.createdAt,
        counts: {
          users: c._count.members,
          products: c._count.products,
          sales: c._count.sales,
          customers: c._count.customers,
        },
      }));

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
    if (session && session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { success: false, error: "Access denied. Only Super Admin can register new companies." },
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
      billingCycleEnd,
      enabledModules,
    } = body;

    if (!name || !ownerName) {
      return NextResponse.json(
        { success: false, error: "Company Name and Owner Name are required" },
        { status: 400 }
      );
    }

    const modules = Array.isArray(enabledModules) && enabledModules.length > 0
      ? enabledModules
      : [
          "sales",
          "purchases",
          "inventory",
          "accounting",
          "compliance",
          "reports",
          "aiEntry",
          "bulkImport",
        ];

    // Try DB
    try {
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
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          ...newBiz,
          monthlyFee: Number(monthlyFee),
          billingPlan,
          enabledModules: modules,
          billingCycleEnd: billingCycleEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        message: "Company created successfully",
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
        billingCycleEnd,
        enabledModules: modules,
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
