import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DEFAULT_ALBUM_PHOTO_SORT_MODE,
  normalizeAlbumPhotoSortMode,
  sortAlbumPhotos,
} from "../album-photo-order.mjs";

const photos = [
  {
    id: "b",
    displayName: "10 合照",
    originalFilename: "IMG_0010.jpg",
    uploaderName: "葉藝慧",
    createdAt: "2026-06-20T10:00:00.000Z",
  },
  {
    id: "a",
    displayName: "2 進場",
    originalFilename: "IMG_0002.jpg",
    uploaderName: "婚禮攝影",
    createdAt: "2026-06-20T09:00:00.000Z",
  },
  {
    id: "c",
    displayName: "祝福",
    originalFilename: "IMG_0020.jpg",
    uploaderName: "Leon",
    createdAt: "2026-06-20T11:00:00.000Z",
  },
];

function ids(items) {
  return items.map((photo) => photo.id);
}

test("album photo order supports time, name, author and stable random modes", () => {
  assert.equal(normalizeAlbumPhotoSortMode("unknown"), DEFAULT_ALBUM_PHOTO_SORT_MODE);
  assert.deepEqual(ids(sortAlbumPhotos(photos, "time-asc")), ["a", "b", "c"]);
  assert.deepEqual(ids(sortAlbumPhotos(photos, "time-desc")), ["c", "b", "a"]);
  assert.deepEqual(ids(sortAlbumPhotos(photos, "name-asc")), ["a", "b", "c"]);
  assert.deepEqual(ids(sortAlbumPhotos(photos, "name-desc")), ["c", "b", "a"]);
  assert.deepEqual(ids(sortAlbumPhotos(photos, "author-asc")), ["a", "b", "c"]);
  assert.deepEqual(ids(sortAlbumPhotos(photos, "author-desc")), ["c", "b", "a"]);

  const ranked = photos.map((photo, index) => ({
    ...photo,
    nameSortRank: index + 1,
    authorSortRank: photos.length - index,
  }));
  assert.deepEqual(ids(sortAlbumPhotos(ranked, "name-asc")), ["b", "a", "c"]);
  assert.deepEqual(ids(sortAlbumPhotos(ranked, "author-asc")), ["c", "a", "b"]);

  const first = ids(sortAlbumPhotos(photos, "random", "page-load-one"));
  const repeated = ids(sortAlbumPhotos(photos, "random", "page-load-one"));
  const anotherLoad = ids(sortAlbumPhotos(photos, "random", "page-load-two"));
  assert.deepEqual(repeated, first);
  assert.notDeepEqual(anotherLoad, first);
  assert.deepEqual(ids(photos), ["b", "a", "c"], "sorting must not mutate API data");
});

test("album photo ordering is selectable in admin and applied after filtering", async () => {
  const [transform, changeSet, photoApi] = await Promise.all([
    readFile(new URL("../album-photo-order-ui-transform.mjs", import.meta.url), "utf8"),
    readFile(new URL("../src/client/admin-change-set.mjs", import.meta.url), "utf8"),
    readFile(new URL("../src/server/photos/api.mjs", import.meta.url), "utf8"),
  ]);

  for (const mode of [
    "random",
    "time-asc",
    "time-desc",
    "name-asc",
    "name-desc",
    "author-asc",
    "author-desc",
  ]) {
    assert.match(transform, new RegExp(`value=\\"${mode}\\"`));
  }
  assert.match(transform, /sortAlbumPhotos\(/);
  assert.match(transform, /albumRandomSeedRef\.current/);
  assert.match(changeSet, /"photoSortMode"/);
  assert.match(photoApi, /nameSortRank:/);
  assert.match(photoApi, /authorSortRank:/);
  assert.doesNotMatch(photoApi, /displayName: photo\.displayName/);
  assert.doesNotMatch(photoApi, /originalFilename: photo\.originalFilename/);
});
