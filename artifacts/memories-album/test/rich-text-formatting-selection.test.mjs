import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("alignment is stored as safe classes rather than unrestricted inline styles", async () => {
  const editor = await readFile(
    new URL("../src/client/RichTextEditor.jsx", import.meta.url),
    "utf8",
  );

  assert.match(editor, /normalizeAlignmentMarkup/);
  assert.match(editor, /element\.style\.removeProperty\("text-align"\)/);
  assert.match(editor, /element\.removeAttribute\("align"\)/);
  assert.match(editor, /block\.classList\.add\(alignmentClass\)/);
  assert.doesNotMatch(editor, /style=\{\{\s*textAlign:/);
});
