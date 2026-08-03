import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("legacy article HTML remains editable after the Tiptap migration", async () => {
  const editor = await readFile(
    new URL("../src/client/RichTextEditor.jsx", import.meta.url),
    "utf8",
  );
  const media = await readFile(
    new URL("../src/client/TiptapMediaNodes.jsx", import.meta.url),
    "utf8",
  );

  assert.match(editor, /prepareEditorHtml/);
  assert.match(editor, /process-align-center/);
  assert.match(editor, /element\.style\.textAlign = ALIGNMENT_BY_CLASS\[className\]/);
  assert.match(media, /figure\.process-inline-image/);
  assert.doesNotMatch(media, /AttachmentCard|process-attachment-line/);
  assert.match(media, /figcaption/);
  assert.match(media, /data-width/);
});

test("Tiptap emits HTML through the existing controlled save callback", async () => {
  const editor = await readFile(
    new URL("../src/client/RichTextEditor.jsx", import.meta.url),
    "utf8",
  );

  assert.match(editor, /const html = current\.getHTML\(\)/);
  assert.match(editor, /onChangeRef\.current\?\.\(html\)/);
  assert.match(editor, /editor\.commands\.setContent\(next, \{ emitUpdate: false \}\)/);
  assert.match(editor, /lastEmittedRef/);
});
