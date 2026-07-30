import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const editorUrl = new URL("../src/client/RichTextEditor.jsx", import.meta.url);
const contentUrl = new URL("../src/client/ProcessRichContent.jsx", import.meta.url);
const stylesUrl = new URL("../src/client/rich-text-formatting.css", import.meta.url);

test("rich text toolbar offers the requested paragraph alignment controls", async () => {
  const editor = await readFile(editorUrl, "utf8");

  assert.match(editor, /justifyLeft[\s\S]*置左/);
  assert.match(editor, /justifyCenter[\s\S]*置中/);
  assert.match(editor, /justifyRight[\s\S]*置右/);
  assert.match(editor, /justifyFull[\s\S]*左右對齊（等寬）/);
  assert.match(editor, /先反白選取文字或多個段落/);
});

test("toolbar preserves a highlighted selection before applying commands", async () => {
  const editor = await readFile(editorUrl, "utf8");

  assert.match(editor, /selectionRef = useRef\(null\)/);
  assert.match(editor, /selectionRef\.current = range\.cloneRange\(\)/);
  assert.match(editor, /selection\?\.removeAllRanges\(\)/);
  assert.match(editor, /selection\?\.addRange\(saved\)/);
  assert.match(editor, /onMouseDown=\{\(event\) => event\.preventDefault\(\)\}/);
  assert.match(editor, /selectedBlocks\(editor, activeRange\)/);
});

test("toolbar includes practical baseline editing controls", async () => {
  const editor = await readFile(editorUrl, "utf8");

  for (const command of [
    "bold",
    "italic",
    "underline",
    "strikeThrough",
    "insertUnorderedList",
    "insertOrderedList",
    "outdent",
    "indent",
    "createLink",
    "unlink",
    "undo",
    "redo",
    "removeFormat",
  ]) {
    assert.match(editor, new RegExp(command));
  }
});

test("public rich content keeps only approved alignment classes", async () => {
  const content = await readFile(contentUrl, "utf8");

  for (const className of [
    "process-align-left",
    "process-align-center",
    "process-align-right",
    "process-align-justify",
  ]) {
    assert.match(content, new RegExp(`\\"${className}\\"`));
  }
  assert.match(content, /filter\(\(name\) => SAFE_CLASSES\.has\(name\)\)/);
});

test("administrator and public article views share alignment styles", async () => {
  const editor = await readFile(editorUrl, "utf8");
  const content = await readFile(contentUrl, "utf8");
  const styles = await readFile(stylesUrl, "utf8");

  assert.match(editor, /import "\.\/rich-text-formatting\.css"/);
  assert.match(content, /import "\.\/rich-text-formatting\.css"/);
  assert.match(styles, /\.process-rich-content \.process-align-center[\s\S]*text-align: center/);
  assert.match(styles, /\.process-rich-content \.process-align-right[\s\S]*text-align: right/);
  assert.match(styles, /\.process-rich-content \.process-align-justify[\s\S]*text-align: justify/);
  assert.match(styles, /text-justify: inter-character/);
});
