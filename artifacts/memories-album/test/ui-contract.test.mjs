import assert from "node:assert/strict";
import test from "node:test";
import { NAV_ITEMS, PROCESS_DEFINITIONS, filterPhotos, moveItem, pagePhotos } from "../src/client/gallery-model.mjs";
import { MOCK_PHOTOS } from "../src/client/mock-data.mjs";

const expectedProcesses = ["進場", "祈禱", "讚美", "聖經", "勉勵", "證婚", "謝親恩", "祝福", "答禮", "影片", "退場", "分組照相"];

test("keeps the twelve approved wedding moments in order", () => {
  assert.deepEqual(PROCESS_DEFINITIONS.map((item) => item.zh), expectedProcesses);
});

test("keeps People and Find me visible but disabled in Phase 1", () => {
  assert.deepEqual(NAV_ITEMS.map((item) => item.zh), ["全部照片", "人物", "上傳", "找找我"]);
  assert.equal(NAV_ITEMS.find((item) => item.id === "people").enabled, false);
  assert.equal(NAV_ITEMS.find((item) => item.id === "find").enabled, false);
});

test("guest uploads remain outside wedding moments", () => {
  const guestPhotos = filterPhotos(MOCK_PHOTOS, "guest");
  assert.ok(guestPhotos.length > 0);
  assert.ok(guestPhotos.every((photo) => photo.source === "guest" && photo.processIds.length === 0));
});

test("cursor paging is stable and finite", () => {
  const first = pagePhotos(MOCK_PHOTOS, 8);
  const second = pagePhotos(MOCK_PHOTOS, 8, first.nextCursor);
  assert.equal(first.items.length, 8);
  assert.equal(second.items.length, 8);
  assert.equal(first.items.at(-1).id !== second.items.at(0).id, true);
});

test("process reordering does not mutate the source array", () => {
  const original = PROCESS_DEFINITIONS.slice(0, 3);
  const moved = moveItem(original, 1, -1);
  assert.equal(original[0].id, "entrance");
  assert.equal(moved[0].id, "prayer");
});
