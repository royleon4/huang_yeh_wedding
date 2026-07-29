import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "../src/app.mjs";

async function withServer(run) {
  const calls = [];
  const runtime = {
    settingsRepository: {
      async getPublicSettings() {
        return { primaryNavigationVisible: false, albumOpen: false };
      },
    },
    settingsApi: async () => false,
    processApi: async () => false,
    adminPhotoApi: async () => false,
    adminBatchApi: async () => false,
    managementApi: async () => false,
    uploadApi: async (request, response) => {
      calls.push(request.url);
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end("{}");
      return true;
    },
    photoApi: async (request, response) => {
      calls.push(request.url);
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end("{}");
      return true;
    },
  };
  const server = createServer({
    env: { MEMORIES_ADMIN_TOKEN: "correct-password" },
    getRuntime: async () => runtime,
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`, calls);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test("album closure blocks guest media, upload and private management consistently", async () => {
  await withServer(async (origin, calls) => {
    const paths = [
      "/Memories/api/photos",
      "/Memories/api/photos/11111111-1111-4111-8111-111111111111/media",
      "/Memories/api/upload-batches",
      "/Memories/api/upload-batches/11111111-1111-4111-8111-111111111111",
    ];
    for (const path of paths) {
      const response = await fetch(`${origin}${path}`, {
        method: path.endsWith("upload-batches") ? "POST" : "GET",
      });
      assert.equal(response.status, 423, path);
      assert.deepEqual(await response.json(), {
        error: "The Memories album is currently closed",
        code: "ALBUM_CLOSED",
      });
    }
    assert.deepEqual(calls, []);
  });
});

test("an authenticated administrator retains access while the album is closed", async () => {
  await withServer(async (origin, calls) => {
    const login = await fetch(`${origin}/Memories/api/admin/session`, {
      method: "POST",
      headers: { Authorization: "Bearer correct-password" },
    });
    const cookie = login.headers.get("set-cookie").split(";", 1)[0];

    const response = await fetch(`${origin}/Memories/api/photos`, {
      headers: { Cookie: cookie },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(calls, ["/Memories/api/photos"]);
  });
});
