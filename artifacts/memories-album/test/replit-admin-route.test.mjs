import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const artifact = await readFile(
  new URL("../.replit-artifact/artifact.toml", import.meta.url),
  "utf8",
);

function configuredPaths(source) {
  const paths = source.match(/paths\s*=\s*\[([^\]]+)\]/)?.[1] ?? "";
  return [...paths.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

test("Replit routes and probes the Memories artifact", async (t) => {
  await t.test("routes public and administrator entry paths", () => {
    assert.match(artifact, /router\s*=\s*"path"/);
    for (const route of [
      "/Memories/admin",
      "/memories/admin",
      "/admin",
    ]) {
      assert.match(artifact, new RegExp(`"${route.replaceAll("/", "\\/")}"`));
    }
  });

  await t.test("probes the lightweight health endpoint first", () => {
    const paths = configuredPaths(artifact);
    assert.equal(paths[0], "/Memories/api/health");
    assert.ok(paths.includes("/Memories"));
    assert.ok(paths.includes("/Memories/admin"));
    assert.match(artifact, /path\s*=\s*"\/Memories\/api\/health"/);
  });
});
