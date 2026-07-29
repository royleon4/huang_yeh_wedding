import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Replit routes the Memories admin surface to the Memories artifact", async () => {
  const artifact = await readFile(
    new URL("../.replit-artifact/artifact.toml", import.meta.url),
    "utf8",
  );

  assert.match(artifact, /router\s*=\s*"path"/);
  assert.match(artifact, /"\/Memories\/admin"/);
  assert.match(artifact, /"\/memories\/admin"/);
  assert.match(artifact, /"\/admin"/);
  assert.match(artifact, /path\s*=\s*"\/Memories\/api\/health"/);
});
