import { prisma } from "@/lib/prisma";
import {
  fallbackStore,
  storeAddProduct,
  storeUpdateProduct,
  storeAddProductAudit,
  storeGetProductAudits,
} from "@/lib/fallbackStore";

export type HsCodeSource = "PRODUCT" | "CATEGORY" | "ORGANIZATION" | "MISSING";

export interface ResolveHsCodeResult {
  resolvedHsCode: string | null;
  source: HsCodeSource;
  organizationDefault?: string | null;
  categoryDefault?: string | null;
}

/**
 * Centralized HS Code Inheritance Engine
 *
 * Strict Priority Order:
 * 1. Product-specific HS Code (if explicitly provided and non-empty)
 * 2. Category-specific default HS Code
 * 3. Organization-level default HS Code
 * 4. Missing / Error
 */
// Production Database Engine without artificial race timeouts

export async function resolveProductHsCode(params: {
  organizationId: string;
  categoryId?: string | null;
  productHsCode?: string | null;
}): Promise<ResolveHsCodeResult> {
  const { organizationId, categoryId, productHsCode } = params;

  // 1. Explicit Product HS Code
  if (productHsCode && productHsCode.trim().length > 0) {
    return {
      resolvedHsCode: productHsCode.trim(),
      source: "PRODUCT",
    };
  }

  // Look up Organization and Category
  let orgDefaultHsCode: string | null = null;
  let categoryDefaultHsCode: string | null = null;

  try {
    const org = await prisma.business.findUnique({
      where: { id: organizationId },
      select: { defaultHsCode: true },
    });
    if (org?.defaultHsCode) {
      orgDefaultHsCode = org.defaultHsCode;
    }
  } catch {
    const fallbackOrg = fallbackStore.companies.find((c) => c.id === organizationId) || fallbackStore.business;
    if (fallbackOrg?.defaultHsCode) {
      orgDefaultHsCode = fallbackOrg.defaultHsCode;
    }
  }

  if (categoryId) {
    try {
      const cat = await prisma.category.findUnique({
        where: { id: categoryId },
        select: { defaultHsCode: true },
      });
      if (cat?.defaultHsCode) {
        categoryDefaultHsCode = cat.defaultHsCode;
      }
    } catch {
      const fallbackCat = fallbackStore.categories.find(
        (c) => c.id === categoryId && c.businessId === organizationId
      );
      if (fallbackCat?.defaultHsCode) {
        categoryDefaultHsCode = fallbackCat.defaultHsCode;
      }
    }
  }

  // 2. Category Default HS Code
  if (categoryDefaultHsCode && categoryDefaultHsCode.trim().length > 0) {
    return {
      resolvedHsCode: categoryDefaultHsCode.trim(),
      source: "CATEGORY",
      organizationDefault: orgDefaultHsCode,
      categoryDefault: categoryDefaultHsCode,
    };
  }

  // 3. Organization Default HS Code
  if (orgDefaultHsCode && orgDefaultHsCode.trim().length > 0) {
    return {
      resolvedHsCode: orgDefaultHsCode.trim(),
      source: "ORGANIZATION",
      organizationDefault: orgDefaultHsCode,
      categoryDefault: categoryDefaultHsCode,
    };
  }

  // 4. Missing
  return {
    resolvedHsCode: null,
    source: "MISSING",
    organizationDefault: orgDefaultHsCode,
    categoryDefault: categoryDefaultHsCode,
  };
}

export interface ListProductsParams {
  businessId: string;
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  status?: string;
}

export async function listProducts(params: ListProductsParams) {
  const { businessId, page = 1, limit = 20, search = "", categoryId = "", status = "ALL" } = params;
  const skip = (page - 1) * limit;

  try {
    const where: any = { businessId };
    if (search.trim()) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { hsCode: { contains: search, mode: "insensitive" } },
        { barcode: { contains: search, mode: "insensitive" } },
      ];
    }
    if (categoryId && categoryId !== "ALL") {
      where.categoryId = categoryId;
    }
    if (status && status !== "ALL") {
      if (status === "ACTIVE") where.isActive = true;
      else if (status === "ARCHIVED") where.isActive = false;
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: "desc" },
        include: { category: true },
      }),
      prisma.product.count({ where }),
    ]);

    return {
      products,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch {
    // Fallback store in-memory search & pagination (strictly isolated per business)
    let items = fallbackStore.products.filter((p) => p.businessId === businessId);

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      items = items.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.hsCode?.toLowerCase().includes(q) ||
          p.barcode?.toLowerCase().includes(q)
      );
    }

    if (categoryId && categoryId !== "ALL") {
      items = items.filter((p) => p.categoryId === categoryId);
    }

    if (status && status !== "ALL") {
      if (status === "ACTIVE") items = items.filter((p) => p.status === "ACTIVE" || p.isActive !== false);
      else if (status === "ARCHIVED") items = items.filter((p) => p.status === "ARCHIVED" || p.isActive === false);
    }

    const total = items.length;
    const paginated = items.slice(skip, skip + limit).map((p) => {
      const cat = fallbackStore.categories.find((c) => c.id === p.categoryId);
      return {
        ...p,
        category: cat ? { id: cat.id, name: cat.name, defaultHsCode: cat.defaultHsCode } : null,
      };
    });

    return {
      products: paginated,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }
}

