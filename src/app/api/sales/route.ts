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
      const branch = await prisma.branch.findUnique({
        where: { id: branchId },
        select: { id: true, code: true, name: true },
      });
      const isMainBranch = branch?.code === "MAIN" || branch?.name?.toLowerCase().includes("main");
      if (isMainBranch) {
        whereClause.OR = [{ branchId }, { branchId: null }];
      } else {
        whereClause.branchId = branchId;
      }
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
      filtered = filtered.filter((s) => s.branchId === branchId || !s.branchId);
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
    let effectiveBranchId = isLockedToBranch ? activeBranchId : (body.branchId || activeBranchId || null);

    if (!effectiveBranchId) {
      const mainBranch = await prisma.branch.findFirst({
        where: { businessId, code: "MAIN" },
        select: { id: true },
      }) || await prisma.branch.findFirst({
        where: { businessId },
        select: { id: true },
      });
      if (mainBranch) effectiveBranchId = mainBranch.id;
    }

    const createdById = session?.userId || body.createdById || "usr-2";
    const createdByName = session?.name || body.createdByName || "Muhammad Hanif";

    if (body.bulk === true && Array.isArray(body.invoices)) {
      const results: any[] = [];
      for (const inv of body.invoices) {
        const sale = await createAndPostSale({
          ...inv,
          businessId,
          branchId: effectiveBranchId,
          createdById,
          createdByName,
        });
        results.push(sale);
      }
      return NextResponse.json({ success: true, data: results, count: results.length });
    }

    const sale = await createAndPostSale({
      ...body,
      businessId,
      branchId: effectiveBranchId,
      createdById,
      createdByName,
    });

    // Newly created invoices stay in Queue (PENDING) until user transmits them individually or batch
    if (body.directTransmit === true && sale.paymentStatus === "PAID") {
      try {
        const { transmitSaleToFbr } = await import("@/services/fbrService");
        const fbrResult = await transmitSaleToFbr(sale.id);
        return NextResponse.json({
          success: true,
          data: fbrResult.sale || sale,
          fbr: fbrResult,
        });
      } catch (fbrErr) {
        console.warn("FBR direct transmit notification:", fbrErr);
      }
    }

    return NextResponse.json({ success: true, data: sale });
  } catch (error: any) {
    // If PostgreSQL server is offline, apply the exact accounting & stock rules to fallbackStore
    if (error.message?.includes("Can't reach database server") || error.code === "P1001" || !process.env.DATABASE_URL) {
      const businessId = await getActiveBusinessId(req);
      const { branchId: activeBranchId, isLockedToBranch } = await getActiveBranchId(req);
      const effectiveBranchId = isLockedToBranch ? activeBranchId : (body.branchId || activeBranchId || null);
      const branchObj = fallbackStore.branches?.find((b) => b.id === effectiveBranchId);
      const session = await getSession();
      const createdById = session?.userId || body.createdById || "usr-2";
      const createdByName = session?.name || body.createdByName || "Muhammad Hanif";

      if (body.bulk === true && Array.isArray(body.invoices)) {
        const results: any[] = [];
        for (let idx = 0; idx < body.invoices.length; idx++) {
          const inv = body.invoices[idx];
          const saleId = `sale-${Date.now()}-${idx}`;
          const invNum = `INV-2026-${String(fallbackStore.sales.length + 1).padStart(5, "0")}`;
          let subtotal = 0;
          const processedItems = (inv.items || []).map((it: any, i: number) => {
            const prod = fallbackStore.products.find((p) => p.id === it.productId);
            const q = Number(it.quantity || 1);
            const p = Number(it.unitPrice || prod?.sellingPrice || 0);
            const lt = q * p;
            subtotal += lt;
            if (prod) prod.currentStock -= q;
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
          const totalTax = Number(inv.taxAmount || (Number(inv.salesTax || 0) + Number(inv.furtherTax || 0) + Number(inv.extraTax || 0)));
          const posFee = Number(inv.posFee !== undefined ? inv.posFee : 0);
          const total = subtotal - Number(inv.overallDiscount || 0) + totalTax + posFee;
          const paid = Number(inv.paidAmount !== undefined ? inv.paidAmount : total);
          const remaining = Math.max(0, total - paid);
          const paymentStatus = remaining === 0 ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID";
          const fallbackSale = {
            id: saleId,
            businessId,
            branchId: effectiveBranchId,
            invoiceNumber: invNum,
            date: inv.date ? new Date(inv.date) : new Date(),
            customerId: inv.customerId || null,
            customerName: inv.customerName || "Walk-in Customer",
            customerPhone: inv.customerPhone,
            buyerTaxStatus: inv.buyerTaxStatus || "EXEMPT",
            subtotal,
            discountAmount: Number(inv.overallDiscount || 0),
            taxAmount: totalTax,
            totalAmount: total,
            posFee,
            invoiceType: inv.invoiceType || "STANDARD",
            fbrStatus: inv.fbrStatus || "PENDING",
            fbrInvoiceNumber: null,
            fbrQrCode: null,
            paidAmount: paid,
            remainingAmount: remaining,
            paymentStatus,
            paymentMethod: inv.paymentMethod || "CASH",
            notes: inv.notes,
            createdById,
            createdByName,
            items: processedItems,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          fallbackStore.sales.unshift(fallbackSale as any);
          results.push(fallbackSale);
        }
        return NextResponse.json({ success: true, data: results, count: results.length, fallback: true });
      }

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
            creditLimit: 0,
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
      const fbrQr = isFbrDirect ? (body.fbrQrCode || `/verify/fbr?inv=${encodeURIComponent(fbrInvNum || invNum)}&pos=POS-101&amt=${total}`) : null;

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

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    const businessId = await getActiveBusinessId(req);
    const body = await req.json();

    const ids: string[] = body.ids || (body.id ? [body.id] : []);
    const updates = body.updates || body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: "Please provide invoice IDs to bulk update." },
        { status: 400 }
      );
    }

    const editorId = session?.userId || "usr-2";
    const editorName = session?.name || "Administrator";
    const editReason = updates.editReason || "Bulk invoice update by administrator";

    const updateData: any = {
      isEdited: true,
      editCount: { increment: 1 },
      updatedById: editorId,
      updatedByName: editorName,
      editReason,
      updatedAt: new Date(),
    };

    if (updates.date) {
      updateData.date = new Date(updates.date);
    }
    if (updates.customerName) {
      updateData.customerName = updates.customerName;
    }
    if (updates.paymentMethod) {
      updateData.paymentMethod = updates.paymentMethod;
    }
    if (updates.paymentStatus) {
      updateData.paymentStatus = updates.paymentStatus;
    }
    if (updates.fbrStatus) {
      updateData.fbrStatus = updates.fbrStatus;
    }
    if (updates.notes !== undefined) {
      updateData.notes = updates.notes;
    }

    let updatedCount = 0;
    try {
      const res = await prisma.sale.updateMany({
        where: { id: { in: ids }, businessId },
        data: updateData,
      });
      updatedCount = res.count;
    } catch {
      // Fallback in-memory
      for (const id of ids) {
        const s = fallbackStore.sales.find((item) => item.id === id && item.businessId === businessId);
        if (s) {
          if (updates.date) s.date = new Date(updates.date).toISOString();
          if (updates.customerName) s.customerName = updates.customerName;
          if (updates.paymentMethod) s.paymentMethod = updates.paymentMethod;
          if (updates.paymentStatus) s.paymentStatus = updates.paymentStatus;
          if (updates.fbrStatus) s.fbrStatus = updates.fbrStatus;
          if (updates.notes !== undefined) s.notes = updates.notes;
          s.isEdited = true;
          s.editCount = (s.editCount || 0) + 1;
          s.updatedById = editorId;
          s.updatedByName = editorName;
          s.updatedAt = new Date().toISOString();
          s.editReason = editReason;
          updatedCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      updatedCount,
      message: `Successfully updated ${updatedCount} invoices.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update invoices." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    const businessId = await getActiveBusinessId(req);
    const body = await req.json();

    const ids: string[] = body.ids || body.invoiceIds || (body.id ? [body.id] : []);

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: "Please provide one or more invoice IDs to delete." },
        { status: 400 }
      );
    }

    const { deleteMultipleSales } = await import("@/services/salesService");
    const result = await deleteMultipleSales(
      ids,
      businessId,
      session?.userId,
      session?.name
    );

    return NextResponse.json({
      success: result.success,
      deletedCount: result.deletedCount,
      errors: result.errors,
      message: `Successfully deleted ${result.deletedCount} invoices.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to delete invoices." },
      { status: 500 }
    );
  }
}

