import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  isGuestFilter,
  normalizeGuestFeaturedRange,
  pageGuestFeaturedPhotos,
  selectGuestFeaturedPhotoIds,
} from "../src/client/guest-featured-photos.mjs";
import { LATEST_GUEST_FILTER_ID } from "../src/guest-label-settings.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "..");

test("featured guest photos apply to every guest label", () => {
  assert.equal(isGuestFilter("guest", "guest:amy"), true);
  assert.equal(isGuestFilter("guest", "all"), true);
  assert.equal(isGuestFilter("guest", LATEST_GUEST_FILTER_ID), true);
  assert.equal(isGuestFilter("wedding", "guest:amy"), false);
});

test("configured ranges select an inclusive number of unique photos", () => {
  const photos = Array.from({ length: 12 }, (_, index) => ({ id: `p${index}` }));
  const selected = selectGuestFeaturedPhotoIds(photos, {
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
    selectGuestFeaturedPhotoIds(photos, {
      activeCollection: "guest",
      activeFilter: LATEST_GUEST_FILTER_ID,
      enabled: true,
      minimum: 0,
      maximum: 0,
    }),
    [],
  );
  assert.deepEqual(normalizeGuestFeaturedRange({
    guestRandomFeaturedPhotosMin: 0,
    guestRandomFeaturedPhotosMax: 3,
  }), { minimum: 0, maximum: 3 });
});

test("invalid ranges fall back to one through three", () => {
  assert.deepEqual(normalizeGuestFeaturedRange({
    guestRandomFeaturedPhotosMin: 4,
    guestRandomFeaturedPhotosMax: 2,
  }), { minimum: 1, maximum: 3 });
  assert.deepEqual(normalizeGuestFeaturedRange({
    guestRandomFeaturedPhotosMin: "one",
    guestRandomFeaturedPhotosMax: 3,
  }), { minimum: 1, maximum: 3 });
});

test("featured photos are placed first and marked without increasing page size", () => {
  const photos = ["a", "b", "c", "d", "e"].map((id) => ({ id }));
  const visible = pageGuestFeaturedPhotos(photos, 4, ["d", "b"]);
  assert.deepEqual(
    visible.map((photo) => photo.id),
    ["b", "d", "a", "c"],
  );
  assert.deepEqual(
    visible.map((photo) => photo.guestFeatured),
    [true, true, false, false],
  );
});

test("UI transform is ordered after guest labels and renders range controls", async () => {
  const config = await readFile(path.join(root, "vite.routes.config.js"), "utf8");
  const transform = await readFile(
    path.join(root, "guest-featured-photos-ui-transform.mjs"),
    "utf8",
  );
  const settings = await readFile(
    path.join(root, "src/client/GuestFeaturedPhotoSettings.jsx"),
    "utf8",
  );
  const guestLabelsIndex = config.indexOf("guestLabelsUiTransform(),");
  const featuredIndex = config.indexOf("guestFeaturedPhotosUiTransform(),");
  assert.ok(guestLabelsIndex >= 0);
  assert.ok(featuredIndex > guestLabelsIndex);
  assert.match(transform, /<GuestFeaturedPhotoSettings \/>/);
  assert.match(transform, /guestFeaturedPhotoSettings\.minimum/);
  assert.match(transform, /guestFeaturedPhotoSettings\.maximum/);
  assert.match(settings, /最少張數/);
  assert.match(settings, /最多張數/);
  assert.match(settings, /type="number"/);
  assert.match(settings, /0～3/);
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
  assert.match(css, /\.photo-card\.is-guest-featured[\s\S]*grid-column: span 2/);
  assert.match(grid, /photo\.guestFeatured \? " is-guest-featured"/);
});
