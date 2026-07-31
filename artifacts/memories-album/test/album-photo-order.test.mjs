import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ALBUM_PHOTO_SORT_MODES,
  DEFAULT_ALBUM_PHOTO_SORT_MODE,
  normalizeAlbumPhotoSortMode,
  sortAlbumPhotos,
  sortAlbumPhotosWithinMediaOrder,
} from "../album-photo-order.mjs";
import { photoMediaKey } from "../src/gallery-media-order.mjs";

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

const groupedPhotos = [
  {
    id: "guest-old",
    displayName: "訪客 1",
    uploaderName: "Amy",
    createdAt: "2026-06-20T09:30:00.000Z",
  },
  {
    id: "official-new",
    displayName: "婚攝 2",
    uploaderName: "婚禮攝影",
    createdAt: "2026-06-20T11:00:00.000Z",
  },
  {
    id: "guest-new",
    displayName: "訪客 2",
    uploaderName: "Zoe",
    createdAt: "2026-06-20T12:00:00.000Z",
  },
  {
    id: "official-old",
    displayName: "婚攝 1",
    uploaderName: "婚禮攝影",
    createdAt: "2026-06-20T08:00:00.000Z",
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

test("global media order stays authoritative while album sorting applies inside each group", () => {
  const officialFirstOrder = [
    "video",
    "text",
    "weddingPhotos",
    "guestPhotos",
  ];
  const guestFirstOrder = [
    "video",
    "text",
    "guestPhotos",
    "weddingPhotos",
  ];

  for (const mode of ALBUM_PHOTO_SORT_MODES) {
    const officialFirst = sortAlbumPhotosWithinMediaOrder(
      groupedPhotos,
      officialFirstOrder,
      mode,
      "global-order-test",
    );
    assert.deepEqual(
      officialFirst.map(photoMediaKey),
      ["weddingPhotos", "weddingPhotos", "guestPhotos", "guestPhotos"],
      `${mode} must not move guest photos ahead of wedding photography`,
    );

    const guestFirst = sortAlbumPhotosWithinMediaOrder(
      groupedPhotos,
      guestFirstOrder,
      mode,
      "global-order-test",
    );
    assert.deepEqual(
      guestFirst.map(photoMediaKey),
      ["guestPhotos", "guestPhotos", "weddingPhotos", "weddingPhotos"],
      `${mode} must respect a global guest-first setting`,
    );
  }

  assert.deepEqual(
    ids(
      sortAlbumPhotosWithinMediaOrder(
        groupedPhotos,
        officialFirstOrder,
        "time-asc",
        "time-test",
      ),
    ),
    ["official-old", "official-new", "guest-old", "guest-new"],
  );
  assert.deepEqual(
    ids(
      sortAlbumPhotosWithinMediaOrder(
        groupedPhotos,
        officialFirstOrder,
        "time-desc",
        "time-test",
      ),
    ),
    ["official-new", "official-old", "guest-new", "guest-old"],
  );
  assert.deepEqual(
    ids(groupedPhotos),
    ["guest-old", "official-new", "guest-new", "official-old"],
    "group-aware sorting must not mutate API data",
  );
});

test("album photo ordering is selectable in admin and applied after filtering", async () => {
  const [transform, changeSet, photoApi] = await Promise.all([
    readFile(new URL("../album-photo-order-ui-transform.mjs", import.meta.url), "utf8"),
    readFile(new URL("../src/client/admin-change-set.mjs", import.meta.url), "utf8"),
    readFile(new URL("../src/server/photos/api.mjs", import.meta.url), "utf8"),
  ]);

  for (const mode of ALBUM_PHOTO_SORT_MODES) {
    assert.match(transform, new RegExp(`value=\\"${mode}\\"`));
  }
  assert.match(transform, /sortAlbumPhotosWithinMediaOrder\(/);
  assert.doesNotMatch(transform, /sortAlbumPhotos\(\s*sortPhotosByMediaOrder/);
  assert.match(transform, /galleryMediaOrder,/);
  assert.match(transform, /const \[albumRandomSeed\] = useState/);
  assert.match(transform, /albumRandomSeed,/);
  assert.doesNotMatch(transform, /albumRandomSeedRef/);
  assert.match(changeSet, /"photoSortMode"/);
  assert.match(photoApi, /nameSortRank:/);
  assert.match(photoApi, /authorSortRank:/);
  assert.doesNotMatch(photoApi, /displayName: photo\.displayName/);
  assert.doesNotMatch(photoApi, /originalFilename: photo\.originalFilename/);
});
