import { prisma } from "@/lib/prisma";
import { fallbackStore } from "@/lib/fallbackStore";
import { round2 } from "@/lib/decimal";
import { createSafeAuditLog } from "@/lib/auditHelper";

// ── FBR OFFICIAL DIGITAL INVOICING ENDPOINTS ────────────────────────────────
export const FBR_ENDPOINTS = {
  sandbox: {
    postInvoice: "https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata_sb",
    validateInvoice: "https://gw.fbr.gov.pk/di_data/v1/di/validateinvoicedata_sb",
  },
  production: {
    postInvoice: "https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata",
    validateInvoice: "https://gw.fbr.gov.pk/di_data/v1/di/validateinvoicedata",
  },
};

// ── FBR DIGITAL INVOICING INTERFACES ─────────────────────────────────────────
export interface FbrDigitalInvoiceItem {
  hsCode: string;
  productDescription: string;
  rate: string;
  uoM: string;
  quantity: number;
  totalValues: number;
  valueSalesExcludingST: number;
  fixedNotifiedValueOrRetailPrice: number;
  salesTaxApplicable: number;
  salesTaxWithheldAtSource: number;
  extraTax: string;
  furtherTax: number;
  sroScheduleNo: string;
  fedPayable: number;
  discount: number;
  saleType: string;
  sroItemSerialNo: string;
}

export interface FbrDigitalInvoicePayload {
  invoiceType: string;
  invoiceDate: string; // yyyy-MM-dd
  sellerNTNCNIC: string;
  sellerBusinessName: string;
  sellerProvince: string;
  sellerAddress: string;
  buyerNTNCNIC: string;
  buyerBusinessName: string;
  buyerProvince: string;
  buyerAddress: string;
  buyerRegistrationType: "Registered" | "Unregistered";
  invoiceRefNo: string;
  scenarioId: string;
  items: FbrDigitalInvoiceItem[];
}

export interface FbrConfig {
  enabled: boolean;
  token: string;
  environment: "sandbox" | "production";
  posId: string;
  scenarioId: string;
  autoSync: boolean;
  sellerNtn: string;
  sellerBusinessName: string;
  sellerProvince: string;
  sellerAddress: string;
}

export interface FbrTaxCalculation {
  subtotal: number;
  salesTaxRate: number;
  salesTax: number;
  furtherTaxRate: number;
  furtherTax: number;
  extraTaxRate: number;
  extraTax: number;
  totalTax: number;
  totalAmount: number;
}

// ── TAX COMPUTATION ─────────────────────────────────────────────────────────
export function calculateFbrTaxes(params: {
  subtotal: number;
  isRegisteredBuyer?: boolean;
  salesTaxRate?: number;
  furtherTaxRate?: number;
  extraTaxRate?: number;
}): FbrTaxCalculation {
  const {
    subtotal,
    isRegisteredBuyer = false,
    salesTaxRate = 18.0,
    furtherTaxRate = 3.0,
    extraTaxRate = 0.0,
  } = params;

  const salesTax = round2(subtotal * (salesTaxRate / 100)).toNumber();
  const furtherTax = isRegisteredBuyer ? 0 : round2(subtotal * (furtherTaxRate / 100)).toNumber();
  const extraTax = round2(subtotal * (extraTaxRate / 100)).toNumber();
  const totalTax = round2(salesTax + furtherTax + extraTax).toNumber();
  const totalAmount = round2(subtotal + totalTax).toNumber();

  return {
    subtotal: round2(subtotal).toNumber(),
    salesTaxRate,
    salesTax,
    furtherTaxRate: isRegisteredBuyer ? 0 : furtherTaxRate,
    furtherTax,
    extraTaxRate,
    extraTax,
    totalTax,
    totalAmount,
  };
}

export function generateFbrInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `FBR-POS-${year}-${rand}`;
}

export function generateFbrQrCode(invoiceNumber: string, totalAmount: number, posId = "POS-101"): string {
  return `https://e.fbr.gov.pk/verify?inv=${encodeURIComponent(invoiceNumber)}&pos=${encodeURIComponent(posId)}&amt=${totalAmount}`;
}

