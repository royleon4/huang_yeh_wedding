import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import {
  createAdminSettingsApi,
  createSettingsApi,
} from "../src/server/settings/api.mjs";

async function withApis(run) {
  let guestUploadCategorySelectionEnabled = true;
  const repository = {
    async getPublicSettings() {
      return {
        primaryNavigationVisible: false,
        guestUploadCategorySelectionEnabled,
      };
    },
    async setGuestUploadCategorySelectionEnabled(value) {
      guestUploadCategorySelectionEnabled = value === true;
      return { guestUploadCategorySelectionEnabled };
    },
  };
  const publicApi = createSettingsApi({ repository });
  const adminApi = createAdminSettingsApi({ repository });
  const server = createServer(async (request, response) => {
    if (
      !(await publicApi(request, response)) &&
      !(await adminApi(request, response))
    ) {
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

test("public settings report visitor category selection enabled", async () => {
  await withApis(async (origin) => {
    const response = await fetch(`${origin}/Memories/api/settings`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      primaryNavigationVisible: false,
      guestUploadCategorySelectionEnabled: true,
    });
  });
});

test("administrator can disable visitor category selection", async () => {
  await withApis(async (origin) => {
    const update = await fetch(`${origin}/admin/api/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestUploadCategorySelectionEnabled: false }),
    });
    assert.equal(update.status, 200);
    assert.deepEqual(await update.json(), {
      guestUploadCategorySelectionEnabled: false,
    });

    const publicResponse = await fetch(`${origin}/Memories/api/settings`);
    assert.equal(publicResponse.status, 200);
    assert.equal(
      (await publicResponse.json()).guestUploadCategorySelectionEnabled,
      false,
    );
  });
});

test("administrator settings reject non-boolean values", async () => {
  await withApis(async (origin) => {
    const response = await fetch(`${origin}/admin/api/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestUploadCategorySelectionEnabled: "yes" }),
    });
    assert.equal(response.status, 422);
    assert.equal((await response.json()).code, "INVALID_SETTING");
  });
});
