import { prisma } from "@/lib/prisma";
import { Decimal, round2, round4, toDecimal } from "@/lib/decimal";
import { AISource, AIItemStatus, Prisma } from "@prisma/client";
import { createAndPostSale } from "./salesService";
import { createAndPostPurchase } from "./purchaseService";
import { recordCustomerPayment, recordSupplierPayment } from "./paymentService";
import { createAndPostExpense } from "./expenseService";
import { extractFromImage } from "./ocrService";

export interface ExtractedItemDTO {
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  productMatchedId?: string | null;
}

export interface ExtractedTransactionDTO {
  type: "SALE" | "PURCHASE" | "PAYMENT_RECEIVED" | "PAYMENT_MADE" | "EXPENSE" | "STOCK_ADJUSTMENT";
  partyName?: string;
  partyMatchedId?: string | null;
  partyMatchedType?: "CUSTOMER" | "SUPPLIER" | null;
  items?: ExtractedItemDTO[];
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentMethod: string;
  date?: string;
  notes?: string;
  confidence: number;
  needsConfirmation: boolean;
  warnings?: string[];
  isDuplicate?: boolean;
}

export interface AIExtractionResult {
  documentDate: string;
  transactions: ExtractedTransactionDTO[];
  sourceText?: string;
  isSimulated?: boolean;
  providerNotice?: string;
}

/**
 * Normalizes spoken Urdu, Roman Urdu, and English accounting text:
 * - Converts Urdu digits (۰-۹) to standard (0-9)
 * - Converts Urdu/Roman spoken number words (e.g. pachees hazar -> 25000, 10 hazar -> 10000, ۲۵ ہزار -> 25000)
 * - Multipliers (hazar, laakh, sau, ہزار, لاکھ, سو, k)
 * - Removes spoken conversational prefixes (aaj, kal, likho, sunao, bhai, آج, لکھو)
 */
export function normalizeSpokenAccountingText(input: string): string {
  if (!input) return "";

  let text = input;

  // 1. Urdu digits to standard digits
  const urduDigits: Record<string, string> = {
    "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
    "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
  };
  text = text.replace(/[۰-۹]/g, (d) => urduDigits[d] || d);

  // 2. Remove spoken greeting/conversational prefixes from start of lines
  text = text.replace(
    /^(?:aaj\s+ki\s+entry|aaj\s+ki\s+sale|aaj\s+ka\s+hisaab|aaj|kal|bhai|likho|note\s*karo|record\s*karo|entry\s*karo|sunao|آج\s*کی\s*سیل|آج\s*کی\s*انٹری|آج|کل|بھائی|لکھو|نوٹ\s*کرو|اندراج\s*کرو)\s*[:,\-]?\s*/i,
    ""
  );

  // 3. Special fractional spoken phrases (dedh/dhai lakh/hazar)
  text = text.replace(/\b(?:dedh|deedh)\s*(?:lakh|laakh|lac)\b/gi, "150000");
  text = text.replace(/\b(?:dhai|dhaai)\s*(?:lakh|laakh|lac)\b/gi, "250000");
  text = text.replace(/\b(?:dedh|deedh)\s*(?:hazar|hazaar|hazr)\b/gi, "1500");
  text = text.replace(/\b(?:dhai|dhaai)\s*(?:hazar|hazaar|hazr)\b/gi, "2500");
  text = text.replace(/(?:ڈیڑھ|دیڑھ)\s*(?:لاکھ|lakh)/gi, "150000");
  text = text.replace(/(?:ڈھائی)\s*(?:لاکھ|lakh)/gi, "250000");
  text = text.replace(/(?:ڈیڑھ|دیڑھ)\s*(?:ہزار|hazar)/gi, "1500");
  text = text.replace(/(?:ڈھائی)\s*(?:ہزار|hazar)/gi, "2500");

  // 4. Spoken compound word numbers (Urdu words to digits)
  const urduWordNumbers: Record<string, number> = {
    "ایک": 1, "دو": 2, "تین": 3, "چار": 4, "پانچ": 5, "چھ": 6, "سات": 7, "آٹھ": 8, "نو": 9, "دس": 10,
    "گیارہ": 11, "بارہ": 12, "تیرہ": 13, "چودہ": 14, "پندرہ": 15, "سولہ": 16, "سترہ": 17, "اٹھارہ": 18, "انیس": 19, "بیس": 20,
    "پچیس": 25, "تیس": 30, "پینتیس": 35, "چالیس": 40, "پنتالیس": 45, "پچاس": 50, "ساٹھ": 60, "ستر": 70, "اسی": 80, "نوے": 90,
  };

  for (const [word, num] of Object.entries(urduWordNumbers)) {
    const reg = new RegExp(`(?:^|\\s)${word}(?:$|\\s)`, "g");
    text = text.replace(reg, (match) => match.replace(word, String(num)));
  }

  // 5. Roman Urdu number words to digits
  const romanWordNumbers: Record<string, number> = {
    "pachees": 25, "pachas": 50, "pachaas": 50, "chalees": 40, "tees": 30, "bees": 20,
    "unnees": 19, "atharah": 18, "satrah": 17, "solah": 16, "pandrah": 15, "chaudah": 14,
    "terah": 13, "barah": 12, "gyarah": 11, "das": 10, "nau": 9, "aath": 8, "saat": 7,
    "chhe": 6, "che": 6, "panch": 5, "paanch": 5, "chaar": 4, "char": 4, "teen": 3, "do": 2, "ek": 1,
    "saath": 60, "sattar": 70, "assi": 80, "naway": 90,
  };

  for (const [word, num] of Object.entries(romanWordNumbers)) {
    const reg = new RegExp(`\\b${word}\\b`, "gi");
    text = text.replace(reg, String(num));
  }

  // 6. Number + Multipliers:
  // Roman/English multipliers with \b
  text = text.replace(/(\d+(?:\.\d+)?)\s*(?:laakh|lakh|lac)\b/gi, (_, n) => String(Math.round(parseFloat(n) * 100000)));
  text = text.replace(/(\d+(?:\.\d+)?)\s*(?:hazar|hazaar|hazr)\b/gi, (_, n) => String(Math.round(parseFloat(n) * 1000)));
  text = text.replace(/(\d+(?:\.\d+)?)\s*(?:sau|so)\b/gi, (_, n) => String(Math.round(parseFloat(n) * 100)));
  text = text.replace(/\b(\d+)k\b/gi, (_, n) => String(parseInt(n, 10) * 1000));

  // Urdu script multipliers
  text = text.replace(/(\d+(?:\.\d+)?)\s*لاکھ(?:\s|$|[^a-zA-Z0-9\u0600-\u06FF])/g, (_, n) => `${Math.round(parseFloat(n) * 100000)} `);
  text = text.replace(/(\d+(?:\.\d+)?)\s*ہزار(?:\s|$|[^a-zA-Z0-9\u0600-\u06FF])/g, (_, n) => `${Math.round(parseFloat(n) * 1000)} `);
  text = text.replace(/(\d+(?:\.\d+)?)\s*سو(?:\s|$|[^a-zA-Z0-9\u0600-\u06FF])/g, (_, n) => `${Math.round(parseFloat(n) * 100)} `);

  return text;
}

