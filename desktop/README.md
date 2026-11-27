# Accounts360 Desktop - Offline Windows Architecture

This directory houses the Electron native desktop wrapper and packaging pipeline for **Accounts360 Offline Desktop Edition**.

---

## ⚠️ Mandatory Data Preservation Rule (All Future Builds)
- **Never Lose Existing Client Data:** Clients upgrading from an older `Accounts360-Setup-*.exe` already have `%APPDATA%/Accounts360/smartbiz.db` and `%APPDATA%/Accounts360/license.json`. New builds MUST preserve and hydrate all existing `smartbiz.db` data seamlessly.
- **Disk Persistence First:** Every mutation in `src/lib/fallbackStore.ts` must auto-persist to `smartbiz.db` via `src/lib/desktopDatabase.ts` (with `flushDesktopDatabaseSave()` on exit) and `desktopDatabase.ts` must keep server-only Node module loading so Next.js standalone builds never break.
- **Pre-Release Gate:** Always run `npx vitest run test/desktop_database_persistence.test.ts` before packaging any new `.exe` installer.

---

## 🏗️ Architecture Overview

The desktop version operates 100% offline using a single, self-contained Next.js standalone process wrapped inside Electron:

```
[Accounts360-Setup.exe] (Single Windows Installer)
        │
        ▼
[Electron Main Process (desktop/main.cjs)]
        ├── Single-Instance Mutex (prevents duplicate launches)
        ├── Background Server Auto-Start (Port 3600)
        ├── Silent 80mm POS Thermal Receipt Printing (Direct ESC/POS)
        ├── Hardware Machine ID Extractor (Motherboard + CPU bound)
        └── 1-Click .sbz Backup & Restore File Dialogs
        │
        ▼
[Embedded Local Database (%APPDATA%/Accounts360/smartbiz.db)]
        ├── Zero-Config SQLite / JSON Atomic Snapshot Persistence
        ├── Crash-resilient write (.tmp -> rename)
        └── Double-entry ledger with Decimal.js precision
        │
        ▼
[Offline Machine Lock Engine]
        ├── License File: %APPDATA%/Accounts360/license.json
        ├── Formats: A360-<PKG>-<MID>-<EXPIRY>-<SIGNATURE>
        └── 3 Package Tiers:
            ├── 1. ACCOUNTING_ONLY (Cash drawer, ledgers, returns, 80mm & A4 print)
            ├── 2. POS_COMBO (Retail counter, barcode scanner, drawer, FBR POS QR)
            └── 3. DI_COMBO (FBR B2B Digital Invoicing, NTN/STRN, Annexures)
```

---

## 🚀 How to Run & Build

### 1. Test Run Locally (Development)
To run the desktop application locally on your PC:
```bash
# In the repository root:
node scripts/build-desktop.mjs

# In the desktop directory:
cd desktop
npx electron .
```

### 2. Build Single Executable Installer (`Accounts360-Setup.exe`)
To compile the standalone server and package it into a Windows NSIS single-click installer:
```bash
# 1. Compile Next.js standalone and copy static assets:
node scripts/build-desktop.mjs

# 2. Package with electron-builder:
cd desktop
npx electron-builder --win --x64
```

The output will be:
📁 **`desktop/dist/Accounts360-Setup-1.0.0.exe`**

---

## 🔒 Hardware Fingerprinting & Licensing Flow

1. On first launch, the software inspects the physical computer's **System Product UUID**, **Baseboard Serial**, and **CPU Processor ID** via Windows CIM.
2. It generates a deterministic 17-character Machine Code: `MCH-XXXX-XXXX-XXXX`.
3. The client clicks **"Send via WhatsApp"** or copies the code to their software vendor.
4. The Super Admin enters the Machine ID in the online Portal (`https://accounts360.live/admin/licenses`), chooses the package tier (`ACCOUNTING_ONLY`, `POS_COMBO`, `DI_COMBO`), and generates an asymmetric signed key:
   `A360-ACC-8F29-20271124-E9812A4B92C481A0`
5. The client enters the key; the app verifies it offline and unlocks the exact package features with a 365-day annual duration + 7-day grace period.

---

## 🖨️ Thermal Printing (80mm ESC/POS)

Receipts and bills can be printed directly to 80mm POS thermal printers silently (without Windows printer popup dialogues) using the native bridge:
```js
window.accounts360Desktop.printThermal({
  deviceName: "XP-80C", // or default printer
  silent: true
});
```

---

## 💾 Zero-Config Database & .sbz Backups

- **Database File:** Stored at `%APPDATA%\Accounts360\smartbiz.db`.
- **1-Click Backup:** Under **Settings -> Data & Backup**, users can click **Export Offline Backup** to download a signed `.sbz` snapshot.
- **1-Click Restore:** Uploading any `.sbz` snapshot verifies the cryptographic SHA-256 checksum and instantly restores the ledger.
