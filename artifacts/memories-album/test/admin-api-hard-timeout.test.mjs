import assert from "node:assert/strict";
import test from "node:test";
import { adminRequest } from "../src/client/admin-client.mjs";

test("administrator requests settle even when fetch ignores AbortSignal", async () => {
  const startedAt = Date.now();
  await assert.rejects(
    adminRequest("/admin/api/session", {
      password: "123456",
      method: "POST",
      timeoutMs: 25,
      fetchImpl: () => new Promise(() => {}),
    }),
    (error) => error?.code === "REQUEST_TIMEOUT",
  );
  assert.ok(
    Date.now() - startedAt < 500,
    "the login request must not remain pending after its hard timeout",
  );
});
