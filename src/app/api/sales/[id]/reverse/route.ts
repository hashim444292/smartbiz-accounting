import { NextRequest, NextResponse } from "next/server";
import { reverseSale } from "@/services/salesService";
import { fallbackStore } from "@/lib/fallbackStore";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const body = await req.json();
  const reason = body.reason || "Customer return / cancellation";

  try {
    const result = await reverseSale(id, reason);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    if (error.message?.includes("Can't reach database server") || error.code === "P1001" || !process.env.DATABASE_URL) {
      const sale = fallbackStore.sales.find((s) => s.id === id);
      if (!sale) {
        return NextResponse.json({ success: false, error: "Sale not found" }, { status: 404 });
      }

      sale.status = "CANCELLED";

      // Restore product stock
      for (const it of sale.items || []) {
        const prod = fallbackStore.products.find((p) => p.id === it.productId);
        if (prod) {
          prod.currentStock += it.quantity;
        }
      }

      // Revert customer balance
      if (sale.customerId && sale.remainingAmount > 0) {
        const cust = fallbackStore.customers.find((c) => c.id === sale.customerId);
        if (cust) {
          cust.currentBalance = Math.max(0, cust.currentBalance - sale.remainingAmount);
        }
      }

      // Revert paid amount from Cash/Bank
      if (sale.paidAmount > 0) {
        const acc = fallbackStore.cashBankAccounts.find((a) => (sale.paymentMethod === "BANK" ? a.type === "BANK" : a.type === "CASH"));
        if (acc) {
          acc.balance -= sale.paidAmount;
        }
      }

      return NextResponse.json({ success: true, data: { sale, reversalReason: reason }, fallback: true });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
