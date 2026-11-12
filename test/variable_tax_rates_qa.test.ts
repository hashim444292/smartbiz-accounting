import { describe, it, expect } from "vitest";
import { buildFbrPayload, buildFbrPosPayload } from "@/services/fbrService";

describe("Variable Product Tax Rates & Statutory Schedules QA Suite", () => {
  const dummyBusiness = {
    id: "bus-1",
    name: "Adeel Textile",
    ntn: "71805196",
    strn: "3277876317222",
    province: "Sindh",
    address: "Plot 12, S.I.T.E, Karachi",
    defaultHsCode: "5208.1100",
  };

  const registeredCustomer = {
    name: "Al-Rehman Weaving Mills Ltd",
    ntn: "7424558",
    province: "Punjab",
    address: "Industrial Area, Faisalabad",
  };

  it("should preserve and accurately calculate reduced tax rate (10% Eighth Schedule) in Digital Invoicing", () => {
    const sale = {
      id: "sale-di-10pct",
      invoiceNumber: "INV-DI-001",
      customer: registeredCustomer,
      items: [
        {
          productName: "Concessional Textile Machinery Part",
          hsCode: "8471.3010",
          quantity: 2,
          unitPrice: 50000,
          discount: 0,
          taxRate: 10, // 10% Eighth Schedule
          taxAmount: 10000, // 100,000 * 10%
        },
      ],
      subtotal: 100000,
      taxAmount: 10000,
      totalAmount: 110000,
    };

    const payload = buildFbrPayload(sale, dummyBusiness, undefined, { scenarioId: "SN005" });
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].rate).toBe("10%");
    expect(payload.items[0].salesTaxApplicable).toBe(10000);
    expect(payload.items[0].valueSalesExcludingST).toBe(100000);
    expect(payload.items[0].totalValues).toBe(110000);
  });

  it("should preserve and accurately calculate 5% and 1% reduced tax rates without defaulting to 18%", () => {
    const sale5pct = {
      id: "sale-di-5pct",
      invoiceNumber: "INV-DI-002",
      customer: registeredCustomer,
      items: [
        {
          productName: "Eighth Schedule Item (5%)",
          hsCode: "5201.0090",
          quantity: 10,
          unitPrice: 1000,
          discount: 0,
          taxRate: 5,
          taxAmount: 500,
        },
        {
          productName: "Special Concessional Item (1%)",
          hsCode: "5205.1100",
          quantity: 5,
          unitPrice: 2000,
          discount: 0,
          taxRate: 1,
          taxAmount: 100,
        },
      ],
      subtotal: 20000,
      taxAmount: 600,
      totalAmount: 20600,
    };

    const payload = buildFbrPayload(sale5pct, dummyBusiness, undefined, { scenarioId: "SN005" });
    expect(payload.items).toHaveLength(2);
    expect(payload.items[0].rate).toBe("5%");
    expect(payload.items[0].salesTaxApplicable).toBe(500);
    expect(payload.items[1].rate).toBe("1%");
    expect(payload.items[1].salesTaxApplicable).toBe(100);
  });

  it("should support 25% Luxury Tax under SRO 297(I)/2023", () => {
    const saleLuxury = {
      id: "sale-di-25pct",
      invoiceNumber: "INV-DI-003",
      customer: registeredCustomer,
      items: [
        {
          productName: "Imported Luxury Finished Fabric",
          hsCode: "5208.5200",
          quantity: 1,
          unitPrice: 100000,
          discount: 0,
          taxRate: 25,
          taxAmount: 25000,
        },
      ],
      subtotal: 100000,
      taxAmount: 25000,
      totalAmount: 125000,
    };

    const payload = buildFbrPayload(saleLuxury, dummyBusiness, undefined, { scenarioId: "SN024" });
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].rate).toBe("25%");
    expect(payload.items[0].salesTaxApplicable).toBe(25000);
    expect(payload.items[0].totalValues).toBe(125000);
  });

  it("should permit 0% tax for Exempt Goods under Sixth Schedule (SN006) without throwing errors", () => {
    const saleExempt = {
      id: "sale-di-exempt",
      invoiceNumber: "INV-DI-004",
      customer: registeredCustomer,
      items: [
        {
          productName: "Exempt Agricultural Seed / Wheat",
          hsCode: "1001.1900",
          quantity: 100,
          unitPrice: 1000,
          discount: 0,
          taxRate: 0,
          taxAmount: 0,
        },
      ],
      subtotal: 100000,
      taxAmount: 0,
      totalAmount: 100000,
    };

    const payload = buildFbrPayload(saleExempt, dummyBusiness, undefined, { scenarioId: "SN006" });
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].rate).toBe("0%");
    expect(payload.items[0].salesTaxApplicable).toBe(0);
    expect(payload.items[0].totalValues).toBe(100000);
  });

  it("should throw an informative error if 0% tax is attempted for a non-exempt supply without scenario justification", () => {
    const saleInvalid0Pct = {
      id: "sale-di-invalid-0pct",
      invoiceNumber: "INV-DI-005",
      customer: registeredCustomer,
      items: [
        {
          productName: "Commercial Textile Fabric",
          hsCode: "5208.1100",
          quantity: 10,
          unitPrice: 1000,
          discount: 0,
          taxRate: 0, // 0% on standard item without SN006 or SRO!
          taxAmount: 0,
        },
      ],
      subtotal: 10000,
      taxAmount: 0,
      totalAmount: 10000,
    };

    expect(() => {
      buildFbrPayload(saleInvalid0Pct, dummyBusiness, undefined, { scenarioId: "SN001" });
    }).toThrow(/Digital Invoicing does not permit 0% tax for "Commercial Textile Fabric"/);
  });

  it("should preserve variable product tax rates in Retail POS mode payload", () => {
    const posSale = {
      id: "sale-pos-var",
      invoiceNumber: "POS-001",
      customerName: "Walk-in Customer",
      paymentMethod: "CASH",
      items: [
        {
          sku: "P-101",
          productName: "Standard Accessory",
          quantity: 1,
          unitPrice: 1000,
          taxRate: 18,
          taxAmount: 180,
        },
        {
          sku: "P-102",
          productName: "Reduced Rate Accessory (10%)",
          quantity: 2,
          unitPrice: 500,
          taxRate: 10,
          taxAmount: 100,
        },
        {
          sku: "P-103",
          productName: "Exempt Book / Item (0%)",
          quantity: 1,
          unitPrice: 300,
          taxRate: 0,
          taxAmount: 0,
        },
      ],
      subtotal: 2300,
      taxAmount: 280,
      totalAmount: 2580,
    };

    const payload = buildFbrPosPayload(posSale, dummyBusiness, { posId: "201327" });
    expect(payload.Items).toHaveLength(3);
    expect(payload.Items[0].TaxRate).toBe(18);
    expect(payload.Items[0].TaxCharged).toBe(180);
    expect(payload.Items[1].TaxRate).toBe(10);
    expect(payload.Items[1].TaxCharged).toBe(100);
    expect(payload.Items[2].TaxRate).toBe(0);
    expect(payload.Items[2].TaxCharged).toBe(0);
  });

  it("should handle a single multi-rate invoice with 18%, 10%, 5%, 1%, 25%, and 0% exempt lines simultaneously", () => {
    const multiRateSale = {
      id: "sale-multi-rates",
      invoiceNumber: "INV-DI-MULTI",
      customer: registeredCustomer,
      items: [
        { productName: "Standard Fabric (18%)", hsCode: "5208.1100", quantity: 10, unitPrice: 1000, taxRate: 18, taxAmount: 1800 },
        { productName: "Machinery (10%)", hsCode: "8471.3010", quantity: 1, unitPrice: 10000, taxRate: 10, taxAmount: 1000 },
        { productName: "Yarn (5%)", hsCode: "5201.0090", quantity: 20, unitPrice: 500, taxRate: 5, taxAmount: 500 },
        { productName: "Concessional Fiber (1%)", hsCode: "5205.1100", quantity: 50, unitPrice: 200, taxRate: 1, taxAmount: 100 },
        { productName: "Luxury Finished Cloth (25%)", hsCode: "5208.5200", quantity: 2, unitPrice: 5000, taxRate: 25, taxAmount: 2500 },
        { productName: "Exempt Raw Seed (0%)", hsCode: "1001.1900", quantity: 100, unitPrice: 50, taxRate: 0, taxAmount: 0, sroScheduleNo: "Table-1" },
      ],
      subtotal: 47000, // 10000 + 10000 + 10000 + 10000 + 10000 + 5000 = 47000 (10k+10k+10k+10k+10k+5k is 55k; 1000*10=10000, 10000*1=10000, 500*20=10000, 200*50=10000, 5000*2=10000, 50*100=5000 => total 55000)
      taxAmount: 5900, // 1800 + 1000 + 500 + 100 + 2500 + 0 = 5900
      totalAmount: 60900,
    };

    const payload = buildFbrPayload(multiRateSale, dummyBusiness, undefined, { scenarioId: "SN001" });
    expect(payload.items).toHaveLength(6);
    expect(payload.items[0].rate).toBe("18%");
    expect(payload.items[1].rate).toBe("10%");
    expect(payload.items[2].rate).toBe("5%");
    expect(payload.items[3].rate).toBe("1%");
    expect(payload.items[4].rate).toBe("25%");
    expect(payload.items[5].rate).toBe("0%");

    const totalCalculatedTax = payload.items.reduce((sum, item) => sum + item.salesTaxApplicable, 0);
    expect(totalCalculatedTax).toBe(5900);
  });
});
