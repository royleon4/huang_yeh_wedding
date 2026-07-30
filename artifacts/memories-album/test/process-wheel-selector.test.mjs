import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("process wheel selects in one gesture, auto-scrolls to media, and shows configured mobile items", async () => {
  const [component, styles] = await Promise.all([
    readFile(new URL("../src/client/ProcessWheel.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/client/process-wheel.css", import.meta.url), "utf8"),
  ]);

  assert.match(component, /closestItem/);
  assert.match(component, /setTimeout\(selectCenteredItem, 90\)/);
  assert.match(component, /onScroll=\{scheduleSelection\}/);
  assert.match(component, /onWheel=\{handleWheel\}/);
  assert.match(component, /role="tablist"/);
  assert.match(component, /firstSelectedContent/);
  assert.match(component, /\.process-video-block/);
  assert.match(component, /\.masonry-grid \.photo-card/);
  assert.match(component, /DEFAULT_VISIBLE_COUNT = 6/);
  assert.match(component, /--wheel-mobile-item-width/);
  assert.match(styles, /var\(--wheel-mobile-item-width/);
  assert.match(styles, /scroll-snap-type: x mandatory/);
  assert.match(styles, /scroll-snap-align: center/);
});