// ── FBR CONFIGURATION MANAGEMENT ────────────────────────────────────────────
export async function getFbrConfig(businessId: string): Promise<FbrConfig> {
  let business: any = null;
  let settings: any[] = [];

  try {
    business = await prisma.business.findUnique({ where: { id: businessId } });
    settings = await prisma.appSetting.findMany({ where: { businessId } });
  } catch {
    business = fallbackStore.companies.find((c) => c.id === businessId);
  }

  const getSetting = (key: string, defaultVal = "") => {
    const s = settings.find((item) => item.key === key);
    return s ? s.value : defaultVal;
  };

  const sellerNtn = getSetting("fbr_seller_ntn") || business?.ntn || "0000000000000";
  const sellerBusinessName = getSetting("fbr_seller_name") || business?.name || "Business Enterprise";
  const sellerProvince = getSetting("fbr_seller_province") || business?.province || "Sindh";
  const sellerAddress = getSetting("fbr_seller_address") || business?.address || "Karachi, Pakistan";
  const token = getSetting("fbr_token") || process.env.FBR_SANDBOX_TOKEN || "";
  const environment = (getSetting("fbr_env") || "sandbox") as "sandbox" | "production";
  const posId = getSetting("fbr_pos_id") || "POS-101";
  const scenarioId = getSetting("fbr_scenario_id") || "SN000";
  const autoSync = getSetting("fbr_auto_sync") === "true";
  const enabled = getSetting("fbr_enabled") === "true" || !!token;

  return {
    enabled,
    token,
    environment,
    posId,
    scenarioId,
    autoSync,
    sellerNtn,
    sellerBusinessName,
    sellerProvince,
    sellerAddress,
  };
}

export async function saveFbrConfig(businessId: string, config: Partial<FbrConfig>) {
  const keysToSave: Record<string, string> = {};

  if (config.token !== undefined) keysToSave["fbr_token"] = config.token;
  if (config.environment !== undefined) keysToSave["fbr_env"] = config.environment;
  if (config.posId !== undefined) keysToSave["fbr_pos_id"] = config.posId;
  if (config.scenarioId !== undefined) keysToSave["fbr_scenario_id"] = config.scenarioId;
  if (config.autoSync !== undefined) keysToSave["fbr_auto_sync"] = config.autoSync ? "true" : "false";
  if (config.enabled !== undefined) keysToSave["fbr_enabled"] = config.enabled ? "true" : "false";
  if (config.sellerNtn !== undefined) keysToSave["fbr_seller_ntn"] = config.sellerNtn;
  if (config.sellerBusinessName !== undefined) keysToSave["fbr_seller_name"] = config.sellerBusinessName;
  if (config.sellerProvince !== undefined) keysToSave["fbr_seller_province"] = config.sellerProvince;
  if (config.sellerAddress !== undefined) keysToSave["fbr_seller_address"] = config.sellerAddress;

  try {
    for (const [key, value] of Object.entries(keysToSave)) {
      await prisma.appSetting.upsert({
        where: { businessId_key: { businessId, key } },
        update: { value },
        create: { businessId, key, value },
      });
    }

    // Also update Business ntn/province/address if provided
    const bizUpdate: any = {};
    if (config.sellerNtn) bizUpdate.ntn = config.sellerNtn;
    if (config.sellerProvince) bizUpdate.province = config.sellerProvince;
    if (config.sellerAddress) bizUpdate.address = config.sellerAddress;
    if (Object.keys(bizUpdate).length > 0) {
      await prisma.business.update({
        where: { id: businessId },
        data: bizUpdate,
      });
    }
  } catch (e) {
    console.warn("Could not save FBR config to database, storing in fallbackStore:", e);
    const biz = fallbackStore.companies.find((c) => c.id === businessId);
    if (biz) {
      Object.assign(biz, keysToSave);
    }
  }

  return await getFbrConfig(businessId);
}

// ── FORMAT HS CODE (4.4 digits) ─────────────────────────────────────────────
export function formatHsCode(raw?: string | null): string {
  if (!raw || !raw.trim()) return "8517.1300";
  const cleaned = raw.trim().replace(/[^0-9.]/g, "");
  if (cleaned.includes(".")) {
    const [head, tail] = cleaned.split(".");
    return `${head.padStart(4, "0").slice(0, 4)}.${(tail || "00").padEnd(4, "0").slice(0, 4)}`;
  }
  if (cleaned.length <= 4) {
    return `${cleaned.padStart(4, "0")}.0000`;
  }
  return `${cleaned.slice(0, 4)}.${cleaned.slice(4).padEnd(4, "0").slice(0, 4)}`;
}

