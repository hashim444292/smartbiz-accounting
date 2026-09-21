import { prisma } from "@/lib/prisma";
import { fallbackStore, storeAddProduct, storeUpdateProduct, storeAddProductAudit } from "@/lib/fallbackStore";
import { resolveProductHsCode } from "./productService";

export interface ColumnDefinition {
  field: string;
  label: string;
  required: boolean;
  aliases: string[];
}

export const IMPORTABLE_FIELDS: ColumnDefinition[] = [
  { field: "name", label: "Product Name", required: true, aliases: ["product name", "item name", "name", "title", "product"] },
  { field: "sku", label: "SKU", required: false, aliases: ["sku", "item code", "code", "product sku"] },
  { field: "productCode", label: "Product Code", required: false, aliases: ["product code", "pcode", "item code"] },
  { field: "barcode", label: "Barcode", required: false, aliases: ["barcode", "upc", "ean", "bar code"] },
  { field: "categoryName", label: "Category", required: false, aliases: ["category", "category name", "cat", "group"] },
  { field: "brand", label: "Brand", required: false, aliases: ["brand", "manufacturer", "make"] },
  { field: "description", label: "Description", required: false, aliases: ["description", "details", "desc", "specification"] },
  { field: "uom", label: "UOM", required: false, aliases: ["uom", "unit", "unit of measure"] },
  { field: "hsCode", label: "HS Code", required: false, aliases: ["hs code", "hscode", "hs_code", "tariff", "tariff code", "pct code"] },
  { field: "taxProfile", label: "Tax Profile", required: false, aliases: ["tax profile", "tax type"] },
  { field: "salesTax", label: "Sales Tax (%)", required: false, aliases: ["sales tax", "tax rate", "sales tax %", "tax %", "tax"] },
  { field: "furtherTax", label: "Further Tax (%)", required: false, aliases: ["further tax", "further tax %"] },
  { field: "extraTax", label: "Extra Tax (%)", required: false, aliases: ["extra tax", "extra tax %"] },
  { field: "retailPrice", label: "Retail Price", required: false, aliases: ["retail price", "selling price", "sale price", "price", "mrp"] },
  { field: "wholesalePrice", label: "Wholesale Price", required: false, aliases: ["wholesale price", "trade price", "tp"] },
  { field: "purchasePrice", label: "Purchase Price", required: false, aliases: ["purchase price", "cost price", "cost", "buying price"] },
  { field: "openingQuantity", label: "Opening Quantity", required: false, aliases: ["opening quantity", "opening stock", "quantity", "qty", "stock"] },
  { field: "minStockLevel", label: "Min Stock Level", required: false, aliases: ["min stock", "min stock level", "reorder level"] },
];

/**
 * Automatically map raw header names to canonical field names
 */
export function detectColumns(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};

  for (const header of headers) {
    const norm = header.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    let matchedField = "";

    for (const def of IMPORTABLE_FIELDS) {
      for (const alias of def.aliases) {
        const normAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (norm === normAlias) {
          matchedField = def.field;
          break;
        }
      }
      if (matchedField) break;
    }

    if (matchedField) {
      mapping[header] = matchedField;
    }
  }

  return mapping;
}

export interface ValidationErrorItem {
  row: number;
  product: string;
  field: string;
  error: string;
  suggestedFix: string;
}

export interface ValidationWarningItem {
  row: number;
  product: string;
  field: string;
  warning: string;
}

export interface ValidatedRow {
  rowNumber: number;
  raw: Record<string, any>;
  data: Record<string, any>;
  status: "VALID" | "WARNING" | "ERROR";
  isDuplicate: boolean;
  duplicateId?: string;
  hsCodeSource: "PRODUCT" | "CATEGORY" | "ORGANIZATION" | "MISSING";
  errors: ValidationErrorItem[];
  warnings: ValidationWarningItem[];
}

export interface ValidateImportParams {
  rawRows: Record<string, any>[];
  columnMapping: Record<string, string>;
  organizationId: string;
  duplicateStrategy?: "UPDATE" | "SKIP" | "CREATE_NEW";
}