/**
 * Intelligent parser that can parse English, Urdu script, and Roman Urdu accounting notes
 * e.g. "Ali Traders ko 25,000 ki sale hui, 10,000 cash received"
 * e.g. "علی ٹریڈرز کو ۲۵ ہزار کی سیل ہوئی ۱۰ ہزار نقد ملا"
 */
export function parseDiaryText(text: string, referenceDate = new Date()): AIExtractionResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const transactions: ExtractedTransactionDTO[] = [];
  const docDateStr = referenceDate.toISOString().split("T")[0];

  const fullTextLower = text.toLowerCase();

  // Multi-line Invoice / Bill check:
  const isInvoiceDoc =
    (fullTextLower.includes("invoice") ||
      fullTextLower.includes("cash memo") ||
      fullTextLower.includes("sale bill") ||
      fullTextLower.includes("purchase bill") ||
      fullTextLower.includes("vendor bill") ||
      fullTextLower.includes("bill to") ||
      fullTextLower.includes("sold to")) &&
    (fullTextLower.includes("total") || fullTextLower.includes("amount") || fullTextLower.includes("rs"));

  if (isInvoiceDoc) {
    let customerName = "";
    let supplierName = "";
    let totalAmt = 0;
    let paidAmt = 0;
    let balanceAmt = 0;
    let paymentMethod = "CASH";
    const billItems: ExtractedItemDTO[] = [];
    const isPurchase =
      fullTextLower.includes("purchase") ||
      fullTextLower.includes("supplier") ||
      fullTextLower.includes("vendor") ||
      fullTextLower.includes("inward");

    for (const line of lines) {
      const normalizedLine = normalizeSpokenAccountingText(line);
      const lLower = normalizedLine.toLowerCase();
      const custMatch = normalizedLine.match(/(?:customer|buyer|m\/s|sold to|client)\s*[:\-]?\s*([A-Za-z0-9\s]+?)(?:\s*\(|\s*$|\s*,|\s*\n)/i);
      if (
        custMatch &&
        !customerName &&
        !lLower.includes("total") &&
        !lLower.includes("date") &&
        !custMatch[1].toLowerCase().includes("invoice") &&
        !custMatch[1].toLowerCase().includes("bill") &&
        !custMatch[1].toLowerCase().includes("memo")
      ) {
        customerName = custMatch[1].trim();
      }
      const suppMatch = normalizedLine.match(/(?:supplier|vendor|from)\s*[:\-]?\s*([A-Za-z0-9\s]+?)(?:\s*\(|\s*$|\s*,|\s*\n)/i);
      if (
        suppMatch &&
        !supplierName &&
        !lLower.includes("total") &&
        !lLower.includes("date") &&
        !suppMatch[1].toLowerCase().includes("invoice") &&
        !suppMatch[1].toLowerCase().includes("bill") &&
        !suppMatch[1].toLowerCase().includes("memo")
      ) {
        supplierName = suppMatch[1].trim();
      }

      if (lLower.includes("total") || lLower.includes("grand total") || lLower.includes("net total") || lLower.includes("net amount")) {
        const nums = Array.from(normalizedLine.matchAll(/(\d[\d,]*)/g)).map((m) => parseFloat(m[1].replace(/,/g, "")));
        if (nums.length > 0) totalAmt = nums[nums.length - 1];
      }
      if (lLower.includes("paid") || lLower.includes("cash received") || lLower.includes("advance") || lLower.includes("wasool")) {
        const nums = Array.from(normalizedLine.matchAll(/(\d[\d,]*)/g)).map((m) => parseFloat(m[1].replace(/,/g, "")));
        if (nums.length > 0) paidAmt = nums[nums.length - 1];
        if (lLower.includes("bank") || lLower.includes("online") || lLower.includes("hbl") || lLower.includes("meezan")) {
          paymentMethod = "BANK";
        }
      }
      if (lLower.includes("balance") || lLower.includes("baqi") || lLower.includes("due") || lLower.includes("remaining")) {
        const nums = Array.from(normalizedLine.matchAll(/(\d[\d,]*)/g)).map((m) => parseFloat(m[1].replace(/,/g, "")));
        if (nums.length > 0) balanceAmt = nums[nums.length - 1];
      }

      // Check line item
      const itemMatch = normalizedLine.match(/^([A-Za-z0-9\s\+\-\/]+?)(?:\s*[:\-]?\s+|\s+)(\d+)?\s*(?:x|\*|qty)?\s*([\d,]+)(?:\s*=\s*|\s+)?([\d,]+)?$/i);
      if (
        itemMatch &&
        !lLower.includes("total") &&
        !lLower.includes("date") &&
        !lLower.includes("phone") &&
        !lLower.includes("customer") &&
        !lLower.includes("supplier") &&
        !lLower.includes("balance")
      ) {
        const pName = itemMatch[1].trim();
        const qty = itemMatch[2] ? parseInt(itemMatch[2], 10) : 1;
        const p1 = parseFloat(itemMatch[3].replace(/,/g, ""));
        const p2 = itemMatch[4] ? parseFloat(itemMatch[4].replace(/,/g, "")) : p1 * qty;
        if (pName.length > 2 && p1 > 0) {
          billItems.push({
            productName: pName,
            quantity: qty,
            unitPrice: p1,
            lineTotal: p2 || p1 * qty,
          });
        }
      }
    }

    if (totalAmt > 0 || billItems.length > 0) {
      if (totalAmt === 0 && billItems.length > 0) {
        totalAmt = billItems.reduce((acc, i) => acc + i.lineTotal, 0);
      }
      if (paidAmt === 0 && balanceAmt === 0) {
        paidAmt = totalAmt;
      } else if (balanceAmt > 0 && paidAmt === 0) {
        paidAmt = Math.max(0, totalAmt - balanceAmt);
      }
      const remAmt = balanceAmt > 0 ? balanceAmt : Math.max(0, totalAmt - paidAmt);

      transactions.push({
        type: isPurchase ? "PURCHASE" : "SALE",
        partyName: isPurchase ? (supplierName || "General Supplier") : (customerName || "Walk-in Customer"),
        partyMatchedType: isPurchase ? "SUPPLIER" : "CUSTOMER",
        items: billItems.length > 0 ? billItems : undefined,
        totalAmount: totalAmt,
        paidAmount: paidAmt,
        remainingAmount: remAmt,
        paymentMethod: remAmt > 0 ? (paidAmt > 0 ? "PARTIAL" : "CREDIT") : paymentMethod,
        notes: `Extracted from invoice document (${billItems.length} item(s)).`,
        confidence: 0.95,
        needsConfirmation: false,
        warnings: [],
      });

      return {
        documentDate: docDateStr,
        transactions,
        sourceText: text,
      };
    }
  }

  for (const line of lines) {
    const normalized = normalizeSpokenAccountingText(line);
    const clean = normalized.replace(/^\d+[\.\)]\s*/, "").trim(); // remove bullet numbers like "1." or "2)"
    if (!clean) continue;
    const lower = clean.toLowerCase();

    // 0. Specific Handwritten Ledger Patterns (from client physical books):
    // e.g. "HYD Rec - HBL 50000" or "Imran c/o Asif Rec - HBL 10000" or "Sami Rec - HBL 265000"
    const recMatch = clean.match(/^([a-zA-Z0-9\u0600-\u06FF\s.&/\(\)-]+?)\s+(?:rec|received|wasool|وصول|وصولی)\b(?:\s*-\s*|\s+)(?:(hbl|bank|mbl|ubl|cash|بینک|کیش|نقد)\s+)?([\d,]+)/i);
    if (recMatch) {
      const party = recMatch[1].trim();
      const methodStr = (recMatch[2] || "").toLowerCase();
      const amount = parseFloat(recMatch[3].replace(/,/g, ""));
      const isBank = methodStr.includes("hbl") || methodStr.includes("bank") || methodStr.includes("mbl") || methodStr.includes("ubl") || clean.includes("بینک");

      transactions.push({
        type: "PAYMENT_RECEIVED",
        partyName: party,
        partyMatchedType: "CUSTOMER",
        totalAmount: amount,
        paidAmount: amount,
        remainingAmount: 0,
        paymentMethod: isBank ? "BANK" : "CASH",
        notes: clean,
        confidence: 0.98,
        needsConfirmation: false,
        warnings: [],
      });
      continue;
    }

    // 0b. Mobile Phone / Item Sale e.g. "IPH 11 NON 64 - HBL 36000" or "Pixel 7A - 35000" or "Relme C85 Pro - 54000" or "Spark 10C - 21000"
    const isMobileModel = /\b(?:iph|iphone|pixel|realme|relme|spark|camon|redmi|note|samsung|vivo|oppo)\b|\b(?:[sy]\s*\d+|a\d+)\b/i.test(clean);
    const modelSaleMatch = clean.match(/^(.+?)(?:\s*-\s*|\s+)(?:(hbl|bank|cash|بینک|کیش|نقد)\s+)?([\d,]+)$/i);
    if (isMobileModel && modelSaleMatch && !lower.includes("purchase") && !lower.includes("rec") && !clean.includes("خرید") && !clean.includes("وصول")) {
      const itemName = modelSaleMatch[1].trim();
      const methodStr = (modelSaleMatch[2] || "").toLowerCase();
      const amount = parseFloat(modelSaleMatch[3].replace(/,/g, ""));
      const isBank = methodStr.includes("hbl") || methodStr.includes("bank") || clean.includes("بینک");

      transactions.push({
        type: "SALE",
        partyName: "Walk-in Customer",
        partyMatchedType: "CUSTOMER",
        items: [
          {
            productName: itemName,
            quantity: 1,
            unitPrice: amount,
            lineTotal: amount,
          },
        ],
        totalAmount: amount,
        paidAmount: amount,
        remainingAmount: 0,
        paymentMethod: isBank ? "BANK" : "CASH",
        notes: clean,
        confidence: 0.96,
        needsConfirmation: false,
        warnings: [],
      });
      continue;
    }

    // 0c. Account / Ledger Table Row (e.g. Pakistani Software trial balance or customer/supplier ledger sheet)
    // Format: "ACR00047 A REHMAN SHOP 80,000.00" or "ACR00366 IMRAN C/O ASIF 180,000.00" or "ACR00242 BANK HBL 528,500.00"
    if (lower.includes("a/c code") || lower.includes("a/c name") || (lower.includes("debit") && lower.includes("credit"))) {
      continue; // Skip table header line
    }

    const tableLedgerMatch = clean.match(/^(?:(ACR\d+|AC\d+|GL\d+|[A-Z]{1,4}\d{2,6})\s+)?([A-Za-z0-9\u0600-\u06FF\s/&.-]+?)\s+([\d,]+(?:\.\d{2})?)(?:\s+([\d,]+(?:\.\d{2})?))?(?:\s+[\d-]+)?\s*$/i);
    if (tableLedgerMatch && !lower.includes("sale") && !lower.includes("purchase") && !lower.includes("maal") && !clean.includes("سیل") && !clean.includes("خرید")) {
      const acCode = tableLedgerMatch[1] || "";
      const rawParty = tableLedgerMatch[2].trim();
      const firstNum = parseFloat(tableLedgerMatch[3].replace(/,/g, ""));
      const secondNum = tableLedgerMatch[4] ? parseFloat(tableLedgerMatch[4].replace(/,/g, "")) : null;

      const hasAcCode = Boolean(acCode);
      const hasTwoCols = secondNum !== null;
      const partyLower = rawParty.toLowerCase();
      const isKnownEntity =
        partyLower.includes("c/o") ||
        partyLower.includes("shop") ||
        partyLower.includes("store") ||
        partyLower.includes("telecom") ||
        partyLower.includes("traders") ||
        partyLower.includes("bank") ||
        partyLower.includes("cash") ||
        partyLower.includes("rent") ||
        partyLower.includes("expense") ||
        partyLower.includes("bill");

      // Table row must have A/C Code, Debit/Credit columns, or known ledger keyword
      if (rawParty.length >= 2 && firstNum > 0 && (hasAcCode || hasTwoCols || isKnownEntity)) {

        if (partyLower === "cash" || partyLower.startsWith("cash ")) {
          transactions.push({
            type: "PAYMENT_RECEIVED",
            partyName: "Cash in Hand",
            partyMatchedType: "CUSTOMER",
            totalAmount: firstNum,
            paidAmount: firstNum,
            remainingAmount: 0,
            paymentMethod: "CASH",
            notes: `Ledger A/C: ${acCode ? acCode + " - " : ""}${rawParty}`,
            confidence: 0.96,
            needsConfirmation: false,
            warnings: [],
          });
          continue;
        }

        if (partyLower.includes("bank") || partyLower.includes("hbl") || partyLower.includes("ubl") || partyLower.includes("mcb") || partyLower.includes("meezan")) {
          transactions.push({
            type: "PAYMENT_RECEIVED",
            partyName: rawParty,
            partyMatchedType: "CUSTOMER",
            totalAmount: firstNum,
            paidAmount: firstNum,
            remainingAmount: 0,
            paymentMethod: "BANK",
            notes: `Bank Ledger A/C: ${acCode ? acCode + " - " : ""}${rawParty}`,
            confidence: 0.96,
            needsConfirmation: false,
            warnings: [],
          });
          continue;
        }

        if (partyLower.includes("rent") || partyLower.includes("expense") || partyLower.includes("bill") || partyLower.includes("salary")) {
          transactions.push({
            type: "EXPENSE",
            partyName: rawParty,
            totalAmount: firstNum,
            paidAmount: firstNum,
            remainingAmount: 0,
            paymentMethod: "CASH",
            notes: `Expense A/C: ${acCode ? acCode + " - " : ""}${rawParty}`,
            confidence: 0.95,
            needsConfirmation: false,
            warnings: [],
          });
          continue;
        }

        // Standard Customer or Supplier Ledger Balance:
        // Debit balance (firstNum) or Credit balance (secondNum)
        const isCreditCol = secondNum !== null && secondNum > 0 && firstNum === 0;
        const total = isCreditCol ? secondNum : firstNum;

        transactions.push({
          type: isCreditCol ? "PAYMENT_RECEIVED" : "SALE",
          partyName: rawParty,
          partyMatchedType: isCreditCol ? "SUPPLIER" : "CUSTOMER",
          totalAmount: total,
          paidAmount: 0,
          remainingAmount: total,
          paymentMethod: "CREDIT",
          notes: `Ledger A/C: ${acCode ? acCode + " - " : ""}${rawParty}`,
          confidence: 0.92,
          needsConfirmation: false,
          warnings: [],
        });
        continue;
      }
    }

    // 1. Expense Detection:
    // e.g. "Expense - 500" or "Shop electricity 3,000 paid cash" or "Transport 1500" or "دکان کا بجلی کا بل ۳۵۰۰ کیش ادا کیا"
    if (
      lower.includes("bill") ||
      lower.includes("electricity") ||
      lower.includes("rent") ||
      lower.includes("transport") ||
      lower.includes("fuel") ||
      lower.includes("expense") ||
      lower.includes("kharcha") ||
      lower.includes("petrol") ||
      lower.includes("chai") ||
      lower.includes("tea") ||
      clean.includes("خرچہ") ||
      clean.includes("خرچ") ||
      clean.includes("بل") ||
      clean.includes("بجلی") ||
      clean.includes("کرایہ") ||
      clean.includes("پٹرول") ||
      clean.includes("چائے") ||
      clean.includes("کھانا") ||
      clean.includes("تنخواہ") ||
      clean.includes("اخراجات")
    ) {
      const numMatches = Array.from(clean.matchAll(/(\d[\d,]*)/g)).map((m) => parseFloat(m[1].replace(/,/g, "")));
      const amount = numMatches.length > 0 ? numMatches[numMatches.length - 1] : 0;
      let cat = "Miscellaneous Expense";
      if (lower.includes("electricity") || lower.includes("bijli") || clean.includes("بجلی")) cat = "Electricity";
      else if (lower.includes("rent") || lower.includes("kiraya") || clean.includes("کرایہ")) cat = "Rent";
      else if (lower.includes("transport") || lower.includes("kiraya gari") || clean.includes("گاڑی") || clean.includes("کرایہ گاڑی")) cat = "Transport";
      else if (lower.includes("fuel") || lower.includes("petrol") || clean.includes("پٹرول")) cat = "Fuel";
      else if (lower.includes("chai") || lower.includes("tea") || clean.includes("چائے") || lower.includes("khana") || clean.includes("کھانا")) cat = "Tea & Refreshment";
      else if (lower.includes("salary") || lower.includes("tankhwah") || clean.includes("تنخواہ")) cat = "Salaries";

      const isBank = lower.includes("bank") || lower.includes("online") || clean.includes("بینک") || clean.includes("آن لائن");

      transactions.push({
        type: "EXPENSE",
        partyName: cat,
        totalAmount: amount,
        paidAmount: amount,
        remainingAmount: 0,
        paymentMethod: isBank ? "BANK" : "CASH",
        notes: clean,
        confidence: amount > 0 ? 0.95 : 0.6,
        needsConfirmation: amount === 0,
        warnings: amount === 0 ? ["Could not determine exact expense amount"] : [],
      });
      continue;
    }

    // 2. Customer Receipt / Udhaar wapsi / Payment Received
    // e.g. "Bilal ne purana udhaar 8,000 diya" or "Received 5000 from Usman" or "علی نے ۱۰ ہزار پرانا ادھار دیا"
    if (
      (lower.includes("udhaar") && (lower.includes("diya") || lower.includes("mila") || lower.includes("wapas") || lower.includes("wapsi"))) ||
      lower.includes("received from") ||
      lower.includes("payment received") ||
      lower.includes("ne paise diye") ||
      lower.includes("se wasool") ||
      lower.includes("wasool hui") ||
      clean.includes("وصول") ||
      clean.includes("ادھار واپس") ||
      clean.includes("پیسے ملے") ||
      clean.includes("رقم وصول")
    ) {
      const numMatches = Array.from(clean.matchAll(/(\d[\d,]*)/g)).map((m) => parseFloat(m[1].replace(/,/g, "")));
      const amount = numMatches.length > 0 ? numMatches[numMatches.length - 1] : 0;
      const partyMatch = clean.match(/^([a-zA-Z0-9\u0600-\u06FF\s.&/\(\)-]+?)(?:\s+ne|\s+se|\s+ko|\s+gave|\s+paid|\s+نے|\s+سے|\s+کو)/i);
      const party = partyMatch ? partyMatch[1].trim() : "Customer";
      const isBank = lower.includes("bank") || lower.includes("online") || clean.includes("بینک") || clean.includes("آن لائن");

      transactions.push({
        type: "PAYMENT_RECEIVED",
        partyName: party,
        partyMatchedType: "CUSTOMER",
        totalAmount: amount,
        paidAmount: amount,
        remainingAmount: 0,
        paymentMethod: isBank ? "BANK" : "CASH",
        notes: clean,
        confidence: 0.9,
        needsConfirmation: amount === 0,
        warnings: amount === 0 ? ["Amount unclear"] : [],
      });
      continue;
    }

    // 3. Purchase Detection
    // e.g. "Ahmed se 15,000 ka maal purchase kiya, payment baqi hai" or "احمد سے ۱۵۰۰۰ کا مال خریدا ادھار"
    if (
      lower.includes("purchase") ||
      lower.includes("khareeda") ||
      lower.includes("maal liya") ||
      lower.includes("kharida") ||
      clean.includes("خرید") ||
      clean.includes("خریدا") ||
      clean.includes("خریداری") ||
      clean.includes("مال لیا") ||
      clean.includes("مال خریدا")
    ) {
      const numMatches = Array.from(clean.matchAll(/(\d[\d,]*)/g)).map((m) =>
        parseFloat(m[1].replace(/,/g, ""))
      );
      let totalAmount = numMatches.length > 0 ? Math.max(...numMatches) : 0;
      let paidAmount = 0;

      const hasUdhar = lower.includes("baqi") || lower.includes("udhaar") || lower.includes("unpaid") || lower.includes("credit") || clean.includes("ادھار") || clean.includes("باقی");
      const hasPaid = lower.includes("cash") || lower.includes("paid") || lower.includes("diya") || clean.includes("نقد") || clean.includes("کیش") || clean.includes("دیا");

      if (numMatches.length >= 2) {
        paidAmount = Math.min(...numMatches);
      } else if (hasUdhar && !hasPaid) {
        paidAmount = 0;
      } else if (hasPaid) {
        paidAmount = totalAmount;
      }

      const partyMatch = clean.match(/^([a-zA-Z0-9\u0600-\u06FF\s.&/\(\)-]+?)(?:\s+se|\s+supplier|\s+سے)/i);
      const party = partyMatch ? partyMatch[1].trim() : "Supplier";
      const isBank = lower.includes("bank") || lower.includes("online") || clean.includes("بینک") || clean.includes("آن لائن");

      transactions.push({
        type: "PURCHASE",
        partyName: party,
        partyMatchedType: "SUPPLIER",
        totalAmount,
        paidAmount,
        remainingAmount: Math.max(0, totalAmount - paidAmount),
        paymentMethod: paidAmount > 0 ? (isBank ? "BANK" : "CASH") : "CREDIT",
        notes: clean,
        confidence: 0.9,
        needsConfirmation: totalAmount === 0 || (!hasPaid && !hasUdhar),
        warnings: totalAmount === 0 ? ["Missing total amount"] : [],
      });
      continue;
    }

    // 4. Sale Detection
    // e.g. "Ali Traders ko 25,000 ki sale hui, 10,000 cash received" or "علی ٹریڈرز کو ۲۵ ہزار کی سیل ہوئی ۱۰ ہزار نقد ملا"
    if (
      lower.includes("sale") ||
      lower.includes("becha") ||
      lower.includes("bechi") ||
      lower.includes("beche") ||
      lower.includes("maal diya") ||
      lower.includes("sold") ||
      clean.includes("سیل") ||
      clean.includes("فروخت") ||
      clean.includes("بیچا") ||
      clean.includes("بیچی") ||
      clean.includes("بیچے") ||
      clean.includes("مال دیا")
    ) {
      const numMatches = Array.from(clean.matchAll(/(\d[\d,]*)/g)).map((m) =>
        parseFloat(m[1].replace(/,/g, ""))
      );
      let totalAmount = numMatches.length > 0 ? Math.max(...numMatches) : 0;
      let paidAmount = 0;

      const hasPaid = lower.includes("cash received") || lower.includes("cash mila") || lower.includes("paid") || lower.includes("mila") || clean.includes("نقد ملا") || clean.includes("کیش ملا") || clean.includes("وصول") || clean.includes("ملا") || clean.includes("ملے");
      const hasCredit = lower.includes("udhaar") || lower.includes("baqi") || lower.includes("credit") || clean.includes("ادھار") || clean.includes("باقی");

      if (numMatches.length >= 2) {
        paidAmount = Math.min(...numMatches);
      } else if (hasCredit && !hasPaid) {
        paidAmount = 0;
      } else if (hasPaid) {
        paidAmount = totalAmount;
      }

      const partyMatch = clean.match(/^([a-zA-Z0-9\u0600-\u06FF\s.&/\(\)-]+?)(?:\s+ko|\s+customer|\s+کو)/i);
      const party = partyMatch ? partyMatch[1].trim() : "Walk-in Customer";
      const isBank = lower.includes("bank") || lower.includes("online") || clean.includes("بینک") || clean.includes("آن لائن");

      transactions.push({
        type: "SALE",
        partyName: party,
        partyMatchedType: "CUSTOMER",
        totalAmount,
        paidAmount,
        remainingAmount: Math.max(0, totalAmount - paidAmount),
        paymentMethod: paidAmount > 0 ? (isBank ? "BANK" : "CASH") : "CREDIT",
        notes: clean,
        confidence: 0.94,
        needsConfirmation: totalAmount === 0,
        warnings: totalAmount === 0 ? ["Cannot detect sale total"] : [],
      });
      continue;
    }

    // Fallback: Ambiguous line
    const nums = Array.from(clean.matchAll(/(\d[\d,]*)/g)).map((m) => parseFloat(m[1].replace(/,/g, "")));
    const guessedAmount = nums.length > 0 ? nums[0] : 0;
    const guessedParty = clean.split(/\s+/).slice(0, 2).join(" ") || "Unknown Party";

    transactions.push({
      type: "SALE",
      partyName: guessedParty,
      totalAmount: guessedAmount,
      paidAmount: 0,
      remainingAmount: guessedAmount,
      paymentMethod: "CASH",
      notes: clean,
      confidence: 0.5,
      needsConfirmation: true,
      warnings: ["Ambiguous transaction: Please verify transaction type, party, and amount."],
    });
  }

  return {
    documentDate: docDateStr,
    transactions,
    sourceText: text,
  };
}

