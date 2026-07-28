import assert from "node:assert/strict";
import test from "node:test";
import { MemoryPhotoRepository } from "../src/server/photos/memory-repository.mjs";
import { ThumbnailService } from "../src/server/photos/thumbnail-service.mjs";

function photo(index) {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    driveFileId: `original-${index}`,
    thumbnailDriveFileId: null,
    originalFilename: `photo-${index}.jpg`,
    mimeType: "image/jpeg",
    byteSize: 100,
    contentHash: `hash-${index}`,
    contentVersion: 1,
    source: "official",
    uploaderName: "婚禮攝影",
    visibility: "public",
    processingState: "ready",
    processIds: [],
    createdAt: `2026-06-20T01:00:0${index}.000Z`,
    updatedAt: `2026-06-20T01:00:0${index}.000Z`,
  };
}

test("limits simultaneous full-original thumbnail generation", async () => {
  const photos = [photo(1), photo(2), photo(3), photo(4)];
  const repository = new MemoryPhotoRepository(photos);
  let active = 0;
  let maximumActive = 0;
  let uploadCount = 0;
  const drive = {
    async listChildren() {
      return [];
    },
    async download() {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active -= 1;
      return {
        body: Buffer.from("original-image"),
        contentType: "image/jpeg",
        contentLength: 14,
      };
    },
    async uploadThumbnail({ filename }) {
      uploadCount += 1;
      return { fileId: `thumb-${uploadCount}`, name: filename, size: 5 };
    },
    async delete() {},
  };
  const imageProcessor = {
    async createThumbnail() {
      return {
        thumbnailBytes: Buffer.from("thumb"),
        thumbnailContentType: "image/webp",
      };
    },
  };
  const service = new ThumbnailService({
    repository,
    drive,
    imageProcessor,
    thumbnailFolderId: "thumbnail-folder",
    maxConcurrent: 2,
  });

  await Promise.all(photos.map((item) => service.ensurePhotoThumbnail(item)));

  assert.equal(maximumActive, 2);
  assert.equal(uploadCount, 4);
});
