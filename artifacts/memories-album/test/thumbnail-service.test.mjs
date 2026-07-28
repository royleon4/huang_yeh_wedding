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
    this.missing = new Set();
  }

  async listChildren() {
    return this.thumbnails.filter((item) => !this.missing.has(item.id));
  }

  async download(fileId) {
    this.downloads.push(fileId);
    if (this.missing.has(fileId)) {
      const error = new Error("Not found");
      error.status = 404;
      throw error;
    }
    return {
      body: Buffer.from(
        fileId.startsWith("generated-thumb") || fileId.includes("drive-thumb")
          ? "compressed-webp"
          : "original-image",
      ),
      contentType: fileId.includes("thumb") ? "image/webp" : "image/jpeg",
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

test("reattaches a verified deterministic existing thumbnail instead of duplicating it", async () => {
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
  assert.deepEqual(drive.downloads, ["existing-drive-thumb"]);
  assert.equal(drive.uploads.length, 0);
});

test("concurrent requests create one compressed thumbnail and verify it before DB attachment", async () => {
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
  assert.deepEqual(drive.downloads, ["original-drive-file-1", "generated-thumb-1"]);
  assert.equal(drive.uploads.length, 1);
  assert.equal(processor.calls, 1);
});

test("repairs a DB thumbnail reference whose Drive file no longer exists", async () => {
  const stale = photo({ thumbnailDriveFileId: "deleted-thumbnail" });
  const repository = new MemoryPhotoRepository([stale]);
  const drive = new FakeDrive();
  drive.missing.add("deleted-thumbnail");
  const service = new ThumbnailService({
    repository,
    drive,
    imageProcessor: {
      async createThumbnail() {
        return {
          thumbnailBytes: Buffer.from("compressed-webp"),
          thumbnailContentType: "image/webp",
        };
      },
    },
    thumbnailFolderId: "thumbnail-folder",
  });

  const repaired = await service.repairPhotoThumbnail(stale);

  assert.equal(repaired.thumbnailDriveFileId, "generated-thumb-1");
  assert.deepEqual(drive.downloads, ["original-drive-file-1", "generated-thumb-1"]);
  assert.equal(
    (await repository.findPublicPhoto(stale.id)).thumbnailDriveFileId,
    "generated-thumb-1",
  );
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
  assert.equal(drive.downloads.length, 4);
  assert.equal(
    (await repository.findPublicPhoto("33333333-3333-4333-8332-333333333333"))
      ?.thumbnailDriveFileId,
    undefined,
  );
  assert.equal(
    (await repository.findPublicPhoto("33333333-3333-4333-8333-333333333333"))
      .thumbnailDriveFileId,
    "already-there",
  );
});
