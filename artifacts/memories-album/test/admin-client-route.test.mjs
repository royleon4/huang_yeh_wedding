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

  assert.deepEqual(requested, ["/Memories/admin/api/photos"]);
  assert.equal(
    payload.photos[0].thumbnailUrl,
    "/Memories/admin/api/photos/photo-1/thumbnail",
  );
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
