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
  return {
    ok,
    status,
    body,
    headers: {
      get: (name) => headers.get(name.toLowerCase()) ?? null,
    },
    async json() {
      return json;
    },
  };
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

test("uploads originals into the approved folder without returning it", async () => {
  let request;
  const storage = new GoogleDriveStorage({
    originalFolderId: "private-originals-folder-id",
    proxy: async (connector, path, options) => {
      if (path.startsWith("/drive/v3/files?q=")) {
        return response({ json: { files: [] } });
      }
      request = { connector, path, options };
      return response({
        json: {
          id: "private-file-id",
          name: "photo.jpg",
          size: "3",
        },
      });
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
  assert.equal(request.connector, "google-drive");
  assert.match(
    request.options.body.toString(),
    /private-originals-folder-id/,
  );
});

test("reuses an existing deterministic Drive filename without uploading again", async () => {
  let uploadRequests = 0;
  const storage = new GoogleDriveStorage({
    originalFolderId: "private-originals-folder-id",
    proxy: async (_connector, path) => {
      if (path.startsWith("/drive/v3/files?q=")) {
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

test("uses a separately configured technical thumbnail folder", async () => {
  let request;
  const storage = new GoogleDriveStorage({
    originalFolderId: "private-originals-folder-id",
    thumbnailFolderId: "private-thumbnails-folder-id",
    proxy: async (connector, path, options) => {
      if (path.startsWith("/drive/v3/files?q=")) {
        return response({ json: { files: [] } });
      }
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
});

test("recovers a file created before an ambiguous retryable response", async () => {
  let lookupCount = 0;
  let uploadCount = 0;
  const storage = new GoogleDriveStorage({
    originalFolderId: "private-originals-folder-id",
    proxy: async (_connector, path) => {
      if (path.startsWith("/drive/v3/files?q=")) {
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
      uploadCount += 1;
      return response({ ok: false, status: 503 });
    },
  });

  const result = await storage.uploadOriginal({
    bytes: Buffer.from("abc"),
    filename: "photo.jpg",
    contentType: "image/jpeg",
  });

  assert.equal(result.fileId, "recovered-id");
  assert.equal(result.reused, true);
  assert.equal(uploadCount, 1);
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
