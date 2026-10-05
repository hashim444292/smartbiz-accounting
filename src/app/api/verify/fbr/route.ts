import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fallbackStore } from "@/lib/fallbackStore";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawInv = searchParams.get("inv") || searchParams.get("id") || "";
    const cleanInv = decodeURIComponent(rawInv).trim();

    if (!cleanInv) {
      return NextResponse.json(
        { error: "Invoice number or ID parameter is required" },
        { status: 400 }
      );
    }

    let sale: any = null;

    try {
      sale = await prisma.sale.findFirst({
        where: {
          OR: [
            { fbrInvoiceNumber: cleanInv },
            { invoiceNumber: cleanInv },
            { id: cleanInv },
          ],
        },
        include: {
          business: true,
          customer: true,
          items: true,
        },
      });
    } catch (dbErr) {
      console.warn("Prisma lookup failed in public verify, checking fallbackStore:", dbErr);
    }

    // Fallback store lookup if Prisma had no result or failed
    if (!sale) {
      const fbSale = fallbackStore.sales.find(
        (s) =>
          s.fbrInvoiceNumber === cleanInv ||
          s.invoiceNumber === cleanInv ||
          s.id === cleanInv
      );
      if (fbSale) {
        const business = fallbackStore.companies.find((c) => c.id === fbSale.businessId) || {
          name: "Shakeel Mobiles",
          ntn: "4428410-1",
          strn: "3277876123456",
          address: "R-70 Rehman Villas, Karachi",
          phone: "0300-1234567",
        };
        sale = {
          ...fbSale,
          business,
          customer: { name: fbSale.customerName },
          items: fbSale.items || [],
        };
      }
    }

    const officialChannels = {
      irisPortal: "https://iris.fbr.gov.pk/#verifications",
      eFbrPortal: "https://e.fbr.gov.pk/",
      smsShortCode: "9966",
      smsFormat: `INV <space> CNIC <space> ${cleanInv}`,
      taxAsaanApp: "FBR Tax Asaan Mobile App (FBR POS -> Verify Invoice)",
    };

    if (!sale) {
      return NextResponse.json({
        found: false,
        message: "Invoice reference not found in current local database.",
        searchedReference: cleanInv,
        officialChannels,
      });
    }

    return NextResponse.json({
      found: true,
      data: {
        id: sale.id,
        invoiceNumber: sale.invoiceNumber,
        fbrInvoiceNumber: sale.fbrInvoiceNumber || cleanInv,
        fbrStatus: sale.fbrStatus || "SUCCESS",
        date: sale.date,
        createdAt: sale.createdAt,
        subtotal: Number(sale.subtotal || 0),
        taxAmount: Number(sale.taxAmount || sale.salesTax || 0),
        salesTax: Number(sale.salesTax || 0),
        furtherTax: Number(sale.furtherTax || 0),
        extraTax: Number(sale.extraTax || 0),
        posFee: Number(sale.posFee || 1.0),
        totalAmount: Number(sale.totalAmount || 0),
        paidAmount: Number(sale.paidAmount || sale.totalAmount || 0),
        paymentMethod: sale.paymentMethod || "CASH",
        paymentStatus: sale.paymentStatus || "PAID",
        customerName: sale.customerName || sale.customer?.name || "Walk-in Customer",
        customerNtn: sale.customer?.ntn || null,
        seller: {
          name: sale.business?.name || "Shakeel Mobiles",
          ntn: sale.business?.ntn || "4428410-1",
          strn: sale.business?.strn || "3277876123456",
          address: sale.business?.address || "R-70 Rehman Villas, Karachi",
          posId: sale.branchId || "200871",
        },
        items: (sale.items || []).map((it: any) => ({
          productName: it.productName,
          quantity: Number(it.quantity || 1),
          unitPrice: Number(it.unitPrice || 0),
          taxAmount: Number(it.taxAmount || 0),
          lineTotal: Number(it.lineTotal || 0),
          hsCode: it.hsCode || "8517.13.00",
        })),
      },
      officialChannels,
    });
  } catch (error: any) {
    console.error("Public FBR verification error:", error);
    return NextResponse.json(
      { error: "Failed to verify invoice", details: error.message },
      { status: 500 }
    );
  }
}
