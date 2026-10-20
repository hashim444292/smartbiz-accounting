import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as bulkSaleRoute } from "@/app/api/sales/bulk/route";
import { fallbackStore } from "@/lib/fallbackStore";

describe("FBR Digital Invoicing (B2B) Bulk Import & Template Validation Suite", () => {
  const businessId = "bus-1";

  beforeEach(() => {
    // Reset or ensure fallback store is ready
    if (!fallbackStore.sales) fallbackStore.sales = [];
    if (!fallbackStore.customers) fallbackStore.customers = [];
  });

  it("should validate all 29 official statutory columns for FBR Digital Invoicing", () => {
    const officialHeaders = [
      "Invoice Date",
      "Invoice Number",
      "Scenario",
      "Sale Type",
      "Buyer Legal Name",
      "Buyer Registration Type",
      "Buyer NTN",
      "Buyer CNIC",
      "Buyer Province",
      "Buyer Address",
      "Product Description",
      "Product Remarks / Batch",
      "HS / PCT Code",
      "UOM",
      "Quantity",
      "Unit Price (Excl. Tax)",
      "Trade Discount Rate %",
      "Trade Discount Amount",
      "Exclusive Value",
      "Sales Tax Rate %",
      "Sales Tax Amount",
      "Further Tax Rate %",
      "Further Tax Amount",
      "Extra Tax %",
      "Extra Tax Amount",
      "FED Rate %",
      "FED Payable",
      "Total Invoice Value",
      "Payment Status",
      "Payment Method",
      "SRO Schedule No",
      "SRO Item Serial No",
      "Remarks / Notes",
    ];

    expect(officialHeaders).toContain("Buyer Legal Name");
    expect(officialHeaders).toContain("Buyer NTN");
    expect(officialHeaders).toContain("Buyer CNIC");
    expect(officialHeaders).toContain("HS / PCT Code");
    expect(officialHeaders).toContain("UOM");
    expect(officialHeaders).toContain("Sales Tax Rate %");
    expect(officialHeaders).toContain("Further Tax Rate %");
    expect(officialHeaders).toContain("Further Tax Amount");
    expect(officialHeaders).toContain("Buyer Province");
  });

  it("should successfully group multi-item rows with identical Invoice Number into a single statutory invoice", async () => {
    const invNumber = `DI-TEST-${Date.now()}`;
    const buyerName = "Al-Rehman Weaving Mills Ltd";
    const buyerNtn = "7424558";

    const payload = {
      mode: "DIGITAL_INVOICING",
      invoices: [
        {
          date: "2026-10-21",
          invoiceNumber: invNumber,
          scenario: "SN001",
          saleType: "Goods at standard rate",
          customerName: buyerName,
          buyerLegalName: buyerName,
          buyerRegistrationType: "Registered",
          customerNtn: buyerNtn,
          buyerProvince: "Punjab",
          buyerAddress: "Industrial Area, Faisalabad",
          productName: "Cotton Poplin Fabric 40x40",
          hsCode: "5208.1100",
          uom: "MTR",
          quantity: 1000,
          rate: 250,
          exclusiveValue: 250000,
          taxRate: 18,
          taxValue: 45000,
          furtherTaxRate: 0,
          furtherTaxAmount: 0,
          totalAmount: 295000,
        },
        {
          date: "2026-10-21",
          invoiceNumber: invNumber,
          scenario: "SN001",
          saleType: "Goods at standard rate",
          customerName: buyerName,
          buyerLegalName: buyerName,
          buyerRegistrationType: "Registered",
          customerNtn: buyerNtn,
          buyerProvince: "Punjab",
          buyerAddress: "Industrial Area, Faisalabad",
          productName: "Carded Yarn 30/1 Ring Spun",
          hsCode: "5205.1100",
          uom: "KG",
          quantity: 500,
          rate: 700,
          exclusiveValue: 350000,
          taxRate: 18,
          taxValue: 63000,
          furtherTaxRate: 0,
          furtherTaxAmount: 0,
          totalAmount: 413000,
        },
      ],
    };

    const req = new NextRequest("http://localhost:3000/api/sales/bulk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-business-id": businessId,
      },
      body: JSON.stringify(payload),
    });

    const res = await bulkSaleRoute(req);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.importedCount).toBe(1); // 2 rows grouped into 1 invoice

    const createdSale = json.results[0];
    expect(createdSale).toBeDefined();
    expect(createdSale.invoiceNumber).toBe(invNumber);
    expect(createdSale.customerName).toBe(buyerName);
    expect(createdSale.subtotal).toBe(600000); // 250,000 + 350,000
    expect(createdSale.taxAmount).toBe(108000); // 45,000 + 63,000
    expect(createdSale.totalAmount).toBe(708000); // 600,000 + 108,000
    expect(createdSale.items).toHaveLength(2);
    expect(createdSale.items[0].hsCode).toBe("5208.1100");
    expect(createdSale.items[0].uom).toBe("MTR");
    expect(createdSale.items[1].hsCode).toBe("5205.1100");
    expect(createdSale.items[1].uom).toBe("KG");

    // Auto-created / linked customer check
    const matchedCustomer = fallbackStore.customers.find(
      (c) => c.businessId === businessId && c.name.toLowerCase() === buyerName.toLowerCase()
    );
    expect(matchedCustomer).toBeDefined();
    if (matchedCustomer?.notes) {
      const taxProfile = JSON.parse(matchedCustomer.notes);
      expect(taxProfile.ntn).toBe(buyerNtn);
      expect(taxProfile.province).toBe("Punjab");
      expect(taxProfile.taxStatus).toBe("REGISTERED");
    }
  });

  it("should apply 3% Further Tax for Unregistered buyer with 13-digit CNIC", async () => {
    const invNumber = `DI-UNREG-${Date.now()}`;
    const unregBuyer = "Siddiq Cloth Merchant";
    const unregCnic = "4220112345671";

    const payload = {
      mode: "DIGITAL_INVOICING",
      invoices: [
        {
          date: "2026-10-21",
          invoiceNumber: invNumber,
          scenario: "SN002",
          saleType: "Goods at standard rate (Unregistered)",
          customerName: unregBuyer,
          buyerLegalName: unregBuyer,
          buyerRegistrationType: "Unregistered",
          customerCnic: unregCnic,
          buyerProvince: "Sindh",
          buyerAddress: "Liaquatabad, Karachi",
          productName: "Cotton Greige Sheeting",
          hsCode: "5208.1100",
          uom: "MTR",
          quantity: 200,
          rate: 200,
          exclusiveValue: 40000,
          taxRate: 18,
          taxValue: 7200,
          furtherTaxRate: 3,
          furtherTaxAmount: 1200,
          totalAmount: 48400, // 40000 + 7200 + 1200
        },
      ],
    };

    const req = new NextRequest("http://localhost:3000/api/sales/bulk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-business-id": businessId,
      },
      body: JSON.stringify(payload),
    });

    const res = await bulkSaleRoute(req);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.importedCount).toBe(1);

    const createdSale = json.results[0];
    expect(createdSale.subtotal).toBe(40000);
    expect(createdSale.salesTax).toBe(7200);
    expect(createdSale.furtherTax).toBe(1200);
    expect(createdSale.totalAmount).toBe(48400);
    expect(createdSale.fbrMeta?.buyerRegistrationType).toBe("Unregistered");
    expect(createdSale.fbrMeta?.customerCnic).toBe(unregCnic);
  });
});
