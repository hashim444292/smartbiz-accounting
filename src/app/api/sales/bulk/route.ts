import { NextRequest, NextResponse } from "next/server";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { createAndPostSale } from "@/services/salesService";
import { fallbackStore } from "@/lib/fallbackStore";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const businessId = await getActiveBusinessId(req);
    const body = await req.json();
    const invoices = body.invoices || [];

    if (!Array.isArray(invoices) || invoices.length === 0) {
      return NextResponse.json(
        { success: false, error: "Please provide a valid list of invoices to import." },
        { status: 400 }
      );
    }

    const createdInvoices: any[] = [];
    const errors: any[] = [];

    for (let i = 0; i < invoices.length; i++) {
      const row = invoices[i];
      try {
        const date = row.date ? new Date(row.date) : new Date();
        const customerName = (row.customerName || "Walk-in Customer").trim();

        // Items
        const items = (row.items && row.items.length > 0)
          ? row.items
          : [
              {
                productName: (row.productName || "General Merchandise").trim(),
                quantity: Number(row.quantity || 1),
                unitPrice: Number(row.unitPrice || 0),
                taxRate: Number(row.taxRate !== undefined ? row.taxRate : 18.0),
              },
            ];

        // Find or map customer
        let custId = row.customerId;
        const matchedCust = fallbackStore.customers.find(
          (c) => c.name.toLowerCase() === customerName.toLowerCase()
        );
        if (matchedCust) {
          custId = matchedCust.id;
        }

        // Calculate totals
        let subtotal = 0;
        let taxAmount = 0;
        for (const it of items) {
          const q = Number(it.quantity || 1);
          const p = Number(it.unitPrice || 0);
          const tr = Number(it.taxRate !== undefined ? it.taxRate : 18.0);
          const line = q * p;
          const tax = line * (tr / 100);
          subtotal += line;
          taxAmount += tax;
        }

        const totalAmount = subtotal + taxAmount; // No POS fee upfront
        let paid = Number(row.paidAmount !== undefined ? row.paidAmount : (row.paymentStatus === "UNPAID" ? 0 : totalAmount));
        if (paid > totalAmount) paid = totalAmount;
        const remaining = Math.max(0, totalAmount - paid);
        const paymentStatus = remaining === 0 ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID";

        // Try prisma or fallback
        let createdSale: any = null;
        try {
          createdSale = await createAndPostSale({
            businessId,
            customerId: custId,
            customerName,
            date,
            items: items.map((it: any) => ({
              productId: it.productId || "prod-default",
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              taxRate: it.taxRate,
            })),
            salesTax: taxAmount,
            posFee: 0,
            paidAmount: paid,
            paymentMethod: row.paymentMethod || (paid > 0 ? "CASH" : "CREDIT"),
            notes: row.notes || "Bulk imported invoice",
            fbrStatus: "PENDING",
          });
        } catch (dbErr: any) {
          // Fallback Store
          const saleId = `sale-${Date.now()}-${i}`;
          const invNum = `INV-2026-${String(fallbackStore.sales.length + 1).padStart(5, "0")}`;

          // Inventory deduction
          const processedItems = items.map((it: any, itemIdx: number) => {
            const prod = fallbackStore.products.find(
              (p) => p.name.toLowerCase() === (it.productName || "").toLowerCase()
            );
            const q = Number(it.quantity || 1);
            const p = Number(it.unitPrice || prod?.sellingPrice || 0);
            if (prod) prod.currentStock -= q;

            return {
              id: `si-${saleId}-${itemIdx}`,
              productId: prod?.id || `prod-gen-${itemIdx}`,
              productName: it.productName || prod?.name || "General Merchandise",
              quantity: q,
              unitPrice: p,
              lineTotal: q * p,
              costPrice: prod?.averageCost || 0,
            };
          });

          // Customer balance
          if (custId && remaining > 0) {
            const c = fallbackStore.customers.find((cust) => cust.id === custId);
            if (c) c.currentBalance += remaining;
          }

          // Cash account
          if (paid > 0) {
            const acc = fallbackStore.cashBankAccounts.find(
              (a) => (row.paymentMethod === "BANK" ? a.type === "BANK" : a.type === "CASH")
            );
            if (acc) acc.balance += paid;
          }

          createdSale = {
            id: saleId,
            invoiceNumber: invNum,
            date: date.toISOString(),
            customerName,
            customerId: custId,
            subtotal,
            discountAmount: 0,
            taxAmount,
            salesTax: taxAmount,
            furtherTax: 0,
            extraTax: 0,
            posFee: 0,
            totalAmount,
            paidAmount: paid,
            remainingAmount: remaining,
            paymentStatus,
            paymentMethod: row.paymentMethod || (paid > 0 ? "CASH" : "CREDIT"),
            status: "POSTED",
            fbrStatus: "PENDING",
            fbrInvoiceNumber: null,
            fbrQrCode: null,
            items: processedItems,
          };

          fallbackStore.sales.unshift(createdSale);
        }

        createdInvoices.push(createdSale);
      } catch (err: any) {
        errors.push({ row: i + 1, error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      importedCount: createdInvoices.length,
      errorCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully imported ${createdInvoices.length} sales invoices.`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
