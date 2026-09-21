import { AccountType } from "@prisma/client";

export interface DefaultAccountDef {
  code: string;
  name: string;
  type: AccountType;
  subType: string;
  description: string;
}

export const DEFAULT_CHART_OF_ACCOUNTS: DefaultAccountDef[] = [
  // ASSETS
  { code: "1010", name: "Cash in Hand", type: "ASSET", subType: "Cash", description: "Physical cash available on hand" },
  { code: "1020", name: "Main Bank Account", type: "ASSET", subType: "Bank", description: "Primary operational bank account" },
  { code: "1100", name: "Accounts Receivable", type: "ASSET", subType: "Receivable", description: "Money owed by customers for credit sales" },
  { code: "1200", name: "Merchandise Inventory", type: "ASSET", subType: "Inventory", description: "Value of stock/goods available for sale" },
  { code: "1300", name: "Other Current Assets", type: "ASSET", subType: "Current Asset", description: "Prepaid expenses and short-term assets" },

  // LIABILITIES
  { code: "2010", name: "Accounts Payable", type: "LIABILITY", subType: "Payable", description: "Money owed to suppliers for purchases" },
  { code: "2100", name: "Tax / VAT Payable", type: "LIABILITY", subType: "Tax", description: "Sales tax collected and payable" },
  { code: "2200", name: "Other Current Liabilities", type: "LIABILITY", subType: "Current Liability", description: "Short-term obligations" },

  // EQUITY
  { code: "3010", name: "Owner's Capital", type: "EQUITY", subType: "Capital", description: "Capital invested by the business owner" },
  { code: "3020", name: "Owner's Drawings", type: "EQUITY", subType: "Drawings", description: "Withdrawals taken by the business owner" },
  { code: "3100", name: "Retained Earnings", type: "EQUITY", subType: "Retained Earnings", description: "Accumulated net profits of the business" },

  // REVENUE / INCOME
  { code: "4010", name: "Sales Revenue", type: "REVENUE", subType: "Operating Revenue", description: "Gross income from selling goods" },
  { code: "4020", name: "Sales Returns", type: "REVENUE", subType: "Contra Revenue", description: "Goods returned by customers" },
  { code: "4100", name: "Other Income", type: "REVENUE", subType: "Non-Operating Revenue", description: "Discounts received and miscellaneous earnings" },

  // COST OF GOODS SOLD
  { code: "5010", name: "Cost of Goods Sold (COGS)", type: "COGS", subType: "Direct Cost", description: "Direct cost of products sold" },
  { code: "5020", name: "Inventory Shrinkage & Loss", type: "COGS", subType: "Stock Loss", description: "Stock adjustments, damages and physical loss" },

  // OPERATING EXPENSES
  { code: "6010", name: "Rent Expense", type: "EXPENSE", subType: "Occupancy", description: "Shop and warehouse rental" },
  { code: "6020", name: "Salaries & Wages", type: "EXPENSE", subType: "Payroll", description: "Employee compensation and daily wages" },
  { code: "6030", name: "Electricity & Utilities", type: "EXPENSE", subType: "Utilities", description: "Power, water, and gas bills" },
  { code: "6040", name: "Internet & Mobile", type: "EXPENSE", subType: "Utilities", description: "Communication and internet charges" },
  { code: "6050", name: "Transport & Fuel", type: "EXPENSE", subType: "Logistics", description: "Delivery, vehicle fuel, and cargo freight" },
  { code: "6060", name: "Repairs & Maintenance", type: "EXPENSE", subType: "Maintenance", description: "Shop and equipment maintenance" },
  { code: "6070", name: "Office Supplies", type: "EXPENSE", subType: "Admin", description: "Stationery, packaging, and tea expenses" },
  { code: "6080", name: "Marketing & Advertising", type: "EXPENSE", subType: "Sales", description: "Promotional and marketing spend" },
  { code: "6990", name: "Miscellaneous Expenses", type: "EXPENSE", subType: "General", description: "Other general operating expenses" },
];

export const DEFAULT_EXPENSE_CATEGORIES = [
  "Rent",
  "Salaries",
  "Electricity",
  "Gas",
  "Internet",
  "Transport",
  "Fuel",
  "Office Supplies",
  "Repairs",
  "Marketing",
  "Maintenance",
  "Miscellaneous",
];
