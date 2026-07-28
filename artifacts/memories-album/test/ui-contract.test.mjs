import assert from "node:assert/strict";
import test from "node:test";
import {
  COLLECTION_DEFINITIONS,
  NAV_ITEMS,
  PROCESS_DEFINITIONS,
  filterPhotos,
  moveItem,
  pagePhotos,
} from "../src/client/gallery-model.mjs";
import { MOCK_PHOTOS } from "../src/client/mock-data.mjs";

test("does not bundle production wedding process categories", () => {
  assert.deepEqual(PROCESS_DEFINITIONS, []);
});

test("keeps three separate top-level photo collections", () => {
  assert.deepEqual(
    COLLECTION_DEFINITIONS.map((item) => item.zh),
    ["婚禮流程", "訪客上傳", "生活照"],
  );
});

test("keeps People and Find me visible but disabled in Phase 1", () => {
  assert.deepEqual(
    NAV_ITEMS.map((item) => item.zh),
    ["相簿分類", "人物", "上傳", "找找我"],
  );
  assert.equal(NAV_ITEMS.find((item) => item.id === "people").enabled, false);
  assert.equal(NAV_ITEMS.find((item) => item.id === "find").enabled, false);
});

test("guest uploads are always visible in Guest uploads", () => {
  const guestPhotos = filterPhotos(MOCK_PHOTOS, "all", "guest");
  assert.ok(guestPhotos.length > 0);
  assert.ok(guestPhotos.every((photo) => photo.source === "guest"));
});

test("a classified guest photo may also appear in a logical collection", () => {
  const photos = [
    {
      id: "guest-wedding",
      source: "guest",
      collection: "wedding",
      processIds: ["drive-process-1"],
    },
    {
      id: "guest-life",
      source: "guest",
      collection: "life",
      processIds: [],
    },
  ];
  assert.deepEqual(
    filterPhotos(photos, "drive-process-1", "wedding").map((photo) => photo.id),
    ["guest-wedding"],
  );
  assert.deepEqual(
    filterPhotos(photos, "all", "life").map((photo) => photo.id),
    ["guest-life"],
  );
  assert.deepEqual(
    filterPhotos(photos, "all", "guest").map((photo) => photo.id),
    ["guest-wedding", "guest-life"],
  );
});

test("cursor paging is stable and finite", () => {
  const first = pagePhotos(MOCK_PHOTOS, 8);
  const second = pagePhotos(MOCK_PHOTOS, 8, first.nextCursor);
  assert.equal(first.items.length, 8);
  assert.equal(second.items.length, 8);
  assert.equal(first.items.at(-1).id !== second.items.at(0).id, true);
});

test("process reordering does not mutate a database-sourced array", () => {
  const original = [
    { id: "drive-a", zh: "A" },
    { id: "drive-b", zh: "B" },
    { id: "drive-c", zh: "C" },
  ];
  const moved = moveItem(original, 1, -1);
  assert.equal(original[0].id, "drive-a");
  assert.equal(moved[0].id, "drive-b");
});
