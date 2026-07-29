import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { createSettingsApi } from "../src/server/settings/api.mjs";

async function withApi(run) {
  const repository = {
    async getPublicSettings() {
      return { primaryNavigationVisible: false };
    },
  };
  const api = createSettingsApi({ repository });
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

test("the removed Memories admin settings route is not handled", async () => {
  await withApi(async (origin) => {
    const response = await fetch(`${origin}/Memories/api/admin/settings`, {
      method: "PATCH",
    });
    assert.equal(response.status, 404);
  });
});
