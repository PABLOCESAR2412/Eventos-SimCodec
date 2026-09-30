type Scope = "catalog" | "login";
const limits = {
  catalog: { max: 60, window: 60_000 },
  login: { max: 5, window: 900_000 },
} as const;
// Per-instance memory: protects the database from request-driven writes;
// distributed floods are the CDN/platform's job, not the database's.
const buckets = new Map<string, { count: number; resetAt: number }>();
export function consumeRate(clientAddress: string, scope: Scope) {
  const now = Date.now();
  if (buckets.size > 10_000)
    for (const [key, bucket] of buckets)
      if (bucket.resetAt <= now) buckets.delete(key);
  const key = scope + ":" + clientAddress;
  const bucket = buckets.get(key);
  if (bucket && bucket.resetAt > now) {
    if (bucket.count >= limits[scope].max)
      return Promise.resolve({
        allowed: false,
        retryAfter: Math.ceil((bucket.resetAt - now) / 1000),
      });
    bucket.count++;
    return Promise.resolve({ allowed: true, retryAfter: 0 });
  }
  buckets.set(key, { count: 1, resetAt: now + limits[scope].window });
  return Promise.resolve({ allowed: true, retryAfter: 0 });
}
