/**
 * SmartBiz Accounting - Enterprise Offline Storage & Auto-Sync Engine
 * Provides client-side resilience against network loss, database timeouts, and connectivity issues.
 * Stores pending mutations in localStorage and replays them automatically upon reconnection.
 */

export interface OfflineAction {
  id: string;
  endpoint: string;
  method: string;
  headers?: Record<string, string>;
  body: any;
  actionName: string;
  businessId?: string;
  timestamp: number;
  retryCount: number;
  status: "PENDING" | "SYNCING" | "FAILED";
  errorMessage?: string;
}

const STORAGE_KEY = "smartbiz_offline_mutation_queue_v1";

/**
 * Retrieves all pending offline actions from localStorage.
 */
export function getOfflineQueue(): OfflineAction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list: OfflineAction[] = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/**
 * Saves the offline actions list to localStorage and emits an update event.
 */
function setOfflineQueue(queue: OfflineAction[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    window.dispatchEvent(
      new CustomEvent("smartbiz_offline_queue_changed", {
        detail: { count: queue.length, queue },
      })
    );
  } catch (err) {
    console.error("Failed to persist offline queue:", err);
  }
}

/**
 * Adds a new mutation to the offline queue.
 */
export function enqueueOfflineAction(
  action: Omit<OfflineAction, "id" | "timestamp" | "retryCount" | "status">
): OfflineAction {
  const newAction: OfflineAction = {
    ...action,
    id: `off-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    timestamp: Date.now(),
    retryCount: 0,
    status: "PENDING",
  };

  const queue = getOfflineQueue();
  queue.push(newAction);
  setOfflineQueue(queue);

  return newAction;
}

/**
 * Removes a specific action from the offline queue after successful sync.
 */
export function removeOfflineAction(id: string): void {
  const queue = getOfflineQueue().filter((item) => item.id !== id);
  setOfflineQueue(queue);
}

/**
 * Clears the entire offline queue.
 */
export function clearOfflineQueue(): void {
  setOfflineQueue([]);
}

/**
 * Executes a network fetch with automatic offline fallback.
 * If internet drops, database is unreachable, or server fails, the action is safely queued locally.
 */
export async function safeOfflineSubmit(params: {
  endpoint: string;
  method?: string;
  body: any;
  headers?: Record<string, string>;
  actionName: string;
  businessId?: string;
}): Promise<{ success: boolean; data?: any; offline?: boolean; error?: string; message?: string }> {
  const { endpoint, method = "POST", body, headers = {}, actionName, businessId } = params;

  // 1. If browser is explicitly offline, save to queue immediately
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    const queued = enqueueOfflineAction({
      endpoint,
      method,
      body,
      headers,
      actionName,
      businessId,
    });
    return {
      success: true,
      offline: true,
      data: { id: queued.id, offline: true },
      message: `Offline mode active: "${actionName}" has been safely saved locally. It will automatically synchronize when your internet connection is restored.`,
    };
  }

  // 2. Attempt normal live API fetch
  try {
    const res = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    });

    // If server responds with gateway error / down (502, 503, 504), treat as offline recoverable
    if ([502, 503, 504].includes(res.status)) {
      const queued = enqueueOfflineAction({
        endpoint,
        method,
        body,
        headers,
        actionName,
        businessId,
      });
      return {
        success: true,
        offline: true,
        data: { id: queued.id, offline: true },
        message: `Server temporary connection drop: "${actionName}" saved to offline buffer. It will automatically drive to server as soon as connection stabilizes.`,
      };
    }

    const json = await res.json();
    return json;
  } catch (networkErr: any) {
    // 3. Network failure / DNS failure / Timeout
    const queued = enqueueOfflineAction({
      endpoint,
      method,
      body,
      headers,
      actionName,
      businessId,
    });

    return {
      success: true,
      offline: true,
      data: { id: queued.id, offline: true },
      message: `Connection error: "${actionName}" has been safely captured in offline storage. Data will sync automatically when back online.`,
    };
  }
}

/**
 * Replays all queued offline actions to their respective server endpoints in chronological sequence.
 */
export async function syncOfflineQueue(
  onProgress?: (synced: number, total: number) => void
): Promise<{ success: boolean; syncedCount: number; errors: any[] }> {
  if (typeof window === "undefined" || !navigator.onLine) {
    return { success: false, syncedCount: 0, errors: ["System is currently offline"] };
  }

  const queue = getOfflineQueue();
  if (queue.length === 0) {
    return { success: true, syncedCount: 0, errors: [] };
  }

  let syncedCount = 0;
  const errors: any[] = [];
  const total = queue.length;

  for (const action of queue) {
    try {
      const res = await fetch(action.endpoint, {
        method: action.method || "POST",
        headers: {
          "Content-Type": "application/json",
          ...(action.headers || {}),
        },
        body: JSON.stringify(action.body),
      });

      if (res.ok) {
        removeOfflineAction(action.id);
        syncedCount++;
        if (onProgress) onProgress(syncedCount, total);
      } else {
        const errJson = await res.json().catch(() => ({}));
        // If 400 validation error, record error but remove to avoid infinite loop
        if (res.status === 400) {
          removeOfflineAction(action.id);
          errors.push({ id: action.id, actionName: action.actionName, error: errJson.error || "Validation error" });
        } else {
          // Keep in queue for next retry if server error
          errors.push({ id: action.id, actionName: action.actionName, error: errJson.error || res.statusText });
        }
      }
    } catch (err: any) {
      // Still offline or request failed
      errors.push({ id: action.id, actionName: action.actionName, error: err.message || "Network error during sync" });
      break; // Pause syncing until network stabilizes
    }
  }

  if (syncedCount > 0 && typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("smartbiz_offline_sync_completed", {
        detail: { syncedCount, errors },
      })
    );
  }

  return { success: errors.length === 0, syncedCount, errors };
}