/**
 * Executes AI extraction either via OpenAI API if key is present,
 * or using the local intelligent NLP diary parser.
 */
export async function extractTransactionsFromInput(params: {
  businessId: string;
  source: AISource;
  text?: string;
  imageUrl?: string;
  audioUrl?: string;
  createdById?: string;
  customApiKey?: string;
}): Promise<AIImportWithTransactions & { rawOcrText?: string; engineUsed?: string; notice?: string }> {
  const { businessId, source, text, imageUrl, createdById, customApiKey } = params;

  let extraction: AIExtractionResult;
  let engineUsed: string = "LOCAL_PARSER";
  let rawOcrText: string | undefined = undefined;

  if (imageUrl) {
    // Process image via multi-tiered OCR & Vision pipeline (Gemini Vision -> OpenAI Vision -> Local Tesseract.js)
    const ocrRes = await extractFromImage({ imageUrl, customApiKey, hintText: text });
    engineUsed = ocrRes.engineUsed;
    rawOcrText = ocrRes.rawText;

    if (ocrRes.structuredResult && ocrRes.structuredResult.transactions.length > 0) {
      extraction = ocrRes.structuredResult;
    } else {
      extraction = parseDiaryText(ocrRes.rawText || text || "");
    }
    extraction.sourceText = ocrRes.rawText;
    extraction.providerNotice = ocrRes.notice || extraction.providerNotice;
  } else {
    // Text or Voice input: Check for Gemini or OpenAI key, or fallback to intelligent local parser
    const geminiKey =
      (customApiKey && customApiKey.startsWith("AIza") ? customApiKey : null) ||
      process.env.GEMINI_API_KEY;
    const openAiKey =
      (customApiKey && customApiKey.startsWith("sk-") ? customApiKey : null) ||
      process.env.OPENAI_API_KEY;

    if (geminiKey && geminiKey.trim().length > 10) {
      try {
        const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey.trim()}`;
        const prompt = `You are an expert Pakistani business accountant. Extract all financial transactions from this text (English, Urdu, or Roman Urdu).
Return ONLY a valid JSON object:
{
  "documentDate": "YYYY-MM-DD",
  "transactions": [
    {
      "type": "SALE" | "PURCHASE" | "PAYMENT_RECEIVED" | "PAYMENT_MADE" | "EXPENSE" | "STOCK_ADJUSTMENT",
      "partyName": "Customer or Supplier or Expense category",
      "items": [{"productName": "string", "quantity": number, "unitPrice": number, "lineTotal": number}],
      "totalAmount": number,
      "paidAmount": number,
      "remainingAmount": number,
      "paymentMethod": "CASH" | "BANK" | "CREDIT",
      "notes": "string",
      "confidence": 0.95,
      "needsConfirmation": boolean,
      "warnings": []
    }
  ]
}`;
        const res = await fetch(geminiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${prompt}\nText:\n${text}` }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
          }),
        });

        if (res.ok) {
          const json = await res.json();
          const parsed = JSON.parse(json.candidates?.[0]?.content?.parts?.[0]?.text);
          extraction = {
            documentDate: parsed.documentDate || new Date().toISOString().split("T")[0],
            transactions: parsed.transactions || [],
            sourceText: text,
            providerNotice: "Extracted via Google Gemini 1.5 Flash",
          };
          engineUsed = "GEMINI_VISION";
        } else {
          extraction = parseDiaryText(text || "");
        }
      } catch (err) {
        extraction = parseDiaryText(text || "");
      }
    } else if (openAiKey && openAiKey.startsWith("sk-")) {
      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openAiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `You are an expert accountant. Extract transactions from notes in English/Urdu/Roman Urdu. Return ONLY JSON with { "documentDate": "YYYY-MM-DD", "transactions": [...] }`,
              },
              { role: "user", content: text || "" },
            ],
            response_format: { type: "json_object" },
            temperature: 0.1,
          }),
        });

        if (response.ok) {
          const json = await response.json();
          const parsed = JSON.parse(json.choices[0]?.message?.content);
          extraction = {
            documentDate: parsed.documentDate || new Date().toISOString().split("T")[0],
            transactions: parsed.transactions || [],
            sourceText: text,
            providerNotice: "Extracted via OpenAI GPT-4o Mini",
          };
          engineUsed = "OPENAI_VISION";
        } else {
          extraction = parseDiaryText(text || "");
        }
      } catch (err) {
        extraction = parseDiaryText(text || "");
      }
    } else {
      extraction = parseDiaryText(text || "");
      extraction.isSimulated = true;
      extraction.providerNotice = "Parsed using SmartBiz Local Intelligent Business Diary Engine.";
    }
  }

  // 2. Perform Party and Product Matching & Duplicate Detection against database
  const customers = await prisma.customer.findMany({ where: { businessId, isActive: true } });
  const suppliers = await prisma.supplier.findMany({ where: { businessId, isActive: true } });
  const products = await prisma.product.findMany({ where: { businessId, isActive: true } });

  // Look for existing transactions to flag potential duplicates
  const existingSales = await prisma.sale.findMany({
    where: { businessId },
    select: { customerName: true, totalAmount: true, date: true },
  });
  const existingPurchases = await prisma.purchase.findMany({
    where: { businessId },
    select: { supplierName: true, totalAmount: true, date: true },
  });

  for (const t of extraction.transactions) {
    // Match party
    if (t.partyName) {
      const pNameLower = t.partyName.toLowerCase();
      if (t.type === "SALE" || t.type === "PAYMENT_RECEIVED") {
        const match = customers.find((c) => c.name.toLowerCase().includes(pNameLower) || pNameLower.includes(c.name.toLowerCase()));
        if (match) {
          t.partyMatchedId = match.id;
          t.partyMatchedType = "CUSTOMER";
        }
      } else if (t.type === "PURCHASE" || t.type === "PAYMENT_MADE") {
        const match = suppliers.find((s) => s.name.toLowerCase().includes(pNameLower) || pNameLower.includes(s.name.toLowerCase()));
        if (match) {
          t.partyMatchedId = match.id;
          t.partyMatchedType = "SUPPLIER";
        }
      }
    }

    // Match products in items
    if (t.items) {
      for (const item of t.items) {
        const iNameLower = item.productName.toLowerCase();
        const prodMatch = products.find((pr) => pr.name.toLowerCase().includes(iNameLower) || iNameLower.includes(pr.name.toLowerCase()));
        if (prodMatch) {
          item.productMatchedId = prodMatch.id;
        }
      }
    }

    // Duplicate detection
    const tAmt = toDecimal(t.totalAmount);
    if (t.type === "SALE") {
      const dup = existingSales.some((s) => toDecimal(s.totalAmount).eq(tAmt) && s.customerName.toLowerCase() === (t.partyName || "").toLowerCase());
      if (dup) {
        t.isDuplicate = true;
        t.warnings = t.warnings || [];
        t.warnings.push("Possible duplicate: A sale with this party and amount already exists.");
      }
    } else if (t.type === "PURCHASE") {
      const dup = existingPurchases.some((p) => toDecimal(p.totalAmount).eq(tAmt) && p.supplierName.toLowerCase() === (t.partyName || "").toLowerCase());
      if (dup) {
        t.isDuplicate = true;
        t.warnings = t.warnings || [];
        t.warnings.push("Possible duplicate: A purchase with this supplier and amount already exists.");
      }
    }
  }

  // 3. Save AI Import and extracted transactions to database in PENDING status
  const aiImport = await prisma.aIImport.create({
    data: {
      businessId,
      source,
      originalText: extraction.sourceText || text || null,
      originalContentUrl: imageUrl,
      status: "PENDING",
      extractedCount: extraction.transactions.length,
      createdById,
      transactions: {
        create: extraction.transactions.map((t) => ({
          type: t.type,
          partyName: t.partyName || null,
          partyMatchedId: t.partyMatchedId || null,
          partyMatchedType: t.partyMatchedType || null,
          totalAmount: t.totalAmount,
          paidAmount: t.paidAmount,
          remainingAmount: t.remainingAmount,
          paymentMethod: t.paymentMethod,
          notes: t.notes || null,
          confidence: t.confidence,
          needsConfirmation: t.needsConfirmation,
          warnings: t.warnings && t.warnings.length > 0 ? JSON.stringify(t.warnings) : null,
          status: "PENDING",
          items: t.items
            ? {
                create: t.items.map((i) => ({
                  productName: i.productName,
                  productMatchedId: i.productMatchedId || null,
                  quantity: i.quantity,
                  unitPrice: i.unitPrice,
                  lineTotal: i.lineTotal,
                })),
              }
            : undefined,
        })),
      },
    },
    include: {
      transactions: {
        include: {
          items: true,
        },
      },
    },
  });

  return Object.assign(aiImport, {
    rawOcrText,
    engineUsed,
    notice: extraction.providerNotice,
  });
}

