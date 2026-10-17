/**
 * Fixed-window, in-memory rate limiter keyed by client IP.
 * Fine for a single process; use shared storage (e.g. MongoDB) when running several instances.
 */
export function rateLimit({ limit, windowMs = 60_000 }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip ?? "unknown";
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
    } else {
      entry.count += 1;
    }
    const { count, resetAt } = hits.get(key);
    res.set("RateLimit", `limit=${limit}, remaining=${Math.max(0, limit - count)}, reset=${Math.ceil((resetAt - now) / 1000)}`);
    if (count > limit) return res.status(429).json({ error: "Too many requests. Please wait a moment and try again." });
    if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    next();
  };
}
