import assert from "node:assert/strict";
import test from "node:test";
import {
  adminRequest,
  adminSurface,
  loginAdministrator,
  logoutAdministrator,
} from "../src/client/admin-client.mjs";
import { jsonResponse } from "../test-support/http.mjs";

function albumSummaryChange(showSummary = false) {
  return {
    albums: {
      update: [
        {
          id: "wedding",
          changes: { showSummary },
        },
      ],
    },
    categories: { update: [] },
    photos: { update: [] },
  };
}

function successfulBatchChange() {
  return {
    results: [
      {
        key: "album:update:wedding",
        id: "wedding",
        type: "album.update",
        status: "ok",
      },
    ],
    summary: { attempted: 1, succeeded: 1, failed: 0 },
  };
}

test("client routing separates login, administration, and public Memories", async (t) => {
  const cases = [
    ["/Memories/admin/login", "login"],
    ["/Memories/admin/", "admin"],
    ["/Memories/", "memories"],
  ];

  for (const [path, surface] of cases) {
    await t.test(path, () => {
      assert.equal(adminSurface(path), surface);
    });
  }
});

test("legacy administrator requests use canonical paths and normalized photos", async () => {
  const requested = [];
  const payload = await adminRequest("/admin/api/photos", {
    fetchImpl: async (path) => {
      requested.push(path);
      if (String(path).includes("photo-uploaders")) {
        return jsonResponse({
          uploaders: [
            {
              id: "photo-1",
              uploaderName: "婚禮攝影",
              deleteProtected: true,
            },
          ],
        });
      }
      return jsonResponse({
        photos: [
          {
            id: "photo-1",
            thumbnailUrl: "/admin/api/photos/photo-1/thumbnail",
          },
        ],
      });
    },
  });

  assert.deepEqual(requested, [
    "/Memories/admin/api/photos",
    "/Memories/admin/api/photo-uploaders?ids=photo-1",
  ]);
  assert.deepEqual(payload.photos[0], {
    id: "photo-1",
    thumbnailUrl: "/Memories/admin/api/photos/photo-1/thumbnail",
    uploaderName: "婚禮攝影",
    deleteProtected: true,
  });
});

test("album summary follow-up controls the final batch result", async (t) => {
  await t.test("successful follow-up stays saved", async () => {
    const requests = [];
    const payload = await adminRequest("/admin/api/changes", {
      method: "PATCH",
      body: albumSummaryChange(),
      fetchImpl: async (path, options) => {
        requests.push({ path, options });
        if (path === "/Memories/admin/api/changes") {
          return jsonResponse(successfulBatchChange());
        }

        assert.equal(path, "/Memories/admin/api/albums/wedding");
        assert.equal(options.method, "PATCH");
        assert.deepEqual(JSON.parse(options.body), { showSummary: false });
        return jsonResponse({
          album: { id: "wedding", showSummary: false },
        });
      },
    });

    assert.deepEqual(
      requests.map((request) => request.path),
      [
        "/Memories/admin/api/changes",
        "/Memories/admin/api/albums/wedding",
      ],
    );
    assert.equal(payload.results[0].status, "ok");
    assert.deepEqual(payload.summary, {
      attempted: 1,
      succeeded: 1,
      failed: 0,
    });
  });

  await t.test("failed follow-up remains unsaved", async () => {
    const payload = await adminRequest("/admin/api/changes", {
      method: "PATCH",
      body: albumSummaryChange(),
      fetchImpl: async (path) => {
        if (path === "/Memories/admin/api/changes") {
          return jsonResponse(successfulBatchChange());
        }
        return jsonResponse(
          {
            error: "temporary failure",
            code: "ALBUM_UPDATE_FAILED",
          },
          { status: 503 },
        );
      },
    });

    assert.equal(payload.results[0].status, "error");
    assert.equal(payload.results[0].code, "ALBUM_UPDATE_FAILED");
    assert.deepEqual(payload.summary, {
      attempted: 1,
      succeeded: 0,
      failed: 1,
    });
  });
});

test("successful login and logout replace the browser route", async () => {
  const requests = [];
  const destinations = [];
  const request = async (path, options) => {
    requests.push({ path, options });
    return { authenticated: options.method === "POST" };
  };

  await loginAdministrator("correct-password", {
    request,
    navigate: (destination) => destinations.push(destination),
  });
  await logoutAdministrator({
    request,
    navigate: (destination) => destinations.push(destination),
  });

  assert.deepEqual(requests, [
    {
      path: "/Memories/admin/api/session",
      options: {
        method: "POST",
        password: "correct-password",
      },
    },
    {
      path: "/Memories/admin/api/session",
      options: { method: "DELETE" },
    },
  ]);
  assert.deepEqual(destinations, ["/Memories/admin/", "/Memories/"]);
});
