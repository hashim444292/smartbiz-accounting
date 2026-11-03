import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveBusinessId, getActiveBranchId } from "@/lib/businessHelper";
import { recordCustomerPayment, recordSupplierPayment } from "@/services/paymentService";
import { fallbackStore, storeAddPayment } from "@/lib/fallbackStore";
import { getSession } from "@/lib/auth";
import { reconcileCashBankBalances, storeReconcileCashBankBalances } from "@/lib/cashBankHelper";

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

    const [payments, accounts, cashBankSummary] = await Promise.all([
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
      reconcileCashBankBalances(prisma, businessId),
    ]);

    const activeAccounts = cashBankSummary?.accounts?.length ? cashBankSummary.accounts : accounts;

    return NextResponse.json({
      success: true,
      data: payments,
      accounts: activeAccounts,
      summary: cashBankSummary,
      branchId,
      isLockedToBranch,
    });
  } catch (error: any) {
    const businessId = await getActiveBusinessId(req);
    const { branchId, isLockedToBranch } = await getActiveBranchId(req);
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    let pays = fallbackStore.payments.filter((p) => p.businessId === businessId);
    if (type) pays = pays.filter((p) => p.type === type);
    if (branchId) pays = pays.filter((p) => p.branchId === branchId);
    const cashBankSummary = storeReconcileCashBankBalances(businessId);
    return NextResponse.json({
      success: true,
      data: pays,
      accounts: cashBankSummary.accounts,
      summary: cashBankSummary,
      branchId,
      isLockedToBranch,
      fallback: true,
    });
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

    const paymentDate = body.date
      ? (() => {
          const raw = String(body.date).trim();
          if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
            const [y, m, d] = raw.split("-").map(Number);
            const now = new Date();
            return new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds());
          }
          return new Date(raw);
        })()
      : new Date();

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
        date: paymentDate,
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
        purchaseId: body.purchaseId,
        allocations: body.allocations,
        createdById,
        createdByName,
        date: paymentDate,
      });
    } else {
      return NextResponse.json({ success: false, error: "Invalid payment type." }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    if (
      error.message?.includes("Can't reach database server") ||
      error.message?.includes("does not exist on the database server") ||
      error.code === "P1001" ||
      error.code === "P1003" ||
      !process.env.DATABASE_URL
    ) {
      const session = await getSession();
      const businessId = await getActiveBusinessId(req);
      const { branchId: activeBranchId, isLockedToBranch } = await getActiveBranchId(req);
      const effectiveBranchId = isLockedToBranch ? activeBranchId : (body.branchId || activeBranchId || null);
      const createdById = session?.userId || body.createdById || "usr-2";
      const createdByName = session?.name || body.createdByName || "Muhammad Hanif";

      const paymentDate = body.date
        ? (() => {
            const raw = String(body.date).trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
              const [y, m, d] = raw.split("-").map(Number);
              const now = new Date();
              return new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds());
            }
            return new Date(raw);
          })()
        : new Date();

      const newPayment = storeAddPayment(
        {
          businessId,
          ...body,
          branchId: effectiveBranchId,
          date: paymentDate,
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
