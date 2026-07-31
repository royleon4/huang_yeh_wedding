import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { adminPhotoUploaderUiTransform } from "../admin-photo-uploader-ui-transform.mjs";
import { processContentUiTransform } from "../process-content-ui-transform.mjs";
import { adminPhotoWorkspaceUiTransform } from "../admin-photo-workspace-ui-transform.mjs";
import { logicalRouteUiTransform } from "../logical-route-ui-transform.mjs";
import { websiteCopyUiTransform } from "../website-copy-ui-transform.mjs";
import { adminPreviewPaginationUiTransform } from "../admin-preview-pagination-ui-transform.mjs";
import { adminSettingsConsolidationUiTransform } from "../admin-settings-consolidation-ui-transform.mjs";
import { adminAccordionUiTransform } from "../admin-accordion-ui-transform.mjs";

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
    adminPhotoWorkspaceUiTransform(),
    logicalRouteUiTransform(),
    websiteCopyUiTransform(),
    adminPreviewPaginationUiTransform(),
    adminSettingsConsolidationUiTransform(),
    adminAccordionUiTransform(),
  ]) {
    source = apply(plugin, source, id);
  }
  return source;
}

test("album creation and every album editor use explicit native accordions", async () => {
  const source = await transformed("src/client/AdminApp.jsx");
  assert.match(source, /admin-new-album-accordion/);
  assert.match(source, /<span className="admin-accordion-title">新增相簿<\/span>/);
  assert.match(source, /admin-album-accordion/);
  assert.match(source, /draft\.titleZh \|\| album\.titleZh/);
  assert.match(source, /draft\.titleEn \|\| album\.titleEn/);
  assert.doesNotMatch(source, /admin-new-album-accordion" open/);
  assert.doesNotMatch(source, /admin-album-accordion" open/);
});

test("every category accordion summary shows order, Chinese name, and English name", async () => {
  const source = await transformed("src/client/AdminApp.jsx");
  assert.match(source, /admin-category-accordion/);
  assert.match(source, /String\(category\.displayOrder\)\.padStart\(2, "0"\)/);
  assert.match(source, /draft\.labelZh \|\| category\.labelZh/);
  assert.match(source, /draft\.labelEn \|\| category\.labelEn/);
  assert.match(source, /<ProcessContentEditor processKey=\{category\.id\} \/>/);
  assert.doesNotMatch(source, /admin-category-accordion" open/);
});

test("new photo upload and raw-photo refresh are manual accordions", async () => {
  const [workspace, refresh] = await Promise.all([
    transformed("src/client/AdminPhotoWorkspace.jsx"),
    transformed("src/client/AdminRefreshManagement.jsx"),
  ]);
  assert.match(workspace, /admin-photo-upload-accordion/);
  assert.match(workspace, /<span className="admin-accordion-title">新增照片<\/span>/);
  assert.match(workspace, /files\.length \+ " 張待上傳"/);
  assert.doesNotMatch(workspace, /admin-photo-upload-accordion" open/);

  assert.match(refresh, /<details className="admin-refresh-management admin-accordion admin-refresh-accordion">/);
  assert.match(refresh, /<span className="admin-accordion-title">重新整理原始照片<\/span>/);
  assert.match(refresh, /高風險操作集中區/);
  assert.doesNotMatch(refresh, /admin-refresh-accordion" open/);
});

test("manual accordion styling does not restore automatic height collapse logic", async () => {
  const css = await readFile(path.join(root, "src/client/admin-accordion.css"), "utf8");
  assert.match(css, /\.admin-accordion\[open\]/);
  assert.match(css, /summary::before/);
  assert.doesNotMatch(css, /admin-auto-collapse|admin-auto-collapsed/);
  assert.doesNotMatch(css, /ResizeObserver|MutationObserver|scrollHeight/);
});
