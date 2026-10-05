import { NextRequest, NextResponse } from "next/server";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { createAndPostSale } from "@/services/salesService";
import { fallbackStore } from "@/lib/fallbackStore";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface BulkRowItem {
  date?: string;
  invoiceNumber?: string;
  scenario?: string;
  customerName?: string;
  customerNtn?: string;
  customerCnic?: string;
  hsCode?: string;
  productName?: string;
  productRemarks?: string;
  uom?: string;
  quantity?: number;
  unitPrice?: number;
  rate?: number;
  taxRate?: number;
  taxAmount?: number;
  taxValue?: number;
  extraTax?: number;
  extraTaxValue?: number;
  exclusiveValue?: number;
  subtotal?: number;
  discountRate?: number;
  discountValue?: number;
  discount2Rate?: number;
  discount2Value?: number;
  advanceIncomeTaxRate?: number;
  totalIncomeTax?: number;
  totalAmount?: number;
  sroSchedule?: string;
  sroItem?: string;
  aboveRemarks?: string;
  notes?: string;
  paymentMethod?: string;
  paidAmount?: number;
  paymentStatus?: "PAID" | "PARTIAL" | "UNPAID";
  items?: any[];
}

export async function POST(req: NextRequest) {
  try {
    const businessId = await getActiveBusinessId(req);
    const body = await req.json();
    const rawInvoices: BulkRowItem[] = body.invoices || body.rows || [];

    if (!Array.isArray(rawInvoices) || rawInvoices.length === 0) {
      return NextResponse.json(
        { success: false, error: "Please provide a valid list of invoices or rows to import." },
        { status: 400 }
      );
    }

    // 1. Fetch Business Package Type & Settings
    let business: any = null;
    try {
      business = await prisma.business.findUnique({
        where: { id: businessId },
        select: { id: true, name: true, packageType: true, negativeStockPolicy: true, defaultHsCode: true },
      });
    } catch {
      business = fallbackStore.companies.find((c) => c.id === businessId) || { packageType: "FULL_SUITE" };
    }

    const isFbrInvoicingOnly = business?.packageType === "FBR_INVOICING_ONLY";

    // 2. Group rows into invoices (by invoiceNumber if provided, or process individually)
    interface GroupedInvoice {
      invoiceNumber?: string;
      date: Date;
      scenario: string;
      customerName: string;
      customerNtn?: string;
      customerCnic?: string;
      sroSchedule?: string;
      sroItem?: string;
      aboveRemarks?: string;
      paymentMethod: string;
      paidAmount?: number;
      paymentStatus?: "PAID" | "PARTIAL" | "UNPAID";
      notes?: string;
      items: any[];
      advanceIncomeTaxTotal: number;
      extraTaxTotal: number;
      grandTotalExpected?: number;
    }

    const groupedMap = new Map<string, GroupedInvoice>();

    rawInvoices.forEach((row, idx) => {
      // If row already has grouped items, treat it as a pre-grouped invoice
      if (row.items && Array.isArray(row.items) && row.items.length > 0) {
        const invKey = row.invoiceNumber || `row-idx-${idx}`;
        const date = row.date ? new Date(row.date) : new Date();
        groupedMap.set(invKey, {
          invoiceNumber: row.invoiceNumber,
          date,
          scenario: row.scenario || "SN001",
          customerName: (row.customerName || "Walk-in Customer").trim(),
          customerNtn: (row.customerNtn || "").trim() || undefined,
          customerCnic: (row.customerCnic || "").trim() || undefined,
          sroSchedule: (row.sroSchedule || "").trim() || undefined,
          sroItem: (row.sroItem || "").trim() || undefined,
          aboveRemarks: (row.aboveRemarks || row.notes || "").trim() || undefined,
          paymentMethod: (row.paymentMethod || "CASH").toUpperCase(),
          paidAmount: row.paidAmount,
          paymentStatus: row.paymentStatus,
          notes: row.notes || row.aboveRemarks,
          items: row.items,
          advanceIncomeTaxTotal: Number(row.totalIncomeTax || 0),
          extraTaxTotal: Number(row.extraTaxValue || 0),
          grandTotalExpected: row.totalAmount ? Number(row.totalAmount) : undefined,
        });
        return;
      }

      // Flat 27-column row grouping:
      const invKey = row.invoiceNumber && row.invoiceNumber.trim() !== ""
        ? row.invoiceNumber.trim()
        : `row-${idx}`;

      const date = row.date ? new Date(row.date) : new Date();
      const customerName = (row.customerName || "Walk-in Customer").trim();
      const customerNtn = (row.customerNtn || "").trim() || undefined;
      const customerCnic = (row.customerCnic || "").trim() || undefined;
      const scenario = (row.scenario || (customerNtn ? "SN001" : "SN002")).trim();

      const prodName = (row.productName || "General Merchandise").trim();
      const qty = Math.max(1, Number(row.quantity || 1));
      const rate = Number(row.rate !== undefined ? row.rate : (row.unitPrice || 0));
      const taxRate = Number(row.taxRate !== undefined ? row.taxRate : 18.0);
      const discountVal = Number(row.discountValue || 0);
      const discount2Val = Number(row.discount2Value || 0);
      const extraTax = Number(row.extraTaxValue || row.extraTax || 0);
      const advanceTax = Number(row.totalIncomeTax || 0);

      const lineExclusive = row.exclusiveValue !== undefined ? Number(row.exclusiveValue) : (qty * rate);
      const lineTax = row.taxValue !== undefined ? Number(row.taxValue) : (lineExclusive * (taxRate / 100));

      const lineItem = {
        productName: prodName,
        hsCode: (row.hsCode || business?.defaultHsCode || "8517.1390").trim(),
        uom: (row.uom || "Numbers, pieces, units").trim(),
        productRemarks: (row.productRemarks || "").trim() || undefined,
        quantity: qty,
        unitPrice: rate,
        taxRate,
        taxAmount: lineTax,
        discount: discountVal,
        discount2: discount2Val,
        extraTax,
        sroSchedule: (row.sroSchedule || "").trim() || undefined,
        sroItem: (row.sroItem || "").trim() || undefined,
      };

      if (!groupedMap.has(invKey)) {
        groupedMap.set(invKey, {
          invoiceNumber: row.invoiceNumber && row.invoiceNumber.trim() !== "" ? row.invoiceNumber.trim() : undefined,
          date,
          scenario,
          customerName,
          customerNtn,
          customerCnic,
          sroSchedule: (row.sroSchedule || "").trim() || undefined,
          sroItem: (row.sroItem || "").trim() || undefined,
          aboveRemarks: (row.aboveRemarks || row.notes || "").trim() || undefined,
          paymentMethod: (row.paymentMethod || "CASH").toUpperCase(),
          paidAmount: row.paidAmount,
          paymentStatus: row.paymentStatus,
          notes: row.aboveRemarks || row.notes,
          items: [lineItem],
          advanceIncomeTaxTotal: advanceTax,
          extraTaxTotal: extraTax,
          grandTotalExpected: row.totalAmount ? Number(row.totalAmount) : undefined,
        });
      } else {
        const existing = groupedMap.get(invKey)!;
        existing.items.push(lineItem);
        existing.advanceIncomeTaxTotal += advanceTax;
        existing.extraTaxTotal += extraTax;
        if (row.totalAmount) {
          existing.grandTotalExpected = (existing.grandTotalExpected || 0) + Number(row.totalAmount);
        }
      }
    });

    const createdInvoices: any[] = [];
    const errors: any[] = [];
    let processedIndex = 0;

    // 3. Process each grouped invoice
    for (const [invKey, inv] of groupedMap.entries()) {
      processedIndex++;
      try {
        // Enforce Catalog Verification for Accounting & Full Suite Packages:
        if (!isFbrInvoicingOnly) {
          for (const item of inv.items) {
            const pName = item.productName?.trim();
            let catalogProd = null;
            try {
              catalogProd = await prisma.product.findFirst({
                where: {
                  businessId,
                  OR: [
                    { name: { equals: pName, mode: "insensitive" } },
                    { sku: { equals: pName, mode: "insensitive" } },
                  ],
                },
              });
            } catch {
              catalogProd = fallbackStore.products.find(
                (p) => p.name.toLowerCase() === pName.toLowerCase() || p.sku?.toLowerCase() === pName.toLowerCase()
              );
            }

            if (!catalogProd) {
              throw new Error(
                `Product "${pName}" is not available in catalog. In Accounting & Full Suite editions, products must exist in inventory before sales invoices can be created.`
              );
            }
          }
        }

        // Calculate totals across items
        let subtotal = 0;
        let taxAmount = 0;
        let totalDiscount = 0;
        let totalExtraTax = 0;

        for (const it of inv.items) {
          const q = Number(it.quantity || 1);
          const p = Number(it.unitPrice || 0);
          const d = Number(it.discount || 0);
          const d2 = Number(it.discount2 || 0);
          const tr = Number(it.taxRate !== undefined ? it.taxRate : 18.0);
          const lineBase = Math.max(0, q * p - d - d2);
          const lineTax = it.taxAmount !== undefined ? Number(it.taxAmount) : (lineBase * (tr / 100));

          subtotal += q * p;
          totalDiscount += d + d2;
          taxAmount += lineTax;
          totalExtraTax += Number(it.extraTax || 0);
        }

        const calculatedGrandTotal = Math.max(
          0,
          subtotal - totalDiscount + taxAmount + totalExtraTax + inv.advanceIncomeTaxTotal
        );
        const finalGrandTotal = inv.grandTotalExpected !== undefined && inv.grandTotalExpected > 0
          ? inv.grandTotalExpected
          : calculatedGrandTotal;

        let paid = Number(inv.paidAmount !== undefined ? inv.paidAmount : (inv.paymentStatus === "UNPAID" ? 0 : finalGrandTotal));
        if (paid > finalGrandTotal) paid = finalGrandTotal;

        const fbrMeta = {
          scenario: inv.scenario,
          customerNtn: inv.customerNtn,
          customerCnic: inv.customerCnic,
          advanceIncomeTax: inv.advanceIncomeTaxTotal,
          extraTax: totalExtraTax,
          sroSchedule: inv.sroSchedule,
          sroItem: inv.sroItem,
          aboveRemarks: inv.aboveRemarks,
        };

        let createdSale: any = null;
        try {
          createdSale = await createAndPostSale({
            businessId,
            invoiceNumber: inv.invoiceNumber,
            date: inv.date,
            customerName: inv.customerName,
            customerNtn: inv.customerNtn,
            customerCnic: inv.customerCnic,
            scenario: inv.scenario,
            items: inv.items.map((it: any) => ({
              productName: it.productName,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              taxRate: it.taxRate,
              taxAmount: it.taxAmount,
              discount: it.discount,
              discount2: it.discount2,
              hsCode: it.hsCode,
              uom: it.uom,
              productRemarks: it.productRemarks,
              extraTax: it.extraTax,
              sroSchedule: it.sroSchedule,
              sroItem: it.sroItem,
            })),
            overallDiscount: totalDiscount,
            salesTax: taxAmount,
            extraTax: totalExtraTax,
            advanceIncomeTax: inv.advanceIncomeTaxTotal,
            posFee: 0,
            paidAmount: paid,
            paymentMethod: inv.paymentMethod || (paid > 0 ? "CASH" : "CREDIT"),
            notes: inv.aboveRemarks || inv.notes || "Bulk imported invoice",
            fbrMeta,
            fbrStatus: "PENDING",
          });
        } catch (dbErr: any) {
          // If error is a validation error (e.g., product catalog or period closed), re-throw so it's reported
          if (
            dbErr.message.includes("is not available in catalog") ||
            dbErr.message.includes("Insufficient stock") ||
            dbErr.message.includes("Period is closed")
          ) {
            throw dbErr;
          }

          // Fallback Store
          const saleId = `sale-${Date.now()}-${processedIndex}`;
          const invNum = inv.invoiceNumber || `INV-2026-${String(fallbackStore.sales.length + 1).padStart(5, "0")}`;

          const processedItems = inv.items.map((it: any, itemIdx: number) => {
            const prod = fallbackStore.products.find(
              (p) => p.name.toLowerCase() === (it.productName || "").toLowerCase()
            );
            const q = Number(it.quantity || 1);
            const p = Number(it.unitPrice || prod?.sellingPrice || 0);
            if (prod && !isFbrInvoicingOnly) {
              prod.currentStock -= q;
            }

            return {
              id: `si-${saleId}-${itemIdx}`,
              productId: prod?.id || `prod-gen-${itemIdx}`,
              productName: it.productName || prod?.name || "General Merchandise",
              quantity: q,
              unitPrice: p,
              lineTotal: q * p,
              costPrice: prod?.averageCost || 0,
              hsCode: it.hsCode,
            };
          });

          const remaining = Math.max(0, finalGrandTotal - paid);
          const paymentStatus = remaining === 0 ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID";

          createdSale = {
            id: saleId,
            invoiceNumber: invNum,
            date: inv.date.toISOString(),
            customerName: inv.customerName,
            subtotal,
            discountAmount: totalDiscount,
            taxAmount,
            salesTax: taxAmount,
            furtherTax: 0,
            extraTax: totalExtraTax,
            posFee: 0,
            totalAmount: finalGrandTotal,
            paidAmount: paid,
            remainingAmount: remaining,
            paymentStatus,
            paymentMethod: inv.paymentMethod || (paid > 0 ? "CASH" : "CREDIT"),
            status: "POSTED",
            fbrStatus: "PENDING",
            fbrInvoiceNumber: null,
            fbrQrCode: null,
            notes: JSON.stringify({ fbrMeta, remarks: inv.aboveRemarks || "" }),
            items: processedItems,
          };

          fallbackStore.sales.unshift(createdSale);
        }

        createdInvoices.push(createdSale);
      } catch (err: any) {
        errors.push({
          row: processedIndex,
          invoiceNumber: inv.invoiceNumber || invKey,
          customer: inv.customerName,
          error: err.message,
        });
      }
    }

    const isSuccess = createdInvoices.length > 0;
    return NextResponse.json({
      success: isSuccess,
      importedCount: createdInvoices.length,
      errorCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      message: errors.length === 0
        ? `Successfully imported ${createdInvoices.length} sales invoices.`
        : createdInvoices.length > 0
        ? `Imported ${createdInvoices.length} invoice(s). ${errors.length} failed.`
        : `Failed to import: ${errors[0]?.error || "Validation error"}`,
    }, { status: isSuccess ? 200 : 422 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
