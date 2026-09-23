import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var isDbReachableCachedGlobal: boolean | undefined;
  // eslint-disable-next-line no-var
  var dbLastCheckTimeGlobal: number | undefined;
}

const CACHE_TTL_MS = 15000; // Check DB reachability once every 15 seconds

export function checkDbReachable(): Promise<boolean> {
  const now = Date.now();
  if (
    globalThis.isDbReachableCachedGlobal !== undefined &&
    globalThis.dbLastCheckTimeGlobal &&
    now - globalThis.dbLastCheckTimeGlobal < CACHE_TTL_MS
  ) {
    return Promise.resolve(globalThis.isDbReachableCachedGlobal);
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    globalThis.isDbReachableCachedGlobal = false;
    globalThis.dbLastCheckTimeGlobal = now;
    return Promise.resolve(false);
  }

  if (typeof window !== "undefined") {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    try {
      const net = eval("require")("net");
      const url = new URL(dbUrl);
      const host = url.hostname || "127.0.0.1";
      const port = parseInt(url.port || "5432", 10);

      const socket = new net.Socket();
      socket.setTimeout(60); // 60ms fast probe

      socket.on("connect", () => {
        globalThis.isDbReachableCachedGlobal = true;
        globalThis.dbLastCheckTimeGlobal = Date.now();
        socket.destroy();
        resolve(true);
      });

      socket.on("timeout", () => {
        globalThis.isDbReachableCachedGlobal = false;
        globalThis.dbLastCheckTimeGlobal = Date.now();
        socket.destroy();
        resolve(false);
      });

      socket.on("error", () => {
        globalThis.isDbReachableCachedGlobal = false;
        globalThis.dbLastCheckTimeGlobal = Date.now();
        socket.destroy();
        resolve(false);
      });

      socket.connect(port, host);
    } catch {
      globalThis.isDbReachableCachedGlobal = false;
      globalThis.dbLastCheckTimeGlobal = now;
      resolve(false);
    }
  });
}

export async function ensureDbOnline() {
  const online = await checkDbReachable();
  if (!online) {
    const err: any = new Error("Can't reach database server at `localhost:5432` (Fast Circuit Breaker: PostgreSQL is offline. Instant fallbackStore active)");
    err.code = "P1001";
    throw err;
  }
}

const rawPrisma =
  globalThis.prismaGlobal ??
  new PrismaClient({
    log: ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = rawPrisma;
}

// Proxied Prisma client with instant circuit breaker
export const prisma: PrismaClient = new Proxy(rawPrisma, {
  get(target: any, prop: string | symbol, receiver: any) {
    const orig = Reflect.get(target, prop, receiver);

    if (prop === "$transaction" || prop === "$queryRaw" || prop === "$executeRaw" || prop === "$connect") {
      return async function (...args: any[]) {
        await ensureDbOnline();
        return orig.apply(target, args);
      };
    }

    if (typeof orig === "object" && orig !== null) {
      return new Proxy(orig, {
        get(modelTarget: any, modelProp: string | symbol, modelReceiver: any) {
          const modelOrig = Reflect.get(modelTarget, modelProp, modelReceiver);
          if (typeof modelOrig === "function") {
            return async function (...args: any[]) {
              await ensureDbOnline();
              return modelOrig.apply(modelTarget, args);
            };
          }
          return modelOrig;
        },
      });
    }

    return orig;
  },
}) as unknown as PrismaClient;

export default prisma;
