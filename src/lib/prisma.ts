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

export function checkDbReachable(): Promise<boolean> {
  return Promise.resolve(Boolean(process.env.DATABASE_URL));
}

export async function ensureDbOnline(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    const err: any = new Error("Database URL not configured");
    err.code = "P1001";
    throw err;
  }
}

export default prisma;

