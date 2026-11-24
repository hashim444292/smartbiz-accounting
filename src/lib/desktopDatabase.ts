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
