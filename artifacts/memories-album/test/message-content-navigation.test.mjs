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

test("guestbook positions rendered messages with the shared content navigation", async () => {
  const album = await source("src/client/MessageAlbum.jsx");

  assert.match(
    album,
    /import \{ requestActiveContentScroll \} from "\.\/gallery-navigation\.mjs"/,
  );
  assert.match(
    album,
    /import useMasonryLayout, \{\s*suspendMasonryAnchorRestoration,\s*\} from "\.\/useMasonryLayout\.mjs"/,
  );
  assert.match(album, /const positionAfterLoadRef = useRef\(false\)/);
  assert.match(
    album,
    /if \(showLoading\) \{\s*positionAfterLoadRef\.current = true;\s*setLoading\(true\);\s*\}/,
  );
  assert.match(
    album,
    /if \(loading \|\| error \|\| !positionAfterLoadRef\.current\) return;\s*positionAfterLoadRef\.current = false;\s*suspendMasonryAnchorRestoration\(\);\s*requestActiveContentScroll\(\);/,
  );
  assert.match(album, /\}, \[albumId, error, loading\]\);/);
  assert.match(
    album,
    /void loadMessages\(\{ showLoading: false, preserveOnError: true \}\)/,
  );
  assert.doesNotMatch(album, /scrollIntoView\(/);
  assert.doesNotMatch(album, /window\.scrollTo\(/);
});
