import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  masonryMeasuredHeight,
  masonryRowSpan,
  viewportWidthChanged,
} from "../src/client/gallery-enhancement-model.mjs";
import {
  masonryAnchorRestorationSuppressed,
  suspendMasonryAnchorRestoration,
} from "../src/client/useMasonryLayout.mjs";

test("masonry measures natural card content without clearing existing spans", () => {
  assert.equal(masonryMeasuredHeight(240, 1, 1), 242);
  assert.equal(masonryRowSpan(242, 8, 10), 14);
});

test("mobile browser chrome height changes do not trigger a full relayout", () => {
  assert.equal(viewportWidthChanged(390, 390), false);
  assert.equal(viewportWidthChanged(390, 389.4), false);
  assert.equal(viewportWidthChanged(390, 844), true);
});

test("masonry anchor restoration can be suspended around navigation", () => {
  suspendMasonryAnchorRestoration(700, 1_000);
  assert.equal(masonryAnchorRestorationSuppressed(1_699), true);
  assert.equal(masonryAnchorRestorationSuppressed(1_700), false);
});

test("each photo grid owns incremental layout and visible-anchor preservation", async () => {
  const [layout, grid] = await Promise.all([
    readFile(
      new URL("../src/client/useMasonryLayout.mjs", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/client/PhotoGroupGrid.jsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.doesNotMatch(layout, /gridRowEnd\s*=\s*["']auto["']/);
  assert.match(layout, /card\.scrollHeight/);
  assert.match(layout, /windowRef\.scrollBy\(0, delta\)/);
  assert.match(layout, /viewportWidthChanged\(lastViewportWidth, nextWidth\)/);
  assert.match(layout, /mutationObserver\?\.observe\(grid/);
  assert.match(layout, /const grid = gridRef\.current/);
  assert.doesNotMatch(layout, /document\.querySelector\("\.masonry-grid"\)/);
  assert.doesNotMatch(layout, /observe\(document\.documentElement/);
  assert.match(grid, /const gridRef = useMasonryLayout\(\)/);
  assert.match(grid, /<div ref=\{gridRef\} className="masonry-grid">/);
});
