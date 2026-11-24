/**
 * SmartBiz / Accounts360 - Offline Embedded Database Engine
 * Manages zero-config local database persistence (%APPDATA%/Accounts360/smartbiz.db)
 * Features atomic writes, crash resilience, automated state hydration, and 1-click .sbz backup/restore.
 */

import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";

export interface DatabaseBackupPayload {
  format: "ACCOUNTS360_BACKUP";
  version: "1.0.0";
  exportedAt: string;
  machineId?: string;
  businessName?: string;
  checksum: string;
  state: any;
}

/**
 * Returns the absolute path where the offline desktop database is stored.
 */
export function getDesktopDatabaseFilePath(): string {
  // Allow environment override
  if (process.env.DESKTOP_DB_FILE) {
    return path.resolve(process.env.DESKTOP_DB_FILE);
  }

  // Windows: %APPDATA%/Accounts360/smartbiz.db
  if (process.platform === "win32" && process.env.APPDATA) {
    return path.join(process.env.APPDATA, "Accounts360", "smartbiz.db");
  }

  // Linux / macOS / Local Dev fallback
  const homeDir = os.homedir();
  return path.join(homeDir, ".accounts360", "smartbiz.db");
}

/**
 * Checks whether the local desktop database file exists on disk.
 */
export function hasDesktopDatabaseFile(): boolean {
  try {
    return fs.existsSync(getDesktopDatabaseFilePath());
  } catch {
    return false;
  }
}

/**
 * Reads and parses the persistent database state from disk.
 * Returns null if the file does not exist or is empty.
 */
export function readDesktopDatabaseState(): any | null {
  const filePath = getDesktopDatabaseFilePath();
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    if (!raw || !raw.trim()) return null;
    return JSON.parse(raw);
  } catch (err: any) {
    console.error("[DesktopDatabase] Failed to read database file:", err.message);
    return null;
  }
}

let saveTimeout: NodeJS.Timeout | null = null;

/**
 * Saves database state to disk using an atomic write pattern
 * (writes to .tmp then renames) to prevent file corruption during sudden power loss.
 */
export function writeDesktopDatabaseStateSync(state: any): void {
  const filePath = getDesktopDatabaseFilePath();
  const dirPath = path.dirname(filePath);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  const tmpPath = `${filePath}.tmp-${Date.now()}`;
  const serialized = JSON.stringify(state, null, 2);

  fs.writeFileSync(tmpPath, serialized, "utf8");
  fs.renameSync(tmpPath, filePath);
}

/**
 * Debounced database commit for high-frequency operations (sales, payments, ledgers).
 */
export function scheduleDesktopDatabaseSave(state: any, delayMs = 300): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }

  saveTimeout = setTimeout(() => {
    try {
      writeDesktopDatabaseStateSync(state);
    } catch (err: any) {
      console.error("[DesktopDatabase] Debounced write error:", err.message);
    } finally {
      saveTimeout = null;
    }
  }, delayMs);
}

/**
 * Generates a signed 1-click .sbz (SmartBiz zip/backup) string containing full business ledger & transactions.
 */
export function exportDatabaseBackup(state: any, metadata?: { machineId?: string; businessName?: string }): {
  filename: string;
  payloadString: string;
  checksum: string;
} {
  const serializedState = JSON.stringify(state);
  const checksum = crypto.createHash("sha256").update(serializedState).digest("hex");

  const payload: DatabaseBackupPayload = {
    format: "ACCOUNTS360_BACKUP",
    version: "1.0.0",
    exportedAt: new Date().toISOString(),
    machineId: metadata?.machineId,
    businessName: metadata?.businessName || state?.business?.name || "Accounts360 Business",
    checksum,
    state,
  };

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "");
  const cleanBiz = (payload.businessName || "Business").replace(/[^a-zA-Z0-9]/g, "_").slice(0, 20);
  const filename = `Backup_${cleanBiz}_${dateStr}_${timeStr}.sbz`;

  return {
    filename,
    payloadString: JSON.stringify(payload, null, 2),
    checksum,
  };
}

/**
 * Validates and restores database state from a .sbz backup file payload.
 */
