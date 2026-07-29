import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import test from "node:test";
import { MemoryPhotoRepository } from "../src/server/photos/memory-repository.mjs";
import { createGuestBatchManagementApi } from "../src/server/uploads/management-api.mjs";

const batchA = "11111111-1111-4111-8111-111111111111";
const batchB = "22222222-2222-4222-8222-222222222222";
const photoA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const photoB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const tokenA = "private-token-for-batch-a";
const tokenB = "private-token-for-batch-b";

function tokenHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

function photo(id, batchId) {
  return {
    id,
    batchId,
    driveFileId: `drive-${id}`,
    thumbnailDriveFileId: `thumb-${id}`,
    originalFilename: "private-name.jpg",
    mimeType: "image/jpeg",
    byteSize: 123,
    width: 1200,
    height: 800,
    contentHash: `hash-${id}`,
    contentVersion: 1,
    source: "guest",
    uploaderName: "Guest",
    collection: "guest",
    visibility: "public",
    processingState: "ready",
    processIds: [],
    createdAt: "2026-06-20T03:00:00.000Z",
    updatedAt: "2026-06-20T03:00:00.000Z",
  };
}

function repository() {
  return new MemoryPhotoRepository(
    [photo(photoA, batchA), photo(photoB, batchB)],
    [
      {
        id: batchA,
        uploaderType: "guest",
        uploaderName: "Guest A",
        tokenHash: tokenHash(tokenA),
        status: "open",
        createdAt: "2026-06-20T03:00:00.000Z",
        updatedAt: "2026-06-20T03:00:00.000Z",
      },
      {
        id: batchB,
        uploaderType: "guest",
        uploaderName: "Guest B",
        tokenHash: tokenHash(tokenB),
        status: "open",
        createdAt: "2026-06-20T04:00:00.000Z",
        updatedAt: "2026-06-20T04:00:00.000Z",
      },
    ],
  );
}

async function withApi(run, options = {}) {
  const photoRepository = options.repository ?? repository();
  const api = createGuestBatchManagementApi({
    repository: photoRepository,
    now: () => new Date("2026-06-21T00:00:00.000Z"),
    createToken: options.createToken,
  });
  const server = createServer(async (request, response) => {
    if (!(await api(request, response))) {
      response.statusCode = 404;
      response.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`, photoRepository);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

function authorized(token) {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  };
}

test("a private token lists only its own public batch photos without storage metadata", async () => {
  await withApi(async (origin) => {
    const response = await fetch(
      `${origin}/Memories/api/upload-batches/${batchA}`,
      { headers: authorized(tokenA) },
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.batch.id, batchA);
    assert.equal(body.batch.uploaderName, "Guest A");
    assert.deepEqual(
      body.batch.photos.map((item) => item.id),
      [photoA],
    );
    assert.equal(JSON.stringify(body).includes("drive-"), false);
    assert.equal(JSON.stringify(body).includes("private-name"), false);
    assert.equal(JSON.stringify(body).includes(tokenHash(tokenA)), false);
    assert.equal(JSON.stringify(body).includes(tokenA), false);
  });
});

test("a private token cannot enumerate or manage another batch", async () => {
  await withApi(async (origin) => {
    const missing = await fetch(
      `${origin}/Memories/api/upload-batches/${batchB}`,
      { headers: authorized(tokenA) },
    );
    const unknown = await fetch(
      `${origin}/Memories/api/upload-batches/33333333-3333-4333-8333-333333333333`,
      { headers: authorized(tokenA) },
    );
    assert.equal(missing.status, 404);
    assert.equal(unknown.status, 404);
    assert.deepEqual(await missing.json(), await unknown.json());

    const withdrawal = await fetch(
      `${origin}/Memories/api/upload-batches/${batchB}/photos/${photoB}`,
      { method: "DELETE", headers: authorized(tokenA) },
    );
    assert.equal(withdrawal.status, 404);
  });
});

test("guest withdrawal immediately hides the photo from public and private queries", async () => {
  await withApi(async (origin, photoRepository) => {
    const withdrawal = await fetch(
      `${origin}/Memories/api/upload-batches/${batchA}/photos/${photoA}`,
      { method: "DELETE", headers: authorized(tokenA) },
    );
    assert.equal(withdrawal.status, 200);
    assert.deepEqual(await withdrawal.json(), {
      withdrawn: true,
      photoId: photoA,
      retentionDays: 7,
      restoreUntil: "2026-06-28T00:00:00.000Z",
    });

    assert.equal(
      (await photoRepository.listPublicPhotos({ collection: "guest" })).items
        .length,
      1,
    );
    const managed = await fetch(
      `${origin}/Memories/api/upload-batches/${batchA}`,
      { headers: authorized(tokenA) },
    );
    assert.deepEqual((await managed.json()).batch.photos, []);
  });
});

test("rotating the private link revokes the old token and returns the replacement only in its URL", async () => {
  const replacement = "replacement-private-token";
  await withApi(
    async (origin) => {
      const rotated = await fetch(
        `${origin}/Memories/api/upload-batches/${batchA}/management-token`,
        { method: "POST", headers: authorized(tokenA) },
      );
      assert.equal(rotated.status, 200);
      const body = await rotated.json();
      assert.deepEqual(Object.keys(body), ["manageUrl"]);
      assert.match(body.manageUrl, new RegExp(`#token=${replacement}$`));

      const oldLink = await fetch(
        `${origin}/Memories/api/upload-batches/${batchA}`,
        { headers: authorized(tokenA) },
      );
      assert.equal(oldLink.status, 404);

      const newLink = await fetch(
        `${origin}/Memories/api/upload-batches/${batchA}`,
        { headers: authorized(replacement) },
      );
      assert.equal(newLink.status, 200);
    },
    { createToken: () => replacement },
  );
});

test("generated replacement links contain at least 256 bits of token entropy", async () => {
  await withApi(async (origin) => {
    const rotated = await fetch(
      `${origin}/Memories/api/upload-batches/${batchA}/management-token`,
      { method: "POST", headers: authorized(tokenA) },
    );
    const manageUrl = (await rotated.json()).manageUrl;
    const encoded = new URL(manageUrl, origin).hash.slice("#token=".length);
    const bytes = Buffer.from(decodeURIComponent(encoded), "base64url");
    assert.ok(bytes.length >= 32);
  });
});
