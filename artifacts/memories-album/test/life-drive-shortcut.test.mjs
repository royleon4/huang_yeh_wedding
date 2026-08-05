import assert from "node:assert/strict";
import test from "node:test";
import { createResourceAwareDriveStorage } from "../src/server/storage/resource-aware-drive.mjs";

function jsonResponse(body) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => "application/json" },
    async json() {
      return body;
    },
  };
}

test("image shortcuts become importable only inside the configured life folder", async () => {
  const shortcut = {
    id: "shortcut-file",
    name: "life-photo.jpg",
    mimeType: "application/vnd.google-apps.shortcut",
    capabilities: { canDownload: true },
    shortcutDetails: {
      targetId: "target-file",
      targetMimeType: "image/jpeg",
      targetResourceKey: "target-key",
    },
  };
  const storage = createResourceAwareDriveStorage({
    originalFolderId: "root-folder",
    async proxy() {
      return jsonResponse({ files: [shortcut] });
    },
  });
  storage.lifeFolderId = "life-folder";

  const lifeFiles = await storage.listChildren("life-folder");
  const weddingFiles = await storage.listChildren("wedding-folder");

  assert.equal(lifeFiles[0].id, "shortcut-file");
  assert.equal(lifeFiles[0].mimeType, "image/jpeg");
  assert.equal(weddingFiles[0].mimeType, "application/vnd.google-apps.shortcut");
});
