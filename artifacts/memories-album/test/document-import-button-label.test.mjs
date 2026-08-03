import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const editorUrl = new URL("../src/client/RichTextEditor.jsx", import.meta.url);

test("the existing Word control is renamed without adding another toolbar document control", async () => {
  const source = await readFile(editorUrl, "utf8");
  assert.match(source, /"匯入文件"/);
  assert.doesNotMatch(source, /"匯入 Word"/);
  const labels = source.match(/label=\{[^\n]*"匯入文件"[^\n]*\}/g) || [];
  assert.equal(labels.length, 1);
});
