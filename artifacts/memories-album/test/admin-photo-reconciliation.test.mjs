import assert from "node:assert/strict";
import test from "node:test";
import { MemoryPhotoRepository } from "../src/server/photos/memory-repository.mjs";

test("administrator capture time and album edits survive Drive reconciliation", async () => {
  const repository = new MemoryPhotoRepository([
    {
      id: "photo-1",
      driveFileId: "drive-photo-1",
      originalFilename: "original.jpg",
      displayName: "Original",
      mimeType: "image/jpeg",
      byteSize: 12,
      contentHash: "drive:drive-photo-1",
      source: "official",
      visibility: "public",
      processingState: "ready",
      driveParentFolderId: "drive-wedding",
      collection: "wedding",
      albumIds: ["wedding"],
      processIds: ["ceremony"],
      createdAt: "2026-06-20T01:00:00.000Z",
      updatedAt: "2026-06-20T01:00:00.000Z",
    },
  ]);

  await repository.updatePhotoForAdmin({
    id: "photo-1",
    displayName: "Our story",
    visibility: "public",
    createdAt: "2025-12-24T08:30:00.000Z",
    albumIds: ["story"],
    processIds: [],
  });

  await repository.upsertDrivePhotoMetadata(
    {
      id: "drive-photo-1",
      name: "renamed-in-drive.jpg",
      mimeType: "image/jpeg",
      size: "15",
      modifiedTime: "2026-07-29T10:00:00.000Z",
    },
    {
      source: "official",
      parentFolderId: "drive-wedding",
      collection: "wedding",
    },
  );
  await repository.replacePhotoProcessByDriveFile(
    "drive-photo-1",
    "ceremony",
    "drive-wedding",
    "wedding",
  );

  const photo = await repository.findPhotoForAdmin("photo-1");
  assert.equal(photo.createdAt, "2025-12-24T08:30:00.000Z");
  assert.deepEqual(photo.albumIds, ["story"]);
  assert.deepEqual(photo.processIds, ["ceremony"]);
  assert.equal(photo.originalFilename, "renamed-in-drive.jpg");
});
