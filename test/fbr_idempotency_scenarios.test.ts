import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock Prisma client to reject instantly during unit testing when Postgres is offline,
// so fallbackStore paths execute with sub-millisecond latency.
vi.mock("@/lib/prisma", () => {
  const offlineMethod = () => Promise.reject(new Error("Prisma offline in test"));
  const offlineProxy = new Proxy({}, { get: () => offlineMethod });
  return {
    prisma: new Proxy({}, { get: () => offlineProxy }),
    default: new Proxy({}, { get: () => offlineProxy }),
  };
});

import {
  transmitFbrCreditNote,
  transmitSaleToFbr,
  buildFbrPosPayload,
} from "../src/services/fbrService";
import {
  fallbackStore,
  storeAddCompany,
} from "../src/lib/fallbackStore";

describe("FBR Idempotency, Concurrency & Gateway Edge-Case Verification Suite", () => {
  const BIZ_ID = "test-idempotency-biz";

  beforeEach(() => {
    // Reset fallbackStore state
    fallbackStore.companies = fallbackStore.companies.filter((c) => c.id !== BIZ_ID);
    fallbackStore.sales = [];
    fallbackStore.auditLogs = [];

    storeAddCompany({
      id: BIZ_ID,
      name: "Tayyaba Communication",
      ntn: "4230110715207",
      posId: "201327",
      integrationType: "TIER1_POS",
      environment: "sandbox",
      defaultHsCode: "8517.13",
    } as any);
  });

  // Scenario 1: First Credit Note submission
  it("Scenario 1: Fresh sale submits successfully with InvoiceType 3 on first attempt", async () => {
    const sale = {
      id: "sale-fresh-1",
      businessId: BIZ_ID,
      invoiceNumber: "INV-2026-00800",
      fbrInvoiceNumber: "201327FJEV11223344",
      fbrStatus: "SUCCESS",
      totalAmount: 15000,
      subtotal: 15000,
      taxAmount: 0,
      customerName: "Fresh Buyer",
      notes: "{}",
    };
    fallbackStore.sales.push(sale as any);

    const res = await transmitFbrCreditNote("sale-fresh-1", "Customer Return");

    expect(res.success).toBe(true);
    expect(res.cnInvoiceNumber).toBeDefined();
    expect(res.payload.InvoiceType).toBe(3);
    expect(res.payload.USIN).toBe("CN-INV-2026-00800");
    expect(res.payload.RefUSIN).toBe("201327FJEV11223344");
  });

  // Scenario 2: Repeated click or repeated API request
  it("Scenario 2: Repeated request for already confirmed Credit Note is strictly blocked", async () => {
    const sale = {
      id: "sale-repeat-2",
      businessId: BIZ_ID,
      invoiceNumber: "INV-2026-00801",
      fbrInvoiceNumber: "201327FJEV22334455",
      fbrStatus: "SUCCESS",
      totalAmount: 20000,
      subtotal: 20000,
      taxAmount: 0,
      customerName: "Buyer 2",
      notes: JSON.stringify({
        fbrCreditNote: {
          cnInvoiceNumber: "201327FJDB55667788",
          status: "SUCCESS",
        },
      }),
    };
    fallbackStore.sales.push(sale as any);

    const res = await transmitFbrCreditNote("sale-repeat-2", "Customer Return");

    expect(res.success).toBe(true);
    expect(res.cnInvoiceNumber).toBe("201327FJDB55667788");
    expect(res.message).toContain("Duplicate transmission blocked");
  });

  // Scenario 3: Two simultaneous requests for the same sale (Concurrency lock)
  it("Scenario 3: Two concurrent requests for the same sale share the same in-flight promise", async () => {
    const sale = {
      id: "sale-concurrent-3",
      businessId: BIZ_ID,
      invoiceNumber: "INV-2026-00802",
      fbrInvoiceNumber: "201327FJEV33445566",
      fbrStatus: "SUCCESS",
      totalAmount: 25000,
      subtotal: 25000,
      taxAmount: 0,
      customerName: "Concurrent Buyer",
      notes: "{}",
    };
    fallbackStore.sales.push(sale as any);

    // Fire two promises simultaneously
    const [res1, res2] = await Promise.all([
      transmitFbrCreditNote("sale-concurrent-3", "Concurrent Hit 1"),
      transmitFbrCreditNote("sale-concurrent-3", "Concurrent Hit 2"),
    ]);

    expect(res1.success).toBe(true);
    expect(res2.success).toBe(true);
    expect(res1.cnInvoiceNumber).toBe(res2.cnInvoiceNumber);
  });

  // Scenario 4: Timeout after FBR accepts submission but before local DB update is confirmed
  it("Scenario 4: Timeout/network failure transitions Credit Note state to PENDING_RECONCILIATION", async () => {
    // Mock global fetch to simulate network timeout/disconnect
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockRejectedValue(new Error("ETIMEDOUT: Gateway did not respond within 30000ms"));

    const sale = {
      id: "sale-timeout-4",
      businessId: BIZ_ID,
      invoiceNumber: "INV-2026-00804",
      fbrInvoiceNumber: "201327FJEV44556677",
      fbrStatus: "SUCCESS",
      totalAmount: 35000,
      subtotal: 35000,
      customerName: "Timeout Buyer",
      notes: "{}",
    };
    fallbackStore.sales.push(sale as any);

    // Provide token to trigger actual fetch attempt
    const biz = fallbackStore.companies.find((c) => c.id === BIZ_ID);
    if (biz) (biz as any).token = "test-token-active";

    try {
      const res = await transmitFbrCreditNote("sale-timeout-4", "Test Timeout");
      expect(res.success).toBe(false);
      expect(res.message).toContain("Network error transmitting Credit Note");

      // Verify that sale notes now hold PENDING_RECONCILIATION
      const updatedNotes = JSON.parse(sale.notes || "{}");
      expect(updatedNotes.fbrCreditNote?.status).toBe("PENDING_RECONCILIATION");
    } finally {
      global.fetch = originalFetch;
      if (biz) (biz as any).token = "";
    }
  });

  // Scenario 5: Retry after unknown gateway outcome is strictly blocked
  it("Scenario 5: Retry after unknown gateway outcome (PENDING_RECONCILIATION) is strictly blocked", async () => {
    const sale = {
      id: "sale-retry-unknown-5",
      businessId: BIZ_ID,
      invoiceNumber: "INV-2026-00805",
      fbrInvoiceNumber: "201327FJEV55667788",
      fbrStatus: "SUCCESS",
      totalAmount: 40000,
      subtotal: 40000,
      customerName: "Recon Buyer",
      notes: JSON.stringify({
        fbrCreditNote: {
          status: "PENDING_RECONCILIATION",
          timestamp: "2026-10-10T12:00:00Z",
        },
      }),
    };
    fallbackStore.sales.push(sale as any);

    const res = await transmitFbrCreditNote("sale-retry-unknown-5", "Customer Return");

    expect(res.success).toBe(false);
    expect(res.message).toContain("PENDING_RECONCILIATION");
    expect(res.message).toContain("Automatic retry blocked");
  });

  // Scenario 6: Failed submission followed by a retry
  it("Scenario 6: Failed gateway submission (e.g. rejection) allows a corrected retry", async () => {
    // 1. Initial failed state: gateway returned an error, so no confirmed CN exists in notes
    const sale = {
      id: "sale-failed-6",
      businessId: BIZ_ID,
      invoiceNumber: "INV-2026-00806",
      fbrInvoiceNumber: "201327FJEV66778899",
      fbrStatus: "SUCCESS",
      totalAmount: 18000,
      subtotal: 18000,
      customerName: "Failed Retry Buyer",
      notes: JSON.stringify({
        lastError: "RefUSIN not recognized by FBR",
      }),
    };
    fallbackStore.sales.push(sale as any);

    // 2. Transmit retry after correcting parameters
    const res = await transmitFbrCreditNote("sale-failed-6", "Corrected Submission");

    expect(res.success).toBe(true);
    expect(res.cnInvoiceNumber).toBeDefined();
    expect(res.payload.InvoiceType).toBe(3);
    // After successful transmission, notes is updated with confirmed Credit Note
    const updatedNotes = JSON.parse(sale.notes || "{}");
    expect(updatedNotes.fbrCreditNote?.status).toBe("SUCCESS");
  });

  // Scenario 7: Existing historical Credit Notes whose references are missing from local fields
  it("Scenario 7: Historical September batch records (INV-2026-00001 to 00441) missing local CN fields are strictly blocked", async () => {
    const sale = {
      id: "sale-hist-sep-7",
      businessId: BIZ_ID,
      invoiceNumber: "INV-2026-00005",
      fbrInvoiceNumber: "201327FJAV27303139",
      fbrStatus: "SUCCESS",
      totalAmount: 2821,
      subtotal: 2820,
      customerName: "Historical Walk-in",
      notes: "{}", // Local notes have no fbrCreditNote object
    };
    fallbackStore.sales.push(sale as any);

    const res = await transmitFbrCreditNote("sale-hist-sep-7", "Re-attempt");

    expect(res.success).toBe(true);
    expect(res.message).toContain("September Credit Note batch");
    expect(res.message).toContain("blocked pending PRAL formal reconciliation");
  });
});
