import assert from "node:assert/strict";
import test from "node:test";
import { MemoryPhotoRepository } from "../src/server/photos/memory-repository.mjs";
import {
  ThumbnailService,
  thumbnailFilenameForDriveFileId,
} from "../src/server/photos/thumbnail-service.mjs";

const source = {
  id: "11111111-1111-4111-8111-111111111111",
  driveFileId: "original-drive-file",
  thumbnailDriveFileId: null,
  originalFilename: "photo.jpg",
  mimeType: "image/jpeg",
  byteSize: 100,
  contentHash: "hash",
  contentVersion: 1,
  source: "official",
  uploaderName: "婚禮攝影",
  visibility: "public",
  processingState: "ready",
  processIds: [],
  createdAt: "2026-06-20T01:00:00.000Z",
  updatedAt: "2026-06-20T01:00:00.000Z",
};

test("an unreadable same-name Drive thumbnail is ignored and replaced", async () => {
  const filename = thumbnailFilenameForDriveFileId(source.driveFileId);
  const repository = new MemoryPhotoRepository([source]);
  const downloads = [];
  let uploadCount = 0;
  const drive = {
    async listChildren() {
      return [{ id: "inaccessible-thumb", name: filename, mimeType: "image/webp" }];
    },
    async download(fileId) {
      downloads.push(fileId);
      if (fileId === "inaccessible-thumb") {
        const error = new Error("Forbidden");
        error.code = "DRIVE_AUTHORIZATION_REQUIRED";
        error.status = 403;
        throw error;
      }
      const body = Buffer.from(
        fileId === source.driveFileId ? "original-image" : "new-thumbnail",
      );
      return {
        body,
        contentType: fileId === source.driveFileId ? "image/jpeg" : "image/webp",
        contentLength: body.length,
      };
    },
    async uploadThumbnail() {
      uploadCount += 1;
      return { fileId: "replacement-thumb", name: filename, size: 13 };
    },
    async delete() {},
  };
  const service = new ThumbnailService({
    repository,
    drive,
    imageProcessor: {
      async createThumbnail() {
        return {
          thumbnailBytes: Buffer.from("new-thumbnail"),
          thumbnailContentType: "image/webp",
        };
      },
    },
    thumbnailFolderId: "thumbnail-folder",
    retryAttempts: 1,
  });

  const result = await service.ensurePhotoThumbnail(source);

  assert.equal(result.thumbnailDriveFileId, "replacement-thumb");
  assert.equal(uploadCount, 1);
  assert.deepEqual(downloads, [
    "inaccessible-thumb",
    "inaccessible-thumb",
    "inaccessible-thumb",
    source.driveFileId,
    "replacement-thumb",
  ]);
});
