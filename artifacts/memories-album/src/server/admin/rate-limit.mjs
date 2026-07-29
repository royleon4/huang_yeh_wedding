function clientAddress(request) {
  const forwarded = request.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",", 1)[0].trim();
  }
  return request.socket?.remoteAddress ?? "unknown";
}

export function createFixedWindowRateLimiter({
  limit,
  windowMs,
  now = Date.now,
  key = clientAddress,
  maxEntries = 10_000,
}) {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("Rate limit must be a positive integer");
  }
  if (!Number.isFinite(windowMs) || windowMs < 1) {
    throw new Error("Rate limit window must be positive");
  }

  const windows = new Map();
  return {
    consume(request) {
      const identifier = key(request);
      const timestamp = now();
      const current = windows.get(identifier);
      const active =
        current && timestamp - current.startedAt < windowMs
          ? current
          : { startedAt: timestamp, count: 0 };

      if (active.count >= limit) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((active.startedAt + windowMs - timestamp) / 1000),
          ),
        };
      }

      active.count += 1;
      active.lastSeenAt = timestamp;
      windows.set(identifier, active);
      if (windows.size > maxEntries) {
        for (const [entryKey, entry] of windows) {
          if (timestamp - entry.startedAt >= windowMs) windows.delete(entryKey);
        }
      }
      if (windows.size > maxEntries) {
        const oldest = [...windows.entries()].sort(
          (left, right) =>
            (left[1].lastSeenAt ?? left[1].startedAt) -
            (right[1].lastSeenAt ?? right[1].startedAt),
        );
        for (const [entryKey] of oldest.slice(0, windows.size - maxEntries)) {
          windows.delete(entryKey);
        }
      }
      return {
        allowed: true,
        remaining: Math.max(0, limit - active.count),
      };
    },
  };
}
