import assert from "node:assert/strict";
import test from "node:test";
import { createAdminSessionCookie } from "../src/server/admin/auth.mjs";
import { createAdminPhotoApi } from "../src/server/photos/admin-api.mjs";
import { MemoryPhotoRepository } from "../src/server/photos/memory-repository.mjs";
import { TRASH_RETENTION_MS } from "../src/server/photos/trash-cleanup-service.mjs";

const PHOTO_ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-07-01T12:00:00.000Z");

function request(method, path, authenticated = false) {
  return {
    method,
    url: path,
    headers: authenticated
      ? {
          cookie: createAdminSessionCookie({
            configuredToken: "correct-password",
          }).header.split(";", 1)[0],
        }
      : { authorization: "Bearer correct-password" },
  };
}

function responseRecorder() {
  return {
    status: null,
    headers: null,
    body: null,
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
    },
    end(body = "") {
      this.body = body ? JSON.parse(body) : null;
    },
  };
}

function repository() {
  return new MemoryPhotoRepository([
    {
      id: PHOTO_ID,
      driveFileId: "original-drive-file",
      thumbnailDriveFileId: "thumbnail-drive-file",
      originalFilename: "wedding.jpg",
      mimeType: "image/jpeg",
      byteSize: 1024,
      source: "official",
      visibility: "public",
      processingState: "ready",
      processIds: [],
      createdAt: "2026-06-01T12:00:00.000Z",
      updatedAt: "2026-06-01T12:00:00.000Z",
    },
  ]);
}

test("admin photo actions require an administrator session", async () => {
  let called = false;
  const api = createAdminPhotoApi({
    repository: {
      async trashPhotoForRetention() {
        called = true;
      },
    },
    adminToken: "correct-password",
  });
  const response = responseRecorder();

  assert.equal(
    await api(
      request("DELETE", `/Memories/api/admin/photos/${PHOTO_ID}`, false),
      response,
    ),
    true,
  );
  assert.equal(response.status, 401);
  assert.equal(response.body.code, "UNAUTHORIZED");
  assert.equal(called, false);
});

test("admin deletion moves a photo to seven-day trash without touching Drive", async () => {
  const photos = repository();
  const api = createAdminPhotoApi({
    repository: photos,
    adminToken: "correct-password",
    now: () => NOW,
  });
  const response = responseRecorder();

  assert.equal(
    await api(
      request("DELETE", `/Memories/api/admin/photos/${PHOTO_ID}`, true),
      response,
    ),
    true,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    trashed: true,
    photoId: PHOTO_ID,
    restoreUntil: new Date(NOW.getTime() + TRASH_RETENTION_MS).toISOString(),
  });
  assert.deepEqual((await photos.listPublicPhotos()).items, []);
});

test("admin can list trash and restore before the boundary", async () => {
  const photos = repository();
  let current = NOW;
  const api = createAdminPhotoApi({
    repository: photos,
    adminToken: "correct-password",
    now: () => current,
  });
  await api(
    request("DELETE", `/Memories/api/admin/photos/${PHOTO_ID}`, true),
    responseRecorder(),
  );

  const list = responseRecorder();
  await api(request("GET", "/Memories/api/admin/trash", true), list);
  assert.equal(list.status, 200);
  assert.equal(list.body.photos[0].id, PHOTO_ID);

  current = new Date(NOW.getTime() + TRASH_RETENTION_MS - 1);
  const restore = responseRecorder();
  await api(
    request("POST", `/Memories/api/admin/photos/${PHOTO_ID}/restore`, true),
    restore,
  );
  assert.deepEqual(restore.body, { restored: true, photoId: PHOTO_ID });
  assert.equal((await photos.listPublicPhotos()).items.length, 1);
});

test("restore is rejected at the exact retention boundary", async () => {
  const photos = repository();
  let current = NOW;
  const api = createAdminPhotoApi({
    repository: photos,
    adminToken: "correct-password",
    now: () => current,
  });
  await api(
    request("DELETE", `/Memories/api/admin/photos/${PHOTO_ID}`, true),
    responseRecorder(),
  );
  current = new Date(NOW.getTime() + TRASH_RETENTION_MS);

  const response = responseRecorder();
  await api(
    request("POST", `/Memories/api/admin/photos/${PHOTO_ID}/restore`, true),
    response,
  );
  assert.equal(response.status, 409);
  assert.equal(response.body.code, "TRASH_RETENTION_EXPIRED");
});
