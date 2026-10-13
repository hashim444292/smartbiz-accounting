import fs from 'fs';

const resultsLog = JSON.parse(fs.readFileSync('C:/Users/CT/.gemini/antigravity/brain/35cf4c19-5474-4364-a577-6fb333c1b7c8/fbr_reversal_results.json', 'utf8'));
const last49 = resultsLog.slice(-49);

const script = `
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const items = ${JSON.stringify(last49)};

async function main() {
  const business = await prisma.business.findFirst();
  const businessId = business ? business.id : 'default';

  for (const item of items) {
    await prisma.auditLog.create({
      data: {
        businessId,
        action: 'FBR_BATCH_CREDIT_NOTE_49',
        entity: 'FbrReversal',
        entityId: item.refUsin,
        details: JSON.stringify({
          refUsin: item.refUsin,
          usin: item.usin,
          fbrCreditNoteNumber: item.fbrCreditNoteNumber,
          amount: item.amount,
          invoiceDate: item.dateTime,
          status: 'SUCCESS',
          code: item.fbrCode
        })
      }
    });
  }
  console.log('Successfully recorded 49 audit logs in DB!');
}
main().finally(() => prisma.$disconnect());
`;

fs.writeFileSync('C:/Users/CT/.gemini/antigravity/brain/35cf4c19-5474-4364-a577-6fb333c1b7c8/scratch/record_49_db.js', script);
console.log('Generated scratch/record_49_db.js successfully.');