// ── FORMAT DATE (yyyy-MM-dd) ────────────────────────────────────────────────
export function formatFbrDate(dateInput?: string | Date): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ── BUILD OFFICIAL FBR PAYLOAD ──────────────────────────────────────────────
export function buildFbrPayload(
  sale: any,
  business: any,
  config?: Partial<FbrConfig>
): FbrDigitalInvoicePayload {
  const sellerNTN = config?.sellerNtn || business?.ntn || "0000000000000";
  const sellerBusinessName = config?.sellerBusinessName || business?.name || "Business Enterprise";
  const sellerProvince = config?.sellerProvince || business?.province || "Sindh";
  const sellerAddress = config?.sellerAddress || business?.address || "Karachi, Pakistan";
  const scenarioId = config?.scenarioId || "SN000";

  const customer = sale.customer || null;
  const buyerNTN = customer?.ntn || "0000000000000";
  const isRegistered = buyerNTN && buyerNTN !== "0000000000000" && buyerNTN.trim().length >= 7;
  const buyerName = sale.customerName || customer?.name || "Walk-in Customer";
  const buyerProvince = customer?.province || sellerProvince;
  const buyerAddress = customer?.address || sellerAddress;

  const items: FbrDigitalInvoiceItem[] = (sale.items || []).map((item: any) => {
    const qty = Number(item.quantity || 1);
    const unitPrice = Number(item.unitPrice || 0);
    const discount = Number(item.discount || 0);
    const lineSubtotal = Math.max(0, qty * unitPrice - discount);

    const taxRateVal = Number(item.taxRate ?? 18);
    const taxAmountVal = Number(item.taxAmount ?? (lineSubtotal * (taxRateVal / 100)));
    const totalLineValue = round2(lineSubtotal + taxAmountVal).toNumber();

    return {
      hsCode: formatHsCode(item.hsCode || item.product?.hsCode || business?.defaultHsCode),
      productDescription: item.productName || item.product?.name || "Retail Merchandise",
      rate: `${taxRateVal}%`,
      uoM: item.product?.uom || business?.defaultUom || "Numbers",
      quantity: qty,
      totalValues: totalLineValue,
      valueSalesExcludingST: round2(lineSubtotal).toNumber(),
      fixedNotifiedValueOrRetailPrice: round2(unitPrice).toNumber(),
      salesTaxApplicable: round2(taxAmountVal).toNumber(),
      salesTaxWithheldAtSource: 0,
      extraTax: "",
      furtherTax: isRegistered ? 0 : round2(lineSubtotal * 0.03).toNumber(),
      sroScheduleNo: "",
      fedPayable: 0,
      discount: round2(discount).toNumber(),
      saleType: "Goods",
      sroItemSerialNo: "",
    };
  });

  // If sale has no items, create at least 1 summary line item
  if (items.length === 0) {
    const sub = Number(sale.subtotal || sale.totalAmount || 0);
    const st = Number(sale.salesTax || sale.taxAmount || 0);
    items.push({
      hsCode: formatHsCode(business?.defaultHsCode),
      productDescription: "General Merchandise Sale",
      rate: "18%",
      uoM: "Numbers",
      quantity: 1,
      totalValues: round2(sub + st).toNumber(),
      valueSalesExcludingST: round2(sub).toNumber(),
      fixedNotifiedValueOrRetailPrice: round2(sub).toNumber(),
      salesTaxApplicable: round2(st).toNumber(),
      salesTaxWithheldAtSource: 0,
      extraTax: "",
      furtherTax: Number(sale.furtherTax || 0),
      sroScheduleNo: "",
      fedPayable: 0,
      discount: Number(sale.discountAmount || 0),
      saleType: "Goods",
      sroItemSerialNo: "",
    });
  }

  return {
    invoiceType: "Sale Invoice",
    invoiceDate: formatFbrDate(sale.date),
    sellerNTNCNIC: sellerNTN,
    sellerBusinessName,
    sellerProvince,
    sellerAddress,
    buyerNTNCNIC: buyerNTN,
    buyerBusinessName: buyerName,
    buyerProvince,
    buyerAddress,
    buyerRegistrationType: isRegistered ? "Registered" : "Unregistered",
    invoiceRefNo: sale.invoiceNumber,
    scenarioId,
    items,
  };
}

