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
  saleType?: string;
  customerName?: string;
  customerNtn?: string;
  customerCnic?: string;
  buyerName?: string;
  buyerLegalName?: string;
  buyerRegistrationType?: string;
  buyerNtn?: string;
  buyerCnic?: string;
  buyerProvince?: string;
  buyerAddress?: string;
  province?: string;
  address?: string;
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
  furtherTaxRate?: number;
  furtherTaxAmount?: number;
  furtherTax?: number;
  extraTax?: number;
  extraTaxValue?: number;
  exclusiveValue?: number;
  subtotal?: number;
  discount?: number;
  discountRate?: number;
  discountValue?: number;
  discount2Rate?: number;
  discount2Value?: number;
  fedPayable?: number;
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

    const isFbrInvoicingOnly =
      business?.packageType === "FBR_INVOICING_ONLY" || body.mode === "DIGITAL_INVOICING";

    // 2. Group rows into invoices (by invoiceNumber if provided, or process individually)
    interface GroupedInvoice {
      invoiceNumber?: string;
      date: Date;
      scenario: string;
      saleType?: string;
      customerName: string;
      buyerRegistrationType?: string;
      customerNtn?: string;
      customerCnic?: string;
      buyerProvince?: string;
      buyerAddress?: string;
      sroSchedule?: string;
      sroItem?: string;
      aboveRemarks?: string;
      paymentMethod: string;
      paidAmount?: number;
      paymentStatus?: "PAID" | "PARTIAL" | "UNPAID";
      notes?: string;
      items: any[];
      advanceIncomeTaxTotal: number;
      furtherTaxTotal: number;
      extraTaxTotal: number;
      grandTotalExpected?: number;
    }

    const groupedMap = new Map<string, GroupedInvoice>();

