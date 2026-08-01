import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "../src/app.mjs";
import { withListeningServer } from "../test-support/http.mjs";

function withApp(run, options) {
  return withListeningServer(createServer(options), run);
}

test("redirects Memories entry aliases to the canonical URL", async () => {
  await withApp(async (origin) => {
    const cases = [
      ["/Memories", "/Memories/"],
      ["/memories/?from=guest", "/Memories/?from=guest"],
    ];

    for (const [requestPath, location] of cases) {
      const response = await fetch(`${origin}${requestPath}`, {
        redirect: "manual",
      });
      assert.equal(response.status, 308, requestPath);
      assert.equal(response.headers.get("location"), location, requestPath);
    }
  });
});

test("serves the React archive entry document", async () => {
  await withApp(async (origin) => {
    const response = await fetch(`${origin}/Memories/`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html/);

    const html = await response.text();
    assert.match(html, /詠葉婚禮照片檔案館/);
    assert.match(html, /id="root"/);
  });
});

test("serves an isolated health endpoint", async () => {
  await withApp(async (origin) => {
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
  await withApp(async (origin) => {
    const response = await fetch(`${origin}/Memories/api/unknown`);
    assert.equal(response.status, 404);
    assert.match(
      response.headers.get("content-type") ?? "",
      /^application\/json/,
    );
  });
});

test("does not claim routes outside the standalone namespace", async () => {
  await withApp(async (origin) => {
    for (const requestPath of ["/", "/api/photos"]) {
      assert.equal((await fetch(`${origin}${requestPath}`)).status, 404);
    }
  });
});
