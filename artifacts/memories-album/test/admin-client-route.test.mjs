import assert from "node:assert/strict";
import test from "node:test";
import {
  adminSurface,
  loginAdministrator,
  logoutAdministrator,
} from "../src/client/admin-client.mjs";

test("client routing keeps login, administration, and Memories separate", () => {
  assert.equal(adminSurface("/admin/login"), "login");
  assert.equal(adminSurface("/admin"), "admin");
  assert.equal(adminSurface("/Memories/"), "memories");
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
      path: "/admin/api/session",
      options: {
        method: "POST",
        password: "correct-password",
      },
    },
    {
      path: "/admin/api/session",
      options: { method: "DELETE" },
    },
  ]);
  assert.deepEqual(destinations, ["/admin", "/Memories/"]);
});
