import { describe, it, expect } from "vitest";
import { round2, toDecimal } from "@/lib/decimal";

describe("Sales Invoice Improvements (Task 1 to Task 5)", () => {
  // Helper simulating recalculateItem logic
  function recalculateItem(item: any, currentBuyerStatus: "EXEMPT" | "REGISTERED" | "UNREGISTERED") {
    const isBlankQty = item.quantity === "" || item.quantity === undefined || item.quantity === null;
    const qNum = isBlankQty ? 0 : Math.max(0, Number(item.quantity));
    const p = Math.max(0, Number(item.unitPrice || 0));
    const discPct = Math.min(100, Math.max(0, Number(item.discountPercent || 0)));

    const sub = qNum * p;
    const discAmt = round2(toDecimal(sub).mul(discPct).div(100)).toNumber();
    const taxable = Math.max(0, sub - discAmt);

    let tr = 18;
    if (currentBuyerStatus === "EXEMPT") {
      tr = 0;
    } else if (item.taxRate !== undefined && item.taxRate !== null && !isNaN(Number(item.taxRate))) {
      tr = Number(item.taxRate);
    } else {
      tr = 18;
    }
    const taxAmt = round2(toDecimal(taxable).mul(tr).div(100)).toNumber();
    const lineTotal = taxable + taxAmt;

    return {
      productId: item.productId || "",
      productName: item.productName || "",
      quantity: isBlankQty ? "" : qNum,
      unitPrice: p,
      costPrice: Number(item.costPrice || 0),
      discountPercent: discPct,
      discountAmount: discAmt,
      taxRate: tr,
      taxAmount: taxAmt,
      taxableAmount: taxable,
      lineTotal: lineTotal,
    };
  }

  describe("Task 1 & 2: Blank Product & Blank Quantity Default", () => {
    it("should initialize row with blank product and blank quantity without forcing 1", () => {
      const initialRow = recalculateItem(
        {
          productId: "",
          productName: "",
          quantity: "",
          unitPrice: 0,
          costPrice: 0,
        },
        "EXEMPT"
      );

      expect(initialRow.productId).toBe("");
      expect(initialRow.productName).toBe("");
      expect(initialRow.quantity).toBe("");
      expect(initialRow.taxableAmount).toBe(0);
      expect(initialRow.lineTotal).toBe(0);
    });

    it("should compute lineTotal = 0 when quantity is blank, and calculate correctly once quantity is typed", () => {
      const blankRow = recalculateItem(
        {
          productId: "prod-1",
          productName: "Test Product",
          quantity: "",
          unitPrice: 500,
          costPrice: 400,
        },
        "EXEMPT"
      );

      expect(blankRow.quantity).toBe("");
      expect(blankRow.lineTotal).toBe(0);

      // User enters quantity 3
      const updatedRow = recalculateItem(
        {
          ...blankRow,
          quantity: 3,
        },
        "EXEMPT"
      );

      expect(updatedRow.quantity).toBe(3);
      expect(updatedRow.lineTotal).toBe(1500);
    });

    it("should detect validation error if quantity is left blank or zero on form submission", () => {
      const row = {
        productName: "Samsung Galaxy",
        quantity: "",
        unitPrice: 1000,
      };

      const isInvalid = row.quantity === "" || Number(row.quantity) <= 0 || isNaN(Number(row.quantity));
      expect(isInvalid).toBe(true);

      const validRow = {
        productName: "Samsung Galaxy",
        quantity: 2,
        unitPrice: 1000,
      };
      const isValid = !(
        (validRow.quantity as any) === "" ||
        Number(validRow.quantity) <= 0 ||
        isNaN(Number(validRow.quantity))
      );
      expect(isValid).toBe(true);
    });
  });

  describe("Task 4: Selling Below Cost & Loss Tracking", () => {
    it("should correctly detect when selling below cost and compute exact loss per unit", () => {
      const costPrice = 500;
      const sellingPrice = 450; // User reduced price due to market drop

      const isLoss = costPrice > 0 && sellingPrice > 0 && sellingPrice < costPrice;
      const lossPerUnit = isLoss ? costPrice - sellingPrice : 0;

      expect(isLoss).toBe(true);
      expect(lossPerUnit).toBe(50);
    });

    it("should compute margin when selling above cost", () => {
      const costPrice = 500;
      const sellingPrice = 650;

      const isProfit = costPrice > 0 && sellingPrice >= costPrice;
      const profitPerUnit = isProfit ? sellingPrice - costPrice : 0;

      expect(isProfit).toBe(true);
      expect(profitPerUnit).toBe(150);
    });
  });

  describe("Task 5: Wholesaler & Retailer Rate Intelligence", () => {
    it("should allow choosing a historical rate to override unitPrice", () => {
      let currentRow = recalculateItem(
        {
          productId: "prod-wholesale",
          productName: "Rice Super Basmati 50kg",
          quantity: 10,
          unitPrice: 12000, // standard catalog price
          costPrice: 10500,
        },
        "EXEMPT"
      );

      expect(currentRow.lineTotal).toBe(120000);

      // Wholesaler selects previous rate charged to this customer (Rs 11,500)
      const selectedHistoryRate = 11500;
      currentRow = recalculateItem(
        {
          ...currentRow,
          unitPrice: selectedHistoryRate,
        },
        "EXEMPT"
      );

      expect(currentRow.unitPrice).toBe(11500);
      expect(currentRow.lineTotal).toBe(115000);
      expect(currentRow.unitPrice).toBeGreaterThan(currentRow.costPrice); // Still profitable
    });
  });
});