export async function validateImportRows(params: ValidateImportParams) {
  const { rawRows, columnMapping, organizationId, duplicateStrategy = "UPDATE" } = params;

  // Retrieve organization and categories
  let org: any = null;
  let categories: any[] = [];
  let existingProducts: any[] = [];

  try {
    const [dbOrg, dbCats, dbProds] = await Promise.all([
      prisma.business.findUnique({ where: { id: organizationId } }),
      prisma.category.findMany({ where: { businessId: organizationId } }),
      prisma.product.findMany({ where: { businessId: organizationId }, select: { id: true, sku: true, productCode: true, barcode: true, name: true, hsCode: true } }),
    ]);
    org = dbOrg;
    categories = dbCats;
    existingProducts = dbProds;
  } catch {
    org = fallbackStore.companies.find((c) => c.id === organizationId) || fallbackStore.business;
    categories = fallbackStore.categories.filter((c) => c.businessId === organizationId);
    existingProducts = fallbackStore.products.filter((p) => p.businessId === organizationId);
  }

  const validatedRows: ValidatedRow[] = [];
  const allErrors: ValidationErrorItem[] = [];
  const allWarnings: ValidationWarningItem[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const rowNum = i + 1;
    const rowErrors: ValidationErrorItem[] = [];
    const rowWarnings: ValidationWarningItem[] = [];

    // Map fields from raw headers to canonical fields
    const data: Record<string, any> = {};
    for (const [header, val] of Object.entries(raw)) {
      const field = columnMapping[header];
      if (field) {
        data[field] = typeof val === "string" ? val.trim() : val;
      }
    }

    const productName = data.name ? String(data.name).trim() : "";

    // 1. Validate Product Name
    if (!productName) {
      const err = {
        row: rowNum,
        product: "Unknown",
        field: "name",
        error: "Missing Product Name",
        suggestedFix: "Provide a descriptive product name in the CSV column",
      };
      rowErrors.push(err);
      allErrors.push(err);
    }

    // 2. Resolve Category
    let resolvedCategoryId: string | null = null;
    let matchedCategory: any = null;
    if (data.categoryName) {
      const catName = String(data.categoryName).toLowerCase().trim();
      matchedCategory = categories.find((c) => c.name.toLowerCase() === catName);
      if (matchedCategory) {
        resolvedCategoryId = matchedCategory.id;
      }
    }

    // 3. HS Code Inheritance Logic
    const rawHsCode = data.hsCode ? String(data.hsCode).trim() : "";
    const hsResult = await resolveProductHsCode({
      organizationId,
      categoryId: resolvedCategoryId,
      productHsCode: rawHsCode,
    });

    data.hsCode = hsResult.resolvedHsCode;
    const hsCodeSource = hsResult.source;

    if (!data.hsCode) {
      const err = {
        row: rowNum,
        product: productName || `Row ${rowNum}`,
        field: "hsCode",
        error: "Missing HS Code",
        suggestedFix: "Specify an HS Code in the CSV or configure a default HS Code for this Category or Organization in Settings",
      };
      rowErrors.push(err);
      allErrors.push(err);
    } else if (hsCodeSource === "PRODUCT" && org?.defaultHsCode && data.hsCode !== org.defaultHsCode) {
      const warn = {
        row: rowNum,
        product: productName,
        field: "hsCode",
        warning: `Product HS Code (${data.hsCode}) differs from organization default (${org.defaultHsCode})`,
      };
      rowWarnings.push(warn);
      allWarnings.push(warn);
    }

    // 4. Duplicate Check
    const sku = data.sku ? String(data.sku).trim() : "";
    const pCode = data.productCode ? String(data.productCode).trim() : "";
    const barcode = data.barcode ? String(data.barcode).trim() : "";

    let duplicateMatch: any = null;
    if (sku || pCode || barcode) {
      duplicateMatch = existingProducts.find(
        (p) =>
          (sku && p.sku && p.sku.toLowerCase() === sku.toLowerCase()) ||
          (pCode && p.productCode && p.productCode.toLowerCase() === pCode.toLowerCase()) ||
          (barcode && p.barcode && p.barcode === barcode)
      );
    }

    const isDuplicate = Boolean(duplicateMatch);
    if (isDuplicate) {
      if (duplicateStrategy === "SKIP") {
        const warn = {
          row: rowNum,
          product: productName,
          field: "sku",
          warning: `Duplicate product found (${duplicateMatch.name}). Row will be skipped.`,
        };
        rowWarnings.push(warn);
        allWarnings.push(warn);
      } else if (duplicateStrategy === "UPDATE") {
        const warn = {
          row: rowNum,
          product: productName,
          field: "sku",
          warning: `Existing product match (${duplicateMatch.name}). Record will be updated.`,
        };
        rowWarnings.push(warn);
        allWarnings.push(warn);
      }
    }

    // Default numeric sanity
    data.retailPrice = Number(data.retailPrice ?? data.sellingPrice ?? 0);
    data.wholesalePrice = Number(data.wholesalePrice ?? data.retailPrice ?? 0);
    data.purchasePrice = Number(data.purchasePrice ?? 0);
    data.salesTax = Number(data.salesTax ?? org?.defaultSalesTax ?? 18.00);
    data.furtherTax = Number(data.furtherTax ?? org?.defaultFurtherTax ?? 0.00);
    data.extraTax = Number(data.extraTax ?? org?.defaultExtraTax ?? 0.00);
    data.uom = data.uom || org?.defaultUom || "pcs";
    data.categoryId = resolvedCategoryId;

    const status = rowErrors.length > 0 ? "ERROR" : rowWarnings.length > 0 ? "WARNING" : "VALID";

    validatedRows.push({
      rowNumber: rowNum,
      raw,
      data,
      status,
      isDuplicate,
      duplicateId: duplicateMatch?.id,
      hsCodeSource,
      errors: rowErrors,
      warnings: rowWarnings,
    });
  }

  const errorCount = validatedRows.filter((r) => r.status === "ERROR").length;
  const warningCount = validatedRows.filter((r) => r.status === "WARNING").length;
  const validCount = validatedRows.filter((r) => r.status !== "ERROR").length;

  return {
    totalRows: rawRows.length,
    validRows: validCount,
    warningRows: warningCount,
    errorRows: errorCount,
    rows: validatedRows,
    validatedRows,
    errors: allErrors,
    allErrors,
    warnings: allWarnings,
    allWarnings,
  };
}

