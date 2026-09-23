/**
 * Smart Client Cache & Request Deduplication
 * Prevents redundant network calls, deduplicates simultaneous in-flight requests,
 * and caches GET responses for snappy, instant UI responses without server load.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();
const inFlightRequests = new Map<string, Promise<any>>();

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
 * @param urlPrefix Optional prefix to invalidate, e.g. '/api/payments'. If omitted, flushes entire cache.
 */
export function invalidateCache(urlPrefix?: string) {
  if (!urlPrefix) {
    memoryCache.clear();
    return;
  }
  for (const key of memoryCache.keys()) {
    if (key.startsWith(urlPrefix)) {
      memoryCache.delete(key);
    }
  }
}
