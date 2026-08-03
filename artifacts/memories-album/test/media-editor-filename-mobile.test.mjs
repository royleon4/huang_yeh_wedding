import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { recoverUtf8Filename } from "../src/filename-encoding.mjs";

const apiUrl = new URL("../src/server/process-content/api.mjs", import.meta.url);
const mediaUrl = new URL("../src/client/TiptapMediaNodes.jsx", import.meta.url);
const mediaStylesUrl = new URL("../src/client/rich-text-media-editor.css", import.meta.url);
const editorUrl = new URL("../src/client/RichTextEditor.jsx", import.meta.url);

test("Chinese image filenames are recovered from legacy latin1 mojibake", () => {
  assert.equal(recoverUtf8Filename("å©ç¦®ç§ç.jpg"), "婚禮照片.jpg");
  assert.equal(recoverUtf8Filename("café.png"), "café.png");
});

test("multipart uploads decode filename parameters as UTF-8", async () => {
  const api = await readFile(apiUrl, "utf8");
  assert.match(api, /defParamCharset: "utf8"/);
  assert.match(api, /recoverUtf8Filename/);
});

test("mobile image editor uses move controls instead of touch drag and resize handles", async () => {
  const media = await readFile(mediaUrl, "utf8");
  const styles = await readFile(mediaStylesUrl, "utf8");
  for (const destination of ["first", "previous", "next", "last"]) {
    assert.match(media, new RegExp(`moveNode\\(editor, getPos, "${destination}"\\)`));
  }
  assert.doesNotMatch(media, /tiptap-attachment-preview|openInNewTab/);
  assert.match(styles, /@media \(max-width: 720px\), \(pointer: coarse\)/);
  assert.match(styles, /width: 100% !important/);
  assert.match(styles, /\[data-desktop-drag-handle\][\s\S]*display: none/);
  assert.match(styles, /\.tiptap-media-resize-handle[\s\S]*display: none !important/);
});

test("editor explains Word-only import and image-only upload", async () => {
  const editor = await readFile(editorUrl, "utf8");
  assert.match(editor, /手機請點選圖片後使用移動與寬度控制/);
  assert.match(editor, /「匯入 Word」只接受 \.docx/);
  assert.match(editor, /「加入圖片」只接受 JPG、PNG、WebP 或 GIF/);
  assert.doesNotMatch(editor, /PDF|PowerPoint|加入圖片或附件/);
});
