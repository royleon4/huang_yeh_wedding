import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { adminPhotoWorkspaceUiTransform } from "../admin-photo-workspace-ui-transform.mjs";
import { processContentUiTransform } from "../process-content-ui-transform.mjs";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("shared lazy image unlocks early and loads legacy photos without dimensions", async () => {
  const lazyImage = await source("../src/client/LazyImage.jsx");
  assert.match(lazyImage, /IntersectionObserver/);
  assert.match(lazyImage, /src=\{allowedToLoad \? src : undefined\}/);
  assert.match(lazyImage, /data-lazy-src/);
  assert.match(lazyImage, /rootMargin = "600px 0px"/);
  assert.match(
    lazyImage,
    /hasIntrinsicSize = Number\(width\) > 0 && Number\(height\) > 0/,
  );
  assert.match(
    lazyImage,
    /Boolean\(eager \|\| !hasIntrinsicSize\)/,
  );
  assert.match(
    lazyImage,
    /eager \|\| \(allowedToLoad && hasIntrinsicSize\) \? "eager" : "lazy"/,
  );
  assert.match(lazyImage, /fetchPriority = eager \? "high" : "auto"/);
});

test("front gallery prioritizes only the first visible row", async () => {
  const grid = await source("../src/client/PhotoGroupGrid.jsx");
  assert.match(grid, /photos\.map\(\(photo, photoIndex\)/);
  assert.match(grid, /eager=\{photoIndex < 2\}/);
  assert.match(grid, /fetchPriority=\{photoIndex === 0 \? "high" : "auto"\}/);
});

test("featured photos prioritize only the first card", async () => {
  const pinned = await source("../src/client/PinnedPhotoStrip.jsx");
  assert.match(pinned, /eager=\{index === 0\}/);
  assert.match(pinned, /fetchPriority=\{index === 0 \? "high" : "auto"\}/);
});

test("front gallery and private management use the shared lazy image", async () => {
  const grid = await source("../src/client/PhotoGroupGrid.jsx");
  const pinned = await source("../src/client/PinnedPhotoStrip.jsx");
  const management = await source("../src/client/BatchManagementPage.jsx");
  for (const component of [grid, pinned, management]) {
    assert.match(component, /import LazyImage/);
    assert.match(component, /<LazyImage/);
  }
});

test("pinned-photo choices do not mount thumbnails while collapsed", async () => {
  const picker = await source("../src/client/PinnedPhotoPicker.jsx");
  assert.match(picker, /onToggle=\{\(event\) => setExpanded\(event\.currentTarget\.open\)\}/);
  assert.match(picker, /\{expanded && \(/);
  assert.match(picker, /<LazyImage/g);
  assert.doesNotMatch(picker, /<img\s/);
});

test("administrator photo transform uses natural-height lazy previews", async () => {
  const adminSource = await source("../src/client/AdminApp.jsx");
  const processTransformed = processContentUiTransform().transform(
    adminSource,
    "/workspace/src/client/AdminApp.jsx",
  ).code;
  const transformed = adminPhotoWorkspaceUiTransform().transform(
    processTransformed,
    "/workspace/src/client/AdminApp.jsx",
  ).code;
  assert.match(transformed, /import LazyImage/);
  assert.match(transformed, /<LazyImage[\s\S]*width=\{photo\.width\}/);

  const styles = await source("../src/client/lazy-image.css");
  assert.match(styles, /\.admin-photo-preview img\.lazy-image/);
  assert.match(styles, /height: auto/);
  assert.match(styles, /object-fit: contain/);
});

test("pinned-photo chooser uses square full-fit previews", async () => {
  const styles = await source("../src/client/pinned-photo-admin.css");
  assert.match(styles, /\.pinned-candidate-grid img[\s\S]*aspect-ratio: 1/);
  assert.match(styles, /\.pinned-candidate-grid img[\s\S]*object-fit: contain/);
});

test("main gallery keeps explicit load-more paging", async () => {
  const appSource = await source("../src/client/App.jsx");
  const gallery = processContentUiTransform().transform(
    appSource,
    "/workspace/src/client/App.jsx",
  ).code;
  assert.match(gallery, /visible\.length < regularFiltered\.length/);
  assert.match(gallery, /className="load-more"/);
});
