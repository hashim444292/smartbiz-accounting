import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { fallbackStore, storeUpdateSale } from "@/lib/fallbackStore";
import { getSession } from "@/lib/auth";
import { createSafeAuditLog } from "@/lib/auditHelper";
import { enrichCustomer } from "@/lib/customerHelper";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  try {
    const businessId = await getActiveBusinessId(req);

    const sale = await prisma.sale.findFirst({
      where: { id, businessId },
      include: {
        customer: true,
        business: {
          select: {
            id: true,
            name: true,
            ownerName: true,
            ntn: true,
            strn: true,
            phone: true,
            email: true,
            address: true,
            city: true,
            country: true,
            defaultHsCode: true,
            defaultUom: true,
          },
        },
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, uom: true, unit: true, hsCode: true },
            },
          },
        },
        branch: true,
      },
    });

    if (!sale) {
      return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
    }

    let customer = sale.customer ? enrichCustomer(sale.customer) : null;
    if (!customer && (sale.customerId || sale.customerName)) {
      if (sale.customerId) {
        try {
          const found = await prisma.customer.findUnique({ where: { id: sale.customerId } });
          if (found) customer = enrichCustomer(found);
        } catch {}
      }
      if (!customer && sale.customerName && sale.customerName !== "Walk-in Retail Customer") {
        try {
          const found = await prisma.customer.findFirst({
            where: { businessId, name: { equals: sale.customerName, mode: "insensitive" } },
          });
          if (found) customer = enrichCustomer(found);
        } catch {}
      }
    }

    // Inspect sale.notes for fbrMeta
    let fbrMeta: any = null;
    if (sale.notes && typeof sale.notes === "string" && sale.notes.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(sale.notes);
        fbrMeta = parsed.fbrMeta || parsed;
      } catch {}
    }

    if (customer && fbrMeta) {
      const metaNtn = fbrMeta.customerNtn || fbrMeta.buyerNTN || fbrMeta.buyerNtn || fbrMeta.ntn;
      const metaCnic = fbrMeta.customerCnic || fbrMeta.buyerCNIC || fbrMeta.buyerCnic || fbrMeta.cnic;
      const metaStrn = fbrMeta.customerStrn || fbrMeta.buyerSTRN || fbrMeta.buyerStrn || fbrMeta.strn;
      if (!customer.ntn && metaNtn) {
        customer.ntn = metaNtn;
        customer.taxStatus = "REGISTERED";
      }
      if (!customer.cnic && metaCnic) {
        customer.cnic = metaCnic;
      }
      if (!customer.strn && metaStrn) {
        customer.strn = metaStrn;
      }
    } else if (!customer && fbrMeta) {
      const metaNtn = fbrMeta.customerNtn || fbrMeta.buyerNTN || fbrMeta.buyerNtn || fbrMeta.ntn;
      const metaCnic = fbrMeta.customerCnic || fbrMeta.buyerCNIC || fbrMeta.buyerCnic || fbrMeta.cnic;
      const metaStrn = fbrMeta.customerStrn || fbrMeta.buyerSTRN || fbrMeta.buyerStrn || fbrMeta.strn;
      if (metaNtn || metaCnic || fbrMeta.buyerAddress) {
        customer = {
          name: sale.customerName,
          address: fbrMeta.buyerAddress || fbrMeta.customerAddress || null,
          ntn: metaNtn || "",
          cnic: metaCnic || "",
          strn: metaStrn || "",
          taxStatus: metaNtn || fbrMeta.buyerRegistrationType === "Registered" ? "REGISTERED" : "UNREGISTERED",
        };
      }
    }

    return NextResponse.json({ success: true, data: { ...sale, customer } });
  } catch {
    const businessId = await getActiveBusinessId(req);
    const sale = fallbackStore.sales.find((s) => s.id === id && s.businessId === businessId);

    if (!sale) {
      return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
    }

    let customer = sale.customer ? enrichCustomer(sale.customer) : null;
    if (!customer && (sale.customerId || sale.customerName)) {
      const found = fallbackStore.customers.find(
        (c) => (sale.customerId && c.id === sale.customerId) || (c.businessId === businessId && c.name?.toLowerCase() === sale.customerName?.toLowerCase())
      );
      if (found) customer = enrichCustomer(found);
    }

    let fbrMeta: any = null;
    if (sale.notes && typeof sale.notes === "string" && sale.notes.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(sale.notes);
        fbrMeta = parsed.fbrMeta || parsed;
      } catch {}
    }

    if (customer && fbrMeta) {
      const metaNtn = fbrMeta.customerNtn || fbrMeta.buyerNTN || fbrMeta.buyerNtn || fbrMeta.ntn;
      const metaCnic = fbrMeta.customerCnic || fbrMeta.buyerCNIC || fbrMeta.buyerCnic || fbrMeta.cnic;
      const metaStrn = fbrMeta.customerStrn || fbrMeta.buyerSTRN || fbrMeta.buyerStrn || fbrMeta.strn;
      if (!customer.ntn && metaNtn) {
        customer.ntn = metaNtn;
        customer.taxStatus = "REGISTERED";
      }
      if (!customer.cnic && metaCnic) {
        customer.cnic = metaCnic;
      }
      if (!customer.strn && metaStrn) {
        customer.strn = metaStrn;
      }
    }

    const business = fallbackStore.companies.find((c) => c.id === businessId);
    return NextResponse.json({ success: true, data: { ...sale, customer, business }, fallback: true });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const body = await req.json();

  try {
    const session = await getSession();
    const businessId = await getActiveBusinessId(req);
    const editorId = session?.userId || "usr-2";
    const editorName = session?.name || "Administrator";
    const editorEmail = session?.email || "admin@smartbiz.com";
    const editReason = body.editReason || "Invoice details modified by administrator";

    const existing = await prisma.sale.findFirst({
      where: { id, businessId },
      include: { items: true },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
    }

    const newTotal = body.totalAmount !== undefined ? Number(body.totalAmount) : Number(existing.totalAmount);
    const newPaid = body.paidAmount !== undefined ? Number(body.paidAmount) : Number(existing.paidAmount);
    const newRemaining = Math.max(0, newTotal - newPaid);

    let newPaymentStatus = body.paymentStatus;
    if (!newPaymentStatus) {
      if (newPaid >= newTotal && newTotal > 0) newPaymentStatus = "PAID";
      else if (newPaid > 0) newPaymentStatus = "PARTIAL";
      else newPaymentStatus = "UNPAID";
    }

    const previousSnapshot = {
      date: existing.date,
      customerName: existing.customerName,
      totalAmount: existing.totalAmount.toString(),
      paidAmount: existing.paidAmount.toString(),
      paymentStatus: existing.paymentStatus,
      paymentMethod: existing.paymentMethod,
      fbrInvoiceNumber: existing.fbrInvoiceNumber,
      notes: existing.notes,
    };

    const updateData: any = {
      customerName: body.customerName !== undefined ? body.customerName : existing.customerName,
      notes: body.notes !== undefined ? body.notes : existing.notes,
      paymentMethod: body.paymentMethod !== undefined ? body.paymentMethod : existing.paymentMethod,
      paymentStatus: newPaymentStatus,
      totalAmount: newTotal,
      paidAmount: newPaid,
      remainingAmount: newRemaining,
      isEdited: true,
      editCount: { increment: 1 },
      updatedById: editorId,
      updatedByName: editorName,
      editReason,
      updatedAt: new Date(),
    };

    if (body.date) {
      updateData.date = new Date(body.date);
    }
    if (body.dueDate !== undefined) {
      updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    }
    if (body.discountAmount !== undefined) {
      updateData.discountAmount = Number(body.discountAmount);
    }
    if (body.fbrStatus !== undefined) {
      updateData.fbrStatus = body.fbrStatus;
    }
    if (body.fbrInvoiceNumber !== undefined) {
      updateData.fbrInvoiceNumber = body.fbrInvoiceNumber;
      if (body.fbrInvoiceNumber) {
        updateData.fbrQrCode = `/verify/fbr?inv=${encodeURIComponent(body.fbrInvoiceNumber)}&pos=${encodeURIComponent(existing.branchId || "POS-101")}&amt=${newTotal}`;
      }
    }

    const updatedSale = await prisma.$transaction(async (tx) => {
      const updated = await tx.sale.update({
        where: { id },
        data: updateData,
        include: { customer: true, items: true, branch: true },
      });

      await createSafeAuditLog(tx, {
        businessId,
        userId: editorId,
        userName: editorName,
        userEmail: editorEmail,
        branchId: existing.branchId,
        action: "UPDATE_SALE",
        entity: "Sale",
        entityId: id,
        details: `Modified Sale Invoice #${existing.invoiceNumber} (Reason: ${editReason})`,
        changes: JSON.stringify({
          previous: previousSnapshot,
          updated: {
            date: updated.date,
            customerName: updated.customerName,
            totalAmount: updated.totalAmount.toString(),
            paidAmount: updated.paidAmount.toString(),
            paymentStatus: updated.paymentStatus,
            paymentMethod: updated.paymentMethod,
            fbrInvoiceNumber: updated.fbrInvoiceNumber,
            notes: updated.notes,
          },
        }),
      });

      return updated;
    });

    return NextResponse.json({ success: true, data: updatedSale });
  } catch {
    const session = await getSession();
    const updated = storeUpdateSale(
      id,
      body,
      {
        userId: session?.userId,
        name: session?.name,
        email: session?.email,
      },
      body.editReason
    );

    if (!updated) {
      return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updated, fallback: true });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  try {
    const session = await getSession();
    const businessId = await getActiveBusinessId(req);
    const { deleteSale } = await import("@/services/salesService");

    const result = await deleteSale(
      id,
      businessId,
      session?.userId,
      session?.name
    );

    return NextResponse.json({
      success: true,
      message: `Invoice #${result.invoiceNumber} deleted successfully.`,
      data: result,
    });
  } catch (err: any) {
    try {
      const businessId = await getActiveBusinessId(req);
      const { storeDeleteSale } = await import("@/lib/fallbackStore");
      let removed = storeDeleteSale(id, businessId);
      if (!removed) {
        removed = storeDeleteSale(id);
      }

      if (removed) {
        return NextResponse.json({
          success: true,
          message: `Invoice #${removed.invoiceNumber} deleted successfully.`,
          fallback: true,
        });
      }
    } catch (fallbackErr: any) {
      const isFiscal = fallbackErr.message?.includes("fiscalized") || fallbackErr.message?.includes("FBR");
      return NextResponse.json(
        { success: false, error: fallbackErr.message || "Failed to delete invoice." },
        { status: isFiscal ? 403 : 400 }
      );
    }

    const isFiscalizedError = err.message?.includes("fiscalized") || err.message?.includes("FBR");
    return NextResponse.json(
      { success: false, error: err.message || "Failed to delete invoice." },
      { status: isFiscalizedError ? 403 : 400 }
    );
  }
}

