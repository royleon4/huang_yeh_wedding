import assert from "node:assert/strict";
import test from "node:test";
import { GoogleDriveStorage } from "../src/server/storage/drive-adapter.mjs";

test("uploadAttachment sends one multipart request without a resumable session", async () => {
  const requests = [];
  const drive = new GoogleDriveStorage({
    originalFolderId: "root-folder",
    proxy: async (_connector, path, options = {}) => {
      requests.push({ path, options });
      if (path.startsWith("/drive/v3/files?q=")) {
        return {
          ok: true,
          status: 200,
          async json() {
            return { files: [] };
          },
        };
      }
      if (path.includes("uploadType=multipart")) {
        return {
          ok: true,
          status: 200,
          async json() {
            return { id: "attachment-file", name: "attachment.pdf", size: "4" };
          },
        };
      }
      throw new Error(`Unexpected Drive path: ${path}`);
    },
  });

  const result = await drive.uploadAttachment({
    bytes: Buffer.from("test"),
    filename: "attachment.pdf",
    contentType: "application/pdf",
    parentId: "attachments-folder",
    appProperties: { uploader: "admin" },
  });

  assert.equal(result.fileId, "attachment-file");
  const uploadRequests = requests.filter((request) => request.path.includes("/upload/"));
  assert.equal(uploadRequests.length, 1);
  assert.match(uploadRequests[0].path, /uploadType=multipart/);
  assert.doesNotMatch(uploadRequests[0].path, /uploadType=resumable/);
  assert.match(uploadRequests[0].options.headers["Content-Type"], /^multipart\/related;/);
  assert.equal(Object.hasOwn(uploadRequests[0].options.headers, "Content-Range"), false);
});
