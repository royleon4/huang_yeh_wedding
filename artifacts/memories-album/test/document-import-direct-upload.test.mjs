import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const editorUrl = new URL("../src/client/RichTextEditor.jsx", import.meta.url);
const driveUrl = new URL("../src/server/storage/drive-adapter.mjs", import.meta.url);
const apiUrl = new URL("../src/server/process-content/api.mjs", import.meta.url);
const proxyUrl = new URL("../src/server/storage/replit-drive.mjs", import.meta.url);

test("editor exposes Word-only import and image-only upload controls", async () => {
  const editor = await readFile(editorUrl, "utf8");
  assert.match(editor, /label=\{importingWord \? "匯入中" : "匯入 Word"\}/);
  assert.match(editor, /accept=\{WORD_IMPORT_ACCEPT\}/);
  assert.match(editor, /label=\{uploading \? "上傳中" : "加入圖片"\}/);
  assert.match(editor, /accept=\{IMAGE_UPLOAD_ACCEPT\}/);
  assert.match(editor, /IMAGE_UPLOAD_MIME_TYPES/);
  for (const forbidden of ["application/pdf", ".ppt", ".pptx", ".xlsx", ".zip"]) {
    assert.equal(editor.includes(forbidden), false);
  }
  assert.equal(editor.includes("PageDocument"), false);
  assert.equal(editor.includes("AttachmentCard"), false);
});

test("server accepts only supported images and DOCX for Word fidelity storage", async () => {
  const api = await readFile(apiUrl, "utf8");
  for (const allowed of [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]) {
    assert.equal(api.includes(allowed), true);
  }
  for (const forbidden of [
    "application/pdf",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/zip",
    "text/plain",
  ]) {
    assert.equal(api.includes(forbidden), false);
  }
});

test("image and Word source files use one direct multipart request without chunks", async () => {
  const [drive, api, proxy] = await Promise.all([
    readFile(driveUrl, "utf8"),
    readFile(apiUrl, "utf8"),
    readFile(proxyUrl, "utf8"),
  ]);
  const start = drive.indexOf("async uploadAttachment(");
  const end = drive.indexOf("async uploadThumbnail(", start);
  const method = start >= 0 && end > start ? drive.slice(start, end) : "";
  assert.match(method, /#uploadMultipart\(/);
  assert.doesNotMatch(method, /#uploadResumable|Content-Range|RESUMABLE_CHUNK_BYTES/);
  assert.match(api, /const uploaded = await drive\.uploadAttachment\(\{/);
  assert.match(proxy, /"attachment-upload"/);
});
