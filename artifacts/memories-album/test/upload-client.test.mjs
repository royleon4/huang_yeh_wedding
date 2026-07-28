import assert from "node:assert/strict";
import test from "node:test";
import {
  UploadClientError,
  retryFailedUploads,
  summarizeUploadResults,
  uploadQueue,
} from "../src/client/upload-client.mjs";

const files = [
  { name: "one.jpg" },
  { name: "two.jpg" },
  { name: "three.jpg" },
];

function createBatch() {
  return Promise.resolve({
    batchId: "batch",
    managementToken: "token",
    manageUrl: "/manage#token=token",
  });
}

test("automatically retries a transient file failure and continues the queue", async () => {
  const attempts = new Map();
  const updates = [];
  const result = await uploadQueue({
    uploaderName: "小安",
    files,
    createBatchFn: createBatch,
    uploadFileFn: async ({ file, clientUploadId, onProgress }) => {
      assert.ok(clientUploadId);
      const attempt = (attempts.get(file.name) ?? 0) + 1;
      attempts.set(file.name, attempt);
      onProgress(50);
      if (file.name === "two.jpg" && attempt === 1) {
        throw new UploadClientError("temporary failure", {
          code: "DRIVE_RETRYABLE",
          status: 503,
          retryAfterMs: 1,
        });
      }
      return { id: file.name, source: "guest", processIds: [] };
    },
    onUpdate: (update) => updates.push(update),
  });

  assert.equal(attempts.get("one.jpg"), 1);
  assert.equal(attempts.get("two.jpg"), 2);
  assert.equal(attempts.get("three.jpg"), 1);
  assert.deepEqual(result.summary, { success: 3, failed: 0, cancelled: 0 });
  assert.ok(
    updates.some(
      (update) => update.type === "file" && update.item.status === "retrying",
    ),
  );
});

test("a permanent individual failure does not stop later photos", async () => {
  const attempted = [];
  const result = await uploadQueue({
    uploaderName: "小安",
    files,
    createBatchFn: createBatch,
    uploadFileFn: async ({ file }) => {
      attempted.push(file.name);
      if (file.name === "two.jpg") {
        throw new UploadClientError("invalid photo", {
          code: "INVALID_IMAGE",
          status: 422,
        });
      }
      return { id: file.name, source: "guest", processIds: [] };
    },
  });

  assert.deepEqual(attempted, ["one.jpg", "two.jpg", "three.jpg"]);
  assert.deepEqual(result.summary, { success: 2, failed: 1, cancelled: 0 });
});

test("manual retry keeps the same batch and per-file upload identifier", async () => {
  const first = await uploadQueue({
    uploaderName: "小安",
    files: [files[0]],
    createBatchFn: createBatch,
    uploadFileFn: async () => {
      throw new UploadClientError("invalid photo", {
        code: "INVALID_IMAGE",
        status: 422,
      });
    },
  });
  const uploadId = first.results[0].clientUploadId;
  const seen = [];
  const retried = await retryFailedUploads({
    batch: first.batch,
    results: first.results,
    uploadFileFn: async ({ batchId, clientUploadId }) => {
      seen.push({ batchId, clientUploadId });
      return { id: "restored", source: "guest", processIds: [] };
    },
  });

  assert.deepEqual(seen, [{ batchId: "batch", clientUploadId: uploadId }]);
  assert.deepEqual(retried.summary, { success: 1, failed: 0, cancelled: 0 });
});

test("cancellation stops the remaining queue", async () => {
  const controller = new AbortController();
  const attempted = [];
  const result = await uploadQueue({
    uploaderName: "小安",
    files,
    signal: controller.signal,
    createBatchFn: createBatch,
    uploadFileFn: async ({ file }) => {
      attempted.push(file.name);
      controller.abort();
      throw new UploadClientError("cancelled", { code: "CANCELLED" });
    },
  });

  assert.deepEqual(attempted, ["one.jpg"]);
  assert.deepEqual(result.summary, { success: 0, failed: 0, cancelled: 3 });
});

test("requires a name and at least one selected photo", async () => {
  await assert.rejects(
    uploadQueue({ uploaderName: "", files: [], createBatchFn: createBatch }),
    (error) => error.code === "PHOTO_REQUIRED" || error.code === "INVALID_UPLOADER_NAME",
  );
});

test("summarizes mixed results", () => {
  assert.deepEqual(
    summarizeUploadResults([
      { status: "success" },
      { status: "failed" },
      { status: "cancelled" },
    ]),
    { success: 1, failed: 1, cancelled: 1 },
  );
});
