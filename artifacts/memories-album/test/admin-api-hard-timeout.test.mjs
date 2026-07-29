import assert from "node:assert/strict";
import test from "node:test";
import { adminApi } from "../src/client/admin-api.mjs";

test("administrator requests settle even when fetch ignores AbortSignal", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => new Promise(() => {});

  try {
    const startedAt = Date.now();
    await assert.rejects(
      adminApi("https://example.invalid/Memories/api/admin/session", {
        token: "123456",
        method: "POST",
        timeoutMs: 25,
      }),
      (error) => error?.code === "REQUEST_TIMEOUT",
    );
    assert.ok(
      Date.now() - startedAt < 500,
      "the login request must not remain pending after its hard timeout",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
