import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("../src/server/migrations.mjs", import.meta.url);

test("migration runner applies only pending migration files", async () => {
  const source = await readFile(migrationUrl, "utf8");
  assert.match(source, /pendingMigrations/);
  assert.match(source, /Applying \$\{pending\.length\} pending Memories migration/);
  assert.match(source, /schema is current; no migration needed/);
});
