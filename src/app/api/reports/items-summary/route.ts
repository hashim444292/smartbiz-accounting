import { NextRequest, NextResponse } from "next/server";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { getItemsSummaryReport } from "@/services/reportService";
import { fallbackStore } from "@/lib/fallbackStore";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");

  const startDate = startParam ? new Date(startParam) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const endDate = endParam ? new Date(endParam) : new Date();

  try {
    const businessId = await getActiveBusinessId();
    const report = await getItemsSummaryReport(businessId, startDate, endDate);
    return NextResponse.json({ success: true, data: report });
  } catch (error: any) {
    // Fallback store calculation
    const categoryMap = new Map<string, any>();
    let grandOp = 0;
    let grandIn = 0;
    let grandOut = 0;
    let grandBal = 0;

    for (const prod of fallbackStore.products) {
      const cat = fallbackStore.categories.find((c) => c.id === prod.categoryId);
      const catName = cat?.name || "MIX MOBILE";

      if (!categoryMap.has(catName)) {
        categoryMap.set(catName, {
          name: catName,
          items: [],
          totals: { count: 0, op: 0, in: 0, out: 0, bal: 0 },
        });
      }

      const group = categoryMap.get(catName)!;

      // Filter transactions
      const txs = fallbackStore.inventoryTransactions.filter((t) => t.productId === prod.id);
      let inQty = 0;
      let outQty = 0;

      for (const t of txs) {
        const isPos = ["STOCK_IN", "PURCHASE", "OPENING", "SALE_RETURN"].includes(t.type);
        const isNeg = ["STOCK_OUT", "SALE", "DAMAGE", "PURCHASE_RETURN"].includes(t.type);
        const q = Math.abs(Number(t.quantity));

        if (isPos) inQty += q;
        if (isNeg) outQty += q;
      }

      const op = Number(prod.openingQuantity || prod.currentStock || 0);
      const bal = op + inQty - outQty;

      group.items.push({
        id: prod.id,
        description: prod.name,
        sku: prod.sku,
        unit: prod.unit || "pcs",
        op,
        in: inQty,
        out: outQty,
        bal,
      });

      group.totals.count += 1;
      group.totals.op += op;
      group.totals.in += inQty;
      group.totals.out += outQty;
      group.totals.bal += bal;

      grandOp += op;
      grandIn += inQty;
      grandOut += outQty;
      grandBal += bal;
    }

    const fallbackReport = {
      businessName: fallbackStore.business.name || "HANIF",
      reportTitle: "ITEMS SUMMARY",
      fromDate: startDate.toISOString(),
      toDate: endDate.toISOString(),
      printingTime: new Date().toISOString(),
      categories: Array.from(categoryMap.values()),
      grandTotal: {
        totalItems: fallbackStore.products.length,
        op: grandOp,
        in: grandIn,
        out: grandOut,
        bal: grandBal,
      },
    };

    return NextResponse.json({ success: true, data: fallbackReport, fallback: true });
  }
}
