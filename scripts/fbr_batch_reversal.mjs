import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

// Configuration
const FBR_POS_URL = 'https://ims.fbr.gov.pk/api/Live/PostData';
const POS_ID = 201327;
const POS_TOKEN = '7c8ba514-1b87-37a6-bda7-162c95c4d826';
const EXCEL_PATH = 'C:/Users/CT/.gemini/antigravity/brain/35cf4c19-5474-4364-a577-6fb333c1b7c8/.user_uploaded/media_1791786956503_6721b907.xls';
const RESULTS_LOG = 'C:/Users/CT/.gemini/antigravity/brain/35cf4c19-5474-4364-a577-6fb333c1b7c8/fbr_reversal_results.json';

function cleanNumber(val) {
  if (val === undefined || val === null || val === '') return 0;
  const cleaned = String(val).replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseFbrDateToIso(dateStr) {
  // e.g. "25-Sep-2026" -> "2026-09-25 23:59:59"
  if (!dateStr) return '2026-09-30 23:59:59';
  const months = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
    Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
  };
  const parts = String(dateStr).trim().split('-');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = months[parts[1]] || '09';
    const year = parts[2];
    return `${year}-${month}-${day} 23:59:59`;
  }
  return '2026-09-30 23:59:59';
}

function cleanPctCode(raw) {
  if (!raw) return '85171390';
  let cleaned = String(raw).trim().replace(/[^0-9]/g, '');
  if (cleaned === '85171300' || cleaned === '851713') return '85171390';
  return cleaned.padEnd(8, '0');
}

export function loadDuplicateRecords() {
  const wb = XLSX.readFile(EXCEL_PATH);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  
  // 1. All 442 CN submissions from Oct 10 that became Sale Invoice
  const cnRows = rows.filter(r => String(r['USIN'] || '').startsWith('CN-'));
  
  // 2. All 137 duplicate INV submissions
  const invRows = rows.filter(r => String(r['USIN'] || '').startsWith('INV-'));
  const byUsin = {};
  invRows.forEach(r => {
    const u = r['USIN'];
    if (!byUsin[u]) byUsin[u] = [];
    byUsin[u].push(r);
  });
  
  const extraInvRows = [];
  for (const [usin, list] of Object.entries(byUsin)) {
    if (list.length > 1) {
      // Keep the first (original), mark the rest as extra duplicates to reverse
      for (let i = 1; i < list.length; i++) {
        extraInvRows.push(list[i]);
      }
    }
  }

  return {
    cnDuplicates: cnRows,
    invDuplicates: extraInvRows,
    allDuplicates: [...cnRows, ...extraInvRows]
  };
}

export function buildCreditNotePayload(record, index) {
  const origFbrNo = String(record['FBR Invoice No.'] || '').trim();
  const origUsin = String(record['USIN'] || '').trim();
  const rawDate = record['Invoice Date'];
  const dateTime = parseFbrDateToIso(rawDate);
  
  // Make a clean unique USIN for this reversal Credit Note
  // e.g. REV-CN-00441 or REV-INV-00006-2
  const uniqueUsin = `REV-${origUsin}-${origFbrNo.slice(-6)}`;
  
  const totalAmount = cleanNumber(record['Total Balance']);
  const saleValue = cleanNumber(record['Sale Value']);
  const taxCharged = cleanNumber(record['Tax Charged']);
  const discount = cleanNumber(record['Discount']);
  const furtherTax = cleanNumber(record['FurtherTax'] || record['Further Tax']);
  const qty = cleanNumber(record['Quantity']) || 1;
  const paymentMode = parseInt(record['Payment Mode'] || '1', 10) || 1;

  const itemName = record['Item Name'] || 'Retail Goods';
  const itemCode = record['Item Code'] || 'SKU-001';
  const pctCode = cleanPctCode(record['Item PCT Code']);
  const itemQty = cleanNumber(record['Item Quantity']) || qty;
  const itemSaleVal = cleanNumber(record['Item Sale Value']) || saleValue;
  const itemTaxCharged = cleanNumber(record['Item Tax Charged']) || taxCharged;
  const itemTotalAmt = cleanNumber(record['Item Total Amount']) || totalAmount;

  return {
    InvoiceNumber: '',
    POSID: POS_ID,
    USIN: uniqueUsin,
    DateTime: dateTime,
    BuyerNTN: record['Buyer NTN'] ? String(record['Buyer NTN']).trim() : '',
    BuyerCNIC: record['Buyer CNIC'] ? String(record['Buyer CNIC']).trim() : '',
    BuyerName: 'Walk-in Customer',
    BuyerPhoneNumber: '',
    TotalSaleValue: saleValue,
    TotalQuantity: qty,
    TotalBillAmount: totalAmount,
    TotalTaxCharged: taxCharged,
    Discount: discount,
    FurtherTax: furtherTax,
    PaymentMode: paymentMode,
    RefUSIN: origFbrNo, // Crucial: points to the duplicate FBR invoice being reversed!
    InvoiceType: 3,     // Statutory FBR Credit Note
    Items: [
      {
        ItemCode: itemCode,
        ItemName: itemName,
        Quantity: itemQty,
        TotalAmount: itemTotalAmt,
        SaleValue: itemSaleVal,
        TaxCharged: itemTaxCharged,
        TaxRate: 0,
        Discount: 0,
        FurtherTax: 0,
        InvoiceType: 3,
        PCTCode: pctCode
      }
    ]
  };
}

