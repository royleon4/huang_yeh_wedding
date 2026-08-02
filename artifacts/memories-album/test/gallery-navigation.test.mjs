import assert from "node:assert/strict";
import test from "node:test";
import {
  galleryStartTop,
  requestGalleryStartScroll,
  scrollToGalleryStart,
} from "../src/client/gallery-navigation.mjs";

function fixture() {
  const scrollCalls = [];
  const frames = [];
  const gallery = {
    getBoundingClientRect: () => ({ top: 420 }),
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
    scrollTo: (options) => scrollCalls.push(options),
    requestAnimationFrame: (callback) => {
      frames.push(callback);
      return frames.length;
    },
  };
  return { documentRef, frames, scrollCalls, windowRef };
}

test("gallery start uses the existing sticky offset formula", () => {
  const { documentRef, windowRef } = fixture();
  assert.equal(galleryStartTop({ documentRef, windowRef }), 370);
});

test("gallery navigation issues one scroll with the requested behavior", () => {
  const { documentRef, scrollCalls, windowRef } = fixture();
  assert.equal(
    scrollToGalleryStart({ documentRef, windowRef, behavior: "auto" }),
    true,
  );
  assert.deepEqual(scrollCalls, [{ top: 370, behavior: "auto" }]);
});

test("gallery navigation waits for two animation frames", () => {
  const { documentRef, frames, scrollCalls, windowRef } = fixture();
  assert.equal(requestGalleryStartScroll({ documentRef, windowRef }), true);
  assert.equal(frames.length, 1);
  frames.shift()();
  assert.equal(frames.length, 1);
  assert.equal(scrollCalls.length, 0);
  frames.shift()();
  assert.deepEqual(scrollCalls, [{ top: 370, behavior: "smooth" }]);
});

test("gallery navigation is a no-op when the gallery is absent", () => {
  const { scrollCalls, windowRef } = fixture();
  const documentRef = {
    getElementById: () => null,
    querySelector: () => null,
  };
  assert.equal(scrollToGalleryStart({ documentRef, windowRef }), false);
  assert.deepEqual(scrollCalls, []);
});
