import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createGuestBatch } from "../src/client/upload-client.mjs";
import {
  isReservedGuestUploaderName,
  normalizeGuestUploaderName,
} from "../src/server/uploads/guest-uploader-policy.mjs";
import {
  createGuestUploadRepositoryGuard,
  RESERVED_GUEST_UPLOADER_ERROR_CODE,
} from "../src/server/uploads/guest-uploader-guard.mjs";

test("normalizes and reserves the wedding photographer uploader name", () => {
  assert.equal(normalizeGuestUploaderName("  婚禮攝影  "), "婚禮攝影");
  assert.equal(isReservedGuestUploaderName("  婚禮攝影  "), true);
  assert.equal(isReservedGuestUploaderName("婚禮攝影師"), false);
});

test("guest upload client rejects the reserved name before sending a request", async () => {
  let requested = false;
  await assert.rejects(
    createGuestBatch(" 婚禮攝影 ", {
      fetchImpl: async () => {
        requested = true;
        throw new Error("must not request");
      },
    }),
    (error) => {
      assert.equal(error.code, RESERVED_GUEST_UPLOADER_ERROR_CODE);
      assert.equal(error.status, 422);
      return true;
    },
  );
  assert.equal(requested, false);
});

test("guest upload client still accepts a real uploader name", async () => {
  let requestBody;
  const result = await createGuestBatch("  小安  ", {
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 201,
        async json() {
          return { batchId: "batch-1", managementToken: "token" };
        },
      };
    },
  });
  assert.equal(requestBody.uploaderName, "小安");
  assert.equal(result.batchId, "batch-1");
});

test("server repository guard blocks only guest use of the reserved name", async () => {
  const created = [];
  const repository = {
    async createUploadBatch(batch) {
      created.push(batch);
      return batch;
    },
  };
  const guarded = createGuestUploadRepositoryGuard(repository);

  await assert.rejects(
    guarded.createUploadBatch({
      id: "guest-batch",
      uploaderType: "guest",
      uploaderName: "  婚禮攝影  ",
    }),
    (error) => {
      assert.equal(error.code, RESERVED_GUEST_UPLOADER_ERROR_CODE);
      assert.equal(error.status, 422);
      return true;
    },
  );
  assert.equal(created.length, 0);

  await guarded.createUploadBatch({
    id: "official-batch",
    uploaderType: "official",
    uploaderName: "婚禮攝影",
  });
  assert.equal(created.length, 1);
});

test("database migration enforces the reserved guest name for new rows", async () => {
  const sql = await readFile(
    new URL("../db/100_reserved_guest_uploader_name.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /memories_upload_batches_reserved_guest_name_check/);
  assert.match(sql, /uploader_type <> 'guest'/);
  assert.match(sql, /<> '婚禮攝影'/);
  assert.match(sql, /NOT VALID/);
});
