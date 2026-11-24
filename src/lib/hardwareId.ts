/**
 * SmartBiz / Accounts360 - Deterministic Hardware Fingerprinting Engine
 * Generates an immutable, hardware-bound Machine ID on Windows (and cross-platform fallbacks)
 * using physical Motherboard UUID, Baseboard Serial, and CPU Processor ID.
 */

import crypto from "crypto";
import { execSync } from "child_process";
import os from "os";
import { formatMachineId } from "./desktopLicense";

let cachedMachineId: string | null = null;

/**
 * Collects raw hardware identifiers from the host machine.
 */
export function getHardwareFingerprintRaw(): string {
  if (process.platform === "win32") {
    try {
      // Query Windows CIM for System Product UUID, Motherboard Serial, and Processor ID
      const psCommand = "(Get-CimInstance Win32_ComputerSystemProduct).UUID; (Get-CimInstance Win32_BaseBoard).SerialNumber; (Get-CimInstance Win32_Processor).ProcessorId";
      const stdout = execSync(`powershell -NoProfile -NonInteractive -Command "${psCommand}"`, {
        timeout: 4000,
        encoding: "utf8",
        windowsHide: true,
      });

      const lines = stdout
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.toLowerCase().includes("to be filled by o.e.m"));

      if (lines.length > 0) {
        return lines.join(":");
      }
    } catch {
      // Fallback: try WMIC if PowerShell is restricted
      try {
        const wmicOut = execSync("wmic csproduct get uuid", {
          timeout: 3000,
          encoding: "utf8",
          windowsHide: true,
        });
        const uuid = wmicOut.replace(/UUID|\r|\n|\s/gi, "").trim();
        if (uuid) return uuid;
      } catch {
        // Fallback below
      }
    }
  }

  // Cross-platform / restricted environment fallback:
  // Combines hostname, CPU model info, architecture, and network MAC addresses
  const netInterfaces = os.networkInterfaces();
  const macs: string[] = [];
  for (const name of Object.keys(netInterfaces)) {
    for (const net of netInterfaces[name] || []) {
      if (!net.internal && net.mac && net.mac !== "00:00:00:00:00:00") {
        macs.push(net.mac);
      }
    }
  }
  const cpus = os.cpus().map((c) => c.model).join(";");
  return `${os.hostname()}:${os.arch()}:${cpus}:${macs.sort().join(",")}`;
}

/**
 * Computes deterministic 12-character Machine ID: MCH-XXXX-XXXX-XXXX
 */
export function getMachineId(): string {
  if (cachedMachineId) return cachedMachineId;

  const raw = getHardwareFingerprintRaw();
  const hash = crypto.createHash("sha256").update(raw).digest("hex").toUpperCase().slice(0, 12);
  cachedMachineId = formatMachineId(hash);
  return cachedMachineId;
}

/**
 * For testing/benchmarking: resets internal cached machine ID
 */
export function _resetMachineIdCache(): void {
  cachedMachineId = null;
}
