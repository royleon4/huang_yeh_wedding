import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { createAdminSessionApi } from "../src/server/admin/session-api.mjs";
import { PostgresLoginFailureStore } from "../src/server/admin/login-failure-store.mjs";
import { assertSharedLoginFailureConfiguration } from "../src/server/admin/login-failure-store.mjs";

class FakeLoginFailurePool {
  records = new Map();
  claimBarrier = null;

  synchronizeNextClaims(count) {
    let release;
    const ready = new Promise((resolve) => {
      release = resolve;
    });
    this.claimBarrier = { remaining: count, ready, release };
  }

  async query(sql, params) {
    const normalized = String(sql).replace(/\s+/g, " ").trim();
    if (normalized.startsWith("SELECT failure_count")) {
      const record = this.records.get(params[0]);
      return {
        rows:
          record && new Date(record.reset_at) > new Date(params[1])
            ? [{ ...record }]
            : [],
      };
    }
    if (
      normalized.startsWith(
        "DELETE FROM memories_admin_login_failures WHERE reset_at",
      )
    ) {
      for (const [key, record] of this.records) {
        if (new Date(record.reset_at) <= new Date(params[0])) {
          this.records.delete(key);
        }
      }
      return { rows: [] };
    }
    if (normalized.startsWith("INSERT INTO memories_admin_login_failures")) {
      const barrier = this.claimBarrier;
      if (barrier) {
        barrier.remaining -= 1;
        if (barrier.remaining === 0) {
          this.claimBarrier = null;
          barrier.release();
        }
        await barrier.ready;
      }
      const [key, resetAt, now] = params;
      const current = this.records.get(key);
      const expired = !current || new Date(current.reset_at) <= new Date(now);
      const record = {
        failure_count: expired ? 1 : current.failure_count + 1,
        reset_at: expired ? resetAt : current.reset_at,
      };
      this.records.set(key, record);
      return { rows: [{ ...record }] };
    }
    if (
      normalized.startsWith(
        "DELETE FROM memories_admin_login_failures WHERE client_key_hash",
      )
    ) {
      this.records.delete(params[0]);
      return { rows: [] };
    }
    throw new Error(`Unexpected query: ${normalized}`);
  }
}

test("administrator login failures are rate limited and a successful login clears failures", async () => {
  let timestamp = 1_000;
  const api = createAdminSessionApi({
    adminToken: "correct-password",
    now: () => timestamp,
    maxFailures: 2,
    failureWindowMs: 10_000,
    createNonce: () => "fixed",
  });
  const server = createServer(async (request, response) => {
    if (await api(request, response)) return;
    response.statusCode = 404;
    response.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;

  try {
    const attempt = (password) =>
      fetch(`${origin}/admin/api/session`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${password}`,
          "X-Forwarded-For": "203.0.113.10",
        },
      });

    assert.equal((await attempt("wrong-1")).status, 401);
    assert.equal((await attempt("wrong-2")).status, 401);
    const limited = await attempt("correct-password");
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get("retry-after"), "10");

    timestamp += 10_000;
    assert.equal((await attempt("correct-password")).status, 200);
    assert.equal((await attempt("wrong-again")).status, 401);
    assert.equal((await attempt("correct-password")).status, 200);
    assert.equal((await attempt("wrong-after-clear")).status, 401);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("separate administrator API instances share login failure state", async () => {
  const pool = new FakeLoginFailurePool();
  const options = {
    adminToken: "correct-password",
    now: () => 1_000,
    maxFailures: 2,
    trustProxy: true,
    createNonce: () => "fixed",
  };
  const apis = [
    createAdminSessionApi({
      ...options,
      failureStore: new PostgresLoginFailureStore(pool),
    }),
    createAdminSessionApi({
      ...options,
      failureStore: new PostgresLoginFailureStore(pool),
    }),
  ];
  const server = createServer(async (request, response) => {
    const instance = Number(request.headers["x-test-instance"] ?? 0);
    if (await apis[instance](request, response)) return;
    response.statusCode = 404;
    response.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;

  try {
    const attempt = (password, instance) =>
      fetch(`${origin}/admin/api/session`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${password}`,
          "X-Forwarded-For": "203.0.113.20",
          "X-Test-Instance": String(instance),
        },
      });

    assert.equal((await attempt("wrong-1", 0)).status, 401);
    pool.synchronizeNextClaims(2);
    const concurrent = await Promise.all([
      attempt("wrong-2", 0),
      attempt("wrong-3", 1),
    ]);
    assert.deepEqual(
      concurrent.map((response) => response.status).sort(),
      [401, 429],
    );
    assert.equal((await attempt("correct-password", 0)).status, 429);
    assert.equal(
      [...pool.records.keys()].every((key) => /^[a-f0-9]{64}$/.test(key)),
      true,
    );
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("an Autoscale server cannot silently fall back to process-local limits", () => {
  assert.throws(
    () =>
      assertSharedLoginFailureConfiguration({
        REPLIT_DEPLOYMENT: "1",
      }),
    /DATABASE_URL/,
  );
  assert.doesNotThrow(() =>
    assertSharedLoginFailureConfiguration({
      REPLIT_DEPLOYMENT: "1",
      DATABASE_URL: "postgres://shared/memories",
    }),
  );
  assert.doesNotThrow(() => assertSharedLoginFailureConfiguration({}));
});

test("trusted proxy addresses isolate login limits between clients", async () => {
  const api = createAdminSessionApi({
    adminToken: "correct-password",
    now: () => 1_000,
    maxFailures: 2,
    trustProxy: true,
    createNonce: () => "fixed",
  });
  const server = createServer(async (request, response) => {
    if (await api(request, response)) return;
    response.statusCode = 404;
    response.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;

  try {
    const attempt = (password, clientAddress) =>
      fetch(`${origin}/admin/api/session`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${password}`,
          "X-Forwarded-For": clientAddress,
        },
      });

    assert.equal((await attempt("wrong-1", "203.0.113.10")).status, 401);
    assert.equal((await attempt("wrong-2", "203.0.113.10")).status, 401);
    assert.equal(
      (await attempt("correct-password", "203.0.113.10")).status,
      429,
    );
    assert.equal(
      (await attempt("correct-password", "203.0.113.11")).status,
      200,
    );
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