function parseSafeDate(input?: string): Date {
  if (!input) return new Date();
  const trimmed = String(input).trim();
  if (!trimmed) return new Date();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed + "T00:00:00Z");
    return isNaN(d.getTime()) ? new Date() : d;
  }

  // DD/MM/YYYY or MM/DD/YYYY
  const dmy = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmy) {
    const p1 = parseInt(dmy[1], 10);
    const p2 = parseInt(dmy[2], 10);
    const y = parseInt(dmy[3], 10);
    // If p1 > 12 -> must be DD/MM/YYYY (p1 is day, p2 is month)
    if (p1 > 12 && p2 <= 12) {
      return new Date(Date.UTC(y, p2 - 1, p1));
    }
    // If p2 > 12 -> must be MM/DD/YYYY (p1 is month, p2 is day)
    if (p2 > 12 && p1 <= 12) {
      return new Date(Date.UTC(y, p1 - 1, p2));
    }
    // Ambiguous (e.g. 9/1/2026, 9/12/2026) -> In Excel, M/D/YYYY is standard: p1 is Month (9=Sept), p2 is Day
    return new Date(Date.UTC(y, p1 - 1, p2));
  }

  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? new Date() : d;
}

    let autoGroupIdx = 0;
    let lastBuyerSignature = "";

    rawInvoices.forEach((row, idx) => {
      // If row already has grouped items, treat it as a pre-grouped invoice
      if (row.items && Array.isArray(row.items) && row.items.length > 0) {
        const rawInv = (row.invoiceNumber || "").trim();
        const isAuto = !rawInv || rawInv.startsWith("AUTO-") || rawInv.startsWith("row-") || rawInv.startsWith("ROW-");
        const invKey = isAuto ? (rawInv.startsWith("AUTO-") ? rawInv : `AUTO-${idx + 1}`) : rawInv;
        const date = parseSafeDate(row.date);
        const custName = (row.buyerLegalName || row.buyerName || row.customerName || "Walk-in Customer").trim();
        const custNtn = (row.buyerNtn || row.customerNtn || "").trim() || undefined;
        const custCnic = (row.buyerCnic || row.customerCnic || "").trim() || undefined;
        const regType = (row.buyerRegistrationType || (custNtn ? "Registered" : "Unregistered")).trim();
        const province = (row.buyerProvince || row.province || business?.province || "Sindh").trim();
        const address = (row.buyerAddress || row.address || "").trim() || undefined;

        groupedMap.set(invKey, {
          invoiceNumber: isAuto ? undefined : rawInv,
          date,
          scenario: row.scenario || (custNtn ? "SN001" : "SN002"),
          saleType: (row.saleType || "").trim() || undefined,
          customerName: custName,
          buyerRegistrationType: regType,
          customerNtn: custNtn,
          customerCnic: custCnic,
          buyerProvince: province,
          buyerAddress: address,
          sroSchedule: (row.sroSchedule || "").trim() || undefined,
          sroItem: (row.sroItem || "").trim() || undefined,
          aboveRemarks: (row.aboveRemarks || row.notes || "").trim() || undefined,
          paymentMethod: (row.paymentMethod || "CASH").toUpperCase(),
          paidAmount: row.paidAmount,
          paymentStatus: row.paymentStatus,
          notes: row.notes || row.aboveRemarks,
          items: row.items,
          advanceIncomeTaxTotal: Number(row.totalIncomeTax || 0),
          furtherTaxTotal: Number(row.furtherTaxAmount || row.furtherTax || 0),
          extraTaxTotal: Number(row.extraTaxValue || row.extraTax || 0),
          grandTotalExpected: row.totalAmount ? Number(row.totalAmount) : undefined,
        });
        return;
      }

      // Flat row grouping:
      const rawInv = (row.invoiceNumber || "").trim();
      let invKey: string;
      const isAuto = !rawInv || rawInv.startsWith("AUTO-") || rawInv.startsWith("row-") || rawInv.startsWith("ROW-");

      if (!isAuto) {
        invKey = rawInv;
      } else if (rawInv.startsWith("AUTO-")) {
        // Group key already determined by frontend CSV parser
        invKey = rawInv;
      } else {
        // Auto-group contiguous rows with matching date + buyer + NTN/CNIC
        const dateStr = String(row.date || "").trim();
        const buyerName = (row.buyerLegalName || row.buyerName || row.customerName || "").trim().toLowerCase();
        const taxId = (row.customerNtn || row.buyerNtn || row.customerCnic || row.buyerCnic || "").trim();
        const buyerSig = `${dateStr}_${buyerName}_${taxId}`;
        if (buyerSig !== lastBuyerSignature || !buyerSig) {
          autoGroupIdx++;
          lastBuyerSignature = buyerSig;
        }
        invKey = `AUTO-${String(autoGroupIdx).padStart(3, "0")}`;
      }

      const date = parseSafeDate(row.date);
      const customerName = (row.buyerLegalName || row.buyerName || row.customerName || "Walk-in Customer").trim();
      const customerNtn = (row.buyerNtn || row.customerNtn || "").trim() || undefined;
      const customerCnic = (row.buyerCnic || row.customerCnic || "").trim() || undefined;
      const buyerRegistrationType = (row.buyerRegistrationType || (customerNtn ? "Registered" : "Unregistered")).trim();
      const buyerProvince = (row.buyerProvince || row.province || business?.province || "Sindh").trim();
      const buyerAddress = (row.buyerAddress || row.address || "").trim() || undefined;
      const scenario = (row.scenario || (customerNtn ? "SN001" : "SN002")).trim();
      const saleType = (row.saleType || "").trim() || undefined;

      const prodName = (row.productName || "General Merchandise").trim();
      const qty = Math.max(1, Number(row.quantity || 1));
      const rate = Number(row.rate !== undefined ? row.rate : (row.unitPrice || 0));
      const taxRate = Number(row.taxRate !== undefined ? row.taxRate : 18.0);
      const discountVal = Number(row.discount !== undefined ? row.discount : (row.discountValue || 0));
      const discount2Val = Number(row.discount2Value || 0);
      const extraTax = Number(row.extraTaxValue || row.extraTax || 0);
      const advanceTax = Number(row.totalIncomeTax || 0);

      const lineExclusive = row.exclusiveValue !== undefined ? Number(row.exclusiveValue) : Math.max(0, qty * rate - discountVal);
      const lineTax = row.taxValue !== undefined ? Number(row.taxValue) : (lineExclusive * (taxRate / 100));

      const furtherTaxRate = Number(row.furtherTaxRate !== undefined ? row.furtherTaxRate : (scenario === "SN002" ? 3 : 0));
      const furtherTaxVal = Number(row.furtherTaxAmount !== undefined ? row.furtherTaxAmount : (row.furtherTax !== undefined ? row.furtherTax : (lineExclusive * (furtherTaxRate / 100))));

      const lineItem = {
        productName: prodName,
        hsCode: (row.hsCode || business?.defaultHsCode || "5201.0090").trim(),
        uom: (row.uom || "PCS").trim(),
        productRemarks: (row.productRemarks || "").trim() || undefined,
        quantity: qty,
        unitPrice: rate,
        taxRate,
        taxAmount: lineTax,
        furtherTaxRate,
        furtherTax: furtherTaxVal,
        discount: discountVal,
        discount2: discount2Val,
        extraTax,
        sroSchedule: (row.sroSchedule || "").trim() || undefined,
        sroItem: (row.sroItem || "").trim() || undefined,
      };

      if (!groupedMap.has(invKey)) {
        groupedMap.set(invKey, {
          invoiceNumber: isAuto ? undefined : rawInv,
          date,
          scenario,
          saleType,
          customerName,
          buyerRegistrationType,
          customerNtn,
          customerCnic,
          buyerProvince,
          buyerAddress,
          sroSchedule: (row.sroSchedule || "").trim() || undefined,
          sroItem: (row.sroItem || "").trim() || undefined,
          aboveRemarks: (row.aboveRemarks || row.notes || "").trim() || undefined,
          paymentMethod: (row.paymentMethod || "CASH").toUpperCase(),
          paidAmount: row.paidAmount,
          paymentStatus: row.paymentStatus,
          notes: row.aboveRemarks || row.notes,
          items: [lineItem],
          advanceIncomeTaxTotal: advanceTax,
          furtherTaxTotal: furtherTaxVal,
          extraTaxTotal: extraTax,
          grandTotalExpected: row.totalAmount ? Number(row.totalAmount) : undefined,
        });
      } else {
        const existing = groupedMap.get(invKey)!;
        existing.items.push(lineItem);
        existing.advanceIncomeTaxTotal += advanceTax;
        existing.furtherTaxTotal += furtherTaxVal;
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
          subtotal - totalDiscount + taxAmount + inv.furtherTaxTotal + totalExtraTax + inv.advanceIncomeTaxTotal
        );
        const finalGrandTotal = inv.grandTotalExpected !== undefined && inv.grandTotalExpected > 0
          ? inv.grandTotalExpected
          : calculatedGrandTotal;

        let paid = Number(inv.paidAmount !== undefined ? inv.paidAmount : (inv.paymentStatus === "UNPAID" ? 0 : finalGrandTotal));
        if (paid > finalGrandTotal) paid = finalGrandTotal;

        // Auto-link or auto-create Customer with statutory NTN/CNIC/Province profile
        let validCustomerId: string | null = null;
        let resolvedCustomerName = (inv.customerName || "").trim();
        if (resolvedCustomerName && resolvedCustomerName.toLowerCase() !== "walk-in customer") {
          let cust: any = null;
          try {
            cust = await prisma.customer.findFirst({
              where: { businessId, name: { equals: resolvedCustomerName, mode: "insensitive" } },
            });
          } catch {
            cust = fallbackStore.customers.find(
              (c) => c.businessId === businessId && c.name.toLowerCase() === resolvedCustomerName.toLowerCase()
            );
          }

          const isRegistered = Boolean(inv.customerNtn || inv.buyerRegistrationType === "Registered");
          const taxProfile = {
            ntn: inv.customerNtn || null,
            cnic: inv.customerCnic || null,
            province: inv.buyerProvince || "Sindh",
            taxStatus: isRegistered ? "REGISTERED" : "UNREGISTERED",
            address: inv.buyerAddress || null,
          };
          const notesJson = JSON.stringify(taxProfile);

          if (!cust) {
            try {
              cust = await prisma.customer.create({
                data: {
                  businessId,
                  name: resolvedCustomerName,
                  address: inv.buyerAddress || null,
                  notes: notesJson,
                },
              });
            } catch {
              cust = {
                id: `cust-${Date.now()}-${processedIndex}`,
                businessId,
                name: resolvedCustomerName,
                address: inv.buyerAddress || null,
                notes: notesJson,
              };
              fallbackStore.customers.push(cust);
            }
          } else if (inv.buyerAddress || inv.customerNtn || inv.customerCnic) {
            try {
              await prisma.customer.update({
                where: { id: cust.id },
                data: {
                  address: cust.address || inv.buyerAddress || null,
                  notes: notesJson,
                },
              });
            } catch {}
          }
          if (cust) {
            validCustomerId = cust.id;
          }
        }

        const fbrMeta = {
          scenario: inv.scenario,
          saleType: inv.saleType,
          customerNtn: inv.customerNtn,
          customerCnic: inv.customerCnic,
          buyerRegistrationType: inv.buyerRegistrationType,
          buyerProvince: inv.buyerProvince,
          buyerAddress: inv.buyerAddress,
          advanceIncomeTax: inv.advanceIncomeTaxTotal,
          furtherTax: inv.furtherTaxTotal,
          extraTax: totalExtraTax,
          sroSchedule: inv.sroSchedule,
          sroItem: inv.sroItem,
          aboveRemarks: inv.aboveRemarks,
          itemsUom: inv.items.map((it: any) => it.uom),
          itemsHsCode: inv.items.map((it: any) => it.hsCode),
        };

        let createdSale: any = null;
        try {
          createdSale = await createAndPostSale({
            businessId,
            invoiceNumber: inv.invoiceNumber && !inv.invoiceNumber.startsWith("AUTO-") && !inv.invoiceNumber.startsWith("row-") && !inv.invoiceNumber.startsWith("ROW-") ? inv.invoiceNumber : undefined,
            date: inv.date,
            customerId: validCustomerId,
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
            furtherTax: inv.furtherTaxTotal,
            extraTax: totalExtraTax,
            advanceIncomeTax: inv.advanceIncomeTaxTotal,
            posFee: 0,
            paidAmount: paid,
            paymentMethod: inv.paymentMethod || (paid > 0 ? "BANK_TRANSFER" : "CREDIT"),
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
          const invNum = inv.invoiceNumber && !inv.invoiceNumber.startsWith("AUTO-") && !inv.invoiceNumber.startsWith("row-") && !inv.invoiceNumber.startsWith("ROW-")
            ? inv.invoiceNumber
            : `INV-2026-${String(fallbackStore.sales.length + 1).padStart(5, "0")}`;

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
              uom: it.uom,
            };
          });

          const remaining = Math.max(0, finalGrandTotal - paid);
          const paymentStatus = remaining === 0 ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID";

          createdSale = {
            id: saleId,
            invoiceNumber: invNum,
            date: inv.date.toISOString(),
            customerId: validCustomerId,
            customerName: inv.customerName,
            subtotal,
            discountAmount: totalDiscount,
            taxAmount,
            salesTax: taxAmount,
            furtherTax: inv.furtherTaxTotal,
            extraTax: totalExtraTax,
            posFee: 0,
            totalAmount: finalGrandTotal,
            paidAmount: paid,
            remainingAmount: remaining,
            paymentStatus,
            paymentMethod: inv.paymentMethod || (paid > 0 ? "BANK_TRANSFER" : "CREDIT"),
            status: "POSTED",
            fbrStatus: "PENDING",
            fbrInvoiceNumber: null,
            fbrQrCode: null,
            fbrMeta,
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
      results: createdInvoices,
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
