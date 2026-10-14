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

import { buildFbrPayload, buildFbrPosPayload, parseFbrResponse } from "../src/services/fbrService";
import { getFbrRowActionVisibility } from "../src/lib/fbrRowActions";
import { storeDeleteSale } from "../src/lib/fallbackStore";
import { DELETE as deleteSaleRoute } from "../src/app/api/sales/[id]/route";
import { POST as reverseSaleRoute } from "../src/app/api/sales/[id]/reverse/route";
import { POST as complianceRoute } from "../src/app/api/compliance/fbr/route";
import { GET as verifyFbrRoute } from "../src/app/api/verify/fbr/route";
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
      expect(payload.buyerNTNCNIC).toBe("1234567");
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

  describe("FBR Gateway Response Parsing & Trailing Comma Sanitization", () => {
    it("should safely parse FBR gateway responses with trailing commas", () => {
      const rawWithTrailingComma = `{
        "dated": "2026-10-14 23:16:58",
        "validationResponse": {"statusCode":"01","status":"Invalid","errorCode":"0002","error":"Buyer Registration No. is not in proper format. Please make sure that if available buyer registration no. is in correct format i.e. CNIC 13 digits, NTN 7 digits (No special characters)","invoiceStatuses":null},
        "sourceInvoiceNo":"",
      }`;

      const parsed = parseFbrResponse(rawWithTrailingComma);
      expect(parsed).toBeDefined();
      expect(parsed.validationResponse?.status).toBe("Invalid");
      expect(parsed.validationResponse?.errorCode).toBe("0002");
      expect(parsed.validationResponse?.error).toContain("Buyer Registration No. is not in proper format");
    });

    it("should safely parse valid standard FBR gateway responses with invoiceNumber", () => {
      const validRaw = `{
        "invoiceNumber": "4220106071803DI8FLL6H622834",
        "dated": "2026-10-14 23:16:16",
        "validationResponse": {"statusCode":"00","status":"Valid","error":"","invoiceStatuses":[{"itemSNo":"1","statusCode":"00","status":"Valid","invoiceNo":"4220106071803DI8FLL6H622834-1","errorCode":"","error":""}]}
      }`;

      const parsed = parseFbrResponse(validRaw);
      expect(parsed.invoiceNumber).toBe("4220106071803DI8FLL6H622834");
      expect(parsed.validationResponse?.status).toBe("Valid");
    });
  });

  describe("Digital Invoicing Statutory Zero POS Fee Rules", () => {
    it("should never charge Rs. 1/- POS fee in Digital Invoicing payload or verification", async () => {
      const diSale: any = {
        id: "sale-di-posfee-01",
        businessId: "biz-di-test",
        invoiceNumber: "INV-2026-DI-001",
        fbrInvoiceNumber: "4220106071803DI8TEST001",
        fbrStatus: "SUCCESS",
        totalAmount: 1180,
        subtotal: 1000,
        salesTax: 180,
        posFee: 0,
        paymentStatus: "PAID",
        customerName: "Buyer Textile Ltd",
        customer: {
          name: "Buyer Textile Ltd",
          ntn: "7654321",
        },
        items: [
          {
            productName: "Fabric Roll",
            quantity: 1,
            unitPrice: 1000,
            taxRate: 18,
            taxAmount: 180,
          },
        ],
      };

      const payload = buildFbrPayload(diSale, mockConfig);
      // FBR Digital Invoicing JSON payload does not contain POS Fee fields
      expect((payload as any).posFee).toBeUndefined();
      expect((payload as any).POSFee).toBeUndefined();

      fallbackStore.sales.push(diSale);

      const req = new NextRequest("http://localhost/api/verify/fbr?inv=4220106071803DI8TEST001");
      const res = await verifyFbrRoute(req);
      const json = await res.json();

      expect(json.found).toBe(true);
      expect(json.data.posFee).toBe(0);
    });
  });

  describe("Prohibition of Credit Notes & Reversals for Digital Invoicing", () => {
    it("should reject Credit Note API transmission for Digital Invoices with 400", async () => {
      const diSaleId = "sale-di-cn-block";
      fallbackStore.sales.push({
        id: diSaleId,
        businessId: "biz-di-test",
        invoiceNumber: "INV-2026-DI-CN",
        fbrInvoiceNumber: "4220106071803DI8CNTEST",
        fbrStatus: "SUCCESS",
        date: new Date(),
        totalAmount: 5000,
        notes: "{}",
      } as any);

      const req = new NextRequest("http://localhost/api/compliance/fbr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "credit_note",
          invoiceId: diSaleId,
          reason: "Test rejection",
        }),
      });

      const res = await complianceRoute(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Credit Notes and Reversals are not permitted for FBR Digital Invoices");
    });

    it("should reject Sale Reversal for Digital Invoices with 400", async () => {
      const diSaleId = "sale-di-rev-block";
      fallbackStore.sales.push({
        id: diSaleId,
        businessId: "biz-di-test",
        invoiceNumber: "INV-2026-DI-REV",
        fbrInvoiceNumber: "4220106071803DI8REVTEST",
        fbrStatus: "SUCCESS",
        status: "POSTED",
        totalAmount: 5000,
        notes: "{}",
      } as any);

      const req = new NextRequest(`http://localhost/api/sales/${diSaleId}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Return request" }),
      });

      const res = await reverseSaleRoute(req, { params: { id: diSaleId } });
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Credit Notes and Reversals are not permitted for FBR Digital Invoices");
    });
  });

  describe("Statutory Immutability (Delete Prohibition) on FBR-Synced Invoices", () => {
    it("should reject deleting an FBR-synced invoice via DELETE /api/sales/[id] with 403", async () => {
      const syncedSaleId = "sale-synced-delete-block";
      fallbackStore.sales.push({
        id: syncedSaleId,
        businessId: "biz-di-test",
        invoiceNumber: "INV-2026-SYNCED",
        fbrInvoiceNumber: "4220106071803DI8DELBLOCK",
        fbrStatus: "SUCCESS",
        totalAmount: 1000,
      } as any);

      const req = new NextRequest(`http://localhost/api/sales/${syncedSaleId}`, {
        method: "DELETE",
        headers: { "x-business-id": "biz-di-test" },
      });

      const res = await deleteSaleRoute(req, { params: { id: syncedSaleId } });
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Cannot delete fiscalized invoice");
    });

    it("should throw in storeDeleteSale when attempting to delete an FBR-synced invoice", () => {
      const syncedSaleId = "sale-store-delete-block";
      fallbackStore.sales.push({
        id: syncedSaleId,
        businessId: "biz-di-test",
        invoiceNumber: "INV-STORE-BLOCK",
        fbrInvoiceNumber: "4220106071803DI8STORE",
        fbrStatus: "SUCCESS",
      } as any);

      expect(() => storeDeleteSale(syncedSaleId, "biz-di-test")).toThrow(
        "Cannot delete fiscalized invoice"
      );
    });
  });

  describe("UI Row Action Visibility Rules", () => {
    it("should hide Credit Note, Reverse, and Delete for Digital Invoicing stamped invoices", () => {
      const diInv = {
        fbrInvoiceNumber: "4220106071803DI8TESTROW",
        fbrStatus: "SUCCESS",
        paymentStatus: "PAID",
      };

      const vis = getFbrRowActionVisibility(diInv, { isDigitalInvoicing: true });
      expect(vis.showCreditNote).toBe(false);
      expect(vis.showReverse).toBe(false);
      expect(vis.showDelete).toBe(false);
      expect(vis.showEdit).toBe(false);
      expect(vis.showViewQr).toBe(true);
      expect(vis.showJson).toBe(true);
    });

    it("should allow Credit Note for Retail POS stamped invoices but strictly block Delete and Edit", () => {
      const posInv = {
        fbrInvoiceNumber: "201327FJPOS0001",
        fbrStatus: "SUCCESS",
        paymentStatus: "PAID",
      };

      const vis = getFbrRowActionVisibility(posInv, { isDigitalInvoicing: false, integrationType: "TIER1_POS" });
      expect(vis.showCreditNote).toBe(true);
      expect(vis.showDelete).toBe(false);
      expect(vis.showEdit).toBe(false);
      expect(vis.showReverse).toBe(false); // Stamped POS invoices use Credit Note, not local Reverse
    });
  });

  describe("FBR Sandbox Scenarios Certification Engine", () => {
    it("should have all scenarios defined with exact PRAL saleType specifications", async () => {
      const { FBR_DI_SCENARIOS } = await import("@/services/fbrService");
      expect(Object.keys(FBR_DI_SCENARIOS).length).toBe(13);

      expect(FBR_DI_SCENARIOS.SN001.saleType).toBe("Goods at standard rate (default)");
      expect(FBR_DI_SCENARIOS.SN002.saleType).toBe("Goods at standard rate (default)");
      expect(FBR_DI_SCENARIOS.SN003.saleType).toBe("Steel melting and re-rolling");
      expect(FBR_DI_SCENARIOS.SN004.saleType).toBe("Ship breaking");
      expect(FBR_DI_SCENARIOS.SN005.saleType).toBe("Goods at Reduced Rate");
      expect(FBR_DI_SCENARIOS.SN006.saleType).toBe("Exempt goods");
      expect(FBR_DI_SCENARIOS.SN007.saleType).toBe("Goods at zero-rate");
      expect(FBR_DI_SCENARIOS.SN008.saleType.trim()).toBe("3rd Schedule Goods");
      expect(FBR_DI_SCENARIOS.SN009.saleType).toBe("Cotton ginners");
      expect(FBR_DI_SCENARIOS.SN010.saleType).toBe("Telecommunication services");
      expect(FBR_DI_SCENARIOS.SN011.saleType).toBe("Toll Manufacturing");
      expect(FBR_DI_SCENARIOS.SN012.saleType).toBe("Petroleum Products");
      expect(FBR_DI_SCENARIOS.SN013.saleType).toBe("Electricity Supply to Retailers");
    });

    it("should return all scenarios via /api/compliance/fbr action: get_scenarios", async () => {
      const req = new NextRequest("http://localhost/api/compliance/fbr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_scenarios" }),
      });

      const res = await complianceRoute(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.scenarios.length).toBe(13);
      expect(data.scenarios.map((s: any) => s.id)).toEqual([
        "SN001", "SN002", "SN003", "SN004", "SN005", "SN006",
        "SN007", "SN008", "SN009", "SN010", "SN011", "SN012", "SN013",
      ]);
    });

    it("should reject invalid scenario ID with descriptive error", async () => {
      const { executeTransmitScenarioTest } = await import("@/services/fbrService");
      await expect(executeTransmitScenarioTest("biz-di-test", "SN999")).rejects.toThrow(
        "Invalid Scenario ID: SN999"
      );
    });
  });
});

