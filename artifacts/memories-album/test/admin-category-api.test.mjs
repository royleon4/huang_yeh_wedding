import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { createAdminSessionCookie } from "../src/server/admin/auth.mjs";
import { createAdminCategoryApi } from "../src/server/categories/admin-api.mjs";

const adminToken = "correct-password";

function cookie() {
  return createAdminSessionCookie({
    configuredToken: adminToken,
    createNonce: () => "fixed",
  }).header.split(";", 1)[0];
}

async function withApi(api, run) {
  const server = createServer(async (request, response) => {
    if (await api(request, response)) return;
    response.statusCode = 404;
    response.end();
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

test("administrators can add, rename, and reorder Drive-backed categories", async () => {
  let categories = [
    {
      id: "ceremony",
      labelZh: "證婚",
      labelEn: "Ceremony",
      displayOrder: 1,
      syncState: "synced",
      lastSyncedAt: null,
    },
  ];
  const repository = {
    async listProcesses() {
      return categories.map((category) => ({ ...category }));
    },
  };
  const synchronizer = {
    async createProcess(input) {
      const category = {
        id: "banquet",
        ...input,
        displayOrder: 2,
        syncState: "synced",
        lastSyncedAt: "2026-06-20T00:00:00.000Z",
      };
      categories.push(category);
      return category;
    },
    async renameProcess(category, labelZh, labelEn) {
      const updated = { ...category, labelZh, labelEn };
      categories = categories.map((item) =>
        item.id === updated.id ? updated : item,
      );
      return updated;
    },
    async reorderProcesses(ids) {
      categories = ids.map((id, index) => ({
        ...categories.find((category) => category.id === id),
        displayOrder: index + 1,
      }));
      return categories;
    },
  };
  const api = createAdminCategoryApi({
    repository,
    synchronizer,
    adminToken,
  });

  await withApi(api, async (origin) => {
    const unauthorized = await fetch(`${origin}/admin/api/categories`);
    assert.equal(unauthorized.status, 401);

    const headers = {
      Cookie: cookie(),
      "Content-Type": "application/json",
      "X-Memories-Admin": "1",
    };
    const created = await fetch(`${origin}/admin/api/categories`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        labelZh: "家宴",
        labelEn: "Banquet",
      }),
    });
    assert.equal(created.status, 201);
    assert.equal((await created.json()).category.id, "banquet");

    const renamed = await fetch(`${origin}/admin/api/categories/banquet`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        labelZh: "婚宴",
        labelEn: "Wedding banquet",
      }),
    });
    assert.equal(renamed.status, 200);
    assert.equal((await renamed.json()).category.labelZh, "婚宴");

    const reordered = await fetch(`${origin}/admin/api/categories/order`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ categoryIds: ["banquet", "ceremony"] }),
    });
    assert.equal(reordered.status, 200);
    assert.deepEqual(
      (await reordered.json()).categories.map((category) => category.id),
      ["banquet", "ceremony"],
    );

    const listed = await fetch(`${origin}/admin/api/categories`, {
      headers: { Cookie: cookie() },
    });
    assert.equal(listed.status, 200);
    assert.deepEqual(
      (await listed.json()).categories.map((category) => category.labelZh),
      ["婚宴", "證婚"],
    );
  });
});
