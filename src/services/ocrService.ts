import path from 'path';
import { createWorker } from 'tesseract.js';
import { AIExtractionResult, parseDiaryText } from './aiService';

export interface OCRResult {
  rawText: string;
  structuredResult?: AIExtractionResult;
  engineUsed: 'GEMINI_VISION' | 'OPENAI_VISION' | 'LOCAL_TESSERACT_OCR';
  confidence?: number;
  notice?: string;
  processingTimeMs?: number;
}

import fs from 'fs';

function getWorkerScriptPath(): string {
  // Use absolute disk path directly from process.cwd() so Node worker_threads gets a valid OS file path,
  // preventing Webpack's (rsc) virtual resolver prefix error in Next.js
  const diskPath = path.resolve(process.cwd(), 'node_modules', 'tesseract.js', 'src', 'worker-script', 'node', 'index.js');
  return diskPath;
}

// Persistent singleton Tesseract worker for sub-second recognition
let cachedWorker: any = null;
let workerInitPromise: Promise<any> | null = null;

export async function getOcrWorker() {
  if (cachedWorker) return cachedWorker;
  if (workerInitPromise) return workerInitPromise;

  workerInitPromise = (async () => {
    try {
      const workerPath = getWorkerScriptPath();
      const worker = await createWorker('eng', 1, { workerPath });
      cachedWorker = worker;
      return worker;
    } catch (err) {
      workerInitPromise = null;
      throw err;
    }
  })();

  return workerInitPromise;
}

// Pre-warm the OCR worker in the background when running in Node.js
if (typeof window === 'undefined') {
  getOcrWorker().catch((err) => {
    console.warn('Tesseract OCR background pre-warm note:', err.message);
  });
}

export function cleanOcrText(text: string): string {
  if (!text) return '';
  return text
    .split(/\r?\n/)
    .map((line) => {
      let l = line.trim();
      // Remove noise characters at start and end
      l = l.replace(/^[^a-zA-Z0-9\u0600-\u06FF]+/, '');
      l = l.replace(/[^a-zA-Z0-9\u0600-\u06FF\)]+$/, '');
      // Common OCR misreads for numbers: e.g. 25O00 -> 25000
      l = l.replace(/(\d)[Oo](\d)/g, '$10$2');
      l = l.replace(/(\d)[Oo](\d)/g, '$10$2');

      // Convert Urdu digits to English digits
      const urduDigits: Record<string, string> = {
        '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
        '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
      };
      l = l.replace(/[۰-۹]/g, (d) => urduDigits[d] || d);

      return l;
    })
    .filter((l) => l.length > 0)
    .join('\n');
}

