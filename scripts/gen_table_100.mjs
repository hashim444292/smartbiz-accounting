import fs from 'fs';

const results = JSON.parse(fs.readFileSync('C:/Users/CT/.gemini/antigravity/brain/35cf4c19-5474-4364-a577-6fb333c1b7c8/batch3_100_results.json', 'utf8'));
let md = '| # | Original FBR Ref (Reversed) | Local USIN Ref | Date | Amount (PKR) | New FBR Credit Note Assigned |\n';
md += '| :- | :--- | :--- | :--- | :--- | :--- |\n';
results.forEach((r, idx) => {
  const origUsin = r.usin.replace(/^REV-/, '').replace(/-[0-9]+$/, '');
  const dateShort = r.dateTime.split(' ')[0];
  md += `| ${idx + 1} | \`${r.refUsin}\` | \`${origUsin}\` | ${dateShort} | ${r.amount.toLocaleString()} | **\`${r.fbrCreditNoteNumber}\`** |\n`;
});
fs.writeFileSync('C:/Users/CT/.gemini/antigravity/brain/35cf4c19-5474-4364-a577-6fb333c1b7c8/scratch/table_100.md', md);
console.log('Markdown table generated successfully.');
