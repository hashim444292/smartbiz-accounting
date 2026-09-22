import { Decimal, round2, round4, calculateWeightedAverageCost, calculateLineTotal } from "./decimal";

export interface StoreState {
  business: any;
  activeBusinessId: string;
  companies: any[];
  users: any[];
  accounts: any[];
  cashBankAccounts: any[];
  expenseCategories: any[];
  categories: any[];
  products: any[];
  customers: any[];
  suppliers: any[];
  sales: any[];
  purchases: any[];
  payments: any[];
  expenses: any[];
  inventoryTransactions: any[];
  journalEntries: any[];
  accountingPeriods: any[];
  aiImports: any[];
  auditLogs: any[];
  subscriptionPayments: any[];
  branches: any[];
}

function initializeState(): StoreState {
  const now = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  const twoDaysAgo = new Date(Date.now() - 172800000);
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000);
  const fourDaysAgo = new Date(Date.now() - 4 * 86400000);
  const fiveDaysAgo = new Date(Date.now() - 5 * 86400000);
  const eightDaysAgo = new Date(Date.now() - 8 * 86400000);
  const twelveDaysAgo = new Date(Date.now() - 12 * 86400000);
  const fifteenDaysAgo = new Date(Date.now() - 15 * 86400000);

  // 1. Companies / Organizations
  const companies = [
    {
      id: "biz-101",
      name: "HANIF Mobile Center",
      ownerName: "Muhammad Hanif",
      phone: "+92 300 9876543",
      email: "hanif@mobile.com",
      address: "Shop 14-16, Saddar Mobile Mall, Karachi",
      city: "Karachi",
      province: "Sindh",
      country: "Pakistan",
      currency: "PKR",
      currencySymbol: "Rs",
      ntn: "1234567-8",
      strn: "17-00-1234-567-89",
      businessType: "Retail & Wholesale",
      defaultHsCode: "8517.13",
      defaultUom: "pcs",
      defaultTaxProfile: "Standard 18%",
      defaultSalesTax: 18.00,
      defaultFurtherTax: 3.00,
      defaultExtraTax: 0.00,
      defaultPaymentTerms: 30,
      defaultTaxRate: 18.00,
      negativeStockPolicy: false,
      canCreateBranches: true,
      monthlyFee: 5000,
      billingPlan: "Standard Monthly",
      subscriptionStatus: "ACTIVE",
      enabledModules: [
        "sales",
        "purchases",
        "inventory",
        "accounting",
        "compliance",
        "reports",
        "aiEntry",
        "bulkImport",
      ],
      billingCycleStart: new Date(2026, 8, 1).toISOString(),
      billingCycleEnd: new Date(2026, 9, 1).toISOString(),
      lastPaymentDate: new Date(2026, 8, 1).toISOString(),
      lastPaymentAmount: 5000,
      createdAt: new Date(2026, 0, 1).toISOString(),
    },
    {
      id: "biz-102",
      name: "SmartBiz Trading & Distribution",
      ownerName: "Hashim Khan",
      phone: "+92 321 1122334",
      email: "contact@smartbiz.com",
      address: "Suite 402, Trade Tower, Karachi",
      city: "Karachi",
      province: "Sindh",
      country: "Pakistan",
      currency: "PKR",
      currencySymbol: "Rs",
      ntn: "7654321-0",
      strn: "17-00-7654-321-12",
      businessType: "Import & Wholesale",
      defaultHsCode: "1006.30",
      defaultUom: "bag",
      defaultTaxProfile: "Standard 18%",
      defaultSalesTax: 18.00,
      defaultFurtherTax: 3.00,
      defaultExtraTax: 0.00,
      defaultPaymentTerms: 30,
      defaultTaxRate: 18.00,
      negativeStockPolicy: false,
      canCreateBranches: false,
      monthlyFee: 8000,
      billingPlan: "Enterprise Pro",
      subscriptionStatus: "ACTIVE",
      enabledModules: [
        "sales",
        "purchases",
        "inventory",
        "accounting",
        "compliance",
        "reports",
        "aiEntry",
        "bulkImport",
      ],
      billingCycleStart: new Date(2026, 8, 10).toISOString(),
      billingCycleEnd: new Date(2026, 9, 10).toISOString(),
      lastPaymentDate: new Date(2026, 8, 10).toISOString(),
      lastPaymentAmount: 8000,
      createdAt: new Date(2026, 1, 1).toISOString(),
    },
    {
      id: "biz-103",
      name: "Al-Madina Electronics & Mobile",
      ownerName: "Tariq Madina",
      phone: "+92 333 4455667",
      email: "tariq@madina.com",
      address: "Blue Area, Main Boulevard, Islamabad",
      city: "Islamabad",
      province: "Federal",
      country: "Pakistan",
      currency: "PKR",
      currencySymbol: "Rs",
      ntn: "9876543-2",
      strn: "17-00-9876-543-34",
      businessType: "Consumer Electronics",
      defaultHsCode: "8415.10",
      defaultUom: "unit",
      defaultTaxProfile: "Standard 18%",
      defaultSalesTax: 18.00,
      defaultFurtherTax: 3.00,
      defaultExtraTax: 0.00,
      defaultPaymentTerms: 30,
      defaultTaxRate: 18.00,
      negativeStockPolicy: false,
      canCreateBranches: false,
      monthlyFee: 6000,
      billingPlan: "Standard Monthly",
      subscriptionStatus: "DUE",
      enabledModules: [
        "sales",
        "purchases",
        "inventory",
        "accounting",
        "reports",
      ],
      billingCycleStart: new Date(2026, 7, 18).toISOString(),
      billingCycleEnd: new Date(2026, 8, 18).toISOString(),
      lastPaymentDate: new Date(2026, 7, 18).toISOString(),
      lastPaymentAmount: 6000,
      createdAt: new Date(2026, 2, 1).toISOString(),
    },
  ];

  // 2. Categories
  const categories = [
    // biz-101: Mobile Center
    { id: "cat-mob-101", businessId: "biz-101", name: "Smartphones & Flagships", defaultHsCode: "8517.13", description: "iOS & Android official smartphones" },
    { id: "cat-acc-101", businessId: "biz-101", name: "Accessories & Chargers", defaultHsCode: "8517.79", description: "GaN Fast chargers, AirPods, and cables" },
    { id: "cat-tab-101", businessId: "biz-101", name: "iPads & Tablets", defaultHsCode: "8471.30", description: "Apple iPads and Android tablets" },

    // biz-102: SmartBiz Trading (Wholesale FMCG & Commodities)
    { id: "cat-grain-102", businessId: "biz-102", name: "Grains, Rice & Pulses", defaultHsCode: "1006.30", description: "Basmati rice sacks and wholesale lentils" },
    { id: "cat-oil-102", businessId: "biz-102", name: "Cooking Oils & Ghee", defaultHsCode: "1515.90", description: "16L Cooking oil tins and Banaspati ghee" },
    { id: "cat-fmcg-102", businessId: "biz-102", name: "Packaged Foodstuff & Sugar", defaultHsCode: "1701.99", description: "Fauji sugar bags, spices, and tea cartons" },

    // biz-103: Al-Madina Electronics (Home Appliances)
    { id: "cat-ac-103", businessId: "biz-103", name: "Inverter Air Conditioners", defaultHsCode: "8415.10", description: "1 Ton, 1.5 Ton, and 2 Ton T3 Inverters" },
    { id: "cat-tv-103", businessId: "biz-103", name: "Smart 4K LED TVs", defaultHsCode: "8528.72", description: "Crystal UHD and QLED Smart Televisions" },
    { id: "cat-ref-103", businessId: "biz-103", name: "Refrigerators & Freezers", defaultHsCode: "8418.10", description: "Inverter frost-free fridges and deep freezers" },
  ];

  // Helper for product cost history
  const makeCostHistory = (purchasePrice: number, qty: number, sellingPrice: number) => [
    {
      date: new Date(2026, 0, 15).toISOString(),
      purchaseNumber: "OPENING-STOCK",
      previousCost: purchasePrice,
      newPurchaseCost: purchasePrice,
      quantity: qty,
      newAverageCost: purchasePrice,
      sellingPrice,
    },
  ];

  // 3. Products
  const products = [
    // biz-101: Mobile Center Products
    {
      id: "prod-101-1",
      businessId: "biz-101",
      categoryId: "cat-mob-101",
      name: "iPhone 15 Pro Max 256GB",
      sku: "IPH-15PM-256",
      productCode: "PRD-101-01",
      barcode: "8901011001",
      brand: "Apple",
      description: "Official Apple iPhone 15 Pro Max Natural Titanium",
      uom: "pcs",
      unit: "pcs",
      hsCode: "8517.13",
      taxProfile: "Standard 18%",
      salesTax: 18.00,
      furtherTax: 0.00,
      extraTax: 0.00,
      purchasePrice: 275000,
      sellingPrice: 298000,
      retailPrice: 298000,
      wholesalePrice: 288000,
      openingQuantity: 4,
      currentStock: 4,
      averageCost: 275000,
      minStockLevel: 1,
      status: "ACTIVE",
      isActive: true,
      costHistory: makeCostHistory(275000, 4, 298000),
      createdAt: new Date(2026, 0, 1).toISOString(),
      updatedAt: new Date(2026, 0, 1).toISOString(),
    },
    {
      id: "prod-101-2",
      businessId: "biz-101",
      categoryId: "cat-mob-101",
      name: "Samsung Galaxy S24 Ultra 512GB",
      sku: "SAM-S24U-512",
      productCode: "PRD-101-02",
      barcode: "8901011002",
      brand: "Samsung",
      description: "Titanium Gray Galaxy AI Official PTA Approved",
      uom: "pcs",
      unit: "pcs",
      hsCode: "8517.13",
      taxProfile: "Standard 18%",
      salesTax: 18.00,
      furtherTax: 0.00,
      extraTax: 0.00,
      purchasePrice: 295000,
      sellingPrice: 325000,
      retailPrice: 325000,
      wholesalePrice: 310000,
      openingQuantity: 3,
      currentStock: 3,
      averageCost: 295000,
      minStockLevel: 1,
      status: "ACTIVE",
      isActive: true,
      costHistory: makeCostHistory(295000, 3, 325000),
      createdAt: new Date(2026, 0, 2).toISOString(),
      updatedAt: new Date(2026, 0, 2).toISOString(),
    },
    {
      id: "prod-101-3",
      businessId: "biz-101",
      categoryId: "cat-mob-101",
      name: "Xiaomi Redmi Note 13 8/256",
      sku: "MI-NOTE-13",
      productCode: "PRD-101-03",
      barcode: "8901011003",
      brand: "Xiaomi",
      description: "Midnight Black 108MP Camera 33W Fast Charging",
      uom: "pcs",
      unit: "pcs",
      hsCode: "8517.13",
      taxProfile: "Standard 18%",
      salesTax: 18.00,
      furtherTax: 0.00,
      extraTax: 0.00,
      purchasePrice: 34000,
      sellingPrice: 39500,
      retailPrice: 39500,
      wholesalePrice: 36500,
      openingQuantity: 12,
      currentStock: 12,
      averageCost: 34000,
      minStockLevel: 2,
      status: "ACTIVE",
      isActive: true,
      costHistory: makeCostHistory(34000, 12, 39500),
      createdAt: new Date(2026, 0, 3).toISOString(),
      updatedAt: new Date(2026, 0, 3).toISOString(),
    },
    {
      id: "prod-101-4",
      businessId: "biz-101",
      categoryId: "cat-acc-101",
      name: "Anker 65W GaN Fast Charger",
      sku: "ANK-65W-GAN",
      productCode: "PRD-101-04",
      barcode: "8901011004",
      brand: "Anker",
      description: "Dual USB-C Port Compact Wall Charger",
      uom: "pcs",
      unit: "pcs",
      hsCode: "8517.79",
      taxProfile: "Standard 18%",
      salesTax: 18.00,
      furtherTax: 0.00,
      extraTax: 0.00,
      purchasePrice: 5500,
      sellingPrice: 7500,
      retailPrice: 7500,
      wholesalePrice: 6200,
      openingQuantity: 25,
      currentStock: 25,
      averageCost: 5500,
      minStockLevel: 5,
      status: "ACTIVE",
      isActive: true,
      costHistory: makeCostHistory(5500, 25, 7500),
      createdAt: new Date(2026, 0, 4).toISOString(),
      updatedAt: new Date(2026, 0, 4).toISOString(),
    },
    {
      id: "prod-101-5",
      businessId: "biz-101",
      categoryId: "cat-acc-101",
      name: "Apple AirPods Pro 2nd Gen (Type-C)",
      sku: "APP-AIR-PRO2",
      productCode: "PRD-101-05",
      barcode: "8901011005",
      brand: "Apple",
      description: "Active Noise Cancellation MagSafe Case USB-C",
      uom: "pcs",
      unit: "pcs",
      hsCode: "8517.79",
      taxProfile: "Standard 18%",
      salesTax: 18.00,
      furtherTax: 0.00,
      extraTax: 0.00,
      purchasePrice: 52000,
      sellingPrice: 59000,
      retailPrice: 59000,
      wholesalePrice: 55000,
      openingQuantity: 8,
      currentStock: 8,
      averageCost: 52000,
      minStockLevel: 2,
      status: "ACTIVE",
      isActive: true,
      costHistory: makeCostHistory(52000, 8, 59000),
      createdAt: new Date(2026, 0, 5).toISOString(),
      updatedAt: new Date(2026, 0, 5).toISOString(),
    },

    // biz-102: SmartBiz Trading (Wholesale FMCG & Commodities)
    {
      id: "prod-102-1",
      businessId: "biz-102",
      categoryId: "cat-grain-102",
      name: "Super Kernel Basmati Rice 25kg Bag",
      sku: "RICE-BAS-25KG",
      productCode: "PRD-102-01",
      barcode: "8901021001",
      brand: "Punjab Mills",
      description: "Aged Super Kernel Export Quality Long Grain Rice",
      uom: "bag",
      unit: "bag",
      hsCode: "1006.30",
      taxProfile: "Standard 18%",
      salesTax: 18.00,
      furtherTax: 0.00,
      extraTax: 0.00,
      purchasePrice: 6800,
      sellingPrice: 7600,
      retailPrice: 7600,
      wholesalePrice: 7200,
      openingQuantity: 150,
      currentStock: 150,
      averageCost: 6800,
      minStockLevel: 20,
      status: "ACTIVE",
      isActive: true,
      costHistory: makeCostHistory(6800, 150, 7600),
      createdAt: new Date(2026, 1, 1).toISOString(),
      updatedAt: new Date(2026, 1, 1).toISOString(),
    },
    {
      id: "prod-102-2",
      businessId: "biz-102",
      categoryId: "cat-oil-102",
      name: "Habib Cooking Oil 16L Tin",
      sku: "OIL-HAB-16L",
      productCode: "PRD-102-02",
      barcode: "8901021002",
      brand: "Habib",
      description: "Pure Canola & Soybean Cooking Oil 16 Liters Tin",
      uom: "tin",
      unit: "tin",
      hsCode: "1515.90",
      taxProfile: "Standard 18%",
      salesTax: 18.00,
      furtherTax: 0.00,
      extraTax: 0.00,
      purchasePrice: 8400,
      sellingPrice: 9200,
      retailPrice: 9200,
      wholesalePrice: 8800,
      openingQuantity: 80,
      currentStock: 80,
      averageCost: 8400,
      minStockLevel: 10,
      status: "ACTIVE",
      isActive: true,
      costHistory: makeCostHistory(8400, 80, 9200),
      createdAt: new Date(2026, 1, 2).toISOString(),
      updatedAt: new Date(2026, 1, 2).toISOString(),
    },
    {
      id: "prod-102-3",
      businessId: "biz-102",
      categoryId: "cat-fmcg-102",
      name: "Fauji Refined White Sugar 50kg Sack",
      sku: "SUG-FAU-50KG",
      productCode: "PRD-102-03",
      barcode: "8901021003",
      brand: "Fauji",
      description: "Grade-1 Double Refined Pure Cane Sugar 50kg Bag",
      uom: "bag",
      unit: "bag",
      hsCode: "1701.99",
      taxProfile: "Standard 18%",
      salesTax: 18.00,
      furtherTax: 0.00,
      extraTax: 0.00,
      purchasePrice: 6400,
      sellingPrice: 7100,
      retailPrice: 7100,
      wholesalePrice: 6800,
      openingQuantity: 200,
      currentStock: 200,
      averageCost: 6400,
      minStockLevel: 25,
      status: "ACTIVE",
      isActive: true,
      costHistory: makeCostHistory(6400, 200, 7100),
      createdAt: new Date(2026, 1, 3).toISOString(),
      updatedAt: new Date(2026, 1, 3).toISOString(),
    },
    {
      id: "prod-102-4",
      businessId: "biz-102",
      categoryId: "cat-grain-102",
      name: "Daal Chana Special 50kg Sack",
      sku: "PULSE-CHANA-50KG",
      productCode: "PRD-102-04",
      barcode: "8901021004",
      brand: "Wholesale Harvest",
      description: "Clean Polished Yellow Gram Pulse 50kg Wholesale Bag",
      uom: "bag",
      unit: "bag",
      hsCode: "0713.20",
      taxProfile: "Standard 18%",
      salesTax: 18.00,
      furtherTax: 0.00,
      extraTax: 0.00,
      purchasePrice: 12000,
      sellingPrice: 13500,
      retailPrice: 13500,
      wholesalePrice: 12800,
      openingQuantity: 60,
      currentStock: 60,
      averageCost: 12000,
      minStockLevel: 10,
      status: "ACTIVE",
      isActive: true,
      costHistory: makeCostHistory(12000, 60, 13500),
      createdAt: new Date(2026, 1, 4).toISOString(),
      updatedAt: new Date(2026, 1, 4).toISOString(),
    },
    {
      id: "prod-102-5",
      businessId: "biz-102",
      categoryId: "cat-fmcg-102",
      name: "Shan Special Biryani Masala Carton (48x50g)",
      sku: "SHAN-BIRY-CTN",
      productCode: "PRD-102-05",
      barcode: "8901021005",
      brand: "Shan",
      description: "Master Distributor Pack of 48 individual recipe packets",
      uom: "carton",
      unit: "carton",
      hsCode: "2103.90",
      taxProfile: "Standard 18%",
      salesTax: 18.00,
      furtherTax: 0.00,
      extraTax: 0.00,
      purchasePrice: 4800,
      sellingPrice: 5600,
      retailPrice: 5600,
      wholesalePrice: 5200,
      openingQuantity: 95,
      currentStock: 95,
      averageCost: 4800,
      minStockLevel: 15,
      status: "ACTIVE",
      isActive: true,
      costHistory: makeCostHistory(4800, 95, 5600),
      createdAt: new Date(2026, 1, 5).toISOString(),
      updatedAt: new Date(2026, 1, 5).toISOString(),
    },

    // biz-103: Al-Madina Electronics (Home Appliances & TVs)
    {
      id: "prod-103-1",
      businessId: "biz-103",
      categoryId: "cat-ac-103",
      name: "Haier 1.5 Ton T3 DC Inverter AC (HSU-18HFP)",
      sku: "AC-HAI-1.5T",
      productCode: "PRD-103-01",
      barcode: "8901031001",
      brand: "Haier",
      description: "Heat & Cool 1.5 Ton Inverter Air Conditioner 66% Energy Saving",
      uom: "unit",
      unit: "unit",
      hsCode: "8415.10",
      taxProfile: "Standard 18%",
      salesTax: 18.00,
      furtherTax: 0.00,
      extraTax: 0.00,
      purchasePrice: 132000,
      sellingPrice: 149000,
      retailPrice: 149000,
      wholesalePrice: 141000,
      openingQuantity: 15,
      currentStock: 15,
      averageCost: 132000,
      minStockLevel: 2,
      status: "ACTIVE",
      isActive: true,
      costHistory: makeCostHistory(132000, 15, 149000),
      createdAt: new Date(2026, 2, 1).toISOString(),
      updatedAt: new Date(2026, 2, 1).toISOString(),
    },
    {
      id: "prod-103-2",
      businessId: "biz-103",
      categoryId: "cat-ref-103",
      name: "Dawlance 9199 AVANTE Inverter Refrigerator",
      sku: "REF-DAW-9199",
      productCode: "PRD-103-02",
      barcode: "8901031002",
      brand: "Dawlance",
      description: "16 Cubic Feet Inverter Glass Door Frost Refrigerator",
      uom: "unit",
      unit: "unit",
      hsCode: "8418.10",
      taxProfile: "Standard 18%",
      salesTax: 18.00,
      furtherTax: 0.00,
      extraTax: 0.00,
      purchasePrice: 110000,
      sellingPrice: 124000,
      retailPrice: 124000,
      wholesalePrice: 118000,
      openingQuantity: 10,
      currentStock: 10,
      averageCost: 110000,
      minStockLevel: 2,
      status: "ACTIVE",
      isActive: true,
      costHistory: makeCostHistory(110000, 10, 124000),
      createdAt: new Date(2026, 2, 2).toISOString(),
      updatedAt: new Date(2026, 2, 2).toISOString(),
    },
    {
      id: "prod-103-3",
      businessId: "biz-103",
      categoryId: "cat-tv-103",
      name: "Samsung 65-inch Crystal UHD 4K Smart TV",
      sku: "TV-SAM-65UHD",
      productCode: "PRD-103-03",
      barcode: "8901031003",
      brand: "Samsung",
      description: "CU7000 Series HDR 10+ Tizen OS Smart Television",
      uom: "unit",
      unit: "unit",
      hsCode: "8528.72",
      taxProfile: "Standard 18%",
      salesTax: 18.00,
      furtherTax: 0.00,
      extraTax: 0.00,
      purchasePrice: 180000,
      sellingPrice: 205000,
      retailPrice: 205000,
      wholesalePrice: 195000,
      openingQuantity: 6,
      currentStock: 6,
      averageCost: 180000,
      minStockLevel: 1,
      status: "ACTIVE",
      isActive: true,
      costHistory: makeCostHistory(180000, 6, 205000),
      createdAt: new Date(2026, 2, 3).toISOString(),
      updatedAt: new Date(2026, 2, 3).toISOString(),
    },
    {
      id: "prod-103-4",
      businessId: "biz-103",
      categoryId: "cat-ref-103",
      name: "PEL Arctic Deep Freezer 350L (Inverter)",
      sku: "FZ-PEL-350L",
      productCode: "PRD-103-04",
      barcode: "8901031004",
      brand: "PEL",
      description: "Single Door Quick Freezing Low Voltage Operation 350L",
      uom: "unit",
      unit: "unit",
      hsCode: "8418.30",
      taxProfile: "Standard 18%",
      salesTax: 18.00,
      furtherTax: 0.00,
      extraTax: 0.00,
      purchasePrice: 74000,
      sellingPrice: 85000,
      retailPrice: 85000,
      wholesalePrice: 80000,
      openingQuantity: 8,
      currentStock: 8,
      averageCost: 74000,
      minStockLevel: 2,
      status: "ACTIVE",
      isActive: true,
      costHistory: makeCostHistory(74000, 8, 85000),
      createdAt: new Date(2026, 2, 4).toISOString(),
      updatedAt: new Date(2026, 2, 4).toISOString(),
    },
    {
      id: "prod-103-5",
      businessId: "biz-103",
      categoryId: "cat-ac-103",
      name: "Orient 1.0 Ton Eco Inverter AC",
      sku: "AC-ORI-1.0T",
      productCode: "PRD-103-05",
      barcode: "8901031005",
      brand: "Orient",
      description: "Ultron Classic Smart DC Inverter with Japanese Componentry",
      uom: "unit",
      unit: "unit",
      hsCode: "8415.10",
      taxProfile: "Standard 18%",
      salesTax: 18.00,
      furtherTax: 0.00,
      extraTax: 0.00,
      purchasePrice: 98000,
      sellingPrice: 112000,
      retailPrice: 112000,
      wholesalePrice: 105000,
      openingQuantity: 18,
      currentStock: 18,
      averageCost: 98000,
      minStockLevel: 3,
      status: "ACTIVE",
      isActive: true,
      costHistory: makeCostHistory(98000, 18, 112000),
      createdAt: new Date(2026, 2, 5).toISOString(),
      updatedAt: new Date(2026, 2, 5).toISOString(),
    },
  ];

  // 4. Customers
  const customers = [
    // biz-101 Customers
    { id: "cust-101-1", businessId: "biz-101", code: "CUST-101-01", name: "Saddar Mobile Zone", businessName: "Saddar Cellular Traders", phone: "+92 300 1234047", openingBalance: 85000, currentBalance: 85000, creditLimit: 300000, sales: [], payments: [] },
    { id: "cust-101-2", businessId: "biz-101", code: "CUST-101-02", name: "Bilal Tech Clifton", businessName: "Bilal Communication Network", phone: "+92 321 5550178", openingBalance: 140000, currentBalance: 140000, creditLimit: 500000, sales: [], payments: [] },
    { id: "cust-101-3", businessId: "biz-101", code: "CUST-101-03", name: "Walk-in Retail Cash Counter", businessName: "Retail Walk-in Customers", phone: "+92 300 0000001", openingBalance: 0, currentBalance: 0, creditLimit: 50000, sales: [], payments: [] },

    // biz-102 Customers
    { id: "cust-102-1", businessId: "biz-102", code: "CUST-102-01", name: "Metro Cash & Carry Pakistan", businessName: "Metro Wholesale Hub", phone: "+92 21 111786111", openingBalance: 420000, currentBalance: 420000, creditLimit: 2000000, sales: [], payments: [] },
    { id: "cust-102-2", businessId: "biz-102", code: "CUST-102-02", name: "Imtiaz Super Market Karachi", businessName: "Imtiaz Mart Distribution Center", phone: "+92 21 34567890", openingBalance: 680000, currentBalance: 680000, creditLimit: 3000000, sales: [], payments: [] },
    { id: "cust-102-3", businessId: "biz-102", code: "CUST-102-03", name: "Al-Fatah Departmental Store", businessName: "Al-Fatah Superstores", phone: "+92 42 111328328", openingBalance: 195000, currentBalance: 195000, creditLimit: 1000000, sales: [], payments: [] },

    // biz-103 Customers
    { id: "cust-103-1", businessId: "biz-103", code: "CUST-103-01", name: "Islamabad Club Residences", businessName: "Islamabad Club Hospitality Wing", phone: "+92 51 9227100", openingBalance: 280000, currentBalance: 280000, creditLimit: 1500000, sales: [], payments: [] },
    { id: "cust-103-2", businessId: "biz-103", code: "CUST-103-02", name: "Capital Builders F-7", businessName: "Capital Luxury Homes & Construction", phone: "+92 51 2654321", openingBalance: 540000, currentBalance: 540000, creditLimit: 2500000, sales: [], payments: [] },
    { id: "cust-103-3", businessId: "biz-103", code: "CUST-103-03", name: "Blue Area Walk-in Client Registry", businessName: "Showroom Walk-in Clients", phone: "+92 333 5544332", openingBalance: 45000, currentBalance: 45000, creditLimit: 200000, sales: [], payments: [] },
  ];

  // 5. Suppliers
  const suppliers = [
    // biz-101 Suppliers
    { id: "sup-101-1", businessId: "biz-101", code: "SUP-101-01", name: "Apple Distributor Pakistan", businessName: "Apple Official Regional Distributor", phone: "+92 21 111277531", address: "Shahrah-e-Faisal, Karachi", openingBalance: 450000, currentBalance: 450000, purchases: [], payments: [] },
    { id: "sup-101-2", businessId: "biz-101", code: "SUP-101-02", name: "Samsung Official Wholesaler", businessName: "Samsung Pakistan Mobility", phone: "+92 21 34329988", address: "Techno City Mall, Karachi", openingBalance: 280000, currentBalance: 280000, purchases: [], payments: [] },

    // biz-102 Suppliers
    { id: "sup-102-1", businessId: "biz-102", code: "SUP-102-01", name: "Punjab Rice Mills Ltd", businessName: "Punjab Agro Industries Lahore", phone: "+92 42 35789900", address: "G.T. Road, Gujranwala", openingBalance: 850000, currentBalance: 850000, purchases: [], payments: [] },
    { id: "sup-102-2", businessId: "biz-102", code: "SUP-102-02", name: "Dalda Foods Corporation", businessName: "Dalda Foods Wholesale Division", phone: "+92 21 111325321", address: "SITE Industrial Area, Karachi", openingBalance: 620000, currentBalance: 620000, purchases: [], payments: [] },
    { id: "sup-102-3", businessId: "biz-102", code: "SUP-102-03", name: "Fauji Sugar Mills Ltd", businessName: "Fauji Fertilizer & Foods Complex", phone: "+92 51 8450001", address: "Rawalpindi Agro Zone", openingBalance: 480000, currentBalance: 480000, purchases: [], payments: [] },

    // biz-103 Suppliers
    { id: "sup-103-1", businessId: "biz-103", code: "SUP-103-01", name: "Haier Pakistan Corporation", businessName: "Haier Appliances Manufacturing Ltd", phone: "+92 42 111142437", address: "Industrial Estate, Lahore", openingBalance: 780000, currentBalance: 780000, purchases: [], payments: [] },
    { id: "sup-103-2", businessId: "biz-103", code: "SUP-103-02", name: "Dawlance Electronics Pvt Ltd", businessName: "Dawlance Manufacturing Hub", phone: "+92 21 111119725", address: "Landhi Industrial Area, Karachi", openingBalance: 550000, currentBalance: 550000, purchases: [], payments: [] },
  ];

  // 6. Cash & Bank Accounts
  const cashBankAccounts = [
    // biz-101
    { id: "cb-101-cash", businessId: "biz-101", name: "Shop Cash Drawer (Saddar)", type: "CASH", balance: 391500, isDefault: true },
    { id: "cb-101-bank", businessId: "biz-101", name: "Habib Bank Limited (HBL Saddar)", type: "BANK", balance: 528500, isDefault: false },

    // biz-102
    { id: "cb-102-cash", businessId: "biz-102", name: "Wholesale Cash Vault", type: "CASH", balance: 1250000, isDefault: true },
    { id: "cb-102-bank", businessId: "biz-102", name: "Meezan Bank Islamic Current", type: "BANK", balance: 2850000, isDefault: false },

    // biz-103
    { id: "cb-103-cash", businessId: "biz-103", name: "Showroom Cash Counter", type: "CASH", balance: 420000, isDefault: true },
    { id: "cb-103-bank", businessId: "biz-103", name: "Bank Alfalah Blue Area Corporate", type: "BANK", balance: 1650000, isDefault: false },
  ];

  // 7. Expense Categories
  const expenseCategories = [
    // biz-101
    { id: "expcat-101-1", businessId: "biz-101", name: "Saddar Shop Rent" },
    { id: "expcat-101-2", businessId: "biz-101", name: "Electricity & Generator Fuel" },
    { id: "expcat-101-3", businessId: "biz-101", name: "Technician & Staff Wages" },

    // biz-102
    { id: "expcat-102-1", businessId: "biz-102", name: "Godown Warehouse Lease" },
    { id: "expcat-102-2", businessId: "biz-102", name: "Freight Cargo & Transportation" },
    { id: "expcat-102-3", businessId: "biz-102", name: "Port Clearance & Customs Duty" },

    // biz-103
    { id: "expcat-103-1", businessId: "biz-103", name: "Blue Area Commercial Rent" },
    { id: "expcat-103-2", businessId: "biz-103", name: "HVAC Installation Wages" },
    { id: "expcat-103-3", businessId: "biz-103", name: "Delivery Truck Fuel & Upkeep" },
  ];

  // 8. Expenses
  const expenses = [
    // biz-101
    { id: "exp-101-1", businessId: "biz-101", categoryId: "expcat-101-1", category: { name: "Saddar Shop Rent" }, date: twoDaysAgo.toISOString(), description: "Monthly Saddar Mobile Mall rent", amount: 45000, paymentMethod: "BANK", paidTo: "Mall Management Saddar", notes: "Paid via HBL Cheque" },
    { id: "exp-101-2", businessId: "biz-101", categoryId: "expcat-101-2", category: { name: "Electricity & Generator Fuel" }, date: yesterday.toISOString(), description: "Shop electricity & generator diesel", amount: 18500, paymentMethod: "CASH", paidTo: "K-Electric", notes: "Cash voucher" },

    // biz-102
    { id: "exp-102-1", businessId: "biz-102", categoryId: "expcat-102-1", category: { name: "Godown Warehouse Lease" }, date: twoDaysAgo.toISOString(), description: "Kemari Godown storage rent", amount: 120000, paymentMethod: "BANK", paidTo: "Kemari Warehouse Estate", notes: "Paid via Meezan Bank" },
    { id: "exp-102-2", businessId: "biz-102", categoryId: "expcat-102-2", category: { name: "Freight Cargo & Transportation" }, date: yesterday.toISOString(), description: "20 Wheeler trailer freight from Punjab", amount: 65000, paymentMethod: "CASH", paidTo: "National Goods Transport", notes: "Freight receipt" },

    // biz-103
    { id: "exp-103-1", businessId: "biz-103", categoryId: "expcat-103-1", category: { name: "Blue Area Commercial Rent" }, date: twoDaysAgo.toISOString(), description: "Main showroom rental advance", amount: 150000, paymentMethod: "BANK", paidTo: "Blue Area Commercial Plaza", notes: "Bank Alfalah transfer" },
    { id: "exp-103-2", businessId: "biz-103", categoryId: "expcat-103-3", category: { name: "Delivery Truck Fuel & Upkeep" }, date: yesterday.toISOString(), description: "Appliance delivery van diesel & service", amount: 28000, paymentMethod: "CASH", paidTo: "PSO Blue Area", notes: "Van fuel" },
  ];

  // 9. Sales Invoices
  const sales = [
    // biz-101 Sales (Mobiles)
    {
      id: "sale-101-1",
      businessId: "biz-101",
      invoiceNumber: "INV-2026-00001",
      date: yesterday.toISOString(),
      customerName: "Saddar Mobile Zone",
      customerId: "cust-101-1",
      subtotal: 252542.37,
      salesTax: 45457.63,
      furtherTax: 0,
      extraTax: 0,
      taxAmount: 45457.63,
      totalAmount: 298000,
      paidAmount: 200000,
      remainingAmount: 98000,
      paymentStatus: "PARTIAL",
      paymentMethod: "BANK",
      status: "POSTED",
      fbrStatus: "SUCCESS",
      fbrInvoiceNumber: "FBR-POS-2026-00001",
      fbrQrCode: "https://e.fbr.gov.pk/verify?inv=FBR-POS-2026-00001&amt=298000",
      items: [
        {
          id: "si-101-1",
          productId: "prod-101-1",
          productName: "iPhone 15 Pro Max 256GB",
          sku: "IPH-15PM-256",
          hsCode: "8517.13",
          quantity: 1,
          unitPrice: 298000,
          lineTotal: 298000,
          costPrice: 275000,
        },
      ],
    },
    {
      id: "sale-101-2",
      businessId: "biz-101",
      invoiceNumber: "INV-2026-00002",
      date: now.toISOString(),
      customerName: "Bilal Tech Clifton",
      customerId: "cust-101-2",
      subtotal: 66949.15,
      salesTax: 12050.85,
      furtherTax: 0,
      extraTax: 0,
      taxAmount: 12050.85,
      totalAmount: 79000,
      paidAmount: 79000,
      remainingAmount: 0,
      paymentStatus: "PAID",
      paymentMethod: "CASH",
      status: "POSTED",
      fbrStatus: "SUCCESS",
      fbrInvoiceNumber: "FBR-POS-2026-00002",
      fbrQrCode: "https://e.fbr.gov.pk/verify?inv=FBR-POS-2026-00002&amt=79000",
      items: [
        {
          id: "si-101-2",
          productId: "prod-101-3",
          productName: "Xiaomi Redmi Note 13 8/256",
          sku: "MI-NOTE-13",
          hsCode: "8517.13",
          quantity: 2,
          unitPrice: 39500,
          lineTotal: 79000,
          costPrice: 34000,
        },
      ],
    },
    {
      id: "sale-101-3",
      businessId: "biz-101",
      invoiceNumber: "INV-2026-00003",
      date: now.toISOString(),
      customerName: "Walk-In Cash Customer",
      customerId: "cust-101-1",
      subtotal: 7203.39,
      salesTax: 1296.61,
      furtherTax: 0,
      extraTax: 0,
      taxAmount: 1296.61,
      totalAmount: 8500,
      paidAmount: 8500,
      remainingAmount: 0,
      paymentStatus: "PAID",
      paymentMethod: "CASH",
      status: "POSTED",
      fbrStatus: "SUCCESS",
      fbrInvoiceNumber: "FBR-POS-2026-00003",
      fbrQrCode: "https://e.fbr.gov.pk/verify?inv=FBR-POS-2026-00003&amt=8500",
      items: [
        {
          id: "si-101-3",
          productId: "prod-101-5",
          productName: "Original 20W Apple USB-C Power Adapter",
          sku: "ACC-APL-20W",
          hsCode: "8504.40",
          quantity: 1,
          unitPrice: 8500,
          lineTotal: 8500,
          costPrice: 6500,
        },
      ],
    },
    {
      id: "sale-101-4",
      businessId: "biz-101",
      invoiceNumber: "INV-2026-00004",
      date: now.toISOString(),
      customerName: "Tariq Telecom Tariq Road",
      customerId: "cust-101-2",
      subtotal: 207627.12,
      salesTax: 37372.88,
      furtherTax: 0,
      extraTax: 0,
      taxAmount: 37372.88,
      totalAmount: 245000,
      paidAmount: 150000,
      remainingAmount: 95000,
      paymentStatus: "PARTIAL",
      paymentMethod: "BANK",
      status: "POSTED",
      fbrStatus: "SUCCESS",
      fbrInvoiceNumber: "FBR-POS-2026-00004",
      fbrQrCode: "https://e.fbr.gov.pk/verify?inv=FBR-POS-2026-00004&amt=245000",
      items: [
        {
          id: "si-101-4",
          productId: "prod-101-2",
          productName: "Samsung Galaxy S24 Ultra 512GB",
          sku: "SAM-S24U-512",
          hsCode: "8517.13",
          quantity: 1,
          unitPrice: 245000,
          lineTotal: 245000,
          costPrice: 228000,
        },
      ],
    },
    {
      id: "sale-101-5",
      businessId: "biz-101",
      invoiceNumber: "INV-2026-00005",
      date: yesterday.toISOString(),
      customerName: "Fast Com Mobile Gulshan",
      customerId: "cust-101-1",
      subtotal: 139830.51,
      salesTax: 25169.49,
      furtherTax: 0,
      extraTax: 0,
      taxAmount: 25169.49,
      totalAmount: 165000,
      paidAmount: 0,
      remainingAmount: 165000,
      paymentStatus: "UNPAID",
      paymentMethod: "CREDIT",
      status: "POSTED",
      fbrStatus: "PENDING",
      fbrInvoiceNumber: "FBR-POS-2026-00005",
      fbrQrCode: "https://e.fbr.gov.pk/verify?inv=FBR-POS-2026-00005&amt=165000",
      items: [
        {
          id: "si-101-5",
          productId: "prod-101-4",
          productName: "Infinix Note 40 Pro 8/256GB",
          sku: "INF-NOTE-40P",
          hsCode: "8517.13",
          quantity: 3,
          unitPrice: 55000,
          lineTotal: 165000,
          costPrice: 48000,
        },
      ],
    },
    {
      id: "sale-101-6",
      businessId: "biz-101",
      invoiceNumber: "INV-2026-00006",
      date: yesterday.toISOString(),
      customerName: "Royal Mobiles Nazimabad",
      customerId: "cust-101-2",
      subtotal: 75423.73,
      salesTax: 13576.27,
      furtherTax: 0,
      extraTax: 0,
      taxAmount: 13576.27,
      totalAmount: 89000,
      paidAmount: 89000,
      remainingAmount: 0,
      paymentStatus: "PAID",
      paymentMethod: "BANK",
      status: "POSTED",
      fbrStatus: "SUCCESS",
      fbrInvoiceNumber: "FBR-POS-2026-00006",
      fbrQrCode: "https://e.fbr.gov.pk/verify?inv=FBR-POS-2026-00006&amt=89000",
      items: [
        {
          id: "si-101-6",
          productId: "prod-101-3",
          productName: "Xiaomi Redmi Note 13 8/256",
          sku: "MI-NOTE-13",
          hsCode: "8517.13",
          quantity: 2,
          unitPrice: 44500,
          lineTotal: 89000,
          costPrice: 38000,
        },
      ],
    },
    {
      id: "sale-101-7",
      businessId: "biz-101",
      invoiceNumber: "INV-2026-00007",
      date: yesterday.toISOString(),
      customerName: "Walk in (Walk in)",
      customerId: "cust-101-1",
      subtotal: 6355.93,
      salesTax: 1144.07,
      furtherTax: 0,
      extraTax: 0,
      taxAmount: 1144.07,
      totalAmount: 7500,
      paidAmount: 2000,
      remainingAmount: 5500,
      paymentStatus: "PARTIAL",
      paymentMethod: "CASH",
      status: "POSTED",
      fbrStatus: "SUCCESS",
      fbrInvoiceNumber: "FBR-POS-2026-00007",
      fbrQrCode: "https://e.fbr.gov.pk/verify?inv=FBR-POS-2026-00007&amt=7500",
      items: [
        {
          id: "si-101-7",
          productId: "prod-101-5",
          productName: "Original 20W Apple USB-C Power Adapter",
          sku: "ACC-APL-20W",
          hsCode: "8504.40",
          quantity: 1,
          unitPrice: 7500,
          lineTotal: 7500,
          costPrice: 5800,
        },
      ],
    },
    {
      id: "sale-101-8",
      businessId: "biz-101",
      invoiceNumber: "INV-2026-00008",
      date: twoDaysAgo.toISOString(),
      customerName: "City Communication Hyderabad",
      customerId: "cust-101-1",
      subtotal: 347457.63,
      salesTax: 62542.37,
      furtherTax: 0,
      extraTax: 0,
      taxAmount: 62542.37,
      totalAmount: 410000,
      paidAmount: 250000,
      remainingAmount: 160000,
      paymentStatus: "PARTIAL",
      paymentMethod: "BANK",
      status: "POSTED",
      fbrStatus: "SUCCESS",
      fbrInvoiceNumber: "FBR-POS-2026-00008",
      fbrQrCode: "https://e.fbr.gov.pk/verify?inv=FBR-POS-2026-00008&amt=410000",
      items: [
        {
          id: "si-101-8",
          productId: "prod-101-1",
          productName: "iPhone 15 Pro Max 256GB",
          sku: "IPH-15PM-256",
          hsCode: "8517.13",
          quantity: 1,
          unitPrice: 298000,
          lineTotal: 298000,
          costPrice: 275000,
        },
        {
          id: "si-101-8b",
          productId: "prod-101-4",
          productName: "Infinix Note 40 Pro 8/256GB",
          sku: "INF-NOTE-40P",
          hsCode: "8517.13",
          quantity: 2,
          unitPrice: 56000,
          lineTotal: 112000,
          costPrice: 48000,
        },
      ],
    },
    {
      id: "sale-101-9",
      businessId: "biz-101",
      invoiceNumber: "INV-2026-00009",
      date: threeDaysAgo.toISOString(),
      customerName: "Star Cellular Karachi",
      customerId: "cust-101-2",
      subtotal: 122881.36,
      salesTax: 22118.64,
      furtherTax: 0,
      extraTax: 0,
      taxAmount: 22118.64,
      totalAmount: 145000,
      paidAmount: 145000,
      remainingAmount: 0,
      paymentStatus: "PAID",
      paymentMethod: "CASH",
      status: "POSTED",
      fbrStatus: "SUCCESS",
      fbrInvoiceNumber: "FBR-POS-2026-00009",
      fbrQrCode: "https://e.fbr.gov.pk/verify?inv=FBR-POS-2026-00009&amt=145000",
      items: [
        {
          id: "si-101-9",
          productId: "prod-101-3",
          productName: "Xiaomi Redmi Note 13 8/256",
          sku: "MI-NOTE-13",
          hsCode: "8517.13",
          quantity: 3,
          unitPrice: 41000,
          lineTotal: 123000,
          costPrice: 35000,
        },
        {
          id: "si-101-9b",
          productId: "prod-101-5",
          productName: "Original 20W Apple USB-C Power Adapter",
          sku: "ACC-APL-20W",
          hsCode: "8504.40",
          quantity: 2,
          unitPrice: 11000,
          lineTotal: 22000,
          costPrice: 7500,
        },
      ],
    },
    {
      id: "sale-101-10",
      businessId: "biz-101",
      invoiceNumber: "INV-2026-00010",
      date: fourDaysAgo.toISOString(),
      customerName: "Prime Gadgets Gulberg",
      customerId: "cust-101-1",
      subtotal: 55084.75,
      salesTax: 9915.25,
      furtherTax: 0,
      extraTax: 0,
      taxAmount: 9915.25,
      totalAmount: 65000,
      paidAmount: 0,
      remainingAmount: 65000,
      paymentStatus: "UNPAID",
      paymentMethod: "CREDIT",
      status: "POSTED",
      fbrStatus: "PENDING",
      fbrInvoiceNumber: "FBR-POS-2026-00010",
      fbrQrCode: "https://e.fbr.gov.pk/verify?inv=FBR-POS-2026-00010&amt=65000",
      items: [
        {
          id: "si-101-10",
          productId: "prod-101-4",
          productName: "Infinix Note 40 Pro 8/256GB",
          sku: "INF-NOTE-40P",
          hsCode: "8517.13",
          quantity: 1,
          unitPrice: 55000,
          lineTotal: 55000,
          costPrice: 48000,
        },
      ],
    },
    {
      id: "sale-101-11",
      businessId: "biz-101",
      invoiceNumber: "INV-2026-00011",
      date: fiveDaysAgo.toISOString(),
      customerName: "Al-Rehman Mobile Mall",
      customerId: "cust-101-2",
      subtotal: 156779.66,
      salesTax: 28220.34,
      furtherTax: 0,
      extraTax: 0,
      taxAmount: 28220.34,
      totalAmount: 185000,
      paidAmount: 185000,
      remainingAmount: 0,
      paymentStatus: "PAID",
      paymentMethod: "BANK",
      status: "POSTED",
      fbrStatus: "SUCCESS",
      fbrInvoiceNumber: "FBR-POS-2026-00011",
      fbrQrCode: "https://e.fbr.gov.pk/verify?inv=FBR-POS-2026-00011&amt=185000",
      items: [
        {
          id: "si-101-11",
          productId: "prod-101-3",
          productName: "Xiaomi Redmi Note 13 8/256",
          sku: "MI-NOTE-13",
          hsCode: "8517.13",
          quantity: 4,
          unitPrice: 46250,
          lineTotal: 185000,
          costPrice: 38000,
        },
      ],
    },
    {
      id: "sale-101-12",
      businessId: "biz-101",
      invoiceNumber: "INV-2026-00012",
      date: eightDaysAgo.toISOString(),
      customerName: "Universal Telecom Saddar",
      customerId: "cust-101-1",
      subtotal: 271186.44,
      salesTax: 48813.56,
      furtherTax: 0,
      extraTax: 0,
      taxAmount: 48813.56,
      totalAmount: 320000,
      paidAmount: 200000,
      remainingAmount: 120000,
      paymentStatus: "PARTIAL",
      paymentMethod: "BANK",
      status: "POSTED",
      fbrStatus: "SUCCESS",
      fbrInvoiceNumber: "FBR-POS-2026-00012",
      fbrQrCode: "https://e.fbr.gov.pk/verify?inv=FBR-POS-2026-00012&amt=320000",
      items: [
        {
          id: "si-101-12",
          productId: "prod-101-1",
          productName: "iPhone 15 Pro Max 256GB",
          sku: "IPH-15PM-256",
          hsCode: "8517.13",
          quantity: 1,
          unitPrice: 298000,
          lineTotal: 298000,
          costPrice: 275000,
        },
      ],
    },
    {
      id: "sale-101-13",
      businessId: "biz-101",
      invoiceNumber: "INV-2026-00013",
      date: twelveDaysAgo.toISOString(),
      customerName: "Smart Accessories Hub",
      customerId: "cust-101-2",
      subtotal: 35593.22,
      salesTax: 6406.78,
      furtherTax: 0,
      extraTax: 0,
      taxAmount: 6406.78,
      totalAmount: 42000,
      paidAmount: 42000,
      remainingAmount: 0,
      paymentStatus: "PAID",
      paymentMethod: "CASH",
      status: "POSTED",
      fbrStatus: "SUCCESS",
      fbrInvoiceNumber: "FBR-POS-2026-00013",
      fbrQrCode: "https://e.fbr.gov.pk/verify?inv=FBR-POS-2026-00013&amt=42000",
      items: [
        {
          id: "si-101-13",
          productId: "prod-101-5",
          productName: "Original 20W Apple USB-C Power Adapter",
          sku: "ACC-APL-20W",
          hsCode: "8504.40",
          quantity: 5,
          unitPrice: 8400,
          lineTotal: 42000,
          costPrice: 6200,
        },
      ],
    },
    {
      id: "sale-101-14",
      businessId: "biz-101",
      invoiceNumber: "INV-2026-00014",
      date: fifteenDaysAgo.toISOString(),
      customerName: "Karachi Mobile Point",
      customerId: "cust-101-1",
      subtotal: 80508.47,
      salesTax: 14491.53,
      furtherTax: 0,
      extraTax: 0,
      taxAmount: 14491.53,
      totalAmount: 95000,
      paidAmount: 0,
      remainingAmount: 95000,
      paymentStatus: "UNPAID",
      paymentMethod: "CREDIT",
      status: "POSTED",
      fbrStatus: "PENDING",
      fbrInvoiceNumber: "FBR-POS-2026-00014",
      fbrQrCode: "https://e.fbr.gov.pk/verify?inv=FBR-POS-2026-00014&amt=95000",
      items: [
        {
          id: "si-101-14",
          productId: "prod-101-4",
          productName: "Infinix Note 40 Pro 8/256GB",
          sku: "INF-NOTE-40P",
          hsCode: "8517.13",
          quantity: 1,
          unitPrice: 55000,
          lineTotal: 55000,
          costPrice: 48000,
        },
      ],
    },
    {
      id: "sale-101-15",
      businessId: "biz-101",
      invoiceNumber: "INV-2026-00015",
      date: fifteenDaysAgo.toISOString(),
      customerName: "Apex Wireless Bahadurabad",
      customerId: "cust-101-2",
      subtotal: 233050.85,
      salesTax: 41949.15,
      furtherTax: 0,
      extraTax: 0,
      taxAmount: 41949.15,
      totalAmount: 275000,
      paidAmount: 275000,
      remainingAmount: 0,
      paymentStatus: "PAID",
      paymentMethod: "BANK",
      status: "POSTED",
      fbrStatus: "SUCCESS",
      fbrInvoiceNumber: "FBR-POS-2026-00015",
      fbrQrCode: "https://e.fbr.gov.pk/verify?inv=FBR-POS-2026-00015&amt=275000",
      items: [
        {
          id: "si-101-15",
          productId: "prod-101-2",
          productName: "Samsung Galaxy S24 Ultra 512GB",
          sku: "SAM-S24U-512",
          hsCode: "8517.13",
          quantity: 1,
          unitPrice: 245000,
          lineTotal: 245000,
          costPrice: 228000,
        },
      ],
    },
    {
      id: "sale-101-16",
      businessId: "biz-101",
      invoiceNumber: "INV-2026-00016",
      date: now.toISOString(),
      customerName: "Clifton Cellular Point",
      customerId: "cust-101-1",
      subtotal: 33474.58,
      salesTax: 6025.42,
      furtherTax: 0,
      extraTax: 0,
      taxAmount: 6025.42,
      totalAmount: 39500,
      paidAmount: 39500,
      remainingAmount: 0,
      paymentStatus: "PAID",
      paymentMethod: "CASH",
      status: "POSTED",
      fbrStatus: "SUCCESS",
      fbrInvoiceNumber: "FBR-POS-2026-00016",
      fbrQrCode: "https://e.fbr.gov.pk/verify?inv=FBR-POS-2026-00016&amt=39500",
      items: [
        {
          id: "si-101-16",
          productId: "prod-101-3",
          productName: "Xiaomi Redmi Note 13 8/256",
          sku: "MI-NOTE-13",
          hsCode: "8517.13",
          quantity: 1,
          unitPrice: 39500,
          lineTotal: 39500,
          costPrice: 34000,
        },
      ],
    },
    {
      id: "sale-101-17",
      businessId: "biz-101",
      invoiceNumber: "INV-2026-00017",
      date: yesterday.toISOString(),
      customerName: "Korangi Electronics Hub",
      customerId: "cust-101-2",
      subtotal: 101694.92,
      salesTax: 18305.08,
      furtherTax: 0,
      extraTax: 0,
      taxAmount: 18305.08,
      totalAmount: 120000,
      paidAmount: 50000,
      remainingAmount: 70000,
      paymentStatus: "PARTIAL",
      paymentMethod: "BANK",
      status: "POSTED",
      fbrStatus: "SUCCESS",
      fbrInvoiceNumber: "FBR-POS-2026-00017",
      fbrQrCode: "https://e.fbr.gov.pk/verify?inv=FBR-POS-2026-00017&amt=120000",
      items: [
        {
          id: "si-101-17",
          productId: "prod-101-4",
          productName: "Infinix Note 40 Pro 8/256GB",
          sku: "INF-NOTE-40P",
          hsCode: "8517.13",
          quantity: 2,
          unitPrice: 60000,
          lineTotal: 120000,
          costPrice: 50000,
        },
      ],
    },
    {
      id: "sale-101-18",
      businessId: "biz-101",
      invoiceNumber: "INV-2026-00018",
      date: threeDaysAgo.toISOString(),
      customerName: "Defence Mobile Gallery",
      customerId: "cust-101-1",
      subtotal: 72033.9,
      salesTax: 12966.1,
      furtherTax: 0,
      extraTax: 0,
      taxAmount: 12966.1,
      totalAmount: 85000,
      paidAmount: 0,
      remainingAmount: 85000,
      paymentStatus: "UNPAID",
      paymentMethod: "CREDIT",
      status: "POSTED",
      fbrStatus: "PENDING",
      fbrInvoiceNumber: "FBR-POS-2026-00018",
      fbrQrCode: "https://e.fbr.gov.pk/verify?inv=FBR-POS-2026-00018&amt=85000",
      items: [
        {
          id: "si-101-18",
          productId: "prod-101-5",
          productName: "Original 20W Apple USB-C Power Adapter",
          sku: "ACC-APL-20W",
          hsCode: "8504.40",
          quantity: 10,
          unitPrice: 8500,
          lineTotal: 85000,
          costPrice: 6500,
        },
      ],
    },

    // biz-102 Sales (FMCG Wholesale)
    {
      id: "sale-102-1",
      businessId: "biz-102",
      invoiceNumber: "INV-2026-00101",
      date: yesterday.toISOString(),
      customerName: "Imtiaz Super Market Karachi",
      customerId: "cust-102-2",
      subtotal: 257627.12,
      salesTax: 46372.88,
      furtherTax: 0,
      extraTax: 0,
      taxAmount: 46372.88,
      totalAmount: 304000,
      paidAmount: 200000,
      remainingAmount: 104000,
      paymentStatus: "PARTIAL",
      paymentMethod: "BANK",
      status: "POSTED",
      fbrStatus: "SUCCESS",
      fbrInvoiceNumber: "FBR-POS-2026-00101",
      fbrQrCode: "https://e.fbr.gov.pk/verify?inv=FBR-POS-2026-00101&amt=304000",
      items: [
        {
          id: "si-102-1",
          productId: "prod-102-1",
          productName: "Super Kernel Basmati Rice 25kg Bag",
          sku: "RICE-BAS-25KG",
          hsCode: "1006.30",
          quantity: 40,
          unitPrice: 7600,
          lineTotal: 304000,
          costPrice: 6800,
        },
      ],
    },
    {
      id: "sale-102-2",
      businessId: "biz-102",
      invoiceNumber: "INV-2026-00102",
      date: now.toISOString(),
      customerName: "Metro Cash & Carry Pakistan",
      customerId: "cust-102-1",
      subtotal: 194915.25,
      salesTax: 35084.75,
      furtherTax: 0,
      extraTax: 0,
      taxAmount: 35084.75,
      totalAmount: 230000,
      paidAmount: 230000,
      remainingAmount: 0,
      paymentStatus: "PAID",
      paymentMethod: "BANK",
      status: "POSTED",
      fbrStatus: "SUCCESS",
      fbrInvoiceNumber: "FBR-POS-2026-00102",
      fbrQrCode: "https://e.fbr.gov.pk/verify?inv=FBR-POS-2026-00102&amt=230000",
      items: [
        {
          id: "si-102-2",
          productId: "prod-102-2",
          productName: "Habib Cooking Oil 16L Tin",
          sku: "OIL-HAB-16L",
          hsCode: "1515.90",
          quantity: 25,
          unitPrice: 9200,
          lineTotal: 230000,
          costPrice: 8400,
        },
      ],
    },

    // biz-103 Sales (Home Appliances)
    {
      id: "sale-103-1",
      businessId: "biz-103",
      invoiceNumber: "INV-2026-00201",
      date: yesterday.toISOString(),
      customerName: "Islamabad Club Residences",
      customerId: "cust-103-1",
      subtotal: 378813.56,
      salesTax: 68186.44,
      furtherTax: 0,
      extraTax: 0,
      taxAmount: 68186.44,
      totalAmount: 447000,
      paidAmount: 300000,
      remainingAmount: 147000,
      paymentStatus: "PARTIAL",
      paymentMethod: "BANK",
      status: "POSTED",
      fbrStatus: "SUCCESS",
      fbrInvoiceNumber: "FBR-POS-2026-00201",
      fbrQrCode: "https://e.fbr.gov.pk/verify?inv=FBR-POS-2026-00201&amt=447000",
      items: [
        {
          id: "si-103-1",
          productId: "prod-103-1",
          productName: "Haier 1.5 Ton T3 DC Inverter AC (HSU-18HFP)",
          sku: "AC-HAI-1.5T",
          hsCode: "8415.10",
          quantity: 3,
          unitPrice: 149000,
          lineTotal: 447000,
          costPrice: 132000,
        },
      ],
    },
    {
      id: "sale-103-2",
      businessId: "biz-103",
      invoiceNumber: "INV-2026-00202",
      date: now.toISOString(),
      customerName: "Capital Builders F-7",
      customerId: "cust-103-2",
      subtotal: 347457.63,
      salesTax: 62542.37,
      furtherTax: 0,
      extraTax: 0,
      taxAmount: 62542.37,
      totalAmount: 410000,
      paidAmount: 410000,
      remainingAmount: 0,
      paymentStatus: "PAID",
      paymentMethod: "BANK",
      status: "POSTED",
      fbrStatus: "SUCCESS",
      fbrInvoiceNumber: "FBR-POS-2026-00202",
      fbrQrCode: "https://e.fbr.gov.pk/verify?inv=FBR-POS-2026-00202&amt=410000",
      items: [
        {
          id: "si-103-2",
          productId: "prod-103-3",
          productName: "Samsung 65-inch Crystal UHD 4K Smart TV",
          sku: "TV-SAM-65UHD",
          hsCode: "8528.72",
          quantity: 2,
          unitPrice: 205000,
          lineTotal: 410000,
          costPrice: 180000,
        },
      ],
    },
  ];

  // 10. Purchases
  const purchases = [
    // biz-101 Purchases
    {
      id: "pur-101-1",
      businessId: "biz-101",
      purchaseNumber: "PUR-2026-00001",
      date: twoDaysAgo.toISOString(),
      supplierName: "Apple Distributor Pakistan",
      supplierId: "sup-101-1",
      totalAmount: 1375000,
      paidAmount: 1000000,
      remainingAmount: 375000,
      paymentStatus: "PARTIAL",
      paymentMethod: "BANK",
      status: "POSTED",
      items: [
        {
          id: "pi-101-1",
          productId: "prod-101-1",
          productName: "iPhone 15 Pro Max 256GB",
          quantity: 5,
          unitCost: 275000,
          lineTotal: 1375000,
        },
      ],
    },

    // biz-102 Purchases
    {
      id: "pur-102-1",
      businessId: "biz-102",
      purchaseNumber: "PUR-2026-00101",
      date: twoDaysAgo.toISOString(),
      supplierName: "Punjab Rice Mills Ltd",
      supplierId: "sup-102-1",
      totalAmount: 1360000,
      paidAmount: 1000000,
      remainingAmount: 360000,
      paymentStatus: "PARTIAL",
      paymentMethod: "BANK",
      status: "POSTED",
      items: [
        {
          id: "pi-102-1",
          productId: "prod-102-1",
          productName: "Super Kernel Basmati Rice 25kg Bag",
          quantity: 200,
          unitCost: 6800,
          lineTotal: 1360000,
        },
      ],
    },

    // biz-103 Purchases
    {
      id: "pur-103-1",
      businessId: "biz-103",
      purchaseNumber: "PUR-2026-00201",
      date: twoDaysAgo.toISOString(),
      supplierName: "Haier Pakistan Corporation",
      supplierId: "sup-103-1",
      totalAmount: 1320000,
      paidAmount: 800000,
      remainingAmount: 520000,
      paymentStatus: "PARTIAL",
      paymentMethod: "BANK",
      status: "POSTED",
      items: [
        {
          id: "pi-103-1",
          productId: "prod-103-1",
          productName: "Haier 1.5 Ton T3 DC Inverter AC (HSU-18HFP)",
          quantity: 10,
          unitCost: 132000,
          lineTotal: 1320000,
        },
      ],
    },
  ];

  // 11. Payments (Receipts & Disbursements)
  const payments = [
    // biz-101 Payments
    { id: "pay-101-1", businessId: "biz-101", type: "RECEIPT", date: yesterday.toISOString(), partyName: "Saddar Mobile Zone", customerId: "cust-101-1", amount: 200000, paymentMethod: "BANK", referenceNumber: "REC-101-01", notes: "Bank transfer for iPhone 15 Pro Max" },
    { id: "pay-101-2", businessId: "biz-101", type: "DISBURSEMENT", date: twoDaysAgo.toISOString(), partyName: "Apple Distributor Pakistan", supplierId: "sup-101-1", amount: 1000000, paymentMethod: "BANK", referenceNumber: "PAY-101-01", notes: "Advance against 5 units iPhone 15 PM" },

    // biz-102 Payments
    { id: "pay-102-1", businessId: "biz-102", type: "RECEIPT", date: yesterday.toISOString(), partyName: "Imtiaz Super Market Karachi", customerId: "cust-102-2", amount: 200000, paymentMethod: "BANK", referenceNumber: "REC-102-01", notes: "Payment for 40x Basmati Rice bags" },
    { id: "pay-102-2", businessId: "biz-102", type: "DISBURSEMENT", date: twoDaysAgo.toISOString(), partyName: "Punjab Rice Mills Ltd", supplierId: "sup-102-1", amount: 1000000, paymentMethod: "BANK", referenceNumber: "PAY-102-01", notes: "Container delivery payment" },

    // biz-103 Payments
    { id: "pay-103-1", businessId: "biz-103", type: "RECEIPT", date: yesterday.toISOString(), partyName: "Islamabad Club Residences", customerId: "cust-103-1", amount: 300000, paymentMethod: "BANK", referenceNumber: "REC-103-01", notes: "Partial payment for Haier Inverter ACs" },
    { id: "pay-103-2", businessId: "biz-103", type: "DISBURSEMENT", date: twoDaysAgo.toISOString(), partyName: "Haier Pakistan Corporation", supplierId: "sup-103-1", amount: 800000, paymentMethod: "BANK", referenceNumber: "PAY-103-01", notes: "Factory consignment payment" },
  ];

  // 12. Chart of Accounts per Company
  const makeCompanyAccounts = (bizId: string, cashBal: number, bankBal: number, invBal: number, recBal: number, payBal: number, capBal: number) => [
    { id: `acc-1010-${bizId}`, businessId: bizId, code: "1010", name: "Cash in Hand", type: "ASSET", subType: "Cash", balance: cashBal },
    { id: `acc-1020-${bizId}`, businessId: bizId, code: "1020", name: "Bank Account", type: "ASSET", subType: "Bank", balance: bankBal },
    { id: `acc-1100-${bizId}`, businessId: bizId, code: "1100", name: "Accounts Receivable", type: "ASSET", subType: "Receivable", balance: recBal },
    { id: `acc-1200-${bizId}`, businessId: bizId, code: "1200", name: "Merchandise Inventory", type: "ASSET", subType: "Inventory", balance: invBal },
    { id: `acc-2010-${bizId}`, businessId: bizId, code: "2010", name: "Accounts Payable", type: "LIABILITY", subType: "Payable", balance: payBal },
    { id: `acc-3010-${bizId}`, businessId: bizId, code: "3010", name: "Owner's Capital", type: "EQUITY", subType: "Capital", balance: capBal },
    { id: `acc-4010-${bizId}`, businessId: bizId, code: "4010", name: "Sales Revenue", type: "REVENUE", subType: "Operating Revenue", balance: 0 },
    { id: `acc-5010-${bizId}`, businessId: bizId, code: "5010", name: "Cost of Goods Sold (COGS)", type: "COGS", subType: "Direct Cost", balance: 0 },
    { id: `acc-6010-${bizId}`, businessId: bizId, code: "6010", name: "Operating Expenses", type: "EXPENSE", subType: "Operating", balance: 0 },
  ];

  const accounts = [
    ...makeCompanyAccounts("biz-101", 391500, 528500, 2850000, 225000, 730000, 3265000),
    ...makeCompanyAccounts("biz-102", 1250000, 2850000, 4800000, 1295000, 1950000, 8245000),
    ...makeCompanyAccounts("biz-103", 420000, 1650000, 3450000, 865000, 1330000, 5055000),
  ];

  // 13. Journal Entries
  const journalEntries = [
    {
      id: "je-101-1",
      businessId: "biz-101",
      entryNumber: "JE-101-0001",
      date: yesterday.toISOString(),
      description: "Sale Invoice #INV-2026-00001 to Saddar Mobile Zone",
      isBalanced: true,
      lines: [
        { id: "jl-101-1", account: { code: "1020", name: "Bank HBL" }, debit: 200000, credit: 0, description: "Bank receipt" },
        { id: "jl-101-2", account: { code: "1100", name: "Accounts Receivable" }, debit: 98000, credit: 0, description: "Receivable" },
        { id: "jl-101-3", account: { code: "4010", name: "Sales Revenue" }, debit: 0, credit: 298000, description: "Sale revenue" },
      ],
    },
    {
      id: "je-102-1",
      businessId: "biz-102",
      entryNumber: "JE-102-0001",
      date: yesterday.toISOString(),
      description: "Sale Invoice #INV-2026-00101 to Imtiaz Super Market",
      isBalanced: true,
      lines: [
        { id: "jl-102-1", account: { code: "1020", name: "Meezan Bank" }, debit: 200000, credit: 0, description: "Bank receipt" },
        { id: "jl-102-2", account: { code: "1100", name: "Accounts Receivable" }, debit: 104000, credit: 0, description: "Receivable" },
        { id: "jl-102-3", account: { code: "4010", name: "Sales Revenue" }, debit: 0, credit: 304000, description: "Wholesale grain sale" },
      ],
    },
    {
      id: "je-103-1",
      businessId: "biz-103",
      entryNumber: "JE-103-0001",
      date: yesterday.toISOString(),
      description: "Sale Invoice #INV-2026-00201 to Islamabad Club",
      isBalanced: true,
      lines: [
        { id: "jl-103-1", account: { code: "1020", name: "Bank Alfalah" }, debit: 300000, credit: 0, description: "Bank receipt" },
        { id: "jl-103-2", account: { code: "1100", name: "Accounts Receivable" }, debit: 147000, credit: 0, description: "Receivable" },
        { id: "jl-103-3", account: { code: "4010", name: "Sales Revenue" }, debit: 0, credit: 447000, description: "Appliance sale" },
      ],
    },
  ];

  // 14. Inventory Transactions
  const inventoryTransactions = [
    { id: "itx-101-1", businessId: "biz-101", productId: "prod-101-1", product: { name: "iPhone 15 Pro Max 256GB" }, type: "SALE", quantity: 1, unitCost: 275000, totalCost: 275000, date: yesterday.toISOString(), notes: "Sale #INV-2026-00001" },
    { id: "itx-102-1", businessId: "biz-102", productId: "prod-102-1", product: { name: "Super Kernel Basmati Rice 25kg Bag" }, type: "SALE", quantity: 40, unitCost: 6800, totalCost: 272000, date: yesterday.toISOString(), notes: "Sale #INV-2026-00101" },
    { id: "itx-103-1", businessId: "biz-103", productId: "prod-103-1", product: { name: "Haier 1.5 Ton T3 DC Inverter AC" }, type: "SALE", quantity: 3, unitCost: 132000, totalCost: 396000, date: yesterday.toISOString(), notes: "Sale #INV-2026-00201" },
  ];

  // 15. SaaS Subscription Payments Ledger
  const subscriptionPayments = [
    {
      id: "spay-1",
      businessId: "biz-101",
      businessName: "HANIF Mobile Center",
      amount: 5000,
      date: new Date(2026, 8, 1).toISOString(),
      period: "September 2026",
      paymentMethod: "BANK",
      reference: "HBL-TXN-98421",
      notes: "Monthly subscription renewal - September",
      recordedBy: "System Super Admin",
      createdAt: new Date(2026, 8, 1).toISOString(),
    },
    {
      id: "spay-2",
      businessId: "biz-102",
      businessName: "SmartBiz Trading & Distribution",
      amount: 8000,
      date: new Date(2026, 8, 10).toISOString(),
      period: "September 2026",
      paymentMethod: "BANK",
      reference: "MEZAN-55129",
      notes: "Enterprise monthly fee renewal",
      recordedBy: "System Super Admin",
      createdAt: new Date(2026, 8, 10).toISOString(),
    },
    {
      id: "spay-3",
      businessId: "biz-103",
      businessName: "Al-Madina Electronics & Mobile",
      amount: 6000,
      date: new Date(2026, 7, 18).toISOString(),
      period: "August 2026",
      paymentMethod: "CASH",
      reference: "CASH-REC-019",
      notes: "Monthly cash payment received",
      recordedBy: "System Super Admin",
      createdAt: new Date(2026, 7, 18).toISOString(),
    },
  ];

  // 16. Sub-Branches Hierarchy
  const branches = [
    {
      id: "br-101-1",
      businessId: "biz-101",
      name: "Saddar Main Branch",
      code: "KHI-01",
      address: "Shop 14-16, Saddar Mobile Mall, Saddar",
      city: "Karachi",
      phone: "+92 300 9876543",
      email: "saddar@hanifmobile.com",
      managerName: "Muhammad Hanif",
      isActive: true,
      createdAt: new Date(2026, 0, 1).toISOString(),
      updatedAt: new Date(2026, 0, 1).toISOString(),
    },
    {
      id: "br-101-2",
      businessId: "biz-101",
      name: "Gulshan Outlet",
      code: "KHI-02",
      address: "Shop 4, Block 13-C, University Road, Gulshan-e-Iqbal",
      city: "Karachi",
      phone: "+92 321 8765432",
      email: "gulshan@hanifmobile.com",
      managerName: "Kamran Ali",
      isActive: true,
      createdAt: new Date(2026, 0, 15).toISOString(),
      updatedAt: new Date(2026, 0, 15).toISOString(),
    },
  ];

  // Auto-distribute biz-101 demo transactions between branches
  sales.forEach((s: any, idx) => {
    if (s.businessId === "biz-101") {
      s.branchId = idx % 2 === 0 ? "br-101-1" : "br-101-2";
      s.branchName = idx % 2 === 0 ? "Saddar Main Branch" : "Gulshan Outlet";
    }
  });
  purchases.forEach((p: any, idx) => {
    if (p.businessId === "biz-101") {
      p.branchId = idx % 2 === 0 ? "br-101-1" : "br-101-2";
      p.branchName = idx % 2 === 0 ? "Saddar Main Branch" : "Gulshan Outlet";
    }
  });
  expenses.forEach((e: any, idx) => {
    if (e.businessId === "biz-101") {
      e.branchId = idx % 2 === 0 ? "br-101-1" : "br-101-2";
      e.branchName = idx % 2 === 0 ? "Saddar Main Branch" : "Gulshan Outlet";
    }
  });

  // 17. Users & Multi-Tenant Company Assignment with Branch Locks
  const users = [
    {
      id: "usr-1",
      name: "System Super Admin",
      email: "admin@smartbiz.com",
      password: "admin123",
      role: "SUPER_ADMIN",
      companyIds: ["biz-101", "biz-102", "biz-103"],
      branchId: null,
      createdAt: new Date(2026, 0, 1).toISOString(),
    },
    {
      id: "usr-2",
      name: "Muhammad Hanif (Owner)",
      email: "hanif@mobile.com",
      password: "hanif123",
      role: "OWNER_ADMIN",
      companyIds: ["biz-101"],
      branchId: null, // Full multi-branch and consolidated access
      createdAt: new Date(2026, 0, 1).toISOString(),
    },
    {
      id: "usr-3",
      name: "Farhan Accountant",
      email: "accountant@smartbiz.com",
      password: "account123",
      role: "ACCOUNTANT",
      companyIds: ["biz-101", "biz-102"],
      branchId: null,
      createdAt: new Date(2026, 0, 15).toISOString(),
    },
    {
      id: "usr-4",
      name: "Bilal Cashier (Saddar Staff)",
      email: "staff@smartbiz.com",
      password: "staff123",
      role: "STAFF",
      isBranchManager: false,
      phone: "+92 300 9876543",
      companyIds: ["biz-101"],
      branchId: "br-101-1",
      branchName: "Saddar Main Branch",
      createdAt: new Date(2026, 1, 1).toISOString(),
    },
    {
      id: "usr-7",
      name: "Kamran Ali (Gulshan Staff)",
      email: "kamran@smartbiz.com",
      password: "staff123",
      role: "STAFF",
      isBranchManager: true,
      phone: "+92 321 8765432",
      companyIds: ["biz-101"],
      branchId: "br-101-2",
      branchName: "Gulshan Outlet",
      createdAt: new Date(2026, 1, 1).toISOString(),
    },
    {
      id: "usr-5",
      name: "Hashim Khan (SmartBiz Owner)",
      email: "hashim@smartbiz.com",
      password: "smart123",
      role: "OWNER_ADMIN",
      companyIds: ["biz-102"],
      branchId: null,
      createdAt: new Date(2026, 1, 1).toISOString(),
    },
    {
      id: "usr-6",
      name: "Tariq Madina (Al-Madina Owner)",
      email: "tariq@madina.com",
      password: "madina123",
      role: "OWNER_ADMIN",
      companyIds: ["biz-103"],
      branchId: null,
      createdAt: new Date(2026, 2, 1).toISOString(),
    },
  ];

  return {
    business: companies[0],
    activeBusinessId: "biz-101",
    companies,
    branches,
    users,
    accounts,
    cashBankAccounts,
    expenseCategories,
    categories,
    products,
    customers,
    suppliers,
    sales,
    purchases,
    payments,
    expenses,
    inventoryTransactions,
    journalEntries,
    accountingPeriods: [
      {
        id: "ap-2026-08",
        year: 2026,
        month: 8,
        name: "August 2026",
        isClosed: true,
        closedAt: new Date(2026, 8, 1).toISOString(),
      },
    ],
    aiImports: [],
    auditLogs: [],
    subscriptionPayments,
  };
}

