import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  masonryMeasuredHeight,
  masonryRowSpan,
  viewportWidthChanged,
} from "../src/client/gallery-enhancement-model.mjs";

test("masonry measures natural card content without clearing existing spans", () => {
  assert.equal(masonryMeasuredHeight(240, 1, 1), 242);
  assert.equal(masonryRowSpan(242, 8, 10), 14);
});

test("mobile browser chrome height changes do not trigger a full relayout", () => {
  assert.equal(viewportWidthChanged(390, 390), false);
  assert.equal(viewportWidthChanged(390, 389.4), false);
  assert.equal(viewportWidthChanged(390, 844), true);
});

test("gallery relayout stays incremental and preserves the visible anchor", async () => {
  const source = await readFile(
    new URL("../src/client/GalleryEnhancements.jsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /gridRowEnd\s*=\s*["']auto["']/);
  assert.match(source, /card\.scrollHeight/);
  assert.match(source, /window\.scrollBy\(0, delta\)/);
  assert.match(source, /viewportWidthChanged\(lastViewportWidth, nextWidth\)/);
  assert.match(source, /mutationObserver\?\.observe\(archiveGallery/);
  assert.doesNotMatch(source, /observe\(document\.documentElement/);
});
