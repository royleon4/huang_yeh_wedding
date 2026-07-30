import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("process wheel selects in one gesture, reuses traditional gallery positioning, and preserves readable mobile items", async () => {
  const [component, selector, styles, settings] = await Promise.all([
    readFile(new URL("../src/client/ProcessWheel.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/client/ProcessSelector.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/client/process-wheel.css", import.meta.url), "utf8"),
    readFile(new URL("../src/client/ProcessSelectorSettings.jsx", import.meta.url), "utf8"),
  ]);

  assert.match(component, /closestItem/);
  assert.match(component, /setTimeout\(selectCenteredItem, 90\)/);
  assert.match(component, /onScroll=\{scheduleSelection\}/);
  assert.match(component, /onWheel=\{handleWheel\}/);
  assert.match(component, /role="tablist"/);
  assert.doesNotMatch(component, /firstSelectedContent/);
  assert.doesNotMatch(component, /\.process-video-block/);
  assert.doesNotMatch(component, /\.masonry-grid \.photo-card/);
  assert.match(selector, /function scrollToGalleryStart/);
  assert.match(selector, /document\.querySelector\("\.process-section"\)/);
  assert.match(selector, /gallery\.getBoundingClientRect\(\)\.top - stickyHeight - 10/);
  assert.match(selector, /window\.scrollTo\(\{ top: Math\.max\(0, top\), behavior: "smooth" \}\)/);
  assert.match(selector, /window\.requestAnimationFrame\(scrollToGalleryStart\)/);
  assert.match(selector, /onSelect=\{selectWithTraditionalPositioning\}/);
  assert.match(component, /DEFAULT_VISIBLE_COUNT = 6/);
  assert.match(component, /--wheel-mobile-item-width/);
  assert.match(styles, /max\(\s*clamp\(6rem, 27vw, 11rem\)/);
  assert.match(styles, /font-size: 0\.82rem/);
  assert.match(styles, /white-space: nowrap/);
  assert.match(styles, /scroll-snap-type: x mandatory/);
  assert.match(styles, /scroll-snap-align: center/);
  assert.match(settings, /優先保留原本較寬、可讀且容易點選的尺寸/);
});
