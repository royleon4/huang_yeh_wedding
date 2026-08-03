import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageUrl = new URL("../package.json", import.meta.url);
const guardUrl = new URL("../scripts/ensure-build-dependencies.mjs", import.meta.url);

test("Memories build checks locked Word dependencies before Vite starts", async () => {
  const [packageJson, guard] = await Promise.all([
    readFile(packageUrl, "utf8").then(JSON.parse),
    readFile(guardUrl, "utf8"),
  ]);

  assert.match(
    packageJson.scripts.build,
    /^node scripts\/ensure-build-dependencies\.mjs && vite build /,
  );
  assert.match(guard, /requiredPackages = \["mammoth", "docx-preview"\]/);
  assert.match(guard, /packageRequire\.resolve\(packageName\)/);
  assert.match(guard, /spawnSync\("pnpm", \["install", "--frozen-lockfile"\]/);
  assert.match(guard, /still unavailable after installation/);
});
