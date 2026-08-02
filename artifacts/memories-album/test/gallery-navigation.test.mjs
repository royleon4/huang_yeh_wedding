import assert from "node:assert/strict";
import test from "node:test";
import {
  activeContentStartTop,
  requestActiveContentScroll,
  resolveActiveContentTarget,
  scrollToActiveContentStart,
} from "../src/client/gallery-navigation.mjs";

function visibleElement({ top, width = 200, height = 120 } = {}) {
  return {
    getBoundingClientRect: () => ({ top, width, height }),
  };
}

function fixture({ mediaItems = [], galleryChildren = [] } = {}) {
  const scrollCalls = [];
  const frames = [];
  const gallery = {
    children: galleryChildren,
    getBoundingClientRect: () => ({ top: 420, width: 300, height: 800 }),
    querySelectorAll: () => mediaItems,
  };
  const sticky = {
    getBoundingClientRect: () => ({ height: 120 }),
  };
  const documentRef = {
    getElementById: (id) => (id === "archive-gallery" ? gallery : null),
    querySelector: (selector) =>
      selector === ".process-section" ? sticky : null,
  };
  const windowRef = {
    scrollY: 80,
    getComputedStyle: () => ({ display: "block", visibility: "visible" }),
    scrollTo: (options) => scrollCalls.push(options),
    requestAnimationFrame: (callback) => {
      frames.push(callback);
      return frames.length;
    },
  };
  return { documentRef, frames, gallery, scrollCalls, windowRef };
}

test("navigation targets the first actually visible media block regardless of type", () => {
  const hidden = visibleElement({ top: 460, width: 0, height: 0 });
  const firstVisibleContent = visibleElement({ top: 560 });
  const laterContent = visibleElement({ top: 760 });
  const { documentRef, windowRef } = fixture({
    mediaItems: [hidden, firstVisibleContent, laterContent],
  });

  assert.equal(
    resolveActiveContentTarget({ documentRef, windowRef }),
    firstVisibleContent,
  );
  assert.equal(activeContentStartTop({ documentRef, windowRef }), 510);
});

test("navigation falls back to the first visible gallery child", () => {
  const hidden = visibleElement({ top: 440, width: 0, height: 0 });
  const stateCard = visibleElement({ top: 500 });
  const { documentRef, windowRef } = fixture({
    galleryChildren: [hidden, stateCard],
  });
  assert.equal(resolveActiveContentTarget({ documentRef, windowRef }), stateCard);
});

test("gallery itself remains the final fallback", () => {
  const { documentRef, gallery, windowRef } = fixture();
  assert.equal(resolveActiveContentTarget({ documentRef, windowRef }), gallery);
  assert.equal(activeContentStartTop({ documentRef, windowRef }), 370);
});

test("content navigation issues one scroll with the requested behavior", () => {
  const content = visibleElement({ top: 560 });
  const { documentRef, scrollCalls, windowRef } = fixture({ mediaItems: [content] });
  assert.equal(
    scrollToActiveContentStart({ documentRef, windowRef, behavior: "auto" }),
    true,
  );
  assert.deepEqual(scrollCalls, [{ top: 510, behavior: "auto" }]);
});

test("content navigation waits for two animation frames", () => {
  const { documentRef, frames, scrollCalls, windowRef } = fixture();
  assert.equal(requestActiveContentScroll({ documentRef, windowRef }), true);
  assert.equal(frames.length, 1);
  frames.shift()();
  assert.equal(frames.length, 1);
  assert.equal(scrollCalls.length, 0);
  frames.shift()();
  assert.deepEqual(scrollCalls, [{ top: 370, behavior: "smooth" }]);
});

test("only the latest pending content request may move the viewport", () => {
  const { documentRef, frames, scrollCalls, windowRef } = fixture();
  requestActiveContentScroll({ documentRef, windowRef, behavior: "auto" });
  requestActiveContentScroll({ documentRef, windowRef, behavior: "smooth" });

  frames.shift()();
  frames.shift()();
  frames.shift()();
  frames.shift()();

  assert.deepEqual(scrollCalls, [{ top: 370, behavior: "smooth" }]);
});

test("content navigation is a no-op when the gallery is absent", () => {
  const { scrollCalls, windowRef } = fixture();
  const documentRef = {
    getElementById: () => null,
    querySelector: () => null,
  };
  assert.equal(scrollToActiveContentStart({ documentRef, windowRef }), false);
  assert.deepEqual(scrollCalls, []);
});
