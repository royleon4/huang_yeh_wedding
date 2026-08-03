import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const editorUrl = new URL("../src/client/RichTextEditor.jsx", import.meta.url);
const mediaUrl = new URL("../src/client/TiptapMediaNodes.jsx", import.meta.url);
const contentUrl = new URL("../src/client/ProcessRichContent.jsx", import.meta.url);
const stylesUrl = new URL("../src/client/rich-text-formatting.css", import.meta.url);
const packageUrl = new URL("../package.json", import.meta.url);

test("article editor uses the open-source Tiptap React stack instead of execCommand", async () => {
  const editor = await readFile(editorUrl, "utf8");
  const packageJson = JSON.parse(await readFile(packageUrl, "utf8"));
  for (const signal of ["useEditor", "EditorContent", "BubbleMenu", "StarterKit", "TextAlign", "Placeholder"]) {
    assert.match(editor, new RegExp(signal));
  }
  assert.doesNotMatch(editor, /document\.execCommand/);
  for (const dependency of [
    "@tiptap/core",
    "@tiptap/react",
    "@tiptap/starter-kit",
    "@tiptap/extension-text-align",
    "@tiptap/extension-placeholder",
  ]) {
    assert.ok(packageJson.dependencies[dependency]);
  }
});

test("Tiptap toolbar exposes baseline formatting and paragraph alignment", async () => {
  const editor = await readFile(editorUrl, "utf8");
  for (const command of [
    "toggleBold", "toggleItalic", "toggleUnderline", "toggleStrike", "setTextAlign",
    "toggleBulletList", "toggleOrderedList", "liftListItem", "sinkListItem",
    "setLink", "unsetLink", "undo", "redo", "unsetAllMarks", "clearNodes",
  ]) {
    assert.match(editor, new RegExp(command));
  }
  assert.match(editor, /左右等寬/);
});

test("only uploaded images become movable media nodes", async () => {
  const editor = await readFile(editorUrl, "utf8");
  assert.match(editor, /type: "weddingImage"/);
  assert.match(editor, /attachment\?\.isImage/);
  assert.match(editor, /加入圖片/);
  assert.doesNotMatch(editor, /type: "attachmentCard"|加入圖片或附件|PageDocument/);
});

test("image nodes support drag reorder and resizing", async () => {
  const media = await readFile(mediaUrl, "utf8");
  assert.match(media, /name: "weddingImage"[\s\S]*draggable: true/);
  assert.doesNotMatch(media, /name: "attachmentCard"|AttachmentCardView|tiptap-attachment-preview/);
  assert.match(media, /data-drag-handle/);
  assert.match(media, /onPointerDown=\{startResize\}/);
  assert.match(media, /type="range"/);
  for (const destination of ["first", "previous", "next", "last"]) {
    assert.match(media, new RegExp(`moveNode\\(editor, getPos, "${destination}"\\)`));
  }
});

test("public content preserves controlled image width and Word fidelity blocks", async () => {
  const [content, styles] = await Promise.all([
    readFile(contentUrl, "utf8"),
    readFile(stylesUrl, "utf8"),
  ]);
  assert.match(content, /SAFE_TEXT_ALIGNMENTS/);
  assert.match(content, /safeMediaWidth/);
  assert.match(content, /process-word-document/);
  assert.doesNotMatch(content, /process-page-document|pageDocumentKind|renderPageDocumentFromUrl/);
  assert.match(styles, /\.process-rich-content \.process-inline-image/);
  assert.doesNotMatch(styles, /tiptap-attachment-node/);
});
