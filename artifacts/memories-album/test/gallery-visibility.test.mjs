import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "..");

async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("lightbox shows a bounded uploader badge only when a name exists", async () => {
  const source = await read("src/client/PhotoLightbox.jsx");
  const css = await read("src/client/gallery-visibility.css");

  assert.match(source, /const uploaderName = String\(photo\?\.uploaderName \?\? ""\)\.trim\(\)/);
  assert.match(source, /\{uploaderName && \(/);
  assert.match(source, /className="photo-viewer-uploader"/);
  assert.match(css, /\.photo-viewer-uploader \{/);
  assert.match(css, /pointer-events: none/);
  assert.match(css, /text-overflow: ellipsis/);
});

test("load-more memory control has a visible button affordance", async () => {
  const app = await read("src/client/App.jsx");
  const css = await read("src/client/gallery-visibility.css");
  const main = await read("src/client/main.jsx");

  assert.match(app, /className="load-more"/);
  assert.match(app, /type="button"/);
  assert.match(css, /\.load-more \{/);
  assert.match(css, /border: 1px solid/);
  assert.match(css, /border-radius: 999px/);
  assert.match(css, /background: rgba\(45, 96, 74, 0\.94\)/);
  assert.match(css, /\.load-more:focus-visible/);
  assert.match(main, /import "\.\/gallery-visibility\.css"/);
});
