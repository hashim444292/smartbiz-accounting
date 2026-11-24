/**
 * SmartBiz / Accounts360 - Windows Desktop Installer Builder
 * Automates Next.js standalone compilation, static asset synchronization,
 * and Electron-Builder packaging into a single Accounts360-Setup-1.0.0.exe file.
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const desktopDir = path.join(rootDir, "desktop");

console.log("=================================================");
console.log("🚀 Starting Accounts360 Windows Desktop Build");
console.log("=================================================");

// 1. Next.js Standalone Build
console.log("\n📦 Step 1: Compiling Next.js Standalone Server & Prisma Client...");
try {
  execSync("npm run build", { cwd: rootDir, stdio: "inherit" });
} catch (err) {
  console.error("❌ Next.js build failed:", err.message);
  process.exit(1);
}

// 2. Synchronize Static Assets to Standalone directory
console.log("\n📂 Step 2: Synchronizing static and public assets to standalone folder...");
const standaloneDir = path.join(rootDir, ".next", "standalone");
const publicSrc = path.join(rootDir, "public");
const publicDest = path.join(standaloneDir, "public");
const staticSrc = path.join(rootDir, ".next", "static");
const staticDest = path.join(standaloneDir, ".next", "static");
const desktopServerDir = path.join(desktopDir, "server");

if (fs.existsSync(publicSrc)) {
  fs.cpSync(publicSrc, publicDest, { recursive: true, force: true });
}
if (fs.existsSync(staticSrc)) {
  fs.cpSync(staticSrc, staticDest, { recursive: true, force: true });
}
console.log("✓ Assets successfully copied to .next/standalone.");

// 3. Synchronize standalone folder to desktop/server for electron-builder extraResources
console.log("\n📂 Step 3: Copying standalone server to desktop/server for packaging...");
if (fs.existsSync(desktopServerDir)) {
  fs.rmSync(desktopServerDir, { recursive: true, force: true });
}
fs.cpSync(standaloneDir, desktopServerDir, { recursive: true, force: true });
console.log("✓ Standalone server copied to desktop/server.");

// 4. Ensure icon assets exist
console.log("\n🎨 Step 4: Verifying application icon assets...");
const iconPath = path.join(desktopDir, "assets", "icon.ico");
if (!fs.existsSync(iconPath)) {
  console.log("Generating icon.ico...");
  execSync("node scripts/generate-icon.cjs", { cwd: rootDir, stdio: "inherit" });
}
console.log("✓ Icon verified.");

console.log("\n=================================================");
console.log("🎉 Standalone Server & Assets are 100% Prepared!");
console.log("=================================================");
