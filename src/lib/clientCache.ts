import { useEffect, useRef } from "react";

/**
 * Smart Client Cache & Real-Time Sync Bus
 * Prevents redundant network calls, deduplicates simultaneous in-flight requests,
 * and broadcasts mutations across components and browser tabs for instant, auto-updating accounting data.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();
const inFlightRequests = new Map<string, Promise<any>>();

// Cross-tab synchronization BroadcastChannel and Storage listener
let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
  try {
    broadcastChannel = new BroadcastChannel("sb_accounting_sync");
    broadcastChannel.onmessage = (event) => {
      if (event.data?.type === "INVALIDATE_CACHE") {
        clearLocalCache(event.data?.prefix);
        window.dispatchEvent(
          new CustomEvent("sb_data_updated", { detail: event.data })
        );
      }
    };
  } catch {}
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === "sb_last_mutation_timestamp") {
      clearLocalCache();
      window.dispatchEvent(
        new CustomEvent("sb_data_updated", { detail: { timestamp: Number(e.newValue) } })
      );
    }
  });
}

function clearLocalCache(urlPrefix?: string) {
  if (!urlPrefix) {
    memoryCache.clear();
    return;
  }
  const cleanPrefix = urlPrefix.trim();
  for (const key of memoryCache.keys()) {
    const urlPart = key.split("|")[0];
    if (
      key.startsWith(cleanPrefix) ||
      urlPart.startsWith(cleanPrefix) ||
      urlPart.includes(cleanPrefix)
    ) {
      memoryCache.delete(key);
    }
  }
}

export interface SmartFetchOptions extends RequestInit {
  ttlMs?: number; // Time-to-live in ms, default 20000 (20s)
  skipCache?: boolean; // Force fresh network fetch
}

/**
 * Smart cached fetch:
 * 1. Returns cached response if within TTL
 * 2. Deduplicates concurrent in-flight requests for identical URL & context headers
 * 3. Only caches successful responses
 */
export async function smartFetch<T = any>(
  url: string,
  options: SmartFetchOptions = {}
): Promise<T> {
  const { ttlMs = 20000, skipCache = false, ...fetchOptions } = options;

  // Only GET requests are cached
  const method = (fetchOptions.method || "GET").toUpperCase();
  if (method !== "GET" || skipCache || ttlMs <= 0) {
    const res = await fetch(url, fetchOptions);
    return res.json();
  }

  // Build a unique cache key including headers like x-business-id and x-branch-id
  const headers = (fetchOptions.headers || {}) as Record<string, string>;
  const businessId = headers["x-business-id"] || "";
  const branchId = headers["x-branch-id"] || "";
  const cacheKey = `${url}|b:${businessId}|br:${branchId}`;

  const now = Date.now();
  const cached = memoryCache.get(cacheKey);
  if (cached && now - cached.timestamp < ttlMs) {
    return cached.data;
  }

  // Deduplicate in-flight requests
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey);
  }

  const fetchPromise = (async () => {
    try {
      const res = await fetch(url, fetchOptions);
      const json = await res.json();
      if (json && json.success !== false) {
        memoryCache.set(cacheKey, { data: json, timestamp: Date.now() });
      }
      return json;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}

/**
 * Invalidate cached endpoints (e.g. after creating, updating, or deleting records)
 * and broadcast the event to current page, mounted layouts, and all open browser tabs.
 * @param urlPrefix Optional prefix to invalidate, e.g. '/api/payments'. If omitted, flushes entire cache.
 */
export function invalidateCache(urlPrefix?: string) {
  clearLocalCache(urlPrefix);

  if (typeof window !== "undefined") {
    // 1. Notify components in current tab
    window.dispatchEvent(
      new CustomEvent("sb_data_updated", {
        detail: { prefix: urlPrefix, timestamp: Date.now() },
      })
    );

    // 2. Broadcast to other open tabs via BroadcastChannel
    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage({
          type: "INVALIDATE_CACHE",
          prefix: urlPrefix,
          timestamp: Date.now(),
        });
      } catch {}
    }

    // 3. Fallback broadcast to other open tabs via localStorage storage event
    try {
      localStorage.setItem("sb_last_mutation_timestamp", Date.now().toString());
    } catch {}
  }
}

export type AutoSyncCallback = (options?: { silent?: boolean }) => void | Promise<void>;

/**
 * React hook to auto-sync component data:
 * - Immediately re-fetches when any accounting data mutation occurs (locally or in other tabs)
 * - Revalidates silently when user returns to this browser tab (guarded by 15s threshold to prevent jitter)
 * - Runs a gentle background heartbeat (every 60s when visible) with zero UI flicker
 */
export function useAutoSync(onSync: AutoSyncCallback, enabled: boolean = true) {
  const syncRef = useRef(onSync);
  syncRef.current = onSync;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let isThrottled = false;
    let lastSyncTime = Date.now();

    const trigger = (isSilent = true) => {
      if (isThrottled) return;
      isThrottled = true;
      setTimeout(() => {
        isThrottled = false;
      }, 400);
      lastSyncTime = Date.now();
      syncRef.current({ silent: isSilent });
    };

    // 1. Listen for internal and cross-tab data update events (instant silent sync)
    const handleDataUpdate = () => trigger(true);
    window.addEventListener("sb_data_updated", handleDataUpdate);

    // 2. Revalidate when tab becomes visible (only if 15s elapsed since last sync to avoid focus jitter)
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && Date.now() - lastSyncTime > 15000) {
        trigger(true);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // 3. Gentle background polling every 60s when visible
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        trigger(true);
      }
    }, 60000);

    return () => {
      window.removeEventListener("sb_data_updated", handleDataUpdate);
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(interval);
    };
  }, [enabled]);
}
