import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import test from "node:test";
import { MemoryPhotoRepository } from "../src/server/photos/memory-repository.mjs";
import { FakeDriveStorage } from "../src/server/storage/fake-drive.mjs";
import { createGuestUploadApi } from "../src/server/uploads/api.mjs";
import { ImageValidationError } from "../src/server/uploads/image-processor.mjs";

const batchId = "11111111-1111-4111-8111-111111111111";
const photoIds = [
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
  "44444444-4444-4444-8444-444444444444",
  "55555555-5555-4555-8555-555555555555",
];

function fakeProcessor() {
  return {
    async process({ bytes }) {
      if (bytes.toString() === "bad") {
        throw new ImageValidationError("The selected file is not a valid image");
      }
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

async function withApi(run, options = {}) {
  const repository = options.repository ?? new MemoryPhotoRepository();
  const drive = options.drive ?? new FakeDriveStorage();
  const ids = [batchId, ...photoIds];
  const api = createGuestUploadApi({
    repository,
    durableUploadRepository: options.durableUploadRepository,
    processRepository: options.processRepository ?? null,
    drive,
    imageProcessor: options.imageProcessor ?? fakeProcessor(),
    limits: options.limits,
    now: () => new Date("2026-06-20T03:00:00.000Z"),
    createId: () => ids.shift(),
    createToken: () => "private-management-token",
  });
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
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

async function createBatch(origin, uploaderName = "小安", classification = {}) {
  const response = await fetch(`${origin}/Memories/api/upload-batches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uploaderName, ...classification }),
  });
  return { response, body: await response.json() };
}

async function uploadPhoto(
  origin,
  token,
  bytes,
  filename = "photo.jpg",
  uploadId = "stable-upload-id-0001",
) {
  const form = new FormData();
  form.append("photo", new Blob([bytes], { type: "image/jpeg" }), filename);
  const response = await fetch(
    `${origin}/Memories/api/upload-batches/${batchId}/photos`,
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

test("requires a non-empty uploader name", async () => {
  await withApi(async (origin) => {
    const { response, body } = await createBatch(origin, "   ");
    assert.equal(response.status, 422);
    assert.equal(body.code, "INVALID_UPLOADER_NAME");
  });
});

test("creates a private batch token and publishes an unclassified guest photo", async () => {
  await withApi(async (origin, { repository, drive }) => {
    const batch = await createBatch(origin, "  小安  ");
    assert.equal(batch.response.status, 201);
    assert.equal(batch.body.managementToken, "private-management-token");
    assert.match(batch.body.manageUrl, /#token=/);

    const uploaded = await uploadPhoto(
      origin,
      batch.body.managementToken,
      Buffer.from("photo-one"),
    );
    assert.equal(uploaded.response.status, 201);
    assert.equal(uploaded.body.photo.source, "guest");
    assert.equal(uploaded.body.photo.collection, "guest");
    assert.equal(uploaded.body.photo.uploaderName, "小安");
    assert.deepEqual(uploaded.body.photo.processIds, []);
    assert.equal(JSON.stringify(uploaded.body).includes("drive-"), false);

    const page = await repository.listPublicPhotos({ collection: "guest" });
    assert.equal(page.items.length, 1);
    assert.equal(page.items[0].batchId, batchId);
    assert.equal(drive.files.size, 2);

    const tokenHash = createHash("sha256")
      .update(batch.body.managementToken)
      .digest("hex");
    assert.ok(await repository.findUploadBatchByToken(batchId, tokenHash));
    assert.equal(
      await repository.findUploadBatchByToken(batchId, batch.body.managementToken),
      null,
    );
  });
});

test("classifies a guest upload into a wedding process without changing its guest source", async () => {
  const processRepository = {
    async listProcesses() {
      return [{ id: "entrance", labelZh: "進場" }];
    },
  };
  await withApi(
    async (origin, { repository }) => {
      const batch = await createBatch(origin, "小安", {
        classification: "wedding",
        processId: "entrance",
      });
      const uploaded = await uploadPhoto(
        origin,
        batch.body.managementToken,
        Buffer.from("wedding-photo"),
      );
      assert.equal(uploaded.response.status, 201);
      assert.equal(uploaded.body.photo.source, "guest");
      assert.equal(uploaded.body.photo.collection, "wedding");
      assert.deepEqual(uploaded.body.photo.processIds, ["entrance"]);
      assert.equal(
        (await repository.listPublicPhotos({ collection: "guest" })).items.length,
        1,
      );
      assert.equal(
        (
          await repository.listPublicPhotos({
            collection: "wedding",
            processId: "entrance",
          })
        ).items.length,
        1,
      );
    },
    { processRepository },
  );
});

test("classifies a guest upload into Life photos while keeping it in Guest uploads", async () => {
  await withApi(async (origin, { repository }) => {
    const batch = await createBatch(origin, "小安", {
      classification: "life",
    });
    const uploaded = await uploadPhoto(
      origin,
      batch.body.managementToken,
      Buffer.from("life-photo"),
    );
    assert.equal(uploaded.response.status, 201);
    assert.equal(uploaded.body.photo.source, "guest");
    assert.equal(uploaded.body.photo.collection, "life");
    assert.equal(
      (await repository.listPublicPhotos({ collection: "guest" })).items.length,
      1,
    );
    assert.equal(
      (await repository.listPublicPhotos({ collection: "life" })).items.length,
      1,
    );
  });
});

test("rejects an unknown wedding process classification", async () => {
  const processRepository = {
    async listProcesses() {
      return [{ id: "entrance" }];
    },
  };
  await withApi(
    async (origin) => {
      const batch = await createBatch(origin, "小安", {
        classification: "wedding",
        processId: "missing",
      });
      assert.equal(batch.response.status, 422);
      assert.equal(batch.body.code, "INVALID_PROCESS_CLASSIFICATION");
    },
    { processRepository },
  );
});

test("rejects malformed images without writing Drive files", async () => {
  await withApi(async (origin, { drive }) => {
    const batch = await createBatch(origin);
    const uploaded = await uploadPhoto(
      origin,
      batch.body.managementToken,
      Buffer.from("bad"),
    );
    assert.equal(uploaded.response.status, 422);
    assert.equal(drive.files.size, 0);
  });
});

test("repeating the same upload id returns the existing photo without duplicate Drive files", async () => {
  await withApi(async (origin, { drive }) => {
    const batch = await createBatch(origin);
    const first = await uploadPhoto(
      origin,
      batch.body.managementToken,
      Buffer.from("same-photo"),
      "same.jpg",
      "same-upload-id-0001",
    );
    assert.equal(first.response.status, 201);
    const second = await uploadPhoto(
      origin,
      batch.body.managementToken,
      Buffer.from("same-photo"),
      "same.jpg",
      "same-upload-id-0001",
    );
    assert.equal(second.response.status, 200);
    assert.equal(second.body.reused, true);
    assert.equal(second.body.photo.id, first.body.photo.id);
    assert.equal(drive.files.size, 2);
  });
});

test("preserves the original Drive file when thumbnail storage is temporarily unavailable", async () => {
  const calls = [];
  const drive = {
    originalFolderId: "original-folder",
    thumbnailFolderId: "thumbnail-folder",
    async uploadOriginal() {
      calls.push("upload-original");
      return { fileId: "original-id" };
    },
    async uploadThumbnail() {
      calls.push("upload-thumbnail");
      const error = new Error("retry");
      error.code = "DRIVE_RETRYABLE";
      throw error;
    },
    async delete(fileId) {
      calls.push(`delete:${fileId}`);
    },
  };
  await withApi(
    async (origin) => {
      const batch = await createBatch(origin);
      const uploaded = await uploadPhoto(
        origin,
        batch.body.managementToken,
        Buffer.from("photo"),
      );
      assert.equal(uploaded.response.status, 503);
      assert.equal(calls.filter((call) => call === "upload-original").length, 1);
      assert.equal(calls.filter((call) => call === "upload-thumbnail").length, 4);
      assert.equal(calls.some((call) => call.startsWith("delete:")), false);
    },
    { drive },
  );
});

test("a later request resumes from the preserved original instead of uploading it again", async () => {
  let thumbnailAttempts = 0;
  const files = new Map();
  const drive = {
    originalFolderId: "original-folder",
    thumbnailFolderId: "thumbnail-folder",
    async findChildByName(parentId, filename) {
      return [...files.values()].find(
        (file) => file.parentId === parentId && file.filename === filename,
      );
    },
    async uploadOriginal({ filename }) {
      const file = {
        id: "original-id",
        fileId: "original-id",
        parentId: "original-folder",
        filename,
      };
      files.set(file.id, file);
      return { fileId: file.id };
    },
    async uploadThumbnail({ filename }) {
      thumbnailAttempts += 1;
      if (thumbnailAttempts <= 4) {
        const error = new Error("retry");
        error.code = "DRIVE_RETRYABLE";
        throw error;
      }
      const file = {
        id: "thumbnail-id",
        fileId: "thumbnail-id",
        parentId: "thumbnail-folder",
        filename,
      };
      files.set(file.id, file);
      return { fileId: file.id };
    },
  };
  await withApi(
    async (origin) => {
      const batch = await createBatch(origin);
      const first = await uploadPhoto(
        origin,
        batch.body.managementToken,
        Buffer.from("resume-photo"),
        "resume.jpg",
        "resume-upload-id-0001",
      );
      assert.equal(first.response.status, 503);
      const second = await uploadPhoto(
        origin,
        batch.body.managementToken,
        Buffer.from("resume-photo"),
        "resume.jpg",
        "resume-upload-id-0001",
      );
      assert.equal(second.response.status, 201);
      assert.equal(
        [...files.values()].filter((file) => file.parentId === "original-folder")
          .length,
        1,
      );
    },
    { drive },
  );
});

test("enforces the per-file byte limit", async () => {
  await withApi(
    async (origin) => {
      const batch = await createBatch(origin);
      const uploaded = await uploadPhoto(
        origin,
        batch.body.managementToken,
        Buffer.from("12345"),
      );
      assert.equal(uploaded.response.status, 413);
      assert.equal(uploaded.body.code, "PHOTO_TOO_LARGE");
    },
    { limits: { maxFileBytes: 3 } },
  );
});

test("does not reveal whether an unauthorized batch exists", async () => {
  await withApi(async (origin) => {
    await createBatch(origin);
    const uploaded = await uploadPhoto(
      origin,
      "wrong-token",
      Buffer.from("photo"),
    );
    assert.equal(uploaded.response.status, 404);
    assert.equal(uploaded.body.code, "BATCH_NOT_FOUND");
  });
});
