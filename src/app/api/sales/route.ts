import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAndPostSale } from "@/services/salesService";
import { getActiveBusinessId, getActiveBranchId } from "@/lib/businessHelper";
import { fallbackStore } from "@/lib/fallbackStore";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const businessId = await getActiveBusinessId(req);
    const { branchId, isLockedToBranch } = await getActiveBranchId(req);

    const whereClause: any = { businessId };
    if (branchId) {
      whereClause.branchId = branchId;
    }

    const sales = await prisma.sale.findMany({
      where: whereClause,
      include: { customer: true, items: true, branch: true },
      orderBy: { date: "desc" },
    });
    return NextResponse.json({ success: true, data: sales, branchId, isLockedToBranch });
  } catch (err) {
    const businessId = await getActiveBusinessId(req);
    const { branchId, isLockedToBranch } = await getActiveBranchId(req);
    let filtered = fallbackStore.sales.filter((s) => s.businessId === businessId);
    if (branchId) {
      filtered = filtered.filter((s) => s.branchId === branchId);
    }
    return NextResponse.json({ success: true, data: filtered, branchId, isLockedToBranch, fallback: true });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  try {
    const session = await getSession();
    const businessId = await getActiveBusinessId(req);
    const { branchId: activeBranchId, isLockedToBranch } = await getActiveBranchId(req);
    const effectiveBranchId = isLockedToBranch ? activeBranchId : (body.branchId || activeBranchId || null);
    const createdById = session?.userId || body.createdById || "usr-2";
    const createdByName = session?.name || body.createdByName || "Muhammad Hanif";

    const sale = await createAndPostSale({
      ...body,
      businessId,
      branchId: effectiveBranchId,
      createdById,
      createdByName,
    });

    // Check if company has FBR auto-sync enabled
    try {
      const { getFbrConfig, transmitSaleToFbr } = await import("@/services/fbrService");
      const fbrConfig = await getFbrConfig(businessId);
      if ((body.autoSyncFbr || fbrConfig.autoSync) && sale.paymentStatus === "PAID") {
        const fbrResult = await transmitSaleToFbr(sale.id);
        return NextResponse.json({
          success: true,
          data: fbrResult.sale || sale,
          fbr: fbrResult,
        });
      }
    } catch (fbrErr) {
      console.warn("FBR auto-sync notification:", fbrErr);
    }

    return NextResponse.json({ success: true, data: sale });
  } catch (error: any) {
    // If PostgreSQL server is offline, apply the exact accounting & stock rules to fallbackStore
    if (error.message?.includes("Can't reach database server") || error.code === "P1001" || !process.env.DATABASE_URL) {
      const businessId = await getActiveBusinessId(req);
      const { branchId: activeBranchId, isLockedToBranch } = await getActiveBranchId(req);
      const effectiveBranchId = isLockedToBranch ? activeBranchId : (body.branchId || activeBranchId || null);
      const branchObj = fallbackStore.branches?.find((b) => b.id === effectiveBranchId);
      const saleId = `sale-${Date.now()}`;
      const invNum = `INV-2026-${String(fallbackStore.sales.length + 1).padStart(5, "0")}`;

      let subtotal = 0;
      const processedItems = (body.items || []).map((it: any, i: number) => {
        const prod = fallbackStore.products.find((p) => p.id === it.productId);
        const q = Number(it.quantity || 1);
        const p = Number(it.unitPrice || prod?.sellingPrice || 0);
        const lt = q * p;
        subtotal += lt;

        // Deduct inventory
        if (prod) {
          prod.currentStock -= q;
        }

        return {
          id: `si-${saleId}-${i}`,
          productId: it.productId,
          productName: prod?.name || "Merchandise",
          quantity: q,
          unitPrice: p,
          lineTotal: lt,
          costPrice: prod?.averageCost || 0,
        };
      });

      const totalTax = Number(body.taxAmount || (Number(body.salesTax || 0) + Number(body.furtherTax || 0) + Number(body.extraTax || 0)));
      const posFee = Number(body.posFee !== undefined ? body.posFee : 0);
      const total = subtotal - Number(body.overallDiscount || 0) + totalTax + posFee;
      const paid = Number(body.paidAmount !== undefined ? body.paidAmount : total);
      const remaining = Math.max(0, total - paid);

      // Customer receivable
      let targetCustomerId = body.customerId;
      if (body.customerId) {
        const cust = fallbackStore.customers.find((c) => c.id === body.customerId);
        if (cust) cust.currentBalance += remaining;
      } else if (remaining > 0 && body.customerName && !body.customerName.toLowerCase().startsWith("walk in (walk in)")) {
        // Auto-link or auto-create customer in directory so their receivable ledger tracks them!
        let cust = fallbackStore.customers.find(
          (c) => c.businessId === businessId && c.name.toLowerCase() === body.customerName.toLowerCase()
        );
        if (!cust) {
          cust = {
            id: `cust-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            businessId,
            name: body.customerName,
            businessName: null,
            phone: body.customerPhone || null,
            email: null,
            address: null,
            taxStatus: body.buyerTaxStatus || "EXEMPT",
            currentBalance: remaining,
            creditLimit: 500000,
            notes: `Auto-registered from Walk-in sale invoice #${invNum}`,
            createdAt: new Date().toISOString(),
          };
          fallbackStore.customers.unshift(cust);
        } else {
          cust.currentBalance += remaining;
          if (body.customerPhone && !cust.phone) cust.phone = body.customerPhone;
        }
        targetCustomerId = cust.id;
      }

      // Cash/Bank
      if (paid > 0) {
        const acc = fallbackStore.cashBankAccounts.find(
          (a) => a.businessId === businessId && (!effectiveBranchId || a.branchId === effectiveBranchId) && (body.paymentMethod === "BANK" ? a.type === "BANK" : a.type === "CASH")
        ) || fallbackStore.cashBankAccounts.find(
          (a) => a.businessId === businessId && (body.paymentMethod === "BANK" ? a.type === "BANK" : a.type === "CASH")
        );
        if (acc) acc.balance += paid;
      }

      const isFbrDirect = body.fbrStatus === "SUCCESS";
      const fbrInvNum = isFbrDirect ? (body.fbrInvoiceNumber || `FBR-POS-2026-${Math.floor(100000 + Math.random() * 900000)}`) : null;
      const fbrQr = isFbrDirect ? (body.fbrQrCode || `https://e.fbr.gov.pk/verify?inv=${encodeURIComponent(invNum)}&pos=POS-101&amt=${total}`) : null;

      const newSale = {
        id: saleId,
        businessId,
        branchId: effectiveBranchId,
        branchName: branchObj?.name || null,
        invoiceNumber: invNum,
        date: body.date || new Date().toISOString(),
        customerName: body.customerName || "Walk-in Customer",
        customerId: targetCustomerId || body.customerId || null,
        subtotal,
        discountAmount: Number(body.overallDiscount || 0),
        taxAmount: totalTax,
        salesTax: Number(body.salesTax || 0),
        furtherTax: Number(body.furtherTax || 0),
        extraTax: Number(body.extraTax || 0),
        posFee,
        totalAmount: total,
        paidAmount: paid,
        remainingAmount: remaining,
        paymentStatus: remaining === 0 ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID",
        paymentMethod: body.paymentMethod || "CASH",
        status: "POSTED",
        fbrStatus: body.fbrStatus || "PENDING",
        fbrInvoiceNumber: fbrInvNum,
        fbrQrCode: fbrQr,
        items: processedItems,
        createdById: body.createdById || "usr-2",
        createdByName: body.createdByName || "Muhammad Hanif",
        updatedById: null,
        updatedByName: null,
        isEdited: false,
        editCount: 0,
        editReason: null,
        createdAt: body.date || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      fallbackStore.sales.unshift(newSale);

      if (!fallbackStore.auditLogs) fallbackStore.auditLogs = [];
      fallbackStore.auditLogs.unshift({
        id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        businessId,
        userId: newSale.createdById,
        userName: newSale.createdByName,
        branchId: effectiveBranchId,
        action: "CREATE_SALE",
        entity: "Sale",
        entityId: newSale.id,
        details: `Generated Sale Invoice #${invNum} for ${newSale.customerName} - Rs ${total.toLocaleString()}`,
        createdAt: new Date().toISOString(),
      });

      return NextResponse.json({ success: true, data: newSale, fallback: true });
    }

    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
