import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  logicalAdjacentIndex,
  renderedWheelItems,
} from "../src/client/process-wheel-model.mjs";
import {
  normalizeProcessSelectorSettings,
  processWheelLoopsForAlbum,
} from "../src/process-selector-settings.mjs";

test("wheel loop fills both sides with complete logical copies", () => {
  const items = [
    { id: "one", label: "One" },
    { id: "two", label: "Two" },
    { id: "three", label: "Three" },
  ];
  const rendered = renderedWheelItems(items, true);
  assert.equal(rendered.length, 9);
  assert.deepEqual(
    rendered.filter((entry) => entry.clone === "start").map((entry) => entry.item.id),
    ["one", "two", "three"],
  );
  assert.deepEqual(
    rendered.filter((entry) => !entry.clone).map((entry) => entry.item.id),
    ["one", "two", "three"],
  );
  assert.deepEqual(
    rendered.filter((entry) => entry.clone === "end").map((entry) => entry.item.id),
    ["one", "two", "three"],
  );
  assert.equal(logicalAdjacentIndex(2, 3, 1, true), 0);
  assert.equal(logicalAdjacentIndex(0, 3, -1, true), 2);
  assert.equal(logicalAdjacentIndex(2, 3, 1, false), 2);
  assert.equal(logicalAdjacentIndex(0, 3, -1, false), 0);
});

test("per-album loop settings normalize independently", () => {
  const settings = normalizeProcessSelectorSettings({
    processWheelEnabled: true,
    processWheelVisibleCount: 7,
    processWheelLoopAlbumIds: ["guest", "unknown", "guest"],
  });
  assert.deepEqual(settings.processWheelLoopAlbumIds, ["guest"]);
  assert.equal(processWheelLoopsForAlbum(settings, "guest"), true);
  assert.equal(processWheelLoopsForAlbum(settings, "wedding"), false);
});

test("process wheel selects directly, fills both directions, and keeps every visible option clickable", async () => {
  const [component, selector, styles, settings] = await Promise.all([
    readFile(new URL("../src/client/ProcessWheel.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/client/ProcessSelector.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/client/process-wheel.css", import.meta.url), "utf8"),
    readFile(
      new URL("../src/client/ProcessSelectorSettings.jsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(component, /closestItem/);
  assert.match(component, /setTimeout\(selectCenteredItem, 90\)/);
  assert.match(component, /programmaticTargetRef/);
  assert.match(component, /itemCenterOffset/);
  assert.match(component, /renderedWheelItems/);
  assert.match(component, /data-wheel-clone=\{clone \|\| undefined\}/);
  assert.match(component, /jumpCloneToRealItem/);
  assert.match(component, /logicalAdjacentIndex/);
  assert.match(component, /wheel\.scrollTo\(\{/);
  assert.match(component, /left: wheel\.scrollLeft \+ offset/);
  assert.match(component, /onPointerDown=\{cancelProgrammaticScroll\}/);
  assert.match(component, /onScroll=\{scheduleSelection\}/);
  assert.match(component, /onWheel=\{handleWheel\}/);
  assert.match(component, /role="tablist"/);
  assert.match(component, /onClick=\{\(event\) => choose\(item\.id, event\.currentTarget\)\}/);
  assert.match(component, /tabIndex=\{clone \? -1/);
  assert.match(component, /role=\{clone \? undefined : "tab"\}/);
  assert.doesNotMatch(component, /scrollIntoView/);
  assert.doesNotMatch(component, /firstSelectedContent/);
  assert.doesNotMatch(component, /\.process-video-block/);
  assert.doesNotMatch(component, /\.masonry-grid \.photo-card/);

  assert.match(selector, /getPublicBootstrap\(\)\.settings/);
  assert.match(selector, /processWheelLoopsForAlbum/);
  assert.match(selector, /albumId/);
  assert.match(selector, /function scrollToGalleryStart/);
  assert.match(selector, /document\.querySelector\("\.process-section"\)/);
  assert.match(
    selector,
    /gallery\.getBoundingClientRect\(\)\.top - stickyHeight - 10/,
  );
  assert.match(
    selector,
    /window\.scrollTo\(\{ top: Math\.max\(0, top\), behavior: "smooth" \}\)/,
  );
  assert.match(selector, /window\.requestAnimationFrame\(scrollToGalleryStart\)/);
  assert.match(selector, /onSelect=\{selectWithTraditionalPositioning\}/);

  assert.match(component, /DEFAULT_VISIBLE_COUNT = 6/);
  assert.match(component, /--wheel-mobile-item-width/);
  assert.match(styles, /max\(\s*clamp\(6rem, 27vw, 11rem\)/);
  assert.match(styles, /font-size: 0\.82rem/);
  assert.match(styles, /white-space: nowrap/);
  assert.match(styles, /scroll-snap-type: x mandatory/);
  assert.match(styles, /scroll-snap-align: center/);
  assert.match(styles, /scroll-snap-stop: normal/);
  assert.match(styles, /\.process-wheel-clone\s*\{[\s\S]*cursor: pointer/);
  assert.doesNotMatch(styles, /\.process-wheel-clone\s*\{[\s\S]*pointer-events: none/);
  assert.doesNotMatch(styles, /scroll-snap-stop: always/);

  assert.match(settings, /各相簿的無限左右滾動/);
  assert.match(settings, /PROCESS_WHEEL_LOOP_SUPPORTED_ALBUMS/);
  assert.match(settings, /小螢幕會優先保留較寬、可讀且容易點選的尺寸/);
});
