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

test("redirects uppercase and lowercase entry paths to the canonical URL", async () => {
  await withServer(async (origin) => {
    const canonical = await fetch(`${origin}/Memories`, { redirect: "manual" });
    assert.equal(canonical.status, 308);
    assert.equal(canonical.headers.get("location"), "/Memories/");

    const lowercase = await fetch(`${origin}/memories/?from=guest`, { redirect: "manual" });
    assert.equal(lowercase.status, 308);
    assert.equal(lowercase.headers.get("location"), "/Memories/?from=guest");
  });
});

test("serves the React archive entry document", async () => {
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/Memories/`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html/);
    const html = await response.text();
    assert.match(html, /詠葉婚禮照片檔案館/);
    assert.match(html, /id="root"/);
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

test("keeps unknown API routes JSON-only", async () => {
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/Memories/api/unknown`);
    assert.equal(response.status, 404);
    assert.match(response.headers.get("content-type") ?? "", /^application\/json/);
  });
});

test("does not claim routes outside the standalone namespace", async () => {
  await withServer(async (origin) => {
    assert.equal((await fetch(`${origin}/`)).status, 404);
    assert.equal((await fetch(`${origin}/api/photos`)).status, 404);
  });
});
