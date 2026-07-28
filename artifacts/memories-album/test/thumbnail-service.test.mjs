import assert from "node:assert/strict";
import test from "node:test";
import { MemoryPhotoRepository } from "../src/server/photos/memory-repository.mjs";
import {
  ThumbnailService,
  thumbnailFilenameForDriveFileId,
} from "../src/server/photos/thumbnail-service.mjs";

function photo(overrides = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    driveFileId: "original-drive-file-1",
    thumbnailDriveFileId: null,
    originalFilename: "photo.jpg",
    mimeType: "image/jpeg",
    byteSize: 12,
    contentHash: "hash-1",
    contentVersion: 1,
    source: "official",
    uploaderName: "婚禮攝影",
    visibility: "public",
    processingState: "ready",
    processIds: [],
    createdAt: "2026-06-20T01:00:00.000Z",
    updatedAt: "2026-06-20T01:00:00.000Z",
    ...overrides,
  };
}

class FakeDrive {
  constructor(thumbnails = []) {
    this.thumbnails = [...thumbnails];
    this.uploads = [];
    this.downloads = [];
    this.deleted = [];
  }

  async listChildren() {
    return [...this.thumbnails];
  }

  async download(fileId) {
    this.downloads.push(fileId);
    return {
      body: Buffer.from("original-image"),
      contentType: "image/jpeg",
      contentLength: 14,
    };
  }

  async uploadThumbnail(input) {
    const fileId = `generated-thumb-${this.uploads.length + 1}`;
    this.uploads.push({ ...input, fileId });
    this.thumbnails.push({
      id: fileId,
      name: input.filename,
      mimeType: input.contentType,
    });
    return { fileId, name: input.filename, size: input.bytes.length };
  }

  async delete(fileId) {
    this.deleted.push(fileId);
  }
}

const imageProcessor = {
  calls: 0,
  async createThumbnail() {
    this.calls += 1;
    return {
      thumbnailBytes: Buffer.from("compressed-webp"),
      thumbnailContentType: "image/webp",
    };
  },
};

test("keeps an already linked thumbnail without Drive work", async () => {
  const repository = new MemoryPhotoRepository([
    photo({ thumbnailDriveFileId: "existing-linked-thumb" }),
  ]);
  const drive = new FakeDrive();
  const service = new ThumbnailService({
    repository,
    drive,
    imageProcessor,
    thumbnailFolderId: "thumbnail-folder",
  });

  const result = await service.ensurePhotoThumbnail(
    await repository.findPublicPhoto(photo().id),
  );

  assert.equal(result.thumbnailDriveFileId, "existing-linked-thumb");
  assert.equal(drive.downloads.length, 0);
  assert.equal(drive.uploads.length, 0);
});

test("reattaches a deterministic existing thumbnail instead of duplicating it", async () => {
  const source = photo();
  const filename = thumbnailFilenameForDriveFileId(source.driveFileId);
  const repository = new MemoryPhotoRepository([source]);
  const drive = new FakeDrive([
    { id: "existing-drive-thumb", name: filename, mimeType: "image/webp" },
  ]);
  const service = new ThumbnailService({
    repository,
    drive,
    imageProcessor,
    thumbnailFolderId: "thumbnail-folder",
  });

  const result = await service.ensurePhotoThumbnail(source);

  assert.equal(result.thumbnailDriveFileId, "existing-drive-thumb");
  assert.equal(drive.downloads.length, 0);
  assert.equal(drive.uploads.length, 0);
});

test("concurrent requests create only one compressed thumbnail", async () => {
  const source = photo();
  const repository = new MemoryPhotoRepository([source]);
  const drive = new FakeDrive();
  const processor = {
    calls: 0,
    async createThumbnail() {
      this.calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return {
        thumbnailBytes: Buffer.from("compressed-webp"),
        thumbnailContentType: "image/webp",
      };
    },
  };
  const service = new ThumbnailService({
    repository,
    drive,
    imageProcessor: processor,
    thumbnailFolderId: "thumbnail-folder",
  });

  const [left, right] = await Promise.all([
    service.ensurePhotoThumbnail(source),
    service.ensurePhotoThumbnail(source),
  ]);

  assert.equal(left.thumbnailDriveFileId, right.thumbnailDriveFileId);
  assert.equal(drive.downloads.length, 1);
  assert.equal(drive.uploads.length, 1);
  assert.equal(processor.calls, 1);
});

test("background backfill processes every missing thumbnail and skips existing ones", async () => {
  const repository = new MemoryPhotoRepository([
    photo(),
    photo({
      id: "22222222-2222-4222-8222-222222222222",
      driveFileId: "original-drive-file-2",
      contentHash: "hash-2",
      createdAt: "2026-06-20T02:00:00.000Z",
    }),
    photo({
      id: "33333333-3333-4333-8333-333333333333",
      driveFileId: "original-drive-file-3",
      thumbnailDriveFileId: "already-there",
      contentHash: "hash-3",
      createdAt: "2026-06-20T03:00:00.000Z",
    }),
  ]);
  const drive = new FakeDrive();
  const processor = {
    async createThumbnail() {
      return {
        thumbnailBytes: Buffer.from("compressed-webp"),
        thumbnailContentType: "image/webp",
      };
    },
  };
  const service = new ThumbnailService({
    repository,
    drive,
    imageProcessor: processor,
    thumbnailFolderId: "thumbnail-folder",
    batchSize: 1,
  });

  const result = await service.backfillMissing({ maxPhotos: 10 });

  assert.equal(result.createdOrAttached, 2);
  assert.equal(result.failures.length, 0);
  assert.equal(drive.uploads.length, 2);
  assert.equal(
    (await repository.findPublicPhoto("33333333-3333-4333-8333-333333333333"))
      .thumbnailDriveFileId,
    "already-there",
  );
});
