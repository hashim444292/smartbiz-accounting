import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

export const prisma =
  globalThis.prismaGlobal ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}

export function isDesktopOffline(): boolean {
  return process.env.DESKTOP_MODE === "true" || process.env.ACCOUNTS360_DESKTOP === "true";
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

