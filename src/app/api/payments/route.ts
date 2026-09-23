import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveBusinessId, getActiveBranchId } from "@/lib/businessHelper";
import { recordCustomerPayment, recordSupplierPayment } from "@/services/paymentService";
import { fallbackStore, storeAddPayment } from "@/lib/fallbackStore";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const businessId = await getActiveBusinessId(req);
    const { branchId, isLockedToBranch } = await getActiveBranchId(req);
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

    const where: any = { businessId };
    if (type) where.type = type;
    if (branchId) where.branchId = branchId;

    const [payments, accounts] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          customer: true,
          supplier: true,
          account: true,
          targetAccount: true,
          allocations: true,
          branch: true,
        },
        orderBy: { date: "desc" },
        take: 100,
      }),
      prisma.cashBankAccount.findMany({
        where: { businessId, isActive: true },
        orderBy: { name: "asc" },
      }),
    ]);

    return NextResponse.json({ success: true, data: payments, accounts, branchId, isLockedToBranch });
  } catch (error: any) {
    const businessId = await getActiveBusinessId(req);
    const { branchId, isLockedToBranch } = await getActiveBranchId(req);
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    let pays = fallbackStore.payments.filter((p) => p.businessId === businessId);
    if (type) pays = pays.filter((p) => p.type === type);
    if (branchId) pays = pays.filter((p) => p.branchId === branchId);
    const accounts = fallbackStore.cashBankAccounts.filter((a) => a.businessId === businessId);
    return NextResponse.json({ success: true, data: pays, accounts, branchId, isLockedToBranch, fallback: true });
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

    let result;
    if (body.type === "RECEIPT") {
      result = await recordCustomerPayment({
        businessId,
        branchId: effectiveBranchId,
        customerId: body.customerId,
        amount: body.amount,
        paymentMethod: body.paymentMethod,
        accountId: body.accountId,
        referenceNumber: body.referenceNumber,
        notes: body.notes,
        saleId: body.saleId,
        allocations: body.allocations,
        createdById,
        createdByName,
      });
    } else if (body.type === "DISBURSEMENT") {
      result = await recordSupplierPayment({
        businessId,
        branchId: effectiveBranchId,
        supplierId: body.supplierId,
        amount: body.amount,
        paymentMethod: body.paymentMethod,
        accountId: body.accountId,
        referenceNumber: body.referenceNumber,
        notes: body.notes,
        allocations: body.allocations,
        createdById,
        createdByName,
      });
    } else {
      return NextResponse.json({ success: false, error: "Invalid payment type." }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    if (error.message?.includes("Can't reach database server") || error.code === "P1001" || !process.env.DATABASE_URL) {
      const session = await getSession();
      const businessId = await getActiveBusinessId(req);
      const { branchId: activeBranchId, isLockedToBranch } = await getActiveBranchId(req);
      const effectiveBranchId = isLockedToBranch ? activeBranchId : (body.branchId || activeBranchId || null);
      const createdById = session?.userId || body.createdById || "usr-2";
      const createdByName = session?.name || body.createdByName || "Muhammad Hanif";

      const newPayment = storeAddPayment(
        {
          businessId,
          ...body,
          branchId: effectiveBranchId,
          createdById,
          createdByName,
        },
        { userId: createdById, name: createdByName, email: session?.email }
      );

      return NextResponse.json({ success: true, data: newPayment, fallback: true });
    }

    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
