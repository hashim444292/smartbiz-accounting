import { NextRequest, NextResponse } from "next/server";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { approveAndPostAITransaction } from "@/services/aiService";
import { fallbackStore } from "@/lib/fallbackStore";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { extractedTransactionId, overrides, userId = "admin" } = body;

  try {
    const businessId = await getActiveBusinessId();

    const result = await approveAndPostAITransaction(
      businessId,
      extractedTransactionId,
      userId,
      overrides
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    if (error.message?.includes("Can't reach database server") || error.code === "P1001" || !process.env.DATABASE_URL) {
      // Find in fallbackStore imports
      let foundTx: any = null;
      for (const imp of fallbackStore.aiImports) {
        const t = imp.transactions?.find((tx: any) => tx.id === extractedTransactionId);
        if (t) {
          foundTx = t;
          break;
        }
      }

      const totalAmount = overrides?.totalAmount !== undefined ? Number(overrides.totalAmount) : (foundTx ? Number(foundTx.totalAmount) : 0);
      const paidAmount = overrides?.paidAmount !== undefined ? Number(overrides.paidAmount) : (foundTx ? Number(foundTx.paidAmount) : 0);
      const paymentMethod = overrides?.paymentMethod || foundTx?.paymentMethod || "CASH";
      const txType = overrides?.type || foundTx?.type || "SALE";
      const partyId = overrides?.partyId || foundTx?.partyMatchedId;
      const partyName = overrides?.partyName || foundTx?.partyName || "Party";

      if (foundTx) {
        foundTx.status = "POSTED";
      }

      if (txType === "SALE") {
        const prod = fallbackStore.products[0];
        const newSale = {
          id: `sale-${Date.now()}`,
          invoiceNumber: `INV-2026-${String(fallbackStore.sales.length + 1).padStart(5, "0")}`,
          date: new Date().toISOString(),
          customerName: partyName,
          customerId: partyId,
          totalAmount,
          paidAmount,
          remainingAmount: Math.max(0, totalAmount - paidAmount),
          paymentStatus: totalAmount === paidAmount ? "PAID" : paidAmount > 0 ? "PARTIAL" : "UNPAID",
          paymentMethod,
          status: "POSTED",
          items: [
            {
              id: `si-${Date.now()}`,
              productId: prod?.id || "prod-1",
              productName: prod?.name || "Merchandise",
              quantity: 1,
              unitPrice: totalAmount,
              lineTotal: totalAmount,
              costPrice: prod?.averageCost || 0,
            },
          ],
        };
        fallbackStore.sales.unshift(newSale);
      } else if (txType === "EXPENSE") {
        const newExp = {
          id: `exp-${Date.now()}`,
          categoryId: fallbackStore.expenseCategories[0]?.id || "expcat-6",
          category: { name: partyName || "General" },
          date: new Date().toISOString(),
          description: foundTx?.notes || "AI Extracted Expense",
          amount: totalAmount,
          paymentMethod,
          paidTo: partyName,
          notes: "Approved from AI extraction",
        };
        fallbackStore.expenses.unshift(newExp);
      } else if (txType === "PAYMENT_RECEIVED") {
        const newPay = {
          id: `pay-${Date.now()}`,
          type: "RECEIPT",
          date: new Date().toISOString(),
          partyName,
          customerId: partyId,
          amount: paidAmount || totalAmount,
          paymentMethod,
          referenceNumber: `REC-${Date.now().toString().slice(-6)}`,
          notes: "Approved from AI extraction",
        };
        fallbackStore.payments.unshift(newPay);
      }

      return NextResponse.json({ success: true, data: { status: "POSTED", extractedTransactionId }, fallback: true });
    }

    console.error("AI Post Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
