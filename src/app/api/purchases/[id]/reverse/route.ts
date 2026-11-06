import { NextRequest, NextResponse } from "next/server";
import { reversePurchase } from "@/services/purchaseService";
import { fallbackStore } from "@/lib/fallbackStore";
import { getSession } from "@/lib/auth";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  // 1. Authenticate request
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Access Denied: Authentication required. Please sign in." },
      { status: 401 }
    );
  }

  // 2. Resolve authorized active business
  const businessId = await getActiveBusinessId(req);
  const isSuperAdmin = session.role === "SUPER_ADMIN";

  // 3. Parse optional reason and partial return items
  let reason = "Merchandise returned to supplier";
  let returnItems: any[] | undefined = undefined;
  try {
    const body = await req.json();
    if (body?.reason) reason = body.reason;
    if (Array.isArray(body?.items) && body.items.length > 0) {
      returnItems = body.items;
    }
  } catch {}

  // 4. Verify target purchase existence and tenant ownership prior to any mutation
  if (process.env.DATABASE_URL) {
    try {
      const purchase = await prisma.purchase.findUnique({
        where: { id },
        include: { business: true },
      });

      if (!purchase) {
        return NextResponse.json({ success: false, error: "Purchase bill not found" }, { status: 404 });
      }

      if (!isSuperAdmin && purchase.businessId !== businessId) {
        return NextResponse.json(
          { success: false, error: "Access Denied: You do not have permission to return this purchase." },
          { status: 403 }
        );
      }

      const result = await reversePurchase(id, reason, session.userId, returnItems);
      return NextResponse.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (!error.message?.includes("Can't reach database server") && error.code !== "P1001") {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      }
    }
  }

  // 5. Fallback Store verification and mutation
  const fbPurchase = fallbackStore.purchases.find((p) => p.id === id);
  if (!fbPurchase) {
    return NextResponse.json({ success: false, error: "Purchase bill not found" }, { status: 404 });
  }

  if (!isSuperAdmin && fbPurchase.businessId !== businessId) {
    return NextResponse.json(
      { success: false, error: "Access Denied: You do not have permission to return this purchase." },
      { status: 403 }
    );
  }

  // Determine items to return in fallback store
  const itemsToProcess =
    returnItems && returnItems.length > 0
      ? returnItems
      : (fbPurchase.items || []).map((it: any) => ({
          itemId: it.id,
          productId: it.productId,
          quantity: Number(it.quantity || 0),
        }));

  // Calculate prior returns per item in fallback store
  const priorTxs = (fallbackStore.inventoryTransactions || []).filter(
    (tx) => tx.referenceId === fbPurchase.id && tx.type === "PURCHASE_RETURN"
  );
  const priorReturnedByProd: Record<string, number> = {};
  for (const tx of priorTxs) {
    priorReturnedByProd[tx.productId] = (priorReturnedByProd[tx.productId] || 0) + Math.abs(Number(tx.quantity || 0));
  }

  // Validate items and limits
  for (const reqItem of itemsToProcess) {
    const purItem = (fbPurchase.items || []).find(
      (it: any) => it.id === reqItem.itemId || it.productId === reqItem.productId
    );
    if (!purItem) {
      return NextResponse.json(
        { success: false, error: `Item not found on this purchase bill: ${reqItem.productId || reqItem.itemId}` },
        { status: 400 }
      );
    }
    const qty = Number(reqItem.quantity || 0);
    if (qty <= 0) continue;
    const priorQty = priorReturnedByProd[purItem.productId] || 0;
    const remainingReturnable = Math.max(0, Number(purItem.quantity || 0) - priorQty);
    if (qty > remainingReturnable) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot return ${qty} units of ${purItem.productName || "item"}; exceeds remaining returnable quantity (${remainingReturnable}).`,
        },
        { status: 400 }
      );
    }
  }

  let totalReturnAmount = 0;

  for (const reqItem of itemsToProcess) {
    const purItem = (fbPurchase.items || []).find(
      (it: any) => it.id === reqItem.itemId || it.productId === reqItem.productId
    );
    if (!purItem) continue;
    const qty = Number(reqItem.quantity || 0);
    if (qty <= 0) continue;

    const unitCost = Number(purItem.unitCost || 0);
    const taxRate = Number(purItem.taxRate || 0);

    const lineTotal = qty * unitCost * (1 + taxRate / 100);
    totalReturnAmount += lineTotal;

    // Deduct stock on return to supplier
    const prod = fallbackStore.products.find((p) => p.id === purItem.productId);
    if (prod) {
      prod.currentStock = Math.max(0, Number(prod.currentStock || 0) - qty);
    }

    // Record inventory transaction
    if (!fallbackStore.inventoryTransactions) fallbackStore.inventoryTransactions = [];
    fallbackStore.inventoryTransactions.push({
      id: `it-pur-ret-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      businessId,
      branchId: fbPurchase.branchId || null,
      productId: purItem.productId,
      type: "PURCHASE_RETURN",
      quantity: qty,
      unitPrice: unitCost,
      totalPrice: lineTotal,
      referenceType: "PURCHASE_RETURN",
      referenceId: fbPurchase.id,
      notes: `Purchase Return: ${qty} units for Bill #${fbPurchase.purchaseNumber}`,
      createdAt: new Date(),
    });
  }

  const currentRem = Number(fbPurchase.remainingAmount || 0);
  const payableReduction = Math.min(currentRem, totalReturnAmount);
  const cashRefund = Math.max(0, totalReturnAmount - payableReduction);

  if (fbPurchase.supplierId && payableReduction > 0) {
    const sup = fallbackStore.suppliers.find((s) => s.id === fbPurchase.supplierId);
    if (sup) {
      sup.currentBalance = Math.max(0, Number(sup.currentBalance || 0) - payableReduction);
    }
  }

  fbPurchase.remainingAmount = Math.max(0, currentRem - payableReduction);
  if (cashRefund > 0) {
    fbPurchase.paidAmount = Math.max(0, Number(fbPurchase.paidAmount || 0) - cashRefund);
    const acc = fallbackStore.cashBankAccounts.find(
      (a) => (fbPurchase.paymentMethod === "BANK" ? a.type === "BANK" : a.type === "CASH")
    );
    if (acc) {
      acc.balance = Number(acc.balance || 0) + cashRefund;
    }
    if (!fallbackStore.payments) fallbackStore.payments = [];
    fallbackStore.payments.push({
      id: `pay-pur-ret-${Date.now()}`,
      businessId,
      branchId: fbPurchase.branchId || null,
      type: "RECEIPT",
      partyType: "SUPPLIER",
      supplierId: fbPurchase.supplierId,
      partyName: fbPurchase.supplierName,
      amount: cashRefund,
      paymentMethod: fbPurchase.paymentMethod || "CASH",
      referenceNumber: `DN-${fbPurchase.purchaseNumber}`,
      notes: `Cash Refund from ${fbPurchase.supplierName} for Purchase Return #${fbPurchase.purchaseNumber}`,
      createdAt: new Date(),
    });
  }

  // Calculate cumulative returns across all items to check if purchase bill is fully returned
  const allTxs = (fallbackStore.inventoryTransactions || []).filter(
    (tx) => tx.referenceId === fbPurchase.id && tx.type === "PURCHASE_RETURN"
  );
  const retByProd: Record<string, number> = {};
  for (const tx of allTxs) {
    retByProd[tx.productId] = (retByProd[tx.productId] || 0) + Math.abs(Number(tx.quantity || 0));
  }

  const isAllReturned = (fbPurchase.items || []).every((it: any) => {
    const totalRet = retByProd[it.productId] || 0;
    return totalRet >= Number(it.quantity || 0);
  });

  const returnRecord = {
    returnId: `DN-${Date.now().toString().slice(-6)}`,
    date: new Date().toISOString(),
    reason,
    totalAmount: totalReturnAmount,
    payableReduction,
    cashRefund,
    isAllReturned,
    items: itemsToProcess.map((it: any) => ({
      productId: it.productId,
      quantity: Number(it.quantity || 0),
    })),
  };

  if (!(fbPurchase as any).returnHistory) (fbPurchase as any).returnHistory = [];
  (fbPurchase as any).returnHistory.push(returnRecord);

  fbPurchase.notes = JSON.stringify({
    returnHistory: (fbPurchase as any).returnHistory,
    lastReturnAt: new Date().toISOString(),
    lastReturnReason: reason,
    isAllReturned,
  });

  // Record Journal Entry for Purchase Return in fallbackStore
  if (!fallbackStore.journalEntries) fallbackStore.journalEntries = [];
  const bizId = fbPurchase.businessId;

  // Purchase Return Journal: Debit 2010 (Payables), Debit 1010 (Cash Refund), Credit 1200 (Inventory Asset)
  fallbackStore.journalEntries.unshift({
    id: `je-pur-ret-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    businessId: bizId,
    date: new Date().toISOString(),
    description: `Purchase Return / Debit Note for Bill #${fbPurchase.purchaseNumber} (${reason}) - Total: Rs ${totalReturnAmount.toFixed(2)}`,
    referenceType: "PURCHASE_RETURN",
    referenceId: fbPurchase.id,
    createdById: session.userId,
    lines: [
      ...(payableReduction > 0
        ? [{ accountCode: "2010", debit: payableReduction, credit: 0, description: "Accounts Payable Reduction" }]
        : []),
      ...(cashRefund > 0
        ? [{ accountCode: "1010", debit: cashRefund, credit: 0, description: "Cash Refund from Supplier" }]
        : []),
      { accountCode: "1200", debit: 0, credit: totalReturnAmount, description: "Merchandise Inventory Outward" },
    ],
  });

  return NextResponse.json({
    success: true,
    data: {
      status: isAllReturned ? "REVERSED" : "PARTIALLY_RETURNED",
      purchaseId: fbPurchase.id,
      purchaseNumber: fbPurchase.purchaseNumber,
      totalReturnAmount,
      totalReturnedAmount: totalReturnAmount,
      payableReduction,
      cashRefund,
      isPartialReturn: !isAllReturned,
      isAllReturned,
      returnRecord,
    },
  });
}
