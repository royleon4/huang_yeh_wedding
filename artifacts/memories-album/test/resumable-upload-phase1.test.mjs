import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { MemoryPhotoRepository } from "../src/server/photos/memory-repository.mjs";
import { FakeDriveStorage } from "../src/server/storage/fake-drive.mjs";
import { createGuestUploadApi } from "../src/server/uploads/api.mjs";

const batchId = "11111111-1111-4111-8111-111111111111";
const photoId = "22222222-2222-4222-8222-222222222222";

async function withApi(run) {
  const repository = new MemoryPhotoRepository();
  const drive = new FakeDriveStorage();
  const thumbnailCalls = [];
  const thumbnailService = {
    async ensurePhotoThumbnail(photo) {
      thumbnailCalls.push(photo.id);
      return photo;
    },
  };
  const ids = [batchId, photoId];
  const api = createGuestUploadApi({
    repository,
    drive,
    thumbnailService,
    imageProcessor: {
      async processFile({ filePath }) {
        return {
          originalPath: filePath,
          originalContentType: "image/jpeg",
          originalExtension: "jpg",
          originalByteSize: (await stat(filePath)).size,
          width: 1200,
          height: 800,
        };
      },
    },
    now: () => new Date("2026-06-20T03:00:00.000Z"),
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
    await run(`http://127.0.0.1:${address.port}`, {
      repository,
      drive,
      thumbnailCalls,
    });
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
    body: JSON.stringify({ uploaderName: "小安" }),
  });
  return response.json();
}

test("original upload completes before deferred thumbnail generation", async () => {
  await withApi(async (origin, { repository, drive, thumbnailCalls }) => {
    const batch = await createBatch(origin);
    const form = new FormData();
    form.append(
      "photo",
      new Blob([Buffer.from("photo-content")], { type: "image/jpeg" }),
      "photo.jpg",
    );
    const response = await fetch(
      `${origin}/Memories/api/upload-batches/${batchId}/photos`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${batch.managementToken}`,
          "X-Memories-Upload-Id": "stable-upload-id-0001",
        },
        body: form,
      },
    );
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.thumbnailPending, true);
    assert.equal(body.photo.id, photoId);
    assert.equal(drive.files.size, 1);
    const stored = await repository.findPublicPhoto(photoId);
    assert.equal(stored.thumbnailDriveFileId, null);

    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(thumbnailCalls, [photoId]);
  });
});

test("resumable upload migration is additive and contains no destructive SQL", async () => {
  const migration = await readFile(
    new URL("../db/013_drive_resumable_upload.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /ADD COLUMN IF NOT EXISTS original_upload_session_uri/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS original_upload_offset/);
  assert.doesNotMatch(migration, /DROP\s+(TABLE|COLUMN|CONSTRAINT)/i);
});

test("production runtime supplies the existing thumbnail service to uploads", async () => {
  const runtime = await readFile(
    new URL("../src/server/runtime.mjs", import.meta.url),
    "utf8",
  );
  assert.match(
    runtime,
    /const guestUploadApi = createGuestUploadApi\([\s\S]*?thumbnailService,[\s\S]*?\);/,
  );
  assert.match(
    runtime,
    /if \(await guestBatchManagementApi\([\s\S]*?return guestUploadApi\(/,
  );
});
