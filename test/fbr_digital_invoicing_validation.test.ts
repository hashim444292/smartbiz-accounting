import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma client to reject instantly during unit testing when Postgres is offline,
// ensuring isolated in-memory execution via fallbackStore.
vi.mock("@/lib/prisma", () => {
  const offlineMethod = () => Promise.reject(new Error("Prisma offline in test"));
  const offlineProxy = new Proxy({}, { get: () => offlineMethod });
  return {
    prisma: new Proxy({}, { get: () => offlineProxy }),
    default: new Proxy({}, { get: () => offlineProxy }),
  };
});

import { buildFbrPayload, buildFbrPosPayload } from "../src/services/fbrService";
import { GET as getCustomers, POST as postCustomers } from "../src/app/api/customers/route";
import { fallbackStore } from "../src/lib/fallbackStore";
import { NextRequest } from "next/server";

describe("FBR Digital Invoicing Statutory Rules & Customer Validation", () => {
  const mockConfig = {
    posId: 101,
    environment: "SANDBOX" as const,
    token: "mock-token",
    sellerNtn: "1234567-8",
    sellerName: "Test Seller Ltd",
    sellerProvince: "Sindh",
    sellerAddress: "Shahrah-e-Faisal, Karachi",
  };

  beforeEach(() => {
    fallbackStore.customers = [];
  });

  describe("FBR Digital Invoicing Walk-in Prohibitions", () => {
    it("should throw an error when customerName is Walk-in Customer", () => {
      const sale: any = {
        id: "sale-di-01",
        invoiceNumber: "INV-DI-001",
        customerName: "Walk-in Customer",
        customer: null,
        items: [
          {
            productName: "Laptop Core i7",
            quantity: 1,
            unitPrice: 150000,
            taxRate: 18,
            discount: 0,
          },
        ],
      };

      expect(() => buildFbrPayload(sale, mockConfig)).toThrow(
        "FBR Digital Invoicing requires a registered buyer. Walk-in customers are strictly prohibited in Digital Invoicing."
      );
    });

    it("should throw an error when customerName is Walk in (Walk in)", () => {
      const sale: any = {
        id: "sale-di-02",
        invoiceNumber: "INV-DI-002",
        customerName: "Walk in (Walk in)",
        customer: null,
        items: [
          {
            productName: "Mobile Phone",
            quantity: 1,
            unitPrice: 50000,
            taxRate: 18,
            discount: 0,
          },
        ],
      };

      expect(() => buildFbrPayload(sale, mockConfig)).toThrow(
        "FBR Digital Invoicing requires a registered buyer. Walk-in customers are strictly prohibited in Digital Invoicing."
      );
    });

    it("should throw an error when customerName is empty or undefined", () => {
      const sale: any = {
        id: "sale-di-03",
        invoiceNumber: "INV-DI-003",
        customerName: "",
        customer: null,
        items: [
          {
            productName: "Mobile Phone",
            quantity: 1,
            unitPrice: 50000,
            taxRate: 18,
            discount: 0,
          },
        ],
      };

      expect(() => buildFbrPayload(sale, mockConfig)).toThrow(
        "FBR Digital Invoicing requires a registered buyer. Walk-in customers are strictly prohibited in Digital Invoicing."
      );
    });
  });

  describe("FBR Digital Invoicing Tax ID Requirements (NTN / CNIC)", () => {
    it("should reject customer if neither 7-8 digit NTN nor 13-digit CNIC is provided", () => {
      const sale: any = {
        id: "sale-di-04",
        invoiceNumber: "INV-DI-004",
        customerName: "Mehmood Traders",
        customer: {
          name: "Mehmood Traders",
          ntn: "",
          cnic: "",
          notes: "",
        },
        items: [
          {
            productName: "Solar Panels 550W",
            quantity: 10,
            unitPrice: 20000,
            taxRate: 18,
            discount: 0,
          },
        ],
      };

      expect(() => buildFbrPayload(sale, mockConfig)).toThrow(
        'FBR Digital Invoicing requires a valid 7-8 digit NTN or 13-digit CNIC for customer "Mehmood Traders"'
      );
    });

    it("should successfully emit Scenario SN001 when buyer has valid 7-8 digit NTN", () => {
      const sale: any = {
        id: "sale-di-05",
        invoiceNumber: "INV-DI-005",
        customerName: "Allied Engineering (Pvt) Ltd",
        customer: {
          name: "Allied Engineering (Pvt) Ltd",
          ntn: "1234567-8",
          province: "Punjab",
          address: "Gulberg III, Lahore",
        },
        items: [
          {
            productName: "Industrial Inverter",
            quantity: 2,
            unitPrice: 85000,
            taxRate: 18,
            discount: 0,
          },
        ],
      };

      const payload = buildFbrPayload(sale, mockConfig);
      expect(payload.buyerNTNCNIC).toBe("12345678");
      expect(payload.buyerBusinessName).toBe("Allied Engineering (Pvt) Ltd");
      expect(payload.scenarioId).toBe("SN001");
      expect(payload.buyerProvince).toBe("Punjab");
    });

    it("should successfully emit Scenario SN002 when unregistered buyer has valid 13-digit CNIC", () => {
      const sale: any = {
        id: "sale-di-06",
        invoiceNumber: "INV-DI-006",
        customerName: "Tariq Mehmood",
        customer: {
          name: "Tariq Mehmood",
          notes: JSON.stringify({
            cnic: "4210112345671",
            province: "Sindh",
            taxStatus: "UNREGISTERED",
          }),
        },
        items: [
          {
            productName: "Air Conditioner 1.5 Ton",
            quantity: 1,
            unitPrice: 120000,
            taxRate: 18,
            discount: 0,
          },
        ],
      };

      const payload = buildFbrPayload(sale, mockConfig);
      expect(payload.buyerNTNCNIC).toBe("4210112345671");
      expect(payload.buyerBusinessName).toBe("Tariq Mehmood");
      expect(payload.scenarioId).toBe("SN002");
      expect(payload.buyerProvince).toBe("Sindh");
    });
  });

  describe("FBR Digital Invoicing 0% Tax Prohibition", () => {
    it("should strictly reject any line item with 0% tax in Digital Invoicing mode", () => {
      const sale: any = {
        id: "sale-di-07",
        invoiceNumber: "INV-DI-007",
        customerName: "Karachi Corp",
        customer: {
          name: "Karachi Corp",
          ntn: "7654321-0",
        },
        items: [
          {
            productName: "Exempt Software License",
            quantity: 1,
            unitPrice: 50000,
            taxRate: 0, // 0% tax disallowed in DI
            discount: 0,
          },
        ],
      };

      expect(() => buildFbrPayload(sale, mockConfig)).toThrow(
        'Digital Invoicing does not permit 0% tax. Line item #1 ("Exempt Software License") must have an applicable sales tax rate greater than 0% (e.g. 18%).'
      );
    });

    it("should accept line item with standard 18% sales tax in Digital Invoicing mode", () => {
      const sale: any = {
        id: "sale-di-08",
        invoiceNumber: "INV-DI-008",
        customerName: "Karachi Corp",
        customer: {
          name: "Karachi Corp",
          ntn: "7654321-0",
        },
        items: [
          {
            productName: "Standard Goods",
            quantity: 1,
            unitPrice: 10000,
            taxRate: 18,
            discount: 0,
          },
        ],
      };

      const payload = buildFbrPayload(sale, mockConfig);
      expect(payload.items[0].rate).toBe("18%");
      expect(payload.items[0].salesTaxApplicable).toBe(1800);
      expect(payload.items[0].totalValues).toBe(11800);
    });
  });

  describe("Retail POS Backwards Compatibility", () => {
    it("should continue allowing Walk-in customers in Retail POS mode", () => {
      const sale: any = {
        id: "sale-pos-01",
        invoiceNumber: "INV-POS-001",
        customerName: "Walk in (Walk in)",
        customer: null,
        totalAmount: 1000,
        salesTax: 0,
        posFee: 1,
        items: [
          {
            productName: "Retail Item",
            quantity: 1,
            unitPrice: 1000,
            taxRate: 0,
            discount: 0,
          },
        ],
      };

      const payload = buildFbrPosPayload(sale, mockConfig);
      expect(payload.BuyerName).toBe("Walk in (Walk in)");
      expect(payload.BuyerNTN).toBe("");
      expect(payload.InvoiceType).toBe(1); // Standard Sale
      expect(payload.InvoiceType).toBe(1); // Standard Sale
    });
  });

  describe("Customer API Tax Profile Storage & Extraction", () => {
    it("should persist and return customer NTN, CNIC, and Province via POST /api/customers", async () => {
      const req = new NextRequest("http://localhost/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Zubair Enterprise",
          businessName: "Zubair Hardware",
          phone: "03001234567",
          ntn: "1122334-5",
          cnic: "4210199887761",
          province: "Punjab",
          taxStatus: "REGISTERED",
        }),
      });

      const res = await postCustomers(req);
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.data.name).toBe("Zubair Enterprise");
      expect(json.data.ntn).toBe("1122334-5");
      expect(json.data.cnic).toBe("4210199887761");
      expect(json.data.province).toBe("Punjab");
      expect(json.data.taxStatus).toBe("REGISTERED");
    });

    it("should parse tax fields correctly when retrieving customers via GET /api/customers", async () => {
      // Seed a customer with notes JSON in fallbackStore
      fallbackStore.customers.push({
        id: "cust-test-01",
        name: "Irfan Electric",
        businessName: "Irfan Bros",
        phone: "03211234567",
        businessId: "biz-default",
        openingBalance: 0,
        currentBalance: 0,
        notes: JSON.stringify({
          ntn: "9988776-5",
          cnic: "4220112345678",
          province: "Khyber Pakhtunkhwa",
          taxStatus: "REGISTERED",
        }),
        sales: [],
        payments: [],
      } as any);

      const req = new NextRequest("http://localhost/api/customers", {
        method: "GET",
        headers: { "x-business-id": "biz-default" },
      });

      const res = await getCustomers(req);
      const json = await res.json();

      expect(json.success).toBe(true);
      const customer = json.data.find((c: any) => c.name === "Irfan Electric");
      expect(customer).toBeDefined();
      expect(customer.ntn).toBe("9988776-5");
      expect(customer.cnic).toBe("4220112345678");
      expect(customer.province).toBe("Khyber Pakhtunkhwa");
      expect(customer.taxStatus).toBe("REGISTERED");
    });
  });
});
