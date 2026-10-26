import { prisma } from "@/lib/prisma";
import { Decimal, round2, toDecimal, isJournalBalanced } from "@/lib/decimal";
import { Prisma } from "@prisma/client";

export class AccountingPeriodLockedError extends Error {
  constructor(message = "Cannot post or modify transactions in a closed accounting period.") {
    super(message);
    this.name = "AccountingPeriodLockedError";
  }
}

export class JournalUnbalancedError extends Error {
  constructor(totalDebit: string, totalCredit: string) {
    super(`Journal entry is unbalanced: Total Debits (${totalDebit}) do not equal Total Credits (${totalCredit}).`);
    this.name = "JournalUnbalancedError";
  }
}

/**
 * Checks if the accounting period containing the transaction date is closed.
 */
export async function assertPeriodOpen(
  tx: Prisma.TransactionClient,
  businessId: string,
  date: Date | string
): Promise<void> {
  const d = date instanceof Date ? date : new Date(date || Date.now());
  const year = d.getFullYear();
  const month = d.getMonth() + 1;

  const period = await tx.accountingPeriod.findUnique({
    where: {
      businessId_year_month: {
        businessId,
        year,
        month,
      },
    },
  });

  if (period && period.isClosed) {
    throw new AccountingPeriodLockedError(
      `Accounting period ${period.name} (${year}-${month}) is closed and locked.`
    );
  }
}

/**
 * Generates the next sequential entry number for a journal entry
 */
