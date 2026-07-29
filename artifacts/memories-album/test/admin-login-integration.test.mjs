import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "../src/app.mjs";
import { adminApi } from "../src/client/admin-api.mjs";
import { performAdminLogin } from "../src/client/admin-login-flow.mjs";

async function withServer(options, run) {
  const server = createServer(options);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

function memoryStorage() {
  const values = new Map();
  return {
    setItem(key, value) {
      values.set(key, String(value));
    },
    getItem(key) {
      return values.get(key) ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

test("the real login endpoint opens admin mode even when PostgreSQL returns 42P01", async () => {
  let runtimeCalls = 0;
  const missingTableRuntime = async () => {
    runtimeCalls += 1;
    const error = new Error('relation "memories_processes" does not exist');
    error.code = "42P01";
    throw error;
  };

  await withServer(
    {
      env: { MEMORIES_ADMIN_TOKEN: "123456" },
      getRuntime: missingTableRuntime,
    },
    async (origin) => {
      let authenticated = false;
      let busy = false;
      let message = "";
      const storage = memoryStorage();
      const request = (path, options) => adminApi(`${origin}${path}`, options);
      const originalWarn = console.warn;
      console.warn = () => {};

      try {
        const startedAt = Date.now();
        const result = await performAdminLogin({
          token: "123456",
          request,
          storage,
          setAuthenticated(value) {
            authenticated = value;
          },
          setBusy(value) {
            busy = value;
          },
          setMessage(value) {
            message = value;
          },
          schedule(callback) {
            return setImmediate(callback);
          },
          refresh: async () => {
            const [processes, settings] = await Promise.all([
              request("/Memories/api/processes", { timeoutMs: 1000 }),
              request("/Memories/api/settings", { timeoutMs: 1000 }),
            ]);
            assert.equal(processes.degraded, true);
            assert.equal(settings.degraded, true);
          },
        });

        assert.equal(result.authenticated, true);
        assert.equal(authenticated, true);
        assert.equal(busy, false);
        assert.equal(storage.getItem("memories-admin-token"), "123456");
        assert.ok(
          Date.now() - startedAt < 1000,
          "admin mode must open before storage-backed refresh completes",
        );

        await result.background;
        assert.equal(authenticated, true);
        assert.equal(busy, false);
        assert.equal(message, "");
        assert.equal(runtimeCalls, 2);
      } finally {
        console.warn = originalWarn;
      }
    },
  );
});

test("the real login endpoint rejects an incorrect password and resets busy state", async () => {
  await withServer(
    {
      env: { MEMORIES_ADMIN_TOKEN: "123456" },
      getRuntime: async () => {
        throw new Error("runtime must not be used by admin login");
      },
    },
    async (origin) => {
      let authenticated = true;
      let busy = false;
      let message = "";
      const storage = memoryStorage();
      const result = await performAdminLogin({
        token: "wrong-password",
        request: (path, options) => adminApi(`${origin}${path}`, options),
        storage,
        setAuthenticated(value) {
          authenticated = value;
        },
        setBusy(value) {
          busy = value;
        },
        setMessage(value) {
          message = value;
        },
      });

      assert.equal(result.authenticated, false);
      assert.equal(authenticated, false);
      assert.equal(busy, false);
      assert.equal(message, "管理密碼錯誤");
      assert.equal(storage.getItem("memories-admin-token"), null);
    },
  );
});
