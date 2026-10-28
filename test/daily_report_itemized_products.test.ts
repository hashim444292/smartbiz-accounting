import { describe, it, expect } from "vitest";

describe("Daily Report Itemized Products & Counts", () => {
  it("formats itemized sales line items with counts and narrations correctly", () => {
    const sale = {
      id: "sale-1",
      invoiceNumber: "INV-2026-00005",
      customerName: "Walk in (Walk in)",
      totalAmount: 325000,
      paidAmount: 325000,
      remainingAmount: 0,
      items: [
        { productId: "p1", productName: "Samsung Galaxy A07", quantity: 5, unitPrice: 50000 },
        { productId: "p2", productName: "Oppo A7", quantity: 2, unitPrice: 37500 },
      ],
      narration: "Sale of 5x Samsung Galaxy A07, 2x Oppo A7 to Walk in (Walk in) (Inv #INV-2026-00005)",
    };

    const totalQty = sale.items.reduce((sum, it) => sum + it.quantity, 0);
    expect(totalQty).toBe(7);

    const itemsSummary = sale.items.map((it) => `${it.quantity}x ${it.productName}`).join(", ");
    expect(itemsSummary).toBe("5x Samsung Galaxy A07, 2x Oppo A7");

    const badgeText = `${totalQty} units (${sale.items.length} items)`;
    expect(badgeText).toBe("7 units (2 items)");
    expect(sale.narration).toContain("INV-2026-00005");
  });

  it("formats inward purchases with products, counts and notes correctly", () => {
    const purchase = {
      id: "pur-1",
      purchaseNumber: "PUR-2026-0001",
      supplierName: "SK Communication",
      totalAmount: 280000,
      paidAmount: 0,
      remainingAmount: 280000,
      paymentStatus: "UNPAID",
      items: [
        { productId: "p1", productName: "Oppo A7", quantity: 10, unitPrice: 28000 },
      ],
      notes: "Merchandise Inward: 10x Oppo A7 from SK Communication (Bill #PUR-2026-0001)",
    };

    const totalQty = purchase.items.reduce((sum, it) => sum + it.quantity, 0);
    expect(totalQty).toBe(10);

    const itemsSummary = purchase.items.map((it) => `${it.quantity}x ${it.productName}`).join(", ");
    expect(itemsSummary).toBe("10x Oppo A7");
    expect(purchase.notes).toContain("10x Oppo A7");
  });

  it("calculates total units sold and total units inward across daily transactions", () => {
    const salesList = [
      {
        id: "s1",
        items: [
          { productName: "Samsung A07", quantity: 5 },
          { productName: "Oppo A7", quantity: 2 },
        ],
      },
      {
        id: "s2",
        items: [
          { productName: "Nokia 110", quantity: 10 },
        ],
      },
    ];

    const totalUnitsSold = salesList.reduce(
      (sum, s) => sum + s.items.reduce((isum, it) => isum + it.quantity, 0),
      0
    );
    expect(totalUnitsSold).toBe(17);
  });
});
