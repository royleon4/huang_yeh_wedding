import assert from "node:assert/strict";
import test from "node:test";
import {
  albumDraft,
  buildAdminChangeSet,
  categoryDraft,
  photoDraft,
  successfulResultKeys,
} from "../src/client/admin-change-set.mjs";

const albums = [
  {
    id: "wedding",
    titleZh: "婚禮流程",
    titleEn: "Wedding",
    descriptionZh: "",
    descriptionEn: "",
    isVisible: true,
  },
];
const categories = [
  { id: "c1", labelZh: "進場", labelEn: "Entrance" },
  { id: "c2", labelZh: "禱告", labelEn: "Prayer" },
];
const photos = [
  {
    id: "p1",
    displayName: "原名",
    visibility: "public",
    albumIds: ["wedding"],
    categoryIds: ["c1"],
    capturedAt: "2026-06-20T03:00:00.000Z",
  },
];

test("builds one patch-style batch containing changed fields only", () => {
  const albumDrafts = {
    wedding: { ...albumDraft(albums[0]), titleZh: "新的名稱" },
  };
  const categoryDrafts = {
    c1: { ...categoryDraft(categories[0]), labelEn: "Processional" },
  };
  const photoDrafts = {
    p1: { ...photoDraft(photos[0]), visibility: "hidden" },
  };

  const result = buildAdminChangeSet({
    albums,
    albumDrafts,
    newAlbum: {
      titleZh: "",
      titleEn: "ignored without a Chinese title",
      descriptionZh: "",
      descriptionEn: "",
      isVisible: true,
    },
    categories,
    categoryDrafts,
    categoryOrder: ["c2", "c1"],
    newCategory: { labelZh: "", labelEn: "" },
    photos,
    photoDrafts,
  });

  assert.equal(result.count, 4);
  assert.deepEqual(result.payload.albums.update, [
    { id: "wedding", changes: { titleZh: "新的名稱" } },
  ]);
  assert.deepEqual(result.payload.categories.update, [
    { id: "c1", changes: { labelEn: "Processional" } },
  ]);
  assert.deepEqual(result.payload.categories.reorder, ["c2", "c1"]);
  assert.deepEqual(result.payload.photos.update, [
    { id: "p1", changes: { visibility: "hidden" } },
  ]);
});

test("omits unchanged entities and stages new records only when required names exist", () => {
  const result = buildAdminChangeSet({
    albums,
    albumDrafts: {},
    newAlbum: {
      titleZh: "生活剪影",
      titleEn: "Life",
      descriptionZh: "",
      descriptionEn: "",
      isVisible: true,
    },
    categories,
    categoryDrafts: {},
    categoryOrder: ["c1", "c2"],
    newCategory: { labelZh: "祝福", labelEn: "Blessing" },
    photos,
    photoDrafts: {},
  });

  assert.equal(result.count, 2);
  assert.equal(result.payload.albums.update.length, 0);
  assert.equal(result.payload.photos.update.length, 0);
  assert.equal(result.payload.albums.create[0].clientId, "new-album");
  assert.equal(result.payload.categories.create[0].clientId, "new-category");
  assert.equal("reorder" in result.payload.categories, false);
});

test("tracks only successful operation keys for partial failure cleanup", () => {
  const keys = successfulResultKeys([
    { key: "album:update:wedding", status: "ok" },
    { key: "photo:update:p1", status: "error" },
  ]);
  assert.deepEqual([...keys], ["album:update:wedding"]);
});
