import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const clientRoot = new URL("../src/client/", import.meta.url);

async function readClientFile(name) {
  return readFile(new URL(name, clientRoot), "utf8");
}

test("fullscreen viewer renders cached thumbnails and never preloads adjacent originals", async () => {
  const source = await readClientFile("PhotoLightbox.jsx");

  assert.match(source, /const viewerUrl = lightboxImageUrl\(photo\)/);
  assert.match(source, /src=\{viewerUrl\}/);
  assert.match(source, /lightboxImageUrl\(photos\[index\]\)/);
  assert.doesNotMatch(source, /image\.src = adjacent\.mediaUrl/);
  assert.doesNotMatch(source, /src=\{photo\.mediaUrl\}/);
});

test("fullscreen viewer contains portrait and landscape images inside the viewport", async () => {
  const css = await readClientFile("photo-lightbox.css");

  assert.match(css, /grid-template-rows:\s*auto minmax\(0, 1fr\) auto/);
  assert.match(
    css,
    /\.photo-viewer-stage\s*\{[\s\S]*?grid-column:\s*1 \/ -1;[\s\S]*?width:\s*100%;[\s\S]*?height:\s*100%;/,
  );
  assert.match(
    css,
    /\.photo-viewer-stage img\s*\{[\s\S]*?width:\s*100%;[\s\S]*?height:\s*100%;[\s\S]*?object-fit:\s*contain;[\s\S]*?object-position:\s*center;/,
  );
});
