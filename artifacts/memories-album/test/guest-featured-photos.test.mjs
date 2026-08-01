import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  isGuestNameFilter,
  pageGuestFeaturedPhotos,
  selectGuestFeaturedPhotoIds,
} from "../src/client/guest-featured-photos.mjs";
import { LATEST_GUEST_FILTER_ID } from "../src/guest-label-settings.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "..");

test("featured guest photos apply only to individual guest-name filters", () => {
  assert.equal(isGuestNameFilter("guest", "guest:amy"), true);
  assert.equal(isGuestNameFilter("guest", "all"), false);
  assert.equal(isGuestNameFilter("guest", LATEST_GUEST_FILTER_ID), false);
  assert.equal(isGuestNameFilter("wedding", "guest:amy"), false);
});

test("an individual guest filter selects between one and three photos", () => {
  const photos = Array.from({ length: 8 }, (_, index) => ({ id: `p${index}` }));
  const randomValues = [0.9, 0.1, 0.8, 0.2, 0.7, 0.3, 0.6, 0.99];
  let cursor = 0;
  const selected = selectGuestFeaturedPhotoIds(photos, {
    activeCollection: "guest",
    activeFilter: "guest:amy",
    enabled: true,
    random: () => randomValues[cursor++ % randomValues.length],
  });
  assert.ok(selected.length >= 1 && selected.length <= 3);
  assert.equal(new Set(selected).size, selected.length);
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

test("UI transform is ordered after guest labels and renders the admin control", async () => {
  const config = await readFile(path.join(root, "vite.routes.config.js"), "utf8");
  const transform = await readFile(
    path.join(root, "guest-featured-photos-ui-transform.mjs"),
    "utf8",
  );
  const guestLabelsIndex = config.indexOf("guestLabelsUiTransform(),");
  const featuredIndex = config.indexOf("guestFeaturedPhotosUiTransform(),");
  assert.ok(guestLabelsIndex >= 0);
  assert.ok(featuredIndex > guestLabelsIndex);
  assert.match(transform, /<GuestFeaturedPhotoSettings \/>/);
  assert.match(transform, /pageGuestFeaturedPhotos/);
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
