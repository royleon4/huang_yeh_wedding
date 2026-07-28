import assert from "node:assert/strict";
import test from "node:test";
import { GoogleDriveStorage } from "../src/server/storage/drive-adapter.mjs";

test("folder discovery removes the need to expose system folder ids", async () => {
  const requests = [];
  const storage = new GoogleDriveStorage({
    originalFolderId: "root-secret",
    proxy: async (_connector, path, options = {}) => {
      requests.push({ path, options });
      if (path.startsWith("/drive/v3/files?q=")) {
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              files: [
                { id: "guest-folder", name: "訪客上傳", mimeType: "application/vnd.google-apps.folder" },
                { id: "thumb-folder", name: "系統縮圖", mimeType: "application/vnd.google-apps.folder" },
              ],
            };
          },
        };
      }
      throw new Error("Unexpected request");
    },
  });

  const guest = await storage.findOrCreateFolder("root-secret", "訪客上傳");
  const thumbnails = await storage.findOrCreateFolder("root-secret", "系統縮圖");
  assert.equal(guest.id, "guest-folder");
  assert.equal(thumbnails.id, "thumb-folder");
  assert.equal(requests.length, 2);
});
