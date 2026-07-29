import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "../src/app.mjs";

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

test("liveness stays healthy while readiness reports bounded dependency state", async () => {
  let attempts = 0;
  await withServer(
    {
      getRuntime: async () => {
        attempts += 1;
        if (attempts === 1) {
          const error = new Error("connector response must stay private");
          error.code = "DRIVE_AUTHORIZATION_REQUIRED";
          throw error;
        }
        return {};
      },
    },
    async (origin) => {
      const live = await fetch(`${origin}/Memories/api/health`);
      assert.equal(live.status, 200);
      assert.equal(attempts, 0, "liveness must not initialize dependencies");

      const unavailable = await fetch(`${origin}/Memories/api/ready`);
      assert.equal(unavailable.status, 503);
      assert.deepEqual(await unavailable.json(), {
        status: "not-ready",
        code: "DRIVE_AUTHORIZATION_REQUIRED",
        error:
          "Google Drive authorization is required. Reconnect the Replit Google Drive integration.",
      });

      const recovered = await fetch(`${origin}/Memories/api/ready`);
      assert.equal(recovered.status, 200);
      assert.deepEqual(await recovered.json(), {
        status: "ready",
        service: "memories-album",
      });
    },
  );
});
