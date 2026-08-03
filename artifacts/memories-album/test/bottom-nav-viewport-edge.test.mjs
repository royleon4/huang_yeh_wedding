import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const navigationUrl = new URL(
  "../src/client/bottom-collection-nav.css",
  import.meta.url,
);

test("bottom navigation stays flush with the viewport edge in every bottom-bar mode", async () => {
  const navigation = await readFile(navigationUrl, "utf8");

  assert.match(
    navigation,
    /\.bottom-collection-nav\s*\{[^}]*position: fixed;[^}]*bottom: 0;/,
  );
  assert.match(
    navigation,
    /\.bottom-collection-nav\s*\{[^}]*border-bottom: 0;[^}]*border-radius: 1\.2rem 1\.2rem 0 0;/,
  );
  assert.match(
    navigation,
    /max\(var\(--memories-bottom-nav-block-padding\), env\(safe-area-inset-bottom\)\)/,
  );
  assert.doesNotMatch(
    navigation,
    /@media \(min-width: 721px\)[\s\S]*\.bottom-collection-nav\s*\{[^}]*bottom:\s*(?!0(?:px|rem)?\s*;)/,
  );
});
