import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL("../src/client/PhotoLightbox.jsx", import.meta.url);

test("fullscreen zoom uses a non-passive native wheel listener", async () => {
  const source = await readFile(sourceUrl, "utf8");
  assert.match(source, /addEventListener\("wheel",\s*onWheel,\s*\{\s*passive:\s*false\s*\}\)/);
  assert.doesNotMatch(source, /onWheel=/);
});
