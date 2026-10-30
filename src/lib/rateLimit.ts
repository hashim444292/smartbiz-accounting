import fs from "fs";
import path from "path";
import os from "os";
import { NextRequest } from "next/server";

export interface RateLimitEntry {
  count: number;
  firstAttempt: number;
  lastAttempt: number;
  blockedUntil?: number;
}

export const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const LOGIN_MAX_ATTEMPTS = 5; // 5 attempts per window
export const LOGIN_BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes block

const PERSISTENCE_FILE = path.join(os.tmpdir(), "sb_login_rate_limits.json");

// In-memory sliding window cache for low latency
const memoryStore = new Map<string, RateLimitEntry>();

function loadPersistedState(): Map<string, RateLimitEntry> {
  try {
    if (fs.existsSync(PERSISTENCE_FILE)) {
      const data = fs.readFileSync(PERSISTENCE_FILE, "utf-8");
      const obj = JSON.parse(data);
      const map = new Map<string, RateLimitEntry>();
      const now = Date.now();
      for (const [key, val] of Object.entries(obj)) {
        const entry = val as RateLimitEntry;
        // Keep unexpired or blocked entries
        if ((entry.blockedUntil && entry.blockedUntil > now) || (now - entry.lastAttempt < LOGIN_WINDOW_MS)) {
          map.set(key, entry);
        }
      }
      return map;
    }
  } catch {
    // Non-blocking fallback to memoryStore
  }
  return new Map<string, RateLimitEntry>();
}

function savePersistedState(map: Map<string, RateLimitEntry>) {
  try {
    const obj: Record<string, RateLimitEntry> = {};
    const now = Date.now();
    for (const [k, v] of map.entries()) {
      if ((v.blockedUntil && v.blockedUntil > now) || (now - v.lastAttempt < LOGIN_WINDOW_MS)) {
        obj[k] = v;
      }
    }
    const tempFile = `${PERSISTENCE_FILE}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 6)}`;
    fs.writeFileSync(tempFile, JSON.stringify(obj), "utf-8");
    fs.renameSync(tempFile, PERSISTENCE_FILE);
  } catch {
    // Non-blocking
  }
}

// Initialize memoryStore from disk if available
try {
  const loaded = loadPersistedState();
  for (const [k, v] of loaded.entries()) {
    memoryStore.set(k, v);
  }
} catch {}

export function getClientIp(req: NextRequest): string {
  const xForwardedFor = req.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const ips = xForwardedFor.split(",").map((ip) => ip.trim());
    if (ips[0]) return ips[0];
  }
  const xRealIp = req.headers.get("x-real-ip");
  if (xRealIp) return xRealIp.trim();
  const cfConnectingIp = req.headers.get("cf-connecting-ip");
  if (cfConnectingIp) return cfConnectingIp.trim();
  return (req as any).ip || "127.0.0.1";
}

export interface RateLimitCheckResult {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSeconds?: number;
}

export function checkLoginRateLimit(key: string): RateLimitCheckResult {
  const now = Date.now();

  // Sync latest from file if exists (for multi-process consistency)
  try {
    const disk = loadPersistedState();
    if (disk.has(key)) {
      memoryStore.set(key, disk.get(key)!);
    }
  } catch {}

  const entry = memoryStore.get(key);

  if (!entry) {
    return { allowed: true, remainingAttempts: LOGIN_MAX_ATTEMPTS };
  }

  // Check if currently blocked
  if (entry.blockedUntil && entry.blockedUntil > now) {
    const retryAfterSeconds = Math.ceil((entry.blockedUntil - now) / 1000);
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds,
    };
  }

  // Check if previous window expired
  if (now - entry.firstAttempt > LOGIN_WINDOW_MS) {
    memoryStore.delete(key);
    return { allowed: true, remainingAttempts: LOGIN_MAX_ATTEMPTS };
  }

  if (entry.count >= LOGIN_MAX_ATTEMPTS) {
    const retryAfterSeconds = Math.ceil((entry.firstAttempt + LOGIN_WINDOW_MS - now) / 1000);
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds: Math.max(1, retryAfterSeconds),
    };
  }

  return {
    allowed: true,
    remainingAttempts: Math.max(0, LOGIN_MAX_ATTEMPTS - entry.count),
  };
}

export function recordFailedLogin(key: string): RateLimitCheckResult {
  const now = Date.now();

  // Reload disk for multi-process freshness
  try {
    const disk = loadPersistedState();
    if (disk.has(key)) {
      memoryStore.set(key, disk.get(key)!);
    }
  } catch {}

  let entry = memoryStore.get(key);

  if (!entry || now - entry.firstAttempt > LOGIN_WINDOW_MS) {
    entry = {
      count: 1,
      firstAttempt: now,
      lastAttempt: now,
    };
  } else {
    entry.count += 1;
    entry.lastAttempt = now;
    if (entry.count >= LOGIN_MAX_ATTEMPTS) {
      entry.blockedUntil = now + LOGIN_BLOCK_DURATION_MS;
    }
  }

  memoryStore.set(key, entry);
  savePersistedState(memoryStore);

  const blocked = Boolean(entry.blockedUntil && entry.blockedUntil > now);
  const retryAfterSeconds = blocked ? Math.ceil((entry.blockedUntil! - now) / 1000) : undefined;

  return {
    allowed: !blocked,
    remainingAttempts: Math.max(0, LOGIN_MAX_ATTEMPTS - entry.count),
    retryAfterSeconds,
  };
}

export function resetLoginRateLimit(key: string) {
  memoryStore.delete(key);
  try {
    const disk = loadPersistedState();
    if (disk.has(key)) {
      disk.delete(key);
      savePersistedState(disk);
    }
  } catch {}
}