declare global {
  // eslint-disable-next-line no-var
  var fallbackStoreGlobal: StoreState | undefined;
}

export const fallbackStore = globalThis.fallbackStoreGlobal ?? initializeState();

if (process.env.NODE_ENV !== "production") {
  globalThis.fallbackStoreGlobal = fallbackStore;
}

// Helper methods for multi-company & user management
export function storeAddCompany(data: any) {
  const compId = data.id || `biz-${Date.now()}`;
  const newCompany = {
    id: compId,
    name: data.name,
    ownerName: data.ownerName || "Business Owner",
    phone: data.phone || "",
    email: data.email || "",
    address: data.address || "",
    city: data.city || "Karachi",
    province: data.province || "Sindh",
    country: data.country || "Pakistan",
    currency: data.currency || "PKR",
    currencySymbol: data.currencySymbol || "Rs",
    ntn: data.ntn || "",
    strn: data.strn || "",
    businessType: data.businessType || "Enterprise",
    defaultHsCode: data.defaultHsCode !== undefined ? data.defaultHsCode : "8517.13",
    defaultUom: data.defaultUom || "pcs",
    defaultTaxProfile: data.defaultTaxProfile || "Standard 18%",
    defaultSalesTax: Number(data.defaultSalesTax ?? 18.00),
    defaultFurtherTax: Number(data.defaultFurtherTax ?? 3.00),
    defaultExtraTax: Number(data.defaultExtraTax ?? 0.00),
    defaultPaymentTerms: Number(data.defaultPaymentTerms) || 30,
    defaultTaxRate: Number(data.defaultTaxRate ?? 18.00),
    negativeStockPolicy: Boolean(data.negativeStockPolicy),
    monthlyFee: Number(data.monthlyFee ?? 5000),
    billingPlan: data.billingPlan || "Standard Monthly",
    subscriptionStatus: data.subscriptionStatus || "ACTIVE",
    enabledModules: Array.isArray(data.enabledModules) && data.enabledModules.length > 0
      ? data.enabledModules
      : [
          "sales",
          "purchases",
          "inventory",
          "accounting",
          "compliance",
          "reports",
          "aiEntry",
          "bulkImport",
        ],
    billingCycleStart: data.billingCycleStart || new Date().toISOString(),
    billingCycleEnd: data.billingCycleEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    lastPaymentDate: data.lastPaymentDate || new Date().toISOString(),
    lastPaymentAmount: Number(data.lastPaymentAmount ?? (data.monthlyFee ?? 5000)),
    createdAt: new Date().toISOString(),
  };

  fallbackStore.companies.push(newCompany);

  // Automatically provision isolated chart of accounts for the new company
  const defaultAccounts = [
    { id: `acc-1010-${compId}`, businessId: compId, code: "1010", name: "Cash in Hand", type: "ASSET", subType: "Cash", balance: 0 },
    { id: `acc-1020-${compId}`, businessId: compId, code: "1020", name: "Bank Account", type: "ASSET", subType: "Bank", balance: 0 },
    { id: `acc-1100-${compId}`, businessId: compId, code: "1100", name: "Accounts Receivable", type: "ASSET", subType: "Receivable", balance: 0 },
    { id: `acc-1200-${compId}`, businessId: compId, code: "1200", name: "Merchandise Inventory", type: "ASSET", subType: "Inventory", balance: 0 },
    { id: `acc-2010-${compId}`, businessId: compId, code: "2010", name: "Accounts Payable", type: "LIABILITY", subType: "Payable", balance: 0 },
    { id: `acc-3010-${compId}`, businessId: compId, code: "3010", name: "Owner's Capital", type: "EQUITY", subType: "Capital", balance: 0 },
    { id: `acc-4010-${compId}`, businessId: compId, code: "4010", name: "Sales Revenue", type: "REVENUE", subType: "Operating Revenue", balance: 0 },
    { id: `acc-5010-${compId}`, businessId: compId, code: "5010", name: "Cost of Goods Sold (COGS)", type: "COGS", subType: "Direct Cost", balance: 0 },
    { id: `acc-6010-${compId}`, businessId: compId, code: "6010", name: "Operating Expenses", type: "EXPENSE", subType: "Operating", balance: 0 },
  ];
  fallbackStore.accounts.push(...defaultAccounts);

  // Automatically provision isolated cash & bank accounts
  fallbackStore.cashBankAccounts.push(
    { id: `cb-cash-${compId}`, businessId: compId, name: "Main Cash Counter", type: "CASH", balance: 0, isDefault: true },
    { id: `cb-bank-${compId}`, businessId: compId, name: "Company Bank Account", type: "BANK", balance: 0, isDefault: false }
  );

  // Automatically provision initial category for this company
  fallbackStore.categories.push({
    id: `cat-gen-${compId}`,
    businessId: compId,
    name: "General Inventory",
    defaultHsCode: newCompany.defaultHsCode || "8517.13",
    description: "Default inventory classification",
  });

  return newCompany;
}

