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
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test("redirects the canonical path to a trailing slash", async () => {
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/Memories`, { redirect: "manual" });
    assert.equal(response.status, 308);
    assert.equal(response.headers.get("location"), "/Memories/");
  });
});

test("redirects lowercase paths to the canonical Memories path", async () => {
  await withServer(async (origin) => {
    const withoutSlash = await fetch(`${origin}/memories`, {
      redirect: "manual",
    });
    assert.equal(withoutSlash.status, 308);
    assert.equal(withoutSlash.headers.get("location"), "/Memories/");

    const withSlash = await fetch(`${origin}/memories/?from=guest`, {
      redirect: "manual",
    });
    assert.equal(withSlash.status, 308);
    assert.equal(
      withSlash.headers.get("location"),
      "/Memories/?from=guest",
    );
  });
});

test("serves the standalone Memories shell", async () => {
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/Memories/`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html/);
    assert.match(await response.text(), /standalone wedding gallery/i);
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

test("redirects lowercase API requests before handling them", async () => {
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/memories/api/health`, {
      redirect: "manual",
    });
    assert.equal(response.status, 308);
    assert.equal(
      response.headers.get("location"),
      "/Memories/api/health",
    );
  });
});

test("does not claim routes outside the Memories namespace", async () => {
  await withServer(async (origin) => {
    assert.equal((await fetch(`${origin}/`)).status, 404);
    assert.equal((await fetch(`${origin}/api/photos`)).status, 404);
  });
});
