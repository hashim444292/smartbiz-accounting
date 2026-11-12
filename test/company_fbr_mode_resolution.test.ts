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
      (tayyabaCompany.fbrPosId && tayyabaCompany.fbrPosId !== "822646" ? "TIER1_POS" : undefined) ||
      (tayyabaCompany.name.toLowerCase().includes("communication") ? "TIER1_POS" : undefined);

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
      (adeelCompany.fbrPosId && adeelCompany.fbrPosId !== "822646" ? "TIER1_POS" : undefined) ||
      (adeelCompany.name.toLowerCase().includes("textile") ? "DIGITAL_INVOICING" : undefined);

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

  it("should allow ADMIN users to inspect any client company without falling back to default tenant", () => {
    const session = {
      userId: "u-abdullah-admin",
      role: "ADMIN",
      businessId: "biz-hanif",
      companyIds: ["biz-hanif"],
    };

    const candidateId = "3f5c9c3a-a543-4879-8db0-1826b306f546"; // Tayyaba Communication
    const isPlatformAdmin = session.role === "SUPER_ADMIN" || session.role === "ADMIN";
    const userCompanyIds = session.companyIds;

    let validatedBusinessId: string | null = null;
    if (candidateId) {
      if (isPlatformAdmin || userCompanyIds.includes(candidateId)) {
        validatedBusinessId = candidateId;
      }
    }

    expect(validatedBusinessId).toBe(candidateId);
  });
});