export interface CreateProductInput {
  businessId: string;
  name: string;
  sku?: string;
  productCode?: string;
  barcode?: string;
  categoryId?: string | null;
  brand?: string;
  description?: string;
  uom?: string;
  hsCode?: string | null;
  taxProfile?: string;
  salesTax?: number;
  furtherTax?: number;
  extraTax?: number;
  retailPrice?: number;
  wholesalePrice?: number;
  purchasePrice?: number;
  sellingPrice?: number;
  openingQuantity?: number;
  minStockLevel?: number;
  maxStockLevel?: number;
  status?: string;
  userId?: string;
  userName?: string;
}

export async function createProduct(input: CreateProductInput) {
  if (!input.name || input.name.trim().length === 0) {
    throw new Error("Product Name is required");
  }

  // Resolve HS Code using inheritance
  const hsResolution = await resolveProductHsCode({
    organizationId: input.businessId,
    categoryId: input.categoryId,
    productHsCode: input.hsCode,
  });

  const finalHsCode = hsResolution.resolvedHsCode;

  // Stored product hsCode must be determined; if missing, throw clear error
  if (!finalHsCode) {
    throw new Error(
      "Missing HS Code: No product-level HS Code provided, and neither the selected Category nor the Organization has a default HS Code configured."
    );
  }

  const retailPrice = Number(input.retailPrice ?? input.sellingPrice ?? 0);
  const wholesalePrice = Number(input.wholesalePrice ?? input.purchasePrice ?? 0);
  const purchasePrice = Number(input.purchasePrice ?? 0);

  const productData = {
    businessId: input.businessId,
    name: input.name.trim(),
    sku: input.sku?.trim() || `SKU-${Date.now().toString().slice(-6)}`,
    productCode: input.productCode?.trim() || input.sku?.trim() || `PRD-${Date.now().toString().slice(-6)}`,
    barcode: input.barcode?.trim() || "",
    categoryId: input.categoryId || null,
    brand: input.brand?.trim() || "",
    description: input.description?.trim() || "",
    uom: input.uom || "pcs",
    unit: input.uom || "pcs",
    hsCode: finalHsCode,
    taxProfile: input.taxProfile || "Standard 18%",
    salesTax: Number(input.salesTax ?? 18.00),
    furtherTax: Number(input.furtherTax ?? 0.00),
    extraTax: Number(input.extraTax ?? 0.00),
    retailPrice,
    sellingPrice: retailPrice,
    wholesalePrice,
    purchasePrice,
    openingQuantity: Number(input.openingQuantity ?? 0),
    currentStock: Number(input.openingQuantity ?? 0),
    minStockLevel: Number(input.minStockLevel ?? 1),
    maxStockLevel: input.maxStockLevel ? Number(input.maxStockLevel) : null,
    status: input.status || "ACTIVE",
    isActive: input.status !== "ARCHIVED",
  };

  let savedProduct: any;
  try {
    savedProduct = await prisma.product.create({
      data: productData as any,
      include: { category: true },
    });
  } catch {
    savedProduct = storeAddProduct(productData);
    const cat = fallbackStore.categories.find((c) => c.id === savedProduct.categoryId);
    savedProduct.category = cat ? { id: cat.id, name: cat.name, defaultHsCode: cat.defaultHsCode } : null;
  }

  // Record audit log
  storeAddProductAudit({
    productId: savedProduct.id,
    action: "PRODUCT_CREATED",
    newValue: {
      name: savedProduct.name,
      sku: savedProduct.sku,
      hsCode: savedProduct.hsCode,
      hsCodeSource: hsResolution.source,
      price: savedProduct.sellingPrice,
    },
    userId: input.userId,
    userName: input.userName || "System User",
    notes: `Product created with HS Code ${savedProduct.hsCode} (Source: ${hsResolution.source})`,
  });

  return { product: savedProduct, hsResolution };
}

