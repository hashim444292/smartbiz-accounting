import { NextRequest, NextResponse } from "next/server";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { fallbackStore } from "@/lib/fallbackStore";
import { prisma } from "@/lib/prisma";
import { calculateWeightedAverageCost } from "@/lib/decimal";
import { createAndPostPurchase } from "@/services/purchaseService";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const businessId = await getActiveBusinessId(req);
    const body = await req.json();
    const purchases = body.purchases || [];

    if (!Array.isArray(purchases) || purchases.length === 0) {
      return NextResponse.json(
        { success: false, error: "Please provide a valid list of purchases to import." },
        { status: 400 }
      );
    }

    const createdPurchases: any[] = [];
    const errors: any[] = [];

    for (let i = 0; i < purchases.length; i++) {
      const row = purchases[i];
      try {
        const date = row.date ? new Date(row.date) : new Date();
        const supplierName = (row.supplierName || "General Supplier").trim();

        // 1. Find or create supplier
        let supplierId = row.supplierId;
        let sup = fallbackStore.suppliers.find(
          (s) => s.name.toLowerCase() === supplierName.toLowerCase()
        );
        if (!sup) {
          sup = {
            id: `sup-${Date.now()}-${i}`,
            code: `ACP${String(fallbackStore.suppliers.length + 1).padStart(5, "0")}`,
            name: supplierName,
            businessName: supplierName,
            phone: row.supplierPhone || "—",
            address: "Pakistan",
            openingBalance: 0,
            currentBalance: 0,
            purchases: [],
            payments: [],
          };
          fallbackStore.suppliers.push(sup);
        }
        supplierId = sup.id;

        // 2. Parse items
        const rawItems = (row.items && Array.isArray(row.items) && row.items.length > 0)
          ? row.items
          : [
              {
                productName: (row.productName || "General Stock Item").trim(),
                quantity: Number(row.quantity || 1),
                unitCost: Number(row.unitCost || row.purchasePrice || 0),
              },
            ];

        let subtotal = 0;
        const processedItems = rawItems.map((it: any, itemIdx: number) => {
          const q = Number(it.quantity || 1);
          const c = Number(it.unitCost || 0);
          const lt = q * c;
          subtotal += lt;

          // Find or create product in fallbackStore
          let prod = fallbackStore.products.find(
            (p) => p.name.toLowerCase() === (it.productName || "").toLowerCase()
          );

          if (prod) {
            const newAvg = calculateWeightedAverageCost(
              prod.currentStock || 0,
              prod.averageCost || c,
              q,
              c
            );
            prod.averageCost = newAvg.toNumber();
            prod.currentStock = (prod.currentStock || 0) + q;
          } else {
            prod = {
              id: `prod-${Date.now()}-${i}-${itemIdx}`,
              businessId,
              name: it.productName || "Stock Item",
              sku: `SKU-${Date.now().toString().slice(-4)}`,
              unit: "pcs",
              uom: "pcs",
              purchasePrice: c,
              sellingPrice: Math.round(c * 1.25),
              openingQuantity: 0,
              currentStock: q,
              averageCost: c,
              minStockLevel: 1,
              createdAt: new Date().toISOString(),
            };
            fallbackStore.products.push(prod);
          }

          return {
            id: `pi-bulk-${Date.now()}-${i}-${itemIdx}`,
            productId: prod.id,
            productName: prod.name,
            quantity: q,
            unitCost: c,
            lineTotal: lt,
          };
        });

        const totalAmount = subtotal;
        let paid = Number(row.paidAmount !== undefined ? row.paidAmount : (row.paymentStatus === "UNPAID" ? 0 : totalAmount));
        if (paid > totalAmount) paid = totalAmount;
        const remaining = Math.max(0, totalAmount - paid);
        const paymentStatus = remaining === 0 ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID";
        const paymentMethod = row.paymentMethod || (paid > 0 ? "CASH" : "BANK");

        // Try Prisma with fast timeout
        let dbPurchase: any = null;
        try {
          const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("DB_TIMEOUT")), 100));
          dbPurchase = await Promise.race([
            createAndPostPurchase({
              businessId,
              supplierId,
              supplierName: sup.name,
              date,
              items: processedItems.map((it: any) => ({
                productId: it.productId,
                quantity: it.quantity,
                unitCost: it.unitCost,
              })),
              paidAmount: paid,
              paymentMethod,
              notes: row.notes || "Bulk imported purchase bill",
            }),
            timeoutPromise,
          ]);
        } catch {
          // DB offline or timed out, use fallback
        }

        // Update supplier balance
        sup.currentBalance += remaining;

        // Deduct paid amount from Cash/Bank
        if (paid > 0) {
          const acc = fallbackStore.cashBankAccounts.find(
            (a) => (paymentMethod === "BANK" ? a.type === "BANK" : a.type === "CASH")
          );
          if (acc) {
            acc.balance -= paid;
          }
        }

        const purNum = row.purchaseNumber || `PUR-2026-${String(fallbackStore.purchases.length + 1).padStart(5, "0")}`;
        const newPurchase = dbPurchase || {
          id: `pur-bulk-${Date.now()}-${i}`,
          businessId,
          purchaseNumber: purNum,
          date: date.toISOString(),
          supplierName: sup.name,
          supplierId: sup.id,
          totalAmount,
          paidAmount: paid,
          remainingAmount: remaining,
          paymentStatus,
          paymentMethod,
          status: "POSTED",
          notes: row.notes || "Bulk imported purchase bill",
          items: processedItems,
        };

        fallbackStore.purchases.unshift(newPurchase);
        createdPurchases.push(newPurchase);
      } catch (rowErr: any) {
        errors.push({ row: i + 1, error: rowErr.message });
      }
    }

    return NextResponse.json({
      success: true,
      importedCount: createdPurchases.length,
      errorCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      purchases: createdPurchases,
      message: `Successfully imported ${createdPurchases.length} purchase bill(s)${errors.length > 0 ? ` with ${errors.length} error(s)` : ""}.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to import purchase bills" },
      { status: 500 }
    );
  }
}
