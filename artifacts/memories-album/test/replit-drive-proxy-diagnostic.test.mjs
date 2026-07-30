import assert from "node:assert/strict";
import test from "node:test";
import { createReplitDriveProxy } from "../src/server/storage/replit-drive.mjs";

function response({ ok = true, status = 200, headers = new Map() } = {}) {
  const normalized = new Map(
    [...headers.entries()].map(([key, value]) => [String(key).toLowerCase(), value]),
  );
  return {
    ok,
    status,
    headers: {
      get(name) {
        return normalized.get(String(name).toLowerCase()) ?? null;
      },
    },
  };
}

test("retries a rejected 4 MiB non-final Drive chunk as two legal 2 MiB chunks", async () => {
  const calls = [];
  const total = 5 * 1024 * 1024 + 123;
  const body = Buffer.alloc(4 * 1024 * 1024, 7);
  const connectors = {
    async proxy(connector, path, options) {
      calls.push({ connector, path, options });
      if (calls.length === 1) return response({ ok: false, status: 403 });
      if (calls.length === 2) {
        return response({
          ok: false,
          status: 308,
          headers: new Map([["range", `bytes=0-${2 * 1024 * 1024 - 1}`]]),
        });
      }
      return response({
        ok: false,
        status: 308,
        headers: new Map([["range", `bytes=0-${4 * 1024 * 1024 - 1}`]]),
      });
    },
  };

  const proxy = createReplitDriveProxy(connectors);
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    const result = await proxy("google-drive", "/upload-session", {
      method: "PUT",
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(body.length),
        "Content-Range": `bytes 0-${body.length - 1}/${total}`,
      },
      body,
    });

    assert.equal(result.status, 308);
    assert.equal(calls.length, 3);
    assert.equal(calls[0].options.body.length, 4 * 1024 * 1024);
    assert.equal(calls[1].options.body.length, 2 * 1024 * 1024);
    assert.equal(calls[2].options.body.length, 2 * 1024 * 1024);
    assert.equal(
      calls[1].options.headers["Content-Range"],
      `bytes 0-${2 * 1024 * 1024 - 1}/${total}`,
    );
    assert.equal(
      calls[2].options.headers["Content-Range"],
      `bytes ${2 * 1024 * 1024}-${4 * 1024 * 1024 - 1}/${total}`,
    );
  } finally {
    console.warn = originalWarn;
  }
});

test("does not disguise a genuine 401 authorization failure as a chunk-size issue", async () => {
  let calls = 0;
  const connectors = {
    async proxy() {
      calls += 1;
      return response({ ok: false, status: 401 });
    },
  };
  const proxy = createReplitDriveProxy(connectors);
  const body = Buffer.alloc(4 * 1024 * 1024, 1);
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    const result = await proxy("google-drive", "/upload-session", {
      method: "PUT",
      headers: {
        "Content-Range": `bytes 0-${body.length - 1}/${body.length + 1}`,
      },
      body,
    });
    assert.equal(result.status, 401);
    assert.equal(calls, 1);
  } finally {
    console.warn = originalWarn;
  }
});

test("leaves small one-request uploads unchanged", async () => {
  let calls = 0;
  const connectors = {
    async proxy() {
      calls += 1;
      return response({ ok: true, status: 200 });
    },
  };
  const proxy = createReplitDriveProxy(connectors);
  const body = Buffer.alloc(118_000, 2);
  const result = await proxy("google-drive", "/upload-session", {
    method: "PUT",
    headers: {
      "Content-Range": `bytes 0-${body.length - 1}/${body.length}`,
    },
    body,
  });
  assert.equal(result.status, 200);
  assert.equal(calls, 1);
});
