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

function photoRow(values) {
  return {
    id: values[0],
    batch_id: values[1],
    drive_file_id: values[2],
    thumbnail_drive_file_id: values[3],
    original_filename: values[4],
    display_name: values[5],
    mime_type: values[6],
    byte_size: values[7],
    width: values[8],
    height: values[9],
    content_hash: values[10],
    content_version: values[11],
    uploader_type: values[12],
    uploader_name: values[13],
    visibility: values[14],
    processing_state: values[15],
    drive_parent_folder_id: values[16],
    collection: values[17],
    captured_at_overridden: values[18],
    album_memberships_overridden: values[19],
    created_at: values[20],
    updated_at: values[20],
  };
}

function recordingPhotoPool() {
  const queries = [];
  const client = {
    async query(sql, values = []) {
      queries.push({ sql, values });
      if (sql.includes("INSERT INTO memories_photos")) {
        return { rows: [photoRow(values)] };
      }
      return { rows: [] };
    },
    release() {},
  };
  return {
    queries,
    pool: {
      query: client.query.bind(client),
      async connect() {
        return client;
      },
    },
  };
}

function visitorPhoto({ id, collection }) {
  return {
    id,
    batchId: "11111111-1111-4111-8111-111111111111",
    clientUploadId: `upload-${id}`,
    driveFileId: `drive-${id}`,
    thumbnailDriveFileId: `thumb-${id}`,
    originalFilename: `${id}.jpg`,
    mimeType: "image/jpeg",
    byteSize: 100,
    width: 1200,
    height: 800,
    contentHash: `hash-${id}`,
    contentVersion: 1,
    source: "guest",
    uploaderName: "小安",
    collection,
    visibility: "public",
    processingState: "ready",
    processIds: collection === "wedding" ? ["ceremony"] : [],
    createdAt: "2026-06-20T03:00:00.000Z",
    updatedAt: "2026-06-20T03:00:00.000Z",
  };
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

test("frontend visitor batches retain Guest uploads beside a selected album", async () => {
  for (const collection of ["wedding", "life"]) {
    const { pool, queries } = recordingPhotoPool();
    const repository = new AlbumScopedPhotoRepository(pool);
    const stored = await repository.insertPhoto(
      visitorPhoto({ id: `visitor-${collection}`, collection }),
    );

    assert.deepEqual(stored.albumIds, [collection, "guest"]);
    const photoInsert = queries.find((query) =>
      query.sql.includes("INSERT INTO memories_photos"),
    );
    assert(photoInsert);
    assert.equal(photoInsert.values[19], true);
    assert.deepEqual(
      queries
        .filter((query) => query.sql.includes("INSERT INTO memories_photo_albums"))
        .map((query) => query.values[1]),
      [collection, "guest"],
    );
  }
});

test("guest provenance without a frontend batch does not gain Guest uploads", async () => {
  const { pool, queries } = recordingPhotoPool();
  const repository = new AlbumScopedPhotoRepository(pool);
  const stored = await repository.insertPhoto({
    ...visitorPhoto({ id: "drive-classified", collection: "wedding" }),
    batchId: null,
    clientUploadId: null,
    albumIds: ["wedding"],
  });

  assert.deepEqual(stored.albumIds, ["wedding"]);
  const photoInsert = queries.find((query) =>
    query.sql.includes("INSERT INTO memories_photos"),
  );
  assert(photoInsert);
  assert.equal(photoInsert.values[19], false);
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

test("production repository keeps the visitor-copy policy explicit", async () => {
  const repository = await source(
    "src/server/photos/album-scoped-repository.mjs",
  );

  assert.match(repository, /function visitorUploadNeedsGuestCopy\(photo\)/);
  assert.match(repository, /photo\.source === "guest"/);
  assert.match(repository, /Boolean\(photo\.batchId\)/);
  assert.match(repository, /defaultAlbumId\(photo\) !== "guest"/);
  assert.match(repository, /visitorUploadNeedsGuestCopy\(photo\) \? \["guest"\] : \[\]/);
  assert.match(repository, /albumMembershipsOverridden:[\s\S]*visitorUploadNeedsGuestCopy\(photo\)/);
  assert.match(repository, /options\.collection === "guest"/);
  assert.match(repository, /albumId: "guest"/);
  assert.match(repository, /memberships\.rows\.length === 0/);
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
