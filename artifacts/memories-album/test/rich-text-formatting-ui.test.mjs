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

  assert.match(editor, /useEditor/);
  assert.match(editor, /EditorContent/);
  assert.match(editor, /BubbleMenu/);
  assert.match(editor, /StarterKit/);
  assert.match(editor, /TextAlign/);
  assert.match(editor, /Placeholder/);
  assert.doesNotMatch(editor, /document\.execCommand/);
  assert.doesNotMatch(editor, /contentEditable=\{!disabled\}/);

  for (const dependency of [
    "@tiptap/core",
    "@tiptap/react",
    "@tiptap/starter-kit",
    "@tiptap/extension-text-align",
    "@tiptap/extension-placeholder",
  ]) {
    assert.ok(packageJson.dependencies[dependency], `${dependency} must be installed`);
  }
});

test("Tiptap toolbar exposes baseline formatting and paragraph alignment", async () => {
  const editor = await readFile(editorUrl, "utf8");

  for (const command of [
    "toggleBold",
    "toggleItalic",
    "toggleUnderline",
    "toggleStrike",
    "setTextAlign",
    "toggleBulletList",
    "toggleOrderedList",
    "liftListItem",
    "sinkListItem",
    "setLink",
    "unsetLink",
    "undo",
    "redo",
    "unsetAllMarks",
    "clearNodes",
  ]) {
    assert.match(editor, new RegExp(command));
  }

  for (const alignment of ["left", "center", "right", "justify"]) {
    assert.match(editor, new RegExp(`setTextAlign\\(\"${alignment}\"\\)`));
  }
  assert.match(editor, /左右等寬/);
  assert.match(editor, /反白文字可快速套用格式/);
});

test("uploaded images and files are inserted as movable Tiptap nodes", async () => {
  const editor = await readFile(editorUrl, "utf8");

  assert.match(editor, /type: "weddingImage"/);
  assert.match(editor, /type: "attachmentCard"/);
  assert.match(editor, /attachment\.isImage/);
  assert.match(editor, /insertContent\(\[node, \{ type: "paragraph" \}\]\)/);
  assert.match(editor, /加入圖片或附件/);
  assert.match(editor, /插入文章/);
  assert.match(editor, /application\/pdf/);
  assert.match(editor, /\.docx/);
  assert.match(editor, /\.xlsx/);
  assert.match(editor, /\.pptx/);
  assert.match(editor, /\.zip/);
});

test("image and attachment nodes support drag reorder and arbitrary resizing", async () => {
  const media = await readFile(mediaUrl, "utf8");

  assert.match(media, /name: "weddingImage"[\s\S]*draggable: true/);
  assert.match(media, /name: "attachmentCard"[\s\S]*draggable: true/);
  assert.match(media, /data-drag-handle/);
  assert.match(media, /onPointerDown=\{startResize\}/);
  assert.match(media, /window\.addEventListener\("pointermove", move\)/);
  assert.match(media, /updateAttributes\(\{ width: latestWidth \}\)/);
  assert.match(media, /type="range"/);
  assert.match(media, /moveNode\(editor, getPos, -1\)/);
  assert.match(media, /moveNode\(editor, getPos, 1\)/);
  assert.match(media, /MIN_MEDIA_WIDTH = 24/);
  assert.match(media, /MAX_MEDIA_WIDTH = 100/);
});

test("public content preserves only controlled alignment and media width styles", async () => {
  const content = await readFile(contentUrl, "utf8");
  const styles = await readFile(stylesUrl, "utf8");

  assert.match(content, /SAFE_TEXT_ALIGNMENTS/);
  assert.match(content, /safeTextAlignment/);
  assert.match(content, /safeMediaWidth/);
  assert.match(content, /Math\.max\(24, Math\.min\(100/);
  assert.match(content, /child\.style\.width = `\$\{width\}%`/);
  assert.match(content, /child\.style\.textAlign = textAlignment/);
  assert.match(content, /process-attachment-card/);

  assert.match(styles, /\.tiptap-media-resize-handle/);
  assert.match(styles, /cursor: ew-resize/);
  assert.match(styles, /\.process-rich-content \.process-inline-image/);
  assert.match(styles, /\.process-rich-content \.process-attachment-card/);
});
