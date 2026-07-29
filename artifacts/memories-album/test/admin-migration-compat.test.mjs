import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the album migration keeps pre-deploy photo writers compatible", async () => {
  const sql = await readFile(
    new URL("../db/007_admin_albums.sql", import.meta.url),
    "utf8",
  );
  const triggerPosition = sql.indexOf(
    "CREATE TRIGGER memories_fill_display_name",
  );
  const constraintPosition = sql.indexOf(
    "ALTER COLUMN display_name SET NOT NULL",
  );

  assert.match(sql, /NEW\.display_name := NEW\.original_filename/);
  assert.ok(
    triggerPosition >= 0,
    "expected a display-name compatibility trigger",
  );
  assert.ok(
    constraintPosition > triggerPosition,
    "the compatibility trigger must exist before NOT NULL is enforced",
  );
});
