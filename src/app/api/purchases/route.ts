import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAndPostPurchase } from "@/services/purchaseService";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { fallbackStore } from "@/lib/fallbackStore";
import { calculateWeightedAverageCost } from "@/lib/decimal";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const businessId = await getActiveBusinessId(req);
    const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("DB_TIMEOUT")), 150));
    const purchases = await Promise.race([
      prisma.purchase.findMany({
        where: { businessId },
        include: { supplier: true, items: true },
        orderBy: { date: "desc" },
      }),
      timeoutPromise,
    ]);
    return NextResponse.json({ success: true, data: purchases });
  } catch (err) {
    const businessId = await getActiveBusinessId(req);
    const filtered = fallbackStore.purchases.filter((p) => p.businessId === businessId);
    return NextResponse.json({ success: true, data: filtered, fallback: true });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  try {
    const businessId = await getActiveBusinessId(req);
    const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("DB_TIMEOUT")), 150));
    const purchase = await Promise.race([
      createAndPostPurchase({
        businessId,
        ...body,
      }),
      timeoutPromise,
    ]);
    return NextResponse.json({ success: true, data: purchase });
  } catch (error: any) {
    const businessId = await getActiveBusinessId(req);
    const purId = `pur-${Date.now()}`;
    const purNum = `PUR-2026-${String(fallbackStore.purchases.length + 1).padStart(5, "0")}`;
    const paid = Number(body.paidAmount || 0);

    let subtotal = 0;
    const processedItems = (body.items || []).map((it: any, i: number) => {
      let prod = fallbackStore.products.find((p) => p.id === it.productId && p.businessId === businessId);
      if (!prod && it.productName) {
        prod = fallbackStore.products.find(
          (p) => p.name.toLowerCase() === it.productName.toLowerCase() && p.businessId === businessId
        );
      }
      const q = Number(it.quantity || 1);
      const c = Number(it.unitCost || prod?.purchasePrice || 0);
      const lt = q * c;
      subtotal += lt;

      let oldCost = c;
      let oldStock = 0;
      let oldSelling = 0;

      if (prod) {
        oldCost = Number(prod.purchasePrice || prod.averageCost || c);
        oldStock = Number(prod.currentStock || 0);
        oldSelling = Number(prod.sellingPrice || prod.retailPrice || 0);

        const newAvg = calculateWeightedAverageCost(oldStock, prod.averageCost || c, q, c);
        prod.averageCost = newAvg.toNumber();
        prod.currentStock = oldStock + q;
        prod.purchasePrice = c;

        // If user opted to update catalog selling price and provided a new selling price
        const newSellPrice = Number(it.newSellingPrice || 0);
        if (it.updateCatalogPrice && newSellPrice > 0) {
          prod.sellingPrice = newSellPrice;
          prod.retailPrice = newSellPrice;
        }

        // Record in costHistory
        prod.costHistory = prod.costHistory || [];
        prod.costHistory.unshift({
          date: body.date ? new Date(body.date).toISOString() : new Date().toISOString(),
          purchaseNumber: purNum,
          previousCost: oldCost,
          newPurchaseCost: c,
          quantity: q,
          newAverageCost: prod.averageCost,
          sellingPrice: prod.sellingPrice,
          oldStock,
          oldSellingPrice: oldSelling,
          newSellingPrice: prod.sellingPrice,
        });
      } else if (it.productName) {
        // Register new product into catalog
        const sellPrice = Number(it.newSellingPrice) > 0 ? Number(it.newSellingPrice) : Math.round(c * 1.25);
        prod = {
          id: `prod-${Date.now()}-${i}`,
          businessId,
          name: it.productName,
          sku: `SKU-${Date.now().toString().slice(-4)}`,
          unit: "pcs",
          uom: "pcs",
          purchasePrice: c,
          sellingPrice: sellPrice,
          retailPrice: sellPrice,
          openingQuantity: 0,
          currentStock: q,
          averageCost: c,
          minStockLevel: 1,
          createdAt: new Date().toISOString(),
          costHistory: [
            {
              date: body.date ? new Date(body.date).toISOString() : new Date().toISOString(),
              purchaseNumber: purNum,
              previousCost: c,
              newPurchaseCost: c,
              quantity: q,
              newAverageCost: c,
              sellingPrice: sellPrice,
              oldStock: 0,
              oldSellingPrice: sellPrice,
              newSellingPrice: sellPrice,
            },
          ],
        };
        fallbackStore.products.push(prod);
      }

      return {
        id: `pi-${purId}-${i}`,
        productId: prod?.id || it.productId || `prod-item-${i}`,
        productName: prod?.name || it.productName || "Stock Item",
        quantity: q,
        unitCost: c,
        lineTotal: lt,
        previousCost: oldCost,
        previousSellingPrice: oldSelling,
        newSellingPrice: Number(it.newSellingPrice || prod?.sellingPrice || 0),
        updateCatalogPrice: Boolean(it.updateCatalogPrice),
      };
    });

    const total = subtotal;
    const remaining = Math.max(0, total - paid);

    let supName = body.supplierName || "Supplier";
    if (body.supplierId) {
      const sup = fallbackStore.suppliers.find((s) => s.id === body.supplierId && s.businessId === businessId);
      if (sup) {
        sup.currentBalance += remaining;
        supName = sup.name;
      }
    }

    if (paid > 0) {
      const acc = fallbackStore.cashBankAccounts.find(
        (a) => a.businessId === businessId && (body.paymentMethod === "BANK" ? a.type === "BANK" : a.type === "CASH")
      );
      if (acc) acc.balance -= paid;
    }

    const newPurchase = {
      id: purId,
      businessId,
      purchaseNumber: purNum,
      date: body.date ? new Date(body.date).toISOString() : new Date().toISOString(),
      supplierName: supName,
      supplierId: body.supplierId || null,
      totalAmount: total,
      paidAmount: paid,
      remainingAmount: remaining,
      paymentStatus: remaining === 0 ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID",
      paymentMethod: body.paymentMethod || "CASH",
      status: "POSTED",
      notes: body.notes || "",
      items: processedItems,
    };

    fallbackStore.purchases.unshift(newPurchase);
    return NextResponse.json({ success: true, data: newPurchase, fallback: true });
  }
}
