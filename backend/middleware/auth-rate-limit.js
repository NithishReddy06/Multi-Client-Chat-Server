const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const buckets = new Map();

export function authRateLimit(request, response, next) {
  const now = Date.now();
  const key = `${request.path}:${request.ip}`;
  let bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, bucket);
  }
  bucket.count += 1;

  if (buckets.size > 10_000) {
    for (const [bucketKey, entry] of buckets) {
      if (entry.resetAt <= now) buckets.delete(bucketKey);
    }
    if (buckets.size > 10_000) {
      buckets.delete(buckets.keys().next().value);
    }
  }

  response.set("RateLimit-Limit", String(MAX_ATTEMPTS));
  response.set("RateLimit-Remaining", String(Math.max(0, MAX_ATTEMPTS - bucket.count)));
  response.set("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));
  if (bucket.count > MAX_ATTEMPTS) {
    response.status(429).json({ error: "Too many authentication attempts. Try again later.", code: "RATE_LIMITED" });
    return;
  }
  next();
}
