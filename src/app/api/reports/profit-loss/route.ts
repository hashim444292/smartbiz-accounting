import { NextRequest, NextResponse } from "next/server";
import { getActiveBusinessId, getActiveBranchId } from "@/lib/businessHelper";
import { getProfitLossReport } from "@/services/reportService";
import { fallbackStore } from "@/lib/fallbackStore";
import { round2, Decimal, toDecimal } from "@/lib/decimal";
import { getProductEffectiveCost } from "@/lib/accountingConstants";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  let businessId = "biz-101";
  let activeBranchId: string | null = null;

  try {
    businessId = await getActiveBusinessId(req);
    const branchInfo = await getActiveBranchId(req);
    activeBranchId = branchInfo.branchId;
  } catch {}

  const { searchParams } = new URL(req.url);
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const defaultEnd = now.toISOString().split("T")[0];

  const startDate = searchParams.get("startDate") || searchParams.get("start") || defaultStart;
  const endDate = searchParams.get("endDate") || searchParams.get("end") || defaultEnd;
  const branchParam = searchParams.get("branchId") || activeBranchId;

  try {
    const report = await getProfitLossReport({
      businessId,
      startDate,
      endDate,
      branchId: branchParam,
    });
    return NextResponse.json({ success: true, data: report });
  } catch (error: any) {
    // Fallback Store calculation
    const [sY, sM, sD] = startDate.split("-").map(Number);
    const startDateTime = new Date(sY, sM - 1, sD, 0, 0, 0, 0);

    const [eY, eM, eD] = endDate.split("-").map(Number);
    const endDateTime = new Date(eY, eM - 1, eD, 23, 59, 59, 999);

    const compSales = (fallbackStore.sales || []).filter(
      (s) => s.businessId === businessId && (!branchParam || s.branchId === branchParam)
    );
    const compExpenses = (fallbackStore.expenses || []).filter(
      (e) => e.businessId === businessId && (!branchParam || e.branchId === branchParam)
    );
    const compDamageTx = (fallbackStore.inventoryTransactions || []).filter(
      (t) =>
        t.businessId === businessId &&
        (t.type === "DAMAGE" ||
          (t.type === "ADJUSTMENT" && Number(t.quantity || 0) < 0) ||
          (t.type === "STOCK_OUT" &&
            (t.referenceType === "ADJUSTMENT" ||
              (t.notes || "").toLowerCase().includes("loss") ||
              (t.notes || "").toLowerCase().includes("theft") ||
              (t.notes || "").toLowerCase().includes("stolen") ||
              (t.notes || "").toLowerCase().includes("expiry") ||
              (t.notes || "").toLowerCase().includes("damage")))) &&
        (!branchParam || t.branchId === branchParam)
    );
    const compProducts = (fallbackStore.products || []).filter(
      (p) => !p.businessId || p.businessId === businessId
    );

    const productCostMap = new Map<string, number>();
    for (const p of compProducts) {
      productCostMap.set(p.id, getProductEffectiveCost(p));
    }

    let grossSalesDec = new Decimal(0);
    let salesReturnsDec = new Decimal(0);
    let cogsDec = new Decimal(0);
    let unitsSoldDec = new Decimal(0);
    let activeSalesCount = 0;

    for (const s of compSales) {
      const saleDate = new Date(s.date);
      if (saleDate >= startDateTime && saleDate <= endDateTime) {
        if (s.status === "CANCELLED") {
          salesReturnsDec = salesReturnsDec.add(toDecimal(s.totalAmount || 0));
        } else {
          grossSalesDec = grossSalesDec.add(toDecimal(s.totalAmount || 0));
          activeSalesCount++;
          for (const item of s.items || []) {
            const qty = toDecimal(item.quantity || 0);
            unitsSoldDec = unitsSoldDec.add(qty);
            let unitCost = toDecimal(item.costPrice || 0);
            if (unitCost.lte(0) && item.productId) {
              unitCost = toDecimal(productCostMap.get(item.productId) || 0);
            }
            cogsDec = cogsDec.add(qty.mul(unitCost));
          }
        }
      }
    }

    // Auto-sync with General Ledger Account 5020 in fallbackStore
    let inventoryLossDec = new Decimal(0);
    const lines5020 = (fallbackStore.journalEntries || [])
      .filter((je) => {
        const jDate = new Date(je.date);
        return je.businessId === businessId && jDate >= startDateTime && jDate <= endDateTime;
      })
      .flatMap((je) => je.lines || [])
      .filter((l: any) => l.accountCode === "5020");

    for (const l of lines5020) {
      inventoryLossDec = inventoryLossDec.add(toDecimal(l.debit || 0)).sub(toDecimal(l.credit || 0));
    }

    const damageBreakdown: Record<string, Decimal> = {
      damage: new Decimal(0),
      theft: new Decimal(0),
      expiry: new Decimal(0),
      missing: new Decimal(0),
      audit: new Decimal(0),
      other: new Decimal(0),
    };

    const classifyLoss = (notes?: string | null, reason?: string | null): string => {
      const r = (reason || "").toUpperCase();
      const n = (notes || "").toLowerCase();
      if (n.includes("theft") || n.includes("stolen") || n.includes("چوری")) return "theft";
      if (r === "EXPIRY" || n.includes("expir") || n.includes("ختم")) return "expiry";
      if (n.includes("missing") || n.includes("lost") || n.includes("گمشدہ")) return "missing";
      if (r === "PHYSICAL_COUNT" || n.includes("audit") || n.includes("آڈٹ")) return "audit";
      if (r === "DAMAGE" || n.includes("damage") || n.includes("broken") || n.includes("خراب") || n.includes("ٹوٹ")) return "damage";
      if (r === "WRITE_OFF") return "theft";
      return "other";
    };

    let txLossDec = new Decimal(0);
    for (const d of compDamageTx) {
      const txDate = new Date(d.date);
      if (txDate >= startDateTime && txDate <= endDateTime) {
        let cost = toDecimal(d.totalCost || 0);
        if (cost.lte(0)) {
          const q = toDecimal(Math.abs(Number(d.quantity || 0)));
          const uc = toDecimal(d.unitCost || 0);
          cost = q.mul(uc);
        }
        txLossDec = txLossDec.add(cost);

        const catKey = classifyLoss(d.notes, d.reason);
        damageBreakdown[catKey] = (damageBreakdown[catKey] || new Decimal(0)).add(cost);
      }
    }

    if (txLossDec.gt(inventoryLossDec)) {
      inventoryLossDec = txLossDec;
    }

    const netSalesDec = grossSalesDec.sub(salesReturnsDec);
    const totalCostOfSalesDec = cogsDec.add(inventoryLossDec);
    const grossProfitDec = netSalesDec.sub(totalCostOfSalesDec);

    let totalExpensesDec = new Decimal(0);
    const catMap = new Map<string, { name: string; amount: Decimal; count: number }>();
    for (const exp of compExpenses) {
      const expDate = new Date(exp.date);
      if (expDate >= startDateTime && expDate <= endDateTime) {
        const amt = toDecimal(exp.amount || 0);
        totalExpensesDec = totalExpensesDec.add(amt);
        let catName = "General Operating & Administrative";
        if (exp.categoryId && fallbackStore.expenseCategories) {
          const found = fallbackStore.expenseCategories.find((c: any) => c.id === exp.categoryId);
          if (found) catName = found.name;
        }
        const existing = catMap.get(catName);
        if (existing) {
          existing.amount = existing.amount.add(amt);
          existing.count += 1;
        } else {
          catMap.set(catName, { name: catName, amount: amt, count: 1 });
        }
      }
    }

    const expenseCategories = Array.from(catMap.values())
      .map((c) => ({
        name: c.name,
        amount: round2(c.amount).toNumber(),
        count: c.count,
      }))
      .sort((a, b) => b.amount - a.amount);

    const netProfitDec = grossProfitDec.sub(totalExpensesDec);

    const grossSales = round2(grossSalesDec).toNumber();
    const salesReturns = round2(salesReturnsDec).toNumber();
    const netSales = round2(netSalesDec).toNumber();
    const cogs = round2(cogsDec).toNumber();
    const inventoryLoss = round2(inventoryLossDec).toNumber();
    const totalCostOfSales = round2(totalCostOfSalesDec).toNumber();
    const grossProfit = round2(grossProfitDec).toNumber();
    const expenses = round2(totalExpensesDec).toNumber();
    const netProfit = round2(netProfitDec).toNumber();

    const grossMarginPercent = netSales > 0 ? round2(grossProfitDec.div(netSalesDec).mul(100)).toNumber() : 0;
    const netMarginPercent = netSales > 0 ? round2(netProfitDec.div(netSalesDec).mul(100)).toNumber() : 0;

    const startFmt = startDateTime.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const endFmt = endDateTime.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const periodLabel = `${startFmt} to ${endFmt}`;

    const breakdownList = [
      { label: "Broken / Damaged (ٹوٹ پھوٹ یا خرابی)", amount: round2(damageBreakdown.damage).toNumber(), icon: "💥" },
      { label: "Theft / Stolen (چوری ہو گیا)", amount: round2(damageBreakdown.theft).toNumber(), icon: "🕵️" },
      { label: "Expired Goods (ایکسپائر مال)", amount: round2(damageBreakdown.expiry).toNumber(), icon: "⏳" },
      { label: "Lost / Missing (گمشدہ یا کمی)", amount: round2(damageBreakdown.missing).toNumber(), icon: "❓" },
      { label: "Physical Audit Shortage (آڈٹ کمی)", amount: round2(damageBreakdown.audit).toNumber(), icon: "📋" },
      { label: "Other Inventory Loss (دیگر نقصان)", amount: round2(damageBreakdown.other).toNumber(), icon: "📝" },
    ].filter((b) => b.amount > 0);

    if (inventoryLoss > 0 && breakdownList.length === 0) {
      breakdownList.push({
        label: "General Inventory Shrinkage & Loss (اکاؤنٹ 5020)",
        amount: inventoryLoss,
        icon: "📦",
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        startDate,
        endDate,
        periodLabel,
        grossSales,
        salesReturns,
        netSales,
        salesCount: activeSalesCount,
        unitsSold: round2(unitsSoldDec).toNumber(),
        cogs,
        inventoryLoss,
        inventoryLossBreakdown: breakdownList,
        totalCostOfSales,
        grossProfit,
        grossMarginPercent,
        expenses,
        expenseCategories,
        netProfit,
        netMarginPercent,
      },
    });
  }
}
