import { NextRequest, NextResponse } from "next/server";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { transferFunds } from "@/services/paymentService";
import { fallbackStore } from "@/lib/fallbackStore";

export async function POST(req: NextRequest) {
  const body = await req.json();

  try {
    const businessId = await getActiveBusinessId();

    const transfer = await transferFunds({
      businessId,
      fromAccountId: body.fromAccountId,
      toAccountId: body.toAccountId,
      amount: body.amount,
      referenceNumber: body.referenceNumber,
      notes: body.notes,
    });

    return NextResponse.json({ success: true, data: transfer });
  } catch (error: any) {
    if (error.message?.includes("Can't reach database server") || error.code === "P1001" || !process.env.DATABASE_URL) {
      const amt = Number(body.amount || 0);
      const fromAcc = fallbackStore.cashBankAccounts.find((a) => a.id === body.fromAccountId);
      const toAcc = fallbackStore.cashBankAccounts.find((a) => a.id === body.toAccountId);

      if (fromAcc && fromAcc.balance < amt) {
        return NextResponse.json({ success: false, error: "Insufficient funds in source account." }, { status: 400 });
      }

      if (fromAcc) fromAcc.balance -= amt;
      if (toAcc) toAcc.balance += amt;

      const newTransfer = {
        id: `transfer-${Date.now()}`,
        amount: amt,
        fromAccountId: body.fromAccountId,
        toAccountId: body.toAccountId,
        referenceNumber: body.referenceNumber || `TRF-${Date.now()}`,
        notes: body.notes,
        date: new Date().toISOString(),
      };

      return NextResponse.json({ success: true, data: newTransfer, fallback: true });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
