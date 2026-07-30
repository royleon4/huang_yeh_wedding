import assert from "node:assert/strict";
import test from "node:test";
import { adminRequest } from "../src/client/admin-client.mjs";

function ok(body) {
  return { ok: true, json: async () => body };
}

test("global save verifies album, category, photo, summary, and uploader persistence", async () => {
  const requested = [];
  const body = {
    albums: {
      create: [],
      update: [
        {
          id: "wedding",
          changes: {
            titleZh: "婚禮流程",
            titleEn: "Wedding moments",
            descriptionZh: "新的介紹",
            descriptionEn: "Updated introduction",
            isVisible: true,
            showSummary: false,
          },
        },
      ],
    },
    categories: {
      create: [],
      update: [{ id: "process-1", changes: { labelZh: "進場", labelEn: "Entrance" } }],
    },
    photos: {
      update: [
        {
          id: "photo-1",
          changes: {
            displayName: "進場照片",
            uploaderName: "婚禮攝影",
            visibility: "public",
            albumIds: ["wedding"],
            categoryIds: ["process-1"],
            capturedAt: "2026-06-20T03:00:00.000Z",
          },
        },
      ],
    },
  };

  const result = await adminRequest("/admin/api/changes", {
    method: "PATCH",
    body,
    fetchImpl: async (path, options) => {
      requested.push({ path, options });
      if (path === "/Memories/admin/api/changes") {
        return ok({
          results: [
            {
              key: "album:update:wedding",
              id: "wedding",
              type: "album.update",
              status: "ok",
              album: {
                id: "wedding",
                titleZh: "婚禮流程",
                titleEn: "Wedding moments",
                descriptionZh: "新的介紹",
                descriptionEn: "Updated introduction",
                isVisible: true,
              },
            },
            {
              key: "category:update:process-1",
              id: "process-1",
              type: "category.update",
              status: "ok",
              category: {
                id: "process-1",
                labelZh: "進場",
                labelEn: "Entrance",
              },
            },
            {
              key: "photo:update:photo-1",
              id: "photo-1",
              type: "photo.update",
              status: "ok",
              photo: {
                id: "photo-1",
                displayName: "進場照片",
                visibility: "public",
                albumIds: ["wedding"],
                categoryIds: ["process-1"],
                capturedAt: "2026-06-20T03:00:00.000Z",
              },
            },
          ],
          summary: { attempted: 3, succeeded: 3, failed: 0 },
        });
      }
      if (path === "/Memories/admin/api/albums/wedding") {
        assert.deepEqual(JSON.parse(options.body), { showSummary: false });
        return ok({ album: { id: "wedding", showSummary: false } });
      }
      if (path === "/Memories/admin/api/photos/photo-1/uploader") {
        assert.deepEqual(JSON.parse(options.body), { uploaderName: "婚禮攝影" });
        return ok({
          uploader: {
            id: "photo-1",
            uploaderName: "婚禮攝影",
            deleteProtected: true,
          },
        });
      }
      throw new Error(`Unexpected request: ${path}`);
    },
  });

  assert.deepEqual(result.summary, { attempted: 3, succeeded: 3, failed: 0 });
  assert.ok(result.results.every((item) => item.status === "ok"));
  assert.deepEqual(
    requested.map((item) => item.path),
    [
      "/Memories/admin/api/changes",
      "/Memories/admin/api/albums/wedding",
      "/Memories/admin/api/photos/photo-1/uploader",
    ],
  );
});

