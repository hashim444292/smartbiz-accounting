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
    // Enforce owner-only (0600) permissions on file creation
    fs.writeFileSync(tempFile, JSON.stringify(obj), { encoding: "utf-8", mode: 0o600 });
    fs.renameSync(tempFile, PERSISTENCE_FILE);
    try {
      fs.chmodSync(PERSISTENCE_FILE, 0o600);
    } catch {}
  } catch (err: any) {
    // Non-blocking fallback to in-memory store if disk write fails
    console.warn("rateLimit disk sync warning:", err?.message || err);
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
  // 1. In production, Nginx reverse proxy overwrites X-Real-IP with $remote_addr.
  // Because smartbiz-app binds strictly to 127.0.0.1, external clients cannot bypass Nginx.
  // X-Real-IP is unconditionally trustworthy as the true socket IP from Nginx.
  const xRealIp = req.headers.get("x-real-ip");
  if (xRealIp && xRealIp.trim()) {
    return xRealIp.trim();
  }

  // 2. Cloudflare Connecting IP (when deployed behind Cloudflare)
  const cfConnectingIp = req.headers.get("cf-connecting-ip");
  if (cfConnectingIp && cfConnectingIp.trim()) {
    return cfConnectingIp.trim();
  }

  // 3. Fallback: Rightmost entry of X-Forwarded-For if X-Real-IP is absent
  // (Leftmost is client-controlled; rightmost is appended by the nearest trusted reverse proxy)
  const xForwardedFor = req.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const ips = xForwardedFor.split(",").map((ip) => ip.trim()).filter(Boolean);
    if (ips.length > 0) return ips[ips.length - 1];
  }

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

  // Reload disk for multi-process freshness and merge to prevent cross-key erasure
  try {
    const disk = loadPersistedState();
    for (const [k, v] of disk.entries()) {
      const existing = memoryStore.get(k);
      if (!existing || v.lastAttempt > existing.lastAttempt || (v.blockedUntil && !existing.blockedUntil)) {
        memoryStore.set(k, v);
      }
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
