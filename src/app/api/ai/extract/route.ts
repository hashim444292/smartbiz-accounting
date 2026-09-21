import { NextRequest, NextResponse } from "next/server";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { extractTransactionsFromInput, parseDiaryText } from "@/services/aiService";
import { extractFromImage } from "@/services/ocrService";
import { fallbackStore } from "@/lib/fallbackStore";
import { isDatabaseOnline } from "@/lib/dbCheck";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { source = "TEXT", text, imageUrl, audioUrl, customApiKey } = body;

  let ocrRes: any = null;
  let textToExtract = text || "";

  // Run OCR once if image is present
  if (imageUrl) {
    ocrRes = await extractFromImage({ imageUrl, customApiKey });
    textToExtract = ocrRes.rawText || "";
  }

  const dbOnline = await isDatabaseOnline();

  if (dbOnline) {
    try {
      const businessId = await getActiveBusinessId(req);
      const result = await extractTransactionsFromInput({
        businessId,
        source,
        text: textToExtract,
        imageUrl,
        audioUrl,
        customApiKey,
      });

      return NextResponse.json({ success: true, data: result });
    } catch (error: any) {
      console.warn("DB operation warning in extract route, switching to fallback:", error.message);
    }
  }

  // Fast In-Memory Processing when Database is Offline
  const businessId = (await getActiveBusinessId(req).catch(() => "biz-101")) || "biz-101";
  let extraction: any;
  const rawOcrText = ocrRes?.rawText;
  const engineUsed = ocrRes?.engineUsed || "LOCAL_PARSER";

  if (ocrRes && ocrRes.structuredResult && ocrRes.structuredResult.transactions.length > 0) {
    extraction = ocrRes.structuredResult;
  } else if (textToExtract && textToExtract.trim().length > 0) {
    extraction = parseDiaryText(textToExtract);
  } else {
    extraction = {
      documentDate: new Date().toISOString().split("T")[0],
      transactions: [],
      sourceText: "",
      providerNotice: ocrRes?.notice || "کوئی اندراجات نہیں ملے۔ براہ کرم واضح متن یا تصویر فراہم کریں۔",
    };
  }

  const importId = `import-${Date.now()}`;

  const transactions = extraction.transactions.map((t: any, idx: number) => {
    let matchedCustomer = null;
    let matchedSupplier = null;
    if (t.partyName) {
      matchedCustomer = fallbackStore.customers.find((c) =>
        c.name.toLowerCase().includes(t.partyName!.toLowerCase())
      );
      matchedSupplier = fallbackStore.suppliers.find((s) =>
        s.name.toLowerCase().includes(t.partyName!.toLowerCase())
      );
    }

    const partyMatchedId = matchedCustomer?.id || matchedSupplier?.id || null;
    const partyMatchedType = matchedCustomer ? "CUSTOMER" : matchedSupplier ? "SUPPLIER" : null;

    return {
      id: `etx-${Date.now()}-${idx}`,
      importId,
      type: t.type,
      partyName: t.partyName || (matchedCustomer ? matchedCustomer.name : matchedSupplier ? matchedSupplier.name : null),
      partyMatchedId,
      partyMatchedType,
      totalAmount: t.totalAmount,
      paidAmount: t.paidAmount,
      remainingAmount: t.remainingAmount,
      paymentMethod: t.paymentMethod,
      notes: t.notes || null,
      confidence: t.confidence,
      needsConfirmation: t.needsConfirmation,
      warnings: t.warnings ? JSON.stringify(t.warnings) : null,
      status: "PENDING",
      items: t.items || [],
    };
  });

  const fallbackImport = {
    id: importId,
    businessId,
    source,
    originalText: rawOcrText || textToExtract,
    originalContentUrl: imageUrl,
    status: "PENDING",
    extractedCount: transactions.length,
    createdAt: new Date().toISOString(),
    transactions,
    rawOcrText,
    engineUsed,
    notice: extraction.providerNotice || ocrRes?.notice,
    processingTimeMs: ocrRes?.processingTimeMs,
  };

  fallbackStore.aiImports.unshift(fallbackImport);
  return NextResponse.json({ success: true, data: fallbackImport, fallback: true });
}
