import { NextRequest, NextResponse } from "next/server";
import { getActiveBusinessId } from "@/lib/businessHelper";
import {
  getFbrComplianceOverview,
  createFbrPosInvoice,
  transmitSaleToFbr,
  testFbrToken,
  saveFbrConfig,
  getFbrConfig,
  buildFbrPayload,
  buildFbrPosPayload,
  FBR_ENDPOINTS,
  FBR_POS_ENDPOINTS,
} from "@/services/fbrService";
import { prisma } from "@/lib/prisma";
import { fallbackStore } from "@/lib/fallbackStore";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const businessId = await getActiveBusinessId(req);
    const [overview, config] = await Promise.all([
      getFbrComplianceOverview(businessId),
      getFbrConfig(businessId),
    ]);
    return NextResponse.json({ success: true, data: { ...overview, config } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const businessId = await getActiveBusinessId(req);
    const body = await req.json();

    // 1. Test FBR Sandbox or Production Gateway Connection
    if (body.action === "test_connection") {
      const { token, environment = "sandbox", payload, integrationType, posId } = body;
      const result = await testFbrToken(token, environment, payload, integrationType, posId);
      return NextResponse.json({
        success: result.success,
        data: result,
      });
    }

    // 2. Save FBR API Credentials and Configuration
    if (body.action === "save_config") {
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
      const isPos = config.integrationType === "TIER1_POS";
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
      });
    }

    // 5. Batch Transmit Invoices to FBR
    if (body.action === "transmit_batch") {
      const { invoiceIds = [], allowIncomplete = false } = body;
      const results = [];
      const skippedPartial = [];
      const errors = [];

      for (const id of invoiceIds) {
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

      let msg = `${results.length} invoice(s) transmitted to FBR.`;
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
