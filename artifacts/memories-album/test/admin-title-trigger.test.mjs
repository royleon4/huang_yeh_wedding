import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL("../src/client/ProcessSyncAdmin.jsx", import.meta.url);

test("hidden admin trigger survives archive title remounts", async () => {
  const source = await readFile(sourceUrl, "utf8");
  assert.match(source, /document\.addEventListener\("click", onDocumentClick\)/);
  assert.match(source, /target\?\.closest\(ADMIN_TITLE_SELECTOR\)/);
  assert.match(source, /tapsRef\.current\.length < 5/);
  assert.doesNotMatch(source, /title\.addEventListener\("click"/);
});
