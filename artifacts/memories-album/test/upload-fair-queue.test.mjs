import assert from "node:assert/strict";
import test from "node:test";
import {
  UploadClientError,
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

function transientFailure() {
  return new UploadClientError("temporary failure", {
    code: "DRIVE_RETRYABLE",
    status: 503,
    retryAfterMs: 1,
  });
}

test("defers a repeatedly failing photo so later photos get a turn", async () => {
  const attempts = new Map();
  const callOrder = [];
  const result = await uploadQueue({
    uploaderName: "小安",
    files,
    maxConcurrent: 1,
    createBatchFn: createBatch,
    uploadFileFn: async ({ file }) => {
      callOrder.push(file.name);
      const attempt = (attempts.get(file.name) ?? 0) + 1;
      attempts.set(file.name, attempt);
      if (file.name === "one.jpg" && attempt <= 2) throw transientFailure();
      return { id: file.name, source: "guest", processIds: [] };
    },
  });

  assert.deepEqual(callOrder, [
    "one.jpg",
    "one.jpg",
    "two.jpg",
    "three.jpg",
    "one.jpg",
  ]);
  assert.equal(attempts.get("one.jpg"), 3);
  assert.deepEqual(result.summary, { success: 3, failed: 0, cancelled: 0 });
});

test("limits one automatic run to four attempts without blocking the queue", async () => {
  const attempts = new Map();
  const callOrder = [];
  const result = await uploadQueue({
    uploaderName: "小安",
    files,
    maxConcurrent: 1,
    createBatchFn: createBatch,
    uploadFileFn: async ({ file }) => {
      callOrder.push(file.name);
      const attempt = (attempts.get(file.name) ?? 0) + 1;
      attempts.set(file.name, attempt);
      if (file.name === "one.jpg") throw transientFailure();
      return { id: file.name, source: "guest", processIds: [] };
    },
  });

  assert.deepEqual(callOrder, [
    "one.jpg",
    "one.jpg",
    "two.jpg",
    "three.jpg",
    "one.jpg",
    "one.jpg",
  ]);
  assert.equal(attempts.get("one.jpg"), 4);
  assert.deepEqual(result.summary, { success: 2, failed: 1, cancelled: 0 });
});

test("does not defer permanent validation failures", async () => {
  const attempts = new Map();
  const result = await uploadQueue({
    uploaderName: "小安",
    files,
    maxConcurrent: 1,
    createBatchFn: createBatch,
    uploadFileFn: async ({ file }) => {
      attempts.set(file.name, (attempts.get(file.name) ?? 0) + 1);
      if (file.name === "one.jpg") {
        throw new UploadClientError("invalid image", {
          code: "INVALID_IMAGE",
          status: 422,
        });
      }
      return { id: file.name, source: "guest", processIds: [] };
    },
  });

  assert.equal(attempts.get("one.jpg"), 1);
  assert.deepEqual(result.summary, { success: 2, failed: 1, cancelled: 0 });
});
