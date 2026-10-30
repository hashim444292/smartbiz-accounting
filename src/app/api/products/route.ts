import { NextRequest, NextResponse } from "next/server";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { listProducts, createProduct, resolveProductHsCode } from "@/services/productService";
import { prisma } from "@/lib/prisma";
import { fallbackStore } from "@/lib/fallbackStore";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const businessId = await getActiveBusinessId(req);
    const { searchParams } = new URL(req.url);

    // Meta lookup mode for Add/Edit Product form (returns categories + org defaults)
    if (searchParams.get("meta") === "true") {
      let org: any = null;
      let categories: any[] = [];

      try {
        const [dbOrg, dbCats] = await Promise.all([
          prisma.business.findUnique({ where: { id: businessId } }),
          prisma.category.findMany({ where: { businessId }, orderBy: { name: "asc" } }),
        ]);
        org = dbOrg;
        categories = dbCats;
      } catch {
        org = fallbackStore.companies.find((c) => c.id === businessId) || fallbackStore.business;
        categories = fallbackStore.categories.filter((c) => c.businessId === businessId);
      }

      const categoryId = searchParams.get("categoryId");
      const hsResolution = await resolveProductHsCode({
        organizationId: businessId,
        categoryId: categoryId || undefined,
        productHsCode: searchParams.get("productHsCode") || undefined,
      });

      return NextResponse.json({
        success: true,
        data: {
          organization: {
            id: org?.id || businessId,
            name: org?.name || "Organization",
            defaultHsCode: org?.defaultHsCode || "8517.13",
            defaultUom: org?.defaultUom || "pcs",
            defaultTaxProfile: org?.defaultTaxProfile || "Standard 18%",
            defaultSalesTax: Number(org?.defaultSalesTax ?? 18),
            defaultFurtherTax: Number(org?.defaultFurtherTax ?? 3),
            defaultExtraTax: Number(org?.defaultExtraTax ?? 0),
          },
          categories: categories.map((c) => ({
            id: c.id,
            name: c.name,
            defaultHsCode: c.defaultHsCode || null,
          })),
          hsResolution,
        },
      });
    }

    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "15", 10);
    const search = searchParams.get("search") || "";
    const categoryId = searchParams.get("categoryId") || "";
    const status = searchParams.get("status") || "ALL";

    // Auto-heal existing products where averageCost is 0 or null, but purchasePrice > 0
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "Product" SET "averageCost" = "purchasePrice" WHERE "businessId" = $1 AND ("averageCost" = 0 OR "averageCost" IS NULL) AND "purchasePrice" > 0`,
        businessId
      );
    } catch {
      fallbackStore.products
        .filter((p) => p.businessId === businessId && Number(p.averageCost || 0) <= 0 && Number(p.purchasePrice || 0) > 0)
        .forEach((p) => {
          p.averageCost = Number(p.purchasePrice);
        });
    }

    // Auto-heal existing products where taxProfile is 'Exempt 0%' or includes '0%' but salesTax is > 0
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "Product" SET "salesTax" = 0 WHERE "businessId" = $1 AND ("taxProfile" ILIKE '%Exempt%' OR "taxProfile" ILIKE '%0%') AND "salesTax" > 0`,
        businessId
      );
    } catch {
      fallbackStore.products
        .filter((p) => p.businessId === businessId && (p.taxProfile?.toLowerCase().includes("exempt") || p.taxProfile?.includes("0%")) && Number(p.salesTax || 0) > 0)
        .forEach((p) => {
          p.salesTax = 0;
        });
    }

    const result = await listProducts({
      businessId,
      page,
      limit,
      search,
      categoryId,
      status,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const businessId = await getActiveBusinessId(req);
    const body = await req.json();

    const { product, hsResolution } = await createProduct({
      ...body,
      businessId,
      userId: body.userId || "usr-1",
      userName: body.userName || "System User",
    });

    return NextResponse.json({
      success: true,
      data: product,
      hsResolution,
      message: `Product '${product.name}' created successfully with HS Code ${product.hsCode}`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