export function validateAndRestoreDatabaseBackup(rawPayload: string): {
  success: boolean;
  state?: any;
  error?: string;
  metadata?: { exportedAt: string; businessName?: string };
} {
  try {
    const parsed: DatabaseBackupPayload = JSON.parse(rawPayload);

    if (parsed.format !== "ACCOUNTS360_BACKUP") {
      return { success: false, error: "Invalid file format. File is not an Accounts360 backup (.sbz)." };
    }

    if (!parsed.state || typeof parsed.state !== "object") {
      return { success: false, error: "Corrupted backup state." };
    }

    const calculatedChecksum = crypto.createHash("sha256").update(JSON.stringify(parsed.state)).digest("hex");
    if (calculatedChecksum !== parsed.checksum) {
      return { success: false, error: "Checksum verification failed! Backup file has been modified or corrupted." };
    }

    // Persist restored state immediately to disk
    writeDesktopDatabaseStateSync(parsed.state);

    return {
      success: true,
      state: parsed.state,
      metadata: {
        exportedAt: parsed.exportedAt,
        businessName: parsed.businessName,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Failed to restore backup: ${err.message}`,
    };
  }
}

export interface DesktopBusinessSetupInput {
  businessName: string;
  ownerName: string;
  phone?: string;
  email: string;
  password?: string;
  city?: string;
  packageType?: string;
}

/**
 * Checks whether the local desktop business profile & owner have been created.
 */
export function isDesktopSetupComplete(): boolean {
  const state = readDesktopDatabaseState();
  return Boolean(state && state.companies && state.companies.length > 0 && state.users && state.users.length > 0);
}

/**
 * Returns the active desktop business & owner user if initialized.
 */
export function getDesktopBusinessInfo(): {
  isSetupComplete: boolean;
  business?: any;
  user?: any;
} {
  const state = readDesktopDatabaseState();
  if (state && state.companies && state.companies.length > 0 && state.users && state.users.length > 0) {
    return {
      isSetupComplete: true,
      business: state.companies[0],
      user: state.users[0],
    };
  }
  return { isSetupComplete: false };
}

/**
 * Creates the initial fresh, zero-data business ledger and owner user on this computer.
 */
export function initializeDesktopBusiness(data: DesktopBusinessSetupInput): {
  success: boolean;
  business: any;
  user: any;
  error?: string;
} {
  try {
    const bizId = "biz-desktop-main";
    const cleanEmail = data.email.toLowerCase().trim();
    const pkg = data.packageType || "ACCOUNTING_ONLY";

    const business = {
      id: bizId,
      name: data.businessName.trim(),
      ownerName: data.ownerName.trim(),
      phone: data.phone?.trim() || "",
      email: cleanEmail,
      city: data.city?.trim() || "Karachi",
      currency: "PKR",
      currencySymbol: "Rs",
      packageType: pkg,
      enabledModules:
        pkg === "ACCOUNTING_ONLY"
          ? ["accounting", "inventory", "sales", "purchases", "reports"]
          : ["accounting", "inventory", "sales", "purchases", "pos", "reports", "compliance"],
      canCreateBranches: true,
      subscriptionStatus: "ACTIVE",
      createdAt: new Date().toISOString(),
    };

    const user = {
      id: "usr-desktop-owner",
      name: data.ownerName.trim(),
      email: cleanEmail,
      password: data.password || "admin123",
      role: "OWNER_ADMIN",
      platformRole: "TENANT_USER",
      businessId: bizId,
      businessName: business.name,
      companyIds: [bizId],
      branchId: null,
      createdAt: new Date().toISOString(),
    };

    // Standard initial Chart of Accounts (Rs 0.00 balances, completely fresh)
    const accounts = [
      { id: `acc-1010-${bizId}`, businessId: bizId, code: "1010", name: "Cash in Hand", type: "ASSET", subType: "Cash", balance: 0 },
      { id: `acc-1020-${bizId}`, businessId: bizId, code: "1020", name: "Main Bank Account", type: "ASSET", subType: "Bank", balance: 0 },
      { id: `acc-1030-${bizId}`, businessId: bizId, code: "1030", name: "Petty Cash", type: "ASSET", subType: "Cash", balance: 0 },
      { id: `acc-1100-${bizId}`, businessId: bizId, code: "1100", name: "Accounts Receivable", type: "ASSET", subType: "Receivable", balance: 0 },
      { id: `acc-1200-${bizId}`, businessId: bizId, code: "1200", name: "Merchandise Inventory", type: "ASSET", subType: "Inventory", balance: 0 },
      { id: `acc-2010-${bizId}`, businessId: bizId, code: "2010", name: "Accounts Payable", type: "LIABILITY", subType: "Payable", balance: 0 },
      { id: `acc-3010-${bizId}`, businessId: bizId, code: "3010", name: "Owner's Capital", type: "EQUITY", subType: "Capital", balance: 0 },
      { id: `acc-4010-${bizId}`, businessId: bizId, code: "4010", name: "Sales Revenue", type: "REVENUE", subType: "Operating Revenue", balance: 0 },
      { id: `acc-5010-${bizId}`, businessId: bizId, code: "5010", name: "Cost of Goods Sold", type: "EXPENSE", subType: "Direct Cost", balance: 0 },
      { id: `acc-5100-${bizId}`, businessId: bizId, code: "5100", name: "General & Administrative Expenses", type: "EXPENSE", subType: "Operating Expense", balance: 0 },
      { id: `acc-5110-${bizId}`, businessId: bizId, code: "5110", name: "Shop / Office Rent", type: "EXPENSE", subType: "Operating Expense", balance: 0 },
      { id: `acc-5120-${bizId}`, businessId: bizId, code: "5120", name: "Electricity & Utility Bills", type: "EXPENSE", subType: "Operating Expense", balance: 0 },
      { id: `acc-5130-${bizId}`, businessId: bizId, code: "5130", name: "Staff Salaries & Wages", type: "EXPENSE", subType: "Operating Expense", balance: 0 },
    ];

    const state = {
      business,
      activeBusinessId: bizId,
      companies: [business],
      users: [user],
      accounts,
      cashBankAccounts: [
        { id: `cb-1-${bizId}`, businessId: bizId, name: "Shop Cash Drawer (کاؤنٹر کیش)", type: "CASH", accountId: `acc-1010-${bizId}`, balance: 0 },
        { id: `cb-2-${bizId}`, businessId: bizId, name: "Primary Business Bank", type: "BANK", accountId: `acc-1020-${bizId}`, balance: 0 },
      ],
      expenseCategories: [
        { id: `exp-cat-1`, name: "Rent & Utilities", code: "5110" },
        { id: `exp-cat-2`, name: "Staff Salaries", code: "5130" },
        { id: `exp-cat-3`, name: "Tea & Refreshment", code: "5100" },
        { id: `exp-cat-4`, name: "Transport & Delivery", code: "5100" },
      ],
      categories: [],
      products: [],
      customers: [],
      suppliers: [],
      sales: [],
      purchases: [],
      payments: [],
      expenses: [],
      inventoryTransactions: [],
      journalEntries: [],
      branches: [],
    };

    writeDesktopDatabaseStateSync(state);

    return {
      success: true,
      business,
      user,
    };
  } catch (err: any) {
    return {
      success: false,
      business: null,
      user: null,
      error: err.message,
    };
  }
}
