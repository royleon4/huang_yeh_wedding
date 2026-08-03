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
  assert.equal(editor.includes("const DOCUMENT_IMPORT_ACCEPT = ["), true);
  for (const extension of [".docx", ".pdf", ".ppt", ".pptx"]) {
    assert.equal(editor.includes(extension), true);
  }
  assert.equal(editor.includes('"匯入文件"'), true);
  assert.equal(editor.includes("accept={DOCUMENT_IMPORT_ACCEPT}"), true);
  assert.equal(editor.includes("importDocument(event.target.files?.[0]"), true);
  assert.equal(
    editor.includes("pageDocumentKind({ name: file.name, mimeType: file.type })"),
    true,
  );
  assert.equal(editor.includes('"匯入 Word"'), false);
});

test("generic attachment selector no longer duplicates document import formats", async () => {
  const editor = await readFile(editorUrl, "utf8");
  const start = editor.indexOf("const ATTACHMENT_ACCEPT = [");
  const end = editor.indexOf('].join(",");', start);
  const generic = start >= 0 && end > start ? editor.slice(start, end) : "";
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
  const start = drive.indexOf("async uploadAttachment(");
  const end = drive.indexOf("async uploadThumbnail(", start);
  const attachmentMethod = start >= 0 && end > start ? drive.slice(start, end) : "";
  assert.equal(attachmentMethod.includes("#uploadMultipart("), true);
  assert.equal(attachmentMethod.includes("#uploadResumable"), false);
  assert.equal(attachmentMethod.includes("Content-Range"), false);
  assert.equal(attachmentMethod.includes("RESUMABLE_CHUNK_BYTES"), false);
  assert.equal(api.includes("const uploaded = await drive.uploadAttachment({"), true);
  assert.equal(api.includes("const uploaded = await drive.uploadOriginal({"), false);
  assert.equal(proxy.includes('"attachment-upload"'), true);
  assert.equal(proxy.includes('"thumbnail-upload"'), true);
});

test("Drive 403 error states that direct upload did not use chunks", async () => {
  const adminClient = await readFile(adminClientUrl, "utf8");
  assert.equal(adminClient.includes("DRIVE_AUTHORIZATION_REQUIRED"), true);
  assert.equal(adminClient.includes("未使用分段上傳"), true);
});
