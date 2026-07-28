import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { createMemoriesPhotoApi } from "../src/server/photos/api.mjs";
import { MemoryPhotoRepository } from "../src/server/photos/memory-repository.mjs";

const photoId = "11111111-1111-4111-8111-111111111111";

function sourcePhoto() {
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
  };
}

async function withApi({ thumbnailService = null }, run) {
  const repository = new MemoryPhotoRepository([sourcePhoto()]);
  const downloads = [];
  const drive = {
    async download(fileId) {
      downloads.push(fileId);
      return {
        body: Buffer.from(
          fileId === "generated-thumbnail-id" ? "thumbnail" : "original",
        ),
        contentType: "image/webp",
        contentLength: 9,
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
    assert.equal(
      response.headers.get("cache-control"),
      "public, max-age=31536000, immutable",
    );
  });
});

test("thumbnail requests never silently stream the original as a fallback", async () => {
  await withApi({}, async (origin, context) => {
    const response = await fetch(
      `${origin}/Memories/api/photos/${photoId}/thumbnail`,
    );
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, "THUMBNAIL_NOT_READY");
    assert.deepEqual(context.downloads, []);
  });
});

test("media requests stream the original only after the photo is opened", async () => {
  await withApi({}, async (origin, context) => {
    const response = await fetch(
      `${origin}/Memories/api/photos/${photoId}/media`,
    );
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "original");
    assert.deepEqual(context.downloads, ["private-original-id"]);
  });
});
