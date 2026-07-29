import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workspaceFile = (path) => new URL(`../../../${path}`, import.meta.url);

test("post-merge applies tracked Memories migrations instead of Drizzle push", async () => {
  const script = await readFile(workspaceFile("scripts/post-merge.sh"), "utf8");

  assert.match(
    script,
    /pnpm --filter @workspace\/memories-album run db:migrate/,
  );
  assert.doesNotMatch(script, /drizzle-kit\s+push|--filter\s+(?:@workspace\/)?db\s+push/);
});

test("post-merge allows enough time for database migrations", async () => {
  const replitConfig = await readFile(workspaceFile(".replit"), "utf8");
  const timeout = replitConfig.match(/\[postMerge\][\s\S]*?timeoutMs\s*=\s*(\d+)/);

  assert.ok(timeout, "postMerge timeout must be configured");
  assert.ok(Number(timeout[1]) >= 60_000, "postMerge timeout is too short");
});

test("the empty shared Drizzle schema cannot be pushed destructively", async () => {
  const packageJson = JSON.parse(
    await readFile(workspaceFile("lib/db/package.json"), "utf8"),
  );
  const guard = await readFile(
    workspaceFile("lib/db/scripts/refuse-schema-push.mjs"),
    "utf8",
  );

  assert.equal(packageJson.scripts.push, "node ./scripts/refuse-schema-push.mjs");
  assert.equal(
    packageJson.scripts["push-force"],
    "node ./scripts/refuse-schema-push.mjs",
  );
  assert.match(guard, /Refusing to run drizzle-kit push/);
  assert.match(guard, /@workspace\/memories-album run db:migrate/);
});
