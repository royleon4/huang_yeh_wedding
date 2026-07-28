import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const repositoryUrl = new URL(
  "../src/server/photos/postgres-repository.mjs",
  import.meta.url,
);
const driveUrl = new URL(
  "../src/server/storage/drive-adapter.mjs",
  import.meta.url,
);

test("public photos default to chronological capture-created order", async () => {
  const [repositorySource, driveSource] = await Promise.all([
    readFile(repositoryUrl, "utf8"),
    readFile(driveUrl, "utf8"),
  ]);

  assert.match(repositorySource, /file\.imageMediaMetadata\?\.time/);
  assert.match(repositorySource, /file\.createdTime/);
  assert.match(repositorySource, /created_at = EXCLUDED\.created_at/);
  assert.match(repositorySource, /\(p\.created_at, p\.id\) > /);
  assert.match(repositorySource, /ORDER BY p\.created_at ASC, p\.id ASC/);
  assert.match(driveSource, /createdTime,modifiedTime,imageMediaMetadata\(time\)/);
});
