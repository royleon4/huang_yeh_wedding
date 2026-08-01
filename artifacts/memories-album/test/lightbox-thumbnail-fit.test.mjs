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

test("lightbox toolbar links to the true original, closes at top right, and omits zoom buttons", async () => {
  const [source, css] = await Promise.all([
    readClientFile("PhotoLightbox.jsx"),
    readClientFile("photo-lightbox.css"),
  ]);

  assert.match(source, /href=\{photo\.mediaUrl\}/);
  assert.match(source, /target="_blank"/);
  assert.match(source, /rel="noopener noreferrer"/);
  assert.match(source, /查看原圖/);
  assert.match(source, /className="photo-viewer-close"/);
  assert.match(source, /loadingLabel = isEnglish \? "Loading photo…" : "正在載入照片…"/);
  assert.doesNotMatch(source, /photo-viewer-zoom-controls/);
  assert.doesNotMatch(source, /zoomPercent/);
  assert.doesNotMatch(source, /labels\.loading/);
  assert.match(css, /\.photo-viewer-toolbar[\s\S]*?justify-content:\s*space-between/);
  assert.match(css, /\.photo-viewer-original-link/);
  assert.match(css, /\.photo-viewer-close/);
  assert.doesNotMatch(css, /photo-viewer-zoom-controls/);
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
