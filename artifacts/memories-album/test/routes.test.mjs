import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "../src/app.mjs";

async function withServer(run) {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.equal(typeof address, "object");
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("redirects the canonical path to a trailing slash", async () => {
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/Memories`, { redirect: "manual" });
    assert.equal(response.status, 308);
    assert.equal(response.headers.get("location"), "/Memories/");
  });
});

test("serves the standalone Memories shell", async () => {
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/Memories/`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html/);
    assert.match(await response.text(), /Standalone wedding gallery/);
  });
});

test("serves an isolated health endpoint", async () => {
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/Memories/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: "ok",
      service: "memories-album",
      basePath: "/Memories",
    });
  });
});

test("does not claim routes outside the Memories namespace", async () => {
  await withServer(async (origin) => {
    assert.equal((await fetch(`${origin}/`)).status, 404);
    assert.equal((await fetch(`${origin}/api/photos`)).status, 404);
  });
});