export type AIImportWithTransactions = Prisma.AIImportGetPayload<{
  include: {
    transactions: {
      include: {
        items: true;
      };
    };
  };
}>;

/**
 * Human Approval & Atomic Posting of an AI-extracted transaction
 */
export async function approveAndPostAITransaction(
  businessId: string,
  extractedTransactionId: string,
  userId: string,
  overrides?: {
    type?: "SALE" | "PURCHASE" | "PAYMENT_RECEIVED" | "PAYMENT_MADE" | "EXPENSE" | "STOCK_ADJUSTMENT";
    partyName?: string;
    partyId?: string;
    totalAmount?: number;
    paidAmount?: number;
    paymentMethod?: string;
    accountId?: string;
  }
) {
  const extracted = await prisma.aIExtractedTransaction.findUnique({
    where: { id: extractedTransactionId },
    include: { items: true, import: true },
  });

  if (!extracted) throw new Error("Extracted transaction not found.");
  if (extracted.status === "POSTED") throw new Error("This entry has already been posted.");

  const txType = overrides?.type || extracted.type;
  const partyName = overrides?.partyName || extracted.partyName;
  const totalAmount = overrides?.totalAmount !== undefined ? overrides.totalAmount : Number(extracted.totalAmount);
  const paidAmount = overrides?.paidAmount !== undefined ? overrides.paidAmount : Number(extracted.paidAmount);
  const paymentMethod = overrides?.paymentMethod || extracted.paymentMethod || "CASH";
  const partyId = overrides?.partyId || extracted.partyMatchedId;

  let createdId: string | null = null;

  if (txType === "SALE") {
    // If no items were extracted, create a generic sale item
    const items =
      extracted.items.length > 0
        ? extracted.items.map((i) => ({
            productId: i.productMatchedId || "",
            quantity: Number(i.quantity),
            unitPrice: Number(i.unitPrice),
          }))
        : [];

    // Fallback: If no product matched, find or create default product
    let firstProdId = items[0]?.productId;
    if (!firstProdId) {
      let defaultProd = await prisma.product.findFirst({ where: { businessId, isActive: true } });
      if (!defaultProd) {
        defaultProd = await prisma.product.create({
          data: {
            businessId,
            name: "General Merchandise",
            purchasePrice: 0,
            sellingPrice: totalAmount,
            currentStock: 100,
          },
        });
      }
      firstProdId = defaultProd.id;
    }

    const sale = await createAndPostSale({
      businessId,
      customerId: partyId || null,
      customerName: partyName || "Walk-in Customer",
      items: [
        {
          productId: firstProdId,
          quantity: 1,
          unitPrice: totalAmount,
        },
      ],
      paidAmount,
      paymentMethod,
      accountId: overrides?.accountId || null,
      notes: `[AI Extracted]: ${extracted.notes || ""}`,
      createdById: userId,
    });
    createdId = sale.id;
  } else if (txType === "PURCHASE") {
    let defaultProd = await prisma.product.findFirst({ where: { businessId, isActive: true } });
    if (!defaultProd) {
      defaultProd = await prisma.product.create({
        data: {
          businessId,
          name: "General Stock",
          purchasePrice: totalAmount,
          sellingPrice: totalAmount,
          currentStock: 0,
        },
      });
    }

    const purchase = await createAndPostPurchase({
      businessId,
      supplierId: partyId || null,
      supplierName: partyName || "General Supplier",
      items: [
        {
          productId: defaultProd.id,
          quantity: 1,
          unitCost: totalAmount,
        },
      ],
      paidAmount,
      paymentMethod,
      accountId: overrides?.accountId || null,
      notes: `[AI Extracted]: ${extracted.notes || ""}`,
      createdById: userId,
    });
    createdId = purchase.id;
  } else if (txType === "PAYMENT_RECEIVED" && partyId) {
    const defaultAcc = await prisma.cashBankAccount.findFirst({ where: { businessId, isActive: true } });
    if (!defaultAcc) throw new Error("No cash/bank account found to receive funds.");

    const payment = await recordCustomerPayment({
      businessId,
      customerId: partyId,
      amount: paidAmount > 0 ? paidAmount : totalAmount,
      paymentMethod,
      accountId: overrides?.accountId || defaultAcc.id,
      notes: `[AI Extracted]: ${extracted.notes || ""}`,
      createdById: userId,
    });
    createdId = payment.id;
  } else if (txType === "PAYMENT_MADE" && partyId) {
    const defaultAcc = await prisma.cashBankAccount.findFirst({ where: { businessId, isActive: true } });
    if (!defaultAcc) throw new Error("No cash/bank account found to disburse funds.");

    const payment = await recordSupplierPayment({
      businessId,
      supplierId: partyId,
      amount: paidAmount > 0 ? paidAmount : totalAmount,
      paymentMethod,
      accountId: overrides?.accountId || defaultAcc.id,
      notes: `[AI Extracted]: ${extracted.notes || ""}`,
      createdById: userId,
    });
    createdId = payment.id;
  } else if (txType === "EXPENSE") {
    let cat = await prisma.expenseCategory.findFirst({
      where: { businessId, name: { contains: partyName || "", mode: "insensitive" } },
    });
    if (!cat) {
      cat = await prisma.expenseCategory.findFirst({ where: { businessId } });
      if (!cat) {
        cat = await prisma.expenseCategory.create({
          data: { businessId, name: "General Expense", isDefault: true },
        });
      }
    }

    const expense = await createAndPostExpense({
      businessId,
      categoryId: cat.id,
      amount: totalAmount,
      description: extracted.notes || partyName || "Daily Expense",
      paymentMethod,
      accountId: overrides?.accountId || null,
      createdById: userId,
    });
    createdId = expense.id;
  }

  // Update extracted transaction status
  await prisma.aIExtractedTransaction.update({
    where: { id: extractedTransactionId },
    data: {
      status: "POSTED",
      transactionId: createdId,
    },
  });

  // Increment posted count on the import
  await prisma.aIImport.update({
    where: { id: extracted.importId },
    data: {
      postedCount: { increment: 1 },
      status: "POSTED",
    },
  });

  return { status: "POSTED", transactionId: createdId };
}
