import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { adminPhotoUploaderUiTransform } from "../admin-photo-uploader-ui-transform.mjs";
import { adminPhotoWorkspaceUiTransform } from "../admin-photo-workspace-ui-transform.mjs";
import { processContentUiTransform } from "../process-content-ui-transform.mjs";

test("admin photo workspace reuses the guest batch uploader without timestamp metadata", async () => {
  const source = await readFile(
    new URL("../src/client/AdminPhotoWorkspace.jsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /uploadQueue/);
  assert.match(source, /retryFailedUploads/);
  assert.match(source, /type="file"[\s\S]*multiple/);
  assert.match(source, /上傳者／作者/);
  assert.match(source, /所屬相簿/);
  assert.match(source, /子分類（標籤）/);
  assert.match(source, /albumId/);
  assert.match(source, /categoryId/);
  assert.match(source, /uploaderNameFilter/);
  assert.doesNotMatch(source, /capturedAt/);
  assert.doesNotMatch(source, /displayName/);
});

test("admin transforms replace only the old add-photo tab and preserve photo editing", async () => {
  const source = await readFile(
    new URL("../src/client/AdminApp.jsx", import.meta.url),
    "utf8",
  );
  const id = "/workspace/src/client/AdminApp.jsx";
  let code = adminPhotoUploaderUiTransform().transform(source, id).code;
  code = processContentUiTransform().transform(code, id).code;
  code = adminPhotoWorkspaceUiTransform().transform(code, id).code;

  assert.match(code, /import AdminPhotoWorkspace/);
  assert.match(code, /<AdminPhotoWorkspace/);
  assert.match(
    code,
    /renderPhoto=\{\(\s*photo,\s*photoBusy = false,\s*photoLabels = orderedCategories,\s*\) =>/,
  );
  assert.match(code, /categories=\{photoLabels\}/);
  assert.match(code, /setPhotoDrafts=\{setPhotoDrafts\}/);
  assert.match(code, /<PhotoEditor/);
  assert.match(code, /mergeAdminPhotos\(current, photoData\.photos\)/);
  assert.match(code, /deletion\.deletedIds/);
  assert.match(code, /所有位置都會一起刪除/);
  assert.match(code, /deletedIds\.has\(item\.id\)/);
  assert.doesNotMatch(code, /value=\{upload\.displayName\}/);
  assert.doesNotMatch(code, /value=\{upload\.capturedAt\}/);
});
