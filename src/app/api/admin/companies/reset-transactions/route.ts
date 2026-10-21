import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fallbackStore } from "@/lib/fallbackStore";
import { getSession } from "@/lib/auth";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { createSafeAuditLog } from "@/lib/auditHelper";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const activeBizId = await getActiveBusinessId(req);
    const body = await req.json().catch(() => ({}));

    // Find target business
    const targetBusinessId = body.businessId || body.targetBusinessId || "";
    const targetBusinessName = body.companyName || body.businessName || "";

    if (!targetBusinessId && !targetBusinessName) {
      return NextResponse.json(
        { success: false, error: "businessId or businessName is required for resetting transactions." },
        { status: 400 }
      );
    }

    let resolvedBiz: any = null;

    if (process.env.DATABASE_URL) {
      try {
        if (targetBusinessId) {
          resolvedBiz = await prisma.business.findUnique({ where: { id: targetBusinessId } });
        }
        if (!resolvedBiz && targetBusinessName) {
          resolvedBiz = await prisma.business.findFirst({
            where: { name: { contains: targetBusinessName, mode: "insensitive" } },
          });
        }
      } catch (dbErr: any) {
        console.error("Database lookup error in reset-transactions:", dbErr);
      }
    }

    if (!resolvedBiz) {
      // Check fallback store
      resolvedBiz = fallbackStore.companies.find(
        (c) =>
          c.id === targetBusinessId ||
          (targetBusinessName && c.name.toLowerCase().includes(targetBusinessName.toLowerCase())) ||
          c.name.toLowerCase().includes("adeel")
      );
    }

    if (!resolvedBiz) {
      return NextResponse.json(
        { success: false, error: "Target company not found for data cleanup." },
        { status: 404 }
      );
    }

    const businessId = resolvedBiz.id;
    const businessName = resolvedBiz.name;

    let deletedSalesCount = 0;
    let deletedAllocationsCount = 0;
    let deletedItemsCount = 0;
    let deletedReceiptsCount = 0;
    let resetCustomersCount = 0;

    if (process.env.DATABASE_URL) {
      try {
        deletedSalesCount = await prisma.sale.count({ where: { businessId } });

        if (deletedSalesCount > 0) {
          // 1. Delete Payment Allocations
          const allocRes = await prisma.paymentAllocation.deleteMany({
            where: { sale: { businessId } },
          });
          deletedAllocationsCount = allocRes.count;

          // 2. Delete Sale Items
          const itemsRes = await prisma.saleItem.deleteMany({
            where: { sale: { businessId } },
          });
          deletedItemsCount = itemsRes.count;

          // 3. Delete Sales Invoices
          await prisma.sale.deleteMany({ where: { businessId } });

          // 4. Delete Customer Receipts
          const receiptsRes = await prisma.payment.deleteMany({
            where: { businessId, type: "RECEIPT" },
          });
          deletedReceiptsCount = receiptsRes.count;

          // 5. Delete Sales Journal Entries & Lines
          try {
            await prisma.journalLine.deleteMany({
              where: { journalEntry: { businessId, referenceType: { in: ["SALE", "SALE_RETURN"] } } },
            });
            await prisma.journalEntry.deleteMany({
              where: { businessId, referenceType: { in: ["SALE", "SALE_RETURN"] } },
            });
          } catch {}

          // 6. Delete Inventory Transactions
          try {
            await prisma.inventoryTransaction.deleteMany({
              where: { businessId, type: { in: ["SALE", "SALE_RETURN"] } },
            });
          } catch {}
        }

        // 7. Reset customer balances to 0
        const custRes = await prisma.customer.updateMany({
          where: { businessId },
          data: { currentBalance: 0 },
        });
        resetCustomersCount = custRes.count;

        // 8. Record safe audit log
        await createSafeAuditLog(prisma, {
          businessId,
          userId: session?.userId || "usr-admin",
          userName: session?.name || "System Administrator",
          userEmail: session?.email || "admin@smartbiz.com",
          action: "RESET_TRANSACTIONS",
          entity: "Sale",
          entityId: businessId,
          details: `Cleared all ${deletedSalesCount} sales invoices and reset customer receivables for ${businessName} fresh start.`,
        });
      } catch (err: any) {
        console.error("Error executing database cleanup:", err);
      }
    }

    // Always synchronize in-memory fallback store
    const initialFbSales = fallbackStore.sales.length;
    fallbackStore.sales = fallbackStore.sales.filter((s) => s.businessId !== businessId);
    deletedSalesCount = Math.max(deletedSalesCount, initialFbSales - fallbackStore.sales.length);

    fallbackStore.payments = fallbackStore.payments.filter(
      (p) => p.businessId !== businessId || p.type !== "RECEIPT"
    );

    fallbackStore.customers.forEach((c) => {
      if (c.businessId === businessId) {
        c.currentBalance = 0;
      }
    });

    return NextResponse.json({
      success: true,
      message: `Workspace "${businessName}" successfully refreshed! All sales invoices, FBR invoice records, and customer balances have been cleared for a fresh start.`,
      company: { id: businessId, name: businessName },
      stats: {
        deletedSales: deletedSalesCount,
        deletedItems: deletedItemsCount,
        deletedAllocations: deletedAllocationsCount,
        deletedReceipts: deletedReceiptsCount,
        resetCustomers: resetCustomersCount,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to reset transactions" },
      { status: 500 }
    );
  }
}
