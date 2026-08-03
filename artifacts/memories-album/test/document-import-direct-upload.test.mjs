import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const editorUrl = new URL("../src/client/RichTextEditor.jsx", import.meta.url);
const driveUrl = new URL("../src/server/storage/drive-adapter.mjs", import.meta.url);
const apiUrl = new URL("../src/server/process-content/api.mjs", import.meta.url);
const proxyUrl = new URL("../src/server/storage/replit-drive.mjs", import.meta.url);
const adminClientUrl = new URL("../src/client/admin-client.mjs", import.meta.url);

test("Word PDF and PowerPoint share one document import control", async () => {
  const editor = await readFile(editorUrl, "utf8");
  assert.match(editor, /const DOCUMENT_IMPORT_ACCEPT = [/);
  for (const extension of [".docx", ".pdf", ".ppt", ".pptx"]) {
    assert.ok(editor.includes(extension));
  }
  assert.match(editor, /label={importingWord || uploading ? "匯入中" : "匯入文件"}/);
  assert.match(editor, /accept={DOCUMENT_IMPORT_ACCEPT}/);
  assert.match(editor, /importDocument(event.target.files?.[0]/);
  assert.match(editor, /pageDocumentKind({ name: file.name, mimeType: file.type })/);
  assert.doesNotMatch(editor, /label={importingWord ? "匯入中" : "匯入 Word"}/);
});

test("generic attachment selector no longer duplicates document import formats", async () => {
  const editor = await readFile(editorUrl, "utf8");
  const generic = editor.match(/const ATTACHMENT_ACCEPT = [([sS]*?)].join(",");/)?.[1] || "";
  for (const extension of [".docx", ".pdf", ".ppt", ".pptx"]) {
    assert.equal(generic.includes(extension), false);
  }
});

test("process content attachments use one direct multipart request without resumable chunks", async () => {
  const [drive, api, proxy] = await Promise.all([
    readFile(driveUrl, "utf8"),
    readFile(apiUrl, "utf8"),
    readFile(proxyUrl, "utf8"),
  ]);
  const attachmentMethod = drive.match(/async uploadAttachment([sS]*?
  }

  async uploadThumbnail/)?.[0] || "";
  assert.match(attachmentMethod, /#uploadMultipart(/);
  assert.doesNotMatch(attachmentMethod, /#uploadResumable|Content-Range|RESUMABLE_CHUNK_BYTES/);
  assert.match(api, /const uploaded = await drive.uploadAttachment({/);
  assert.doesNotMatch(api, /const uploaded = await drive.uploadOriginal({/);
  assert.match(proxy, /return "multipart-upload"/);
});

test("Drive 403 error states that direct upload did not use chunks", async () => {
  const adminClient = await readFile(adminClientUrl, "utf8");
  assert.match(adminClient, /DRIVE_AUTHORIZATION_REQUIRED/);
  assert.match(adminClient, /未使用分段上傳/);
});
