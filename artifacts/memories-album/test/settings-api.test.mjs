import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_GALLERY_MEDIA_ORDER } from "../src/gallery-media-order.mjs";
import {
  createAdminSettingsApi,
  createSettingsApi,
} from "../src/server/settings/api.mjs";
import { withRequestHandler } from "../test-support/http.mjs";
import {
  assertJsonErrorCases,
  patchJson,
} from "../test-support/validation.mjs";

function createSettingsFixture() {
  const state = {
    guestUploadCategorySelectionEnabled: true,
    processWheelEnabled: false,
    processWheelVisibleCount: 6,
    processWheelLoopAlbumIds: [],
    galleryMediaOrder: [...DEFAULT_GALLERY_MEDIA_ORDER],
    driveUploadMode: "single",
  };

  const repository = {
    async getPublicSettings() {
      return {
        primaryNavigationVisible: false,
        ...state,
        processWheelLoopAlbumIds: [...state.processWheelLoopAlbumIds],
        galleryMediaOrder: [...state.galleryMediaOrder],
      };
    },
    async setGuestUploadCategorySelectionEnabled(value) {
      state.guestUploadCategorySelectionEnabled = value === true;
      return {
        guestUploadCategorySelectionEnabled:
          state.guestUploadCategorySelectionEnabled,
      };
    },
    async setProcessWheelEnabled(value) {
      state.processWheelEnabled = value === true;
      return { processWheelEnabled: state.processWheelEnabled };
    },
    async setProcessWheelVisibleCount(value) {
      state.processWheelVisibleCount = Number(value);
      return { processWheelVisibleCount: state.processWheelVisibleCount };
    },
    async setProcessWheelLoopAlbumIds(value) {
      state.processWheelLoopAlbumIds = [...value];
      return { processWheelLoopAlbumIds: [...state.processWheelLoopAlbumIds] };
    },
    async setGalleryMediaOrder(value) {
      state.galleryMediaOrder = [...value];
      return { galleryMediaOrder: [...state.galleryMediaOrder] };
    },
    async setDriveUploadMode(value) {
      state.driveUploadMode = value;
      return { driveUploadMode: state.driveUploadMode };
    },
  };

  const publicApi = createSettingsApi({ repository });
  const adminApi = createAdminSettingsApi({ repository });
  const withServer = (run) =>
    withRequestHandler(
      async (request, response) =>
        (await publicApi(request, response)) ||
        (await adminApi(request, response)),
      run,
    );

  return { state, withServer };
}

async function publicSettings(origin) {
  const response = await fetch(`${origin}/Memories/api/settings`);
  assert.equal(response.status, 200);
  return response.json();
}

test("public settings expose the documented defaults", async () => {
  const { withServer } = createSettingsFixture();
  await withServer(async (origin) => {
    assert.deepEqual(await publicSettings(origin), {
      primaryNavigationVisible: false,
      guestUploadCategorySelectionEnabled: true,
      processWheelEnabled: false,
      processWheelVisibleCount: 6,
      processWheelLoopAlbumIds: [],
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

test("administrator setting updates persist to the public API", async (t) => {
  const { withServer } = createSettingsFixture();
  await withServer(async (origin) => {
    const cases = [
      {
        name: "visitor category selection",
        body: { guestUploadCategorySelectionEnabled: false },
      },
      {
        name: "Drive upload mode",
        body: { driveUploadMode: "chunked" },
      },
      {
        name: "wheel configuration",
        body: {
          processWheelEnabled: true,
          processWheelVisibleCount: 7,
          processWheelLoopAlbumIds: ["guest"],
        },
      },
      {
        name: "gallery media order",
        body: {
          galleryMediaOrder: [
            "text",
            "video",
            "guestPhotos",
            "weddingPhotos",
          ],
        },
      },
    ];

    for (const { name, body } of cases) {
      await t.test(name, async () => {
        const update = await patchJson(`${origin}/admin/api/settings`, body);
        assert.equal(update.status, 200);
        assert.deepEqual(await update.json(), body);

        const settings = await publicSettings(origin);
        for (const [key, value] of Object.entries(body)) {
          assert.deepEqual(settings[key], value);
        }
      });
    }
  });
});

test("administrator settings reject every invalid value at the API boundary", async (t) => {
  const { withServer } = createSettingsFixture();
  await withServer(async (origin) => {
    const invalidSettings = [
      ...["multipart", "", true, null].map((value) => ({
        name: `upload mode ${JSON.stringify(value)}`,
        value: { driveUploadMode: value },
      })),
      {
        name: "non-boolean wheel enabled flag",
        value: { processWheelEnabled: "yes" },
      },
      ...[2, 9, 4.5, "six"].map((value) => ({
        name: `wheel visible count ${JSON.stringify(value)}`,
        value: { processWheelVisibleCount: value },
      })),
      ...[
        ["unknown"],
        ["guest", "guest"],
        ["guest", "wedding", "extra"],
        "guest",
      ].map((value) => ({
        name: `wheel loop albums ${JSON.stringify(value)}`,
        value: { processWheelLoopAlbumIds: value },
      })),
      ...[
        ["video", "text", "weddingPhotos"],
        ["video", "text", "weddingPhotos", "weddingPhotos"],
        ["video", "text", "weddingPhotos", "unknown"],
        "video,text,weddingPhotos,guestPhotos",
      ].map((value) => ({
        name: `gallery media order ${JSON.stringify(value)}`,
        value: { galleryMediaOrder: value },
      })),
    ];

    await assertJsonErrorCases(
      t,
      invalidSettings,
      (body) => patchJson(`${origin}/admin/api/settings`, body),
      { status: 422, code: "INVALID_SETTING" },
    );
  });
});
