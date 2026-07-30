import assert from "node:assert/strict";
import test from "node:test";
import {
  DriveConnectorError,
  GoogleDriveStorage,
} from "../src/server/storage/drive-adapter.mjs";

function response({
  ok = true,
  status = 200,
  json = {},
  body = Buffer.from("file"),
  headers = new Map(),
} = {}) {
  const normalized = new Map(
    [...headers.entries()].map(([key, value]) => [String(key).toLowerCase(), value]),
  );
  return {
    ok,
    status,
    body,
    headers: {
      get: (name) => normalized.get(String(name).toLowerCase()) ?? null,
    },
    async json() {
      return json;
    },
  };
}

function isLookup(path) {
  return path.startsWith("/drive/v3/files?q=");
}

function isSessionStart(path, options) {
  return path.includes("uploadType=resumable") && options?.method === "POST";
}

test("requires the server-side Memories originals folder id", () => {
  assert.throws(
    () =>
      new GoogleDriveStorage({
        proxy: async () => response(),
        originalFolderId: "",
      }),
    /MEMORIES_DRIVE_PHOTOS_FOLDER_ID/,
  );
});

test("uploads originals through a Drive resumable session", async () => {
  const requests = [];
  const storage = new GoogleDriveStorage({
    originalFolderId: "private-originals-folder-id",
    proxy: async (connector, path, options = {}) => {
      requests.push({ connector, path, options });
      if (isLookup(path)) return response({ json: { files: [] } });
      if (isSessionStart(path, options)) {
        return response({
          headers: new Map([
            ["location", "https://www.googleapis.com/upload/drive/v3/files?upload_id=session-1"],
          ]),
        });
      }
      if (path.includes("upload_id=session-1")) {
        return response({
          json: { id: "private-file-id", name: "photo.jpg", size: "3" },
        });
      }
      throw new Error(`Unexpected path ${path}`);
    },
  });

  const result = await storage.uploadOriginal({
    bytes: Buffer.from("abc"),
    filename: "photo.jpg",
    contentType: "image/jpeg",
  });

  assert.deepEqual(result, {
    fileId: "private-file-id",
    name: "photo.jpg",
    size: 3,
    reused: false,
  });
  const start = requests.find(({ path, options }) => isSessionStart(path, options));
  assert.equal(start.connector, "google-drive");
  assert.match(start.options.body, /private-originals-folder-id/);
  assert.equal(start.options.headers["X-Upload-Content-Length"], "3");
  const chunk = requests.find(({ path, options }) =>
    path.includes("upload_id=session-1") && options.headers?.["Content-Range"]?.startsWith("bytes 0-2/3"),
  );
  assert.ok(chunk);
  assert.equal(chunk.options.body.toString(), "abc");
});

test("uploads a large original in 4 MiB chunks", async () => {
  const ranges = [];
  const bytes = Buffer.alloc(4 * 1024 * 1024 + 3, 7);
  const storage = new GoogleDriveStorage({
    originalFolderId: "private-originals-folder-id",
    proxy: async (_connector, path, options = {}) => {
      if (isLookup(path)) return response({ json: { files: [] } });
      if (isSessionStart(path, options)) {
        return response({
          headers: new Map([["location", "https://upload.example/session-large"]]),
        });
      }
      if (path === "/session-large") {
        const range = options.headers["Content-Range"];
        ranges.push(range);
        if (ranges.length === 1) {
          return response({
            ok: false,
            status: 308,
            headers: new Map([["range", `bytes=0-${4 * 1024 * 1024 - 1}`]]),
          });
        }
        return response({
          json: { id: "large-id", name: "large.jpg", size: String(bytes.length) },
        });
      }
      throw new Error(`Unexpected path ${path}`);
    },
  });

  const progress = [];
  const result = await storage.uploadOriginal({
    bytes,
    filename: "large.jpg",
    contentType: "image/jpeg",
    onProgress: ({ uploadedBytes }) => progress.push(uploadedBytes),
  });

  assert.equal(result.fileId, "large-id");
  assert.deepEqual(ranges, [
    `bytes 0-${4 * 1024 * 1024 - 1}/${bytes.length}`,
    `bytes ${4 * 1024 * 1024}-${bytes.length - 1}/${bytes.length}`,
  ]);
  assert.deepEqual(progress, [4 * 1024 * 1024, bytes.length]);
});

test("continues a persisted resumable session from the accepted range", async () => {
  const requests = [];
  const bytes = Buffer.alloc(4 * 1024 * 1024 + 2, 9);
  const storage = new GoogleDriveStorage({
    originalFolderId: "private-originals-folder-id",
    proxy: async (_connector, path, options = {}) => {
      requests.push({ path, options });
      if (isLookup(path)) return response({ json: { files: [] } });
      if (path === "/existing-session" && options.headers?.["Content-Range"] === `bytes */${bytes.length}`) {
        return response({
          ok: false,
          status: 308,
          headers: new Map([["range", `bytes=0-${4 * 1024 * 1024 - 1}`]]),
        });
      }
      if (path === "/existing-session") {
        return response({
          json: { id: "resumed-id", name: "resume.jpg", size: String(bytes.length) },
        });
      }
      throw new Error(`Unexpected path ${path}`);
    },
  });

  const result = await storage.uploadOriginal({
    bytes,
    filename: "resume.jpg",
    contentType: "image/jpeg",
    resumeSessionUri: "https://upload.example/existing-session",
    resumeOffset: 0,
  });

  assert.equal(result.fileId, "resumed-id");
  assert.equal(requests.some(({ path, options }) => isSessionStart(path, options)), false);
  const resumedChunk = requests.find(
    ({ path, options }) =>
      path === "/existing-session" &&
      options.headers?.["Content-Range"] ===
        `bytes ${4 * 1024 * 1024}-${bytes.length - 1}/${bytes.length}`,
  );
  assert.ok(resumedChunk);
  assert.equal(resumedChunk.options.body.length, 2);
});