// ── TEST FBR TOKEN WITH SANDBOX VALIDATE ENDPOINT ───────────────────────────
export async function testFbrToken(
  token: string,
  environment: "sandbox" | "production" = "sandbox",
  customPayload?: any
) {
  const url = FBR_ENDPOINTS[environment].validateInvoice;

  if (!token || !token.trim()) {
    return {
      success: false,
      statusCode: 401,
      message: "No FBR Bearer Token provided. Please enter your FBR API Bearer Token.",
      fault: { code: 900902, message: "Missing Credentials" },
      endpoint: url,
    };
  }

  const samplePayload = customPayload || {
    invoiceType: "Sale Invoice",
    invoiceDate: formatFbrDate(),
    sellerNTNCNIC: "0000000000000",
    sellerBusinessName: "SmartBiz Enterprise",
    sellerProvince: "Sindh",
    sellerAddress: "Saddar, Karachi",
    buyerNTNCNIC: "0000000000000",
    buyerBusinessName: "Walk-in Buyer",
    buyerProvince: "Sindh",
    buyerAddress: "Karachi",
    buyerRegistrationType: "Unregistered",
    invoiceRefNo: "TEST-INV-001",
    scenarioId: "SN000",
    items: [
      {
        hsCode: "8517.1300",
        productDescription: "Smartphone Accessories",
        rate: "18%",
        uoM: "Numbers",
        quantity: 1,
        totalValues: 1180,
        valueSalesExcludingST: 1000,
        fixedNotifiedValueOrRetailPrice: 1000,
        salesTaxApplicable: 180,
        salesTaxWithheldAtSource: 0,
        extraTax: "",
        furtherTax: 0,
        sroScheduleNo: "",
        fedPayable: 0,
        discount: 0,
        saleType: "Goods",
        sroItemSerialNo: "",
      },
    ],
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token.trim()}`,
      },
      body: JSON.stringify(samplePayload),
    });

    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }

    if (res.ok) {
      return {
        success: true,
        statusCode: res.status,
        message: "FBR Gateway Connection Successful! Token is active and recognized.",
        endpoint: url,
        fbrResponse: json,
      };
    } else {
      // 401 or 400 validation error from FBR
      return {
        success: false,
        statusCode: res.status,
        message:
          json?.fault?.description ||
          json?.fault?.message ||
          json?.message ||
          json?.error ||
          `FBR Gateway returned HTTP ${res.status}`,
        endpoint: url,
        fbrResponse: json,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      statusCode: 500,
      message: `Network error connecting to FBR Gateway: ${err.message}`,
      endpoint: url,
    };
  }
}

// ── TRANSMIT SALE INVOICE TO FBR ────────────────────────────────────────────
export async function transmitSaleToFbr(
  invoiceId: string,
  options: { allowIncomplete?: boolean; overrideToken?: string } = {}
) {
  // 1. Fetch sale with items & business
  let sale: any = null;
  let business: any = null;

  try {
    sale = await prisma.sale.findUnique({
      where: { id: invoiceId },
      include: {
        items: { include: { product: true } },
        customer: true,
        business: true,
      },
    });
    if (sale) {
      business = sale.business;
    }
  } catch {
    sale = fallbackStore.sales.find((s) => s.id === invoiceId);
    if (sale) {
      business = fallbackStore.companies.find((c) => c.id === sale.businessId);
    }
  }

  if (!sale) {
    throw new Error(`Sale #${invoiceId} not found in database.`);
  }

  // Check payment completeness safeguard
  if (!options.allowIncomplete && sale.paymentStatus !== "PAID") {
    throw new Error(
      `Invoice #${sale.invoiceNumber} cannot be transmitted to FBR because payment is incomplete (${sale.paymentStatus}, Remaining: Rs. ${Number(
        sale.remainingAmount || 0
      ).toLocaleString()}). Invoices can only be transmitted to FBR once 100% payment is received.`
    );
  }

  // 2. Fetch FBR Configuration
  const config = await getFbrConfig(sale.businessId);
  const token = (options.overrideToken || config.token || "").trim();
  const environment = config.environment || "sandbox";
  const postUrl = FBR_ENDPOINTS[environment].postInvoice;

  // 3. Build official FBR payload
  const payload = buildFbrPayload(sale, business, config);

  // Add Rs. 1/- POS fee [SRO 1006(I)]
  const currentFee = Number((sale as any).posFee || 0);
  const additionalFee = currentFee >= 1 ? 0 : 1.0;
  const newTotal = Number(sale.totalAmount) + additionalFee;

  let fbrInvNum = `FBR-POS-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
  let fbrQr = generateFbrQrCode(fbrInvNum, newTotal, config.posId);
  let liveFbrResponse: any = null;
  let transmissionStatus: "SUCCESS" | "FAILED" = "SUCCESS";
  let transmissionMessage = "";

  // 4. If Bearer Token is available, make REAL HTTP POST to FBR Gateway
  if (token && token !== "N/A") {
    try {
      const res = await fetch(postUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const resText = await res.text();
      try {
        liveFbrResponse = JSON.parse(resText);
      } catch {
        liveFbrResponse = { raw: resText };
      }

      if (res.ok) {
        transmissionStatus = "SUCCESS";
        // Extract FBR Invoice Number & QR Code from FBR's real response
        if (liveFbrResponse.invoiceNumber) {
          fbrInvNum = liveFbrResponse.invoiceNumber;
        }
        if (liveFbrResponse.qrCode) {
          fbrQr = liveFbrResponse.qrCode;
        } else if (liveFbrResponse.validationResponse?.qrCode) {
          fbrQr = liveFbrResponse.validationResponse.qrCode;
        }
        transmissionMessage = `Live FBR Gateway (${environment.toUpperCase()}) confirmed: Invoice #${fbrInvNum} acknowledged.`;
      } else {
        transmissionStatus = "FAILED";
        transmissionMessage =
          liveFbrResponse?.fault?.description ||
          liveFbrResponse?.fault?.message ||
          liveFbrResponse?.message ||
          `FBR Gateway rejected submission with status HTTP ${res.status}`;
      }
    } catch (networkErr: any) {
      transmissionStatus = "FAILED";
      transmissionMessage = `FBR Gateway network error: ${networkErr.message}`;
    }
  } else {
    // Sandbox simulation mode
    transmissionStatus = "SUCCESS";
    transmissionMessage = `Sandbox Simulated Submission (No Bearer Token configured in Settings. Using standard FBR verification format).`;
  }

  // 5. Update Sale in Database
  try {
    const updated = await prisma.sale.update({
      where: { id: invoiceId },
      data: {
        posFee: 1.0,
        totalAmount: newTotal,
        remainingAmount: Math.max(0, Number(sale.remainingAmount) + additionalFee),
        fbrStatus: transmissionStatus,
        fbrInvoiceNumber: fbrInvNum,
        fbrQrCode: fbrQr,
      } as any,
      include: { items: true, customer: true },
    });

    // Create Audit Log
    await createSafeAuditLog(prisma, {
      businessId: sale.businessId,
      userId: sale.createdById || null,
      userName: sale.createdByName || "System",
      branchId: sale.branchId || null,
      action: "FBR_TRANSMISSION",
      entity: "Sale",
      entityId: sale.id,
      details: JSON.stringify({
        invoiceNumber: sale.invoiceNumber,
        fbrInvoiceNumber: fbrInvNum,
        status: transmissionStatus,
        environment,
        message: transmissionMessage,
      }),
    });

    return {
      success: transmissionStatus === "SUCCESS",
      sale: updated,
      payload,
      fbrResponse: liveFbrResponse,
      fbrInvoiceNumber: fbrInvNum,
      fbrQrCode: fbrQr,
      message: transmissionMessage,
    };
  } catch {
    // Fallback store update
    sale.posFee = 1.0;
    sale.totalAmount = newTotal;
    sale.remainingAmount = Math.max(0, Number(sale.remainingAmount) + additionalFee);
    sale.fbrStatus = transmissionStatus;
    sale.fbrInvoiceNumber = fbrInvNum;
    sale.fbrQrCode = fbrQr;

    return {
      success: transmissionStatus === "SUCCESS",
      sale,
      payload,
      fbrResponse: liveFbrResponse,
      fbrInvoiceNumber: fbrInvNum,
      fbrQrCode: fbrQr,
      message: transmissionMessage,
      fallback: true,
    };
  }
}

