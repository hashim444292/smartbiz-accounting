/**
 * Customer Tax & Profile Enrichment Helper
 * Standardized across all sales, invoice views, and customer APIs.
 */

export interface CustomerTaxProfile {
  ntn: string;
  cnic: string;
  strn: string;
  province: string;
  taxStatus: "REGISTERED" | "UNREGISTERED" | "EXEMPT";
  address?: string;
}

export function extractTaxProfileFromNotes(notes: any): CustomerTaxProfile {
  let ntn = "";
  let cnic = "";
  let strn = "";
  let province = "Sindh";
  let taxStatus: "REGISTERED" | "UNREGISTERED" | "EXEMPT" = "UNREGISTERED";
  let address = "";

  if (notes) {
    try {
      if (typeof notes === "object") {
        if (notes.ntn) ntn = String(notes.ntn).trim();
        if (notes.cnic) cnic = String(notes.cnic).trim();
        if (notes.strn) strn = String(notes.strn).trim();
        if (notes.province) province = String(notes.province).trim();
        if (notes.taxStatus) taxStatus = notes.taxStatus;
        if (notes.address) address = String(notes.address).trim();
      } else if (typeof notes === "string" && notes.trim().startsWith("{")) {
        const meta = JSON.parse(notes);
        if (meta.ntn) ntn = String(meta.ntn).trim();
        if (meta.cnic) cnic = String(meta.cnic).trim();
        if (meta.strn) strn = String(meta.strn).trim();
        if (meta.province) province = String(meta.province).trim();
        if (meta.taxStatus) taxStatus = meta.taxStatus;
        if (meta.address) address = String(meta.address).trim();
      } else if (typeof notes === "string") {
        const ntnMatch = notes.match(/NTN:\s*([A-Za-z0-9-]+)/i);
        const cnicMatch = notes.match(/CNIC:\s*([0-9-]+)/i);
        const strnMatch = notes.match(/STRN:\s*([A-Za-z0-9-]+)/i);
        const provMatch = notes.match(/Province:\s*([A-Za-z\s]+)/i);
        if (ntnMatch) ntn = ntnMatch[1].trim();
        if (cnicMatch) cnic = cnicMatch[1].trim();
        if (strnMatch) strn = strnMatch[1].trim();
        if (provMatch) province = provMatch[1].trim();
        if (ntn) taxStatus = "REGISTERED";
      }
    } catch {}
  }

  if (ntn && taxStatus !== "EXEMPT") {
    taxStatus = "REGISTERED";
  }

  return { ntn, cnic, strn, province, taxStatus, address };
}

export function enrichCustomer(c: any): any {
  if (!c) return c;
  const profile = extractTaxProfileFromNotes(c.notes);

  const ntn = c.ntn || profile.ntn || "";
  const cnic = c.cnic || profile.cnic || "";
  const strn = c.strn || profile.strn || "";
  const province = c.province || profile.province || "Sindh";
  const taxStatus = c.taxStatus || profile.taxStatus || (ntn ? "REGISTERED" : "UNREGISTERED");
  const address = c.address || profile.address || "";

  return {
    ...c,
    ntn,
    cnic,
    strn,
    province,
    taxStatus,
    address: address || c.address,
  };
}
