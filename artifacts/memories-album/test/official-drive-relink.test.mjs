import assert from "node:assert/strict";
import test from "node:test";
import { AlbumScopedPhotoRepository } from "../src/server/photos/album-scoped-repository.mjs";

function photoRow({
  id = "old-photo",
  driveFileId = "new-drive-id",
  filename = "Wedding-001.jpg",
  byteSize = 30_000_000,
  width = 8256,
  height = 5504,
} = {}) {
  return {
    id,
    batch_id: null,
    drive_file_id: driveFileId,
    thumbnail_drive_file_id: null,
    drive_parent_folder_id: "process-folder",
    original_filename: filename,
    display_name: filename,
    mime_type: "image/jpeg",
    byte_size: byteSize,
    width,
    height,
    content_hash: `drive:${driveFileId}`,
    content_version: 2,
    uploader_type: "official",
    uploader_name: "婚禮攝影",
    collection: "wedding",
    visibility: "public",
    processing_state: "ready",
    captured_at_overridden: false,
    album_memberships_overridden: false,
    created_at: "2026-06-20T03:00:00.000Z",
    updated_at: "2026-08-05T12:00:00.000Z",
    process_ids: ["ceremony"],
    album_ids: ["wedding"],
  };
}

function recordingPool({ candidateIds }) {
  const queries = [];
  const row = photoRow();
  return {
    queries,
    pool: {
      async query(sql, values = []) {
        queries.push({ sql, values });
        if (
          sql.includes("SELECT id") &&
          sql.includes("WHERE drive_file_id = $1") &&
          sql.includes("LIMIT 1")
        ) {
          return { rows: [] };
        }
        if (sql.includes("lower(original_filename) = lower($2)")) {
          return { rows: candidateIds.map((id) => ({ id })) };
        }
        if (
          sql.includes("SET drive_file_id = $2") &&
          sql.includes("thumbnail_drive_file_id = NULL")
        ) {
          return { rows: [{ id: "old-photo" }] };
        }
        if (sql.includes("INSERT INTO memories_photos")) {
          return { rows: [row] };
        }
        if (
          sql.includes("FROM memories_photos p") &&
          sql.includes("WHERE p.id = $1")
        ) {
          return { rows: [row] };
        }
        return { rows: [] };
      },
    },
  };
}

function scannedOfficialFile() {
  return {
    id: "new-drive-id",
    name: "Wedding-001.jpg",
    mimeType: "image/jpeg",
    size: "30000000",
    createdTime: "2026-06-20T03:00:00.000Z",
    imageMediaMetadata: {
      time: "2026-06-20T03:00:00.000Z",
      width: 8256,
      height: 5504,
    },
  };
}

test("a unique official filename and byte-size match relinks a stale Drive id", async () => {
  const { pool, queries } = recordingPool({ candidateIds: ["old-photo"] });
  const repository = new AlbumScopedPhotoRepository(pool);

  await repository.upsertDrivePhotoMetadata(scannedOfficialFile(), {
    source: "official",
    parentFolderId: "process-folder",
    collection: "wedding",
  });

  const relink = queries.find((query) =>
    query.sql.includes("SET drive_file_id = $2"),
  );
  assert(relink);
  assert.match(relink.sql, /thumbnail_drive_file_id = NULL/);
  assert.match(relink.sql, /content_version = content_version \+ 1/);
  assert.deepEqual(relink.values.slice(0, 5), [
    "old-photo",
    "new-drive-id",
    "Wedding-001.jpg",
    "image/jpeg",
    30_000_000,
  ]);
  assert.equal(relink.values[5], 8256);
  assert.equal(relink.values[6], 5504);

  const metadataUpdate = queries.find(
    (query) =>
      query.sql.includes("SET width = COALESCE($2, width)") &&
      query.values[0] === "new-drive-id",
  );
  assert(metadataUpdate);
  assert.deepEqual(metadataUpdate.values, ["new-drive-id", 8256, 5504]);
});

test("ambiguous official filename and byte-size matches are never relinked", async () => {
  const { pool, queries } = recordingPool({
    candidateIds: ["old-photo-a", "old-photo-b"],
  });
  const repository = new AlbumScopedPhotoRepository(pool);

  await repository.upsertDrivePhotoMetadata(scannedOfficialFile(), {
    source: "official",
    parentFolderId: "process-folder",
    collection: "wedding",
  });

  assert.equal(
    queries.some((query) => query.sql.includes("SET drive_file_id = $2")),
    false,
  );
  assert.equal(
    queries.some((query) => query.sql.includes("INSERT INTO memories_photos")),
    true,
  );
});
