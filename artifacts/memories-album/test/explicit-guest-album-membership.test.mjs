import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { filterPhotos } from "../src/client/gallery-model.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "..");

async function source(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("guest upload provenance is independent from Guest uploads membership", () => {
  const photos = [
    {
      id: "selected-wedding",
      source: "guest",
      collection: "wedding",
      albumIds: ["wedding"],
      processIds: ["ceremony"],
    },
    {
      id: "selected-life",
      source: "guest",
      collection: "life",
      albumIds: ["life"],
      processIds: [],
    },
    {
      id: "selected-guest",
      source: "guest",
      collection: "guest",
      albumIds: ["guest"],
      processIds: [],
    },
  ];

  assert.deepEqual(
    filterPhotos(photos, "all", "guest").map((photo) => photo.id),
    ["selected-guest"],
  );
  assert.deepEqual(
    filterPhotos(photos, "ceremony", "wedding").map((photo) => photo.id),
    ["selected-wedding"],
  );
  assert.deepEqual(
    filterPhotos(photos, "all", "life").map((photo) => photo.id),
    ["selected-life"],
  );
});

test("production repository resolves Guest uploads through album membership", async () => {
  const repository = await source(
    "src/server/photos/album-scoped-repository.mjs",
  );

  assert.match(repository, /function explicitAlbumIds\(photo\)/);
  assert.match(repository, /photo\.albumIds \?\? \[defaultAlbum\]/);
  assert.match(repository, /async insertPhoto\(photo\)/);
  assert.match(repository, /return \{ \.\.\.stored, albumIds \}/);
  assert.match(repository, /options\.collection === "guest"/);
  assert.match(repository, /albumId: "guest"/);
  assert.doesNotMatch(
    repository,
    /explicitAlbumIds[\s\S]*photo\.source === "guest" \? \["guest"\]/,
  );
});

test("migration removes only legacy automatic memberships and blocks recurrence", async () => {
  const migration = await source("db/016_explicit_guest_album_membership.sql");

  assert.match(migration, /DELETE FROM memories_photo_albums membership/);
  assert.match(migration, /membership\.album_id = 'guest'/);
  assert.match(migration, /photo\.collection IS DISTINCT FROM 'guest'/);
  assert.match(migration, /photo\.album_memberships_overridden = false/);
  assert.match(
    migration,
    /CREATE TRIGGER memories_require_explicit_guest_album_membership/,
  );
  assert.match(migration, /BEFORE INSERT ON memories_photo_albums/);
  assert.match(migration, /NEW\.album_id <> 'guest'/);
  assert.match(migration, /RETURN NULL/);
  assert.doesNotMatch(migration, /DELETE FROM memories_photos/);
  assert.doesNotMatch(migration, /DROP\s+(TABLE|COLUMN)\b/i);
});
