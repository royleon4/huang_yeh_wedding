import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { DEFAULT_GALLERY_MEDIA_ORDER } from "../src/gallery-media-order.mjs";
import {
  createAdminSettingsApi,
  createSettingsApi,
} from "../src/server/settings/api.mjs";

async function withApis(run) {
  let guestUploadCategorySelectionEnabled = true;
  let processWheelEnabled = false;
  let processWheelVisibleCount = 6;
  let galleryMediaOrder = [...DEFAULT_GALLERY_MEDIA_ORDER];
  let driveUploadMode = "single";
  const repository = {
    async getPublicSettings() {
      return {
        primaryNavigationVisible: false,
        guestUploadCategorySelectionEnabled,
        processWheelEnabled,
        processWheelVisibleCount,
        galleryMediaOrder,
        driveUploadMode,
      };
    },
    async setGuestUploadCategorySelectionEnabled(value) {
      guestUploadCategorySelectionEnabled = value === true;
      return { guestUploadCategorySelectionEnabled };
    },
    async setProcessWheelEnabled(value) {
      processWheelEnabled = value === true;
      return { processWheelEnabled };
    },
    async setProcessWheelVisibleCount(value) {
      processWheelVisibleCount = Number(value);
      return { processWheelVisibleCount };
    },
    async setGalleryMediaOrder(value) {
      galleryMediaOrder = [...value];
      return { galleryMediaOrder };
    },
    async setDriveUploadMode(value) {
      driveUploadMode = value;
      return { driveUploadMode };
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

test("public settings default to single-request uploads, traditional buttons, six wheel items, and official photos before guests", async () => {
  await withApis(async (origin) => {
    const response = await fetch(`${origin}/Memories/api/settings`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      primaryNavigationVisible: false,
      guestUploadCategorySelectionEnabled: true,
      processWheelEnabled: false,
      processWheelVisibleCount: 6,
      galleryMediaOrder: [
        "video",
        "text",
        "weddingPhotos",
        "guestPhotos",
      ],
      driveUploadMode: "single",
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

test("administrator can switch between single-request and chunked Drive uploads", async () => {
  await withApis(async (origin) => {
    for (const driveUploadMode of ["chunked", "single"]) {
      const update = await fetch(`${origin}/admin/api/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driveUploadMode }),
      });
      assert.equal(update.status, 200);
      assert.deepEqual(await update.json(), { driveUploadMode });

      const settings = await fetch(`${origin}/Memories/api/settings`).then(
        (response) => response.json(),
      );
      assert.equal(settings.driveUploadMode, driveUploadMode);
    }
  });
});

test("administrator can enable the wheel and choose its mobile visible count", async () => {
  await withApis(async (origin) => {
    const update = await fetch(`${origin}/admin/api/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        processWheelEnabled: true,
        processWheelVisibleCount: 7,
      }),
    });
    assert.equal(update.status, 200);
    assert.deepEqual(await update.json(), {
      processWheelEnabled: true,
      processWheelVisibleCount: 7,
    });

    const publicResponse = await fetch(`${origin}/Memories/api/settings`);
    assert.equal(publicResponse.status, 200);
    const settings = await publicResponse.json();
    assert.equal(settings.processWheelEnabled, true);
    assert.equal(settings.processWheelVisibleCount, 7);
  });
});

test("administrator can reorder video, text, official photos, and guest photos", async () => {
  await withApis(async (origin) => {
    const order = ["text", "video", "guestPhotos", "weddingPhotos"];
    const update = await fetch(`${origin}/admin/api/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ galleryMediaOrder: order }),
    });
    assert.equal(update.status, 200);
    assert.deepEqual(await update.json(), { galleryMediaOrder: order });

    const publicResponse = await fetch(`${origin}/Memories/api/settings`);
    assert.deepEqual((await publicResponse.json()).galleryMediaOrder, order);
  });
});

test("administrator settings reject invalid upload mode, wheel, and media order values", async () => {
  await withApis(async (origin) => {
    for (const invalidMode of ["multipart", "", true, null]) {
      const modeResponse = await fetch(`${origin}/admin/api/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driveUploadMode: invalidMode }),
      });
      assert.equal(modeResponse.status, 422);
      assert.equal((await modeResponse.json()).code, "INVALID_SETTING");
    }

    const wheelResponse = await fetch(`${origin}/admin/api/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ processWheelEnabled: "yes" }),
    });
    assert.equal(wheelResponse.status, 422);
    assert.equal((await wheelResponse.json()).code, "INVALID_SETTING");

    for (const invalidCount of [2, 9, 4.5, "six"]) {
      const countResponse = await fetch(`${origin}/admin/api/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processWheelVisibleCount: invalidCount }),
      });
      assert.equal(countResponse.status, 422);
      assert.equal((await countResponse.json()).code, "INVALID_SETTING");
    }

    for (const invalidOrder of [
      ["video", "text", "weddingPhotos"],
      ["video", "text", "weddingPhotos", "weddingPhotos"],
      ["video", "text", "weddingPhotos", "unknown"],
      "video,text,weddingPhotos,guestPhotos",
    ]) {
      const orderResponse = await fetch(`${origin}/admin/api/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ galleryMediaOrder: invalidOrder }),
      });
      assert.equal(orderResponse.status, 422);
      assert.equal((await orderResponse.json()).code, "INVALID_SETTING");
    }
  });
});
