import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("process selector supports one-gesture wheel selection with multiple visible items", async () => {
  const [component, styles] = await Promise.all([
    readFile(new URL("../src/client/ProcessWheel.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/client/process-wheel.css", import.meta.url), "utf8"),
  ]);

  assert.match(component, /closestItem/);
  assert.match(component, /setTimeout\(selectCenteredItem, 90\)/);
  assert.match(component, /onScroll=\{scheduleSelection\}/);
  assert.match(component, /onWheel=\{handleWheel\}/);
  assert.match(component, /role="tablist"/);
  assert.match(styles, /--wheel-item-width: clamp\(6rem, 27vw, 11rem\)/);
  assert.match(styles, /scroll-snap-type: x mandatory/);
  assert.match(styles, /scroll-snap-align: center/);
});
