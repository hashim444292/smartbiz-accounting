import { PrismaClient } from "@prisma/client";
import { fallbackStore } from "./fallbackStore";
import { getProductEffectiveCost } from "./accountingConstants";
import { round2 } from "./decimal";

export interface InventoryValuationResult {
  totalValuation: number;
  productCount: number;
  totalQuantity: number;
}

/**
 * Reconciles and synchronizes Merchandise Inventory (Account 1200)
 * in the Chart of Accounts with live inventory stock valuation (Qty * Effective Cost).
 */
export async function reconcileInventoryValuation(
  prismaClient: PrismaClient | typeof import("@/lib/prisma").prisma,
  businessId: string
): Promise<InventoryValuationResult> {
  if (!businessId) {
    return { totalValuation: 0, productCount: 0, totalQuantity: 0 };
  }

  try {
    const products = await prismaClient.product.findMany({
      where: { businessId, isActive: true },
      select: {
        id: true,
        currentStock: true,
        averageCost: true,
        purchasePrice: true,
        openingCost: true,
      },
    });

    let totalValuation = 0;
    let totalQuantity = 0;

    for (const p of products) {
      const stock = Number(p.currentStock || 0);
      if (stock > 0) {
        totalQuantity += stock;
        const unitCost = getProductEffectiveCost(p);
        totalValuation += stock * unitCost;
      }
    }

    const roundedValuation = round2(totalValuation).toNumber();

    // Synchronize Account 1200 (Merchandise Inventory)
    const acc1200 = await prismaClient.account.findUnique({
      where: { businessId_code: { businessId, code: "1200" } },
    });

    if (acc1200) {
      await prismaClient.account.update({
        where: { id: acc1200.id },
        data: { balance: roundedValuation },
      }).catch(() => null);
    }

    return {
      totalValuation: roundedValuation,
      productCount: products.length,
      totalQuantity,
    };
  } catch (err) {
    console.error("reconcileInventoryValuation error:", err);
    return storeReconcileInventoryValuation(businessId);
  }
}

/**
 * Fallback store implementation for testing / in-memory mode.
 */
export function storeReconcileInventoryValuation(businessId: string): InventoryValuationResult {
  const products = fallbackStore.products.filter(
    (p) => p.businessId === businessId && p.isActive !== false
  );

  let totalValuation = 0;
  let totalQuantity = 0;

  for (const p of products) {
    const stock = Number(p.currentStock || 0);
    if (stock > 0) {
      totalQuantity += stock;
      const unitCost = getProductEffectiveCost(p);
      totalValuation += stock * unitCost;
    }
  }

  const roundedValuation = round2(totalValuation).toNumber();

  const acc1200 = fallbackStore.accounts.find(
    (a) => a.businessId === businessId && a.code === "1200"
  );
  if (acc1200) {
    acc1200.balance = roundedValuation;
  }

  return {
    totalValuation: roundedValuation,
    productCount: products.length,
    totalQuantity,
  };
}
