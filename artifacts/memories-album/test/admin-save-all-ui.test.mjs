import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL("../src/client/AdminApp.jsx", import.meta.url);

test("admin surface exposes one global save action and no per-entity save buttons", async () => {
  const source = await readFile(sourceUrl, "utf8");
  assert.match(source, /儲存所有變更/);
  assert.doesNotMatch(source, /儲存相簿/);
  assert.doesNotMatch(source, /儲存照片/);
  assert.doesNotMatch(source, />\s*儲存\s*</);
  assert.match(source, /adminRequest\("\/admin\/api\/changes"/);
});

test("admin surface blocks duplicate submission and warns about unsaved changes", async () => {
  const source = await readFile(sourceUrl, "utf8");
  assert.match(source, /if \(busy \|\| pendingCount === 0\) return;/);
  assert.match(source, /addEventListener\("beforeunload", warn\)/);
  assert.match(source, /尚有未儲存的變更，確定要離開嗎/);
  assert.match(source, /successfulResultKeys/);
});
