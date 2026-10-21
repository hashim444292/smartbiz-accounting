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
});
