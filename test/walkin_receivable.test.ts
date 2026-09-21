import { describe, it, expect } from "vitest";
import { fallbackStore } from "@/lib/fallbackStore";
import { POST as createSaleRoute } from "@/app/api/sales/route";
import { NextRequest } from "next/server";

describe("Walk-in Customer Partial/Credit Receivable Tracking", () => {
  const businessId = "biz-101";

  it("should not create a receivable customer record for full cash walk-in sales", async () => {
    const initialCustomerCount = fallbackStore.customers.filter((c) => c.businessId === businessId).length;

    const req = new NextRequest("http://localhost:3000/api/sales", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-business-id": businessId,
      },
      body: JSON.stringify({
        date: new Date().toISOString(),
        customerName: "Walk in (Walk in)",
        customerId: null,
        buyerTaxStatus: "EXEMPT",
        items: [
          {
            productId: "prod-101",
            productName: "Laptop Core i7 12th Gen",
            quantity: 1,
            unitPrice: 5000,
            discount: 0,
            taxRate: 0,
          },
        ],
        overallDiscount: 0,
        paidAmount: 5000,
        paymentMethod: "CASH",
      }),
    });

    const res = await createSaleRoute(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.data.paymentStatus).toBe("PAID");
    expect(data.data.remainingAmount).toBe(0);

    const postCustomerCount = fallbackStore.customers.filter((c) => c.businessId === businessId).length;
    expect(postCustomerCount).toBe(initialCustomerCount);
  });

  it("should auto-register a walk-in customer in customers ledger when sale has remaining balance", async () => {
    const walkInBuyerName = "Tariq Mahmood (Walk-in)";
    const walkInBuyerPhone = "0321-9876543";
    const saleTotal = 15000;
    const paidAmount = 5000;
    const expectedRemaining = 10000;

    const req = new NextRequest("http://localhost:3000/api/sales", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-business-id": businessId,
      },
      body: JSON.stringify({
        date: new Date().toISOString(),
        customerName: walkInBuyerName,
        customerPhone: walkInBuyerPhone,
        customerId: null,
        buyerTaxStatus: "EXEMPT",
        items: [
          {
            productId: "prod-101",
            productName: "Dell Latitude 5420",
            quantity: 1,
            unitPrice: saleTotal,
            discount: 0,
            taxRate: 0,
          },
        ],
        overallDiscount: 0,
        paidAmount: paidAmount,
        paymentMethod: "CASH",
      }),
    });

    const res = await createSaleRoute(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.data.remainingAmount).toBe(expectedRemaining);
    expect(data.data.paymentStatus).toBe("PARTIAL");
    expect(data.data.customerId).toBeTruthy();

    // Verify customer exists in fallbackStore.customers
    const autoCreatedCustomer = fallbackStore.customers.find(
      (c) => c.businessId === businessId && c.name === walkInBuyerName
    );
    expect(autoCreatedCustomer).toBeDefined();
    expect(autoCreatedCustomer?.phone).toBe(walkInBuyerPhone);
    expect(autoCreatedCustomer?.currentBalance).toBe(expectedRemaining);
    expect(data.data.customerId).toBe(autoCreatedCustomer?.id);
  });

  it("should accumulate balance on existing walk-in customer record for subsequent credit sales", async () => {
    const walkInBuyerName = "Tariq Mahmood (Walk-in)";
    const existingCust = fallbackStore.customers.find(
      (c) => c.businessId === businessId && c.name === walkInBuyerName
    );
    expect(existingCust).toBeDefined();
    const prevBalance = existingCust!.currentBalance;

    const additionalCredit = 3000;
    const req = new NextRequest("http://localhost:3000/api/sales", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-business-id": businessId,
      },
      body: JSON.stringify({
        date: new Date().toISOString(),
        customerName: walkInBuyerName,
        customerId: null,
        buyerTaxStatus: "EXEMPT",
        items: [
          {
            productId: "prod-102",
            productName: "Wireless Mouse",
            quantity: 1,
            unitPrice: additionalCredit,
            discount: 0,
            taxRate: 0,
          },
        ],
        overallDiscount: 0,
        paidAmount: 0,
        paymentMethod: "CREDIT",
      }),
    });

    const res = await createSaleRoute(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.data.remainingAmount).toBe(additionalCredit);
    expect(data.data.paymentStatus).toBe("UNPAID");

    // Check that balance accumulated rather than creating duplicate customer
    const updatedCust = fallbackStore.customers.find(
      (c) => c.businessId === businessId && c.name === walkInBuyerName
    );
    expect(updatedCust?.currentBalance).toBe(prevBalance + additionalCredit);
    expect(data.data.customerId).toBe(updatedCust?.id);
  });
});
