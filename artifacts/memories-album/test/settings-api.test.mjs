import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { createSettingsApi } from "../src/server/settings/api.mjs";

async function withApi(run) {
  let visible = false;
  const repository = {
    async getPublicSettings() {
      return { primaryNavigationVisible: visible };
    },
    async setPrimaryNavigationVisible(value) {
      visible = value === true;
      return { primaryNavigationVisible: visible };
    },
  };
  const api = createSettingsApi({
    repository,
    adminToken: "correct-admin-password",
  });
  const server = createServer(async (request, response) => {
    if (!(await api(request, response))) {
      response.statusCode = 404;
      response.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test("primary navigation is publicly reported as hidden by default", async () => {
  await withApi(async (origin) => {
    const response = await fetch(`${origin}/Memories/api/settings`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      primaryNavigationVisible: false,
    });
  });
});

test("admin password is validated server-side", async () => {
  await withApi(async (origin) => {
    const rejected = await fetch(`${origin}/Memories/api/admin/session`, {
      method: "POST",
      headers: { Authorization: "Bearer wrong-password" },
    });
    assert.equal(rejected.status, 401);

    const accepted = await fetch(`${origin}/Memories/api/admin/session`, {
      method: "POST",
      headers: { Authorization: "Bearer correct-admin-password" },
    });
    assert.equal(accepted.status, 200);
    assert.deepEqual(await accepted.json(), { authenticated: true });
  });
});

test("only an authenticated admin can change primary navigation visibility", async () => {
  await withApi(async (origin) => {
    const unauthorized = await fetch(`${origin}/Memories/api/admin/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ primaryNavigationVisible: true }),
    });
    assert.equal(unauthorized.status, 401);

    const changed = await fetch(`${origin}/Memories/api/admin/settings`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer correct-admin-password",
      },
      body: JSON.stringify({ primaryNavigationVisible: true }),
    });
    assert.equal(changed.status, 200);
    assert.deepEqual(await changed.json(), {
      primaryNavigationVisible: true,
    });

    const publicSettings = await fetch(`${origin}/Memories/api/settings`);
    assert.deepEqual(await publicSettings.json(), {
      primaryNavigationVisible: true,
    });
  });
});