// CLI Execution handler
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isPilot = args.includes('--pilot');
  const isBatch = args.includes('--batch');
  const countArgIdx = args.indexOf('--count');
  const countLimit = countArgIdx !== -1 ? parseInt(args[countArgIdx + 1], 10) : (isPilot ? 5 : null);

  console.log('=== FBR BATCH REVERSAL ENGINE ===');
  console.log('Mode:', isDryRun ? 'DRY-RUN (Offline)' : countLimit ? `BATCH (Limit: ${countLimit} records)` : isBatch ? 'FULL BATCH' : 'UNKNOWN');

  const { cnDuplicates, invDuplicates, allDuplicates } = loadDuplicateRecords();
  console.log(`Loaded ${allDuplicates.length} total duplicates to reverse:`);
  console.log(`  - Oct 10 CN- submissions (treated as Sales): ${cnDuplicates.length}`);
  console.log(`  - Extra INV- submissions (duplicate Sales): ${invDuplicates.length}`);

  // Load existing results if any to filter out already processed
  let resultsLog = [];
  if (fs.existsSync(RESULTS_LOG)) {
    try {
      resultsLog = JSON.parse(fs.readFileSync(RESULTS_LOG, 'utf8'));
    } catch {}
  }
  const alreadyProcessedRefs = new Set(resultsLog.filter(r => r.success).map(r => r.refUsin));
  console.log(`Already successfully processed: ${alreadyProcessedRefs.size} records.`);

  const unprocessedDuplicates = allDuplicates.filter(r => !alreadyProcessedRefs.has(String(r['FBR Invoice No.']).trim()));

  let targetRecords = [];
  if (countLimit) {
    targetRecords = unprocessedDuplicates.slice(0, countLimit);
  } else if (isBatch) {
    targetRecords = unprocessedDuplicates;
  } else {
    targetRecords = unprocessedDuplicates.slice(0, 5);
  }

  console.log(`\nProcessing ${targetRecords.length} records in this run...`);

  for (let i = 0; i < targetRecords.length; i++) {
    const record = targetRecords[i];
    const origFbrNo = String(record['FBR Invoice No.'] || '').trim();
    
    if (alreadyProcessedRefs.has(origFbrNo)) {
      console.log(`[${i + 1}/${targetRecords.length}] Skipping already processed: ${origFbrNo}`);
      continue;
    }

    const payload = buildCreditNotePayload(record, i);

    console.log(`\n[${i + 1}/${targetRecords.length}] ${payload.USIN} -> Reversing RefUSIN: ${payload.RefUSIN} (${payload.DateTime})`);
    console.log(`   Amount: PKR ${payload.TotalBillAmount} | Item: ${payload.Items[0].ItemName} | PCT: ${payload.Items[0].PCTCode}`);

    if (isDryRun) {
      console.log('   [DRY-RUN] Payload verified. No network call.');
      continue;
    }

    // LIVE TRANSMISSION
    try {
      const res = await fetch(FBR_POS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${POS_TOKEN}`
        },
        body: JSON.stringify(payload)
      });

      const resText = await res.text();
      let resJson = {};
      try { resJson = JSON.parse(resText); } catch { resJson = { raw: resText }; }

      const isSuccess = resJson.Code === '100' && resJson.InvoiceNumber && resJson.InvoiceNumber !== 'Not Available';
      const cnNo = isSuccess ? resJson.InvoiceNumber : null;

      const logEntry = {
        timestamp: new Date().toISOString(),
        refUsin: payload.RefUSIN,
        usin: payload.USIN,
        dateTime: payload.DateTime,
        amount: payload.TotalBillAmount,
        success: isSuccess,
        fbrCode: resJson.Code,
        fbrResponse: resJson.Response || resText,
        fbrCreditNoteNumber: cnNo
      };

      resultsLog.push(logEntry);
      fs.writeFileSync(RESULTS_LOG, JSON.stringify(resultsLog, null, 2));

      if (isSuccess) {
        console.log(`   >>> SUCCESS! FBR Credit Note Assigned: ${cnNo} (Code 100)`);
      } else {
        console.log(`   >>> FAILED! FBR Response: Code ${resJson.Code} - ${resJson.Response || resText}`);
      }

    } catch (err) {
      console.error(`   >>> NETWORK ERROR: ${err.message}`);
    } finally {
      // 2500ms delay between live transmissions to protect socket & prevent rate limit
      if (i < targetRecords.length - 1) {
        console.log('   Waiting 2500ms before next transmission...');
        await new Promise(r => setTimeout(r, 2500));
      }
    }
  }

  console.log('\n=== Finished Execution ===');
}

if (process.argv[1] && process.argv[1].endsWith('fbr_batch_reversal.mjs')) {
  main().catch(console.error);
}
