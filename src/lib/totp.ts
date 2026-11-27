import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export interface TwoFactorConfig {
  enabled: boolean;
  secret: string;
  updatedAt: string;
}

// In-memory fallback store for offline / test environments when DB is unreachable
const memoryTwoFactorStore = new Map<string, TwoFactorConfig>();

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

export function generateTotpSecret(byteLength = 20): string {
  return base32Encode(crypto.randomBytes(byteLength));
}

export function generateOtpAuthUri(
  secret: string,
  accountEmail: string,
  issuer = "Accounts360"
): string {
  const label = encodeURIComponent(`${issuer}:${accountEmail}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

export function generateTotpCode(
  secret: string,
  timestampMs = Date.now(),
  stepSeconds = 30,
  digits = 6
): string {
  const key = base32Decode(secret);
  const counter = Math.floor(timestampMs / 1000 / stepSeconds);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuf.writeUInt32BE(counter >>> 0, 4);

  const hmac = crypto.createHmac("sha1", key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % 10 ** digits;
  return String(otp).padStart(digits, "0");
}

export function verifyTotpCode(
  secret: string,
  code: string,
  window = 1,
  timestampMs = Date.now()
): boolean {
  const cleanCode = String(code || "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(cleanCode) || !secret) {
    return false;
  }

  const codeBuf = Buffer.from(cleanCode, "utf8");
  for (let offset = -window; offset <= window; offset++) {
    const candidate = generateTotpCode(secret, timestampMs + offset * 30_000);
    const candidateBuf = Buffer.from(candidate, "utf8");
    if (
      candidateBuf.length === codeBuf.length &&
      crypto.timingSafeEqual(candidateBuf, codeBuf)
    ) {
      return true;
    }
  }

  return false;
}

function settingKeyForUser(userId: string): string {
  return `user_2fa_${userId}`;
}

export async function getUserTwoFactorConfig(
  userId: string
): Promise<TwoFactorConfig | null> {
  if (!userId) return null;
  const key = settingKeyForUser(userId);

  if (process.env.DATABASE_URL) {
    try {
      const record = await prisma.appSetting.findFirst({
        where: { key },
      });
      if (record?.value) {
        return JSON.parse(record.value) as TwoFactorConfig;
      }
    } catch {
      // Fallback to memory store if DB is offline
    }
  }

  return memoryTwoFactorStore.get(userId) || null;
}

export async function saveUserTwoFactorConfig(
  userId: string,
  businessId: string | undefined,
  config: TwoFactorConfig
): Promise<void> {
  const key = settingKeyForUser(userId);
  memoryTwoFactorStore.set(userId, config);

  if (process.env.DATABASE_URL) {
    try {
      let targetBizId = businessId;
      if (!targetBizId) {
        const firstBiz = await prisma.business.findFirst({
          select: { id: true },
          orderBy: { createdAt: "asc" },
        });
        targetBizId = firstBiz?.id;
      }
      if (!targetBizId) return;

      const existing = await prisma.appSetting.findFirst({ where: { key } });
      if (existing) {
        await prisma.appSetting.update({
          where: { id: existing.id },
          data: { value: JSON.stringify(config) },
        });
      } else {
        await prisma.appSetting.create({
          data: {
            businessId: targetBizId,
            key,
            value: JSON.stringify(config),
          },
        });
      }
    } catch {
      // Keep memory store updated in offline/test mode
    }
  }
}

export async function clearUserTwoFactorConfig(userId: string): Promise<void> {
  const key = settingKeyForUser(userId);
  memoryTwoFactorStore.delete(userId);

  if (process.env.DATABASE_URL) {
    try {
      await prisma.appSetting.deleteMany({
        where: { key },
      });
    } catch {
      // Ignore in offline/test mode
    }
  }
}
