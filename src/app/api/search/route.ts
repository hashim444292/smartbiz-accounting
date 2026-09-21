import { NextRequest, NextResponse } from "next/server";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { prisma } from "@/lib/prisma";
import { fallbackStore } from "@/lib/fallbackStore";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const businessId = await getActiveBusinessId(req);
    const { searchParams } = new URL(req.url);
    const query = (searchParams.get("q") || "").trim().toLowerCase();

    if (!query) {
      return NextResponse.json({
        success: true,
        data: {
          invoices: [],
          customers: [],
          products: [],
        },
      });
    }

    let invoices: any[] = [];
    let customers: any[] = [];
    let products: any[] = [];

    try {
      const [dbInvoices, dbCustomers, dbProducts] = await Promise.all([
        prisma.sale.findMany({
          where: {
            businessId,
            OR: [
              { invoiceNumber: { contains: query, mode: "insensitive" } },
              { customerName: { contains: query, mode: "insensitive" } },
              { fbrInvoiceNumber: { contains: query, mode: "insensitive" } },
            ],
          },
          take: 5,
          orderBy: { date: "desc" },
        }),
        prisma.customer.findMany({
          where: {
            businessId,
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { businessName: { contains: query, mode: "insensitive" } },
              { phone: { contains: query, mode: "insensitive" } },
            ],
          },
          take: 5,
        }),
        prisma.product.findMany({
          where: {
            businessId,
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { sku: { contains: query, mode: "insensitive" } },
              { hsCode: { contains: query, mode: "insensitive" } },
              { barcode: { contains: query, mode: "insensitive" } },
            ],
          },
          take: 8,
          include: { category: true },
        }),
      ]);

      invoices = dbInvoices;
      customers = dbCustomers;
      products = dbProducts;
    } catch {
      invoices = fallbackStore.sales
        .filter((s) => {
          if (s.businessId && s.businessId !== businessId) return false;
          return (
            s.invoiceNumber?.toLowerCase().includes(query) ||
            s.customerName?.toLowerCase().includes(query) ||
            s.fbrInvoiceNumber?.toLowerCase().includes(query)
          );
        })
        .slice(0, 5);

      customers = fallbackStore.customers
        .filter((c) => {
          return (
            c.name?.toLowerCase().includes(query) ||
            c.businessName?.toLowerCase().includes(query) ||
            c.phone?.toLowerCase().includes(query) ||
            c.code?.toLowerCase().includes(query)
          );
        })
        .slice(0, 5);

      products = fallbackStore.products
        .filter((p) => {
          if (p.businessId && p.businessId !== businessId) return false;
          return (
            p.name?.toLowerCase().includes(query) ||
            p.sku?.toLowerCase().includes(query) ||
            p.hsCode?.toLowerCase().includes(query) ||
            p.barcode?.toLowerCase().includes(query)
          );
        })
        .slice(0, 8)
        .map((p) => ({
          ...p,
          category: fallbackStore.categories.find((c) => c.id === p.categoryId) || null,
        }));
    }

    return NextResponse.json({
      success: true,
      data: {
        invoices: invoices.map((inv) => ({
          id: inv.id,
          title: inv.invoiceNumber,
          subtitle: `${inv.customerName} • Rs ${Number(inv.totalAmount).toLocaleString()}`,
          badge: inv.fbrStatus || "PENDING",
          url: `/sales`,
          fbrRef: inv.fbrInvoiceNumber || null,
        })),
        customers: customers.map((c) => ({
          id: c.id,
          title: c.name,
          subtitle: `${c.phone || "No Phone"} • Balance: Rs ${Number(c.currentBalance).toLocaleString()}`,
          badge: c.code || "Customer",
          url: `/customers`,
        })),
        products: products.map((p) => ({
          id: p.id,
          title: p.name,
          subtitle: `SKU: ${p.sku || "N/A"} • HS Code: ${p.hsCode || "None"} • Rs ${Number(p.sellingPrice).toLocaleString()}`,
          badge: p.hsCode ? `HS ${p.hsCode}` : "No HS Code",
          url: `/products/${p.id}`,
        })),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
