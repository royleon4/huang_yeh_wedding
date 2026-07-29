import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "../src/app.mjs";

async function withServer(run) {
  const server = createServer({
    env: { MEMORIES_ADMIN_TOKEN: "correct-password" },
    getRuntime: async () => {
      const error = new Error("Drive unavailable");
      error.code = "DRIVE_RETRYABLE";
      throw error;
    },
  });
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

test("admin login succeeds even when Drive runtime is unavailable", async () => {
  await withServer(async (origin) => {
    const login = await fetch(`${origin}/Memories/api/admin/session`, {
      method: "POST",
      headers: { Authorization: "Bearer correct-password" },
    });
    assert.equal(login.status, 200);
    assert.deepEqual(await login.json(), {
      authenticated: true,
      expiresInSeconds: 1800,
    });

    const processes = await fetch(`${origin}/Memories/api/processes`);
    assert.equal(processes.status, 200);
    assert.deepEqual(await processes.json(), {
      processes: [],
      degraded: true,
      storageError: "DRIVE_RETRYABLE",
    });

    const settings = await fetch(`${origin}/Memories/api/settings`);
    assert.equal(settings.status, 200);
    assert.deepEqual(await settings.json(), {
      primaryNavigationVisible: false,
      degraded: true,
      storageError: "DRIVE_RETRYABLE",
    });
  });
});
