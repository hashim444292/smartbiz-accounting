import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=================================================");
  console.log(" Starting Adeel Textile Transaction Data Cleanup");
  console.log(" Date:", new Date().toISOString());
  console.log("=================================================");

  // Find business matching Adeel
  const adeelBiz = await prisma.business.findFirst({
    where: {
      OR: [
        { name: { contains: "Adeel", mode: "insensitive" } },
        { name: { contains: "Adeel Textile", mode: "insensitive" } },
      ],
    },
  });

  if (!adeelBiz) {
    console.log("⚠️ No business matching 'Adeel' found in database. Exiting safely.");
    return;
  }

  const businessId = adeelBiz.id;
  console.log(`🎯 Identified Target Business: "${adeelBiz.name}" (ID: ${businessId})`);

  // Count existing records before deletion
  const salesCount = await prisma.sale.count({ where: { businessId } });
  console.log(`📊 Current Sales Count: ${salesCount}`);

  if (salesCount === 0) {
    console.log("✨ No sales invoices found for Adeel Textile. Workspace is already completely fresh!");
  } else {
    // 1. Delete PaymentAllocations targeting Adeel Textile sales
    const allocationsDeleted = await prisma.paymentAllocation.deleteMany({
      where: {
        sale: { businessId },
      },
    });
    console.log(`🗑️ Deleted ${allocationsDeleted.count} Payment Allocations`);

    // 2. Delete Sale Items
    const itemsDeleted = await prisma.saleItem.deleteMany({
      where: {
        sale: { businessId },
      },
    });
    console.log(`🗑️ Deleted ${itemsDeleted.count} Sale Line Items`);

    // 3. Delete Sales Invoices
    const salesDeleted = await prisma.sale.deleteMany({
      where: { businessId },
    });
    console.log(`🗑️ Deleted ${salesDeleted.count} Sales Invoices`);

    // 4. Delete Customer Receipts (Payment records)
    const receiptsDeleted = await prisma.payment.deleteMany({
      where: {
        businessId,
        type: "RECEIPT",
      },
    });
    console.log(`🗑️ Deleted ${receiptsDeleted.count} Customer Receipts`);

    // 5. Delete Journal Lines & Journal Entries from sales
    try {
      const jLinesDeleted = await prisma.journalLine.deleteMany({
        where: {
          journalEntry: {
            businessId,
            referenceType: { in: ["SALE", "SALE_RETURN"] },
          },
        },
      });
      const jEntriesDeleted = await prisma.journalEntry.deleteMany({
        where: {
          businessId,
          referenceType: { in: ["SALE", "SALE_RETURN"] },
        },
      });
      console.log(`🗑️ Deleted ${jEntriesDeleted.count} Sales Journal Entries (${jLinesDeleted.count} lines)`);
    } catch (jErr) {
      console.log("ℹ️ Journal entries clean skipped:", jErr.message);
    }

    // 6. Delete Inventory Transactions for sales
    try {
      const invTxDeleted = await prisma.inventoryTransaction.deleteMany({
        where: {
          businessId,
          type: { in: ["SALE", "SALE_RETURN"] },
        },
      });
      console.log(`🗑️ Deleted ${invTxDeleted.count} Sales Inventory Transactions`);
    } catch (invErr) {
      console.log("ℹ️ Inventory transactions clean skipped:", invErr.message);
    }

    // 7. Reset all customer balances to 0 for Adeel Textile
    const customersReset = await prisma.customer.updateMany({
      where: { businessId },
      data: {
        currentBalance: 0,
      },
    });
    console.log(`🔄 Reset currentBalance to Rs 0 for ${customersReset.count} customers`);

    // 8. Log audit trail
    try {
      await prisma.auditLog.create({
        data: {
          businessId,
          action: "FRESH_START_CLEANUP",
          entity: "Sale",
          details: `Successfully cleared all ${salesCount} sales invoices, customer receipts, and ledger allocations for Adeel Textile upon user request.`,
        },
      });
      console.log("📝 Recorded AuditLog entry for fresh start.");
    } catch {}
  }

  console.log("=================================================");
  console.log("🎉 Adeel Textile Workspace Cleaned Successfully!");
  console.log("=================================================");
}

main()
  .catch((err) => {
    console.error("❌ Error cleaning Adeel Textile data:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
