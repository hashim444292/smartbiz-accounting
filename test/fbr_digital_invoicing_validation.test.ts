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

  it("should validate all 28 official statutory columns for FBR Digital Invoicing (Invoice Number is auto-generated)", () => {
    const officialHeaders = [
      "Invoice Date",
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

    expect(officialHeaders).not.toContain("Invoice Number");
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
  }, 60000);

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
  }, 60000);

  it("should auto-generate invoice numbers and group contiguous rows when invoiceNumber is omitted", async () => {
    const buyer1 = "Lucky Textile Mills Ltd";
    const ntn1 = "1234567";
    const buyer2 = "Gul Ahmed Fabric Div";
    const ntn2 = "2345678";

    // 3 rows: first 2 for buyer1 (same date), 3rd for buyer2
    const payload = {
      mode: "DIGITAL_INVOICING",
      invoices: [
        {
          date: "2026-10-21",
          // invoiceNumber omitted
          scenario: "SN001",
          saleType: "Goods at standard rate",
          customerName: buyer1,
          buyerLegalName: buyer1,
          buyerRegistrationType: "Registered",
          customerNtn: ntn1,
          buyerProvince: "Sindh",
          productName: "Cotton Twill 20x16",
          hsCode: "5208.1100",
          uom: "MTR",
          quantity: 500,
          rate: 300,
          exclusiveValue: 150000,
          taxRate: 18,
          taxValue: 27000,
          totalAmount: 177000,
        },
        {
          date: "2026-10-21",
          // invoiceNumber omitted, same buyer & date (multi-item line 2)
          scenario: "SN001",
          saleType: "Goods at standard rate",
          customerName: buyer1,
          buyerLegalName: buyer1,
          buyerRegistrationType: "Registered",
          customerNtn: ntn1,
          buyerProvince: "Sindh",
          productName: "Yarn Dye Fabric",
          hsCode: "5208.3100",
          uom: "MTR",
          quantity: 200,
          rate: 400,
          exclusiveValue: 80000,
          taxRate: 18,
          taxValue: 14400,
          totalAmount: 94400,
        },
        {
          date: "2026-10-21",
          // invoiceNumber omitted, different buyer -> separate invoice
          scenario: "SN001",
          saleType: "Goods at standard rate",
          customerName: buyer2,
          buyerLegalName: buyer2,
          buyerRegistrationType: "Registered",
          customerNtn: ntn2,
          buyerProvince: "Sindh",
          productName: "Finished Grey Fabric",
          hsCode: "5208.1200",
          uom: "MTR",
          quantity: 1000,
          rate: 220,
          exclusiveValue: 220000,
          taxRate: 18,
          taxValue: 39600,
          totalAmount: 259600,
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
    expect(json.importedCount).toBe(2); // 3 rows grouped into 2 distinct invoices

    const sale1 = json.results[0];
    const sale2 = json.results[1];

    expect(sale1.customerName).toBe(buyer1);
    expect(sale1.items).toHaveLength(2);
    expect(sale1.invoiceNumber).toBeDefined();
    expect(sale1.invoiceNumber).not.toMatch(/^AUTO-/); // Must NOT be raw AUTO- key
    expect(sale1.subtotal).toBe(230000); // 150000 + 80000

    expect(sale2.customerName).toBe(buyer2);
    expect(sale2.items).toHaveLength(1);
    expect(sale2.invoiceNumber).toBeDefined();
    expect(sale2.invoiceNumber).not.toMatch(/^AUTO-/);
    expect(sale2.invoiceNumber).not.toBe(sale1.invoiceNumber); // Distinct invoice numbers
  }, 60000);
});
