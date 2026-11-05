import { NextRequest, NextResponse } from "next/server";
import { reverseSale } from "@/services/salesService";
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
  let reason = "Customer return / cancellation";
  let returnItems: any[] | undefined = undefined;
  try {
    const body = await req.json();
    if (body?.reason) reason = body.reason;
    if (Array.isArray(body?.items) && body.items.length > 0) {
      returnItems = body.items;
    }
  } catch {}

  // 4. Verify target sale existence and tenant ownership prior to any mutation
  if (process.env.DATABASE_URL) {
    try {
      const sale = await prisma.sale.findUnique({
        where: { id },
        include: { business: true },
      });

      if (!sale) {
        return NextResponse.json({ success: false, error: "Sale not found" }, { status: 404 });
      }

      if (!isSuperAdmin && sale.businessId !== businessId) {
        return NextResponse.json(
          { success: false, error: "Access Denied: You do not have permission to reverse this sale." },
          { status: 403 }
        );
      }

      const isStampedDI =
        sale.fbrStatus === "SUCCESS" &&
        Boolean(
          (sale.business as any)?.integrationType === "DIGITAL_INVOICING" ||
          (typeof sale.fbrInvoiceNumber === "string" && sale.fbrInvoiceNumber.includes("DI"))
        );

      if (isStampedDI) {
        return NextResponse.json(
          { success: false, error: "Credit Notes and Reversals are not permitted for stamped FBR Digital Invoices." },
          { status: 400 }
        );
      }

      // If this is an FBR POS stamped invoice, issue an official FBR Credit Note (InvoiceType 3 with refUsin)
      let cnResult: any = null;
      const isPosStamped = sale.fbrStatus === "SUCCESS" && Boolean(sale.fbrInvoiceNumber) && !isStampedDI;
      if (isPosStamped) {
        try {
          const { transmitFbrCreditNote } = await import("@/services/fbrService");
          cnResult = await transmitFbrCreditNote(id, reason, { refUsin: sale.fbrInvoiceNumber || undefined });
        } catch (cnErr: any) {
          console.warn("[REVERSE_SALE] FBR Credit Note transmission notice:", cnErr?.message);
        }
      }

      const result = await reverseSale(id, reason, session.userId, returnItems);
      return NextResponse.json({
        success: true,
        data: result,
        creditNote: cnResult,
        isPosCreditNote: isPosStamped,
      });
    } catch (error: any) {
      if (!error.message?.includes("Can't reach database server") && error.code !== "P1001") {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      }
    }
  }

  // 5. Fallback Store verification and mutation
  const fbSale = fallbackStore.sales.find((s) => s.id === id);
  if (!fbSale) {
    return NextResponse.json({ success: false, error: "Sale not found" }, { status: 404 });
  }

  if (!isSuperAdmin && fbSale.businessId !== businessId) {
    return NextResponse.json(
      { success: false, error: "Access Denied: You do not have permission to reverse this sale." },
      { status: 403 }
    );
  }

  const isFbStampedDI =
    fbSale.fbrStatus === "SUCCESS" &&
    Boolean(fbSale.fbrInvoiceNumber?.includes("DI") || (fbSale as any)?.integrationType === "DIGITAL_INVOICING");

  if (isFbStampedDI) {
    return NextResponse.json(
      { success: false, error: "Credit Notes and Reversals are not permitted for stamped FBR Digital Invoices." },
      { status: 400 }
    );
  }

  // Determine items to return in fallback store
  const itemsToProcess = (returnItems && returnItems.length > 0)
    ? returnItems
    : (fbSale.items || []).map((it: any) => ({
        itemId: it.id,
        productId: it.productId,
        quantity: Number(it.quantity || 0),
      }));

  let totalReturnAmount = 0;
  let totalCOGS = 0;

  for (const reqItem of itemsToProcess) {
    const saleItem = (fbSale.items || []).find((it: any) => it.id === reqItem.itemId || it.productId === reqItem.productId);
    if (!saleItem) continue;
    const qty = Number(reqItem.quantity || 0);
    if (qty <= 0) continue;

    const unitPrice = Number(saleItem.unitPrice || 0);
    const taxRate = Number(saleItem.taxRate || 0);
    const costPrice = Number(saleItem.costPrice || 0);

    const lineTotal = qty * unitPrice * (1 + taxRate / 100);
    totalReturnAmount += lineTotal;
    totalCOGS += qty * costPrice;

    // Restore stock
    const prod = fallbackStore.products.find((p) => p.id === saleItem.productId);
    if (prod) {
      prod.currentStock = Number(prod.currentStock || 0) + qty;
    }

    // Record inventory transaction
    if (!fallbackStore.inventoryTransactions) fallbackStore.inventoryTransactions = [];
    fallbackStore.inventoryTransactions.push({
      id: `it-ret-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      productId: saleItem.productId,
      type: "SALE_RETURN",
      quantity: qty,
      unitPrice,
      totalPrice: lineTotal,
      referenceType: "SALE",
      referenceId: fbSale.id,
      notes: `Sales Return: ${qty} units for Sale #${fbSale.invoiceNumber}`,
      createdAt: new Date(),
    });
  }

  const currentRem = Number(fbSale.remainingAmount || 0);
  const receivableReduction = Math.min(currentRem, totalReturnAmount);
  const cashRefund = totalReturnAmount - receivableReduction;

  if (fbSale.customerId && receivableReduction > 0) {
    const cust = fallbackStore.customers.find((c) => c.id === fbSale.customerId);
    if (cust) {
      cust.currentBalance = Math.max(0, Number(cust.currentBalance || 0) - receivableReduction);
    }
  }

  fbSale.remainingAmount = Math.max(0, currentRem - receivableReduction);
  if (cashRefund > 0) {
    fbSale.paidAmount = Math.max(0, Number(fbSale.paidAmount || 0) - cashRefund);
    const acc = fallbackStore.cashBankAccounts.find((a) => (fbSale.paymentMethod === "BANK" ? a.type === "BANK" : a.type === "CASH"));
    if (acc) {
      acc.balance = Number(acc.balance || 0) - cashRefund;
    }
  }

  // Calculate cumulative returns across all items to check if invoice is fully returned
  const allTxs = (fallbackStore.inventoryTransactions || []).filter(
    (tx) => tx.referenceId === fbSale.id && tx.type === "SALE_RETURN"
  );
  const retByProd: Record<string, number> = {};
  for (const tx of allTxs) {
    retByProd[tx.productId] = (retByProd[tx.productId] || 0) + Math.abs(Number(tx.quantity || 0));
  }

  const isAllReturned = (fbSale.items || []).every((it: any) => {
    const totalRet = retByProd[it.productId] || 0;
    return totalRet >= Number(it.quantity || 0);
  });

  if (isAllReturned) {
    fbSale.status = "CANCELLED";
  }

  if (!(fbSale as any).returnHistory) (fbSale as any).returnHistory = [];
  (fbSale as any).returnHistory.push({
    returnedAt: new Date().toISOString(),
    reason,
    returnAmount: totalReturnAmount,
    items: itemsToProcess.map((it: any) => ({
      productId: it.productId,
      quantity: Number(it.quantity || 0),
    })),
  });

  if (fbSale.fbrStatus === "SUCCESS" && fbSale.fbrInvoiceNumber) {
    (fbSale as any).fbrCreditNote = {
      status: "CONFIRMED",
      cnInvoiceNumber: `CN-${Date.now().toString().slice(-6)}`,
      reason,
      date: new Date().toISOString(),
    };
  }

  // Record Journal Entry for Sales Return in fallbackStore
  if (!fallbackStore.journalEntries) fallbackStore.journalEntries = [];
  const bizId = fbSale.businessId;

  // 1. Sales Return Journal: Debit 4020, Credit 1010/1100
  fallbackStore.journalEntries.unshift({
    id: `je-rev-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    businessId: bizId,
    date: new Date().toISOString(),
    description: `Sales Return for Sale #${fbSale.invoiceNumber} (${reason}) - Total: Rs ${totalReturnAmount.toFixed(2)}`,
    referenceType: "SALE_RETURN",
    referenceId: fbSale.id,
    createdById: session.userId,
    lines: [
      { accountCode: "4020", debit: totalReturnAmount, credit: 0, description: "Sales Returns" },
      ...(cashRefund > 0 ? [{ accountCode: "1010", debit: 0, credit: cashRefund, description: "Cash/Bank Refund" }] : []),
      ...(receivableReduction > 0 ? [{ accountCode: "1100", debit: 0, credit: receivableReduction, description: "Receivables Reversal" }] : []),
    ],
  });

  // 2. COGS Reversal Journal: Debit 1200 (Inventory Asset), Credit 5010 (COGS)
  if (totalCOGS > 0) {
    fallbackStore.journalEntries.unshift({
      id: `je-cogs-rev-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      businessId: bizId,
      date: new Date().toISOString(),
      description: `COGS Reversal for Return on Sale #${fbSale.invoiceNumber} - Rs ${totalCOGS.toFixed(2)}`,
      referenceType: "SALE_RETURN",
      referenceId: fbSale.id,
      createdById: session.userId,
      lines: [
        { accountCode: "1200", debit: totalCOGS, credit: 0, description: "Merchandise Inventory Restock" },
        { accountCode: "5010", debit: 0, credit: totalCOGS, description: "Cost of Goods Sold Reversal" },
      ],
    });
  }

  return NextResponse.json({
    success: true,
    data: { sale: fbSale, reversalReason: reason, totalReturnAmount, isAllReturned },
    isPosCreditNote: fbSale.fbrStatus === "SUCCESS" && Boolean(fbSale.fbrInvoiceNumber),
    fallback: true,
  });
}
