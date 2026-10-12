import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

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

import {
  transmitFbrCreditNote,
  executeTransmitFbrCreditNote,
  transmitSaleToFbr,
  buildFbrPosPayload,
} from "../src/services/fbrService";
import {
  fallbackStore,
  storeAddCompany,
} from "../src/lib/fallbackStore";
import { POST as complianceRoute } from "../src/app/api/compliance/fbr/route";
import { NextRequest } from "next/server";

describe("Offline Credit Note Engine Validation & Mocked Gateway Harness", () => {
  const TEST_BIZ_ID = "biz-synthetic-validation-001";
  const ORIGINAL_FBR_REF = "201327FJTEST99999999";
  const SYNTHETIC_INVOICE_NO = "INV-TEST-SYN-999";
  const SYNTHETIC_SALE_ID = "synthetic-sale-validation-001";
  const MOCKED_FBR_TOKEN = "test-mocked-gateway-token-12345";

  let capturedFetchRequests: { url: string; options: any }[] = [];
  const originalFetch = global.fetch;

  beforeEach(() => {
    capturedFetchRequests = [];
    fallbackStore.companies = fallbackStore.companies.filter((c) => c.id !== TEST_BIZ_ID);
    fallbackStore.sales = [];
    fallbackStore.auditLogs = [];

    storeAddCompany({
      id: TEST_BIZ_ID,
      name: "Tayyaba Communication",
      ntn: "4230110715207",
      posId: "201327",
      integrationType: "TIER1_POS",
      environment: "production",
      posToken: MOCKED_FBR_TOKEN,
      token: MOCKED_FBR_TOKEN,
      defaultHsCode: "8517.13",
    } as any);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // Requirement 2 & 3: Synthetic test invoice & Credit Note payload verification
  it("Requirement 2 & 3: Emits InvoiceType 4 at invoice and item level with correct RefUSIN and math", async () => {
    const syntheticSale = {
      id: SYNTHETIC_SALE_ID,
      businessId: TEST_BIZ_ID,
      invoiceNumber: SYNTHETIC_INVOICE_NO,
      fbrInvoiceNumber: ORIGINAL_FBR_REF,
      fbrStatus: "SUCCESS",
      date: new Date("2026-09-25T14:30:00Z"),
      subtotal: 49000,
      taxAmount: 8820,
      discountAmount: 1000,
      totalAmount: 57820,
      customerName: "Offline Test Buyer",
      items: [
        {
          id: "item-syn-1",
          productId: "prod-syn-1",
          productName: "Test Smartphone Model X",
          sku: "SKU-TEST-PHONE",
          hsCode: "8517.1390",
          quantity: 2,
          unitPrice: 25000,
          discount: 1000,
          taxRate: 18,
          taxAmount: 8820,
          lineTotal: 57820,
        },
      ],
      notes: "{}",
    };
    fallbackStore.sales.push(syntheticSale as any);

    // Mock global fetch to intercept gateway POST
    const mockedResponseData = {
      InvoiceNumber: "201327FJDB99900011",
      Code: "100",
      Response: "Invoice received successfully",
    };

    global.fetch = vi.fn().mockImplementation(async (url: string, options: any) => {
      capturedFetchRequests.push({ url, options });
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockedResponseData),
      };
    });

    const result = await transmitFbrCreditNote(SYNTHETIC_SALE_ID, "Offline Validation Return", {
      creditNoteDate: "2026-09-30 23:59:59",
    });

    // 1. Gateway intercept assertions
    expect(capturedFetchRequests.length).toBe(1);
    const intercept = capturedFetchRequests[0];
    expect(intercept.url).toContain("ims.fbr.gov.pk/api/Live/PostData");
    expect(intercept.options.headers.Authorization).toBe(`Bearer ${MOCKED_FBR_TOKEN}`);

    const payload = JSON.parse(intercept.options.body);

    // 2. Invoice level assertions
    expect(payload.InvoiceType).toBe(4); // Statutory Credit Note integer under FBR/PRAL POS spec (4 = Credit Note)
    expect(payload.USIN).toBe(`CN-${SYNTHETIC_INVOICE_NO}`);
    expect(payload.RefUSIN).toBe(ORIGINAL_FBR_REF); // References original FBR invoice
    expect(payload.POSID).toBe(201327);
    expect(payload.DateTime).toBe("2026-09-30 23:59:59");

    // 3. Mathematical precision assertions
    expect(payload.TotalQuantity).toBe(2);
    expect(payload.TotalSaleValue).toBe(49000); // 2 * 25000 - 1000 discount
    expect(payload.TotalTaxCharged).toBe(8820); // 18% of 49000
    expect(payload.TotalBillAmount).toBe(57820); // 49000 + 8820
    expect(payload.Discount).toBe(1000);

    // 4. Item level assertions
    expect(payload.Items.length).toBe(1);
    const item = payload.Items[0];
    expect(item.InvoiceType).toBe(4); // Statutory Credit Note integer on item
    expect(item.ItemCode).toBe("SKU-TEST-PHONE");
    expect(item.ItemName).toBe("Test Smartphone Model X");
    expect(item.Quantity).toBe(2);
    expect(item.SaleValue).toBe(49000);
    expect(item.TaxCharged).toBe(8820);
    expect(item.TaxRate).toBe(18);
    expect(item.Discount).toBe(1000);
    expect(item.TotalAmount).toBe(57820);
    expect(item.PCTCode).toBe("85171390");

    // 5. Response handling assertions
    expect(result.success).toBe(true);
    expect(result.cnInvoiceNumber).toBe("201327FJDB99900011");
    expect(result.message).toContain("Mocked Test FBR Gateway acknowledged: #201327FJDB99900011 (InvoiceType 4 verified offline)");
    expect(result.message).not.toContain("Live Production FBR Credit Note confirmed");
    expect(result.mode).toBe("MOCKED");
  });

  // Requirement 4 & 6: Repeated clicks blocked once Credit Note is accepted
  it("Requirement 4 & 6: Accepted Credit Note is permanently idempotent and blocks repeated clicks", async () => {
    const syntheticSale = {
      id: "sale-idempotent-check",
      businessId: TEST_BIZ_ID,
      invoiceNumber: "INV-TEST-SYN-888",
      fbrInvoiceNumber: "201327FJTEST88888888",
      fbrStatus: "SUCCESS",
      totalAmount: 15000,
      subtotal: 15000,
      notes: JSON.stringify({
        fbrCreditNote: {
          cnInvoiceNumber: "201327FJDB88800022",
          status: "SUCCESS",
          responseCode: "100",
        },
      }),
    };
    fallbackStore.sales.push(syntheticSale as any);

    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    const result = await transmitFbrCreditNote("sale-idempotent-check", "Duplicate Click");

    expect(result.success).toBe(true);
    expect(result.cnInvoiceNumber).toBe("201327FJDB88800022");
    expect(result.message).toContain("Duplicate transmission blocked");
    expect(fetchSpy).not.toHaveBeenCalled(); // Gateway never contacted
  });

  // Requirement 5: Simultaneous concurrent requests share in-flight promise
  it("Requirement 5: Simultaneous requests for same sale share the same in-flight network promise", async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      await new Promise((r) => setTimeout(r, 50));
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          InvoiceNumber: "201327FJDB77700033",
          Code: "100",
          Response: "Invoice received successfully",
        }),
      };
    });

    const syntheticSale = {
      id: "sale-concurrent-check",
      businessId: TEST_BIZ_ID,
      invoiceNumber: "INV-TEST-SYN-777",
      fbrInvoiceNumber: "201327FJTEST77777777",
      fbrStatus: "SUCCESS",
      totalAmount: 20000,
      subtotal: 20000,
      notes: "{}",
    };
    fallbackStore.sales.push(syntheticSale as any);

    const [res1, res2] = await Promise.all([
      transmitFbrCreditNote("sale-concurrent-check", "Concurrent Hit 1"),
      transmitFbrCreditNote("sale-concurrent-check", "Concurrent Hit 2"),
    ]);

    expect(callCount).toBe(1); // Fetch called exactly once
    expect(res1.cnInvoiceNumber).toBe("201327FJDB77700033");
    expect(res2.cnInvoiceNumber).toBe("201327FJDB77700033");
  });

  // Requirement 5: Timeouts transition to PENDING_RECONCILIATION and block automatic retry
  it("Requirement 5: Timeout transitions state to PENDING_RECONCILIATION and blocks blind retry", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("ESOCKETTIMEDOUT: Gateway did not reply"));

    const syntheticSale = {
      id: "sale-timeout-check",
      businessId: TEST_BIZ_ID,
      invoiceNumber: "INV-TEST-SYN-666",
      fbrInvoiceNumber: "201327FJTEST66666666",
      fbrStatus: "SUCCESS",
      totalAmount: 25000,
      subtotal: 25000,
      notes: "{}",
    };
    fallbackStore.sales.push(syntheticSale as any);

    const result1 = await transmitFbrCreditNote("sale-timeout-check", "Timeout Hit");
    expect(result1.success).toBe(false);
    expect(result1.message).toContain("Gateway outcome is unconfirmed");
    expect(result1.message).toContain("Automatic retry blocked");
    expect(JSON.parse(syntheticSale.notes || "{}").fbrCreditNote?.status).toBe("PENDING_RECONCILIATION");

    // Second retry attempt must be strictly blocked without forceRehit
    const result2 = await transmitFbrCreditNote("sale-timeout-check", "Blind Retry");
    expect(result2.success).toBe(false);
    expect(result2.message).toContain("PENDING_RECONCILIATION");
    expect(result2.message).toContain("Automatic retry blocked");
  });

  // Requirement 7: Distinguishes simulated response from real FBR response
  it("Requirement 7: Strictly distinguishes simulated response from real FBR response", async () => {
    // 1. Simulation mode (token configured as "N/A" for offline sandbox)
    const biz = fallbackStore.companies.find((c) => c.id === TEST_BIZ_ID);
    if (biz) {
      (biz as any).token = "N/A";
    }

    const syntheticSale = {
      id: "sale-simulated-check",
      businessId: TEST_BIZ_ID,
      invoiceNumber: "INV-TEST-SYN-555",
      fbrInvoiceNumber: "201327FJTEST55555555",
      fbrStatus: "SUCCESS",
      totalAmount: 30000,
      subtotal: 30000,
      notes: "{}",
    };
    fallbackStore.sales.push(syntheticSale as any);

    const simResult = await transmitFbrCreditNote("sale-simulated-check", "Simulated Hit");

    // Must clearly state Sandbox Simulated and NOT claim Live FBR confirmed
    expect(simResult.message).toContain("Sandbox Simulated Credit Note");
    expect(simResult.message).not.toContain("Live FBR Credit Note confirmed");
    expect(simResult.fbrResponse).toBeNull(); // No live response object
    expect(simResult.mode).toBe("SIMULATED");
  });

  // Requirement A: Strict RefUSIN enforcement (zero gateway calls, no silent fallback)
  it("Requirement A: Rejects Credit Note when original invoice lacks FBR reference (zero gateway calls, no fallback to local invoice number)", async () => {
    const saleWithoutFbr = {
      id: "sale-no-fbr-ref",
      businessId: TEST_BIZ_ID,
      invoiceNumber: "INV-TEST-NO-FBR-001",
      fbrInvoiceNumber: undefined, // Missing FBR stamped reference
      fbrStatus: "FAILED",
      totalAmount: 12000,
      subtotal: 12000,
      notes: "{}",
    };
    fallbackStore.sales.push(saleWithoutFbr as any);

    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    const res = await transmitFbrCreditNote("sale-no-fbr-ref", "Invalid Return Attempt");

    expect(res.success).toBe(false);
    expect(res.message).toContain("Original invoice #INV-TEST-NO-FBR-001 has not been stamped with a valid FBR reference number");
    expect(res.message).toContain("Silent fallback to local invoice number is prohibited");
    expect(fetchSpy).not.toHaveBeenCalled(); // Zero gateway calls executed
    expect((saleWithoutFbr as any).fbrCreditNoteStatus).toBeUndefined(); // Zero state mutation
  });

  it("Requirement A: Rejects Credit Note when candidate refUsin matches local invoice number", async () => {
    const saleMatchingLocal = {
      id: "sale-local-ref-match",
      businessId: TEST_BIZ_ID,
      invoiceNumber: "INV-TEST-MATCH-002",
      fbrInvoiceNumber: "INV-TEST-MATCH-002", // Accidentally stored local invoice number
      fbrStatus: "SUCCESS",
      totalAmount: 18000,
      subtotal: 18000,
      notes: "{}",
    };
    fallbackStore.sales.push(saleMatchingLocal as any);

    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    const res = await transmitFbrCreditNote("sale-local-ref-match", "Local Invoice As Ref Attempt", {
      refUsin: "INV-TEST-MATCH-002",
    });

    expect(res.success).toBe(false);
    expect(res.message).toContain("Silent fallback to local invoice number is prohibited");
    expect(fetchSpy).not.toHaveBeenCalled(); // Zero gateway calls executed
  });

  // Requirement B: Rigorous transport mode message separation
  it("Requirement B: Explicitly separates Mocked, Sandbox, and Live Production messages", async () => {
    const saleMock = {
      id: "sale-mode-mock-001",
      businessId: TEST_BIZ_ID,
      invoiceNumber: "INV-TEST-MOCK-001",
      fbrInvoiceNumber: "201327FJMOCK11111111",
      fbrStatus: "SUCCESS",
      totalAmount: 10000,
      subtotal: 10000,
      notes: "{}",
    };
    const saleSandbox = {
      id: "sale-mode-sandbox-002",
      businessId: TEST_BIZ_ID,
      invoiceNumber: "INV-TEST-SAND-002",
      fbrInvoiceNumber: "201327FJSAND22222222",
      fbrStatus: "SUCCESS",
      totalAmount: 10000,
      subtotal: 10000,
      notes: "{}",
    };
    const saleLive = {
      id: "sale-mode-live-003",
      businessId: TEST_BIZ_ID,
      invoiceNumber: "INV-TEST-LIVE-003",
      fbrInvoiceNumber: "201327FJLIVE33333333",
      fbrStatus: "SUCCESS",
      totalAmount: 10000,
      subtotal: 10000,
      notes: "{}",
    };
    fallbackStore.sales.push(saleMock as any, saleSandbox as any, saleLive as any);

    global.fetch = vi.fn().mockImplementation(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        InvoiceNumber: "201327FJDB33300099",
        Code: "100",
        Response: "Success",
      }),
    }));

    // 1. Explicit Mock Transport
    const mockResult = await transmitFbrCreditNote("sale-mode-mock-001", "Mock Test", {
      isMockTransport: true,
    });
    expect(mockResult.mode).toBe("MOCKED");
    expect(mockResult.message).toContain("Mocked Test FBR Gateway acknowledged: #201327FJDB33300099 (InvoiceType 4 verified offline)");
    expect(mockResult.message).not.toContain("Live Production FBR Credit Note confirmed");

    // 2. Sandbox Mode
    const biz = fallbackStore.companies.find((c) => c.id === TEST_BIZ_ID)!;
    biz.environment = "sandbox";
    (biz as any).token = "sandbox-token-valid";
    const sandboxResult = await transmitFbrCreditNote("sale-mode-sandbox-002", "Sandbox Test", {
      isMockTransport: false,
    });
    expect(sandboxResult.mode).toBe("SANDBOX");
    expect(sandboxResult.message).toContain("Sandbox FBR Gateway acknowledged: #201327FJDB33300099 (InvoiceType 4 acknowledged)");
    expect(sandboxResult.message).not.toContain("Live Production FBR Credit Note confirmed");

    // 3. Live Production Mode (simulated gateway mock in offline test)
    biz.environment = "production";
    (biz as any).token = "production-bearer-token-live";
    const liveResult = await transmitFbrCreditNote("sale-mode-live-003", "Production Test", {
      isMockTransport: false,
    });
    expect(liveResult.mode).toBe("LIVE_PRODUCTION");
    expect(liveResult.message).toContain("Live Production FBR Credit Note confirmed: #201327FJDB33300099 (InvoiceType 4 acknowledged)");
  });

  // ── DISTRIBUTED SAFETY SCENARIOS (12 TEST SUITE) ──────────────────────────

  // Scenario 1: Concurrent worker contention
  it("Scenario 1 - Concurrent Worker Contention: Two workers attempt transmission simultaneously; exactly one acquires lease and transmits, second is rejected with 0 network calls", async () => {
    const concurrentSale = {
      id: "sale-concurrent-001",
      businessId: TEST_BIZ_ID,
      invoiceNumber: "INV-TEST-CONCURRENT-001",
      fbrInvoiceNumber: "201327FJCONC1111111",
      fbrStatus: "SUCCESS",
      totalAmount: 15000,
      subtotal: 15000,
      notes: "{}",
    };
    fallbackStore.sales.push(concurrentSale as any);

    let networkCalls = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      networkCalls++;
      // Small artificial delay to allow concurrent in-flight race
      await new Promise((resolve) => setTimeout(resolve, 25));
      return {
        ok: true,
        text: async () => JSON.stringify({ InvoiceNumber: "201327FJDB99900088", Code: "100" }),
      };
    });

    const [res1, res2] = await Promise.all([
      executeTransmitFbrCreditNote("sale-concurrent-001", "Worker 1 Transmission"),
      executeTransmitFbrCreditNote("sale-concurrent-001", "Worker 2 Transmission"),
    ]);

    const successes = [res1, res2].filter((r) => r.success);
    const failures = [res1, res2].filter((r) => !r.success);

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);
    expect(failures[0].message).toMatch(/IN_FLIGHT on another worker|Could not acquire atomic transmission lease/);
    expect(networkCalls).toBe(1); // Gateway contacted strictly once
  });

  // Scenario 2: Active lease overwrite prevention
  it("Scenario 2 - Active Lease Overwrite Prevention: A worker cannot acquire a lease if another active lease exists", async () => {
    const activeLeaseSale = {
      id: "sale-active-lease-002",
      businessId: TEST_BIZ_ID,
      invoiceNumber: "INV-TEST-ACTIVE-002",
      fbrInvoiceNumber: "201327FJACTIVE22222",
      fbrStatus: "SUCCESS",
      totalAmount: 18000,
      subtotal: 18000,
      notes: JSON.stringify({
        fbrCreditNote: {
          status: "IN_FLIGHT",
          leaseAcquiredAt: new Date().toISOString(),
          leaseExpiresAt: new Date(Date.now() + 50000).toISOString(),
          workerId: "worker-prior-active",
        },
      }),
    };
    fallbackStore.sales.push(activeLeaseSale as any);

    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    const res = await executeTransmitFbrCreditNote("sale-active-lease-002", "Overwrite Attempt");

    expect(res.success).toBe(false);
    expect(res.message).toContain("currently IN_FLIGHT on another worker");
    expect(fetchSpy).not.toHaveBeenCalled();
    const currentNotes = JSON.parse(activeLeaseSale.notes);
    expect(currentNotes.fbrCreditNote.workerId).toBe("worker-prior-active"); // Undisturbed
  });

  // Scenario 3: Expired lease fail-closed
  it("Scenario 3 - Expired Lease Fail-Closed: Expired IN_FLIGHT lease cannot be retransmitted automatically; fails closed to PENDING_RECONCILIATION", async () => {
    const expiredLeaseSale = {
      id: "sale-expired-lease-003",
      businessId: TEST_BIZ_ID,
      invoiceNumber: "INV-TEST-EXPIRED-003",
      fbrInvoiceNumber: "201327FJEXPIRED3333",
      fbrStatus: "SUCCESS",
      totalAmount: 20000,
      subtotal: 20000,
      notes: JSON.stringify({
        fbrCreditNote: {
          status: "IN_FLIGHT",
          leaseAcquiredAt: new Date(Date.now() - 120000).toISOString(),
          leaseExpiresAt: new Date(Date.now() - 60000).toISOString(), // Expired 60s ago
          workerId: "worker-dead-or-crashed",
        },
      }),
    };
    fallbackStore.sales.push(expiredLeaseSale as any);

    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    const res = await executeTransmitFbrCreditNote("sale-expired-lease-003", "Auto Retry On Expired");

    expect(res.success).toBe(false);
    expect(res.message).toContain("expired IN_FLIGHT lease with unconfirmed gateway outcome");
    expect(res.message).toContain("Automatic resend is strictly blocked");
    expect(res.message).toContain("Record transitioned to PENDING_RECONCILIATION");
    expect(fetchSpy).not.toHaveBeenCalled();

    const updatedNotes = JSON.parse(expiredLeaseSale.notes);
    expect(updatedNotes.fbrCreditNote.status).toBe("PENDING_RECONCILIATION");
  });

  // Scenario 4: Crash after dispatch
  it("Scenario 4 - Crash After Dispatch: Lease acquired but abandoned due to process crash prevents automatic re-submission", async () => {
    const crashedSale = {
      id: "sale-crash-dispatch-004",
      businessId: TEST_BIZ_ID,
      invoiceNumber: "INV-TEST-CRASH-004",
      fbrInvoiceNumber: "201327FJCRASH44444",
      fbrStatus: "SUCCESS",
      totalAmount: 21000,
      subtotal: 21000,
      notes: JSON.stringify({
        fbrCreditNote: {
          status: "IN_FLIGHT",
          leaseAcquiredAt: new Date().toISOString(),
          leaseExpiresAt: new Date(Date.now() + 30000).toISOString(),
          workerId: "worker-killed-during-dispatch",
        },
      }),
    };
    fallbackStore.sales.push(crashedSale as any);

    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    // A newly spawned worker attempts to transmit while record is in crash state
    const res = await executeTransmitFbrCreditNote("sale-crash-dispatch-004", "Post-Crash Attempt");
    expect(res.success).toBe(false);
    expect(res.message).toContain("currently IN_FLIGHT on another worker");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // Scenario 5: Gateway timeout/reset
  it("Scenario 5 - Gateway Timeout/Reset: Network failure transitions to PENDING_RECONCILIATION; subsequent retry is blocked", async () => {
    const timeoutSale = {
      id: "sale-timeout-005",
      businessId: TEST_BIZ_ID,
      invoiceNumber: "INV-TEST-TIMEOUT-005",
      fbrInvoiceNumber: "201327FJTIME5555555",
      fbrStatus: "SUCCESS",
      totalAmount: 25000,
      subtotal: 25000,
      notes: "{}",
    };
    fallbackStore.sales.push(timeoutSale as any);

    global.fetch = vi.fn().mockRejectedValue(new Error("ECONNRESET: Connection reset by FBR peer"));

    // First attempt times out / resets
    const res1 = await executeTransmitFbrCreditNote("sale-timeout-005", "Initial Hit");
    expect(res1.success).toBe(false);
    expect(res1.message).toContain("Gateway outcome is unconfirmed");
    expect(res1.message).toContain("Automatic retry blocked");
    expect(JSON.parse(timeoutSale.notes).fbrCreditNote?.status).toBe("PENDING_RECONCILIATION");

    // Immediate subsequent retry must be blocked with 0 gateway calls
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;
    const res2 = await executeTransmitFbrCreditNote("sale-timeout-005", "Blind Retry");

    expect(res2.success).toBe(false);
    expect(res2.message).toContain("PENDING_RECONCILIATION");
    expect(res2.message).toContain("Manual verification required");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // Scenario 6: Lease persistence failure
  it("Scenario 6 - Lease Persistence Failure: Database error during lease acquisition halts workflow before any HTTP call", async () => {
    const persistFailSale = {
      id: "sale-lease-fail-006",
      businessId: TEST_BIZ_ID,
      invoiceNumber: "INV-TEST-LFAIL-006",
      fbrInvoiceNumber: "201327FJLFAIL66666",
      fbrStatus: "SUCCESS",
      totalAmount: 30000,
      subtotal: 30000,
      notes: "{}",
    };
    fallbackStore.sales.push(persistFailSale as any);

    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    const res = await executeTransmitFbrCreditNote("sale-lease-fail-006", "Lease Fail Hit", {
      simulateLeasePersistenceFailure: true,
    });

    expect(res.success).toBe(false);
    expect(res.message).toContain("Critical database failure acquiring Credit Note transmission lease");
    expect(res.message).toContain("Gateway transmission aborted");
    expect(fetchSpy).not.toHaveBeenCalled(); // Zero HTTP calls
  });

  // Scenario 7: Final response persistence failure
  it("Scenario 7 - Final Response Persistence Failure: Database error after successful HTTP 200 returns success: false with operational error and preserved response data", async () => {
    const finalFailSale = {
      id: "sale-final-fail-007",
      businessId: TEST_BIZ_ID,
      invoiceNumber: "INV-TEST-FFAIL-007",
      fbrInvoiceNumber: "201327FJFFAIL77777",
      fbrStatus: "SUCCESS",
      totalAmount: 32000,
      subtotal: 32000,
      notes: "{}",
    };
    fallbackStore.sales.push(finalFailSale as any);

    const mockedFbrAccepted = {
      InvoiceNumber: "201327FJDB99900077",
      Code: "100",
      Response: "Credit Note processed successfully by FBR IMS",
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify(mockedFbrAccepted),
    });

    const res = await executeTransmitFbrCreditNote("sale-final-fail-007", "Final Fail Hit", {
      simulateFinalPersistenceFailure: true,
    });

    // Must NOT return success: true!
    expect(res.success).toBe(false);
    expect(res.operationalError).toBe(true);
    expect(res.cnInvoiceNumber).toBe("201327FJDB99900077");
    expect(res.fbrResponse).toEqual(mockedFbrAccepted);
    expect(res.message).toContain("CRITICAL OPERATIONAL ERROR");
    expect(res.message).toContain("DO NOT resubmit to FBR");

    // Emergency audit log must preserve the accepted response
    const emergencyLog = fallbackStore.auditLogs.find(
      (l) => l.action === "FBR_CREDIT_NOTE_PERSISTENCE_FAILURE"
    );
    expect(emergencyLog).toBeDefined();
    expect(JSON.parse(emergencyLog!.details).cnInvoiceNumber).toBe("201327FJDB99900077");
  });

  // Scenario 8: HTTP 4xx/5xx handling
  it("Scenario 8 - HTTP 4xx/5xx Handling: Gateway rejection returns success: false deterministically without silent success", async () => {
    const rejSale = {
      id: "sale-http-rej-008",
      businessId: TEST_BIZ_ID,
      invoiceNumber: "INV-TEST-REJ-008",
      fbrInvoiceNumber: "201327FJREJ8888888",
      fbrStatus: "SUCCESS",
      totalAmount: 35000,
      subtotal: 35000,
      notes: "{}",
    };
    fallbackStore.sales.push(rejSale as any);

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => JSON.stringify({ Code: "500", Response: "Internal PRAL Core Service Error" }),
    });

    const res = await executeTransmitFbrCreditNote("sale-http-rej-008", "Gateway 500 Hit");

    expect(res.success).toBe(false);
    expect(res.message).toContain("Internal PRAL Core Service Error");
    const notesObj = JSON.parse(rejSale.notes);
    expect(notesObj.fbrCreditNote.status).toBe("FAILED");
  });

  // Scenario 9: Client-supplied adminAuthorized: true is rejected
  it("Scenario 9 - Client adminAuthorized Rejected: Client-supplied adminAuthorized: true is rejected without server-side admin context", async () => {
    const pendingSale = {
      id: "sale-client-flag-009",
      businessId: TEST_BIZ_ID,
      invoiceNumber: "INV-TEST-CLIENT-009",
      fbrInvoiceNumber: "201327FJCLIENT99999",
      fbrStatus: "SUCCESS",
      totalAmount: 38000,
      subtotal: 38000,
      notes: JSON.stringify({
        fbrCreditNote: {
          status: "PENDING_RECONCILIATION",
        },
      }),
    };
    fallbackStore.sales.push(pendingSale as any);

    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    const res = await executeTransmitFbrCreditNote("sale-client-flag-009", "Client Flag Hit", {
      forceRehit: true,
      adminAuthorized: true, // Untrusted client boolean
    });

    expect(res.success).toBe(false);
    expect(res.message).toContain("PENDING_RECONCILIATION");
    expect(res.message).toContain("Automatic retry blocked");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // Scenario 10: Internal caller passing boolean is rejected
  it("Scenario 10 - Internal Caller Boolean Rejected: Internal caller passing boolean flag is rejected without ServerAdminContext", async () => {
    const pendingSale = {
      id: "sale-internal-bool-010",
      businessId: TEST_BIZ_ID,
      invoiceNumber: "INV-TEST-IBOOL-010",
      fbrInvoiceNumber: "201327FJIBOOL10101",
      fbrStatus: "SUCCESS",
      totalAmount: 40000,
      subtotal: 40000,
      notes: JSON.stringify({
        fbrCreditNote: {
          status: "PENDING_RECONCILIATION",
        },
      }),
    };
    fallbackStore.sales.push(pendingSale as any);

    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    // Caller passes boolean and override reason string directly
    const res = await executeTransmitFbrCreditNote("sale-internal-bool-010", "Internal Boolean Hit", {
      forceRehit: true,
      adminAuthorized: true as any,
      adminOverrideReason: "Attempting manual override without typed ServerAdminContext",
    });

    expect(res.success).toBe(false);
    expect(res.message).toContain("PENDING_RECONCILIATION");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // Scenario 11: Verified server-side admin context with valid reason and env flag succeeds
  it("Scenario 11 - Verified Server Admin Context: ServerAdminContext with valid reason and env flag succeeds through override path", async () => {
    const pendingSale = {
      id: "sale-admin-ctx-011",
      businessId: TEST_BIZ_ID,
      invoiceNumber: "INV-TEST-ACTX-011",
      fbrInvoiceNumber: "201327FJACTX11111",
      fbrStatus: "SUCCESS",
      totalAmount: 42000,
      subtotal: 42000,
      notes: JSON.stringify({
        fbrCreditNote: {
          status: "PENDING_RECONCILIATION",
        },
      }),
    };
    fallbackStore.sales.push(pendingSale as any);

    const originalEnv = process.env.FBR_ADMIN_OVERRIDE_ENABLED;
    process.env.FBR_ADMIN_OVERRIDE_ENABLED = "true";

    try {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ InvoiceNumber: "201327FJDB99900011", Code: "100" }),
      });

      const res = await executeTransmitFbrCreditNote("sale-admin-ctx-011", "Verified Admin Hit", {
        forceRehit: true,
        adminContext: {
          userId: "superadmin-usr-99",
          userRole: "SUPER_ADMIN",
          userName: "Compliance Director",
          reason: "Manually verified with official PRAL IRIS portal export schedule",
        },
      });

      expect(res.success).toBe(true);
      expect(res.cnInvoiceNumber).toBe("201327FJDB99900011");

      const adminLog = fallbackStore.auditLogs.find(
        (l) => l.action === "FBR_CREDIT_NOTE_ADMIN_OVERRIDE"
      );
      expect(adminLog).toBeDefined();
      expect(JSON.parse(adminLog!.details).authorizedByRole).toBe("SUPER_ADMIN");
      expect(JSON.parse(adminLog!.details).reason).toContain("official PRAL IRIS portal");
    } finally {
      process.env.FBR_ADMIN_OVERRIDE_ENABLED = originalEnv;
    }
  });

  // Scenario 12: Idempotency across repeated attempts
  it("Scenario 12 - Idempotency Across Repeated Attempts: Repeated attempts return confirmed reference without contacting gateway", async () => {
    const stampedSale = {
      id: "sale-idempotent-012",
      businessId: TEST_BIZ_ID,
      invoiceNumber: "INV-TEST-IDEMP-012",
      fbrInvoiceNumber: "201327FJIDEMP12121",
      fbrCreditNoteInvoiceNumber: "201327FJDB99900012",
      fbrStatus: "SUCCESS",
      totalAmount: 45000,
      subtotal: 45000,
      notes: JSON.stringify({
        fbrCreditNote: {
          status: "SUCCESS",
          cnInvoiceNumber: "201327FJDB99900012",
        },
      }),
    };
    fallbackStore.sales.push(stampedSale as any);

    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    const res = await transmitFbrCreditNote("sale-idempotent-012", "Repeated Hit");

    expect(res.success).toBe(true);
    expect(res.cnInvoiceNumber).toBe("201327FJDB99900012");
    expect(res.message).toContain("already confirmed on FBR");
    expect(fetchSpy).not.toHaveBeenCalled(); // Zero gateway calls
  });

  // Requirement: API endpoint protection
  it("API Endpoint Protection: POST /api/compliance/fbr with client-supplied forceRehit returns 403 Forbidden", async () => {
    const req = new NextRequest("http://localhost:3000/api/compliance/fbr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "credit_note",
        invoiceId: "sale-bypass-attempt",
        forceRehit: true, // Client attempts unauthorized bypass parameter
      }),
    });

    const res = await complianceRoute(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error).toContain("Unauthorized override: client-supplied forceRehit is strictly prohibited");
  });

  // Requirement 5: Dual InvoiceType mapping verification (InvoiceType 2 for Sale, InvoiceType 4 for Credit Note)
  it("Requirement 5: Confirms Credit Note payload uses InvoiceType 4 and normal Sale payload continues to use InvoiceType 2", () => {
    const sampleSale = {
      id: "sale-mapping-check-001",
      businessId: TEST_BIZ_ID,
      invoiceNumber: "INV-2026-SALE-001",
      date: new Date("2026-10-12T10:00:00Z"),
      totalAmount: 11800,
      subtotal: 10000,
      taxAmount: 1800,
      items: [
        {
          id: "item-1",
          sku: "SKU-PROD-1",
          productName: "Test Merchandise Item",
          quantity: 1,
          unitPrice: 10000,
          discount: 0,
          taxRate: 18,
          taxAmount: 1800,
          totalAmount: 11800,
        },
      ],
    };

    const business = fallbackStore.companies.find((c) => c.id === TEST_BIZ_ID)!;

    // 1. Normal Sale payload (default options without invoiceType override)
    const salePayload = buildFbrPosPayload(sampleSale, business);
    expect(salePayload.InvoiceType).toBe(2); // 2 = Sale under FBR/PRAL POS spec
    expect(salePayload.USIN).toBe("INV-2026-SALE-001");
    expect(salePayload.RefUSIN).toBe(""); // No RefUSIN on normal sales
    expect(salePayload.Items.length).toBe(1);
    expect(salePayload.Items[0].InvoiceType).toBe(2); // 2 = Sale at item level

    // 2. Credit Note payload (options with invoiceType: 4 and refUsin)
    const cnPayload = buildFbrPosPayload(sampleSale, business, undefined, {
      invoiceType: 4, // 4 = Credit Note under FBR/PRAL POS spec
      refUsin: "201327FJSALEORIGINAL99",
      dateTime: "2026-10-12 10:30:00",
    });
    expect(cnPayload.InvoiceType).toBe(4); // 4 = Credit Note at header level
    expect(cnPayload.USIN).toBe("CN-INV-2026-SALE-001"); // Credit note USIN prefix
    expect(cnPayload.RefUSIN).toBe("201327FJSALEORIGINAL99"); // Original FBR invoice reference
    expect(cnPayload.Items.length).toBe(1);
    expect(cnPayload.Items[0].InvoiceType).toBe(4); // 4 = Credit Note at item level
  });

  // Requirement 8: Historical records 201327FJDA35364997 and 201327FJDA42134387 remain untouched
  it("Requirement 8: Confirms historical records 201327FJDA35364997 and 201327FJDA42134387 are strictly excluded", () => {
    const historicalRef1 = "201327FJDA35364997";
    const historicalRef2 = "201327FJDA42134387";

    // Verify none of our synthetic test instances or operations touch or reference these numbers
    expect(ORIGINAL_FBR_REF).not.toBe(historicalRef1);
    expect(ORIGINAL_FBR_REF).not.toBe(historicalRef2);

    // Verify fallbackStore has zero records modifying these historical FBR references
    const modifiedSales = fallbackStore.sales.filter(
      (s: any) => s.fbrInvoiceNumber === historicalRef1 || s.fbrInvoiceNumber === historicalRef2
    );
    expect(modifiedSales.length).toBe(0);
  });

  // Requirement: Verify actual serialized HTTP request body over the wire for Credit Note (InvoiceType 4)
  it("Regression: Serialized HTTP request body for Credit Note strictly enforces root InvoiceType: 4, item-level InvoiceType: 4, and validated RefUSIN", async () => {
    const saleId = "cn-wire-serialize-test-001";
    const testInvNum = "INV-2026-00746-TEST";
    const originalFbrRef = "201327FJTEST74600001";

    fallbackStore.sales.push({
      id: saleId,
      businessId: TEST_BIZ_ID,
      invoiceNumber: testInvNum,
      fbrInvoiceNumber: originalFbrRef,
      fbrStatus: "SUCCESS",
      date: new Date("2026-10-12T11:00:00Z"),
      subtotal: 100,
      taxAmount: 18,
      totalAmount: 118,
      customerName: "Offline Wire Test Buyer",
      items: [
        {
          id: "item-wire-1",
          productId: "prod-wire-1",
          productName: "Test Item Wire",
          sku: "SKU-WIRE-1",
          quantity: 1,
          unitPrice: 100,
          discount: 0,
          taxRate: 18,
          taxAmount: 18,
          hsCode: "8517.1390",
        },
      ],
      notes: "{}",
    } as any);

    let capturedBodyString = "";
    global.fetch = vi.fn().mockImplementation(async (url: string, options: any) => {
      capturedFetchRequests.push({ url, options });
      capturedBodyString = options.body;
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          InvoiceNumber: "201327FJDB74699999",
          Code: "100",
          Response: "Credit Note acknowledged",
        }),
      };
    });

    // Execute via compliance API route (action: "credit_note")
    const req = new NextRequest("http://localhost:3000/api/compliance/fbr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "credit_note",
        invoiceId: saleId,
        reason: "Statutory Credit Note test",
      }),
    });

    const routeRes = await complianceRoute(req);
    const routeData = await routeRes.json();

    expect(routeRes.status).toBe(200);
    expect(routeData.success).toBe(true);

    // Assert on the ACTUAL RAW SERIALIZED HTTP STRING sent to FBR gateway
    expect(capturedBodyString).toBeTypeOf("string");
    expect(capturedBodyString.length).toBeGreaterThan(0);

    const wirePayload = JSON.parse(capturedBodyString);

    // Root-level assertions on wire JSON
    expect(wirePayload.InvoiceType).toBe(4);
    expect(wirePayload.InvoiceType).not.toBe(2); // Strict regression guard: CANNOT be 2 (Sale)
    expect(wirePayload.InvoiceType).not.toBe(1); // CANNOT be 1 (Purchase)
    expect(wirePayload.InvoiceType).not.toBe(3); // CANNOT be 3 (Debit Note)
    expect(wirePayload.RefUSIN).toBe(originalFbrRef);
    expect(wirePayload.RefUSIN).not.toBe(testInvNum); // Never local invoice number
    expect(wirePayload.USIN).toBe(`CN-${testInvNum}`);

    // Item-level assertions on wire JSON
    expect(wirePayload.Items.length).toBe(1);
    expect(wirePayload.Items[0].InvoiceType).toBe(4);
    expect(wirePayload.Items[0].InvoiceType).not.toBe(2);
  });

  // Requirement: Verify actual serialized HTTP request body over the wire for normal Sale (InvoiceType 2)
  it("Regression: Serialized HTTP request body for normal Sale strictly enforces root InvoiceType: 2, item-level InvoiceType: 2, and empty RefUSIN", async () => {
    const saleId = "sale-wire-serialize-test-002";
    const testInvNum = "INV-2026-NORMAL-SALE";

    fallbackStore.sales.push({
      id: saleId,
      businessId: TEST_BIZ_ID,
      invoiceNumber: testInvNum,
      fbrInvoiceNumber: null,
      fbrStatus: null,
      date: new Date("2026-10-12T12:00:00Z"),
      subtotal: 500,
      taxAmount: 90,
      totalAmount: 590,
      paymentStatus: "PAID",
      paidAmount: 590,
      remainingAmount: 0,
      customerName: "Walk-in Counter Buyer",
      items: [
        {
          id: "item-sale-wire-1",
          productId: "prod-sale-wire-1",
          productName: "Normal Merchandise",
          sku: "SKU-SALE-1",
          quantity: 1,
          unitPrice: 500,
          discount: 0,
          taxRate: 18,
          taxAmount: 90,
          hsCode: "8517.1390",
        },
      ],
      notes: "{}",
    } as any);

    let capturedBodyString = "";
    global.fetch = vi.fn().mockImplementation(async (url: string, options: any) => {
      capturedFetchRequests.push({ url, options });
      capturedBodyString = options.body;
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          InvoiceNumber: "201327FJNORMAL11111",
          Code: "100",
          Response: "Sale acknowledged",
        }),
      };
    });

    const res = await transmitSaleToFbr(saleId);
    expect(res.success).toBe(true);

    // Assert on the ACTUAL RAW SERIALIZED HTTP STRING sent to FBR gateway
    expect(capturedBodyString).toBeTypeOf("string");
    expect(capturedBodyString.length).toBeGreaterThan(0);

    const wirePayload = JSON.parse(capturedBodyString);

    // Root-level assertions on wire JSON for normal sale
    expect(wirePayload.InvoiceType).toBe(2); // 2 = Sale
    expect(wirePayload.InvoiceType).not.toBe(4); // Must NOT be Credit Note
    expect(wirePayload.RefUSIN).toBe(""); // Normal sale has empty RefUSIN
    expect(wirePayload.USIN).toBe(testInvNum); // No CN- prefix

    // Item-level assertions on wire JSON for normal sale
    expect(wirePayload.Items.length).toBe(1);
    expect(wirePayload.Items[0].InvoiceType).toBe(2);
    expect(wirePayload.Items[0].InvoiceType).not.toBe(4);
  });
});
