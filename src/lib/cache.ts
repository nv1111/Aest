import { db } from "@/lib/db";

/**
 * Deterministic-computation cache (DB-backed, survives restarts).
 * Astrology payloads are pure functions of their inputs, so we cache
 * aggressively with input-derived keys (AGENTS.md §Performance).
 */

const memory = new Map<string, { value: unknown; expires: number }>();

export async function cached<T>(key: string, ttlMs: number, compute: () => T): Promise<T> {
  const now = Date.now();

  const mem = memory.get(key);
  if (mem && mem.expires > now) {
    return mem.value as T;
  }

  try {
    const row = await db.astrologyCache.findUnique({ where: { cacheKey: key } });
    if (row && row.expiresAt.getTime() > now) {
      const value = JSON.parse(row.payloadJson) as T;
      memory.set(key, { value, expires: row.expiresAt.getTime() });
      return value;
    }
  } catch {
    // cache read failure is never fatal
  }

  const value = compute();
  const expires = now + ttlMs;

  memory.set(key, { value, expires });

  try {
    await db.astrologyCache.upsert({
      where: { cacheKey: key },
      update: { payloadJson: JSON.stringify(value), expiresAt: new Date(expires) },
      create: { cacheKey: key, payloadJson: JSON.stringify(value), expiresAt: new Date(expires) },
    });
  } catch {
    // cache write failure is never fatal
  }

  return value;
}
