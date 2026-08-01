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

function createPool() {
  const stored = new Map();
  return {
    stored,
    async query(sql, values = []) {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rows: [] };
      }
      if (sql.includes("SELECT key, value")) {
        return {
          rows: [...stored].map(([key, value]) => ({ key, value })),
        };
      }
      if (sql.includes("INSERT INTO memories_app_settings")) {
        stored.set(values[0], JSON.parse(values[1]));
        return { rows: [] };
      }
      return { rows: [] };
    },
  };
}

test("guest featured compatibility endpoint persists numeric ranges", async () => {
  const pool = createPool();
  const apis = createGuestFeaturedSettingsApis({ pool });

  const initial = responseRecorder();
  await apis.publicApi(
    jsonRequest("GET"),
    initial,
    new URL("http://localhost/Memories/api/settings/guest-featured"),
  );
  assert.equal(initial.body.guestRandomFeaturedPhotosEnabled, false);
  assert.equal(initial.body.guestRandomFeaturedPhotosMin, 1);
  assert.equal(initial.body.guestRandomFeaturedPhotosMax, 3);

  const saved = responseRecorder();
  await apis.adminApi(
    jsonRequest("PATCH", {
      guestRandomFeaturedPhotosEnabled: true,
      guestRandomFeaturedPhotosMin: 0,
      guestRandomFeaturedPhotosMax: 4,
    }),
    saved,
    new URL("http://localhost/admin/api/settings/guest-featured"),
  );
  assert.equal(saved.status, 200);
  assert.equal(saved.body.guestRandomFeaturedPhotosEnabled, true);
  assert.equal(saved.body.guestRandomFeaturedPhotosMin, 0);
  assert.equal(saved.body.guestRandomFeaturedPhotosMax, 4);
});

test("guest featured compatibility endpoint rejects invalid ranges", async () => {
  const apis = createGuestFeaturedSettingsApis({ pool: createPool() });
  for (const body of [
    {
      guestRandomFeaturedPhotosEnabled: true,
      guestRandomFeaturedPhotosMin: "one",
      guestRandomFeaturedPhotosMax: 3,
    },
    {
      guestRandomFeaturedPhotosEnabled: true,
      guestRandomFeaturedPhotosMin: 4,
      guestRandomFeaturedPhotosMax: 2,
    },
    {
      guestRandomFeaturedPhotosEnabled: true,
      guestRandomFeaturedPhotosMin: -1,
      guestRandomFeaturedPhotosMax: 3,
    },
  ]) {
    const response = responseRecorder();
    await apis.adminApi(
      jsonRequest("PATCH", body),
      response,
      new URL("http://localhost/admin/api/settings/guest-featured"),
    );
    assert.equal(response.status, 422);
    assert.equal(response.body.code, "INVALID_SETTING");
  }
});
