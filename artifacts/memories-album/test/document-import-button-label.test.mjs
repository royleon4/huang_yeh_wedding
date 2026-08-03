import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const editorUrl = new URL("../src/client/RichTextEditor.jsx", import.meta.url);

test("the toolbar exposes exactly one Word import control", async () => {
  const source = await readFile(editorUrl, "utf8");
  const labels = source.match(/label=\{[^\n]*"匯入 Word"[^\n]*\}/g) || [];
  assert.equal(labels.length, 1);
  assert.doesNotMatch(source, /"匯入文件"/);
  assert.doesNotMatch(source, /匯入 PDF|匯入 PPT|PowerPoint/);
});
