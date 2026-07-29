import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "../src/app.mjs";

async function withServer(run, options) {
  const server = createServer(options);
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

test("redirects uppercase and lowercase entry paths to the canonical URL", async () => {
  await withServer(async (origin) => {
    const canonical = await fetch(`${origin}/Memories`, { redirect: "manual" });
    assert.equal(canonical.status, 308);
    assert.equal(canonical.headers.get("location"), "/Memories/");

    const lowercase = await fetch(`${origin}/memories/?from=guest`, {
      redirect: "manual",
    });
    assert.equal(lowercase.status, 308);
    assert.equal(lowercase.headers.get("location"), "/Memories/?from=guest");
  });
});

test("serves the React archive entry document", async () => {
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/Memories/`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html/);
    assert.match(
      response.headers.get("content-security-policy") ?? "",
      /default-src 'self'/,
    );
    assert.match(
      response.headers.get("content-security-policy") ?? "",
      /frame-ancestors 'none'/,
    );
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.match(
      response.headers.get("permissions-policy") ?? "",
      /camera=\(\)/,
    );
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    const html = await response.text();
    assert.match(html, /詠葉婚禮照片檔案館/);
    assert.match(html, /id="root"/);
  });
});

test("serves an isolated health endpoint", async () => {
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/Memories/api/health`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.deepEqual(await response.json(), {
      status: "ok",
      service: "memories-album",
      basePath: "/Memories",
    });
  });
});

test("validates an admin session without initializing Drive or the database", async () => {
  let runtimeRequested = false;
  await withServer(
    async (origin) => {
      const accepted = await fetch(`${origin}/Memories/api/admin/session`, {
        method: "POST",
        headers: { Authorization: "Bearer correct-password" },
      });
      assert.equal(accepted.status, 200);
      assert.deepEqual(await accepted.json(), {
        authenticated: true,
        expiresInSeconds: 1800,
      });

      const rejected = await fetch(`${origin}/Memories/api/admin/session`, {
        method: "POST",
        headers: { Authorization: "Bearer wrong-password" },
      });
      assert.equal(rejected.status, 401);
      assert.equal((await rejected.json()).code, "UNAUTHORIZED");
      assert.equal(runtimeRequested, false);
    },
    {
      env: { MEMORIES_ADMIN_TOKEN: "correct-password" },
      getRuntime() {
        runtimeRequested = true;
        throw new Error("Runtime must not initialize for admin login");
      },
    },
  );
});

test("reports missing admin configuration as unavailable, not a wrong password", async () => {
  await withServer(
    async (origin) => {
      const response = await fetch(`${origin}/Memories/api/admin/session`, {
        method: "POST",
        headers: { Authorization: "Bearer any-password" },
      });
      assert.equal(response.status, 503);
      assert.equal((await response.json()).code, "ADMIN_TOKEN_NOT_CONFIGURED");
    },
    {
      env: {},
      getRuntime() {
        throw new Error("Runtime must not initialize for admin login");
      },
    },
  );
});

test("rejects unsupported admin session methods without hanging", async () => {
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/Memories/api/admin/session`, {
      method: "OPTIONS",
    });
    assert.equal(response.status, 404);
  });
});

test("keeps unknown API routes JSON-only", async () => {
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/Memories/api/unknown`);
    assert.equal(response.status, 404);
    assert.match(
      response.headers.get("content-type") ?? "",
      /^application\/json/,
    );
  });
});

test("does not claim routes outside the standalone namespace", async () => {
  await withServer(async (origin) => {
    assert.equal((await fetch(`${origin}/`)).status, 404);
    assert.equal((await fetch(`${origin}/api/photos`)).status, 404);
  });
});
