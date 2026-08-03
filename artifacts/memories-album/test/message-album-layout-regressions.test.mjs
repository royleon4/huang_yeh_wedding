import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "..");

async function source(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("guestbook cards use the shared measured masonry layout", async () => {
  const album = await source("src/client/MessageAlbum.jsx");

  assert.match(album, /import useMasonryLayout from "\.\/useMasonryLayout\.mjs"/);
  assert.match(album, /const gridRef = useMasonryLayout\(\)/);
  assert.match(
    album,
    /<div ref=\{gridRef\} className="masonry-grid message-grid">/,
  );
  assert.match(album, /\(\) => `\$\{messages\.length\} \$\{t\.count\}`/);
});

test("guestbook submit has a synchronous duplicate-request guard", async () => {
  const modal = await source("src/client/MessageModal.jsx");

  assert.match(modal, /const submittingRef = useRef\(false\)/);
  assert.match(
    modal,
    /event\.preventDefault\(\);\s*if \(submittingRef\.current\) return;/,
  );
  assert.match(modal, /submittingRef\.current = true;\s*setBusy\(true\)/);
  assert.match(
    modal,
    /finally \{\s*submittingRef\.current = false;\s*controllerRef\.current = null;/,
  );
});

test("guestbook refreshes from the server after an optimistic creation", async () => {
  const album = await source("src/client/MessageAlbum.jsx");

  assert.match(
    album,
    /void loadMessages\(\{ showLoading: false, preserveOnError: true \}\)/,
  );
  assert.match(
    album,
    /current\.filter\(\(item\) => item\.id !== message\.id\)/,
  );
});

test("bottom navigation assigns odd and even album positions around upload", async () => {
  const navigation = await source("src/client/BottomCollectionNav.jsx");

  assert.match(
    navigation,
    /const leftAlbums = albums\.filter\(\(_.*, index\) => index % 2 === 0\)/,
  );
  assert.match(
    navigation,
    /const rightAlbums = albums\.filter\(\(_.*, index\) => index % 2 === 1\)/,
  );
  assert.match(navigation, /albums=\{leftAlbums\}/);
  assert.match(navigation, /albums=\{rightAlbums\}/);
  assert.doesNotMatch(navigation, /albums\.slice\(/);
  assert.doesNotMatch(navigation, /const split =/);
});
