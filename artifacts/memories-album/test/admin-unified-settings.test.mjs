import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { adminPhotoUploaderUiTransform } from "../admin-photo-uploader-ui-transform.mjs";
import { adminPhotoWorkspaceUiTransform } from "../admin-photo-workspace-ui-transform.mjs";
import { adminPreviewPaginationUiTransform } from "../admin-preview-pagination-ui-transform.mjs";
import { adminSettingsConsolidationUiTransform } from "../admin-settings-consolidation-ui-transform.mjs";
import { logicalRouteUiTransform } from "../logical-route-ui-transform.mjs";
import { processContentUiTransform } from "../process-content-ui-transform.mjs";
import { websiteCopyUiTransform } from "../website-copy-ui-transform.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "..");

function apply(plugin, source, id) {
  const result = plugin.transform(source, id);
  return result?.code ?? source;
}

async function transformedAdmin() {
  const id = path.join(root, "src/client/AdminApp.jsx");
  let source = await readFile(id, "utf8");
  for (const plugin of [
    adminPhotoUploaderUiTransform(),
    processContentUiTransform(),
    adminPhotoWorkspaceUiTransform(),
    logicalRouteUiTransform(),
    websiteCopyUiTransform(),
    adminPreviewPaginationUiTransform(),
    adminSettingsConsolidationUiTransform(),
  ]) {
    source = apply(plugin, source, id);
  }
  return source;
}

async function clientSource(name) {
  return readFile(path.join(root, "src/client", name), "utf8");
}

test("all ordinary administrator settings participate in the single save-all action", async () => {
  const admin = await transformedAdmin();
  assert.match(admin, /useAdminSettingsPendingCount\(\)/);
  assert.match(
    admin,
    /const pendingCount = entityPendingCount \+ generalSettingsPendingCount/,
  );
  assert.match(admin, /await saveRegisteredAdminSettings\(\)/);
  assert.match(admin, /settingsResult\.failures/);
  assert.equal((admin.match(/儲存所有變更/g) ?? []).length, 1);

  const components = await Promise.all([
    clientSource("WebsiteCopySettings.jsx"),
    clientSource("DriveUploadModeSettings.jsx"),
    clientSource("GalleryMediaOrderSettings.jsx"),
    clientSource("ProcessSelectorSettings.jsx"),
    clientSource("AdminFeatureSettings.jsx"),
  ]);
  for (const source of components) {
    assert.match(source, /useAdminSaveSection\(/);
    assert.doesNotMatch(
      source,
      /儲存網站文字|儲存上傳模式|儲存顯示順序|套用操作方式|>\s*儲存設定\s*</,
    );
  }

  assert.match(components[0], /body: \{ siteCopy: draft \}/);
  assert.match(components[1], /body: \{ driveUploadMode: draftMode \}/);
  assert.match(components[2], /body: \{ galleryMediaOrder: draftOrder \}/);
  assert.match(components[3], /processWheelEnabled: draftMode === "wheel"/);
  assert.match(components[3], /processWheelVisibleCount: draftVisibleCount/);
  assert.match(
    components[4],
    /body: \{ guestUploadCategorySelectionEnabled: draft \}/,
  );
});

test("subcategory controls live inside General while category and video saves remain separate", async () => {
  const [admin, general, categoryEditor] = await Promise.all([
    transformedAdmin(),
    clientSource("GeneralSettings.jsx"),
    clientSource("ProcessContentEditor.jsx"),
  ]);
  assert.match(general, /<ProcessSelectorSettings \/>/);
  assert.doesNotMatch(admin, /\["subcategory-ui", "子分類操作"\]/);
  assert.doesNotMatch(admin, /tab === "subcategory-ui"/);
  assert.match(admin, /hidden=\{tab !== "general"\}/);
  assert.match(categoryEditor, /const save = async \(\) =>/);
  assert.match(categoryEditor, /\/admin\/api\/process-content/);
});

test("administrator cards share a full-width contract and tall non-General cards collapse at twice the Drive card height", async () => {
  const [admin, manager, css] = await Promise.all([
    transformedAdmin(),
    clientSource("AdminAutoCollapseManager.jsx"),
    clientSource("admin-unified-layout.css"),
  ]);
  assert.match(admin, /<AdminAutoCollapseManager \/>/);
  assert.match(manager, /drive-upload-mode-title/);
  assert.match(manager, /const collapseHeight = referenceHeight \* 2/);
  assert.match(manager, /card\.scrollHeight > collapseHeight \+ 1/);
  assert.match(manager, /card\.closest\("\.general-settings"\)/);
  assert.match(manager, /removeToggle\(card\);\s*continue;/);
  assert.match(manager, /展開編輯/);
  assert.match(manager, /收合卡片/);
  assert.match(css, /\.general-setting-card,[\s\S]*width: 100% !important/);
  assert.match(css, /max-height: var\(--admin-card-collapse-height\) !important/);
  assert.match(css, /\.admin-general-panel\[hidden\]/);
});
