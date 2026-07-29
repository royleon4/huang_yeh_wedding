function recordFromRow(row) {
  if (!row) return null;
  return {
    count: Number(row.failure_count),
    resetAt: new Date(row.reset_at).getTime(),
  };
}

export function assertSharedLoginFailureConfiguration(env = process.env) {
  if (env.REPLIT_DEPLOYMENT === "1" && !env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is required for shared administrator login limits in Autoscale",
    );
  }
}

export class MemoryLoginFailureStore {
  #failures = new Map();
  #maxTrackedClients;

  constructor({ maxTrackedClients = 1_000 } = {}) {
    this.#maxTrackedClients = maxTrackedClients;
  }

  async claim(key, timestamp, failureWindowMs) {
    const stored = this.#failures.get(key);
    const current = stored && timestamp < stored.resetAt ? stored : null;
    const record = {
      count: (current?.count ?? 0) + 1,
      resetAt: current?.resetAt ?? timestamp + failureWindowMs,
    };
    this.#failures.set(key, record);
    if (this.#failures.size > this.#maxTrackedClients) {
      for (const [trackedKey, trackedRecord] of this.#failures) {
        if (timestamp >= trackedRecord.resetAt || trackedKey !== key) {
          this.#failures.delete(trackedKey);
          if (this.#failures.size <= this.#maxTrackedClients) break;
        }
      }
    }
    return { ...record };
  }

  async clear(key) {
    this.#failures.delete(key);
  }
}

export class PostgresLoginFailureStore {
  constructor(pool) {
    if (!pool?.query) throw new Error("A PostgreSQL pool is required");
    this.pool = pool;
  }

  async claim(key, timestamp, failureWindowMs) {
    const now = new Date(timestamp).toISOString();
    const resetAt = new Date(timestamp + failureWindowMs).toISOString();
    await this.pool.query(
      `DELETE FROM memories_admin_login_failures WHERE reset_at <= $1`,
      [now],
    );
    const result = await this.pool.query(
      `INSERT INTO memories_admin_login_failures (
         client_key_hash, failure_count, reset_at, updated_at
       ) VALUES ($1, 1, $2, $3)
       ON CONFLICT (client_key_hash) DO UPDATE SET
         failure_count = CASE
           WHEN memories_admin_login_failures.reset_at <= $3 THEN 1
           ELSE memories_admin_login_failures.failure_count + 1
         END,
         reset_at = CASE
           WHEN memories_admin_login_failures.reset_at <= $3 THEN $2
           ELSE memories_admin_login_failures.reset_at
         END,
         updated_at = $3
       RETURNING failure_count, reset_at`,
      [key, resetAt, now],
    );
    return recordFromRow(result.rows[0]);
  }

  async clear(key) {
    await this.pool.query(
      `DELETE FROM memories_admin_login_failures WHERE client_key_hash = $1`,
      [key],
    );
  }
}
