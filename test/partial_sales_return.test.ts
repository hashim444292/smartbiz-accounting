import { describe, it, expect, beforeEach } from "vitest";
import { fallbackStore } from "@/lib/fallbackStore";
import { signSessionToken } from "@/lib/auth";
import { NextRequest } from "next/server";
import { POST as reverseSaleRoute } from "@/app/api/sales/[id]/reverse/route";
import { GET as getSaleRoute } from "@/app/api/sales/[id]/route";

describe("Partial / Item-wise Sales Return & Restocking Suite", () => {
  const businessId = "biz-101";
  const userId = "usr-1";
  const token = signSessionToken({
    userId,
    name: "Admin Tester",
    email: "admin@smartbiz.com",
    role: "ADMIN",
    businessId,
    businessName: "Test Company",
    companyIds: [businessId],
  });

  beforeEach(() => {
    // Clean fallbackStore
    if (!fallbackStore.sales) fallbackStore.sales = [];
    if (!fallbackStore.inventoryTransactions) fallbackStore.inventoryTransactions = [];
    if (!fallbackStore.journalEntries) fallbackStore.journalEntries = [];
  });

  it("should process partial item-wise return, restock inventory, balance journals, and keep sale POSTED", async () => {
    // 1. Seed two products
    const prod1Id = `prod-ret-1-${Date.now()}`;
    const prod2Id = `prod-ret-2-${Date.now()}`;

    fallbackStore.products.push({
      id: prod1Id,
      businessId,
      name: "Samsung Galaxy A55",
      sku: "SAM-A55",
      costPrice: 500,
      salePrice: 1000,
      currentStock: 20,
    } as any);

    fallbackStore.products.push({
      id: prod2Id,
      businessId,
      name: "Fast Charger 45W",
      sku: "CHG-45W",
      costPrice: 100,
      salePrice: 200,
      currentStock: 50,
    } as any);

    // 2. Seed a customer
    const custId = `cust-ret-${Date.now()}`;
    fallbackStore.customers.push({
      id: custId,
      businessId,
      name: "Tariq Traders",
      currentBalance: 5000,
    } as any);

    // 3. Seed an unstamped sales invoice with 5 units of Prod 1 and 10 units of Prod 2
    // Prod 1: 5 * 1000 = 5000
    // Prod 2: 10 * 200 = 2000
    // Total: 7000. Paid: 3000. Remaining: 4000.
    const saleId = `sale-ret-${Date.now()}`;
    const invoiceNum = `INV-PARTIAL-${Date.now()}`;
    const saleRecord: any = {
      id: saleId,
      businessId,
      invoiceNumber: invoiceNum,
      date: new Date().toISOString(),
      customerId: custId,
      customerName: "Tariq Traders",
      totalAmount: 7000,
      paidAmount: 3000,
      remainingAmount: 4000,
      paymentStatus: "PARTIAL",
      paymentMethod: "CASH",
      status: "POSTED",
      fbrStatus: "NOT_APPLICABLE",
      items: [
        {
          id: `item-1-${Date.now()}`,
          productId: prod1Id,
          productName: "Samsung Galaxy A55",
          quantity: 5,
          unitPrice: 1000,
          costPrice: 500,
          taxRate: 0,
          taxAmount: 0,
          lineTotal: 5000,
        },
        {
          id: `item-2-${Date.now()}`,
          productId: prod2Id,
          productName: "Fast Charger 45W",
          quantity: 10,
          unitPrice: 200,
          costPrice: 100,
          taxRate: 0,
          taxAmount: 0,
          lineTotal: 2000,
        },
      ],
    };
    fallbackStore.sales.push(saleRecord);

    const initialStockProd1 = 20;
    const initialStockProd2 = 50;

    // 4. Request partial return of 2 units of Prod 1 only (0 units of Prod 2)
    // Return value: 2 * 1000 = 2000
    // COGS reversal: 2 * 500 = 1000
    const returnReq = new NextRequest(`http://localhost:3000/api/sales/${saleId}/reverse`, {
      method: "POST",
      headers: {
        "x-business-id": businessId,
        "Content-Type": "application/json",
        cookie: `sb_auth_token=${token}`,
      },
      body: JSON.stringify({
        reason: "Customer Return / Defective - 2 units screen flicker",
        items: [
          {
            itemId: saleRecord.items[0].id,
            productId: prod1Id,
            quantity: 2,
          },
        ],
      }),
    });

    const res = await reverseSaleRoute(returnReq, { params: { id: saleId } });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);

    // 5. Verify stock restoration
    const p1 = fallbackStore.products.find((p) => p.id === prod1Id);
    const p2 = fallbackStore.products.find((p) => p.id === prod2Id);
    expect(p1?.currentStock).toBe(initialStockProd1 + 2); // 20 + 2 = 22
    expect(p2?.currentStock).toBe(initialStockProd2);     // unchanged: 50

    // 6. Verify SALE_RETURN inventory transaction was logged
    const retTx = fallbackStore.inventoryTransactions.find(
      (tx) => tx.referenceId === saleId && tx.productId === prod1Id && tx.type === "SALE_RETURN"
    );
    expect(retTx).toBeDefined();
    expect(retTx?.quantity).toBe(2);

    // 7. Verify double-entry journals
    // a) Sales return journal: Debit 4020 (Rs 2000), Credit 1100 (Rs 2000)
    const retJournal = fallbackStore.journalEntries.find(
      (je) => je.referenceId === saleId && je.lines.some((l: any) => l.accountCode === "4020")
    );
    expect(retJournal).toBeDefined();
    const debit4020 = retJournal?.lines.find((l: any) => l.accountCode === "4020");
    const credit1100 = retJournal?.lines.find((l: any) => l.accountCode === "1100");
    expect(debit4020?.debit).toBe(2000);
    expect(credit1100?.credit).toBe(2000);

    // b) COGS reversal journal: Debit 1200 (Rs 1000), Credit 5010 (Rs 1000)
    const cogsJournal = fallbackStore.journalEntries.find(
      (je) => je.referenceId === saleId && je.lines.some((l: any) => l.accountCode === "1200")
    );
    expect(cogsJournal).toBeDefined();
    const debit1200 = cogsJournal?.lines.find((l: any) => l.accountCode === "1200");
    const credit5010 = cogsJournal?.lines.find((l: any) => l.accountCode === "5010");
    expect(debit1200?.debit).toBe(1000);
    expect(credit5010?.credit).toBe(1000);

    // 8. Verify Sale state remains POSTED (not CANCELLED) with remaining balance reduced
    const updatedSale = fallbackStore.sales.find((s) => s.id === saleId);
    expect(updatedSale?.status).toBe("POSTED");
    expect(updatedSale?.remainingAmount).toBe(2000); // 4000 - 2000 = 2000

    // 9. Verify GET /api/sales/[id] returns enriched returnedQuantity & remainingQuantity
    const getReq = new NextRequest(`http://localhost:3000/api/sales/${saleId}`, {
      headers: { "x-business-id": businessId },
    });
    const getRes = await getSaleRoute(getReq, { params: { id: saleId } });
    expect(getRes.status).toBe(200);
    const getJson = await getRes.json();
    expect(getJson.success).toBe(true);

    const enrichedItem1 = getJson.data.items.find((it: any) => it.productId === prod1Id);
    expect(enrichedItem1.returnedQuantity).toBe(2);
    expect(enrichedItem1.remainingQuantity).toBe(3); // 5 - 2 = 3

    const enrichedItem2 = getJson.data.items.find((it: any) => it.productId === prod2Id);
    expect(enrichedItem2.returnedQuantity).toBe(0);
    expect(enrichedItem2.remainingQuantity).toBe(10); // 10 remaining

    // 10. Process second return of all remaining items: 3 units of Prod 1 and 10 units of Prod 2
    // Value: 3 * 1000 + 10 * 200 = 3000 + 2000 = 5000
    // Remaining due on sale was 2000, so:
    // Receivable reduction = 2000 (remaining balance -> 0)
    // Cash refund = 3000 (customer had paid 3000 upfront)
    const returnReq2 = new NextRequest(`http://localhost:3000/api/sales/${saleId}/reverse`, {
      method: "POST",
      headers: {
        "x-business-id": businessId,
        "Content-Type": "application/json",
        cookie: `sb_auth_token=${token}`,
      },
      body: JSON.stringify({
        reason: "Full remaining batch returned",
        items: [
          { itemId: saleRecord.items[0].id, productId: prod1Id, quantity: 3 },
          { itemId: saleRecord.items[1].id, productId: prod2Id, quantity: 10 },
        ],
      }),
    });

    const res2 = await reverseSaleRoute(returnReq2, { params: { id: saleId } });
    expect(res2.status).toBe(200);

    // 11. Now that 100% of all items are returned, sale status transitions to CANCELLED!
    const fullyReturnedSale = fallbackStore.sales.find((s) => s.id === saleId);
    expect(fullyReturnedSale?.status).toBe("CANCELLED");
    expect(fullyReturnedSale?.remainingAmount).toBe(0);
    expect(fullyReturnedSale?.paidAmount).toBe(0);

    // Stock for both products completely restored
    expect(p1?.currentStock).toBe(initialStockProd1 + 5); // 20 + 5 = 25
    expect(p2?.currentStock).toBe(initialStockProd2 + 10); // 50 + 10 = 60
  }, 60000);
});
