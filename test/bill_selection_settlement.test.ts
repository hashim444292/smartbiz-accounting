import { describe, it, expect } from "vitest";
import { fallbackStore } from "@/lib/fallbackStore";
import { POST as createPaymentRoute } from "@/app/api/payments/route";
import { GET as getPurchasesRoute } from "@/app/api/purchases/route";
import { GET as getSalesRoute } from "@/app/api/sales/route";
import { NextRequest } from "next/server";

describe("Supplier Disbursement & Customer Receipt Specific Bill Selection & Settlement", () => {
  const businessId = "biz-bill-test";
  const supplierId = "sup-test-101";
  const customerId = "cust-test-101";

  // Prepopulate test supplier and customer in fallbackStore
  fallbackStore.suppliers.push({
    id: supplierId,
    businessId,
    name: "Apex Electronics Supplier",
    phone: "0300-1112233",
    currentBalance: 50000,
    createdAt: new Date().toISOString(),
  } as any);

  fallbackStore.customers.push({
    id: customerId,
    businessId,
    name: "Prime Retail Customer",
    phone: "0311-9988776",
    currentBalance: 35000,
    createdAt: new Date().toISOString(),
  } as any);

  const purchaseBill1 = {
    id: "purch-bill-001",
    businessId,
    supplierId,
    date: "2026-10-15T10:00:00.000Z",
    invoiceNumber: "INV-SUP-9001",
    totalAmount: 30000,
    paidAmount: 10000,
    remainingAmount: 20000,
    paymentStatus: "PARTIAL",
    items: [],
  };

  const purchaseBill2 = {
    id: "purch-bill-002",
    businessId,
    supplierId,
    date: "2026-10-18T10:00:00.000Z",
    invoiceNumber: "INV-SUP-9002",
    totalAmount: 30000,
    paidAmount: 0,
    remainingAmount: 30000,
    paymentStatus: "UNPAID",
    items: [],
  };

  fallbackStore.purchases.push(purchaseBill1 as any, purchaseBill2 as any);

  const saleInvoice1 = {
    id: "sale-inv-001",
    businessId,
    customerId,
    date: "2026-10-16T12:00:00.000Z",
    invoiceNumber: "SINV-2026-001",
    totalAmount: 35000,
    paidAmount: 15000,
    remainingAmount: 20000,
    paymentStatus: "PARTIAL",
    items: [],
  };

  fallbackStore.sales.push(saleInvoice1 as any);

  it("should filter outstanding purchase bills by supplierId and paymentStatus", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/purchases?supplierId=${supplierId}&paymentStatus=UNPAID,PARTIAL`,
      {
        method: "GET",
        headers: { "x-business-id": businessId },
      }
    );

    const res = await getPurchasesRoute(req);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.length).toBe(2);
    expect(json.data.map((p: any) => p.id)).toContain("purch-bill-001");
    expect(json.data.map((p: any) => p.id)).toContain("purch-bill-002");
  });

  it("should settle a specific purchase bill on disbursement and update its status to PAID", async () => {
    const req = new NextRequest("http://localhost:3000/api/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-business-id": businessId,
      },
      body: JSON.stringify({
        type: "DISBURSEMENT",
        supplierId,
        purchaseId: "purch-bill-001",
        amount: 20000,
        paymentMethod: "CASH",
        referenceNumber: "DISB-CHK-001",
        notes: "Clearing purchase bill #1 completely",
      }),
    });

    const res = await createPaymentRoute(req);
    const json = await res.json();

    expect(json.success).toBe(true);

    // Verify bill 1 is fully PAID
    const settledBill = fallbackStore.purchases.find((p) => p.id === "purch-bill-001");
    expect(settledBill).toBeDefined();
    expect(settledBill?.paidAmount).toBe(30000);
    expect(settledBill?.remainingAmount).toBe(0);
    expect(settledBill?.paymentStatus).toBe("PAID");

    // Verify bill 2 was untouched
    const bill2 = fallbackStore.purchases.find((p) => p.id === "purch-bill-002");
    expect(bill2?.remainingAmount).toBe(30000);
    expect(bill2?.paymentStatus).toBe("UNPAID");
  });

  it("should filter outstanding sales invoices by customerId and paymentStatus", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/sales?customerId=${customerId}&paymentStatus=UNPAID,PARTIAL`,
      {
        method: "GET",
        headers: { "x-business-id": businessId },
      }
    );

    const res = await getSalesRoute(req);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.length).toBe(1);
    expect(json.data[0].id).toBe("sale-inv-001");
    expect(json.data[0].remainingAmount).toBe(20000);
  });

  it("should settle a specific sales invoice on receipt and update its status to PAID", async () => {
    const req = new NextRequest("http://localhost:3000/api/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-business-id": businessId,
      },
      body: JSON.stringify({
        type: "RECEIPT",
        customerId,
        saleId: "sale-inv-001",
        amount: 20000,
        paymentMethod: "CASH",
        referenceNumber: "REC-CASH-001",
        notes: "Clearing sales invoice #1 completely",
      }),
    });

    const res = await createPaymentRoute(req);
    const json = await res.json();

    expect(json.success).toBe(true);

    // Verify sale invoice is fully PAID
    const settledSale = fallbackStore.sales.find((s) => s.id === "sale-inv-001");
    expect(settledSale).toBeDefined();
    expect(settledSale?.paidAmount).toBe(35000);
    expect(settledSale?.remainingAmount).toBe(0);
    expect(settledSale?.paymentStatus).toBe("PAID");
  });
});
