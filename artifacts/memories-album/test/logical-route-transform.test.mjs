import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { adminPhotoUploaderUiTransform } from "../admin-photo-uploader-ui-transform.mjs";
import { processContentUiTransform } from "../process-content-ui-transform.mjs";
import { adminPhotoWorkspaceUiTransform } from "../admin-photo-workspace-ui-transform.mjs";
import { logicalRouteUiTransform } from "../logical-route-ui-transform.mjs";

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
  ]) {
    source = apply(plugin, source, id);
  }
  return source;
}

test("final public gallery output is driven by URL state", async () => {
  const source = await transformed("src/client/App.jsx");
  assert.match(source, /readPublicRoute\(window\.location\.pathname\)/);
  assert.match(source, /publicGalleryPath\(\{/);
  assert.match(source, /window\.addEventListener\("popstate", syncFromLocation\)/);
  assert.match(source, /openPhotoRoute\(photo\.id\)/);
  assert.doesNotMatch(source, /setSelectedPhotoId\(photo\.id\);/);
  assert.match(source, /onUpload=\{\(\) => openModalRoute\("upload"\)\}/);
});

test("final administrator output gives every generated tab a deep link", async () => {
  const source = await transformed("src/client/AdminApp.jsx");
  assert.match(source, /readAdminTab\(window\.location\.pathname\)/);
  assert.match(source, /chooseAdminTab\(id\)/);
  assert.match(source, /\["general", "通用"\]/);
  assert.match(source, /\["subcategory-ui", "子分類操作"\]/);
  assert.match(source, /window\.addEventListener\("popstate", syncAdminTab\)/);
});

test("entry point selects administrator surface for deep admin URLs", async () => {
  const source = await transformed("src/client/main.jsx");
  assert.match(source, /import \{ routeSurface \} from "\.\/route-state\.mjs";/);
  assert.match(source, /routeSurface\(window\.location\.pathname\)/);
  assert.doesNotMatch(source, /adminSurface\(window\.location\.pathname\)/);
});
