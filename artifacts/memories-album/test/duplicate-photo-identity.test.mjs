import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { MemoryPhotoRepository } from "../src/server/photos/memory-repository.mjs";
import { FakeDriveStorage } from "../src/server/storage/fake-drive.mjs";
import { createGuestUploadApi } from "../src/server/uploads/api.mjs";

const BATCH_ID = "11111111-1111-4111-8111-111111111111";
const PHOTO_IDS = [
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
];

function fakeProcessor() {
  return {
    async process({ bytes }) {
      return {
        originalBytes: Buffer.concat([Buffer.from("normalized:"), bytes]),
        originalContentType: "image/jpeg",
        originalExtension: "jpg",
        thumbnailBytes: Buffer.concat([Buffer.from("thumb:"), bytes]),
        thumbnailContentType: "image/webp",
        width: 1200,
        height: 800,
      };
    },
  };
}

async function withUploadApi(run) {
  const repository = new MemoryPhotoRepository();
  const drive = new FakeDriveStorage();
  const ids = [BATCH_ID, ...PHOTO_IDS];
  const api = createGuestUploadApi({
    repository,
    drive,
    imageProcessor: fakeProcessor(),
    now: () => new Date("2026-07-31T00:00:00.000Z"),
    createId: () => ids.shift(),
    createToken: () => "private-management-token",
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
    await run(`http://127.0.0.1:${address.port}`, { repository, drive });
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

async function createBatch(origin) {
  const response = await fetch(`${origin}/Memories/api/upload-batches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uploaderName: "Leon" }),
  });
  return response.json();
}

async function uploadPhoto(origin, token, bytes, filename, uploadId) {
  const form = new FormData();
  form.append("photo", new Blob([bytes], { type: "image/jpeg" }), filename);
  const response = await fetch(
    `${origin}/Memories/api/upload-batches/${BATCH_ID}/photos`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Memories-Upload-Id": uploadId,
      },
      body: form,
    },
  );
  return { response, body: await response.json() };
}

test("different photos with the same filename are both accepted", async () => {
  await withUploadApi(async (origin, { repository, drive }) => {
    const batch = await createBatch(origin);
    const first = await uploadPhoto(
      origin,
      batch.managementToken,
      Buffer.from("first-photo-bytes"),
      "IMG_0001.jpg",
      "same-name-upload-0001",
    );
    const second = await uploadPhoto(
      origin,
      batch.managementToken,
      Buffer.from("second-photo-bytes"),
      "IMG_0001.jpg",
      "same-name-upload-0002",
    );

    assert.equal(first.response.status, 201);
    assert.equal(second.response.status, 201);
    assert.notEqual(first.body.photo.id, second.body.photo.id);
    const page = await repository.listPublicPhotos({ collection: "guest" });
    assert.equal(page.items.length, 2);
    assert.equal(drive.files.size, 4);
  });
});

test("duplicate identity is based on SHA-256 file bytes, never filename", async () => {
  const [temporaryPhoto, durableRepository, foundation] = await Promise.all([
    readFile(new URL("../src/server/uploads/temp-photo.mjs", import.meta.url), "utf8"),
    readFile(
      new URL("../src/server/uploads/durable-repository.mjs", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../db/001_memories_foundation.sql", import.meta.url), "utf8"),
  ]);

  assert.match(temporaryPhoto, /createHash\("sha256"\)/);
  assert.match(temporaryPhoto, /digest\.update\(chunk\)/);
  assert.match(temporaryPhoto, /contentHash: digest\.digest\("hex"\)/);
  assert.match(
    durableRepository,
    /client_upload_id = \$2 OR content_hash = \$3/,
  );
  assert.match(foundation, /UNIQUE \(content_hash, content_version\)/);
  assert.doesNotMatch(foundation, /UNIQUE \(original_filename\)/);
});
