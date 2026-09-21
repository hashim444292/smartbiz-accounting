import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock Prisma client to reject instantly during unit testing when Postgres is offline,
// so fallbackStore paths execute with sub-millisecond latency.
vi.mock("@/lib/prisma", () => {
  const offlineMethod = () => Promise.reject(new Error("Prisma offline in test"));
  const offlineProxy = new Proxy({}, { get: () => offlineMethod });
  return {
    prisma: new Proxy({}, { get: () => offlineProxy }),
    default: new Proxy({}, { get: () => offlineProxy }),
  };
});

import {
  resolveProductHsCode,
  createProduct,
  updateProduct,
  getProductById,
} from "../src/services/productService";
import {
  detectColumns,
  validateImportRows,
  importValidatedRows,
  generateErrorReportCsv,
} from "../src/services/productImportService";
import {
  calculateFbrTaxes,
  generateFbrInvoiceNumber,
  generateFbrQrCode,
  createFbrPosInvoice,
  getFbrComplianceOverview,
} from "../src/services/fbrService";
import {
  fallbackStore,
  storeAddCompany,
  storeUpdateCompany,
  storeAddCategory,
  storeUpdateCategory,
  storeDeleteCategory,
  storeAddProduct,
} from "../src/lib/fallbackStore";

describe("Part 13: 10-Step Automated QA Scenario & FBR Engine Verification", () => {
  const ABC_ORG_ID = "org-abc-electronics-101";
  const EMPTY_ORG_ID = "org-no-defaults-202";

  beforeEach(() => {
    // Reset fallbackStore state for fresh test execution
    fallbackStore.companies = fallbackStore.companies.filter(
      (c) => c.id !== ABC_ORG_ID && c.id !== EMPTY_ORG_ID
    );
    fallbackStore.categories = fallbackStore.categories.filter(
      (c) => c.businessId !== ABC_ORG_ID && c.businessId !== EMPTY_ORG_ID
    );
    fallbackStore.products = fallbackStore.products.filter(
      (p) => p.businessId !== ABC_ORG_ID && p.businessId !== EMPTY_ORG_ID
    );
    if (fallbackStore.auditLogs) {
      fallbackStore.auditLogs = fallbackStore.auditLogs.filter(
        (a: any) => a.businessId !== ABC_ORG_ID && a.businessId !== EMPTY_ORG_ID
      );
    }
  });

  // =========================================================================
  // STEP 1: Admin creates "ABC Electronics", Default HS Code: 8517.13
  // =========================================================================
  it("STEP 1: Admin creates ABC Electronics with Default HS Code 8517.13", () => {
    const org = storeAddCompany({
      id: ABC_ORG_ID,
      name: "ABC Electronics",
      email: "info@abcelectronics.pk",
      phone: "0300-1234567",
      address: "Hafeez Centre, Gulberg III",
      city: "Lahore",
      province: "Punjab",
      ntn: "1234567-8",
      strn: "17-00-1234-567-89",
      defaultHsCode: "8517.13",
      defaultUom: "PCS",
      defaultSalesTax: 18,
      defaultFurtherTax: 3,
      defaultExtraTax: 0,
      businessType: "RETAIL",
    });

    expect(org).toBeDefined();
    expect(org.id).toBe(ABC_ORG_ID);
    expect(org.name).toBe("ABC Electronics");
    expect(org.defaultHsCode).toBe("8517.13");
    expect(org.ntn).toBe("1234567-8");
  });

  // =========================================================================
  // STEP 2 & 3: Login as ABC Electronics, Click Add Product, verify HS Code
  // =========================================================================
  it("STEP 2 & 3: Active org is ABC Electronics; Add Product automatically resolves HS Code 8517.13", async () => {
    storeAddCompany({
      id: ABC_ORG_ID,
      name: "ABC Electronics",
      defaultHsCode: "8517.13",
    });

    // When the user opens the Add Product form with no explicit HS code or category
    const resolution = await resolveProductHsCode({
      organizationId: ABC_ORG_ID,
      categoryId: null,
      productHsCode: null,
    });

    expect(resolution.resolvedHsCode).toBe("8517.13");
    expect(resolution.source).toBe("ORGANIZATION");
    expect(resolution.organizationDefault).toBe("8517.13");
  });

  // =========================================================================
  // STEP 4: Save product without HS code; verify database stores hsCode = 8517.13
  // =========================================================================
  it("STEP 4: Save product without explicit HS code; database stores Product.hsCode = 8517.13", async () => {
    storeAddCompany({
      id: ABC_ORG_ID,
      name: "ABC Electronics",
      defaultHsCode: "8517.13",
    });

    const { product: product1 } = await createProduct({
      businessId: ABC_ORG_ID,
      name: "Galaxy Smartphone A54",
      sku: "GALAXY-A54",
      retailPrice: 95000,
      purchasePrice: 82000,
      // Note: hsCode is omitted, should inherit from organization
    });

    expect(product1).toBeDefined();
    expect(product1.name).toBe("Galaxy Smartphone A54");
    expect(product1.sku).toBe("GALAXY-A54");
    expect(product1.hsCode).toBe("8517.13");

    // Verify persisted record in store
    const stored = await getProductById(product1.id, ABC_ORG_ID);
    expect(stored).toBeDefined();
    expect(stored?.hsCode).toBe("8517.13");
  });

  // =========================================================================
  // STEP 5: Create another product with manual override 8517.79; org default remains 8517.13
  // =========================================================================
  it("STEP 5: Create product with manual HS Code 8517.79; stores 8517.79 and org default remains 8517.13", async () => {
    storeAddCompany({
      id: ABC_ORG_ID,
      name: "ABC Electronics",
      defaultHsCode: "8517.13",
    });

    const { product: product2 } = await createProduct({
      businessId: ABC_ORG_ID,
      name: "Replacement OLED Screen",
      sku: "OLED-SCR-01",
      hsCode: "8517.79", // Manual override
      retailPrice: 15000,
      purchasePrice: 11000,
    });

    expect(product2.hsCode).toBe("8517.79");

    // Verify organization default is completely unchanged
    const org = fallbackStore.companies.find((c) => c.id === ABC_ORG_ID);
    expect(org?.defaultHsCode).toBe("8517.13");
  });

  // =========================================================================
  // STEP 6: Category 'Mobile Accessories' with default 8517.79; product in category selects 8517.79
  // =========================================================================
  it("STEP 6: Category 'Mobile Accessories' with default 8517.79 takes priority over org default 8517.13", async () => {
    storeAddCompany({
      id: ABC_ORG_ID,
      name: "ABC Electronics",
      defaultHsCode: "8517.13",
    });

    // Create Category with default HS Code 8517.79
    const category = storeAddCategory({
      name: "Mobile Accessories",
      businessId: ABC_ORG_ID,
      defaultHsCode: "8517.79",
    });

    // Verify inheritance resolution picks category default over org default
    const resolution = await resolveProductHsCode({
      organizationId: ABC_ORG_ID,
      categoryId: category.id,
      productHsCode: null,
    });

    expect(resolution.resolvedHsCode).toBe("8517.79");
    expect(resolution.source).toBe("CATEGORY");
    expect(resolution.categoryDefault).toBe("8517.79");
    expect(resolution.organizationDefault).toBe("8517.13");

    // Create product in that category without explicit HS code
    const { product: product3 } = await createProduct({
      businessId: ABC_ORG_ID,
      name: "Fast Wall Charger 45W",
      sku: "CHG-45W-01",
      categoryId: category.id,
      retailPrice: 4500,
      purchasePrice: 2800,
    });

    expect(product3.hsCode).toBe("8517.79");
    expect(product3.categoryId).toBe(category.id);
  });

  // =========================================================================
  // STEP 7: Import CSV with HS Code -> CSV HS Code is used
  // =========================================================================
  it("STEP 7: Import CSV with explicit HS Code uses CSV HS Code", async () => {
    storeAddCompany({
      id: ABC_ORG_ID,
      name: "ABC Electronics",
      defaultHsCode: "8517.13",
    });

    const rawRows = [
      {
        "Product Name": "USB-C Braided Cable 2M",
        "SKU": "CAB-USBC-2M",
        "HS Code": "8544.42",
        "Price": "1500",
        "Cost": "800",
      },
    ];

    const columnMapping = detectColumns(Object.keys(rawRows[0]));
    expect(columnMapping["Product Name"]).toBe("name");
    expect(columnMapping["SKU"]).toBe("sku");
    expect(columnMapping["HS Code"]).toBe("hsCode");

    const result = await validateImportRows({
      rawRows,
      columnMapping,
      organizationId: ABC_ORG_ID,
    });

    expect(result.validRows).toBe(1);
    expect(result.errorRows).toBe(0);
    expect(result.validatedRows[0].data.hsCode).toBe("8544.42");
    expect(result.validatedRows[0].hsCodeSource).toBe("PRODUCT");
  });

  // =========================================================================
  // STEP 8: Import CSV without HS Code -> uses category default or organization default
  // =========================================================================
  it("STEP 8: Import CSV without HS Code inherits Category default if available, else Organization default", async () => {
    storeAddCompany({
      id: ABC_ORG_ID,
      name: "ABC Electronics",
      defaultHsCode: "8517.13",
    });

    const category = storeAddCategory({
      name: "Mobile Accessories",
      businessId: ABC_ORG_ID,
      defaultHsCode: "8517.79",
    });

    const rawRows = [
      {
        "Product Name": "Wireless Bluetooth Earbuds",
        "Category": "Mobile Accessories", // Matches category default 8517.79
        "Price": "5500",
      },
      {
        "Product Name": "Standard Protective Cover",
        // No category -> should inherit Organization default 8517.13
        "Price": "900",
      },
    ];

    const columnMapping = detectColumns(Object.keys(rawRows[0]));

    const result = await validateImportRows({
      rawRows,
      columnMapping,
      organizationId: ABC_ORG_ID,
    });

    expect(result.validRows).toBe(2);
    expect(result.errorRows).toBe(0);

    // Row 0 has category with default 8517.79
    expect(result.validatedRows[0].data.hsCode).toBe("8517.79");
    expect(result.validatedRows[0].hsCodeSource).toBe("CATEGORY");

    // Row 1 has no category -> falls back to org default 8517.13
    expect(result.validatedRows[1].data.hsCode).toBe("8517.13");
    expect(result.validatedRows[1].hsCodeSource).toBe("ORGANIZATION");
  });

  // =========================================================================
  // STEP 9: Import CSV with no HS Code and no defaults -> row becomes an error
  // =========================================================================
  it("STEP 9: Import CSV with no HS Code and no defaults flags row as validation error", async () => {
    // Org with NO default HS Code
    storeAddCompany({
      id: EMPTY_ORG_ID,
      name: "Unconfigured Org",
      defaultHsCode: null,
    });

    const rawRows = [
      {
        "Product Name": "Mystery Widget Without HS Code",
        "Price": "3000",
      },
    ];

    const columnMapping = detectColumns(Object.keys(rawRows[0]));

    const result = await validateImportRows({
      rawRows,
      columnMapping,
      organizationId: EMPTY_ORG_ID,
    });

    expect(result.validRows).toBe(0);
    expect(result.errorRows).toBe(1);
    expect(result.validatedRows[0].status).toBe("ERROR");
    expect(result.validatedRows[0].hsCodeSource).toBe("MISSING");

    const hsError = result.validatedRows[0].errors.find((e) => e.field === "hsCode");
    expect(hsError).toBeDefined();
    expect(hsError?.error).toBe("Missing HS Code");

    // Downloadable CSV error report contains the row
    const csvReport = generateErrorReportCsv(result.allErrors);
    expect(csvReport).toContain("Mystery Widget Without HS Code");
    expect(csvReport).toContain("Missing HS Code");
  });

  // =========================================================================
  // STEP 10: Change organization default HS Code -> existing products DO NOT change
  // =========================================================================
  it("STEP 10: Changing organization default HS Code NEVER alters existing products (Decoupled Immutability)", async () => {
    // Set up org with original default 8517.13
    storeAddCompany({
      id: ABC_ORG_ID,
      name: "ABC Electronics",
      defaultHsCode: "8517.13",
    });

    // Create existing products
    const { product: prodExisting1 } = await createProduct({
      businessId: ABC_ORG_ID,
      name: "Existing Phone Model X",
      // Inherited 8517.13 at creation time
      retailPrice: 50000,
    });
    const { product: prodExisting2 } = await createProduct({
      businessId: ABC_ORG_ID,
      name: "Existing Screen Component",
      hsCode: "8517.79", // Explicit override
      retailPrice: 12000,
    });

    expect(prodExisting1.hsCode).toBe("8517.13");
    expect(prodExisting2.hsCode).toBe("8517.79");

    // NOW ADMIN UPDATES THE ORGANIZATION DEFAULT HS CODE TO 8517.99
    storeUpdateCompany(ABC_ORG_ID, {
      defaultHsCode: "8517.99",
    });

    const updatedOrg = fallbackStore.companies.find((c) => c.id === ABC_ORG_ID);
    expect(updatedOrg?.defaultHsCode).toBe("8517.99");

    // VERIFY EXISTING PRODUCTS REMAIN UNTOUCHED
    const fetchedProd1 = await getProductById(prodExisting1.id, ABC_ORG_ID);
    const fetchedProd2 = await getProductById(prodExisting2.id, ABC_ORG_ID);

    expect(fetchedProd1?.hsCode).toBe("8517.13"); // CRITICAL: Still 8517.13!
    expect(fetchedProd2?.hsCode).toBe("8517.79"); // CRITICAL: Still 8517.79!

    // VERIFY ONLY NEW FUTURE PRODUCTS GET THE NEW DEFAULT 8517.99
    const { product: prodFuture } = await createProduct({
      businessId: ABC_ORG_ID,
      name: "Future Phone Model Y",
      retailPrice: 60000,
    });

    expect(prodFuture.hsCode).toBe("8517.99"); // Uses NEW default
  });

  // =========================================================================
  // FBR POS TAX ENGINE & COMPLIANCE VERIFICATION
  // =========================================================================
  describe("FBR POS Tax Engine & Invoice Generation", () => {
    it("Calculates 18% Sales Tax and 3% Further Tax correctly for unregistered buyers", () => {
      // 100,000 subtotal, registered customer (0% further tax)
      const registeredTaxes = calculateFbrTaxes({
        subtotal: 100000,
        salesTaxRate: 18,
        furtherTaxRate: 3,
        extraTaxRate: 0,
        isRegisteredBuyer: true,
      });

      expect(registeredTaxes.salesTax).toBe(18000);
      expect(registeredTaxes.furtherTax).toBe(0);
      expect(registeredTaxes.totalTax).toBe(18000);
      expect(registeredTaxes.totalAmount).toBe(118000);

      // 100,000 subtotal, UNREGISTERED customer (3% further tax applies)
      const unregisteredTaxes = calculateFbrTaxes({
        subtotal: 100000,
        salesTaxRate: 18,
        furtherTaxRate: 3,
        extraTaxRate: 1,
        isRegisteredBuyer: false,
      });

      expect(unregisteredTaxes.salesTax).toBe(18000);
      expect(unregisteredTaxes.furtherTax).toBe(3000);
      expect(unregisteredTaxes.extraTax).toBe(1000);
      expect(unregisteredTaxes.totalTax).toBe(22000);
      expect(unregisteredTaxes.totalAmount).toBe(122000);
    });

    it("Generates compliant FBR Invoice Number and FBR QR payload", () => {
      const invNum = generateFbrInvoiceNumber();
      expect(invNum).toMatch(/^FBR-POS-\d{4}-\d+$/);

      const qrPayload = generateFbrQrCode(invNum, 122000);

      expect(qrPayload).toContain("https://e.fbr.gov.pk/verify?inv=");
      expect(qrPayload).toContain(encodeURIComponent(invNum));
      expect(qrPayload).toContain("pos=POS-101");
      expect(qrPayload).toContain("amt=122000");
    });

    it("Creates an FBR POS Invoice with compliance metrics", async () => {
      storeAddCompany({
        id: ABC_ORG_ID,
        name: "ABC Electronics",
        ntn: "1234567-8",
        defaultHsCode: "8517.13",
      });

      const invoice = await createFbrPosInvoice({
        businessId: ABC_ORG_ID,
        customerName: "Walk-in Retail Buyer",
        isRegisteredBuyer: false,
        subtotal: 100000,
        items: [
          {
            productId: "prod-demo-1",
            productName: "Galaxy Smartphone A54",
            hsCode: "8517.13",
            quantity: 1,
            unitPrice: 100000,
            lineTotal: 100000,
          },
        ],
        paymentMethod: "CASH",
      });

      expect(invoice.fbrStatus).toBe("SUCCESS");
      expect(invoice.fbrInvoiceNumber).toBeDefined();
      expect(invoice.fbrQrCode).toBeDefined();
      expect(invoice.salesTax).toBe(18000);
      expect(invoice.furtherTax).toBe(3000);
      expect(invoice.totalAmount).toBe(121000);

      // Verify compliance overview stats
      const stats = await getFbrComplianceOverview(ABC_ORG_ID);
      expect(stats.totalInvoices).toBeGreaterThanOrEqual(1);
      expect(stats.successFbr).toBeGreaterThanOrEqual(1);
      expect(stats.totalSalesTax).toBeGreaterThanOrEqual(18000);
    });
  });

  describe("Custom Category Management & Safety", () => {
    it("Allows creating a custom category with default HS code", () => {
      const newCat = storeAddCategory({
        businessId: "custom-biz-01",
        name: "Smart Wearables",
        defaultHsCode: "8517.62",
        description: "Smart watches and fitness bands",
      });

      expect(newCat.id).toBeDefined();
      expect(newCat.name).toBe("Smart Wearables");
      expect(newCat.defaultHsCode).toBe("8517.62");

      const found = fallbackStore.categories.find((c) => c.id === newCat.id);
      expect(found).toBeDefined();
    });

    it("Safely updates an existing category", () => {
      const cat = storeAddCategory({
        businessId: "custom-biz-01",
        name: "Old Category Name",
        defaultHsCode: "8517.13",
      });

      const updated = storeUpdateCategory(cat.id, {
        name: "Updated Category Name",
        defaultHsCode: "8528.52",
      });

      expect(updated).toBeDefined();
      expect(updated?.name).toBe("Updated Category Name");
      expect(updated?.defaultHsCode).toBe("8528.52");
    });

    it("Safely deletes a category and reassigns product categoryId to null without deleting products", () => {
      const cat = storeAddCategory({
        businessId: "custom-biz-01",
        name: "Temporary Category",
        defaultHsCode: "8517.13",
      });

      const prod = storeAddProduct({
        businessId: "custom-biz-01",
        name: "Product Under Deletion",
        categoryId: cat.id,
        hsCode: "8517.13",
      });

      expect(prod.categoryId).toBe(cat.id);

      const deleted = storeDeleteCategory(cat.id);
      expect(deleted).toBe(true);

      // Category should be gone
      expect(fallbackStore.categories.find((c) => c.id === cat.id)).toBeUndefined();

      // Product must still exist, but categoryId should be null
      const checkProd = fallbackStore.products.find((p) => p.id === prod.id);
      expect(checkProd).toBeDefined();
      expect(checkProd?.categoryId).toBeNull();
    });
  });
});
