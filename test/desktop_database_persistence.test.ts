import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import {
  getDesktopDatabaseFilePath,
  writeDesktopDatabaseStateSync,
  readDesktopDatabaseState,
  exportDatabaseBackup,
  validateAndRestoreDatabaseBackup,
  hasDesktopDatabaseFile,
  initializeDesktopBusiness,
  isDesktopSetupComplete,
} from "../src/lib/desktopDatabase";

describe("Desktop Database Persistence & .sbz Backup Suite", () => {
  const tempTestDb = path.join(os.tmpdir(), `test_smartbiz_${Date.now()}.db`);

  beforeEach(() => {
    process.env.DESKTOP_DB_FILE = tempTestDb;
  });

  afterEach(() => {
    delete process.env.DESKTOP_DB_FILE;
    if (fs.existsSync(tempTestDb)) {
      try {
        fs.unlinkSync(tempTestDb);
      } catch {}
    }
  });

  it("1. getDesktopDatabaseFilePath returns valid file ending in .db", () => {
    const p = getDesktopDatabaseFilePath();
    expect(p).toContain(path.basename(tempTestDb));
  });

  it("2. writeDesktopDatabaseStateSync & readDesktopDatabaseState persist and restore cleanly", () => {
    expect(hasDesktopDatabaseFile()).toBe(false);

    const mockState = {
      companies: [{ id: "biz-1", name: "Al-Rehman Traders", packageType: "ACCOUNTING_ONLY" }],
      products: [{ id: "prod-1", name: "Sugar 50kg Bag", salePrice: 6500 }],
      sales: [{ id: "sale-1", invoiceNumber: "INV-001", totalAmount: 6500 }],
    };

    writeDesktopDatabaseStateSync(mockState);
    expect(hasDesktopDatabaseFile()).toBe(true);

    const loaded = readDesktopDatabaseState();
    expect(loaded).not.toBeNull();
    expect(loaded.companies[0].name).toBe("Al-Rehman Traders");
    expect(loaded.products[0].salePrice).toBe(6500);
  });

  it("3. exportDatabaseBackup generates signed .sbz payload with valid SHA-256 checksum", () => {
    const mockState = {
      business: { name: "Al-Madina Store" },
      companies: [{ id: "biz-1", name: "Al-Madina Store" }],
      sales: [{ id: "sale-100", totalAmount: 12000 }],
    };

    const backup = exportDatabaseBackup(mockState, {
      machineId: "MCH-8F29-A4B1-99C3",
      businessName: "Al-Madina Store",
    });

    expect(backup.filename).toMatch(/^Backup_Al_Madina_Store_\d{8}_\d{6}\.sbz$/);
    expect(backup.checksum).toHaveLength(64);

    const parsed = JSON.parse(backup.payloadString);
    expect(parsed.format).toBe("ACCOUNTS360_BACKUP");
    expect(parsed.version).toBe("1.0.0");
    expect(parsed.machineId).toBe("MCH-8F29-A4B1-99C3");
    expect(parsed.state.sales[0].totalAmount).toBe(12000);
  });

  it("4. validateAndRestoreDatabaseBackup correctly restores a valid .sbz backup", () => {
    const originalState = {
      companies: [{ id: "biz-restore", name: "Restore Test Co" }],
      customers: [{ id: "cust-1", name: "Muhammad Ali", balance: 5000 }],
    };

    const backup = exportDatabaseBackup(originalState, { businessName: "Restore Test Co" });
    const restoreResult = validateAndRestoreDatabaseBackup(backup.payloadString);

    expect(restoreResult.success).toBe(true);
    expect(restoreResult.state.companies[0].name).toBe("Restore Test Co");

    // Also check it was written to disk
    const onDisk = readDesktopDatabaseState();
    expect(onDisk.customers[0].name).toBe("Muhammad Ali");
  });

  it("5. validateAndRestoreDatabaseBackup rejects tampered/corrupted backup", () => {
    const originalState = {
      companies: [{ id: "biz-1", name: "Original Corp" }],
    };

    const backup = exportDatabaseBackup(originalState);
    const parsed = JSON.parse(backup.payloadString);

    // Maliciously tamper with the balance
    parsed.state.companies[0].name = "Hacked Corp";
    const tamperedPayload = JSON.stringify(parsed);

    const restoreResult = validateAndRestoreDatabaseBackup(tamperedPayload);
    expect(restoreResult.success).toBe(false);
    expect(restoreResult.error).toMatch(/Checksum verification failed/i);
  });

  it("6. initializeDesktopBusiness creates clean slate ledger and owner user", () => {
    const res = initializeDesktopBusiness({
      businessName: "Tariq Autos",
      ownerName: "Tariq Mehmood",
      phone: "0300-9876543",
      city: "Rawalpindi",
      email: "tariq@autos.pk",
      password: "pass123",
      packageType: "POS_COMBO",
    });

    expect(res.success).toBe(true);
    expect(res.business.name).toBe("Tariq Autos");
    expect(res.business.packageType).toBe("POS_COMBO");
    expect(res.user.email).toBe("tariq@autos.pk");
    expect(res.user.role).toBe("OWNER_ADMIN");

    const onDisk = readDesktopDatabaseState();
    expect(onDisk.companies[0].name).toBe("Tariq Autos");
    expect(onDisk.sales).toHaveLength(0);
    expect(onDisk.products.length).toBeGreaterThanOrEqual(0);
    expect(onDisk.customers.length).toBeGreaterThanOrEqual(0);
    expect(onDisk.accounts.length).toBeGreaterThan(5);
    expect(isDesktopSetupComplete()).toBe(true);
  });
});
