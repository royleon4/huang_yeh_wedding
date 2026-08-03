import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { filterPhotos } from "../src/client/gallery-model.mjs";
import { AlbumScopedPhotoRepository } from "../src/server/photos/album-scoped-repository.mjs";

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

test("production Guest uploads query uses album membership instead of provenance", async () => {
  const queries = [];
  const repository = new AlbumScopedPhotoRepository({
    async query(sql, values = []) {
      queries.push({ sql, values });
      return { rows: [] };
    },
  });

  const page = await repository.listPublicPhotos({
    collection: "guest",
    limit: 10,
  });

  assert.deepEqual(page.items, []);
  const listing = queries.find((query) => query.sql.includes("FROM memories_photos p"));
  assert(listing);
  assert.match(listing.sql, /FROM memories_photo_albums mpa/);
  assert.doesNotMatch(listing.sql, /p\.uploader_type = 'guest'/);
  assert.ok(listing.values.includes("guest"));
});

test("Drive reconciliation preserves an existing non-guest album membership", async () => {
  const queries = [];
  const repository = new AlbumScopedPhotoRepository({
    async query(sql, values = []) {
      queries.push({ sql, values });
      if (sql.includes("INSERT INTO memories_photos")) {
        return { rows: [{ id: "photo-1" }] };
      }
      if (sql.includes("SELECT album_id")) {
        return { rows: [{ album_id: "wedding" }] };
      }
      return { rows: [] };
    },
  });

  await repository.upsertDrivePhotoMetadata(
    {
      id: "drive-1",
      name: "classified.jpg",
      mimeType: "image/jpeg",
      size: 100,
      createdTime: "2026-06-20T03:00:00.000Z",
    },
    {
      source: "guest",
      parentFolderId: "guest-folder",
      collection: "guest",
      preserveLogicalClassification: true,
    },
  );

  assert.equal(
    queries.some((query) => query.sql.includes("INSERT INTO memories_photo_albums")),
    false,
  );
});

test("Drive reconciliation initializes Guest uploads only for a new unclassified file", async () => {
  const queries = [];
  const repository = new AlbumScopedPhotoRepository({
    async query(sql, values = []) {
      queries.push({ sql, values });
      if (sql.includes("INSERT INTO memories_photos")) {
        return { rows: [{ id: "photo-2" }] };
      }
      if (sql.includes("SELECT album_id")) return { rows: [] };
      return { rows: [] };
    },
  });

  await repository.upsertDrivePhotoMetadata(
    {
      id: "drive-2",
      name: "new-guest.jpg",
      mimeType: "image/jpeg",
      size: 100,
      createdTime: "2026-06-20T03:00:00.000Z",
    },
    {
      source: "guest",
      parentFolderId: "guest-folder",
      collection: "guest",
      preserveLogicalClassification: true,
    },
  );

  const membership = queries.find((query) =>
    query.sql.includes("INSERT INTO memories_photo_albums"),
  );
  assert(membership);
  assert.deepEqual(membership.values, ["photo-2", "guest"]);
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
  assert.match(repository, /memberships\.rows\.length === 0/);
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
