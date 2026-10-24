import { prisma } from "@/lib/db/client";
import { rateLimited } from "@/lib/errors";

interface Bucket {
  count: number;
  resetAt: Date;
}

/**
 * Fixed-window rate limiter backed by Postgres, so it works on serverless and across instances.
 * A single atomic upsert either starts a new window or increments the current one.
 */
export async function hitRateLimit(key: string, limit: number, windowSec: number) {
  const rows = await prisma.$queryRaw<Bucket[]>`
    INSERT INTO rate_limit_buckets ("key", "count", "resetAt", "updatedAt")
    VALUES (${key}, 1, now() + make_interval(secs => ${windowSec}::double precision), now())
    ON CONFLICT ("key") DO UPDATE SET
      "count"   = CASE WHEN rate_limit_buckets."resetAt" <= now() THEN 1 ELSE rate_limit_buckets."count" + 1 END,
      "resetAt" = CASE WHEN rate_limit_buckets."resetAt" <= now()
                       THEN now() + make_interval(secs => ${windowSec}::double precision)
                       ELSE rate_limit_buckets."resetAt" END,
      "updatedAt" = now()
    RETURNING "count", "resetAt"`;
  const row = rows[0];
  if (!row) throw new Error("Rate limiter returned no row");
  const retryAfterSec = Math.max(1, Math.ceil((row.resetAt.getTime() - Date.now()) / 1000));
  return { allowed: row.count <= limit, retryAfterSec };
}

/** Throws a friendly RATE_LIMITED AppError when the key is over its limit. */
export async function enforceRateLimit(key: string, limit: number, windowSec: number): Promise<void> {
  const { allowed, retryAfterSec } = await hitRateLimit(key, limit, windowSec);
  if (!allowed) throw rateLimited(retryAfterSec);
}

/** Housekeeping: called from the daily job (Phase 7). */
export async function pruneRateLimitBuckets(): Promise<number> {
  const { count } = await prisma.rateLimitBucket.deleteMany({ where: { resetAt: { lt: new Date() } } });
  return count;
}
