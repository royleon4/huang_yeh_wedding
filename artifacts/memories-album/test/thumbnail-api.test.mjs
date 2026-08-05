import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { createMemoriesPhotoApi } from "../src/server/photos/api.mjs";
import { MemoryPhotoRepository } from "../src/server/photos/memory-repository.mjs";

const photoId = "11111111-1111-4111-8111-111111111111";

function sourcePhoto(overrides = {}) {
  return {
    id: photoId,
    driveFileId: "private-original-id",
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
    ...overrides,
  };
}

async function withApi(
  { thumbnailService = null, photo = sourcePhoto(), download = null },
  run,
) {
  const repository = new MemoryPhotoRepository([photo]);
  const downloads = [];
  const drive = {
    async download(fileId) {
      downloads.push(fileId);
      if (download) return download(fileId);
      const body = Buffer.from(
        fileId === "generated-thumbnail-id" ||
          fileId === "existing-thumbnail-id"
          ? "thumbnail"
          : "original",
      );
      return {
        body,
        contentType: fileId.includes("thumbnail") ? "image/webp" : "image/jpeg",
        contentLength: body.length,
      };
    },
  };
  const api = createMemoriesPhotoApi({ repository, drive, thumbnailService });
  const server = createServer(async (request, response) => {
    if (!(await api(request, response))) {
      response.statusCode = 404;
      response.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`, {
      repository,
      downloads,
    });
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test("thumbnail requests generate or attach a thumbnail before streaming", async () => {
  let repository;
  const thumbnailService = {
    async ensurePhotoThumbnail(photo) {
      return repository.attachThumbnail(photo.id, "generated-thumbnail-id");
    },
  };

  await withApi({ thumbnailService }, async (origin, context) => {
    repository = context.repository;
    const response = await fetch(
      `${origin}/Memories/api/photos/${photoId}/thumbnail`,
    );
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "thumbnail");
    assert.deepEqual(context.downloads, ["generated-thumbnail-id"]);
    assert.equal(response.headers.get("x-memories-thumbnail-cache"), "miss");
    assert.equal(
      response.headers.get("cache-control"),
      "public, max-age=31536000, immutable",
    );
  });
});

test("repeated thumbnail requests reuse the bounded server hot cache", async () => {
  await withApi(
    {
      photo: sourcePhoto({ thumbnailDriveFileId: "existing-thumbnail-id" }),
    },
    async (origin, context) => {
      const url = `${origin}/Memories/api/photos/${photoId}/thumbnail`;
      const first = await fetch(url);
      assert.equal(first.status, 200);
      assert.equal(await first.text(), "thumbnail");
      assert.equal(first.headers.get("x-memories-thumbnail-cache"), "miss");

      const second = await fetch(url);
      assert.equal(second.status, 200);
      assert.equal(await second.text(), "thumbnail");
      assert.equal(second.headers.get("x-memories-thumbnail-cache"), "hit");
      assert.deepEqual(context.downloads, ["existing-thumbnail-id"]);
    },
  );
});

test("a stale Drive thumbnail id is cleared, rebuilt, and persisted", async () => {
  let repository;
  let repaired = 0;
  const thumbnailService = {
    async repairPhotoThumbnail(photo) {
      repaired += 1;
      await repository.clearThumbnail(photo.id, photo.thumbnailDriveFileId);
      return repository.attachThumbnail(photo.id, "generated-thumbnail-id");
    },
  };
  await withApi(
    {
      photo: sourcePhoto({ thumbnailDriveFileId: "missing-thumbnail-id" }),
      thumbnailService,
      download: async (fileId) => {
        if (fileId === "missing-thumbnail-id") {
          const error = new Error("missing");
          error.status = 404;
          throw error;
        }
        const body = Buffer.from("repaired-thumbnail");
        return { body, contentType: "image/webp", contentLength: body.length };
      },
    },
    async (origin, context) => {
      repository = context.repository;
      const response = await fetch(
        `${origin}/Memories/api/photos/${photoId}/thumbnail`,
      );
      assert.equal(response.status, 200);
      assert.equal(await response.text(), "repaired-thumbnail");
      assert.equal(response.headers.get("x-memories-thumbnail-repaired"), "1");
      assert.equal(response.headers.get("x-memories-thumbnail-cache"), "miss");
      assert.equal(repaired, 1);
      assert.deepEqual(context.downloads, [
        "missing-thumbnail-id",
        "generated-thumbnail-id",
      ]);
      assert.equal(
        (await repository.findPublicPhoto(photoId)).thumbnailDriveFileId,
        "generated-thumbnail-id",
      );
    },
  );
});

test("a broken thumbnail temporarily serves the original instead of a blank card", async () => {
  await withApi({}, async (origin, context) => {
    const response = await fetch(
      `${origin}/Memories/api/photos/${photoId}/thumbnail`,
    );
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "original");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(
      response.headers.get("x-memories-thumbnail-fallback"),
      "original",
    );
    assert.deepEqual(context.downloads, ["private-original-id"]);
  });
});

test("media requests remain streamed and are never stored in the thumbnail cache", async () => {
  await withApi({}, async (origin, context) => {
    const url = `${origin}/Memories/api/photos/${photoId}/media`;
    for (let index = 0; index < 2; index += 1) {
      const response = await fetch(url);
      assert.equal(response.status, 200);
      assert.equal(await response.text(), "original");
      assert.equal(response.headers.get("x-memories-thumbnail-cache"), null);
    }
    assert.deepEqual(context.downloads, [
      "private-original-id",
      "private-original-id",
    ]);
  });
});
