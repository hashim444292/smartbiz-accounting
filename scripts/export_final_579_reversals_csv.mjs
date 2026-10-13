import fs from 'fs';

const results = JSON.parse(fs.readFileSync('C:/Users/CT/.gemini/antigravity/brain/35cf4c19-5474-4364-a577-6fb333c1b7c8/fbr_reversal_results.json', 'utf8'));

let csv = 'Sr,Original FBR Ref (Reversed),Local USIN Ref,Date,Amount PKR,FBR Code,New FBR Credit Note Assigned,Timestamp\n';
results.forEach((r, idx) => {
  const origUsin = r.usin.replace(/^REV-/, '').replace(/-[0-9]+$/, '');
  const dateShort = r.dateTime.split(' ')[0];
  csv += `${idx + 1},"${r.refUsin}","${origUsin}","${dateShort}",${r.amount},"${r.fbrCode}","${r.fbrCreditNoteNumber}","${r.timestamp}"\n`;
});

const outPath = 'C:/Users/CT/.gemini/antigravity/brain/35cf4c19-5474-4364-a577-6fb333c1b7c8/ALL_579_FBR_CREDIT_NOTES_REVERSED.csv';
fs.writeFileSync(outPath, csv);
console.log(`Saved full CSV of ${results.length} reversals to ${outPath}`);
