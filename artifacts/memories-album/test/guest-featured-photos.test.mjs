import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  isAlbumFilter,
  normalizeFeaturedPhotoRange,
  pageFeaturedPhotos,
  selectFeaturedPhotoIds,
} from "../src/client/guest-featured-photos.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "..");

test("featured photos apply to every album and label", () => {
  assert.equal(isAlbumFilter("guest", "guest:amy"), true);
  assert.equal(isAlbumFilter("guest", "all"), true);
  assert.equal(isAlbumFilter("guest", "latest"), true);
  assert.equal(isAlbumFilter("wedding", "all"), true);
  assert.equal(isAlbumFilter("wedding", "ceremony"), true);
  assert.equal(isAlbumFilter("life", "all"), true);
  assert.equal(isAlbumFilter("", "all"), false);
});

test("configured ranges select an inclusive number of unique photos", () => {
  const photos = Array.from({ length: 12 }, (_, index) => ({ id: `p${index}` }));
  const selected = selectFeaturedPhotoIds(photos, {
    activeCollection: "guest",
    activeFilter: "all",
    enabled: true,
    minimum: 2,
    maximum: 6,
    random: () => 0.5,
  });
  assert.ok(selected.length >= 2 && selected.length <= 6);
  assert.equal(new Set(selected).size, selected.length);
});

test("zero is accepted as the lower and upper bound", () => {
  const photos = [{ id: "a" }, { id: "b" }];
  assert.deepEqual(
    selectFeaturedPhotoIds(photos, {
      activeCollection: "life",
      activeFilter: "all",
      enabled: true,
      minimum: 0,
      maximum: 0,
    }),
    [],
  );
  assert.deepEqual(
    normalizeFeaturedPhotoRange({ featuredPhotoMin: 0, featuredPhotoMax: 3 }),
    { minimum: 0, maximum: 3 },
  );
});

test("invalid ranges fall back to one through three", () => {
  assert.deepEqual(
    normalizeFeaturedPhotoRange({ featuredPhotoMin: 4, featuredPhotoMax: 2 }),
    { minimum: 1, maximum: 3 },
  );
  assert.deepEqual(
    normalizeFeaturedPhotoRange({ featuredPhotoMin: "one", featuredPhotoMax: 3 }),
    { minimum: 1, maximum: 3 },
  );
});

test("featured photos are placed first and marked without increasing page size", () => {
  const photos = ["a", "b", "c", "d", "e"].map((id) => ({ id }));
  const visible = pageFeaturedPhotos(photos, 4, ["d", "b"]);
  assert.deepEqual(
    visible.map((photo) => photo.id),
    ["b", "d", "a", "c"],
  );
  assert.deepEqual(
    visible.map((photo) => photo.albumFeatured),
    [true, true, false, false],
  );
});

test("UI transform places numeric controls inside every album editor", async () => {
  const config = await readFile(path.join(root, "vite.routes.config.js"), "utf8");
  const transform = await readFile(
    path.join(root, "guest-featured-photos-ui-transform.mjs"),
    "utf8",
  );
  const guestLabelsIndex = config.indexOf("guestLabelsUiTransform(),");
  const featuredIndex = config.indexOf("guestFeaturedPhotosUiTransform(),");
  assert.ok(guestLabelsIndex >= 0);
  assert.ok(featuredIndex > guestLabelsIndex);
  assert.match(transform, /啟用隨機置頂照片/);
  assert.match(transform, /最少張數/);
  assert.match(transform, /最多張數/);
  assert.match(transform, /type=\"number\"/);
  assert.match(transform, /0～3/);
  assert.match(transform, /featuredAlbumDefinition/);
});

test("featured card spans two grid columns", async () => {
  const css = await readFile(
    path.join(root, "src/client/guest-featured-photos.css"),
    "utf8",
  );
  const grid = await readFile(
    path.join(root, "src/client/PhotoGroupGrid.jsx"),
    "utf8",
  );
  assert.match(css, /\.photo-card\.is-album-featured[\s\S]*grid-column: span 2/);
  assert.match(grid, /photo\.albumFeatured \? " is-album-featured"/);
});
