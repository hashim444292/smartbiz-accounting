import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fallbackStore } from "@/lib/fallbackStore";
import { readDesktopDatabaseState } from "@/lib/desktopDatabase";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId");
    const productId = params.id;

    const isGeneral = !productId || productId === "recent" || productId === "general" || productId === "none";

    // 1. Try querying via Prisma if DB is available
    try {
      // General recent purchases (last 5 bills)
      const rawRecentPurchases = await prisma.purchase.findMany({
        orderBy: { id: "desc" },
        take: 5,
        include: {
          supplier: { select: { name: true } },
          items: { select: { productName: true, quantity: true, unitCost: true } },
        },
      });

      const recentBills = rawRecentPurchases.map((p: any) => ({
        id: p.id,
        billNumber: p.purchaseNumber || `PO-${p.id.slice(-4)}`,
        date: p.date ? new Date(p.date).toISOString().slice(0, 10) : "",
        supplierName: p.supplierName || p.supplier?.name || "Supplier",
        totalAmount: Number(p.totalAmount || 0),
        itemsSummary: p.items?.map((it: any) => `${it.productName} (${it.quantity})`).join(", ") || "",
      }));

      // General recent sales (last 5 invoices)
      const rawRecentSales = await prisma.sale.findMany({
        orderBy: { id: "desc" },
        take: 5,
        include: {
          customer: { select: { name: true } },
          items: { select: { productName: true, quantity: true, unitPrice: true } },
        },
      });

      const recentInvoices = rawRecentSales.map((s: any) => ({
        id: s.id,
        invoiceNumber: s.invoiceNumber || `INV-${s.id.slice(-4)}`,
        date: s.date ? new Date(s.date).toISOString().slice(0, 10) : "",
        customerName: s.customerName || s.customer?.name || "Walk-in",
        totalAmount: Number(s.totalAmount || 0),
        itemsSummary: s.items?.map((it: any) => `${it.productName} (${it.quantity})`).join(", ") || "",
      }));

      // If general mode requested, return right away
      if (isGeneral) {
        return NextResponse.json({
          success: true,
          isGeneral: true,
          recentBills,
          recentInvoices,
        });
      }

      // Query product details
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          name: true,
          sku: true,
          uom: true,
          sellingPrice: true,
          purchasePrice: true,
          averageCost: true,
          currentStock: true,
        },
      });

      if (product) {
        // Query last purchases of this specific product
        const purchaseItems = await prisma.purchaseItem.findMany({
          where: { productId },
          orderBy: { id: "desc" },
          take: 5,
          include: {
            purchase: {
              select: {
                id: true,
                purchaseNumber: true,
                date: true,
                supplierName: true,
              },
            },
          },
        });

        const purchaseHistory = purchaseItems.map((pi: any) => ({
          id: pi.id,
          billNumber: pi.purchase?.purchaseNumber || "BILL",
          date: pi.purchase?.date ? new Date(pi.purchase.date).toISOString().slice(0, 10) : "",
          supplierName: pi.purchase?.supplierName || "Supplier",
          unitPrice: Number(pi.unitCost ?? (pi as any).unitPrice ?? 0),
          quantity: Number(pi.quantity || 0),
        }));

        // Query last sales of this product to THIS specific customer
        let customerSales: any[] = [];
        if (customerId) {
          const rawCustomerSales = await prisma.saleItem.findMany({
            where: {
              productId,
              sale: { customerId },
            },
            orderBy: { id: "desc" },
            take: 5,
            include: {
              sale: {
                select: {
                  id: true,
                  invoiceNumber: true,
                  date: true,
                  customer: { select: { name: true } },
                },
              },
            },
          });

          customerSales = rawCustomerSales.map((si: any) => ({
            id: si.id,
            invoiceNumber: si.sale?.invoiceNumber || "INV",
            date: si.sale?.date ? new Date(si.sale.date).toISOString().slice(0, 10) : "",
            customerName: si.sale?.customer?.name || "",
            unitPrice: Number(si.unitPrice || 0),
            quantity: Number(si.quantity || 0),
          }));
        }

        // Query recent sales of this product to any customer
        const rawGeneralSales = await prisma.saleItem.findMany({
          where: { productId },
          orderBy: { id: "desc" },
          take: 5,
          include: {
            sale: {
              select: {
                id: true,
                invoiceNumber: true,
                date: true,
                customer: { select: { name: true } },
              },
            },
          },
        });

        const generalSales = rawGeneralSales.map((si: any) => ({
          id: si.id,
          invoiceNumber: si.sale?.invoiceNumber || "INV",
          date: si.sale?.date ? new Date(si.sale.date).toISOString().slice(0, 10) : "",
          customerName: si.sale?.customer?.name || "Customer",
          unitPrice: Number(si.unitPrice || 0),
          quantity: Number(si.quantity || 0),
        }));

        const costPrice =
          Number(product.averageCost || 0) > 0
            ? Number(product.averageCost)
            : Number(product.purchasePrice || 0) > 0
            ? Number(product.purchasePrice)
            : purchaseHistory[0]?.unitPrice || 0;

        return NextResponse.json({
          success: true,
          isGeneral: false,
          product: {
            id: product.id,
            name: product.name,
            sku: product.sku,
            uom: product.uom,
            sellingPrice: Number(product.sellingPrice || 0),
            costPrice,
            currentStock: Number(product.currentStock || 0),
          },
          lastCustomerSales: customerSales,
          recentGeneralSales: generalSales,
          recentPurchases: purchaseHistory,
          recentBills,
          recentInvoices,
        });
      }
    } catch {}

    // 2. Query offline Desktop Database or fallbackStore
    const desktopDb = readDesktopDatabaseState();
    const sourceProducts = desktopDb?.products || fallbackStore.products || [];
    const sourceSales = desktopDb?.sales || fallbackStore.sales || [];
    const sourcePurchases = desktopDb?.purchases || fallbackStore.purchases || [];

    // General recent bills
    const recentBills = sourcePurchases.slice(-5).reverse().map((p: any) => ({
      id: p.id,
      billNumber: p.billNumber || p.purchaseNumber || p.invoiceNo || "BILL",
      date: p.purchaseDate ? String(p.purchaseDate).slice(0, 10) : p.date ? String(p.date).slice(0, 10) : "",
      supplierName: p.supplierName || "Supplier",
      totalAmount: Number(p.totalAmount || 0),
      itemsSummary: p.items?.map((it: any) => `${it.productName || "Item"} (${it.quantity || 1})`).join(", ") || "",
    }));

    // General recent invoices
    const recentInvoices = sourceSales.slice(-5).reverse().map((s: any) => ({
      id: s.id,
      invoiceNumber: s.invoiceNumber || s.invoiceNo || "INV",
      date: s.date ? String(s.date).slice(0, 10) : "",
      customerName: s.customerName || "Walk-in",
      totalAmount: Number(s.totalAmount || 0),
      itemsSummary: s.items?.map((it: any) => `${it.productName || "Item"} (${it.quantity || 1})`).join(", ") || "",
    }));

    if (isGeneral) {
      return NextResponse.json({
        success: true,
        isGeneral: true,
        recentBills,
        recentInvoices,
      });
    }

    const product = sourceProducts.find((p: any) => p.id === productId);
    if (!product) {
      return NextResponse.json({
        success: true,
        isGeneral: true,
        recentBills,
        recentInvoices,
      });
    }

    // Filter sales containing this item
    const matchingCustomerSales: any[] = [];
    const matchingGeneralSales: any[] = [];

    sourceSales.forEach((s: any) => {
      const items = s.items || [];
      const match = items.find((it: any) => it.productId === productId);
      if (match) {
        const entry = {
          id: s.id,
          invoiceNumber: s.invoiceNumber || s.invoiceNo || "INV",
          date: s.date ? String(s.date).slice(0, 10) : "",
          customerName: s.customerName || "Customer",
          unitPrice: Number(match.unitPrice || 0),
          quantity: Number(match.quantity || 0),
        };
        if (customerId && s.customerId === customerId) {
          matchingCustomerSales.push(entry);
        }
        matchingGeneralSales.push(entry);
      }
    });

    // Filter purchases containing this item
    const matchingPurchases: any[] = [];
    sourcePurchases.forEach((p: any) => {
      const items = p.items || [];
      const match = items.find((it: any) => it.productId === productId);
      if (match) {
        matchingPurchases.push({
          id: p.id,
          billNumber: p.billNumber || p.purchaseNumber || p.invoiceNo || "BILL",
          date: p.purchaseDate ? String(p.purchaseDate).slice(0, 10) : p.date ? String(p.date).slice(0, 10) : "",
          supplierName: p.supplierName || "Supplier",
          unitPrice: Number(match.unitPrice || 0),
          quantity: Number(match.quantity || 0),
        });
      }
    });

    const costPrice =
      Number(product.averageCost || 0) > 0
        ? Number(product.averageCost)
        : Number(product.purchasePrice || 0) > 0
        ? Number(product.purchasePrice)
        : matchingPurchases[0]?.unitPrice || 0;

    return NextResponse.json({
      success: true,
      isGeneral: false,
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        uom: product.uom,
        sellingPrice: Number(product.sellingPrice || 0),
        costPrice,
        currentStock: Number(product.currentStock || 0),
      },
      lastCustomerSales: matchingCustomerSales.slice(0, 5),
      recentGeneralSales: matchingGeneralSales.slice(0, 5),
      recentPurchases: matchingPurchases.slice(0, 5),
      recentBills,
      recentInvoices,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to load price history" },
      { status: 500 }
    );
  }
}
