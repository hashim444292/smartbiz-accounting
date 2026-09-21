import { prisma } from "@/lib/prisma";
import { fallbackStore } from "@/lib/fallbackStore";
import { round2 } from "@/lib/decimal";

export interface FbrTaxCalculation {
  subtotal: number;
  salesTaxRate: number;
  salesTax: number;
  furtherTaxRate: number;
  furtherTax: number;
  extraTaxRate: number;
  extraTax: number;
  totalTax: number;
  totalAmount: number;
}

export function calculateFbrTaxes(params: {
  subtotal: number;
  isRegisteredBuyer?: boolean;
  salesTaxRate?: number;
  furtherTaxRate?: number;
  extraTaxRate?: number;
}): FbrTaxCalculation {
  const {
    subtotal,
    isRegisteredBuyer = false,
    salesTaxRate = 18.0,
    furtherTaxRate = 3.0,
    extraTaxRate = 0.0,
  } = params;

  const salesTax = round2(subtotal * (salesTaxRate / 100)).toNumber();
  // 3% Further Tax applies if the buyer has no verified NTN / is unregistered
  const furtherTax = isRegisteredBuyer ? 0 : round2(subtotal * (furtherTaxRate / 100)).toNumber();
  const extraTax = round2(subtotal * (extraTaxRate / 100)).toNumber();
  const totalTax = round2(salesTax + furtherTax + extraTax).toNumber();
  const totalAmount = round2(subtotal + totalTax).toNumber();

  return {
    subtotal: round2(subtotal).toNumber(),
    salesTaxRate,
    salesTax,
    furtherTaxRate: isRegisteredBuyer ? 0 : furtherTaxRate,
    furtherTax,
    extraTaxRate,
    extraTax,
    totalTax,
    totalAmount,
  };
}

export function generateFbrInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `FBR-POS-${year}-${rand}`;
}

export function generateFbrQrCode(invoiceNumber: string, totalAmount: number): string {
  return `https://e.fbr.gov.pk/verify?inv=${encodeURIComponent(invoiceNumber)}&pos=POS-101&amt=${totalAmount}`;
}

export async function getFbrComplianceOverview(businessId: string) {
  let sales: any[] = [];
  try {
    sales = await prisma.sale.findMany({
      where: { businessId },
      orderBy: { date: "desc" },
    });
  } catch {
    sales = fallbackStore.sales.filter((s) => s.businessId === businessId);
  }

  let totalNetSales = 0;
  let totalSalesTax = 0;
  let totalFurtherTax = 0;
  let totalExtraTax = 0;
  let totalTaxCollected = 0;

  let successFbr = 0;
  let pendingFbr = 0;
  let failedFbr = 0;

  for (const s of sales) {
    const sub = Number(s.subtotal || (Number(s.totalAmount || 0) - Number(s.taxAmount || 0)));
    totalNetSales += sub;

    const sTax = Number(s.salesTax || Number(s.taxAmount || 0));
    const fTax = Number(s.furtherTax || 0);
    const eTax = Number(s.extraTax || 0);

    totalSalesTax += sTax;
    totalFurtherTax += fTax;
    totalExtraTax += eTax;
    totalTaxCollected += sTax + fTax + eTax;

    const status = s.fbrStatus || "PENDING";
    if (status === "SUCCESS") successFbr++;
    else if (status === "FAILED") failedFbr++;
    else pendingFbr++;
  }

  const totalInvoices = sales.length;
  const complianceScore = totalInvoices > 0 ? Math.round((successFbr / totalInvoices) * 100) : 100;

  const complianceIssues = sales
    .filter((s) => s.fbrStatus === "FAILED" || s.fbrStatus === "PENDING")
    .map((s) => ({
      invoiceId: s.id,
      invoiceNumber: s.invoiceNumber,
      customerName: s.customerName,
      amount: Number(s.totalAmount || 0),
      fbrStatus: s.fbrStatus || "PENDING",
      reason: s.fbrStatus === "FAILED" ? "FBR Endpoint Connection Timeout (Retry Required)" : "Pending transmission queue batching",
      date: s.date,
    }));

  return {
    totalNetSales: round2(totalNetSales).toNumber(),
    totalSalesTax: round2(totalSalesTax).toNumber(),
    totalFurtherTax: round2(totalFurtherTax).toNumber(),
    totalExtraTax: round2(totalExtraTax).toNumber(),
    totalTaxCollected: round2(totalTaxCollected).toNumber(),
    totalInvoices,
    successFbr,
    pendingFbr,
    failedFbr,
    complianceScore,
    complianceIssues,
    recentInvoices: sales.slice(0, 200),
  };
}

export async function createFbrPosInvoice(params: {
  businessId: string;
  customerName: string;
  customerId?: string;
  items: Array<{
    productId: string;
    productName: string;
    sku?: string;
    hsCode?: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  subtotal: number;
  isRegisteredBuyer?: boolean;
  paymentMethod?: string;
  paidAmount?: number;
}) {
  const taxes = calculateFbrTaxes({
    subtotal: params.subtotal,
    isRegisteredBuyer: params.isRegisteredBuyer,
  });

  const fbrInvoiceNum = generateFbrInvoiceNumber();
  const fbrQr = generateFbrQrCode(fbrInvoiceNum, taxes.totalAmount);
  const now = new Date();

  const saleRecord = {
    id: `sale-${Date.now()}`,
    businessId: params.businessId,
    invoiceNumber: `INV-${now.getFullYear()}-${Date.now().toString().slice(-5)}`,
    date: now.toISOString(),
    customerName: params.customerName || "Walk-in Customer",
    customerId: params.customerId || null,
    subtotal: taxes.subtotal,
    salesTax: taxes.salesTax,
    furtherTax: taxes.furtherTax,
    extraTax: taxes.extraTax,
    taxAmount: taxes.totalTax,
    totalAmount: taxes.totalAmount,
    paidAmount: params.paidAmount ?? taxes.totalAmount,
    remainingAmount: Math.max(0, taxes.totalAmount - (params.paidAmount ?? taxes.totalAmount)),
    paymentStatus: (params.paidAmount ?? taxes.totalAmount) >= taxes.totalAmount ? "PAID" : "PARTIAL",
    paymentMethod: params.paymentMethod || "CASH",
    status: "POSTED",
    fbrStatus: "SUCCESS",
    fbrInvoiceNumber: fbrInvoiceNum,
    fbrQrCode: fbrQr,
    items: params.items.map((item, i) => ({
      id: `si-${Date.now()}-${i}`,
      productId: item.productId,
      productName: item.productName,
      sku: item.sku || "",
      hsCode: item.hsCode || "8517.13",
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      costPrice: round2(item.unitPrice * 0.85).toNumber(),
    })),
  };

  try {
    await prisma.sale.create({
      data: {
        ...saleRecord,
        items: {
          create: saleRecord.items.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            sku: item.sku,
            hsCode: item.hsCode,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
            costPrice: item.costPrice,
          })),
        },
      } as any,
    });
  } catch {
    fallbackStore.sales.unshift(saleRecord);

    // Deduct inventory stock
    for (const it of params.items) {
      const p = fallbackStore.products.find((prod) => prod.id === it.productId);
      if (p) {
        p.currentStock = Math.max(0, Number(p.currentStock || 0) - it.quantity);
      }
    }
  }

  return saleRecord;
}
