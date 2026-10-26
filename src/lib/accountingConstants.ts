export const ACCOUNT_URDU_NAMES: Record<string, string> = {
  // Assets
  "1010": "کیش ان ہینڈ (نقدی)",
  "1020": "مین بینک اکاؤنٹ",
  "1030": "پیٹی کیش (چھوٹا کیش)",
  "1100": "اکاؤنٹس ریسیویبل (گاہکوں سے وصولیاں)",
  "1200": "تجارتی مال و انوینٹری اسٹاک",
  "1300": "دیگر موجودہ اثاثے",
  "1400": "پیشگی ادائیگیاں و ایڈوانسز",
  "1510": "فرنیچر و دفتری سامان",
  "1520": "گاڑیاں و ٹرانسپورٹ",

  // Liabilities
  "2010": "اکاؤنٹس پی ایبل (سپلائرز کے واجبات)",
  "2100": "سیلز ٹیکس / ایف بی آر واجب الادا",
  "2200": "دیگر قلیل مدتی واجبات",
  "2300": "واجب الادا اخراجات و تنخواہیں",
  "2510": "طویل مدتی قرضہ جات / بینک لون",

  // Equity / Capital
  "3010": "اوونرز کیپیٹل (ابتدائی سرمایہ)",
  "3020": "اوونرز ڈرائنگز (ذاتی استعمال)",
  "3100": "گزشتہ سال کا منافع / ابتدائی کھاتہ",

  // Revenue
  "4010": "سیلز ریونیو (فروخت کی آمدن)",
  "4020": "سیلز واپسی و رعایت",
  "4030": "سیلز ڈسکاؤنٹ",
  "4100": "دیگر آمدن / حاصل شدہ ڈسکاؤنٹ",

  // COGS
  "5010": "فروخت شدہ مال کی لاگت (COGS)",
  "5020": "اسٹاک نقصان و ضیاع",
  "5030": "مال لانے کا کرایہ / فریٹ",

  // Expenses
  "6010": "کرایہ خرچ (دکان / گودام)",
  "6020": "تنخواہیں و اجرت",
  "6030": "بجلی، گیس و یوٹیلیٹی بلز",
  "6040": "انٹرنیٹ، ٹیلیفون و موبائل",
  "6050": "ٹرانسپورٹ، پٹرول و فیول",
  "6060": "مرمت و دیکھ بھال",
  "6070": "اسٹیشنری و دفتری سامان",
  "6080": "مارکیٹنگ و تشہیر",
  "6090": "بینک فیس و چارجز",
  "6100": "قانونی و پروفیشنل فیس",
  "6990": "متفرق اخراجات",
};

export const ACCOUNT_TYPE_CONFIG: Record<
  string,
  { label: string; urduLabel: string; codePrefix: string; badgeColor: string }
> = {
  ASSET: {
    label: "Asset",
    urduLabel: "اثاثے",
    codePrefix: "1000s",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  },
  LIABILITY: {
    label: "Liability",
    urduLabel: "واجبات",
    codePrefix: "2000s",
    badgeColor: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800",
  },
  EQUITY: {
    label: "Equity / Capital",
    urduLabel: "سرمایہ و کیپیٹل",
    codePrefix: "3000s",
    badgeColor: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800",
  },
  REVENUE: {
    label: "Revenue",
    urduLabel: "آمدن",
    codePrefix: "4000s",
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  },
  COGS: {
    label: "Cost of Sales (COGS)",
    urduLabel: "فروخت شدہ مال کی لاگت",
    codePrefix: "5000s",
    badgeColor: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  },
  EXPENSE: {
    label: "Operating Expense",
    urduLabel: "اخراجات",
    codePrefix: "6000s",
    badgeColor: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800",
  },
};

export const COMMON_SUBTYPES: Record<string, string[]> = {
  ASSET: ["Cash", "Bank", "Receivable", "Inventory", "Fixed Asset", "Prepaid", "Current Asset"],
  LIABILITY: ["Payable", "Tax", "Current Liability", "Accrued Liability", "Long-Term Liability"],
  EQUITY: ["Capital", "Drawings", "Retained Earnings"],
  REVENUE: ["Operating Revenue", "Contra Revenue", "Non-Operating Revenue"],
  COGS: ["Direct Cost", "Stock Loss"],
  EXPENSE: ["Occupancy", "Payroll", "Utilities", "Logistics", "Maintenance", "Admin", "Sales", "Financial", "Professional", "General"],
};

/**
 * Safely extracts the effective unit cost of a product for inventory valuation,
 * reporting, and COGS calculations.
 * 
 * Order of precedence:
 * 1. averageCost (if > 0)
 * 2. purchasePrice (if > 0)
 * 3. openingCost (if > 0)
 * 4. costPrice (if > 0)
 * 5. 0
 * 
 * Guards against non-empty string decimals like "0.00" being treated as truthy in JavaScript.
 */
export function getProductEffectiveCost(product: any): number {
  if (!product) return 0;
  const avg = Number(product.averageCost);
  if (!isNaN(avg) && avg > 0) return avg;

  const purchase = Number(product.purchasePrice);
  if (!isNaN(purchase) && purchase > 0) return purchase;

  const opening = Number(product.openingCost);
  if (!isNaN(opening) && opening > 0) return opening;

  const cost = Number(product.costPrice);
  if (!isNaN(cost) && cost > 0) return cost;

  return 0;
}