export function storeUpdateCompany(id: string, updates: any) {
  const idx = fallbackStore.companies.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  fallbackStore.companies[idx] = { ...fallbackStore.companies[idx], ...updates };
  if (fallbackStore.activeBusinessId === id) {
    fallbackStore.business = fallbackStore.companies[idx];
  }
  return fallbackStore.companies[idx];
}

export function storeRecordSubscriptionPayment(data: {
  businessId: string;
  amount?: number;
  date?: string;
  period?: string;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
  recordedBy?: string;
}) {
  const company = fallbackStore.companies.find((c) => c.id === data.businessId);
  if (!company) return null;

  const paymentDate = data.date || new Date().toISOString();
  const paymentAmount = Number(data.amount) || Number(company.monthlyFee) || 5000;

  // Calculate next billing cycle end date (+30 days)
  const currentEnd = company.billingCycleEnd ? new Date(company.billingCycleEnd) : new Date();
  const baseDate = currentEnd > new Date() ? currentEnd : new Date();
  const nextEnd = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Update company billing status
  company.subscriptionStatus = "ACTIVE";
  company.billingCycleStart = company.billingCycleEnd || paymentDate;
  company.billingCycleEnd = nextEnd.toISOString();
  company.lastPaymentDate = paymentDate;
  company.lastPaymentAmount = paymentAmount;

  const receipt = {
    id: `spay-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    businessId: company.id,
    businessName: company.name,
    amount: paymentAmount,
    date: paymentDate,
    period: data.period || new Date(paymentDate).toLocaleString("default", { month: "long", year: "numeric" }),
    paymentMethod: data.paymentMethod || "CASH",
    reference: data.reference || `REC-${Date.now().toString().slice(-6)}`,
    notes: data.notes || "Monthly SaaS Subscription Renewal",
    recordedBy: data.recordedBy || "System Super Admin",
    createdAt: new Date().toISOString(),
  };

  if (!fallbackStore.subscriptionPayments) {
    fallbackStore.subscriptionPayments = [];
  }
  fallbackStore.subscriptionPayments.unshift(receipt);
  return { company, receipt };
}

export function storeGetBillingStats() {
  const companies = fallbackStore.companies || [];

  companies.forEach((c) => {
    if (!c.monthlyFee) {
      c.monthlyFee = c.id === "biz-102" ? 8000 : c.id === "biz-103" ? 6000 : 5000;
      c.billingPlan = c.id === "biz-102" ? "Enterprise Pro" : "Standard Monthly";
      c.subscriptionStatus = c.id === "biz-103" ? "DUE" : "ACTIVE";
      c.billingCycleStart = c.billingCycleStart || new Date(2026, 8, 1).toISOString();
      c.billingCycleEnd = c.billingCycleEnd || (c.id === "biz-103" ? new Date(2026, 8, 20).toISOString() : new Date(2026, 9, 1).toISOString());
      c.lastPaymentDate = c.lastPaymentDate || new Date(2026, 8, 1).toISOString();
      c.lastPaymentAmount = c.monthlyFee;
    }
  });

  const payments = fallbackStore.subscriptionPayments || [];
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const totalMRR = companies.reduce((sum, c) => sum + (Number(c.monthlyFee) || 0), 0);
  const totalARR = totalMRR * 12;

  const collectedThisMonth = payments
    .filter((p) => {
      const pDate = new Date(p.date);
      return pDate.getMonth() === currentMonth && pDate.getFullYear() === currentYear;
    })
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  let activeCount = 0;
  let dueCount = 0;
  let overdueCount = 0;
  let renewalsDueThisWeek = 0;
  let pendingDueAmount = 0;

  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  companies.forEach((c) => {
    const fee = Number(c.monthlyFee) || 0;
    const endDate = c.billingCycleEnd ? new Date(c.billingCycleEnd) : null;

    if (!endDate || endDate < now) {
      overdueCount++;
      pendingDueAmount += fee;
    } else {
      activeCount++;
      if (endDate <= sevenDaysFromNow) {
        renewalsDueThisWeek++;
        dueCount++;
      }
    }
  });

  return {
    totalCompanies: companies.length,
    activeCount,
    dueCount,
    overdueCount,
    totalMRR,
    totalARR,
    collectedThisMonth,
    pendingDueAmount,
    renewalsDueThisWeek,
  };
}

export function storeDeleteCompany(id: string) {
  const idx = fallbackStore.companies.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  fallbackStore.companies.splice(idx, 1);
  if (fallbackStore.activeBusinessId === id) {
    fallbackStore.business = fallbackStore.companies[0] || null;
    fallbackStore.activeBusinessId = fallbackStore.companies[0]?.id || "";
  }
  return true;
}

export function storeAddUser(data: any) {
  const newUser = {
    id: `usr-${Date.now()}`,
    name: data.name,
    email: data.email.toLowerCase().trim(),
    password: data.password || "pass123",
    role: data.role || "STAFF",
    companyIds: Array.isArray(data.companyIds) && data.companyIds.length > 0 
      ? data.companyIds 
      : [fallbackStore.activeBusinessId],
    createdAt: new Date().toISOString(),
  };
  fallbackStore.users.push(newUser);
  return newUser;
}

export function storeUpdateUser(id: string, updates: any) {
  const idx = fallbackStore.users.findIndex((u) => u.id === id);
  if (idx === -1) return null;
  fallbackStore.users[idx] = { ...fallbackStore.users[idx], ...updates };
  return fallbackStore.users[idx];
}

export function storeDeleteUser(id: string) {
  const idx = fallbackStore.users.findIndex((u) => u.id === id);
  if (idx === -1) return false;
  fallbackStore.users.splice(idx, 1);
  return true;
}

export function storeSetActiveCompany(businessId: string) {
  const company = fallbackStore.companies.find((c) => c.id === businessId);
  if (company) {
    fallbackStore.activeBusinessId = company.id;
    fallbackStore.business = company;
    return company;
  }
  return null;
}

// Product & Category Management Helpers
export function storeAddProduct(data: any) {
  const newProduct = {
    id: data.id || `prod-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    businessId: data.businessId || fallbackStore.activeBusinessId,
    name: data.name,
    sku: data.sku || "",
    productCode: data.productCode || data.sku || `PRD-${Date.now()}`,
    barcode: data.barcode || "",
    categoryId: data.categoryId || null,
    brand: data.brand || "",
    description: data.description || "",
    unit: data.unit || data.uom || "pcs",
    uom: data.uom || data.unit || "pcs",
    hsCode: data.hsCode || null,
    taxProfile: data.taxProfile || "Standard 18%",
    salesTax: Number(data.salesTax ?? 18.00),
    furtherTax: Number(data.furtherTax ?? 0.00),
    extraTax: Number(data.extraTax ?? 0.00),
    purchasePrice: Number(data.purchasePrice ?? 0),
    wholesalePrice: Number(data.wholesalePrice ?? data.sellingPrice ?? 0),
    retailPrice: Number(data.retailPrice ?? data.sellingPrice ?? 0),
    sellingPrice: Number(data.sellingPrice ?? data.retailPrice ?? 0),
    openingQuantity: Number(data.openingQuantity ?? 0),
    openingCost: Number(data.openingCost ?? 0),
    currentStock: Number(data.currentStock ?? data.openingQuantity ?? 0),
    averageCost: Number(data.averageCost ?? data.purchasePrice ?? 0),
    minStockLevel: Number(data.minStockLevel ?? 1),
    maxStockLevel: data.maxStockLevel ? Number(data.maxStockLevel) : null,
    isActive: data.isActive ?? (data.status !== "ARCHIVED"),
    status: data.status || "ACTIVE",
    image: data.image || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  fallbackStore.products.unshift(newProduct);
  return newProduct;
}

export function storeUpdateProduct(id: string, updates: any) {
  const idx = fallbackStore.products.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  const existing = fallbackStore.products[idx];
  fallbackStore.products[idx] = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  return fallbackStore.products[idx];
}

export function storeArchiveProduct(id: string) {
  return storeUpdateProduct(id, { status: "ARCHIVED", isActive: false });
}

export function storeRestoreProduct(id: string) {
  return storeUpdateProduct(id, { status: "ACTIVE", isActive: true });
}

export function storeAddProductAudit(audit: {
  productId: string;
  action: string;
  field?: string;
  oldValue?: any;
  newValue?: any;
  userId?: string;
  userName?: string;
  notes?: string;
}) {
  const log = {
    id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    ...audit,
    createdAt: new Date().toISOString(),
  };
  fallbackStore.auditLogs.unshift(log);
  return log;
}

export function storeGetProductAudits(productId: string) {
  return fallbackStore.auditLogs.filter((a) => a.productId === productId);
}

export function storeAddCategory(data: any) {
  const newCat = {
    id: data.id || `cat-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    businessId: data.businessId || fallbackStore.activeBusinessId,
    name: data.name,
    description: data.description || "",
    defaultHsCode: data.defaultHsCode || null,
    createdAt: new Date().toISOString(),
  };
  fallbackStore.categories.push(newCat);
  return newCat;
}

export function storeUpdateCategory(id: string, updates: any) {
  const idx = fallbackStore.categories.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  fallbackStore.categories[idx] = {
    ...fallbackStore.categories[idx],
    ...updates,
  };
  return fallbackStore.categories[idx];
}

export function storeDeleteCategory(id: string): boolean {
  const idx = fallbackStore.categories.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  fallbackStore.categories.splice(idx, 1);
  for (const p of fallbackStore.products) {
    if (p.categoryId === id) p.categoryId = null;
  }
  return true;
}

// Sub-Branch Management Helpers
export function storeGetBranches(businessId: string) {
  if (!fallbackStore.branches) fallbackStore.branches = [];
  return fallbackStore.branches.filter((b) => b.businessId === businessId);
}

export function storeAddBranch(data: any) {
  if (!fallbackStore.branches) fallbackStore.branches = [];
  const comp = fallbackStore.companies.find((c) => c.id === data.businessId);
  if (comp && !comp.canCreateBranches) {
    throw new Error("Multi-Branch authorization is not enabled for this company. Please contact Super Admin.");
  }

  const newBranch = {
    id: data.id || `br-${data.businessId || fallbackStore.activeBusinessId}-${Date.now().toString().slice(-4)}`,
    businessId: data.businessId || fallbackStore.activeBusinessId,
    name: data.name,
    code: data.code || `BR-${(fallbackStore.branches.length + 1).toString().padStart(2, "0")}`,
    address: data.address || "",
    city: data.city || "Karachi",
    phone: data.phone || "",
    email: data.email || "",
    managerName: data.managerName || "",
    isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  fallbackStore.branches.push(newBranch);
  return newBranch;
}

export function storeUpdateBranch(id: string, updates: any) {
  if (!fallbackStore.branches) fallbackStore.branches = [];
  const idx = fallbackStore.branches.findIndex((b) => b.id === id);
  if (idx === -1) return null;

  fallbackStore.branches[idx] = {
    ...fallbackStore.branches[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  return fallbackStore.branches[idx];
}

export function storeDeleteBranch(id: string) {
  if (!fallbackStore.branches) fallbackStore.branches = [];
  const idx = fallbackStore.branches.findIndex((b) => b.id === id);
  if (idx === -1) return false;

  fallbackStore.branches.splice(idx, 1);
  // Reset any user assigned to this branch
  fallbackStore.users.forEach((u) => {
    if (u.branchId === id) {
      u.branchId = null;
      u.branchName = null;
    }
  });
  return true;
}

export function storeAssignUserBranch(userId: string, branchId: string | null) {
  const user = fallbackStore.users.find((u) => u.id === userId);
  if (!user) return null;

  if (!branchId) {
    user.branchId = null;
    user.branchName = null;
    return user;
  }

  const branch = fallbackStore.branches?.find((b) => b.id === branchId);
  if (!branch) return null;

  user.branchId = branch.id;
  user.branchName = branch.name;
  return user;
}

export function storeAddSale(saleData: any) {
  const newSale = {
    id: saleData.id || `sale-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    businessId: saleData.businessId,
    branchId: saleData.branchId || null,
    branchName: saleData.branchName || null,
    invoiceNumber: saleData.invoiceNumber || `INV-${Date.now()}`,
    date: saleData.date || new Date().toISOString(),
    customerName: saleData.customerName || "Walk-in Customer",
    customerId: saleData.customerId || null,
    subtotal: Number(saleData.subtotal || 0),
    discountAmount: Number(saleData.discountAmount || 0),
    taxAmount: Number(saleData.taxAmount || saleData.salesTax || 0),
    salesTax: Number(saleData.salesTax || 0),
    furtherTax: Number(saleData.furtherTax || 0),
    extraTax: Number(saleData.extraTax || 0),
    posFee: Number(saleData.posFee || 0),
    totalAmount: Number(saleData.totalAmount || 0),
    paidAmount: Number(saleData.paidAmount || saleData.totalAmount || 0),
    remainingAmount: Number(saleData.remainingAmount || 0),
    paymentStatus: saleData.paymentStatus || "PAID",
    paymentMethod: saleData.paymentMethod || "CASH",
    status: saleData.status || "POSTED",
    fbrStatus: saleData.fbrStatus || "SUCCESS",
    fbrInvoiceNumber: saleData.fbrInvoiceNumber || null,
    fbrQrCode: saleData.fbrQrCode || null,
    items: saleData.items || [],
  };
  fallbackStore.sales.unshift(newSale);
  return newSale;
}

export function storeGetCompanyUsers(businessId: string) {
  if (!fallbackStore.users) return [];
  return fallbackStore.users
    .filter((u) => u.companyIds && u.companyIds.includes(businessId))
    .map((u: any) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      phone: u.phone || null,
      isBranchManager: Boolean(u.isBranchManager),
      branchId: u.branchId || null,
      branchName: u.branchName || null,
      createdAt: u.createdAt,
    }));
}

