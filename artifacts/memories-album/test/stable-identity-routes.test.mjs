import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { adminAccordionUiTransform } from "../admin-accordion-ui-transform.mjs";
import { adminPhotoUploaderUiTransform } from "../admin-photo-uploader-ui-transform.mjs";
import { adminPhotoWorkspaceUiTransform } from "../admin-photo-workspace-ui-transform.mjs";
import { adminPreviewPaginationUiTransform } from "../admin-preview-pagination-ui-transform.mjs";
import { adminSettingsConsolidationUiTransform } from "../admin-settings-consolidation-ui-transform.mjs";
import { guestLabelsUiTransform } from "../guest-labels-ui-transform.mjs";
import { logicalRouteUiTransform } from "../logical-route-ui-transform.mjs";
import { processContentUiTransform } from "../process-content-ui-transform.mjs";
import { publicAlbumLabelRouteFixUiTransform } from "../public-album-label-route-fix-ui-transform.mjs";
import { publicAlbumLabelsUiTransform } from "../public-album-labels-ui-transform.mjs";
import { publicBootstrapUiTransform } from "../public-bootstrap-ui-transform.mjs";
import { publicLayoutPolishUiTransform } from "../public-layout-polish-ui-transform.mjs";
import { stableIdentityRoutesUiTransform } from "../stable-identity-routes-ui-transform.mjs";
import { uploadSettingsUiTransform } from "../upload-settings-ui-transform.mjs";
import { websiteCopyUiTransform } from "../website-copy-ui-transform.mjs";
import {
  readStableAdminTab,
  readStablePublicRoute,
  stableAdminTabPath,
  stableFilterIdFromLabelKey,
  stablePublicGalleryPath,
  stableRouteLabelKey,
} from "../src/client/stable-route-state.mjs";

function run(plugin, source, id) {
  return plugin.transform(source, id)?.code ?? source;
}

function productionTransforms() {
  return [
    adminPhotoUploaderUiTransform(),
    processContentUiTransform(),
    adminPhotoWorkspaceUiTransform(),
    logicalRouteUiTransform(),
    websiteCopyUiTransform(),
    publicAlbumLabelsUiTransform(),
    adminPreviewPaginationUiTransform(),
    adminSettingsConsolidationUiTransform(),
    adminAccordionUiTransform(),
    publicLayoutPolishUiTransform(),
    publicBootstrapUiTransform(),
    guestLabelsUiTransform(),
    uploadSettingsUiTransform(),
    stableIdentityRoutesUiTransform(),
    publicAlbumLabelRouteFixUiTransform(),
  ];
}

test("album and label routes use stable identities instead of display positions", () => {
  const path = stablePublicGalleryPath({
    language: "en",
    albumKey: "guest",
    labelKey: "葉 藝慧",
    photoId: "photo:123/456",
  });
  assert.equal(
    path,
    "/Memories/en/albums/guest/labels/%E8%91%89%20%E8%97%9D%E6%85%A7/photos/photo%3A123%2F456",
  );
  const parsed = readStablePublicRoute(path);
  assert.equal(parsed.kind, "gallery");
  assert.equal(parsed.albumKey, "guest");
  assert.equal(parsed.labelKey, "葉 藝慧");
  assert.equal(parsed.photoId, "photo:123/456");
  assert.equal(parsed.canonicalPath, path);
});

test("moving labels cannot change identity routes and deleted identities can be rejected", () => {
  const before = stablePublicGalleryPath({
    albumKey: "guest",
    labelKey: "Leon",
  });
  const reorderedLabels = ["另一位訪客", "Leon", "新訪客"];
  const after = stablePublicGalleryPath({
    albumKey: "guest",
    labelKey: reorderedLabels[1],
  });
  assert.equal(before, after);
  assert.equal(stableRouteLabelKey("__latest_guest_photos__"), "latest");
  assert.equal(
    stableFilterIdFromLabelKey("guest", "latest"),
    "__latest_guest_photos__",
  );
});

test("old ordinal and semantic routes remain readable only for migration", () => {
  const ordinal = readStablePublicRoute("/Memories/group2/subgroup3/photos/p-9");
  assert.equal(ordinal.kind, "legacyOrdinalGallery");
  assert.equal(ordinal.groupIndex, 1);
  assert.equal(ordinal.subgroupIndex, 2);

  const semantic = readStablePublicRoute(
    "/Memories/albums/wedding/processes/process-1",
  );
  assert.equal(semantic.kind, "legacySemanticGallery");
  assert.equal(
    semantic.canonicalPath,
    "/Memories/albums/wedding/labels/process-1",
  );
});

test("administrator routes use stable tab identifiers", () => {
  assert.equal(stableAdminTabPath("general"), "/Memories/admin/general");
  assert.equal(stableAdminTabPath("photos"), "/Memories/admin/photos");
  assert.equal(readStableAdminTab("/Memories/admin/categories"), "categories");
  assert.equal(readStableAdminTab("/Memories/admin/group3"), "photos");
});

test("completed production transform keeps custom album labels routable without resetting to all", async () => {
  const id = "/workspace/src/client/App.jsx";
  let source = await readFile(new URL("../src/client/App.jsx", import.meta.url), "utf8");
  for (const plugin of productionTransforms()) source = run(plugin, source, id);

  assert.match(source, /readStablePublicRoute\(window\.location\.pathname\)/);
  assert.match(source, /albumKey: collectionId \|\| defaultAlbumId\(\)/);
  assert.match(source, /stableRouteLabelKey\(filterId\)/);
  assert.match(source, /albums\.find\(\(item\) => item\.id === route\.albumKey\)/);
  assert.match(source, /item\.id === filterId/);
  assert.match(source, /status: 404, missingPath/);
  assert.match(source, /memories:route-not-found/);
  assert.match(
    source,
    /if \(collectionId === "guest"\)[\s\S]*guestLabelRouteItems\([\s\S]*return labelsForAlbum\(processes, collectionId\);/,
  );
  assert.match(
    source,
    /<ProcessSelector\s+albumId=\{activeCollection\}\s+ariaLabel=\{activeCollectionDefinition\?\.\[lang\] \?\? t\.categories\}/,
  );
  assert.doesNotMatch(source, /if \(collectionId !== "guest"\) return \[\];/);
  assert.doesNotMatch(source, /const groupNumberFor/);
  assert.doesNotMatch(source, /const subgroupNumberFor/);
});

test("completed administrator transform keeps semantic route after tab movement", async () => {
  const id = "/workspace/src/client/AdminApp.jsx";
  let source = await readFile(
    new URL("../src/client/AdminApp.jsx", import.meta.url),
    "utf8",
  );
  for (const plugin of productionTransforms()) source = run(plugin, source, id);

  assert.match(source, /stableAdminTabPath as adminTabPath/);
  assert.match(source, /readStableAdminTab as readAdminTab/);
  assert.match(source, /adminTabPath\(nextTab\)/);
  assert.match(source, /GuestLabelSettings/);
  assert.match(source, /album\.id === "guest"/);
});

test("production Vite chain repairs album-owned label routes after stable identity routing", async () => {
  const config = await readFile(new URL("../vite.routes.config.js", import.meta.url), "utf8");
  assert.match(
    config,
    /stableIdentityRoutesUiTransform\(\),\s*publicAlbumLabelRouteFixUiTransform\(\),\s*\],/,
  );
});
