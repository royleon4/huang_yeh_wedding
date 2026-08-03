import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { adminPhotoUploaderUiTransform } from "../admin-photo-uploader-ui-transform.mjs";
import { processContentUiTransform } from "../process-content-ui-transform.mjs";
import { albumLabelsUiTransform } from "../album-labels-ui-transform.mjs";
import { adminPhotoWorkspaceUiTransform } from "../admin-photo-workspace-ui-transform.mjs";
import { logicalRouteUiTransform } from "../logical-route-ui-transform.mjs";
import { websiteCopyUiTransform } from "../website-copy-ui-transform.mjs";
import { adminPreviewPaginationUiTransform } from "../admin-preview-pagination-ui-transform.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "..");

function apply(plugin, source, id) {
  const result = plugin.transform(source, id);
  return result?.code ?? source;
}

async function transformed(relativePath) {
  const id = path.join(root, relativePath);
  let source = await readFile(id, "utf8");
  for (const plugin of [
    adminPhotoUploaderUiTransform(),
    processContentUiTransform(),
    albumLabelsUiTransform(),
    adminPhotoWorkspaceUiTransform(),
    logicalRouteUiTransform(),
    websiteCopyUiTransform(),
    adminPreviewPaginationUiTransform(),
  ]) {
    source = apply(plugin, source, id);
  }
  return source;
}

test("administrator photo tab paginates previews ten at a time", async () => {
  const source = await transformed("src/client/AdminPhotoWorkspace.jsx");
  assert.match(source, /\{ limit = 10, selection = false \} = \{\}/);
  assert.match(source, /limit: String\(limit\)/);
  assert.match(source, /const \[previewPage, setPreviewPage\] = useState\(0\)/);
  assert.match(source, /const start = previewPage \* 10/);
  assert.match(source, /visiblePhotos\.slice\(start, start \+ 10\)/);
  assert.match(source, /\{previewPhotos\.map\(\(photo\) =>/);
  assert.doesNotMatch(source, /\{visiblePhotos\.map\(\(photo\) =>/);
  assert.match(source, /visiblePhotos=\{previewPhotos\}/);
  assert.match(source, /上一頁/);
  assert.match(source, /下一頁/);
  assert.match(source, /第 \{previewPage \+ 1\} \/ \{loadedPreviewPageCount\}/);
  assert.match(source, /loadPhotos\(\{ append: true, cursor \}\)/);
  assert.doesNotMatch(source, /ProgressivePreviewMoreButton/);
  assert.doesNotMatch(source, /useProgressivePreview/);
});

test("all-filtered selection keeps its explicit one-hundred-photo metadata pages", async () => {
  const source = await transformed("src/client/AdminPhotoWorkspace.jsx");
  assert.match(
    source,
    /buildPhotoQuery\(filters, cursor, \{ limit: 100, selection: true \}\)/,
  );
  assert.match(source, /query\.set\("selection", "all"\)/);
  assert.match(source, /setSelectedIds\(uniquePhotos\.map\(\(photo\) => photo\.id\)\)/);
});

test("administrator photo preview grid uses five columns and ten cards per page", async () => {
  const css = await readFile(
    path.join(root, "src/client/admin-photo-pagination.css"),
    "utf8",
  );
  assert.match(css, /grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.admin-photo-pagination/);
  assert.match(css, /aspect-ratio: 1/);
});

test("administrator bootstrap requests only the first ten photo records", async () => {
  const source = await transformed("src/client/AdminApp.jsx");
  assert.match(source, /admin\/api\/photos\?limit=10/);
  assert.doesNotMatch(source, /admin\/api\/photos\?limit=50/);
});

test("pinned-photo candidates use previous and next pages of ten thumbnails", async () => {
  const source = await transformed("src/client/PinnedPhotoPicker.jsx");
  assert.match(source, /PREVIEW_PAGE_SIZE = 10/);
  assert.match(source, /candidates\.slice\(/);
  assert.match(source, /pageCandidates\.map\(\(photo\) =>/);
  assert.match(source, /上一頁/);
  assert.match(source, /下一頁/);
  assert.match(source, /第 \{currentPage \+ 1\} \/ \{pageCount\} 頁/);
  assert.doesNotMatch(source, /ProgressivePreviewMoreButton/);
  assert.doesNotMatch(source, /previewCandidates/);
});

test("changing pinned-photo pages aborts hidden thumbnail requests", async () => {
  const [picker, thumbnail] = await Promise.all([
    transformed("src/client/PinnedPhotoPicker.jsx"),
    readFile(path.join(root, "src/client/AbortableThumbnail.jsx"), "utf8"),
  ]);
  assert.match(picker, /<AbortableThumbnail/);
  assert.match(picker, /key=\{`\$\{processKey\}:\$\{normalizedQuery\}:\$\{currentPage\}`\}/);
  assert.match(thumbnail, /const controller = new AbortController\(\)/);
  assert.match(thumbnail, /signal: controller\.signal/);
  assert.match(thumbnail, /controller\.abort\(\)/);
  assert.match(thumbnail, /URL\.revokeObjectURL/);
});