export function storeAddCompanyUser(data: {
  businessId: string;
  name: string;
  email: string;
  password?: string;
  role?: string;
  branchId?: string | null;
  phone?: string;
  isBranchManager?: boolean;
}) {
  if (!fallbackStore.users) fallbackStore.users = [];

  const existing = fallbackStore.users.find(
    (u) => u.email.toLowerCase() === data.email.toLowerCase()
  );
  if (existing) {
    throw new Error("A user with this email already exists");
  }

  const branch = data.branchId
    ? fallbackStore.branches?.find((b) => b.id === data.branchId)
    : null;

  const newUser: any = {
    id: `usr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: data.name,
    email: data.email.toLowerCase().trim(),
    password: data.password || "staff123",
    role: data.role || "STAFF",
    phone: data.phone || null,
    isBranchManager: Boolean(data.isBranchManager),
    branchId: branch ? branch.id : null,
    branchName: branch ? branch.name : null,
    companyIds: [data.businessId],
    createdAt: new Date().toISOString(),
  };

  // If designated as Branch Manager, sync managerName on the branch!
  if (data.isBranchManager && branch) {
    branch.managerName = data.name;
    if (data.phone) branch.phone = data.phone;
  }

  fallbackStore.users.push(newUser);
  return newUser;
}

export function storeUpdateCompanyUser(
  userId: string,
  updates: {
    name?: string;
    email?: string;
    role?: string;
    branchId?: string | null;
    phone?: string;
    isBranchManager?: boolean;
    password?: string;
  }
) {
  const user: any = fallbackStore.users?.find((u) => u.id === userId);
  if (!user) return null;

  if (updates.name !== undefined) user.name = updates.name;
  if (updates.email !== undefined) user.email = updates.email.toLowerCase().trim();
  if (updates.role !== undefined) user.role = updates.role;
  if (updates.phone !== undefined) user.phone = updates.phone;
  if (updates.password !== undefined && updates.password) user.password = updates.password;

  if (updates.branchId !== undefined) {
    if (!updates.branchId) {
      user.branchId = null;
      user.branchName = null;
    } else {
      const branch = fallbackStore.branches?.find((b) => b.id === updates.branchId);
      user.branchId = branch ? branch.id : null;
      user.branchName = branch ? branch.name : null;
    }
  }

  if (updates.isBranchManager !== undefined) {
    user.isBranchManager = Boolean(updates.isBranchManager);
  }

  // If user is manager and has a branch, update the branch managerName
  if (user.isBranchManager && user.branchId) {
    const branch = fallbackStore.branches?.find((b) => b.id === user.branchId);
    if (branch) {
      branch.managerName = user.name;
      if (user.phone) branch.phone = user.phone;
    }
  }

  return user;
}

export function storeDeleteCompanyUser(userId: string, businessId: string) {
  const idx = fallbackStore.users.findIndex(
    (u) => u.id === userId && u.companyIds && u.companyIds.includes(businessId)
  );
  if (idx === -1) return false;

  const user = fallbackStore.users[idx];
  // Guard against deleting the main owner
  if (user.role === "OWNER_ADMIN" && (user.id === "usr-2" || user.id === "usr-1")) {
    throw new Error("Cannot delete primary company owner or system admin");
  }

  fallbackStore.users.splice(idx, 1);
  return true;
}

