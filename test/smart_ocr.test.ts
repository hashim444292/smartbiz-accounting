import { describe, it, expect } from 'vitest';
import { cleanOcrText } from '../src/services/ocrService';
import { parseDiaryText } from '../src/services/aiService';

describe('Smart OCR Text Cleaner & NLP Parsing', () => {
  it('should clean noise characters and fix common digit OCR errors', () => {
    const dirty = '## 1. Ali Traders ko 25O00 ki sale hui, 10O00 cash received ..';
    const cleaned = cleanOcrText(dirty);
    expect(cleaned).toContain('25000');
    expect(cleaned).toContain('10000');
    expect(cleaned).not.toContain('##');
  });

  it('should translate Urdu digits into standard numbers', () => {
    const urduNumbers = 'Shop rent ۲۵۰۰۰ paid cash';
    const cleaned = cleanOcrText(urduNumbers);
    expect(cleaned).toContain('25000');
  });

  it('should parse multi-line printed cash memo with partial payment', () => {
    const cashMemo = `CASH MEMO / SALES INVOICE
Customer: Usman Telecom
1. Samsung Galaxy S25 256GB - Qty 1 - 285,000
2. Fast Charger 45W Original - Qty 2 - 9,000
Total Bill Amount: Rs. 294,000
Cash Received: Rs. 150,000
Balance Due: Rs. 144,000`;

    const parsed = parseDiaryText(cashMemo);
    expect(parsed.transactions.length).toBeGreaterThan(0);
    const saleTx = parsed.transactions.find((t) => t.type === 'SALE');
    expect(saleTx).toBeDefined();
    expect(saleTx?.partyName).toContain('Usman');
    expect(saleTx?.totalAmount).toBe(294000);
    expect(saleTx?.paidAmount).toBe(150000);
    expect(saleTx?.remainingAmount).toBe(144000);
  });

  it('should parse wholesale purchase bill with partial bank payment', () => {
    const vendorBill = `VENDOR PURCHASE BILL
Supplier: Ahmed Tech Wholesale
1. iPhone 13 128GB Apple - Qty 5 - Rate 125,000 - Total 625,000
Gross Inward Value: Rs. 625,000
Paid via Meezan Bank: Rs. 300,000
Remaining Payable: Rs. 325,000`;

    const parsed = parseDiaryText(vendorBill);
    const purchaseTx = parsed.transactions.find((t) => t.type === 'PURCHASE');
    expect(purchaseTx).toBeDefined();
    expect(purchaseTx?.partyName).toContain('Ahmed Tech');
    expect(purchaseTx?.totalAmount).toBe(625000);
    expect(purchaseTx?.paidAmount).toBe(300000);
    expect(purchaseTx?.remainingAmount).toBe(325000);
  });

  it('should accurately parse spoken Roman Urdu with multiplier words (25 hazar, 10 hazar)', () => {
    const spoken = "Aaj Ali Traders ko 25 hazar ki sale hui, 10 hazar cash mila";
    const parsed = parseDiaryText(spoken);
    expect(parsed.transactions.length).toBe(1);
    const tx = parsed.transactions[0];
    expect(tx.type).toBe('SALE');
    expect(tx.partyName).toBe('Ali Traders');
    expect(tx.totalAmount).toBe(25000);
    expect(tx.paidAmount).toBe(10000);
    expect(tx.remainingAmount).toBe(15000);
  });

  it('should accurately parse spoken Urdu script with Urdu digits and keywords', () => {
    const spokenUrdu = "علی ٹریڈرز کو ۲۵ ہزار کی سیل ہوئی ۱۰ ہزار نقد ملا";
    const parsed = parseDiaryText(spokenUrdu);
    expect(parsed.transactions.length).toBe(1);
    const tx = parsed.transactions[0];
    expect(tx.type).toBe('SALE');
    expect(tx.partyName).toBe('علی ٹریڈرز');
    expect(tx.totalAmount).toBe(25000);
    expect(tx.paidAmount).toBe(10000);
    expect(tx.remainingAmount).toBe(15000);
  });

  it('should accurately parse spoken Urdu expense entries', () => {
    const spokenExpense = "دکان کا بجلی کا بل ۳۵۰۰ کیش ادا کیا";
    const parsed = parseDiaryText(spokenExpense);
    expect(parsed.transactions.length).toBe(1);
    const tx = parsed.transactions[0];
    expect(tx.type).toBe('EXPENSE');
    expect(tx.totalAmount).toBe(3500);
    expect(tx.partyName).toBe('Electricity');
  });

  it('should parse purchase with credit in spoken Roman Urdu', () => {
    const spokenPurchase = "Ahmed se 15 hazar ka maal khareeda udhar";
    const parsed = parseDiaryText(spokenPurchase);
    expect(parsed.transactions.length).toBe(1);
    const tx = parsed.transactions[0];
    expect(tx.type).toBe('PURCHASE');
    expect(tx.partyName).toBe('Ahmed');
    expect(tx.totalAmount).toBe(15000);
    expect(tx.paidAmount).toBe(0);
    expect(tx.remainingAmount).toBe(15000);
    expect(tx.paymentMethod).toBe('CREDIT');
  });

  it('should parse spoken customer recovery in Roman Urdu', () => {
    const spokenRecovery = "Bilal ne 8 hazar purana udhaar wapas diya";
    const parsed = parseDiaryText(spokenRecovery);
    expect(parsed.transactions.length).toBe(1);
    const tx = parsed.transactions[0];
    expect(tx.type).toBe('PAYMENT_RECEIVED');
    expect(tx.partyName).toBe('Bilal');
    expect(tx.totalAmount).toBe(8000);
    expect(tx.paidAmount).toBe(8000);
  });

  it('should accurately parse client trial balance table ledger rows (ACR Code, Party, Debit/Credit)', () => {
    const tableText = `A/C CODE   A/C NAME   DEBIT AMT   CREDIT AMT   TELEPHONE
ACR00047 A REHMAN SHOP 80,000.00
ACR00363 ABBAS C/O SHAHRUKH 3,000.00
ACR00178 ACM 2,500,000.00
ACR00242 BANK HBL 528,500.00
ACR00001 CASH 391,500.00
ACR00246 HOME ADV RENT 190,000.00
ACR00366 IMRAN C/O ASIF 180,000.00
ACR00343 SAMI 365,000.00`;

    const parsed = parseDiaryText(tableText);
    expect(parsed.transactions.length).toBe(8);

    // 1. A REHMAN SHOP (Debit receivable)
    expect(parsed.transactions[0].partyName).toBe('A REHMAN SHOP');
    expect(parsed.transactions[0].totalAmount).toBe(80000);

    // 2. ABBAS C/O SHAHRUKH
    expect(parsed.transactions[1].partyName).toBe('ABBAS C/O SHAHRUKH');
    expect(parsed.transactions[1].totalAmount).toBe(3000);

    // 4. BANK HBL
    const hbl = parsed.transactions.find((t) => t.partyName === 'BANK HBL');
    expect(hbl).toBeDefined();
    expect(hbl?.paymentMethod).toBe('BANK');
    expect(hbl?.totalAmount).toBe(528500);

    // 5. CASH
    const cash = parsed.transactions.find((t) => t.partyName === 'Cash in Hand');
    expect(cash).toBeDefined();
    expect(cash?.paymentMethod).toBe('CASH');
    expect(cash?.totalAmount).toBe(391500);

    // 6. HOME ADV RENT (Expense)
    const rent = parsed.transactions.find((t) => t.type === 'EXPENSE');
    expect(rent).toBeDefined();
    expect(rent?.partyName).toBe('HOME ADV RENT');
    expect(rent?.totalAmount).toBe(190000);

    // 7. IMRAN C/O ASIF
    const imran = parsed.transactions.find((t) => t.partyName === 'IMRAN C/O ASIF');
    expect(imran).toBeDefined();
    expect(imran?.totalAmount).toBe(180000);
  });

  it('should return empty transactions and never inject fake entries when input text is empty or blank', () => {
    const emptyResult = parseDiaryText("");
    expect(emptyResult.transactions.length).toBe(0);

    const whitespaceResult = parseDiaryText("   \n\n  ");
    expect(whitespaceResult.transactions.length).toBe(0);
  });
});