export async function updateProduct(
  id: string,
  updates: Partial<CreateProductInput> & { userId?: string; userName?: string }
) {
  let existingProduct: any = null;
  try {
    existingProduct = await prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });
  } catch {
    existingProduct = fallbackStore.products.find((p) => p.id === id);
  }

  if (!existingProduct) {
    throw new Error("Product not found");
  }

  // Check if HS Code changed
  const oldHsCode = existingProduct.hsCode;

  // Track field changes for audit
  const auditEntries: any[] = [];
  if (updates.hsCode && updates.hsCode !== oldHsCode) {
    auditEntries.push({
      field: "hsCode",
      oldValue: oldHsCode,
      newValue: updates.hsCode,
      action: "HS_CODE_CHANGED",
    });
  }
  if (updates.sellingPrice !== undefined && updates.sellingPrice !== existingProduct.sellingPrice) {
    auditEntries.push({
      field: "sellingPrice",
      oldValue: existingProduct.sellingPrice,
      newValue: updates.sellingPrice,
      action: "PRICE_CHANGED",
    });
  }
  if (updates.salesTax !== undefined && updates.salesTax !== existingProduct.salesTax) {
    auditEntries.push({
      field: "salesTax",
      oldValue: existingProduct.salesTax,
      newValue: updates.salesTax,
      action: "TAX_RATE_CHANGED",
    });
  }
  if (updates.status && updates.status !== existingProduct.status) {
    auditEntries.push({
      field: "status",
      oldValue: existingProduct.status,
      newValue: updates.status,
      action: updates.status === "ARCHIVED" ? "PRODUCT_ARCHIVED" : "PRODUCT_RESTORED",
    });
  }

  let updatedProduct: any;
  try {
    updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        ...(updates.name && { name: updates.name.trim() }),
        ...(updates.sku && { sku: updates.sku.trim() }),
        ...(updates.productCode && { productCode: updates.productCode.trim() }),
        ...(updates.barcode !== undefined && { barcode: updates.barcode?.trim() || "" }),
        ...(updates.categoryId !== undefined && { categoryId: updates.categoryId }),
        ...(updates.brand !== undefined && { brand: updates.brand?.trim() || "" }),
        ...(updates.description !== undefined && { description: updates.description?.trim() || "" }),
        ...(updates.uom && { uom: updates.uom, unit: updates.uom }),
        ...(updates.hsCode && { hsCode: updates.hsCode.trim() }),
        ...(updates.taxProfile && { taxProfile: updates.taxProfile }),
        ...(updates.salesTax !== undefined && { salesTax: Number(updates.salesTax) }),
        ...(updates.furtherTax !== undefined && { furtherTax: Number(updates.furtherTax) }),
        ...(updates.extraTax !== undefined && { extraTax: Number(updates.extraTax) }),
        ...(updates.retailPrice !== undefined && { retailPrice: Number(updates.retailPrice), sellingPrice: Number(updates.retailPrice) }),
        ...(updates.wholesalePrice !== undefined && { wholesalePrice: Number(updates.wholesalePrice) }),
        ...(updates.purchasePrice !== undefined && { purchasePrice: Number(updates.purchasePrice) }),
        ...(updates.status && { status: updates.status, isActive: updates.status !== "ARCHIVED" }),
      } as any,
      include: { category: true },
    });
  } catch {
    updatedProduct = storeUpdateProduct(id, updates);
  }

  // Record audits
  for (const entry of auditEntries) {
    storeAddProductAudit({
      productId: id,
      action: entry.action,
      field: entry.field,
      oldValue: entry.oldValue,
      newValue: entry.newValue,
      userId: updates.userId,
      userName: updates.userName || "System User",
      notes: `${entry.field} modified from ${entry.oldValue} to ${entry.newValue}`,
    });
  }

  return updatedProduct;
}

export async function getProductById(id: string, _businessId?: string) {
  let product: any = null;
  try {
    product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        saleItems: {
          take: 10,
          include: { sale: true },
          orderBy: { sale: { date: "desc" } },
        },
      },
    });
  } catch {
    product = fallbackStore.products.find((p) => p.id === id);
    if (product) {
      const cat = fallbackStore.categories.find((c) => c.id === product.categoryId);
      const linkedSales = fallbackStore.sales
        .filter((s) => s.items?.some((i: any) => i.productId === id))
        .map((s) => ({
          id: s.id,
          sale: s,
          quantity: s.items.find((i: any) => i.productId === id)?.quantity || 1,
          lineTotal: s.items.find((i: any) => i.productId === id)?.lineTotal || 0,
        }));
      product = {
        ...product,
        category: cat ? { id: cat.id, name: cat.name, defaultHsCode: cat.defaultHsCode } : null,
        saleItems: linkedSales,
      };
    }
  }

  if (!product) return null;

  const audits = storeGetProductAudits(id);
  return {
    ...product,
    audits,
  };
}

export async function archiveProduct(id: string, userId?: string, userName?: string) {
  return updateProduct(id, { status: "ARCHIVED", userId, userName });
}

export async function restoreProduct(id: string, userId?: string, userName?: string) {
  return updateProduct(id, { status: "ACTIVE", userId, userName });
}
