import assert from "node:assert/strict";
import test from "node:test";
import { GoogleDriveStorage } from "../src/server/storage/drive-adapter.mjs";
import { createReplitDriveProxy } from "../src/server/storage/replit-drive.mjs";

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

function captureWarnings() {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args);
  return {
    warnings,
    restore() {
      console.warn = originalWarn;
    },
  };
}

test("discards a connector-rejected persisted session and starts a fresh resumable upload", async () => {
  const calls = [];
  const sessions = [];
  const connectors = {
    async proxy(connector, path, options = {}) {
      calls.push({ connector, path, options });
      if (String(path).startsWith("/drive/v3/files?q=")) {
        return response({ json: { files: [] } });
      }
      if (
        path === "/stale-session" &&
        options.headers?.["Content-Range"] === "bytes */3"
      ) {
        return response({ ok: false, status: 403 });
      }
      if (
        String(path).includes("uploadType=resumable") &&
        options.method === "POST"
      ) {
        return response({
          headers: new Map([["location", "https://upload.example/fresh-session"]]),
        });
      }
      if (
        path === "/fresh-session" &&
        options.headers?.["Content-Range"] === "bytes 0-2/3"
      ) {
        return response({
          json: { id: "fresh-file-id", name: "photo.png", size: "3" },
        });
      }
      throw new Error(`Unexpected Drive request: ${path}`);
    },
  };

  const drive = new GoogleDriveStorage({
    originalFolderId: "originals-folder",
    proxy: createReplitDriveProxy(connectors),
  });
  const captured = captureWarnings();
  try {
    const uploaded = await drive.uploadOriginal({
      bytes: Buffer.from("abc"),
      filename: "photo.png",
      contentType: "image/png",
      resumeSessionUri: "https://upload.example/stale-session",
      onSession: async (state) => sessions.push(state),
    });

    assert.equal(uploaded.fileId, "fresh-file-id");
    assert.equal(
      calls.some(
        ({ path, options }) =>
          path === "/stale-session" &&
          options.headers?.["Content-Range"] === "bytes */3",
      ),
      true,
    );
    assert.equal(
      calls.some(
        ({ path, options }) =>
          String(path).includes("uploadType=resumable") && options.method === "POST",
      ),
      true,
    );
    assert.deepEqual(sessions, [
      {
        sessionUri: "https://upload.example/fresh-session",
        uploadedBytes: 0,
      },
    ]);
    assert.equal(
      captured.warnings.some(
        ([message, details]) =>
          message === "Memories Drive request diagnostic" &&
          details.stage === "session-status" &&
          details.status === 403 &&
          details.strategy === "discard-stale-session" &&
          details.chunkBytes === 0,
      ),
      true,
    );
  } finally {
    captured.restore();
  }
});

test("keeps a genuine 401 session-status response as an authorization failure", async () => {
  let calls = 0;
  const connectors = {
    async proxy() {
      calls += 1;
      return response({ ok: false, status: 401 });
    },
  };
  const proxy = createReplitDriveProxy(connectors);
  const captured = captureWarnings();
  try {
    const result = await proxy("google-drive", "/session", {
      method: "PUT",
      headers: { "Content-Range": "bytes */100" },
      body: Buffer.alloc(0),
    });
    assert.equal(result.status, 401);
    assert.equal(calls, 1);
    assert.equal(
      captured.warnings.some(
        ([, details]) =>
          details.stage === "session-status" &&
          details.status === 401 &&
          details.strategy === "original-request",
      ),
      true,
    );
  } finally {
    captured.restore();
  }
});

test("labels a rejected small multipart thumbnail write explicitly", async () => {
  const connectors = {
    async proxy() {
      return response({ ok: false, status: 403 });
    },
  };
  const proxy = createReplitDriveProxy(connectors);
  const body = Buffer.alloc(256_956, 1);
  const captured = captureWarnings();
  try {
    const result = await proxy(
      "google-drive",
      "/upload/drive/v3/files?uploadType=multipart&fields=id",
      {
        method: "POST",
        headers: { "Content-Type": "multipart/related; boundary=test" },
        body,
      },
    );
    assert.equal(result.status, 403);
    assert.equal(
      captured.warnings.some(
        ([message, details]) =>
          message === "Memories Drive request diagnostic" &&
          details.stage === "thumbnail-upload" &&
          details.status === 403 &&
          details.strategy === "original-request" &&
          details.chunkBytes === body.length,
      ),
      true,
    );
  } finally {
    captured.restore();
  }
});
