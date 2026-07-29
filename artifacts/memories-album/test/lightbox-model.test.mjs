import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  adjacentPhotoIndex,
  clampPanOffset,
  clampZoom,
  isHorizontalSwipe,
} from "../src/client/lightbox-model.mjs";

test("clamps photo zoom between the supported bounds", () => {
  assert.equal(clampZoom(0.2), MIN_ZOOM);
  assert.equal(clampZoom(2.5), 2.5);
  assert.equal(clampZoom(99), MAX_ZOOM);
  assert.equal(clampZoom(Number.NaN), MIN_ZOOM);
});

test("keeps a zoomed photo within the visible stage", () => {
  assert.deepEqual(
    clampPanOffset({
      offset: { x: 500, y: -500 },
      zoom: 2,
      imageWidth: 280,
      imageHeight: 400,
      stageWidth: 300,
      stageHeight: 500,
    }),
    { x: 130, y: -150 },
  );
  assert.deepEqual(
    clampPanOffset({
      offset: { x: 20, y: 30 },
      zoom: 1,
      imageWidth: 280,
      imageHeight: 400,
      stageWidth: 300,
      stageHeight: 500,
    }),
    { x: 0, y: 0 },
  );
});

test("keeps left and right navigation inside the photo collection", () => {
  assert.equal(adjacentPhotoIndex(0, 4, -1), 0);
  assert.equal(adjacentPhotoIndex(0, 4, 1), 1);
  assert.equal(adjacentPhotoIndex(3, 4, 1), 3);
  assert.equal(adjacentPhotoIndex(2, 4, -1), 1);
});

test("accepts deliberate horizontal swipes and rejects vertical gestures", () => {
  assert.equal(
    isHorizontalSwipe({ startX: 200, startY: 100, endX: 100, endY: 112 }),
    true,
  );
  assert.equal(
    isHorizontalSwipe({ startX: 100, startY: 100, endX: 125, endY: 190 }),
    false,
  );
  assert.equal(
    isHorizontalSwipe({ startX: 100, startY: 100, endX: 130, endY: 102 }),
    false,
  );
});
