import assert from "node:assert/strict";
import test from "node:test";
import { createAdminSessionApi } from "../src/server/admin/session-api.mjs";
import {
  assertSharedLoginFailureConfiguration,
  PostgresLoginFailureStore,
} from "../src/server/admin/login-failure-store.mjs";
import { withRequestHandler } from "../test-support/http.mjs";

const ADMIN_TOKEN = "correct-password";

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

function createLoginAttempt(
  origin,
  { clientAddress = "203.0.113.10", instance } = {},
) {
  return (password) => {
    const headers = {
      Authorization: `Bearer ${password}`,
      "X-Forwarded-For": clientAddress,
    };
    if (instance !== undefined) {
      headers["X-Test-Instance"] = String(instance);
    }

    return fetch(`${origin}/admin/api/session`, {
      method: "POST",
      headers,
    });
  };
}

function sessionApi(options = {}) {
  return createAdminSessionApi({
    adminToken: ADMIN_TOKEN,
    createNonce: () => "fixed",
    ...options,
  });
}

test("login failures are limited and a successful login clears them", async () => {
  let timestamp = 1_000;
  const api = sessionApi({
    now: () => timestamp,
    maxFailures: 2,
    failureWindowMs: 10_000,
  });

  await withRequestHandler(api, async (origin) => {
    const attempt = createLoginAttempt(origin);

    assert.equal((await attempt("wrong-1")).status, 401);
    assert.equal((await attempt("wrong-2")).status, 401);

    const limited = await attempt(ADMIN_TOKEN);
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get("retry-after"), "10");

    timestamp += 10_000;
    assert.equal((await attempt(ADMIN_TOKEN)).status, 200);
    assert.equal((await attempt("wrong-again")).status, 401);
    assert.equal((await attempt(ADMIN_TOKEN)).status, 200);
    assert.equal((await attempt("wrong-after-clear")).status, 401);
  });
});

test("separate administrator API instances share login failure state", async () => {
  const pool = new FakeLoginFailurePool();
  const options = {
    now: () => 1_000,
    maxFailures: 2,
    trustProxy: true,
  };
  const apis = [
    sessionApi({
      ...options,
      failureStore: new PostgresLoginFailureStore(pool),
    }),
    sessionApi({
      ...options,
      failureStore: new PostgresLoginFailureStore(pool),
    }),
  ];

  await withRequestHandler(
    (request, response) => {
      const instance = Number(request.headers["x-test-instance"] ?? 0);
      return apis[instance](request, response);
    },
    async (origin) => {
      const firstInstance = createLoginAttempt(origin, {
        clientAddress: "203.0.113.20",
        instance: 0,
      });
      const secondInstance = createLoginAttempt(origin, {
        clientAddress: "203.0.113.20",
        instance: 1,
      });

      assert.equal((await firstInstance("wrong-1")).status, 401);
      pool.synchronizeNextClaims(2);
      const concurrent = await Promise.all([
        firstInstance("wrong-2"),
        secondInstance("wrong-3"),
      ]);
      assert.deepEqual(
        concurrent.map((response) => response.status).sort(),
        [401, 429],
      );
      assert.equal((await firstInstance(ADMIN_TOKEN)).status, 429);
      assert.equal(
        [...pool.records.keys()].every((key) => /^[a-f0-9]{64}$/.test(key)),
        true,
      );
    },
  );
});

test("Autoscale requires shared login-failure storage", async (t) => {
  const cases = [
    {
      name: "rejects a deployment without DATABASE_URL",
      env: { REPLIT_DEPLOYMENT: "1" },
      error: /DATABASE_URL/,
    },
    {
      name: "accepts a deployment with DATABASE_URL",
      env: {
        REPLIT_DEPLOYMENT: "1",
        DATABASE_URL: "postgres://shared/memories",
      },
    },
    {
      name: "accepts local development",
      env: {},
    },
  ];

  for (const { name, env, error } of cases) {
    await t.test(name, () => {
      if (error) {
        assert.throws(() => assertSharedLoginFailureConfiguration(env), error);
      } else {
        assert.doesNotThrow(() => assertSharedLoginFailureConfiguration(env));
      }
    });
  }
});

test("trusted proxy addresses isolate login limits between clients", async () => {
  const api = sessionApi({
    now: () => 1_000,
    maxFailures: 2,
    trustProxy: true,
  });

  await withRequestHandler(api, async (origin) => {
    const firstClient = createLoginAttempt(origin, {
      clientAddress: "203.0.113.10",
    });
    const secondClient = createLoginAttempt(origin, {
      clientAddress: "203.0.113.11",
    });

    assert.equal((await firstClient("wrong-1")).status, 401);
    assert.equal((await firstClient("wrong-2")).status, 401);
    assert.equal((await firstClient(ADMIN_TOKEN)).status, 429);
    assert.equal((await secondClient(ADMIN_TOKEN)).status, 200);
  });
});
