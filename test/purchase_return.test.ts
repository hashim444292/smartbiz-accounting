import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { fallbackStore } from "@/lib/fallbackStore";
import { signSessionToken } from "@/lib/auth";
import { NextRequest } from "next/server";
import { POST as reversePurchaseRoute } from "@/app/api/purchases/[id]/reverse/route";
import { GET as getPurchaseRoute } from "@/app/api/purchases/[id]/route";

describe("Purchase Return & Debit Note Suite", () => {
  const businessId = "biz-pur-ret-101";
  const userId = "usr-pur-1";
  const originalDbUrl = process.env.DATABASE_URL;
  const token = signSessionToken({
    userId,
    name: "Purchase Admin Tester",
    email: "pur_admin@smartbiz.com",
    role: "ADMIN",
    businessId,
    businessName: "Test Company",
    companyIds: [businessId],
  });

  beforeEach(() => {
    delete process.env.DATABASE_URL;
    if (!fallbackStore.purchases) fallbackStore.purchases = [];
    if (!fallbackStore.inventoryTransactions) fallbackStore.inventoryTransactions = [];
    if (!fallbackStore.journalEntries) fallbackStore.journalEntries = [];
    if (!fallbackStore.products) fallbackStore.products = [];
    if (!fallbackStore.suppliers) fallbackStore.suppliers = [];
  });

  afterEach(() => {
    if (originalDbUrl) process.env.DATABASE_URL = originalDbUrl;
  });

  it("should process partial item-wise purchase return, deduct inventory, reduce supplier payable, and balance journals", async () => {
    // 1. Seed two products
    const prod1Id = `prod-pur-1-${Date.now()}`;
    const prod2Id = `prod-pur-2-${Date.now()}`;

    fallbackStore.products.push({
      id: prod1Id,
      businessId,
      name: "Industrial Motor 5HP",
      sku: "MOT-5HP",
      costPrice: 20000,
      salePrice: 25000,
      currentStock: 10,
    } as any);

    fallbackStore.products.push({
      id: prod2Id,
      businessId,
      name: "Copper Wire Spool",
      sku: "COP-SPOOL",
      costPrice: 5000,
      salePrice: 6500,
      currentStock: 20,
    } as any);

    // 2. Seed a supplier
    const supId = `sup-pur-${Date.now()}`;
    fallbackStore.suppliers.push({
      id: supId,
      businessId,
      name: "Al-Rehman Electric Co.",
      currentBalance: 150000,
    } as any);

    // 3. Seed a purchase:
    // Prod 1: 5 * 20,000 = 100,000
    // Prod 2: 10 * 5,000 = 50,000
    // Total: 150,000. Paid: 50,000. Remaining: 100,000.
    const purchaseId = `pur-${Date.now()}`;
    const purchaseNum = `PO-TEST-${Date.now()}`;
    const purchaseRecord: any = {
      id: purchaseId,
      businessId,
      purchaseNumber: purchaseNum,
      date: new Date().toISOString(),
      supplierId: supId,
      supplierName: "Al-Rehman Electric Co.",
      totalAmount: 150000,
      paidAmount: 50000,
      remainingAmount: 100000,
      paymentStatus: "PARTIAL",
      paymentMethod: "CASH",
      status: "COMPLETED",
      items: [
        {
          id: `pur-item-1-${Date.now()}`,
          productId: prod1Id,
          productName: "Industrial Motor 5HP",
          quantity: 5,
          unitCost: 20000,
          lineTotal: 100000,
        },
        {
          id: `pur-item-2-${Date.now()}`,
          productId: prod2Id,
          productName: "Copper Wire Spool",
          quantity: 10,
          unitCost: 5000,
          lineTotal: 50000,
        },
      ],
      notes: "Initial purchase note",
    };
    fallbackStore.purchases.push(purchaseRecord);

    // 4. Return 2 units of Motor (2 * 20,000 = 40,000)
    const returnReq = new NextRequest(
      `http://localhost/api/purchases/${purchaseId}/reverse`,
      {
        method: "POST",
        headers: {
          "x-business-id": businessId,
          "Content-Type": "application/json",
          cookie: `sb_auth_token=${token}`,
        },
        body: JSON.stringify({
          reason: "Defective winding on 2 units",
          items: [
            {
              productId: prod1Id,
              quantity: 2,
            },
          ],
        }),
      }
    );

    const res = await reversePurchaseRoute(returnReq, {
      params: { id: purchaseId },
    } as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.totalReturnedAmount).toBe(40000);
    expect(json.data.isPartialReturn).toBe(true);
    expect(json.data.isAllReturned).toBe(false);

    // 5. Check product currentStock deducted by 2 (10 - 2 = 8)
    const prod1 = fallbackStore.products.find((p) => p.id === prod1Id);
    expect(prod1?.currentStock).toBe(8);

    // 6. Check InventoryTransaction created with type PURCHASE_RETURN
    const tx = fallbackStore.inventoryTransactions.find(
      (t) => t.businessId === businessId && t.type === "PURCHASE_RETURN" && t.productId === prod1Id
    );
    expect(tx).toBeDefined();
    expect(tx?.quantity).toBe(2);

    // 7. Check Supplier balance reduced by 40,000 (150,000 - 40,000 = 110,000)
    const sup = fallbackStore.suppliers.find((s) => s.id === supId);
    expect(sup?.currentBalance).toBe(110000);

    // 8. Check Purchase remainingAmount reduced from 100,000 to 60,000
    const pur = fallbackStore.purchases.find((p) => p.id === purchaseId);
    expect(pur?.remainingAmount).toBe(60000);
    expect(pur?.notes).toContain("Defective winding on 2 units");

    // 9. Check Balanced Journal: Debit 2010 (Payables Reduction) 40,000, Credit 1200 (Inventory Asset) 40,000
    const je = fallbackStore.journalEntries.find(
      (j) => j.referenceNumber === purchaseNum || j.description.includes("Purchase Return")
    );
    expect(je).toBeDefined();
    const debits = je?.lines.reduce((s: number, l: any) => s + (Number(l.debit) || 0), 0);
    const credits = je?.lines.reduce((s: number, l: any) => s + (Number(l.credit) || 0), 0);
    expect(debits).toBe(40000);
    expect(credits).toBe(40000);

    // 10. Verify GET /api/purchases/[id] returns enriched returned amounts
    const getReq = new NextRequest(`http://localhost/api/purchases/${purchaseId}`, {
      headers: {
        "x-business-id": businessId,
        cookie: `sb_auth_token=${token}`,
      },
    });
    const getRes = await getPurchaseRoute(getReq, {
      params: { id: purchaseId },
    } as any);
    const getJson = await getRes.json();
    expect(getJson.success).toBe(true);
    expect(getJson.data.totalReturnedAmount).toBe(40000);

    const item1 = getJson.data.items.find((it: any) => it.productId === prod1Id);
    expect(item1.returnedQuantity).toBe(2);
    expect(item1.remainingQuantity).toBe(3);

    const item2 = getJson.data.items.find((it: any) => it.productId === prod2Id);
    expect(item2.returnedQuantity).toBe(0);
    expect(item2.remainingQuantity).toBe(10);
  });

  it("should prevent returning more than the remaining quantity", async () => {
    const prodId = `prod-over-${Date.now()}`;
    fallbackStore.products.push({
      id: prodId,
      businessId,
      name: "Cable Drum",
      costPrice: 1000,
      salePrice: 1500,
      currentStock: 10,
    } as any);

    const purchaseId = `pur-over-${Date.now()}`;
    fallbackStore.purchases.push({
      id: purchaseId,
      businessId,
      purchaseNumber: `PO-OVER-${Date.now()}`,
      supplierName: "Test Supplier",
      totalAmount: 5000,
      paidAmount: 5000,
      remainingAmount: 0,
      items: [
        {
          id: `item-${Date.now()}`,
          productId: prodId,
          productName: "Cable Drum",
          quantity: 5,
          unitCost: 1000,
          lineTotal: 5000,
        },
      ],
    } as any);

    // Try returning 6 units when only 5 were bought
    const returnReq = new NextRequest(
      `http://localhost/api/purchases/${purchaseId}/reverse`,
      {
        method: "POST",
        headers: {
          "x-business-id": businessId,
          "Content-Type": "application/json",
          cookie: `sb_auth_token=${token}`,
        },
        body: JSON.stringify({
          reason: "Too many",
          items: [{ productId: prodId, quantity: 6 }],
        }),
      }
    );

    const res = await reversePurchaseRoute(returnReq, {
      params: { id: purchaseId },
    } as any);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/Cannot return.*exceeds remaining returnable/i);
  });

  it("should process full return, mark isAllReturned true, and set status to REVERSED", async () => {
    const prodId = `prod-full-${Date.now()}`;
    fallbackStore.products.push({
      id: prodId,
      businessId,
      name: "Water Filtration Cartridge",
      costPrice: 2500,
      salePrice: 3500,
      currentStock: 10,
    } as any);

    const purchaseId = `pur-full-${Date.now()}`;
    fallbackStore.purchases.push({
      id: purchaseId,
      businessId,
      purchaseNumber: `PO-FULL-${Date.now()}`,
      supplierName: "Clean Water Tech",
      totalAmount: 10000,
      paidAmount: 10000,
      remainingAmount: 0,
      items: [
        {
          id: `item-${Date.now()}`,
          productId: prodId,
          productName: "Water Filtration Cartridge",
          quantity: 4,
          unitCost: 2500,
          lineTotal: 10000,
        },
      ],
    } as any);

    const returnReq = new NextRequest(
      `http://localhost/api/purchases/${purchaseId}/reverse`,
      {
        method: "POST",
        headers: {
          "x-business-id": businessId,
          "Content-Type": "application/json",
          cookie: `sb_auth_token=${token}`,
        },
        body: JSON.stringify({
          reason: "Wrong shipment received from vendor",
          items: [{ productId: prodId, quantity: 4 }],
        }),
      }
    );

    const res = await reversePurchaseRoute(returnReq, {
      params: { id: purchaseId },
    } as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.isAllReturned).toBe(true);
    expect(json.data.status).toBe("REVERSED");
    expect(json.data.totalReturnAmount).toBe(10000);

    // Verify product stock deducted by 4 (10 - 4 = 6)
    const prod = fallbackStore.products.find((p) => p.id === prodId);
    expect(prod?.currentStock).toBe(6);
  });
});