test("global save retains a draft when the success payload does not contain the requested value", async () => {
  const result = await adminRequest("/admin/api/changes", {
    method: "PATCH",
    body: {
      albums: { create: [], update: [] },
      categories: { create: [], update: [] },
      photos: {
        update: [
          {
            id: "photo-1",
            changes: {
              displayName: "新名稱",
              visibility: "hidden",
              albumIds: ["wedding"],
              categoryIds: [],
              capturedAt: "2026-06-20T03:00:00.000Z",
            },
          },
        ],
      },
    },
    fetchImpl: async () =>
      ok({
        results: [
          {
            key: "photo:update:photo-1",
            id: "photo-1",
            type: "photo.update",
            status: "ok",
            photo: {
              id: "photo-1",
              displayName: "舊名稱",
              visibility: "public",
              albumIds: ["wedding"],
              categoryIds: [],
              capturedAt: "2026-06-20T03:00:00.000Z",
            },
          },
        ],
        summary: { attempted: 1, succeeded: 1, failed: 0 },
      }),
  });

  assert.equal(result.results[0].status, "error");
  assert.equal(result.results[0].code, "PERSISTENCE_MISMATCH");
  assert.match(result.results[0].error, /displayName/);
  assert.match(result.results[0].error, /visibility/);
  assert.deepEqual(result.summary, { attempted: 1, succeeded: 0, failed: 1 });
});

test("every settings save button requires the server to echo the stored value", async () => {
  const cases = [
    { guestUploadCategorySelectionEnabled: false },
    { processWheelEnabled: true, processWheelVisibleCount: 7 },
    { galleryMediaOrder: ["text", "video", "guestPhotos", "weddingPhotos"] },
    { pinnedPhotoIdsByProcess: { all: ["photo-1", "photo-2"] } },
  ];

  for (const settings of cases) {
    const saved = await adminRequest("/admin/api/settings", {
      method: "PATCH",
      body: settings,
      fetchImpl: async () => ok(settings),
    });
    assert.deepEqual(saved, settings);
  }

  await assert.rejects(
    adminRequest("/admin/api/settings", {
      method: "PATCH",
      body: { processWheelEnabled: true },
      fetchImpl: async () => ok({ processWheelEnabled: false }),
    }),
    (error) => error.code === "PERSISTENCE_MISMATCH",
  );
});

test("category video and rich-content save buttons verify all returned fields", async () => {
  const category = await adminRequest("/admin/api/categories/process-1", {
    method: "PATCH",
    body: {
      labelZh: "證婚",
      labelEn: "Ceremony",
      youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      youtubeAutoplay: true,
    },
    fetchImpl: async () =>
      ok({
        category: {
          id: "process-1",
          labelZh: "證婚",
          labelEn: "Ceremony",
          youtubeVideoId: "dQw4w9WgXcQ",
          youtubeAutoplay: true,
        },
      }),
  });
  assert.equal(category.category.youtubeAutoplay, true);

  const contentBody = {
    labelZh: "全部流程",
    labelEn: "All moments",
    youtubeUrl: "https://youtu.be/dQw4w9WgXcQ",
    youtubeAutoplay: false,
    showAllPhotos: false,
    contentHtmlZh: "<p>中文內容</p>",
    contentHtmlEn: "<p>English content</p>",
    dividerPaddingTop: 18,
    dividerPaddingBottom: 20,
  };
  const content = await adminRequest("/admin/api/process-content/all", {
    method: "PATCH",
    body: contentBody,
    fetchImpl: async () =>
      ok({
        content: {
          processKey: "all",
          labelZh: "全部流程",
          labelEn: "All moments",
          youtubeVideoId: "dQw4w9WgXcQ",
          youtubeAutoplay: false,
          showAllPhotos: false,
          contentHtmlZh: "<p>中文內容</p>",
          contentHtmlEn: "<p>English content</p>",
          dividerPaddingTop: 18,
          dividerPaddingBottom: 20,
        },
      }),
  });
  assert.equal(content.content.showAllPhotos, false);

  await assert.rejects(
    adminRequest("/admin/api/process-content/all", {
      method: "PATCH",
      body: contentBody,
      fetchImpl: async () =>
        ok({
          content: {
            ...content.content,
            showAllPhotos: true,
          },
        }),
    }),
    (error) => error.code === "PERSISTENCE_MISMATCH",
  );
});
