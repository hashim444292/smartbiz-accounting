import fs from 'fs';
import path from 'path';
import { loadDuplicateRecords } from './fbr_batch_reversal.mjs';

const RESULTS_LOG = 'C:/Users/CT/.gemini/antigravity/brain/35cf4c19-5474-4364-a577-6fb333c1b7c8/fbr_reversal_results.json';
const OUT_JSON = 'C:/Users/CT/.gemini/antigravity/brain/35cf4c19-5474-4364-a577-6fb333c1b7c8/remaining_574_fbr_duplicates.json';
const OUT_CSV = 'C:/Users/CT/.gemini/antigravity/brain/35cf4c19-5474-4364-a577-6fb333c1b7c8/remaining_574_fbr_duplicates.csv';

const { cnDuplicates, invDuplicates, allDuplicates } = loadDuplicateRecords();

let processedRefs = new Set();
if (fs.existsSync(RESULTS_LOG)) {
  const list = JSON.parse(fs.readFileSync(RESULTS_LOG, 'utf8'));
  list.filter(r => r.success).forEach(r => processedRefs.add(String(r.refUsin).trim()));
}

const remaining = allDuplicates.filter(r => !processedRefs.has(String(r['FBR Invoice No.']).trim()));

console.log('=== REMAINING FBR DUPLICATES INVENTORY ===');
console.log('Total Duplicates identified in FBR report:', allDuplicates.length);
console.log('Already successfully reversed in pilot:', processedRefs.size);
console.log('Total Remaining Duplicates to reverse:', remaining.length);

const remainingCn = remaining.filter(r => String(r['USIN']).startsWith('CN-'));
const remainingInv = remaining.filter(r => String(r['USIN']).startsWith('INV-'));

console.log('  1) Remaining Oct 10 CN- (Sale) duplicates:', remainingCn.length);
console.log('  2) Remaining Oct 7-8 duplicate INV- sales:', remainingInv.length);

let totalRemainingPkr = 0;
remaining.forEach(r => {
  const amt = parseFloat(String(r['Total Balance'] || 0).replace(/,/g, '')) || 0;
  totalRemainingPkr += amt;
});
console.log('Total PKR of remaining duplicates: PKR', totalRemainingPkr.toLocaleString());

const exportList = remaining.map((r, idx) => ({
  srNo: idx + 1,
  fbrInvoiceNoToReverse: String(r['FBR Invoice No.']).trim(),
  originalUsin: String(r['USIN']).trim(),
  invoiceDate: r['Invoice Date'],
  totalAmount: parseFloat(String(r['Total Balance'] || 0).replace(/,/g, '')) || 0,
  saleValue: parseFloat(String(r['Sale Value'] || 0).replace(/,/g, '')) || 0,
  itemName: r['Item Name'] || 'Retail Goods',
  itemCode: r['Item Code'] || 'SKU-001',
  pctCode: r['Item PCT Code'] || '85171300'
}));

fs.writeFileSync(OUT_JSON, JSON.stringify(exportList, null, 2));

let csv = 'Sr,FBR_Invoice_No_To_Reverse,Original_USIN,Invoice_Date,Amount,Item_Name,PCT_Code\n';
exportList.forEach(r => {
  csv += r.srNo + ',"' + r.fbrInvoiceNoToReverse + '","' + r.originalUsin + '","' + r.invoiceDate + '",' + r.totalAmount + ',"' + r.itemName + '","' + r.pctCode + '"\n';
});
fs.writeFileSync(OUT_CSV, csv);

console.log('\nSaved artifacts:');
console.log('  JSON:', OUT_JSON);
console.log('  CSV:', OUT_CSV);

console.log('\nPreview of first 5 remaining:');
exportList.slice(0, 5).forEach(r => {
  console.log(`  [#${r.srNo}] Ref: ${r.fbrInvoiceNoToReverse} | USIN: ${r.originalUsin} | Date: ${r.invoiceDate} | PKR ${r.totalAmount} | ${r.itemName}`);
});

console.log('\nPreview of last 5 remaining:');
exportList.slice(-5).forEach(r => {
  console.log(`  [#${r.srNo}] Ref: ${r.fbrInvoiceNoToReverse} | USIN: ${r.originalUsin} | Date: ${r.invoiceDate} | PKR ${r.totalAmount} | ${r.itemName}`);
});