export async function extractFromImage(params: {
  imageUrl: string;
  customApiKey?: string;
  hintText?: string;
}): Promise<OCRResult> {
  const startTime = Date.now();
  const { imageUrl, customApiKey, hintText } = params;

  let mimeType = 'image/jpeg';
  let base64Data = imageUrl;
  const match = imageUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (match) {
    mimeType = match[1];
    base64Data = match[2];
  }

  // 1. Check for Gemini API Key (Fast Cloud Vision)
  const geminiKey =
    (customApiKey && customApiKey.startsWith('AIza') ? customApiKey : null) ||
    process.env.GEMINI_API_KEY;

  if (geminiKey && geminiKey.trim().length > 10) {
    try {
      const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;

      const prompt = `You are an expert Pakistani business accountant and OCR specialist.
Extract all accounting and financial entries from this document (which may be a handwritten daily ledger slip, notebook diary, sales bill, cash memo, vendor purchase invoice, or expense voucher in English, Urdu, or Roman Urdu).

Return ONLY a valid JSON object matching this schema:
{
  "documentDate": "YYYY-MM-DD",
  "extractedText": "exact verbatim text transcribed from the image",
  "transactions": [
    {
      "type": "SALE" | "PURCHASE" | "PAYMENT_RECEIVED" | "PAYMENT_MADE" | "EXPENSE" | "STOCK_ADJUSTMENT",
      "partyName": "Customer or Supplier or Expense Category name",
      "items": [
        {
          "productName": "Item/Model description",
          "quantity": 1,
          "unitPrice": 0,
          "lineTotal": 0
        }
      ],
      "totalAmount": 0,
      "paidAmount": 0,
      "remainingAmount": 0,
      "paymentMethod": "CASH" | "BANK" | "CREDIT",
      "notes": "Transaction details or original line",
      "confidence": 0.95,
      "needsConfirmation": false,
      "warnings": []
    }
  ]
}
If amounts are in PKR (e.g. 25,000 or 15k or 2.5 lac), convert to standard numbers (25000).
If payment is partial, set paidAmount and remainingAmount accordingly. If credit/udhaar, paidAmount=0 and remainingAmount=totalAmount.`;

      // Fast fetch with 8 second timeout to avoid hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(geminiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt + (hintText ? `\nUser notes/hints: ${hintText}` : '') },
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        const textContent = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textContent) {
          const parsed = JSON.parse(textContent);
          const structuredResult: AIExtractionResult = {
            documentDate: parsed.documentDate || new Date().toISOString().split('T')[0],
            transactions: parsed.transactions || [],
            sourceText: parsed.extractedText || '',
            isSimulated: false,
            providerNotice: 'Extracted via Google Gemini 1.5 Flash Vision Multimodal AI',
          };

          return {
            rawText: parsed.extractedText || '',
            structuredResult,
            engineUsed: 'GEMINI_VISION',
            confidence: 0.96,
            notice: 'Successfully parsed using Google Gemini Multimodal Vision',
            processingTimeMs: Date.now() - startTime,
          };
        }
      } else {
        console.warn('Gemini API call failed, falling back to fast local OCR:', await res.text());
      }
    } catch (err: any) {
      console.warn('Gemini Vision extraction error/timeout:', err.message);
    }
  }

  // 2. Check for OpenAI API Key
  const openAiKey =
    (customApiKey && customApiKey.startsWith('sk-') ? customApiKey : null) ||
    (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith('sk-') ? process.env.OPENAI_API_KEY : null);

  if (openAiKey) {
    try {
      const openAiUrl = 'https://api.openai.com/v1/chat/completions';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(openAiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openAiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are an expert Pakistani business accountant. Extract all financial transactions from this document.',
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Extract transactions from this image.' },
                { type: 'image_url', image_url: { url: imageUrl.startsWith('data:') ? imageUrl : `data:${mimeType};base64,${base64Data}` } },
              ],
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
        }),
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        const content = json.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          const structuredResult: AIExtractionResult = {
            documentDate: parsed.documentDate || new Date().toISOString().split('T')[0],
            transactions: parsed.transactions || [],
            sourceText: parsed.extractedText || '',
            isSimulated: false,
            providerNotice: 'Extracted via OpenAI GPT-4o Vision',
          };

          return {
            rawText: parsed.extractedText || '',
            structuredResult,
            engineUsed: 'OPENAI_VISION',
            confidence: 0.95,
            notice: 'Successfully parsed using OpenAI GPT-4o Vision',
            processingTimeMs: Date.now() - startTime,
          };
        }
      }
    } catch (err: any) {
      console.warn('OpenAI Vision extraction error:', err.message);
    }
  }

  // 3. High-Speed Local Tesseract.js OCR Engine (Reuses Persistent Singleton Worker with Explicit Path)
  try {
    const worker = await getOcrWorker();
    const imageBuffer = Buffer.from(base64Data, 'base64');
    const ret = await worker.recognize(imageBuffer);

    const rawText = cleanOcrText(ret.data.text);
    const structuredResult = rawText.trim()
      ? parseDiaryText(rawText)
      : { documentDate: new Date().toISOString().split('T')[0], transactions: [], sourceText: '' };
    structuredResult.sourceText = rawText;
    structuredResult.providerNotice =
      'Processed with SmartBiz Built-in OCR Engine (Tesseract). Connect Google Gemini API key for complex handwriting.';

    const duration = Date.now() - startTime;

    return {
      rawText: rawText || '(No legible text detected by OCR. Please try higher contrast or clean handwriting.)',
      structuredResult,
      engineUsed: 'LOCAL_TESSERACT_OCR',
      confidence: ret.data.confidence ? ret.data.confidence / 100 : 0.85,
      notice: rawText.trim()
        ? `Scanned in ${Math.round(duration)}ms using High-Speed Local OCR Engine`
        : 'تصویر سے متن پڑھا نہیں جا سکا۔ براہ کرم واضح تصویر فراہم کریں۔ (No legible text detected in image)',
      processingTimeMs: duration,
    };
  } catch (ocrErr: any) {
    // If persistent worker had a glitch, re-spawn once and retry with explicit workerPath
    try {
      cachedWorker = null;
      workerInitPromise = null;
      const workerPath = getWorkerScriptPath();
      const freshWorker = await createWorker('eng', 1, { workerPath });
      cachedWorker = freshWorker;

      const imageBuffer = Buffer.from(base64Data, 'base64');
      const ret = await freshWorker.recognize(imageBuffer);
      const rawText = cleanOcrText(ret.data.text);
      const structuredResult = rawText.trim()
        ? parseDiaryText(rawText)
        : { documentDate: new Date().toISOString().split('T')[0], transactions: [], sourceText: '' };

      const duration = Date.now() - startTime;

      return {
        rawText: rawText || '',
        structuredResult,
        engineUsed: 'LOCAL_TESSERACT_OCR',
        confidence: ret.data.confidence ? ret.data.confidence / 100 : 0.85,
        notice: rawText.trim()
          ? `Scanned in ${Math.round(duration)}ms using High-Speed Local OCR Engine`
          : 'تصویر سے متن پڑھا نہیں جا سکا۔ براہ کرم واضح تصویر فراہم کریں۔ (No legible text detected in image)',
        processingTimeMs: duration,
      };
    } catch (retryErr: any) {
      console.error('Local Tesseract OCR fallback error:', retryErr);
      return {
        rawText: '',
        structuredResult: { documentDate: new Date().toISOString().split('T')[0], transactions: [], sourceText: '' },
        engineUsed: 'LOCAL_TESSERACT_OCR',
        confidence: 0,
        notice: `تصویر پڑھنے میں تکنیکی مسئلہ: ${retryErr.message}`,
        processingTimeMs: Date.now() - startTime,
      };
    }
  }
}
