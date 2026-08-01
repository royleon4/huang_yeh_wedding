import assert from "node:assert/strict";
import test from "node:test";
import { createGuestFeaturedSettingsApis } from "../src/server/settings/guest-featured-api.mjs";

function responseRecorder() {
  return {
    status: null,
    body: null,
    writeHead(status) {
      this.status = status;
    },
    end(body) {
      this.body = body ? JSON.parse(body) : null;
    },
  };
}

function jsonRequest(method, body) {
  return {
    method,
    url: "/",
    async *[Symbol.asyncIterator]() {
      if (body !== undefined) yield Buffer.from(JSON.stringify(body));
    },
  };
}

test("guest featured setting defaults to disabled and persists booleans", async () => {
  let stored;
  const pool = {
    async query(sql, values) {
      if (sql.includes("SELECT value")) {
        return { rows: stored === undefined ? [] : [{ value: stored }] };
      }
      stored = JSON.parse(values[1]);
      return { rows: [] };
    },
  };
  const apis = createGuestFeaturedSettingsApis({ pool });

  const initial = responseRecorder();
  assert.equal(
    await apis.publicApi(
      jsonRequest("GET"),
      initial,
      new URL("http://localhost/Memories/api/settings/guest-featured"),
    ),
    true,
  );
  assert.equal(initial.body.guestRandomFeaturedPhotosEnabled, false);

  const saved = responseRecorder();
  await apis.adminApi(
    jsonRequest("PATCH", { guestRandomFeaturedPhotosEnabled: true }),
    saved,
    new URL("http://localhost/admin/api/settings/guest-featured"),
  );
  assert.equal(saved.status, 200);
  assert.equal(saved.body.guestRandomFeaturedPhotosEnabled, true);
  assert.equal(stored, true);
});

test("guest featured setting rejects non-boolean values", async () => {
  const pool = { query: async () => ({ rows: [] }) };
  const apis = createGuestFeaturedSettingsApis({ pool });
  const response = responseRecorder();
  await apis.adminApi(
    jsonRequest("PATCH", { guestRandomFeaturedPhotosEnabled: "yes" }),
    response,
    new URL("http://localhost/admin/api/settings/guest-featured"),
  );
  assert.equal(response.status, 422);
  assert.equal(response.body.code, "INVALID_SETTING");
});
