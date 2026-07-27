import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import express from "express";
import request from "supertest";
import { createPublicAlbumRouter } from "./publicAlbum";
import { InMemoryDriveAdapter } from "../integrations/google-drive/fake";
import { InMemoryPhotoRepository } from "./repository.memory";
import { importLegacyPhotos } from "./legacyImport";

function createTestApp(
  photos: InMemoryPhotoRepository,
  drive: InMemoryDriveAdapter,
) {
  const app = express();
  app.use("/api", createPublicAlbumRouter({ photos, drive }));
  return app;
}

test("lists public photos using opaque IDs and a stable cursor", async () => {
  const photos = new InMemoryPhotoRepository();
  const drive = new InMemoryDriveAdapter();
  const first = await photos.create({
    driveFileId: "drive-secret-a",
    originalFilename: "first.jpg",
    contentType: "image/jpeg",
    byteSize: 5,
    createdAt: new Date("2026-07-27T10:00:00.000Z"),
  });
  const second = await photos.create({
    driveFileId: "drive-secret-b",
    originalFilename: "second.jpg",
    contentType: "image/jpeg",
    byteSize: 6,
    createdAt: new Date("2026-07-27T11:00:00.000Z"),
  });
  await photos.create({
    driveFileId: "drive-secret-hidden",
    originalFilename: "hidden.jpg",
    contentType: "image/jpeg",
    byteSize: 7,
    visibility: "hidden",
    createdAt: new Date("2026-07-27T12:00:00.000Z"),
  });

  const pageOne = await request(createTestApp(photos, drive))
    .get("/api/photos?limit=1")
    .expect(200);

  assert.deepEqual(pageOne.body.photos, [
    {
      id: second.id,
      mediaUrl: `/api/photos/${second.id}/media`,
      contentType: "image/jpeg",
      width: null,
      height: null,
      createdAt: "2026-07-27T11:00:00.000Z",
    },
  ]);
  assert.equal(typeof pageOne.body.nextCursor, "string");
  assert.equal(JSON.stringify(pageOne.body).includes("drive-secret"), false);

  const pageTwo = await request(createTestApp(photos, drive))
    .get(
      `/api/photos?limit=1&cursor=${encodeURIComponent(pageOne.body.nextCursor)}`,
    )
    .expect(200);

  assert.equal(pageTwo.body.photos[0].id, first.id);
  assert.equal(pageTwo.body.nextCursor, null);
});

test("streams media through an opaque photo ID without exposing the Drive ID", async () => {
  const photos = new InMemoryPhotoRepository();
  const drive = new InMemoryDriveAdapter();
  const stored = await drive.upload({
    filename: "memory.webp",
    contentType: "image/webp",
    body: Buffer.from("wedding-memory"),
  });
  const photo = await photos.create({
    driveFileId: stored.fileId,
    originalFilename: "memory.webp",
    contentType: "image/webp",
    byteSize: 14,
  });

  const response = await request(createTestApp(photos, drive))
    .get(`/api/photos/${photo.id}/media`)
    .buffer(true)
    .parse((res, callback) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => callback(null, Buffer.concat(chunks)));
    })
    .expect(200);

  assert.equal(response.headers["content-type"], "image/webp");
  assert.equal(response.headers["x-content-type-options"], "nosniff");
  assert.equal((response.body as Buffer).toString(), "wedding-memory");
  assert.deepEqual(drive.downloadedFileIds, [stored.fileId]);
  assert.equal(response.text?.includes(stored.fileId) ?? false, false);
});

test("does not serve hidden photos", async () => {
  const photos = new InMemoryPhotoRepository();
  const drive = new InMemoryDriveAdapter();
  const hidden = await photos.create({
    driveFileId: "hidden-drive-id",
    originalFilename: "hidden.jpg",
    contentType: "image/jpeg",
    byteSize: 1,
    visibility: "hidden",
  });

  await request(createTestApp(photos, drive))
    .get(`/api/photos/${hidden.id}/media`)
    .expect(404);
  assert.deepEqual(drive.downloadedFileIds, []);
});

test("returns a generic temporary error when Drive is unavailable", async () => {
  const photos = new InMemoryPhotoRepository();
  const drive = new InMemoryDriveAdapter();
  const photo = await photos.create({
    driveFileId: "missing-in-drive",
    originalFilename: "missing.jpg",
    contentType: "image/jpeg",
    byteSize: 1,
  });

  const response = await request(createTestApp(photos, drive))
    .get(`/api/photos/${photo.id}/media`)
    .expect(502);

  assert.deepEqual(response.body, {
    error: "Photo is temporarily unavailable",
  });
  assert.equal(
    JSON.stringify(response.body).includes("missing-in-drive"),
    false,
  );
});

test("compatibility import is idempotent and records only the internal source key", async () => {
  const photos = new InMemoryPhotoRepository();
  const drive = new InMemoryDriveAdapter();
  const source = {
    async *list() {
      yield {
        sourceKey: "photos/wedding/legacy-one.jpg",
        filename: "legacy-one.jpg",
        contentType: "image/jpeg",
        byteSize: 6,
        open: () => Readable.from(Buffer.from("legacy")),
      };
    },
  };

  assert.deepEqual(await importLegacyPhotos({ source, photos, drive }), {
    imported: 1,
    skipped: 0,
  });
  assert.deepEqual(await importLegacyPhotos({ source, photos, drive }), {
    imported: 0,
    skipped: 1,
  });

  const page = await photos.listPublic({ limit: 10 });
  assert.equal(page.items.length, 1);
  assert.equal(page.items[0]?.legacySourceKey, "photos/wedding/legacy-one.jpg");
  assert.equal(drive.uploadedFiles.length, 1);
});
