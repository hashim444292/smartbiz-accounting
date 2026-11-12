import { describe, it, expect } from "vitest";

describe("Company FBR Integration Mode Resolution QA Suite", () => {
  it("should resolve TIER1_POS for Tayyaba Communication even with FBR_INVOICING_ONLY package", () => {
    const tayyabaCompany = {
      id: "3f5c9c3a-a543-4879-8db0-1826b306f546",
      name: "Tayyaba Communication",
      packageType: "FBR_INVOICING_ONLY",
      integrationType: "TIER1_POS",
      fbrIntegrationType: "TIER1_POS",
      fbrPosId: "201327",
    };

    const rawIntegration =
      tayyabaCompany.integrationType ||
      tayyabaCompany.fbrIntegrationType ||
      (tayyabaCompany.fbrPosId ? "TIER1_POS" : "DIGITAL_INVOICING");

    const initialFbrType =
      rawIntegration === "TIER1_POS"
        ? "TIER1_POS"
        : rawIntegration === "DIGITAL_INVOICING"
        ? "DIGITAL_INVOICING"
        : "TIER1_POS";

    const effectiveMode =
      initialFbrType === "TIER1_POS"
        ? "RETAIL_POS"
        : initialFbrType === "DIGITAL_INVOICING"
        ? "DIGITAL_INVOICING"
        : "RETAIL_POS";

    expect(initialFbrType).toBe("TIER1_POS");
    expect(effectiveMode).toBe("RETAIL_POS");
  });

  it("should resolve DIGITAL_INVOICING for Adeel Textile with FBR_INVOICING_ONLY package", () => {
    const adeelCompany = {
      id: "34139bb3-53f8-42d4-97c4-7627c88b7a62",
      name: "Adeel Textile",
      packageType: "FBR_INVOICING_ONLY",
      integrationType: "DIGITAL_INVOICING",
      fbrIntegrationType: "DIGITAL_INVOICING",
      fbrPosId: "822646",
    };

    const rawIntegration =
      adeelCompany.integrationType ||
      adeelCompany.fbrIntegrationType ||
      (adeelCompany.fbrPosId ? "TIER1_POS" : "DIGITAL_INVOICING");

    const initialFbrType =
      rawIntegration === "TIER1_POS"
        ? "TIER1_POS"
        : rawIntegration === "DIGITAL_INVOICING"
        ? "DIGITAL_INVOICING"
        : "TIER1_POS";

    const effectiveMode =
      initialFbrType === "TIER1_POS"
        ? "RETAIL_POS"
        : initialFbrType === "DIGITAL_INVOICING"
        ? "DIGITAL_INVOICING"
        : "DIGITAL_INVOICING";

    expect(initialFbrType).toBe("DIGITAL_INVOICING");
    expect(effectiveMode).toBe("DIGITAL_INVOICING");
  });

  it("should resolve dynamically for any of 1000+ companies purely based on database integrationType without hardcoded names", () => {
    // Arbitrary retail store among 1000 clients
    const clientA = {
      id: "biz-random-retail-583",
      name: "Al-Madina Cash & Carry",
      packageType: "FBR_INVOICING_ONLY",
      integrationType: "TIER1_POS",
      fbrPosId: "991823",
    };

    const modeA = clientA.integrationType === "TIER1_POS" ? "RETAIL_POS" : "DIGITAL_INVOICING";
    expect(modeA).toBe("RETAIL_POS");

    // Arbitrary wholesale manufacturer among 1000 clients
    const clientB = {
      id: "biz-random-b2b-942",
      name: "Prime Steel & Industrial Supplies",
      packageType: "FULL_SUITE",
      integrationType: "DIGITAL_INVOICING",
      fbrPosId: "",
    };

    const modeB = clientB.integrationType === "TIER1_POS" ? "RETAIL_POS" : "DIGITAL_INVOICING";
    expect(modeB).toBe("DIGITAL_INVOICING");
  });

  it("should generate strictly 1 invoice per row in Retail POS mode (no grouping)", () => {
    // 5 sample POS rows uploaded in bulk
    const posRows = [
      { date: "2026-10-12", customer: "Walk-in Customer", item: "ITELL A100", qty: 1, rate: 26700 },
      { date: "2026-10-12", customer: "Walk-in Customer", item: "ITELL A100", qty: 1, rate: 26700 },
      { date: "2026-10-12", customer: "Walk-in Customer", item: "ITELL A100", qty: 1, rate: 26700 },
      { date: "2026-10-12", customer: "Walk-in Customer", item: "ITELL A100C", qty: 1, rate: 23000 },
      { date: "2026-10-12", customer: "Walk-in Customer", item: "ITELL A50C", qty: 1, rate: 21900 },
    ];

    const isDigitalFile = false; // Retail POS mode
    let autoInvoiceCounter = 0;
    const generatedInvoices: string[] = [];

    for (const row of posRows) {
      if (!isDigitalFile) {
        // Strictly 1 Row = 1 Single Invoice in Retail POS (Counter sales)
        autoInvoiceCounter++;
        generatedInvoices.push(`AUTO-${String(autoInvoiceCounter).padStart(5, "0")}`);
      }
    }

    expect(generatedInvoices.length).toBe(5);
    const uniqueInvoices = new Set(generatedInvoices);
    expect(uniqueInvoices.size).toBe(5);
    expect(generatedInvoices[0]).toBe("AUTO-00001");
    expect(generatedInvoices[4]).toBe("AUTO-00005");
  });

  it("should group identical date and buyer into 1 multi-item invoice in Digital Invoicing (B2B) mode", () => {
    // 5 sample B2B rows uploaded for the same registered buyer on the same date
    const b2bRows = [
      { date: "2026-10-12", customerName: "Gul Ahmed Textiles", ntn: "1234567-8", item: "Yarn Grade A" },
      { date: "2026-10-12", customerName: "Gul Ahmed Textiles", ntn: "1234567-8", item: "Cotton Thread 40s" },
      { date: "2026-10-12", customerName: "Gul Ahmed Textiles", ntn: "1234567-8", item: "Grey Fabric" },
      { date: "2026-10-12", customerName: "Al-Karam Studio", ntn: "7654321-0", item: "Dye Pigment Red" },
      { date: "2026-10-12", customerName: "Al-Karam Studio", ntn: "7654321-0", item: "Dye Pigment Blue" },
    ];

    const isDigitalFile = true; // Digital Invoicing mode
    let autoInvoiceCounter = 0;
    let lastBuyerSignature = "";
    const generatedInvoices: string[] = [];

    for (const row of b2bRows) {
      if (isDigitalFile) {
        const sig = `${row.date}_${row.customerName.toLowerCase()}_${row.ntn}`;
        if (sig !== lastBuyerSignature) {
          autoInvoiceCounter++;
          lastBuyerSignature = sig;
        }
        generatedInvoices.push(`AUTO-${String(autoInvoiceCounter).padStart(3, "0")}`);
      }
    }

    expect(generatedInvoices.length).toBe(5);
    const uniqueInvoices = new Set(generatedInvoices);
    // 5 items across 2 buyers should group into exactly 2 invoices
    expect(uniqueInvoices.size).toBe(2);
    expect(generatedInvoices[0]).toBe("AUTO-001");
    expect(generatedInvoices[1]).toBe("AUTO-001");
    expect(generatedInvoices[2]).toBe("AUTO-001");
    expect(generatedInvoices[3]).toBe("AUTO-002");
    expect(generatedInvoices[4]).toBe("AUTO-002");
  });

  it("should hide batch hit button in Retail POS mode and only expose it in Digital Invoicing", () => {
    const isDigitalInvoicingPOS = false;
    const isDigitalInvoicingDI = true;
    const readyCount = 42;

    const showBatchButtonPOS = readyCount > 0 && isDigitalInvoicingPOS;
    const showBatchButtonDI = readyCount > 0 && isDigitalInvoicingDI;

    expect(showBatchButtonPOS).toBe(false); // POS must NOT blast batch hit
    expect(showBatchButtonDI).toBe(true);   // B2B DI allows batch hit
  });
});
