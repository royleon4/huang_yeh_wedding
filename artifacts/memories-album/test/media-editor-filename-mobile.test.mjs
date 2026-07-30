import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { recoverUtf8Filename } from "../src/filename-encoding.mjs";

const apiUrl = new URL("../src/server/process-content/api.mjs", import.meta.url);
const mediaUrl = new URL("../src/client/TiptapMediaNodes.jsx", import.meta.url);
const mediaStylesUrl = new URL("../src/client/rich-text-media-editor.css", import.meta.url);
const editorUrl = new URL("../src/client/RichTextEditor.jsx", import.meta.url);

test("Chinese attachment filenames are recovered from legacy latin1 mojibake", () => {
  assert.equal(recoverUtf8Filename("å©ç¦®æµç¨.pdf"), "婚禮流程.pdf");
  assert.equal(recoverUtf8Filename("café.pdf"), "café.pdf");
  assert.equal(recoverUtf8Filename("report-2026.pdf"), "report-2026.pdf");
});

test("multipart uploads decode filename parameters as UTF-8 and repair legacy records", async () => {
  const api = await readFile(apiUrl, "utf8");
  assert.match(api, /defParamCharset: "utf8"/);
  assert.match(api, /recoverUtf8Filename/);
  assert.match(api, /name: recoverUtf8Filename\(attachment\.originalFilename\)/);
  assert.match(api, /encodeURIComponent\(recoverUtf8Filename\(attachment\.originalFilename\)\)/);
});

test("mobile media editor uses reliable move controls instead of touch drag and resize handles", async () => {
  const media = await readFile(mediaUrl, "utf8");
  const styles = await readFile(mediaStylesUrl, "utf8");

  for (const destination of ["first", "previous", "next", "last"]) {
    assert.match(media, new RegExp(`moveNode\\(editor, getPos, "${destination}"\\)`));
  }

  assert.match(media, /tiptap-attachment-preview/);
  assert.match(media, /openInNewTab/);
  assert.doesNotMatch(media, /<a[\s\S]*className="tiptap-attachment-preview"/);
  assert.match(styles, /@media \(max-width: 720px\), \(pointer: coarse\)/);
  assert.match(styles, /width: 100% !important/);
  assert.match(styles, /\[data-desktop-drag-handle\][\s\S]*display: none/);
  assert.match(styles, /\.tiptap-media-resize-handle[\s\S]*display: none !important/);
  assert.match(styles, /\.tiptap-media-node\.is-selected \.tiptap-media-controls[\s\S]*display: grid/);
});

test("editor explains desktop drag and mobile move controls without promising touch drag", async () => {
  const editor = await readFile(editorUrl, "utf8");
  assert.match(editor, /手機請點選圖片或附件後使用移動與寬度控制/);
  assert.match(editor, /桌面仍可拖曳/);
});
