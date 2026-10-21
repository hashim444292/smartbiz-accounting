import { describe, it, expect } from "vitest";
import { enrichCustomer, extractTaxProfileFromNotes } from "../src/lib/customerHelper";

describe("Customer Tax Profile & Registered Status Extraction", () => {
  it("should extract NTN, CNIC, Province, and set REGISTERED from JSON notes", () => {
    const rawCustomer = {
      id: "cust-test-1",
      name: "Adnan Textile",
      address: "F-43 Site Karachi",
      notes: JSON.stringify({
        ntn: "1234567-8",
        cnic: "42101-1234567-1",
        province: "Sindh",
        taxStatus: "REGISTERED",
      }),
    };

    const enriched = enrichCustomer(rawCustomer);

    expect(enriched.ntn).toBe("1234567-8");
    expect(enriched.cnic).toBe("42101-1234567-1");
    expect(enriched.province).toBe("Sindh");
    expect(enriched.taxStatus).toBe("REGISTERED");
  });

  it("should extract NTN, CNIC, and STRN from delimited text notes", () => {
    const rawCustomer = {
      id: "cust-test-2",
      name: "Ali Fabrics",
      notes: "NTN: 7654321-0 | CNIC: 42201-7654321-2 | STRN: 17001234567 | Province: Punjab",
    };

    const enriched = enrichCustomer(rawCustomer);

    expect(enriched.ntn).toBe("7654321-0");
    expect(enriched.cnic).toBe("42201-7654321-2");
    expect(enriched.strn).toBe("17001234567");
    expect(enriched.province).toBe("Punjab");
    expect(enriched.taxStatus).toBe("REGISTERED");
  });

  it("should extract CNIC and remain UNREGISTERED when only CNIC is present", () => {
    const rawCustomer = {
      id: "cust-test-3",
      name: "Tariq Trading",
      notes: "CNIC: 42101-9988776-5",
    };

    const enriched = enrichCustomer(rawCustomer);

    expect(enriched.ntn).toBe("");
    expect(enriched.cnic).toBe("42101-9988776-5");
    expect(enriched.taxStatus).toBe("UNREGISTERED");
  });

  it("should format statutory tax identification correctly for invoice header", () => {
    // Helper replicating invoice header formatting logic
    const formatBuyerTaxId = (customer: any, fbrMeta?: any) => {
      const buyerNtn = customer?.ntn || fbrMeta?.customerNtn;
      const buyerCnic = customer?.cnic || fbrMeta?.customerCnic;
      const buyerStrn = customer?.strn || fbrMeta?.customerStrn;
      const isRegistered = Boolean(buyerNtn || customer?.taxStatus === "REGISTERED" || fbrMeta?.buyerRegistrationType === "Registered");

      if (buyerNtn) {
        if (buyerStrn) {
          return `NTN: ${buyerNtn} • STRN: ${buyerStrn} (Registered)`;
        }
        return `NTN: ${buyerNtn} (Registered)`;
      } else if (buyerCnic) {
        return `CNIC: ${buyerCnic} (Unregistered)`;
      } else if (isRegistered) {
        return "Status: Registered Taxpayer";
      } else {
        return "NTN/CNIC: Unregistered";
      }
    };

    // Case 1: Registered with NTN only
    const cust1 = enrichCustomer({
      id: "c-1",
      name: "Adnan Textile",
      notes: JSON.stringify({ ntn: "1234567-8" }),
    });
    expect(formatBuyerTaxId(cust1)).toBe("NTN: 1234567-8 (Registered)");

    // Case 2: Registered with NTN and STRN
    const cust2 = enrichCustomer({
      id: "c-2",
      name: "Lucky Textile Mills",
      notes: JSON.stringify({ ntn: "0786123-4", strn: "17009876543" }),
    });
    expect(formatBuyerTaxId(cust2)).toBe("NTN: 0786123-4 • STRN: 17009876543 (Registered)");

    // Case 3: Unregistered buyer with CNIC
    const cust3 = enrichCustomer({
      id: "c-3",
      name: "Rashid Cloth Merchant",
      notes: JSON.stringify({ cnic: "42101-5544332-1" }),
    });
    expect(formatBuyerTaxId(cust3)).toBe("CNIC: 42101-5544332-1 (Unregistered)");

    // Case 4: Walk-in buyer without tax identifiers
    const cust4 = enrichCustomer({
      id: "c-4",
      name: "Walk-in Retail Customer",
      notes: null,
    });
    expect(formatBuyerTaxId(cust4)).toBe("NTN/CNIC: Unregistered");
  });

  describe("Customer Tax Credentials Validation Rules", () => {
    // Validation function matching the app & API rules
    const validateCustomerTaxCredentials = (input: {
      name: string;
      taxStatus?: "REGISTERED" | "UNREGISTERED";
      ntn?: string;
      cnic?: string;
    }) => {
      const cleanNtn = (input.ntn || "").trim().replace(/[^0-9]/g, "");
      const cleanCnic = (input.cnic || "").trim().replace(/[^0-9]/g, "");
      const isRegistered = input.taxStatus === "REGISTERED" || cleanNtn.length >= 7;

      if (isRegistered) {
        if (cleanNtn.length < 7) {
          return { valid: false, error: "Registered taxpayers require a valid 7 or 8-digit NTN." };
        }
        return { valid: true, cleanNtn, cleanCnic: cleanCnic || null };
      } else {
        // Unregistered customer: NTN is not mandatory, but CNIC / NIC IS MANDATORY!
        if (!cleanCnic) {
          return { valid: false, error: "Customer does not have an NTN, so providing a 13-digit CNIC / NIC is mandatory." };
        }
        if (cleanCnic.length !== 13) {
          return { valid: false, error: "CNIC / NIC must be exactly 13 digits (e.g. 42101-1234567-1)." };
        }
        return { valid: true, cleanNtn: null, cleanCnic };
      }
    };

    it("should allow registered customer with valid 7-digit NTN without CNIC", () => {
      const result = validateCustomerTaxCredentials({
        name: "Textile Mills Ltd",
        taxStatus: "REGISTERED",
        ntn: "7654321-0",
      });
      expect(result.valid).toBe(true);
      expect(result.cleanNtn).toBe("76543210");
    });

    it("should allow unregistered customer with valid 13-digit CNIC when NTN is absent", () => {
      const result = validateCustomerTaxCredentials({
        name: "Local Shopkeeper",
        taxStatus: "UNREGISTERED",
        cnic: "42101-1234567-1",
      });
      expect(result.valid).toBe(true);
      expect(result.cleanCnic).toBe("4210112345671");
    });

    it("should reject unregistered customer when BOTH NTN and CNIC are absent", () => {
      const result = validateCustomerTaxCredentials({
        name: "Anonymous Buyer",
        taxStatus: "UNREGISTERED",
        ntn: "",
        cnic: "",
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Customer does not have an NTN, so providing a 13-digit CNIC / NIC is mandatory.");
    });

    it("should reject unregistered customer when CNIC has invalid length", () => {
      const result = validateCustomerTaxCredentials({
        name: "Local Trader",
        taxStatus: "UNREGISTERED",
        cnic: "421011234", // Only 9 digits
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("CNIC / NIC must be exactly 13 digits");
    });
  });
});
