import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageUrl = new URL("../package.json", import.meta.url);
const guardUrl = new URL("../scripts/ensure-build-dependencies.mjs", import.meta.url);

test("Memories build checks locked document dependencies before Vite starts", async () => {
  const [packageJson, guard] = await Promise.all([
    readFile(packageUrl, "utf8").then(JSON.parse),
    readFile(guardUrl, "utf8"),
  ]);

  assert.match(
    packageJson.scripts.build,
    /^node scripts\/ensure-build-dependencies\.mjs && vite build /,
  );
  for (const dependency of [
    "mammoth",
    "docx-preview",
    "pdfjs-dist",
    "@aiden0z/pptx-renderer",
  ]) {
    assert.ok(guard.includes(`"${dependency}"`));
    assert.ok(packageJson.dependencies[dependency]);
  }
  assert.match(guard, /packageRequire\.resolve\(packageName\)/);
  assert.match(guard, /spawnSync\("pnpm", \["install", "--frozen-lockfile"\]/);
  assert.match(guard, /still unavailable after installation/);
});