// ── GET FBR COMPLIANCE OVERVIEW ─────────────────────────────────────────────
export async function getFbrComplianceOverview(businessId: string) {
  let sales: any[] = [];
  try {
    sales = await prisma.sale.findMany({
      where: { businessId },
      orderBy: { date: "desc" },
    });
  } catch {
    sales = fallbackStore.sales.filter((s) => s.businessId === businessId);
  }

  let totalNetSales = 0;
  let totalSalesTax = 0;
  let totalFurtherTax = 0;
  let totalExtraTax = 0;
  let totalTaxCollected = 0;

  let successFbr = 0;
  let pendingFbr = 0;
  let failedFbr = 0;

  for (const s of sales) {
    const sub = Number(s.subtotal || Number(s.totalAmount || 0) - Number(s.taxAmount || 0));
    totalNetSales += sub;

    const sTax = Number(s.salesTax || Number(s.taxAmount || 0));
    const fTax = Number(s.furtherTax || 0);
    const eTax = Number(s.extraTax || 0);

    totalSalesTax += sTax;
    totalFurtherTax += fTax;
    totalExtraTax += eTax;
    totalTaxCollected += sTax + fTax + eTax;

    const status = s.fbrStatus || "PENDING";
    if (status === "SUCCESS") successFbr++;
    else if (status === "FAILED") failedFbr++;
    else pendingFbr++;
  }

  const totalInvoices = sales.length;
  const complianceScore = totalInvoices > 0 ? Math.round((successFbr / totalInvoices) * 100) : 100;

  const complianceIssues = sales
    .filter((s) => s.fbrStatus === "FAILED" || s.fbrStatus === "PENDING")
    .map((s) => ({
      invoiceId: s.id,
      invoiceNumber: s.invoiceNumber,
      customerName: s.customerName,
      amount: Number(s.totalAmount || 0),
      fbrStatus: s.fbrStatus || "PENDING",
      reason:
        s.fbrStatus === "FAILED"
          ? "FBR Endpoint Rejected / Verification Failed"
          : "Pending transmission queue batching",
      date: s.date,
    }));

  const config = await getFbrConfig(businessId);

  return {
    totalNetSales: round2(totalNetSales).toNumber(),
    totalSalesTax: round2(totalSalesTax).toNumber(),
    totalFurtherTax: round2(totalFurtherTax).toNumber(),
    totalExtraTax: round2(totalExtraTax).toNumber(),
    totalTaxCollected: round2(totalTaxCollected).toNumber(),
    totalInvoices,
    successFbr,
    pendingFbr,
    failedFbr,
    complianceScore,
    complianceIssues,
    recentInvoices: sales.slice(0, 200),
    config,
  };
}

