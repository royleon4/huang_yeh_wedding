import assert from "node:assert/strict";
import test from "node:test";
import { createResourceAwareDriveStorage } from "../src/server/storage/resource-aware-drive.mjs";

function headers(values = {}) {
  const normalized = new Map(
    Object.entries(values).map(([key, value]) => [key.toLowerCase(), value]),
  );
  return {
    get(name) {
      return normalized.get(String(name).toLowerCase()) ?? null;
    },
  };
}

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: headers({ "content-type": "application/json" }),
    async json() {
      return body;
    },
  };
}

function mediaResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    body,
    headers: headers({
      "content-type": "image/jpeg",
      "content-length": String(body.length),
    }),
  };
}

test("Drive listing requests resource keys and image dimensions", async () => {
  const requests = [];
  const storage = createResourceAwareDriveStorage({
    originalFolderId: "root-folder",
    async proxy(connector, path, options = {}) {
      requests.push({ connector, path, options });
      return jsonResponse({
        files: [
          {
            id: "official-file",
            name: "wedding.jpg",
            mimeType: "image/jpeg",
            size: "30000000",
            resourceKey: "resource-key",
            capabilities: { canDownload: true },
            imageMediaMetadata: { width: 8256, height: 5504 },
          },
        ],
      });
    },
  });

  const files = await storage.listChildren("official-folder");

  assert.equal(files.length, 1);
  assert.equal(files[0].imageMediaMetadata.width, 8256);
  assert.equal(requests[0].connector, "google-drive");
  assert.match(requests[0].path, /resourceKey/);
  assert.match(requests[0].path, /capabilities\(canDownload\)/);
  assert.match(requests[0].path, /imageMediaMetadata\(time,width,height\)/);
  assert.match(requests[0].path, /supportsAllDrives=true/);
  assert.match(requests[0].path, /includeItemsFromAllDrives=true/);
});

test("Drive download sends a cached resource key after listing", async () => {
  const requests = [];
  const storage = createResourceAwareDriveStorage({
    originalFolderId: "root-folder",
    async proxy(connector, path, options = {}) {
      requests.push({ connector, path, options });
      if (path.startsWith("/drive/v3/files?q=")) {
        return jsonResponse({
          files: [
            {
              id: "official-file",
              name: "wedding.jpg",
              mimeType: "image/jpeg",
              resourceKey: "rk-123",
            },
          ],
        });
      }
      const expected = options.headers?.["X-Goog-Drive-Resource-Keys"];
      if (expected !== "official-file/rk-123") {
        return jsonResponse({ error: "not found" }, 404);
      }
      return mediaResponse(Buffer.from("official-image"));
    },
  });

  await storage.listChildren("official-folder");
  const downloaded = await storage.download("official-file");

  assert.equal(downloaded.contentType, "image/jpeg");
  assert.equal(downloaded.contentLength, 14);
  assert.equal(downloaded.body.toString(), "official-image");
  assert.equal(
    requests.at(-1).options.headers["X-Goog-Drive-Resource-Keys"],
    "official-file/rk-123",
  );
});

test("a 404 download refreshes file metadata and retries with its resource key", async () => {
  const requests = [];
  const storage = createResourceAwareDriveStorage({
    originalFolderId: "root-folder",
    async proxy(connector, path, options = {}) {
      requests.push({ connector, path, options });
      if (path.includes("alt=media")) {
        const supplied = options.headers?.["X-Goog-Drive-Resource-Keys"];
        return supplied === "official-file/rk-refresh"
          ? mediaResponse(Buffer.from("recovered-image"))
          : jsonResponse({ error: "not found" }, 404);
      }
      if (path.includes("fields=")) {
        return jsonResponse({
          id: "official-file",
          mimeType: "image/jpeg",
          resourceKey: "rk-refresh",
          capabilities: { canDownload: true },
        });
      }
      throw new Error(`Unexpected path: ${path}`);
    },
  });

  const downloaded = await storage.download("official-file");

  assert.equal(downloaded.body.toString(), "recovered-image");
  assert.equal(requests.length, 3);
  assert.match(requests[1].path, /fields=/);
  assert.equal(
    requests[2].options.headers["X-Goog-Drive-Resource-Keys"],
    "official-file/rk-refresh",
  );
});

test("a shortcut download resolves to its image target after listing", async () => {
  const requests = [];
  const storage = createResourceAwareDriveStorage({
    originalFolderId: "root-folder",
    async proxy(connector, path, options = {}) {
      requests.push({ connector, path, options });
      if (path.startsWith("/drive/v3/files?q=")) {
        return jsonResponse({
          files: [
            {
              id: "shortcut-file",
              name: "life.jpg",
              mimeType: "application/vnd.google-apps.shortcut",
              shortcutDetails: {
                targetId: "target-file",
                targetMimeType: "image/jpeg",
                targetResourceKey: "target-rk",
              },
            },
          ],
        });
      }
      assert.match(path, /\/target-file\?alt=media/);
      assert.equal(
        options.headers?.["X-Goog-Drive-Resource-Keys"],
        "target-file/target-rk",
      );
      return mediaResponse(Buffer.from("shortcut-target"));
    },
  });

  await storage.listChildren("life-folder");
  const downloaded = await storage.download("shortcut-file");

  assert.equal(downloaded.body.toString(), "shortcut-target");
});

test("Drive download keeps ordinary files header-free", async () => {
  const requests = [];
  const storage = createResourceAwareDriveStorage({
    originalFolderId: "root-folder",
    async proxy(connector, path, options = {}) {
      requests.push({ connector, path, options });
      return mediaResponse(Buffer.from("guest-image"));
    },
  });

  const downloaded = await storage.download("guest-file");

  assert.equal(downloaded.body.toString(), "guest-image");
  assert.deepEqual(requests[0].options, {});
});
