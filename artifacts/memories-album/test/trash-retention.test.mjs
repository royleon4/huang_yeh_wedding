import assert from "node:assert/strict";
import test from "node:test";
import { MemoryPhotoRepository } from "../src/server/photos/memory-repository.mjs";
import {
  TRASH_RETENTION_MS,
  TrashCleanupService,
} from "../src/server/photos/trash-cleanup-service.mjs";

const PHOTO_ID = "11111111-1111-4111-8111-111111111111";
const BATCH_ID = "22222222-2222-4222-8222-222222222222";
const TRASHED_AT = new Date("2026-07-01T12:00:00.000Z");

function photo() {
  return {
    id: PHOTO_ID,
    batchId: BATCH_ID,
    driveFileId: "original-drive-file",
    thumbnailDriveFileId: "thumbnail-drive-file",
    originalFilename: "wedding.jpg",
    mimeType: "image/jpeg",
    byteSize: 1024,
    source: "guest",
    uploaderName: "Guest",
    collection: "guest",
    visibility: "public",
    processingState: "ready",
    processIds: ["ceremony"],
    createdAt: "2026-06-01T12:00:00.000Z",
    updatedAt: "2026-06-01T12:00:00.000Z",
  };
}

function repository() {
  return new MemoryPhotoRepository(
    [photo()],
    [
      {
        id: BATCH_ID,
        uploaderType: "guest",
        uploaderName: "Guest",
        tokenHash: "hash",
        status: "open",
        createdAt: "2026-06-01T12:00:00.000Z",
        updatedAt: "2026-06-01T12:00:00.000Z",
      },
    ],
  );
}

test("trashing immediately hides a photo and preserves it for exactly seven days", async () => {
  const photos = repository();

  const trashed = await photos.trashPhotoForRetention({
    photoId: PHOTO_ID,
    trashedAt: TRASHED_AT.toISOString(),
  });

  assert.equal(trashed.photo.id, PHOTO_ID);
  assert.equal(
    trashed.restoreUntil,
    new Date(TRASHED_AT.getTime() + TRASH_RETENTION_MS).toISOString(),
  );
  assert.deepEqual((await photos.listPublicPhotos()).items, []);
  assert.deepEqual(await photos.listBatchPhotos(BATCH_ID), []);

  const trash = await photos.listTrashedPhotos();
  assert.equal(trash.length, 1);
  assert.equal(trash[0].id, PHOTO_ID);
  assert.equal(trash[0].restoreUntil, trashed.restoreUntil);
});

test("restore just before the boundary preserves batch and process relationships", async () => {
  const photos = repository();
  await photos.trashPhotoForRetention({
    photoId: PHOTO_ID,
    trashedAt: TRASHED_AT.toISOString(),
  });

  const restored = await photos.restoreTrashedPhoto({
    photoId: PHOTO_ID,
    now: new Date(TRASHED_AT.getTime() + TRASH_RETENTION_MS - 1).toISOString(),
  });

  assert.equal(restored.id, PHOTO_ID);
  assert.equal(restored.batchId, BATCH_ID);
  assert.deepEqual(restored.processIds, ["ceremony"]);
  assert.equal((await photos.listPublicPhotos()).items.length, 1);
  assert.deepEqual(await photos.listTrashedPhotos(), []);
});

test("at the exact boundary restore is rejected and cleanup becomes eligible", async () => {
  const photos = repository();
  await photos.trashPhotoForRetention({
    photoId: PHOTO_ID,
    trashedAt: TRASHED_AT.toISOString(),
  });
  const boundary = new Date(
    TRASHED_AT.getTime() + TRASH_RETENTION_MS,
  ).toISOString();

  assert.equal(
    await photos.restoreTrashedPhoto({ photoId: PHOTO_ID, now: boundary }),
    null,
  );
  assert.equal(
    (await photos.claimExpiredTrash({ now: boundary, limit: 10 })).length,
    1,
  );
});

test("cleanup deletes derivatives before originals and removes the database record", async () => {
  const photos = repository();
  await photos.trashPhotoForRetention({
    photoId: PHOTO_ID,
    trashedAt: TRASHED_AT.toISOString(),
  });
  const deleted = [];
  const cleanup = new TrashCleanupService({
    repository: photos,
    drive: {
      async delete(fileId) {
        deleted.push(fileId);
      },
    },
    now: () => new Date(TRASHED_AT.getTime() + TRASH_RETENTION_MS),
  });

  assert.deepEqual(await cleanup.runOnce(), {
    claimed: 1,
    deleted: 1,
    retried: 0,
  });
  assert.deepEqual(deleted, ["thumbnail-drive-file", "original-drive-file"]);
  assert.deepEqual(await photos.listTrashedPhotos(), []);
  assert.deepEqual(await cleanup.runOnce(), {
    claimed: 0,
    deleted: 0,
    retried: 0,
  });
});

test("missing Drive files are idempotent cleanup success", async () => {
  const photos = repository();
  await photos.trashPhotoForRetention({
    photoId: PHOTO_ID,
    trashedAt: TRASHED_AT.toISOString(),
  });
  const cleanup = new TrashCleanupService({
    repository: photos,
    drive: {
      async delete() {
        const error = new Error("missing");
        error.status = 404;
        throw error;
      },
    },
    now: () => new Date(TRASHED_AT.getTime() + TRASH_RETENTION_MS),
  });

  assert.equal((await cleanup.runOnce()).deleted, 1);
  assert.deepEqual(await photos.listTrashedPhotos(), []);
});

test("temporary Drive failure keeps recovery data and can resume after restart", async () => {
  const photos = repository();
  await photos.trashPhotoForRetention({
    photoId: PHOTO_ID,
    trashedAt: TRASHED_AT.toISOString(),
  });
  const boundary = new Date(TRASHED_AT.getTime() + TRASH_RETENTION_MS);
  const failing = new TrashCleanupService({
    repository: photos,
    drive: {
      async delete() {
        const error = new Error("temporary Drive error");
        error.code = "DRIVE_RETRYABLE";
        throw error;
      },
    },
    now: () => boundary,
  });

  assert.deepEqual(await failing.runOnce(), {
    claimed: 1,
    deleted: 0,
    retried: 1,
  });
  const retained = await photos.listTrashedPhotos();
  assert.equal(retained[0].driveFileId, "original-drive-file");
  assert.equal(retained[0].thumbnailDriveFileId, "thumbnail-drive-file");

  const deleted = [];
  const resumed = new TrashCleanupService({
    repository: photos,
    drive: {
      async delete(fileId) {
        deleted.push(fileId);
      },
    },
    now: () => boundary,
  });
  assert.equal((await resumed.runOnce()).deleted, 1);
  assert.deepEqual(deleted, ["thumbnail-drive-file", "original-drive-file"]);
});

test("guest withdrawal enters the same persistent cleanup workflow", async () => {
  const photos = repository();

  const withdrawn = await photos.trashBatchPhoto({
    batchId: BATCH_ID,
    photoId: PHOTO_ID,
    trashedAt: TRASHED_AT.toISOString(),
  });

  assert.equal(
    withdrawn.restoreUntil,
    new Date(TRASHED_AT.getTime() + TRASH_RETENTION_MS).toISOString(),
  );
  assert.equal((await photos.listTrashedPhotos())[0].id, PHOTO_ID);
});
