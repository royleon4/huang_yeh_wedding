import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const navigationUrl = new URL(
  "../src/client/bottom-collection-nav.css",
  import.meta.url,
);

test("mobile fixed navigation is not trapped by page containment", async () => {
  const navigation = await readFile(navigationUrl, "utf8");

  assert.match(
    navigation,
    /\.bottom-collection-nav\s*\{[\s\S]*position:\s*fixed;[\s\S]*bottom:\s*0;/,
  );
  assert.doesNotMatch(navigation, /container-type:\s*(inline-size|size)/);
  assert.doesNotMatch(navigation, /container-name:\s*memories-page/);
  assert.doesNotMatch(navigation, /@container\s+memories-page/);
  assert.match(navigation, /@media \(min-width: 44rem\)/);
});
