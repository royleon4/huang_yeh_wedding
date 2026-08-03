import assert from "node:assert/strict";
import test from "node:test";
import {
  ALBUM_SELECTION_SELECTOR,
  installAlbumContentNavigation,
  isAlbumSelectionTarget,
  requestAlbumContentPosition,
} from "../src/client/album-content-navigation.mjs";

function eventFixture() {
  const listeners = new Map();
  const documentRef = {
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: (type, listener) => {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
  };
  const windowRef = {};
  return {
    click(target) {
      listeners.get("click")?.({ target });
    },
    documentRef,
    listeners,
    windowRef,
  };
}

function targetMatching(selectorPart, active = false) {
  return {
    closest: (selector) =>
      selector.includes(selectorPart)
        ? { className: active ? "active" : "" }
        : null,
  };
}

test("album selectors cover both the page tabs and fixed bottom navigation", () => {
  assert.match(ALBUM_SELECTION_SELECTOR, /\.collection-tabs \.collection-tab/);
  assert.match(
    ALBUM_SELECTION_SELECTOR,
    /\.bottom-collection-nav \.bottom-nav-side button/,
  );
});

test("album selection targets do not include process subcategories", () => {
  assert.equal(
    isAlbumSelectionTarget(targetMatching(".collection-tabs .collection-tab")),
    true,
  );
  assert.equal(
    isAlbumSelectionTarget(
      targetMatching(".bottom-collection-nav .bottom-nav-side button"),
    ),
    true,
  );
  assert.equal(isAlbumSelectionTarget(targetMatching(".process-chip")), false);
});

test("album positioning reuses the committed-content request and masonry suppression", () => {
  const documentRef = {};
  const windowRef = {};
  const requests = [];
  let suppressions = 0;

  assert.equal(
    requestAlbumContentPosition({
      documentRef,
      windowRef,
      behavior: "auto",
      requestContentScroll: (context) => {
        requests.push(context);
        return true;
      },
      suspendAnchor: () => {
        suppressions += 1;
      },
    }),
    true,
  );
  assert.equal(suppressions, 1);
  assert.deepEqual(requests, [
    { documentRef, windowRef, behavior: "auto" },
  ]);
});

test("clicking a different album requests content positioning", () => {
  const { click, documentRef, windowRef } = eventFixture();
  const requests = [];
  installAlbumContentNavigation({
    documentRef,
    windowRef,
    requestPosition: (context) => requests.push(context),
  });

  click(targetMatching(".collection-tabs .collection-tab"));
  assert.equal(requests.length, 1);
  assert.equal(requests[0].documentRef, documentRef);
  assert.equal(requests[0].windowRef, windowRef);
});

test("clicking the current album also requests content positioning", () => {
  const { click, documentRef, windowRef } = eventFixture();
  let requests = 0;
  installAlbumContentNavigation({
    documentRef,
    windowRef,
    requestPosition: () => {
      requests += 1;
    },
  });

  click(
    targetMatching(
      ".bottom-collection-nav .bottom-nav-side button",
      true,
    ),
  );
  assert.equal(requests, 1);
});

test("process subcategory clicks keep their existing navigation behavior", () => {
  const { click, documentRef, windowRef } = eventFixture();
  let requests = 0;
  installAlbumContentNavigation({
    documentRef,
    windowRef,
    requestPosition: () => {
      requests += 1;
    },
  });

  click(targetMatching(".process-chip"));
  assert.equal(requests, 0);
});

test("album navigation listener can be removed cleanly", () => {
  const { documentRef, listeners, windowRef } = eventFixture();
  const dispose = installAlbumContentNavigation({ documentRef, windowRef });
  assert.equal(listeners.has("click"), true);
  dispose();
  assert.equal(listeners.has("click"), false);
});
