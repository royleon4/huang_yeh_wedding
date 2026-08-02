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

test("each photo group owns masonry layout without changing the page scroll", async () => {
  const [hook, grid, enhancements] = await Promise.all([
    readFile(
      new URL("../src/client/use-masonry-grid.mjs", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/client/PhotoGroupGrid.jsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/client/GalleryEnhancements.jsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.doesNotMatch(hook, /gridRowEnd\s*=\s*["']auto["']/);
  assert.match(hook, /card\.scrollHeight/);
  assert.match(hook, /mutationObserver\?\.observe\(grid/);
  assert.match(hook, /card\.parentElement === grid/);
  assert.match(hook, /viewportWidthChanged\(lastViewportWidth, nextWidth\)/);
  assert.doesNotMatch(hook, /document\.querySelector|window\.scrollBy|window\.scrollTo/);
  assert.match(grid, /const gridRef = useMasonryGrid\(photos\)/);
  assert.match(grid, /<div ref=\{gridRef\} className="masonry-grid">/);
  assert.doesNotMatch(enhancements, /masonry|ResizeObserver|MutationObserver/);
});
