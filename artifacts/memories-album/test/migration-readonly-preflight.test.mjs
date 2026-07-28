import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("../src/server/migrations.mjs", import.meta.url);

test("current production schemas use a read-only migration preflight", async () => {
  const source = await readFile(migrationUrl, "utf8");
  assert.match(source, /SELECT to_regclass/);
  assert.match(source, /no migration needed/);
  assert.doesNotMatch(source, /CREATE TABLE IF NOT EXISTS memories_schema_migrations/);
});
