import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { DEFAULT_GALLERY_MEDIA_ORDER } from "../src/gallery-media-order.mjs";
import { DEFAULT_SITE_COPY, normalizeSiteCopy } from "../src/site-copy.mjs";
import {
  createAdminSettingsApi,
  createSettingsApi,
} from "../src/server/settings/api.mjs";

async function withSettingsServer(run) {
  const state = {
    siteCopy: normalizeSiteCopy(DEFAULT_SITE_COPY),
    driveUploadMode: "single",
    galleryMediaOrder: [...DEFAULT_GALLERY_MEDIA_ORDER],
    processWheelEnabled: false,
    processWheelVisibleCount: 6,
    guestUploadCategorySelectionEnabled: true,
  };
  const repository = {
    async getPublicSettings() {
      return { ...state };
    },
    async setSiteCopy(value) {
      state.siteCopy = normalizeSiteCopy(value);
      return { siteCopy: state.siteCopy };
    },
    async setDriveUploadMode(value) {
      state.driveUploadMode = value;
      return { driveUploadMode: value };
    },
    async setGalleryMediaOrder(value) {
      state.galleryMediaOrder = [...value];
      return { galleryMediaOrder: state.galleryMediaOrder };
    },
    async setProcessWheelEnabled(value) {
      state.processWheelEnabled = value === true;
      return { processWheelEnabled: state.processWheelEnabled };
    },
    async setProcessWheelVisibleCount(value) {
      state.processWheelVisibleCount = Number(value);
      return { processWheelVisibleCount: state.processWheelVisibleCount };
    },
    async setGuestUploadCategorySelectionEnabled(value) {
      state.guestUploadCategorySelectionEnabled = value === true;
      return {
        guestUploadCategorySelectionEnabled:
          state.guestUploadCategorySelectionEnabled,
      };
    },
  };
  const publicApi = createSettingsApi({ repository });
  const adminApi = createAdminSettingsApi({ repository });
  const server = createServer(async (request, response) => {
    if (!(await publicApi(request, response)) && !(await adminApi(request, response))) {
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

async function patch(origin, body) {
  const response = await fetch(`${origin}/admin/api/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  assert.equal(response.status, 200);
  return response.json();
}

async function publicSettings(origin) {
  const response = await fetch(`${origin}/Memories/api/settings`);
  assert.equal(response.status, 200);
  return response.json();
}

test("each setting consolidated under Save All persists through its own request", async () => {
  await withSettingsServer(async (origin) => {
    const siteCopy = normalizeSiteCopy(DEFAULT_SITE_COPY);
    siteCopy.zh.archive = "統一儲存測試";
    assert.deepEqual((await patch(origin, { siteCopy })).siteCopy, siteCopy);
    assert.deepEqual((await publicSettings(origin)).siteCopy, siteCopy);

    assert.equal(
      (await patch(origin, { driveUploadMode: "chunked" })).driveUploadMode,
      "chunked",
    );
    assert.equal((await publicSettings(origin)).driveUploadMode, "chunked");

    const galleryMediaOrder = [
      "text",
      "video",
      "guestPhotos",
      "weddingPhotos",
    ];
    assert.deepEqual(
      (await patch(origin, { galleryMediaOrder })).galleryMediaOrder,
      galleryMediaOrder,
    );
    assert.deepEqual(
      (await publicSettings(origin)).galleryMediaOrder,
      galleryMediaOrder,
    );

    const selectorUpdate = await patch(origin, {
      processWheelEnabled: true,
      processWheelVisibleCount: 8,
    });
    assert.equal(selectorUpdate.processWheelEnabled, true);
    assert.equal(selectorUpdate.processWheelVisibleCount, 8);
    const selectorSettings = await publicSettings(origin);
    assert.equal(selectorSettings.processWheelEnabled, true);
    assert.equal(selectorSettings.processWheelVisibleCount, 8);

    assert.equal(
      (
        await patch(origin, {
          guestUploadCategorySelectionEnabled: false,
        })
      ).guestUploadCategorySelectionEnabled,
      false,
    );
    assert.equal(
      (await publicSettings(origin)).guestUploadCategorySelectionEnabled,
      false,
    );
  });
});
