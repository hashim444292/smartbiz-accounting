import { NextRequest, NextResponse } from "next/server";
import { getActiveBusinessId } from "@/lib/businessHelper";
import { getSession } from "@/lib/auth";
import { extractTransactionsFromInput, parseDiaryText } from "@/services/aiService";
import { extractFromImage } from "@/services/ocrService";
import { fallbackStore } from "@/lib/fallbackStore";
import { isDatabaseOnline } from "@/lib/dbCheck";

export const dynamic = "force-dynamic";

const MAX_IMAGE_PAYLOAD_CHARS = 14 * 1024 * 1024; // ~10MB binary
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/bmp"];

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const hasGemini = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 10);
    const hasOpenAi = !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim().startsWith("sk-"));

    return NextResponse.json({
      success: true,
      aiConfigured: hasGemini || hasOpenAi,
      defaultProvider: hasGemini ? "GEMINI" : hasOpenAi ? "OPENAI" : "LOCAL",
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { source = "TEXT", text, imageUrl, audioUrl, customApiKey } = body;

    // Validate imageUrl if supplied
    if (imageUrl) {
      if (typeof imageUrl !== "string") {
        return NextResponse.json(
          { success: false, error: "Invalid image URL format" },
          { status: 400 }
        );
      }

      if (imageUrl.length > MAX_IMAGE_PAYLOAD_CHARS) {
        return NextResponse.json(
          { success: false, error: "Image size exceeds maximum allowed limit (10MB)" },
          { status: 413 }
        );
      }

      if (imageUrl.startsWith("data:")) {
        const mimeMatch = imageUrl.match(/^data:([a-zA-Z0-9\-.+]+\/[a-zA-Z0-9\-.+]+);base64,/);
        if (!mimeMatch) {
          return NextResponse.json(
            { success: false, error: "Invalid base64 data URI format" },
            { status: 400 }
          );
        }
        const mime = mimeMatch[1].toLowerCase();
        if (!ALLOWED_MIME_TYPES.includes(mime)) {
          return NextResponse.json(
            { success: false, error: `Unsupported image format: ${mime}. Allowed formats: JPEG, PNG, WEBP, GIF, BMP.` },
            { status: 415 }
          );
        }
      } else if (!imageUrl.startsWith("http://") && !imageUrl.startsWith("https://")) {
        return NextResponse.json(
          { success: false, error: "Image URL must be a valid http/https URL or base64 data URI" },
          { status: 400 }
        );
      }
    }

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
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to extract transactions" },
      { status: 500 }
    );
  }
}