export async function importValidatedRows(params: {
  validRows: ValidatedRow[];
  organizationId: string;
  duplicateStrategy?: "UPDATE" | "SKIP" | "CREATE_NEW";
  userId?: string;
  userName?: string;
}) {
  const { validRows, organizationId, duplicateStrategy = "UPDATE", userId, userName } = params;

  let importedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const row of validRows) {
    if (row.status === "ERROR") continue;

    if (row.isDuplicate && duplicateStrategy === "SKIP") {
      skippedCount++;
      continue;
    }

    const { data } = row;

    if (row.isDuplicate && duplicateStrategy === "UPDATE" && row.duplicateId) {
      try {
        await prisma.product.update({
          where: { id: row.duplicateId },
          data: {
            name: data.name,
            hsCode: data.hsCode,
            uom: data.uom,
            unit: data.uom,
            retailPrice: data.retailPrice,
            sellingPrice: data.retailPrice,
            wholesalePrice: data.wholesalePrice,
            purchasePrice: data.purchasePrice,
            salesTax: data.salesTax,
            furtherTax: data.furtherTax,
            extraTax: data.extraTax,
            categoryId: data.categoryId,
            brand: data.brand || "",
            description: data.description || "",
          } as any,
        });
      } catch {
        storeUpdateProduct(row.duplicateId, {
          name: data.name,
          hsCode: data.hsCode,
          uom: data.uom,
          unit: data.uom,
          retailPrice: data.retailPrice,
          sellingPrice: data.retailPrice,
          wholesalePrice: data.wholesalePrice,
          purchasePrice: data.purchasePrice,
          salesTax: data.salesTax,
          furtherTax: data.furtherTax,
          extraTax: data.extraTax,
          categoryId: data.categoryId,
        });
      }
      updatedCount++;
    } else {
      // Create new
      const prodData = {
        businessId: organizationId,
        name: data.name,
        sku: data.sku || `SKU-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        productCode: data.productCode || data.sku || `PRD-${Date.now()}`,
        barcode: data.barcode || "",
        categoryId: data.categoryId || null,
        brand: data.brand || "",
        description: data.description || "",
        uom: data.uom || "pcs",
        unit: data.uom || "pcs",
        hsCode: data.hsCode,
        taxProfile: data.taxProfile || "Standard 18%",
        salesTax: data.salesTax,
        furtherTax: data.furtherTax,
        extraTax: data.extraTax,
        retailPrice: data.retailPrice,
        sellingPrice: data.retailPrice,
        wholesalePrice: data.wholesalePrice,
        purchasePrice: data.purchasePrice,
        openingQuantity: Number(data.openingQuantity || 0),
        currentStock: Number(data.openingQuantity || 0),
        status: "ACTIVE",
        isActive: true,
      };

      try {
        await prisma.product.create({ data: prodData as any });
      } catch {
        storeAddProduct(prodData);
      }
      importedCount++;
    }
  }

  // Audit import
  storeAddProductAudit({
    productId: "BULK_IMPORT",
    action: "BULK_PRODUCT_IMPORT",
    newValue: { importedCount, updatedCount, skippedCount },
    userId,
    userName: userName || "System Admin",
    notes: `Bulk import completed: ${importedCount} created, ${updatedCount} updated, ${skippedCount} skipped.`,
  });

  return {
    success: true,
    importedCount,
    updatedCount,
    skippedCount,
    totalProcessed: importedCount + updatedCount + skippedCount,
  };
}

export function generateErrorReportCsv(errors: ValidationErrorItem[]): string {
  const headers = ["Row", "Product", "Field", "Error", "Suggested Fix"];
  const rows = errors.map((e) => [
    e.row,
    `"${(e.product || "").replace(/"/g, '""')}"`,
    `"${(e.field || "").replace(/"/g, '""')}"`,
    `"${(e.error || "").replace(/"/g, '""')}"`,
    `"${(e.suggestedFix || "").replace(/"/g, '""')}"`,
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
}
