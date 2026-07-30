import assert from "node:assert/strict";
import test from "node:test";
import { uploadOriginalSingleRequest } from "../src/server/storage/single-request-upload.mjs";

function response({ ok = true, status = 200, json = {}, headers = new Map() } = {}) {
  const normalized = new Map(
    [...headers.entries()].map(([key, value]) => [String(key).toLowerCase(), value]),
  );
  return {
    ok,
    status,
    headers: {
      get(name) {
        return normalized.get(String(name).toLowerCase()) ?? null;
      },
    },
    async json() {
      return json;
    },
  };
}

test("single-request mode sends a file larger than 4 MiB in one Drive PUT", async () => {
  const body = Buffer.alloc(5 * 1024 * 1024 + 321, 7);
  const calls = [];
  const drive = {
    originalFolderId: "original-folder",
    async findChildByName() {
      return null;
    },
    async proxy(connector, path, options = {}) {
      calls.push({ connector, path, options });
      if (options.method === "POST") {
        return response({
          headers: new Map([
            ["location", "https://www.googleapis.com/upload/drive/v3/files?upload_id=single-1"],
          ]),
        });
      }
      return response({
        json: { id: "file-1", name: "large.png", size: String(body.length) },
      });
    },
  };
  const sessions = [];
  const progress = [];

  const result = await uploadOriginalSingleRequest({
    drive,
    bytes: body,
    byteSize: body.length,
    filename: "large.png",
    contentType: "image/png",
    onSession: (value) => sessions.push(value),
    onProgress: (value) => progress.push(value),
  });

  assert.equal(result.fileId, "file-1");
  const uploads = calls.filter(({ options }) => options.method === "PUT");
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0].options.body.length, body.length);
  assert.equal(
    uploads[0].options.headers["Content-Range"],
    `bytes 0-${body.length - 1}/${body.length}`,
  );
  assert.deepEqual(sessions.map((item) => item.uploadedBytes), [0]);
  assert.deepEqual(progress.map((item) => item.uploadedBytes), [body.length]);
});

test("single-request mode keeps deterministic Drive reuse", async () => {
  let proxyCalls = 0;
  const drive = {
    originalFolderId: "original-folder",
    async findChildByName(_folderId, filename) {
      return { id: "existing", name: filename, size: "123" };
    },
    async proxy() {
      proxyCalls += 1;
      return response();
    },
  };

  const result = await uploadOriginalSingleRequest({
    drive,
    bytes: Buffer.alloc(123),
    filename: "same.png",
    contentType: "image/png",
  });

  assert.equal(result.fileId, "existing");
  assert.equal(result.reused, true);
  assert.equal(proxyCalls, 0);
});

test("single-request mode reports a rejected full-file PUT", async () => {
  const drive = {
    originalFolderId: "original-folder",
    async findChildByName() {
      return null;
    },
    async proxy(_connector, _path, options = {}) {
      if (options.method === "POST") {
        return response({
          headers: new Map([["location", "https://upload.example/session"]]),
        });
      }
      return response({ ok: false, status: 403 });
    },
  };

  await assert.rejects(
    uploadOriginalSingleRequest({
      drive,
      bytes: Buffer.alloc(1024),
      filename: "rejected.png",
      contentType: "image/png",
    }),
    (error) => error.status === 403,
  );
});
