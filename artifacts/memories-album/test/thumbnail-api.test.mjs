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
    byteSize: 30 * 1024 * 1024,
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

function transientThumbnailService(overrides = {}) {
  return {
    imageProcessor: {
      async createThumbnail({ bytes, mimeType }) {
        assert.equal(Buffer.isBuffer(bytes), true);
        assert.equal(mimeType, "image/jpeg");
        return {
          thumbnailBytes: Buffer.from("generated-webp"),
          thumbnailContentType: "image/webp",
        };
      },
    },
    async ensurePhotoThumbnail() {
      throw new Error("public thumbnail GET must not persist to Drive");
    },
    async repairPhotoThumbnail() {
      throw new Error("public thumbnail GET must not repair through Drive");
    },
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
        fileId === "existing-thumbnail-id" ? "thumbnail" : "original",
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

test("missing wedding thumbnails are generated in memory without a Drive write", async () => {
  const thumbnailService = transientThumbnailService();

  await withApi({ thumbnailService }, async (origin, context) => {
    const response = await fetch(
      `${origin}/Memories/api/photos/${photoId}/thumbnail`,
    );
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "generated-webp");
    assert.equal(response.headers.get("content-type"), "image/webp");
    assert.equal(
      response.headers.get("x-memories-thumbnail-fallback"),
      "generated",
    );
    assert.equal(response.headers.get("x-memories-thumbnail-cache"), "miss");
    assert.equal(
      response.headers.get("cache-control"),
      "public, max-age=3600, stale-while-revalidate=86400",
    );
    assert.deepEqual(context.downloads, ["private-original-id"]);
  });
});

test("repeated generated thumbnail requests reuse the bounded server hot cache", async () => {
  let generations = 0;
  const thumbnailService = transientThumbnailService({
    imageProcessor: {
      async createThumbnail() {
        generations += 1;
        return {
          thumbnailBytes: Buffer.from("generated-webp"),
          thumbnailContentType: "image/webp",
        };
      },
    },
  });

  await withApi({ thumbnailService }, async (origin, context) => {
    const url = `${origin}/Memories/api/photos/${photoId}/thumbnail`;
    const first = await fetch(url);
    assert.equal(first.status, 200);
    assert.equal(await first.text(), "generated-webp");
    assert.equal(first.headers.get("x-memories-thumbnail-cache"), "miss");

    const second = await fetch(url);
    assert.equal(second.status, 200);
    assert.equal(await second.text(), "generated-webp");
    assert.equal(second.headers.get("x-memories-thumbnail-cache"), "hit");

    assert.equal(generations, 1);
    assert.deepEqual(context.downloads, ["private-original-id"]);
  });
});

test("repeated Drive thumbnail requests reuse the bounded server hot cache", async () => {
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

test("an unreadable Drive thumbnail falls back to a generated WebP without repair upload", async () => {
  let repairCalls = 0;
  const thumbnailService = transientThumbnailService({
    async repairPhotoThumbnail() {
      repairCalls += 1;
      throw new Error("repair must stay out of the public read path");
    },
  });

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
        const body = Buffer.from("large-original-placeholder");
        return { body, contentType: "image/jpeg", contentLength: body.length };
      },
    },
    async (origin, context) => {
      const response = await fetch(
        `${origin}/Memories/api/photos/${photoId}/thumbnail`,
      );
      assert.equal(response.status, 200);
      assert.equal(await response.text(), "generated-webp");
      assert.equal(
        response.headers.get("x-memories-thumbnail-fallback"),
        "generated",
      );
      assert.equal(repairCalls, 0);
      assert.deepEqual(context.downloads, [
        "missing-thumbnail-id",
        "private-original-id",
      ]);
    },
  );
});

test("a degraded runtime without an image processor preserves the original fallback", async () => {
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
