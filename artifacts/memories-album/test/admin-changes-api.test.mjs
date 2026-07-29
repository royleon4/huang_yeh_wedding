import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { createAdminChangesApi } from "../src/server/admin/changes-api.mjs";
import { createAdminSessionCookie } from "../src/server/admin/auth.mjs";

const adminToken = "correct-password";

function adminCookie() {
  return createAdminSessionCookie({
    configuredToken: adminToken,
    now: () => 1_000,
    ttlMs: 60_000,
    createNonce: () => "nonce",
  }).value;
}

async function withApi(dependencies, run) {
  const api = createAdminChangesApi({
    ...dependencies,
    adminToken,
    createId: () => "created-id",
  });
  const server = createServer((request, response) => {
    void api(request, response).catch((error) => {
      response.statusCode = 500;
      response.end(JSON.stringify({ error: error.message }));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function dependencies({ renameFails = false } = {}) {
  const albums = [
    {
      id: "wedding",
      titleZh: "婚禮",
      titleEn: "Wedding",
      descriptionZh: "",
      descriptionEn: "",
      displayOrder: 1,
      isVisible: true,
      isSystem: true,
    },
  ];
  const categories = [
    {
      id: "c1",
      labelZh: "進場",
      labelEn: "Entrance",
      displayOrder: 1,
      driveFolderId: "folder-c1",
      driveFolderName: "01 進場",
      syncState: "synced",
      lastSyncedAt: null,
    },
  ];
  const photos = [
    {
      id: "p1",
      displayName: "照片",
      originalFilename: "photo.jpg",
      source: "guest",
      visibility: "public",
      albumIds: ["wedding"],
      processIds: ["c1"],
      createdAt: "2026-06-20T03:00:00.000Z",
    },
  ];

  return {
    albums,
    categories,
    photos,
    albumRepository: {
      listAdminAlbums: async () => albums,
      createAlbum: async (album) => ({ ...album, displayOrder: 2 }),
      updateAlbum: async (album) => {
        Object.assign(albums[0], album);
        return albums[0];
      },
    },
    categoryRepository: {
      listProcesses: async () => categories,
    },
    photoRepository: {
      findPhotoForAdmin: async (id) => photos.find((photo) => photo.id === id),
      updatePhotoForAdmin: async (photo) => {
        Object.assign(photos[0], {
          displayName: photo.displayName,
          visibility: photo.visibility,
          albumIds: photo.albumIds,
          processIds: photo.processIds,
          createdAt: photo.createdAt,
        });
        return photos[0];
      },
    },
    synchronizer: {
      createProcess: async (values) => ({
        id: "new-category",
        ...values,
        displayOrder: 2,
        syncState: "synced",
        lastSyncedAt: null,
      }),
      renameProcess: async (existing, labelZh, labelEn) => {
        if (renameFails) {
          const error = new Error("Drive rename failed");
          error.code = "DRIVE_RETRYABLE";
          throw error;
        }
        Object.assign(categories[0], { labelZh, labelEn });
        return categories[0];
      },
      reorderProcesses: async () => categories,
      movePhotoToProcess: async () => {},
    },
    drive: {
      lifeFolderId: "life-folder",
      move: async () => {},
    },
  };
}

async function patch(base, body) {
  const response = await fetch(`${base}/admin/api/changes`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-Memories-Admin": "1",
      Cookie: `memories_admin_session=${adminCookie()}`,
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

test("applies album, category, and photo edits through one batch request", async () => {
  const state = dependencies();
  await withApi(state, async (base) => {
    const response = await patch(base, {
      albums: {
        update: [{ id: "wedding", changes: { titleZh: "新的婚禮" } }],
      },
      categories: {
        update: [{ id: "c1", changes: { labelEn: "Processional" } }],
      },
      photos: {
        update: [{ id: "p1", changes: { visibility: "hidden" } }],
      },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.summary, {
      attempted: 3,
      succeeded: 3,
      failed: 0,
    });
    assert.equal(state.albums[0].titleZh, "新的婚禮");
    assert.equal(state.categories[0].labelEn, "Processional");
    assert.equal(state.photos[0].visibility, "hidden");
  });
});

test("reports partial failure without discarding successful operations", async () => {
  const state = dependencies({ renameFails: true });
  await withApi(state, async (base) => {
    const response = await patch(base, {
      albums: {
        update: [{ id: "wedding", changes: { titleZh: "已儲存" } }],
      },
      categories: {
        update: [{ id: "c1", changes: { labelZh: "失敗分類" } }],
      },
      photos: { update: [] },
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.summary.succeeded, 1);
    assert.equal(response.body.summary.failed, 1);
    assert.equal(state.albums[0].titleZh, "已儲存");
    assert.equal(response.body.results[1].status, "error");
    assert.equal(response.body.results[1].code, "DRIVE_RETRYABLE");
  });
});
