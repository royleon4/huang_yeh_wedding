import assert from "node:assert/strict";
import test from "node:test";
import {
  adminRequest,
  adminSurface,
  loginAdministrator,
  logoutAdministrator,
} from "../src/client/admin-client.mjs";

test("client routing keeps login, administration, and Memories separate", () => {
  assert.equal(adminSurface("/Memories/admin/login"), "login");
  assert.equal(adminSurface("/Memories/admin/"), "admin");
  assert.equal(adminSurface("/Memories/"), "memories");
});

test("legacy admin request paths are sent beneath /Memories/admin", async () => {
  const requested = [];
  const payload = await adminRequest("/admin/api/photos", {
    fetchImpl: async (path) => {
      requested.push(path);
      if (String(path).includes("photo-uploaders")) {
        return {
          ok: true,
          json: async () => ({
            uploaders: [
              {
                id: "photo-1",
                uploaderName: "婚禮攝影",
                deleteProtected: true,
              },
            ],
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          photos: [
            {
              id: "photo-1",
              thumbnailUrl: "/admin/api/photos/photo-1/thumbnail",
            },
          ],
        }),
      };
    },
  });

  assert.deepEqual(requested, [
    "/Memories/admin/api/photos",
    "/Memories/admin/api/photo-uploaders?ids=photo-1",
  ]);
  assert.equal(
    payload.photos[0].thumbnailUrl,
    "/Memories/admin/api/photos/photo-1/thumbnail",
  );
  assert.equal(payload.photos[0].uploaderName, "婚禮攝影");
  assert.equal(payload.photos[0].deleteProtected, true);
});

test("batch saves persist a false album summary setting through the album API", async () => {
  const requests = [];
  const payload = await adminRequest("/admin/api/changes", {
    method: "PATCH",
    body: {
      albums: {
        update: [
          {
            id: "wedding",
            changes: { showSummary: false },
          },
        ],
      },
      categories: { update: [] },
      photos: { update: [] },
    },
    fetchImpl: async (path, options) => {
      requests.push({ path, options });
      if (path === "/Memories/admin/api/changes") {
        return {
          ok: true,
          json: async () => ({
            results: [
              {
                key: "album:update:wedding",
                id: "wedding",
                type: "album.update",
                status: "ok",
              },
            ],
            summary: { attempted: 1, succeeded: 1, failed: 0 },
          }),
        };
      }
      assert.equal(path, "/Memories/admin/api/albums/wedding");
      assert.equal(options.method, "PATCH");
      assert.deepEqual(JSON.parse(options.body), { showSummary: false });
      return {
        ok: true,
        json: async () => ({ album: { id: "wedding", showSummary: false } }),
      };
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
  assert.deepEqual(payload.summary, { attempted: 1, succeeded: 1, failed: 0 });
});

test("a failed album summary follow-up remains an unsaved batch result", async () => {
  const payload = await adminRequest("/admin/api/changes", {
    method: "PATCH",
    body: {
      albums: {
        update: [
          {
            id: "wedding",
            changes: { showSummary: false },
          },
        ],
      },
      categories: { update: [] },
      photos: { update: [] },
    },
    fetchImpl: async (path) => {
      if (path === "/Memories/admin/api/changes") {
        return {
          ok: true,
          json: async () => ({
            results: [
              {
                key: "album:update:wedding",
                id: "wedding",
                type: "album.update",
                status: "ok",
              },
            ],
            summary: { attempted: 1, succeeded: 1, failed: 0 },
          }),
        };
      }
      return {
        ok: false,
        status: 503,
        json: async () => ({
          error: "temporary failure",
          code: "ALBUM_UPDATE_FAILED",
        }),
      };
    },
  });

  assert.equal(payload.results[0].status, "error");
  assert.equal(payload.results[0].code, "ALBUM_UPDATE_FAILED");
  assert.deepEqual(payload.summary, { attempted: 1, succeeded: 0, failed: 1 });
});

test("a successful login and logout replace the browser route", async () => {
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
