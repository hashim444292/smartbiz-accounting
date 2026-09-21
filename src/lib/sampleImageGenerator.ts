/**
 * Generates realistic high-contrast accounting sample documents on HTML5 Canvas.
 * Returns base64 Data URLs suitable for testing OCR and AI vision.
 */
export function generateSampleSlip(type: 'DIARY' | 'BILL' | 'EXPENSE' | 'PURCHASE'): string {
  if (typeof window === 'undefined') return '';

  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 960;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  if (type === 'DIARY') {
    // Ruled Diary Page
    ctx.fillStyle = '#fbf9f4'; // paper off-white
    ctx.fillRect(0, 0, 800, 960);

    // Ruled lines
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.5;
    for (let y = 140; y < 900; y += 45) {
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(760, y);
      ctx.stroke();
    }

    // Red left margin line
    ctx.strokeStyle = '#fca5a5';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(110, 30);
    ctx.lineTo(110, 930);
    ctx.stroke();

    // Header
    ctx.font = 'bold 26px  Courier New, Courier, monospace';
    ctx.fillStyle = '#1e3a8a';
    ctx.fillText('DAILY ACCOUNTS DIARY - 16/09/2026', 130, 80);

    ctx.font = '16px Courier New, Courier, monospace';
    ctx.fillStyle = '#64748b';
    ctx.fillText('Shop: Hashim Mobile Zone, Saddar Market', 130, 115);

    // Entries in blue ink
    ctx.font = 'bold 20px Courier New, Courier, monospace';
    ctx.fillStyle = '#1e3a8a';

    const entries = [
      '1. Ali Traders ko 25,000 ki sale hui, 10,000 cash received',
      '2. Ahmed se 15,000 ka maal purchase kiya, payment baqi hai',
      '3. Shop electricity 3,000 paid cash',
      '4. Bilal ne purana udhaar 8,000 diya',
      '5. IPH 11 NON 64 - HBL 36,000',
      '6. Pixel 7A - Cash 35,000',
      '7. Staff lunch and tea - 650 cash paid',
      '8. HYD Rec - HBL 50,000',
    ];

    entries.forEach((text, i) => {
      ctx.fillText(text, 130, 175 + i * 45);
    });

    // Bottom notes
    ctx.font = 'italic 16px Courier New, Courier, monospace';
    ctx.fillStyle = '#475569';
    ctx.fillText('Closing Cash verified by Hashim (Owner)', 130, 880);

  } else if (type === 'BILL') {
    // Printed Cash Memo / Invoice
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 800, 960);

    // Border
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.strokeRect(30, 30, 740, 900);

    // Header box
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(33, 33, 734, 150);

    ctx.font = 'bold 30px Arial, Helvetica, sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('SMARTBIZ MOBILE & ACCESSORIES', 60, 80);

    ctx.font = '16px Arial, Helvetica, sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText('STRN: 3277876123456 | NTN: 8912345-1', 60, 110);
    ctx.fillText('Shop # 14, Commercial Center, Karachi | Phone: 0300-1234567', 60, 135);

    // Invoice Title
    ctx.font = 'bold 22px Arial, Helvetica, sans-serif';
    ctx.fillStyle = '#1e3a8a';
    ctx.fillText('CASH MEMO / SALES INVOICE', 60, 220);

    ctx.font = '16px Arial, Helvetica, sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('Invoice #: INV-2026-0042', 60, 260);
    ctx.fillText('Date: 16/09/2026', 550, 260);
    ctx.fillText('Customer: Usman Telecom', 60, 295);
    ctx.fillText('Phone: 0321-9876543', 550, 295);

    // Table Header
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(50, 340, 700, 40);
    ctx.font = 'bold 16px Arial, Helvetica, sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('SR', 65, 365);
    ctx.fillText('ITEM DESCRIPTION', 130, 365);
    ctx.fillText('QTY', 470, 365);
    ctx.fillText('UNIT RATE', 530, 365);
    ctx.fillText('TOTAL (PKR)', 640, 365);

    // Items
    ctx.font = '16px Arial, Helvetica, sans-serif';
    ctx.fillText('1.', 65, 415);
    ctx.fillText('Samsung Galaxy S25 256GB', 130, 415);
    ctx.fillText('1', 480, 415);
    ctx.fillText('285,000', 530, 415);
    ctx.fillText('285,000', 640, 415);

    ctx.fillText('2.', 65, 465);
    ctx.fillText('Fast Charger 45W Original', 130, 465);
    ctx.fillText('2', 480, 465);
    ctx.fillText('4,500', 530, 465);
    ctx.fillText('9,000', 640, 465);

    // Line separator
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(50, 520);
    ctx.lineTo(750, 520);
    ctx.stroke();

    // Summary calculations
    ctx.font = 'bold 18px Arial, Helvetica, sans-serif';
    ctx.fillText('Subtotal Amount: Rs. 294,000', 440, 560);
    ctx.fillText('Total Bill Amount: Rs. 294,000', 440, 605);

    ctx.fillStyle = '#16a34a';
    ctx.fillText('Cash Received: Rs. 150,000', 440, 650);

    ctx.fillStyle = '#dc2626';
    ctx.fillText('Balance Due (Credit): Rs. 144,000', 440, 695);

    // Payment terms badge
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2;
    ctx.strokeRect(60, 560, 240, 60);
    ctx.font = 'bold 16px Arial, Helvetica, sans-serif';
    ctx.fillStyle = '#dc2626';
    ctx.fillText('PARTIAL PAYMENT SALE', 75, 595);

    // Signatures
    ctx.font = '14px Arial, Helvetica, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('Customer Signature: __________________', 60, 840);
    ctx.fillText('Authorized Signature: __________________', 440, 840);

  } else if (type === 'EXPENSE') {
    // Daily Expense Voucher
    ctx.fillStyle = '#fafaf9';
    ctx.fillRect(0, 0, 800, 960);

    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.strokeRect(35, 35, 730, 890);

    // Header
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(37, 37, 726, 80);
    ctx.font = 'bold 28px Arial, Helvetica, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('DAILY PETTY EXPENSE VOUCHER', 180, 88);

    ctx.font = '16px Arial, Helvetica, sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('Voucher Date: 16/09/2026', 60, 160);
    ctx.fillText('Voucher #: EXP-2026-091', 520, 160);

    // Expense Lines
    ctx.font = 'bold 18px Arial, Helvetica, sans-serif';
    ctx.fillStyle = '#1e293b';

    const expenses = [
      { text: '1. Shop Electricity Bill - Rs. 12,500 Cash', desc: 'K-Electric Bill for September' },
      { text: '2. Staff Tea & Refreshment - Rs. 850 Cash', desc: 'Daily tea and biscuits for shop staff' },
      { text: '3. Generator Petrol / Fuel - Rs. 2,500 Cash', desc: '10 Liters petrol for power backup' },
      { text: '4. Transport Delivery Courier - Rs. 1,500 HBL Bank', desc: 'Goods transit parcel from airport' },
      { text: '5. Cleaning & Shop Supplies - Rs. 600 Cash', desc: 'Washing liquid and towels' },
    ];

    expenses.forEach((item, idx) => {
      ctx.fillText(item.text, 60, 230 + idx * 80);
      ctx.font = '14px Arial, Helvetica, sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText(item.desc, 80, 255 + idx * 80);
      ctx.font = 'bold 18px Arial, Helvetica, sans-serif';
      ctx.fillStyle = '#1e293b';
    });

    // Total Box
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(50, 680, 700, 60);
    ctx.font = 'bold 24px Arial, Helvetica, sans-serif';
    ctx.fillStyle = '#1e3a8a';
    ctx.fillText('TOTAL EXPENSES: Rs. 17,950', 220, 720);

    // Paid by
    ctx.font = '16px Arial, Helvetica, sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText('Prepared By: Cashier', 80, 840);
    ctx.fillText('Approved By: Manager', 480, 840);

  } else if (type === 'PURCHASE') {
    // Wholesale Inward / Vendor Bill
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 800, 960);

    ctx.strokeStyle = '#1e3a8a';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(30, 30, 740, 900);

    // Header
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(32, 32, 736, 90);
    ctx.font = 'bold 26px Arial, Helvetica, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('NATIONAL MOBILE WHOLESALE DISTRIBUTORS', 80, 85);

    ctx.font = 'bold 20px Arial, Helvetica, sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('VENDOR PURCHASE BILL', 60, 165);

    ctx.font = '16px Arial, Helvetica, sans-serif';
    ctx.fillText('Supplier: Ahmed Tech Wholesale', 60, 205);
    ctx.fillText('Bill #: PUR-9021', 540, 205);
    ctx.fillText('Date: 16/09/2026', 540, 240);
    ctx.fillText('Payment Terms: Credit / 30 Days', 60, 240);

    // Table Header
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(50, 280, 700, 40);
    ctx.font = 'bold 16px Arial, Helvetica, sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('SR', 65, 305);
    ctx.fillText('PRODUCT NAME', 120, 305);
    ctx.fillText('QTY', 440, 305);
    ctx.fillText('UNIT COST', 510, 305);
    ctx.fillText('TOTAL COST', 630, 305);

    // Items
    ctx.font = '16px Arial, Helvetica, sans-serif';
    ctx.fillText('1.', 65, 360);
    ctx.fillText('iPhone 13 128GB Apple', 120, 360);
    ctx.fillText('5', 450, 360);
    ctx.fillText('125,000', 510, 360);
    ctx.fillText('625,000', 630, 360);

    ctx.fillText('2.', 65, 410);
    ctx.fillText('Tecno Camon 40 Pro', 120, 410);
    ctx.fillText('10', 445, 410);
    ctx.fillText('42,000', 510, 410);
    ctx.fillText('420,000', 630, 410);

    // Separator
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(50, 470);
    ctx.lineTo(750, 470);
    ctx.stroke();

    // Calculations
    ctx.font = 'bold 18px Arial, Helvetica, sans-serif';
    ctx.fillText('Gross Inward Value: Rs. 1,045,000', 400, 520);

    ctx.fillStyle = '#16a34a';
    ctx.fillText('Paid via Meezan Bank: Rs. 500,000', 400, 565);

    ctx.fillStyle = '#dc2626';
    ctx.fillText('Remaining Payable: Rs. 545,000', 400, 610);

    // Inward stamp
    ctx.strokeStyle = '#16a34a';
    ctx.lineWidth = 2;
    ctx.strokeRect(60, 510, 220, 70);
    ctx.font = 'bold 18px Arial, Helvetica, sans-serif';
    ctx.fillStyle = '#16a34a';
    ctx.fillText('STOCK RECEIVED', 85, 552);

    ctx.font = '14px Arial, Helvetica, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('Warehouse Inward Officer: __________________', 60, 820);
    ctx.fillText('Supplier Delivery Person: __________________', 420, 820);
  }

  return canvas.toDataURL('image/png');
}
