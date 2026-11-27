import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

export function isDesktopOffline(): boolean {
  return process.env.DESKTOP_MODE === "true" || process.env.ACCOUNTS360_DESKTOP === "true";
}

function createOfflinePrismaProxy(): PrismaClient {
  const rejectOffline = () => {
    const err: any = new Error("Offline desktop mode active");
    err.code = "P1001";
    return Promise.reject(err);
  };
  const modelProxy = new Proxy(
    {},
    {
      get: () => rejectOffline,
    }
  );
  return new Proxy({} as PrismaClient, {
    get(_target, prop) {
      if (prop === "$connect" || prop === "$disconnect") return () => Promise.resolve();
      if (prop === "$transaction" || prop === "$queryRaw" || prop === "$executeRaw" || prop === "$queryRawUnsafe" || prop === "$executeRawUnsafe") {
        return rejectOffline;
      }
      return modelProxy;
    },
  });
}

export const prisma: PrismaClient = isDesktopOffline()
  ? createOfflinePrismaProxy()
  : (globalThis.prismaGlobal ??
    new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    }));

if (!isDesktopOffline() && process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}

export function checkDbReachable(): Promise<boolean> {
  if (isDesktopOffline()) {
    return Promise.resolve(false);
  }
  return Promise.resolve(Boolean(process.env.DATABASE_URL));
}

export async function ensureDbOnline(): Promise<void> {
  if (isDesktopOffline() || !process.env.DATABASE_URL) {
    const err: any = new Error("Database URL not configured or offline desktop mode active");
    err.code = "P1001";
    throw err;
  }
}

export default prisma;

