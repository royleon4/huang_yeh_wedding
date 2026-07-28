import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { createMemoriesPhotoApi } from "../src/server/photos/api.mjs";
import { MemoryPhotoRepository } from "../src/server/photos/memory-repository.mjs";
import { FakeDriveStorage } from "../src/server/storage/fake-drive.mjs";

const firstId = "11111111-1111-4111-8111-111111111111";
const secondId = "22222222-2222-4222-8222-222222222222";
const hiddenId = "33333333-3333-4333-8333-333333333333";

function photo(overrides) {
  return {
    id: firstId,
    driveFileId: "private-drive-original",
    thumbnailDriveFileId: "private-drive-thumb",
    originalFilename: "secret-name.jpg",
    mimeType: "image/jpeg",
    byteSize: 5,
    width: 1200,
    height: 800,
    contentHash: "hash",
    contentVersion: 1,
    source: "official",
    uploaderName: "婚禮攝影",
    visibility: "public",
    processingState: "ready",
    processIds: ["entrance"],
    createdAt: "2026-06-20T03:00:00.000Z",
    updatedAt: "2026-06-20T03:00:00.000Z",
    ...overrides,
  };
}

async function withApi(run) {
  const repository = new MemoryPhotoRepository([
    photo({ id: firstId, driveFileId: "drive-original-1", thumbnailDriveFileId: "drive-thumb-1" }),
    photo({ id: secondId, driveFileId: "drive-original-2", thumbnailDriveFileId: "drive-thumb-2", createdAt: "2026-06-20T02:00:00.000Z", source: "guest", uploaderName: "小安", processIds: [] }),
    photo({ id: hiddenId, driveFileId: "drive-hidden", thumbnailDriveFileId: null, visibility: "hidden", createdAt: "2026-06-20T01:00:00.000Z" }),
  ]);
  const drive = new FakeDriveStorage([
    { fileId: "drive-original-1", bytes: Buffer.from("first-original"), contentType: "image/jpeg" },
    { fileId: "drive-thumb-1", bytes: Buffer.from("first-thumb"), contentType: "image/webp" },
    { fileId: "drive-original-2", bytes: Buffer.from("second-original"), contentType: "image/jpeg" },
    { fileId: "drive-thumb-2", bytes: Buffer.from("second-thumb"), contentType: "image/webp" },
    { fileId: "drive-hidden", bytes: Buffer.from("hidden"), contentType: "image/jpeg" },
  ]);
  const api = createMemoriesPhotoApi({ repository, drive });
  const server = createServer(async (request, response) => {
    const handled = await api(request, response);
    if (!handled) {
      response.statusCode = 404;
      response.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`, { repository, drive });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("lists public photos with opaque ids and never exposes Drive metadata", async () => {
  await withApi(async (origin) => {
    const response = await fetch(`${origin}/Memories/api/photos?limit=1`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.photos.length, 1);
    assert.equal(body.photos[0].id, firstId);
    assert.equal(body.photos[0].mediaUrl, `/Memories/api/photos/${firstId}/media`);
    assert.ok(body.nextCursor);
    const serialized = JSON.stringify(body);
    assert.equal(serialized.includes("drive-original"), false);
    assert.equal(serialized.includes("secret-name"), false);
  });
});

test("cursor pagination is stable and guest filtering is explicit", async () => {
  await withApi(async (origin) => {
    const first = await (await fetch(`${origin}/Memories/api/photos?limit=1`)).json();
    const second = await (await fetch(`${origin}/Memories/api/photos?limit=1&cursor=${encodeURIComponent(first.nextCursor)}`)).json();
    assert.equal(second.photos[0].id, secondId);
    const guest = await (await fetch(`${origin}/Memories/api/photos?source=guest`)).json();
    assert.deepEqual(guest.photos.map((item) => item.id), [secondId]);
    assert.deepEqual(guest.photos[0].processIds, []);
  });
});

test("streams thumbnail and media through controlled endpoints", async () => {
  await withApi(async (origin, { drive }) => {
    const thumb = await fetch(`${origin}/Memories/api/photos/${firstId}/thumbnail`);
    assert.equal(thumb.status, 200);
    assert.equal(await thumb.text(), "first-thumb");
    const media = await fetch(`${origin}/Memories/api/photos/${firstId}/media`);
    assert.equal(await media.text(), "first-original");
    assert.deepEqual(drive.calls.filter((call) => call.operation === "download").map((call) => call.fileId), ["drive-thumb-1", "drive-original-1"]);
  });
});

test("hidden photos and malformed ids are indistinguishable from missing photos", async () => {
  await withApi(async (origin) => {
    assert.equal((await fetch(`${origin}/Memories/api/photos/${hiddenId}/media`)).status, 404);
    assert.equal((await fetch(`${origin}/Memories/api/photos/drive-original-1/media`)).status, 404);
  });
});

test("invalid cursors return a bounded public error", async () => {
  await withApi(async (origin) => {
    const response = await fetch(`${origin}/Memories/api/photos?cursor=not-a-cursor`);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Invalid cursor" });
  });
});