test("reuses an existing deterministic Drive filename without uploading again", async () => {
  let uploadRequests = 0;
  const storage = new GoogleDriveStorage({
    originalFolderId: "private-originals-folder-id",
    proxy: async (_connector, path) => {
      if (isLookup(path)) {
        return response({
          json: {
            files: [{ id: "existing-id", name: "photo.jpg", size: "3" }],
          },
        });
      }
      uploadRequests += 1;
      return response();
    },
  });

  const result = await storage.uploadOriginal({
    bytes: Buffer.from("abc"),
    filename: "photo.jpg",
    contentType: "image/jpeg",
  });

  assert.equal(result.fileId, "existing-id");
  assert.equal(result.reused, true);
  assert.equal(uploadRequests, 0);
});

test("does not place technical thumbnails beside originals without approval", async () => {
  const storage = new GoogleDriveStorage({
    originalFolderId: "private-originals-folder-id",
    proxy: async () => response(),
  });

  await assert.rejects(
    storage.uploadThumbnail({
      bytes: Buffer.from("thumb"),
      filename: "thumb.webp",
    }),
    (error) => error.code === "THUMBNAIL_FOLDER_NOT_CONFIGURED",
  );
});

test("keeps small thumbnails in the separately configured folder", async () => {
  let request;
  const storage = new GoogleDriveStorage({
    originalFolderId: "private-originals-folder-id",
    thumbnailFolderId: "private-thumbnails-folder-id",
    proxy: async (connector, path, options) => {
      if (isLookup(path)) return response({ json: { files: [] } });
      request = { connector, path, options };
      return response({
        json: {
          id: "private-thumbnail-id",
          name: "thumb.webp",
          size: "5",
        },
      });
    },
  });

  await storage.uploadThumbnail({
    bytes: Buffer.from("thumb"),
    filename: "thumb.webp",
  });

  const body = request.options.body.toString();
  assert.match(body, /private-thumbnails-folder-id/);
  assert.doesNotMatch(body, /private-originals-folder-id/);
  assert.match(request.path, /uploadType=multipart/);
});

test("recovers a Drive file after an ambiguous resumable response", async () => {
  let lookupCount = 0;
  const storage = new GoogleDriveStorage({
    originalFolderId: "private-originals-folder-id",
    proxy: async (_connector, path, options = {}) => {
      if (isLookup(path)) {
        lookupCount += 1;
        return response({
          json: {
            files:
              lookupCount > 1
                ? [{ id: "recovered-id", name: "photo.jpg", size: "3" }]
                : [],
          },
        });
      }
      if (isSessionStart(path, options)) {
        return response({
          headers: new Map([["location", "https://upload.example/ambiguous"]]),
        });
      }
      if (path === "/ambiguous" && options.headers?.["Content-Range"] === "bytes 0-2/3") {
        return response({ ok: false, status: 503 });
      }
      if (path === "/ambiguous" && options.headers?.["Content-Range"] === "bytes */3") {
        return response({
          ok: false,
          status: 308,
          headers: new Map([["range", "bytes=0-2"]]),
        });
      }
      throw new Error(`Unexpected path ${path}`);
    },
  });

  const result = await storage.uploadOriginal({
    bytes: Buffer.from("abc"),
    filename: "photo.jpg",
    contentType: "image/jpeg",
  });

  assert.equal(result.fileId, "recovered-id");
  assert.equal(result.reused, false);
  assert.equal(lookupCount, 2);
});

test("connector errors are sanitized and never include response bodies", async () => {
  const storage = new GoogleDriveStorage({
    originalFolderId: "private-originals-folder-id",
    proxy: async () =>
      response({
        ok: false,
        status: 503,
        json: { token: "must-not-leak" },
      }),
  });

  await assert.rejects(
    storage.download("file-id"),
    (error) =>
      error instanceof DriveConnectorError &&
      error.code === "DRIVE_RETRYABLE" &&
      !error.message.includes("must-not-leak"),
  );
});

test("401 and 403 responses map to DRIVE_AUTHORIZATION_REQUIRED", async () => {
  for (const status of [401, 403]) {
    const storage = new GoogleDriveStorage({
      originalFolderId: "private-originals-folder-id",
      proxy: async () => response({ ok: false, status }),
    });
    await assert.rejects(
      storage.listChildren("some-folder"),
      (error) =>
        error instanceof DriveConnectorError &&
        error.code === "DRIVE_AUTHORIZATION_REQUIRED",
    );
  }
});