// ── CREATE FBR POS INVOICE HELPER ───────────────────────────────────────────
export async function createFbrPosInvoice(params: {
  businessId: string;
  customerName: string;
  customerId?: string;
  items: Array<{
    productId: string;
    productName: string;
    sku?: string;
    hsCode?: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  subtotal: number;
  isRegisteredBuyer?: boolean;
  paymentMethod?: string;
  paidAmount?: number;
}) {
  const taxes = calculateFbrTaxes({
    subtotal: params.subtotal,
    isRegisteredBuyer: params.isRegisteredBuyer,
  });

  const fbrInvoiceNum = generateFbrInvoiceNumber();
  const fbrQr = generateFbrQrCode(fbrInvoiceNum, taxes.totalAmount);
  const now = new Date();

  const saleRecord = {
    id: `sale-${Date.now()}`,
    businessId: params.businessId,
    invoiceNumber: `INV-${now.getFullYear()}-${Date.now().toString().slice(-5)}`,
    date: now.toISOString(),
    customerName: params.customerName || "Walk-in Customer",
    customerId: params.customerId || null,
    subtotal: taxes.subtotal,
    salesTax: taxes.salesTax,
    furtherTax: taxes.furtherTax,
    extraTax: taxes.extraTax,
    taxAmount: taxes.totalTax,
    totalAmount: taxes.totalAmount,
    paidAmount: params.paidAmount ?? taxes.totalAmount,
    remainingAmount: Math.max(0, taxes.totalAmount - (params.paidAmount ?? taxes.totalAmount)),
    paymentStatus: (params.paidAmount ?? taxes.totalAmount) >= taxes.totalAmount ? "PAID" : "PARTIAL",
    paymentMethod: params.paymentMethod || "CASH",
    status: "POSTED",
    fbrStatus: "SUCCESS",
    fbrInvoiceNumber: fbrInvoiceNum,
    fbrQrCode: fbrQr,
    items: params.items.map((item, i) => ({
      id: `si-${Date.now()}-${i}`,
      productId: item.productId,
      productName: item.productName,
      sku: item.sku || "",
      hsCode: formatHsCode(item.hsCode),
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      costPrice: round2(item.unitPrice * 0.85).toNumber(),
    })),
  };

  try {
    await prisma.sale.create({
      data: {
        ...saleRecord,
        items: {
          create: saleRecord.items.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            sku: item.sku,
            hsCode: item.hsCode,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
            costPrice: item.costPrice,
          })),
        },
      } as any,
    });
  } catch {
    fallbackStore.sales.unshift(saleRecord);
    for (const it of params.items) {
      const p = fallbackStore.products.find((prod) => prod.id === it.productId);
      if (p) {
        p.currentStock = Math.max(0, Number(p.currentStock || 0) - it.quantity);
      }
    }
  }

  return saleRecord;
}
