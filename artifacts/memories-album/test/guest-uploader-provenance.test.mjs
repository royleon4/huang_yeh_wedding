import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const databaseMigration = readFileSync(
  new URL("../db/014_guest_uploader_provenance.sql", import.meta.url),
  "utf8",
);
const runtimeMigration = readFileSync(
  new URL("../migrations/014_guest_uploader_provenance.sql", import.meta.url),
  "utf8",
);

test("guest uploader provenance migration is mirrored exactly", () => {
  assert.equal(runtimeMigration, databaseMigration);
});

test("Drive-reconciled guest photos recover the visitor-entered uploader name", () => {
  assert.match(
    databaseMigration,
    /JOIN memories_upload_batches batch ON batch\.id = ui\.batch_id/,
  );
  assert.match(
    databaseMigration,
    /ui\.original_drive_file_id = NEW\.drive_file_id/,
  );
  assert.match(
    databaseMigration,
    /NEW\.uploader_name := resolved_uploader_name/,
  );
  assert.match(
    databaseMigration,
    /AFTER INSERT OR UPDATE OF\s+original_drive_file_id,\s+batch_id,\s+client_upload_id\s+ON memories_upload_items/s,
  );
});

test("existing synthetic guest labels are repaired without inventing a person", () => {
  assert.match(databaseMigration, /WITH resolved_uploads AS/);
  assert.match(
    databaseMigration,
    /photo\.drive_file_id = resolved\.original_drive_file_id/,
  );
  assert.match(
    databaseMigration,
    /SET uploader_name = '訪客上傳'/,
  );
  assert.match(
    databaseMigration,
    /uploader_name = 'Google Drive guest'/,
  );
});

test("guest uploader repair is additive and preserves real names", () => {
  assert.doesNotMatch(databaseMigration, /DROP TABLE|DROP COLUMN|TRUNCATE/i);
  assert.match(
    databaseMigration,
    /WHEN photo\.uploader_name IS NULL[\s\S]*THEN resolved_uploader_name[\s\S]*ELSE photo\.uploader_name/,
  );
});
