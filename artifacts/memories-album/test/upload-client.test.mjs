import assert from "node:assert/strict";
import test from "node:test";
import {
  UploadClientError,
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

test("continues after an individual file fails", async () => {
  const attempted = [];
  const updates = [];
  const result = await uploadQueue({
    uploaderName: "小安",
    files,
    createBatchFn: createBatch,
    uploadFileFn: async ({ file, onProgress }) => {
      attempted.push(file.name);
      onProgress(50);
      if (file.name === "two.jpg") {
        throw new UploadClientError("temporary failure", {
          code: "DRIVE_RETRYABLE",
          status: 503,
        });
      }
      return { id: file.name, source: "guest", processIds: [] };
    },
    onUpdate: (update) => updates.push(update),
  });

  assert.deepEqual(attempted, ["one.jpg", "two.jpg", "three.jpg"]);
  assert.deepEqual(result.summary, { success: 2, failed: 1, cancelled: 0 });
  assert.equal(result.results[1].retryable, true);
  assert.ok(updates.some((update) => update.type === "file" && update.item.progress === 50));
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
      const error = new UploadClientError("cancelled", { code: "CANCELLED" });
      throw error;
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
