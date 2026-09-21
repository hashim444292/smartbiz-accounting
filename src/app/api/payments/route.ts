import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { recordCustomerPayment, recordSupplierPayment } from "@/services/paymentService";
import { fallbackStore } from "@/lib/fallbackStore";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const businessId = await getActiveBusinessId(req);
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

    const where: any = { businessId };
    if (type) where.type = type;

    const payments = await prisma.payment.findMany({
      where,
      include: {
        customer: true,
        supplier: true,
        account: true,
        targetAccount: true,
        allocations: true,
      },
      orderBy: { date: "desc" },
      take: 100,
    });

    return NextResponse.json({ success: true, data: payments });
  } catch (error: any) {
    const businessId = await getActiveBusinessId(req);
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    let pays = fallbackStore.payments.filter((p) => p.businessId === businessId);
    if (type) pays = pays.filter((p) => p.type === type);
    return NextResponse.json({ success: true, data: pays, fallback: true });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  try {
    const businessId = await getActiveBusinessId(req);

    let result;
    if (body.type === "RECEIPT") {
      result = await recordCustomerPayment({
        businessId,
        customerId: body.customerId,
        amount: body.amount,
        paymentMethod: body.paymentMethod,
        accountId: body.accountId,
        referenceNumber: body.referenceNumber,
        notes: body.notes,
        saleId: body.saleId,
        allocations: body.allocations,
      });
    } else if (body.type === "DISBURSEMENT") {
      result = await recordSupplierPayment({
        businessId,
        supplierId: body.supplierId,
        amount: body.amount,
        paymentMethod: body.paymentMethod,
        accountId: body.accountId,
        referenceNumber: body.referenceNumber,
        notes: body.notes,
        allocations: body.allocations,
      });
    } else {
      return NextResponse.json({ success: false, error: "Invalid payment type." }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    const businessId = await getActiveBusinessId(req);
    const amt = Number(body.amount || 0);
    const isReceipt = body.type === "RECEIPT";

    // Adjust customer / supplier balance
    let partyName = "";
    let targetCustId = body.customerId;

    if (isReceipt) {
      if (body.saleId && !targetCustId) {
        const matchedSale = fallbackStore.sales.find((s) => s.id === body.saleId && s.businessId === businessId);
        if (matchedSale) targetCustId = matchedSale.customerId;
      }

      if (targetCustId) {
        const cust = fallbackStore.customers.find((c) => c.id === targetCustId && c.businessId === businessId);
        if (cust) {
          cust.currentBalance = Math.max(0, cust.currentBalance - amt);
          partyName = cust.name;
        }
      }

      // Allocate cash across sales
      let cashToAllocate = amt;

      if (body.saleId) {
        // Direct single-sale settlement
        const s = fallbackStore.sales.find((sale) => sale.id === body.saleId && sale.businessId === businessId);
        if (s) {
          const rem = Number(s.remainingAmount !== undefined ? s.remainingAmount : (Number(s.totalAmount) - Number(s.paidAmount || 0)));
          const payThis = Math.min(cashToAllocate, rem);
          s.paidAmount = Number(s.paidAmount || 0) + payThis;
          s.remainingAmount = Math.max(0, rem - payThis);
          s.paymentStatus = s.remainingAmount === 0 ? "PAID" : "PARTIAL";
          cashToAllocate -= payThis;
        }
      } else if (body.allocations && body.allocations.length > 0) {
        // Explicit allocations array
        for (const alloc of body.allocations) {
          const s = fallbackStore.sales.find((sale) => sale.id === alloc.saleId && sale.businessId === businessId);
          if (s) {
            const a = Number(alloc.amount || 0);
            s.paidAmount = Number(s.paidAmount || 0) + a;
            s.remainingAmount = Math.max(0, Number(s.remainingAmount || 0) - a);
            s.paymentStatus = s.remainingAmount === 0 ? "PAID" : "PARTIAL";
          }
        }
      } else if (targetCustId) {
        // FIFO Auto-Allocation across customer's oldest pending invoices
        const customerPendingSales = fallbackStore.sales
          .filter((s) => s.customerId === targetCustId && s.businessId === businessId && s.paymentStatus !== "PAID")
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        for (const s of customerPendingSales) {
          if (cashToAllocate <= 0) break;
          const rem = Number(s.remainingAmount !== undefined ? s.remainingAmount : (Number(s.totalAmount) - Number(s.paidAmount || 0)));
          if (rem <= 0) continue;
          const payThis = Math.min(cashToAllocate, rem);
          s.paidAmount = Number(s.paidAmount || 0) + payThis;
          s.remainingAmount = Math.max(0, rem - payThis);
          s.paymentStatus = s.remainingAmount === 0 ? "PAID" : "PARTIAL";
          cashToAllocate -= payThis;
        }
      }
    } else if (!isReceipt && body.supplierId) {
      const sup = fallbackStore.suppliers.find((s) => s.id === body.supplierId && s.businessId === businessId);
      if (sup) {
        sup.currentBalance = Math.max(0, sup.currentBalance - amt);
        partyName = sup.name;
      }
    }

    // Adjust Cash/Bank account balance
    const isBank = body.paymentMethod === "BANK";
    const acc = fallbackStore.cashBankAccounts.find(
      (a) => a.businessId === businessId && (isBank ? a.type === "BANK" : a.type === "CASH")
    );
    if (acc) {
      if (isReceipt) acc.balance += amt;
      else acc.balance -= amt;
    }

    const newPayment = {
      id: `pay-${Date.now()}`,
      businessId,
      type: body.type,
      date: body.date || new Date().toISOString(),
      partyName: partyName || (isReceipt ? "Customer" : "Supplier"),
      customerId: targetCustId,
      supplierId: body.supplierId,
      amount: amt,
      paymentMethod: body.paymentMethod || "CASH",
      referenceNumber: body.referenceNumber || `REF-${Date.now().toString().slice(-6)}`,
      notes: body.notes,
    };

    fallbackStore.payments.unshift(newPayment);
    return NextResponse.json({ success: true, data: newPayment, fallback: true });
  }
}
