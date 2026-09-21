import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting Database Seed for Complete Business Accounting System...");

  // 1. Create or Find Admin User
  const passwordHash = await bcrypt.hash("admin123", 10);
  const user = await prisma.user.upsert({
    where: { email: "admin@smartbiz.com" },
    update: {},
    create: {
      email: "admin@smartbiz.com",
      passwordHash,
      name: "Hashim Khan (Owner)",
      role: "OWNER_ADMIN",
    },
  });
  console.log(`✅ User ready: ${user.email}`);

  // 2. Create Default Business Profile
  let business = await prisma.business.findFirst({
    where: { members: { some: { userId: user.id } } },
  });

  if (!business) {
    business = await prisma.business.create({
      data: {
        name: "SmartBiz Trading & Distribution",
        ownerName: "Hashim Khan",
        phone: "+92 300 1234567",
        email: "contact@smartbiz.com",
        address: "Suit 402, Trade Tower, Karachi, Pakistan",
        country: "Pakistan",
        currency: "PKR",
        currencySymbol: "Rs",
        fiscalYearStart: "01-01",
        invoicePrefix: "INV-",
        purchasePrefix: "PUR-",
        defaultPaymentTerms: 30,
        defaultTaxRate: 0.0,
        negativeStockPolicy: false,
        members: {
          create: {
            userId: user.id,
            role: "OWNER_ADMIN",
          },
        },
      },
    });
    console.log(`✅ Business created: ${business.name}`);
  }

  // 3. Seed Chart of Accounts
  const chartOfAccounts = [
    // Assets
    { code: "1010", name: "Cash in Hand", type: "ASSET", subType: "Cash" },
    { code: "1020", name: "Main Bank Account", type: "ASSET", subType: "Bank" },
    { code: "1100", name: "Accounts Receivable", type: "ASSET", subType: "Receivable" },
    { code: "1200", name: "Merchandise Inventory", type: "ASSET", subType: "Inventory" },
    { code: "1300", name: "Other Current Assets", type: "ASSET", subType: "Current Asset" },
    // Liabilities
    { code: "2010", name: "Accounts Payable", type: "LIABILITY", subType: "Payable" },
    { code: "2100", name: "Tax / VAT Payable", type: "LIABILITY", subType: "Tax" },
    { code: "2200", name: "Other Current Liabilities", type: "LIABILITY", subType: "Current Liability" },
    // Equity
    { code: "3010", name: "Owner's Capital", type: "EQUITY", subType: "Capital" },
    { code: "3020", name: "Owner's Drawings", type: "EQUITY", subType: "Drawings" },
    { code: "3100", name: "Retained Earnings", type: "EQUITY", subType: "Retained Earnings" },
    // Revenue
    { code: "4010", name: "Sales Revenue", type: "REVENUE", subType: "Operating Revenue" },
    { code: "4020", name: "Sales Returns", type: "REVENUE", subType: "Contra Revenue" },
    { code: "4100", name: "Other Income", type: "REVENUE", subType: "Non-Operating Revenue" },
    // COGS
    { code: "5010", name: "Cost of Goods Sold (COGS)", type: "COGS", subType: "Direct Cost" },
    { code: "5020", name: "Inventory Shrinkage & Loss", type: "COGS", subType: "Stock Loss" },
    // Expenses
    { code: "6010", name: "Rent Expense", type: "EXPENSE", subType: "Occupancy" },
    { code: "6020", name: "Salaries & Wages", type: "EXPENSE", subType: "Payroll" },
    { code: "6030", name: "Electricity & Utilities", type: "EXPENSE", subType: "Utilities" },
    { code: "6040", name: "Internet & Mobile", type: "EXPENSE", subType: "Utilities" },
    { code: "6050", name: "Transport & Fuel", type: "EXPENSE", subType: "Logistics" },
    { code: "6060", name: "Repairs & Maintenance", type: "EXPENSE", subType: "Maintenance" },
    { code: "6070", name: "Office Supplies", type: "EXPENSE", subType: "Admin" },
    { code: "6080", name: "Marketing & Advertising", type: "EXPENSE", subType: "Sales" },
    { code: "6990", name: "Miscellaneous Expenses", type: "EXPENSE", subType: "General" },
  ];

  for (const acc of chartOfAccounts) {
    await prisma.account.upsert({
      where: {
        businessId_code: {
          businessId: business.id,
          code: acc.code,
        },
      },
      update: {},
      create: {
        businessId: business.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        subType: acc.subType,
        balance: 0,
        isSystem: true,
      },
    });
  }
  console.log("✅ Standard Chart of Accounts seeded.");

  // 4. Seed Cash and Bank Accounts
  const cashAccountInChart = await prisma.account.findUnique({
    where: { businessId_code: { businessId: business.id, code: "1010" } },
  });
  const bankAccountInChart = await prisma.account.findUnique({
    where: { businessId_code: { businessId: business.id, code: "1020" } },
  });

  const cashInHand = await prisma.cashBankAccount.upsert({
    where: { id: `${business.id}-cash` },
    update: {},
    create: {
      id: `${business.id}-cash`,
      businessId: business.id,
      accountId: cashAccountInChart?.id,
      name: "Cash in Hand",
      type: "CASH",
      balance: 50000,
      isDefault: true,
    },
  });

  const meezanBank = await prisma.cashBankAccount.upsert({
    where: { id: `${business.id}-bank` },
    update: {},
    create: {
      id: `${business.id}-bank`,
      businessId: business.id,
      accountId: bankAccountInChart?.id,
      name: "Meezan Bank Ltd (Operational)",
      type: "BANK",
      bankName: "Meezan Bank",
      accountNumber: "0101-0203040506",
      branch: "Main Boulevard Branch",
      balance: 250000,
      isDefault: false,
    },
  });
  console.log("✅ Cash and Bank accounts seeded.");

  // 5. Seed Expense Categories
  const expenseCats = [
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
  for (const name of expenseCats) {
    await prisma.expenseCategory.upsert({
      where: { businessId_name: { businessId: business.id, name } },
      update: {},
      create: { businessId: business.id, name, isDefault: true },
    });
  }
  console.log("✅ Expense Categories seeded.");

  // 6. Seed Product Categories and Products
  const itCat = await prisma.category.upsert({
    where: { businessId_name: { businessId: business.id, name: "Electronics & IT" } },
    update: {},
    create: { businessId: business.id, name: "Electronics & IT", description: "Computer hardware and accessories" },
  });

  const officeCat = await prisma.category.upsert({
    where: { businessId_name: { businessId: business.id, name: "Office Stationery" } },
    update: {},
    create: { businessId: business.id, name: "Office Stationery", description: "Paper and office supplies" },
  });

  const productsData = [
    {
      name: "Dell Latitude 5420 Core i5 16GB",
      sku: "DELL-LAT-5420",
      barcode: "890123456701",
      categoryId: itCat.id,
      unit: "pcs",
      purchasePrice: 95000,
      sellingPrice: 120000,
      openingQuantity: 10,
      openingCost: 95000,
      currentStock: 10,
      averageCost: 95000,
      minStockLevel: 2,
    },
    {
      name: "Logitech M185 Wireless Mouse",
      sku: "LOG-M185",
      barcode: "890123456702",
      categoryId: itCat.id,
      unit: "pcs",
      purchasePrice: 2200,
      sellingPrice: 3200,
      openingQuantity: 50,
      openingCost: 2200,
      currentStock: 50,
      averageCost: 2200,
      minStockLevel: 10,
    },
    {
      name: "Kingston 64GB USB 3.0 Flash Drive",
      sku: "KNG-USB-64",
      barcode: "890123456703",
      categoryId: itCat.id,
      unit: "pcs",
      purchasePrice: 1100,
      sellingPrice: 1800,
      openingQuantity: 80,
      openingCost: 1100,
      currentStock: 80,
      averageCost: 1100,
      minStockLevel: 15,
    },
    {
      name: "Double A Paper Ream A4 80gsm",
      sku: "DBL-A4-80G",
      barcode: "890123456704",
      categoryId: officeCat.id,
      unit: "ream",
      purchasePrice: 1350,
      sellingPrice: 1750,
      openingQuantity: 120,
      openingCost: 1350,
      currentStock: 120,
      averageCost: 1350,
      minStockLevel: 25,
    },
  ];

  for (const p of productsData) {
    const existing = await prisma.product.findFirst({
      where: { businessId: business.id, sku: p.sku },
    });
    if (!existing) {
      const createdProd = await prisma.product.create({
        data: { businessId: business.id, ...p },
      });
      // Record opening stock transaction
      await prisma.inventoryTransaction.create({
        data: {
          businessId: business.id,
          productId: createdProd.id,
          type: "OPENING",
          quantity: p.openingQuantity,
          unitCost: p.openingCost,
          totalCost: p.openingQuantity * p.openingCost,
          notes: "Initial opening stock upon onboarding",
        },
      });
    }
  }
  console.log("✅ Products & opening stock ledger seeded.");

  // 7. Seed Customers & Suppliers
  const customersData = [
    {
      name: "Ali Traders",
      businessName: "Ali & Sons Wholesale",
      phone: "+92 321 9876543",
      email: "alitrader@example.com",
      address: "Bolton Market, Karachi",
      openingBalance: 25000,
      currentBalance: 25000,
      creditLimit: 100000,
    },
    {
      name: "Bilal Electronics",
      businessName: "Bilal Tech Store",
      phone: "+92 333 4455667",
      email: "bilal@example.com",
      address: "Hafeez Center, Lahore",
      openingBalance: 8000,
      currentBalance: 8000,
      creditLimit: 50000,
    },
    {
      name: "Ahmed Raza",
      businessName: "Walk-in Retail",
      phone: "+92 300 0000000",
      openingBalance: 0,
      currentBalance: 0,
    },
  ];

  for (const c of customersData) {
    const exists = await prisma.customer.findFirst({
      where: { businessId: business.id, name: c.name },
    });
    if (!exists) {
      await prisma.customer.create({
        data: { businessId: business.id, ...c },
      });
    }
  }

  const suppliersData = [
    {
      name: "Ahmed Tech Wholesale",
      businessName: "Ahmed IT Solutions Ltd",
      phone: "+92 312 1122334",
      email: "sales@ahmedtech.com",
      address: "Techno City, Karachi",
      openingBalance: 45000,
      currentBalance: 45000,
    },
    {
      name: "National Paper Mills",
      businessName: "National Paper Industries",
      phone: "+92 345 9988776",
      email: "orders@nationalpaper.pk",
      address: "SITE Area, Karachi",
      openingBalance: 15000,
      currentBalance: 15000,
    },
  ];

  for (const s of suppliersData) {
    const exists = await prisma.supplier.findFirst({
      where: { businessId: business.id, name: s.name },
    });
    if (!exists) {
      await prisma.supplier.create({
        data: { businessId: business.id, ...s },
      });
    }
  }
  console.log("✅ Customers & Suppliers seeded.");

  console.log("🎉 Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