export async function getNextJournalNumber(
  tx: Prisma.TransactionClient,
  businessId: string,
  date: Date | string
): Promise<string> {
  const d = date instanceof Date ? date : new Date(date || Date.now());
  const prefix = `JE-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;

  const existing = await tx.journalEntry.findMany({
    where: {
      businessId,
      entryNumber: { startsWith: prefix },
    },
    select: { entryNumber: true },
    orderBy: { entryNumber: "desc" },
    take: 50,
  });

  let maxSeq = 0;
  for (const item of existing) {
    const parts = item.entryNumber.split("-");
    const last = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(last) && last > maxSeq) {
      maxSeq = last;
    }
  }

  let nextSeq = maxSeq + 1;
  let candidate = `${prefix}-${String(nextSeq).padStart(4, "0")}`;

  while (
    await tx.journalEntry.findFirst({
      where: {
        businessId,
        entryNumber: candidate,
      },
      select: { id: true },
    })
  ) {
    nextSeq++;
    candidate = `${prefix}-${String(nextSeq).padStart(4, "0")}`;
  }

  return candidate;
}

export interface JournalLineInput {
  accountId?: string;
  accountCode?: string;
  debit: Decimal.Value;
  credit: Decimal.Value;
  description?: string;
}

export const STANDARD_ACCOUNTS: Record<string, { name: string; type: any; subType: string; urduName?: string; description?: string }> = {
  // ASSETS (1000 - 1999)
  "1010": { name: "Cash in Hand", type: "ASSET", subType: "Cash", urduName: "کیش ان ہینڈ (نقدی)" },
  "1020": { name: "Main Bank Account", type: "ASSET", subType: "Bank", urduName: "مین بینک اکاؤنٹ" },
  "1030": { name: "Petty Cash", type: "ASSET", subType: "Cash", urduName: "پیٹی کیش (چھوٹا کیش)" },
  "1100": { name: "Accounts Receivable", type: "ASSET", subType: "Receivable", urduName: "اکاؤنٹس ریسیویبل (گاہکوں سے وصولیاں)" },
  "1200": { name: "Merchandise Inventory", type: "ASSET", subType: "Inventory", urduName: "تجارتی مال و انوینٹری اسٹاک" },
  "1300": { name: "Other Current Assets", type: "ASSET", subType: "Current Asset", urduName: "دیگر موجودہ اثاثے" },
  "1400": { name: "Prepaid Expenses & Advances", type: "ASSET", subType: "Prepaid", urduName: "پیشگی ادائیگیاں و ایڈوانسز" },
  "1510": { name: "Furniture, Fixtures & Equipment", type: "ASSET", subType: "Fixed Asset", urduName: "فرنیچر و دفتری سامان" },
  "1520": { name: "Vehicles & Transport Equipment", type: "ASSET", subType: "Fixed Asset", urduName: "گاڑیاں و ٹرانسپورٹ" },

  // LIABILITIES (2000 - 2999)
  "2010": { name: "Accounts Payable", type: "LIABILITY", subType: "Payable", urduName: "اکاؤنٹس پی ایبل (سپلائرز کے واجبات)" },
  "2100": { name: "Tax / VAT Payable", type: "LIABILITY", subType: "Tax", urduName: "سیلز ٹیکس / ایف بی آر واجب الادا" },
  "2200": { name: "Other Current Liabilities", type: "LIABILITY", subType: "Current Liability", urduName: "دیگر قلیل مدتی واجبات" },
  "2300": { name: "Accrued Expenses & Salaries Payable", type: "LIABILITY", subType: "Accrued Liability", urduName: "واجب الادا اخراجات و تنخواہیں" },
  "2510": { name: "Bank Loan / Long-Term Borrowings", type: "LIABILITY", subType: "Long-Term Liability", urduName: "طویل مدتی قرضہ جات / بینک لون" },

  // EQUITY / CAPITAL (3000 - 3999)
  "3010": { name: "Owner's Capital", type: "EQUITY", subType: "Capital", urduName: "اوونرز کیپیٹل (ابتدائی سرمایہ)" },
  "3020": { name: "Owner's Drawings", type: "EQUITY", subType: "Drawings", urduName: "اوونرز ڈرائنگز (ذاتی استعمال)" },
  "3100": { name: "Retained Earnings / Opening Capital", type: "EQUITY", subType: "Retained Earnings", urduName: "گزشتہ سال کا منافع / ابتدائی کھاتہ" },

  // REVENUE (4000 - 4999)
  "4010": { name: "Sales Revenue", type: "REVENUE", subType: "Operating Revenue", urduName: "سیلز ریونیو (فروخت کی آمدن)" },
  "4020": { name: "Sales Returns & Allowances", type: "REVENUE", subType: "Contra Revenue", urduName: "سیلز واپسی و رعایت" },
  "4030": { name: "Sales Discounts Allowed", type: "REVENUE", subType: "Contra Revenue", urduName: "سیلز ڈسکاؤنٹ" },
  "4100": { name: "Other Income / Discount Received", type: "REVENUE", subType: "Non-Operating Revenue", urduName: "دیگر آمدن / حاصل شدہ ڈسکاؤنٹ" },

  // COST OF GOODS SOLD (5000 - 5999)
  "5010": { name: "Cost of Goods Sold (COGS)", type: "COGS", subType: "Direct Cost", urduName: "فروخت شدہ مال کی لاگت (COGS)" },
  "5020": { name: "Inventory Shrinkage & Loss", type: "COGS", subType: "Stock Loss", urduName: "اسٹاک نقصان و ضیاع" },
  "5030": { name: "Freight & Delivery Inward", type: "COGS", subType: "Direct Cost", urduName: "مال لانے کا کرایہ / فریٹ" },

  // EXPENSES (6000 - 6999)
  "6010": { name: "Rent Expense", type: "EXPENSE", subType: "Occupancy", urduName: "کرایہ خرچ (دکان / گودام)" },
  "6020": { name: "Salaries & Wages", type: "EXPENSE", subType: "Payroll", urduName: "تنخواہیں و اجرت" },
  "6030": { name: "Electricity & Utilities", type: "EXPENSE", subType: "Utilities", urduName: "بجلی، گیس و یوٹیلیٹی بلز" },
  "6040": { name: "Internet & Mobile", type: "EXPENSE", subType: "Utilities", urduName: "انٹرنیٹ، ٹیلیفون و موبائل" },
  "6050": { name: "Transport & Fuel", type: "EXPENSE", subType: "Logistics", urduName: "ٹرانسپورٹ، پٹرول و فیول" },
  "6060": { name: "Repairs & Maintenance", type: "EXPENSE", subType: "Maintenance", urduName: "مرمت و دیکھ بھال" },
  "6070": { name: "Office Supplies & Stationery", type: "EXPENSE", subType: "Admin", urduName: "اسٹیشنری و دفتری سامان" },
  "6080": { name: "Marketing & Advertising", type: "EXPENSE", subType: "Sales", urduName: "مارکیٹنگ و تشہیر" },
  "6090": { name: "Bank Fees & Charges", type: "EXPENSE", subType: "Financial", urduName: "بینک فیس و چارجز" },
  "6100": { name: "Legal & Professional Fees", type: "EXPENSE", subType: "Professional", urduName: "قانونی و پروفیشنل فیس" },
  "6990": { name: "Miscellaneous Expenses", type: "EXPENSE", subType: "General", urduName: "متفرق اخراجات" },
};

export const ACCOUNT_URDU_NAMES: Record<string, string> = Object.fromEntries(
  Object.entries(STANDARD_ACCOUNTS).map(([code, acc]) => [code, acc.urduName || acc.name])
);

/**
 * Ensures all standard Pakistan double-entry accounting heads exist for a business.
 * If any standard account is missing, creates it with balance 0.
 */
export async function ensureStandardAccounts(
  txOrPrisma: Prisma.TransactionClient | typeof prisma,
  businessId: string
): Promise<void> {
  const existing = await txOrPrisma.account.findMany({
    where: { businessId },
    select: { code: true },
  });

  const existingCodes = new Set(existing.map((a) => a.code));
  const missingEntries = Object.entries(STANDARD_ACCOUNTS).filter(
    ([code]) => !existingCodes.has(code)
  );

  if (missingEntries.length === 0) return;

  const createPayload = missingEntries.map(([code, std]) => ({
    businessId,
    code,
    name: std.name,
    type: std.type,
    subType: std.subType,
    balance: 0,
    isSystem: true,
    isActive: true,
  }));

  try {
    await (txOrPrisma.account as any).createMany({
      data: createPayload,
      skipDuplicates: true,
    });
  } catch {
    // Fallback if createMany encounters conflict or unsupported driver
    for (const item of createPayload) {
      try {
        await txOrPrisma.account.create({ data: item });
      } catch {
        // Ignore duplicate key collision
      }
    }
  }
}

/**
 * Creates and posts a balanced double-entry Journal Entry within an active Prisma transaction.
 */
export async function createJournalEntry(
  tx: Prisma.TransactionClient,
  params: {
    businessId: string;
    date: Date | string;
    description: string;
    referenceType?: string;
    referenceId?: string;
    createdById?: string;
    lines: JournalLineInput[];
  }
) {
  const { businessId, date, description, referenceType, referenceId, createdById, lines } = params;
  const entryDate = date instanceof Date ? date : new Date(date || Date.now());

  // 1. Ensure period is not locked
  await assertPeriodOpen(tx, businessId, entryDate);

  // 2. Validate double-entry equality (Debits == Credits)
  const balanceCheck = isJournalBalanced(lines);
  if (!balanceCheck.balanced) {
    throw new JournalUnbalancedError(
      balanceCheck.totalDebit.toString(),
      balanceCheck.totalCredit.toString()
    );
  }

  // 3. Resolve accounts by ID or Code
  const resolvedLines = await Promise.all(
    lines.map(async (line) => {
      let accountId = line.accountId;
      if (!accountId && line.accountCode) {
        let acc = await tx.account.findUnique({
          where: {
            businessId_code: {
              businessId,
              code: line.accountCode,
            },
          },
        });
        if (!acc) {
          const std = STANDARD_ACCOUNTS[line.accountCode];
          if (std) {
            acc = await tx.account.create({
              data: {
                businessId,
                code: line.accountCode,
                name: std.name,
                type: std.type,
                subType: std.subType,
                balance: 0,
                isSystem: true,
              },
            });
          } else {
            throw new Error(`Account code '${line.accountCode}' not found for business.`);
          }
        }
        accountId = acc.id;
      }

      if (!accountId) {
        throw new Error("Each journal line must specify either accountId or accountCode.");
      }

      return {
        accountId,
        debit: round2(line.debit),
        credit: round2(line.credit),
        description: line.description,
      };
    })
  );

  // 4 & 5. Generate entry number and create Journal Entry with collision resilience
  let entry: any = null;
  let attempts = 0;
  while (!entry && attempts < 5) {
    attempts++;
    const entryNumber = await getNextJournalNumber(tx, businessId, entryDate);
    try {
      entry = await tx.journalEntry.create({
        data: {
          businessId,
          entryNumber,
          date: entryDate,
          description,
          referenceType,
          referenceId,
          isBalanced: true,
          status: "POSTED",
          createdById,
          lines: {
            create: resolvedLines.map((l) => ({
              accountId: l.accountId,
              debit: l.debit.toNumber(),
              credit: l.credit.toNumber(),
              description: l.description,
            })),
          },
        },
        include: {
          lines: true,
        },
      });
    } catch (createErr: any) {
      if (createErr?.code === "P2002" && attempts < 5) {
        continue;
      }
      throw createErr;
    }
  }

  if (!entry) {
    throw new Error("Failed to create Journal Entry: Unique constraint conflict on entryNumber.");
  }

  // 6. Update Account running balances
  for (const line of resolvedLines) {
    const account = await tx.account.findUnique({ where: { id: line.accountId } });
    if (account) {
      // Normal balance: ASSET, EXPENSE, COGS increase with debit, decrease with credit
      // LIABILITY, EQUITY, REVENUE increase with credit, decrease with debit
      const current = toDecimal(account.balance);
      let newBalance: Decimal;

      if (["ASSET", "EXPENSE", "COGS"].includes(account.type)) {
        newBalance = current.add(line.debit).sub(line.credit);
      } else {
        newBalance = current.add(line.credit).sub(line.debit);
      }

      await tx.account.update({
        where: { id: line.accountId },
        data: { balance: newBalance.toNumber() },
      });
    }
  }

  return entry;
}
