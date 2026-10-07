import { NextRequest, NextResponse } from "next/server";
import { getActiveBusinessId } from "@/lib/businessHelper";
import {
  getFbrComplianceOverview,
  createFbrPosInvoice,
  transmitSaleToFbr,
  transmitFbrCreditNote,
  testFbrToken,
  saveFbrConfig,
  getFbrConfig,
  cleanFbrNtn,
  buildFbrPayload,
  buildFbrPosPayload,
  FBR_ENDPOINTS,
  FBR_POS_ENDPOINTS,
} from "@/services/fbrService";
import { prisma } from "@/lib/prisma";
import { fallbackStore } from "@/lib/fallbackStore";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const businessId = await getActiveBusinessId(req);
    const session = await getSession();
    const canManageFbr = session?.role === "SUPER_ADMIN" || session?.role === "OWNER_ADMIN";

    const [overview, config] = await Promise.all([
      getFbrComplianceOverview(businessId),
      getFbrConfig(businessId),
    ]);

    const safeConfig = { ...config };
    if (!canManageFbr) {
      if (safeConfig.token) safeConfig.token = "••••••••••••••••";
      if (safeConfig.posToken) safeConfig.posToken = "••••••••••••••••";
      if (safeConfig.diToken) safeConfig.diToken = "••••••••••••••••";
    }

    return NextResponse.json({ success: true, data: { ...overview, config: safeConfig } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const businessId = await getActiveBusinessId(req);
    const session = await getSession();
    const canManageFbr = session?.role === "SUPER_ADMIN" || session?.role === "OWNER_ADMIN";
    const body = await req.json();

    // 1. Test FBR Sandbox or Production Gateway Connection
    if (body.action === "test_connection") {
      if (!canManageFbr) {
        return NextResponse.json(
          { success: false, error: "Access Denied: Only Super Admin or Business Owner can test FBR gateway credentials" },
          { status: 403 }
        );
      }
      const config = await getFbrConfig(businessId);
      const token = body.token || config.token;
      const environment = body.environment || config.environment || "sandbox";
      const integrationType = body.integrationType || config.integrationType || "DIGITAL_INVOICING";
      const posId = body.posId || config.posId;
      const sellerNtn = cleanFbrNtn(body.sellerNtn || config.sellerNtn);
      const sellerName = body.sellerName || body.sellerBusinessName || config.sellerBusinessName || "Shakeel mobiles";
      const sellerProvince = body.sellerProvince || config.sellerProvince || "Sindh";
      const sellerAddress = body.sellerAddress || config.sellerAddress || "R-70 rehman villas, Karachi";

      const result = await testFbrToken(
        token,
        environment,
        body.payload,
        integrationType,
        posId,
        sellerNtn,
        sellerName,
        sellerProvince,
        sellerAddress
      );
      return NextResponse.json({
        success: result.success,
        data: result,
      });
    }

    // 2. Save FBR API Credentials and Configuration
    if (body.action === "save_config") {
      if (!canManageFbr) {
        return NextResponse.json(
          { success: false, error: "Access Denied: Only Super Admin or Business Owner can modify FBR credentials" },
          { status: 403 }
        );
      }
      const saved = await saveFbrConfig(businessId, body.config || {});
      return NextResponse.json({
        success: true,
        data: saved,
        message: "FBR API settings saved successfully",
      });
    }

    // 3. Preview Exact FBR JSON Payload for an Invoice
    if (body.action === "preview_payload") {
      const { invoiceId } = body;
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
        if (sale) business = sale.business;
      } catch {
        sale = fallbackStore.sales.find((s) => s.id === invoiceId);
        business = fallbackStore.companies.find((c) => c.id === businessId);
      }

      if (!sale) {
        return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
      }

      const config = await getFbrConfig(businessId);
      let isPos = config.integrationType === "TIER1_POS";
      if (config.integrationType === "BOTH") {
        if (body.engine === "TIER1_POS") isPos = true;
        else if (body.engine === "DIGITAL_INVOICING") isPos = false;
        else isPos = !Boolean(sale.customer?.ntn || sale.customer?.cnic);
      }
      const payload = isPos
        ? buildFbrPosPayload(sale, business, config)
        : buildFbrPayload(sale, business, config);

      const endpoint = isPos
        ? FBR_POS_ENDPOINTS[config.environment].postInvoice
        : FBR_ENDPOINTS[config.environment].postInvoice;

      return NextResponse.json({
        success: true,
        data: {
          payload,
          config,
          integrationType: config.integrationType,
          endpoint,
        },
      });
    }

    // 4. Transmit Single Invoice to FBR (Sandbox or Live)
    if (body.action === "transmit" || body.action === "retry") {
      const { invoiceId, allowIncomplete = false, overrideToken } = body;
      const result = await transmitSaleToFbr(invoiceId, {
        allowIncomplete,
        overrideToken,
      });

      return NextResponse.json({
        success: result.success,
        data: result.sale,
        payload: result.payload,
        fbrResponse: result.fbrResponse,
        message: result.message || `Invoice transmitted to FBR successfully.`,
        error: result.success ? undefined : (result.message || "Failed to transmit invoice to FBR"),
      });
    }

    // 5. Batch Transmit Invoices to FBR (with 2-second throttle between each hit)
    if (body.action === "transmit_batch") {
      const { invoiceIds = [], allowIncomplete = false } = body;
      const results = [];
      const skippedPartial = [];
      const errors = [];

      for (let i = 0; i < invoiceIds.length; i++) {
        const id = invoiceIds[i];

        // 2-second pause before hitting the next invoice (except the first one)
        if (i > 0) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        try {
          const res = await transmitSaleToFbr(id, { allowIncomplete });
          results.push(res.sale);
        } catch (e: any) {
          if (e.message?.includes("payment is incomplete")) {
            skippedPartial.push(id);
          } else {
            errors.push({ id, error: e.message });
          }
        }
      }

      let msg = `${results.length} invoice(s) transmitted to FBR (with 2s statutory interval).`;
      if (skippedPartial.length > 0) {
        msg += ` (${skippedPartial.length} partial/credit invoice(s) held back until full payment is received).`;
      }
      if (errors.length > 0) {
        msg += ` (${errors.length} failed with error).`;
      }

      return NextResponse.json({
        success: true,
        data: results,
        skippedPartialCount: skippedPartial.length,
        errors,
        message: msg,
      });
    }

    // 6. Transmit Official Credit Note (Sales Return / Cancellation) to FBR
    if (body.action === "credit_note") {
      const { invoiceId, reason = "Sales Return / Duplicate Correction" } = body;
      const result = await transmitFbrCreditNote(invoiceId, reason);
      return NextResponse.json({
        success: result.success,
        data: result,
        cnInvoiceNumber: result.cnInvoiceNumber,
        message: result.message,
      });
    }

    // 7. Batch Transmit Credit Notes to FBR (with 2-second rate-limit)
    if (body.action === "credit_note_batch") {
      const { invoiceIds = [], reason = "Duplicate Correction / Reversal" } = body;
      const results = [];
      const errors = [];

      for (let i = 0; i < invoiceIds.length; i++) {
        const id = invoiceIds[i];
        if (i > 0) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        try {
          const res = await transmitFbrCreditNote(id, reason);
          results.push(res);
        } catch (e: any) {
          errors.push({ id, error: e.message });
        }
      }

      return NextResponse.json({
        success: true,
        data: results,
        errors,
        message: `${results.length} FBR Credit Note(s) transmitted successfully.`,
      });
    }

    // Default: Create simulated FBR POS sale
    const newSale = await createFbrPosInvoice({
      ...body,
      businessId,
    });

    return NextResponse.json({
      success: true,
      data: newSale,
      message: `FBR POS Invoice #${newSale.fbrInvoiceNumber} created and verified successfully.`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
