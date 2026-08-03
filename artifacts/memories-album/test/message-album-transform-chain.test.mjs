import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { adminPhotoUploaderUiTransform } from "../admin-photo-uploader-ui-transform.mjs";
import { processContentUiTransform } from "../process-content-ui-transform.mjs";
import { adminPhotoWorkspaceUiTransform } from "../admin-photo-workspace-ui-transform.mjs";
import { logicalRouteUiTransform } from "../logical-route-ui-transform.mjs";
import { websiteCopyUiTransform } from "../website-copy-ui-transform.mjs";
import { adminPreviewPaginationUiTransform } from "../admin-preview-pagination-ui-transform.mjs";
import { adminSettingsConsolidationUiTransform } from "../admin-settings-consolidation-ui-transform.mjs";
import { adminAccordionUiTransform } from "../admin-accordion-ui-transform.mjs";
import { publicLayoutPolishUiTransform } from "../public-layout-polish-ui-transform.mjs";
import { publicBootstrapUiTransform } from "../public-bootstrap-ui-transform.mjs";
import { guestLabelsUiTransform } from "../guest-labels-ui-transform.mjs";
import { guestFeaturedPhotosUiTransform } from "../guest-featured-photos-ui-transform.mjs";
import { uploadSettingsUiTransform } from "../upload-settings-ui-transform.mjs";
import { messageAlbumUiTransform } from "../message-album-ui-transform.mjs";
import { stableIdentityRoutesUiTransform } from "../stable-identity-routes-ui-transform.mjs";

const plugins = [
  adminPhotoUploaderUiTransform(),
  processContentUiTransform(),
  adminPhotoWorkspaceUiTransform(),
  logicalRouteUiTransform(),
  websiteCopyUiTransform(),
  adminPreviewPaginationUiTransform(),
  adminSettingsConsolidationUiTransform(),
  adminAccordionUiTransform(),
  publicLayoutPolishUiTransform(),
  publicBootstrapUiTransform(),
  guestLabelsUiTransform(),
  guestFeaturedPhotosUiTransform(),
  uploadSettingsUiTransform(),
  messageAlbumUiTransform(),
  stableIdentityRoutesUiTransform(),
];

async function transformed(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  let code = await readFile(url, "utf8");
  for (const plugin of plugins) {
    const result = await plugin.transform?.(code, url.pathname);
    if (result?.code) code = result.code;
  }
  return code;
}

test("public production transform renders a message album before photo state", async () => {
  const code = await transformed("../src/client/App.jsx");
  assert.match(code, /import MessageAlbum from "\.\/MessageAlbum\.jsx"/);
  assert.match(code, /activeCollectionDefinition\?\.albumType === "message"/);
  assert.match(code, /isMessageAlbum \? \(/);
  assert.match(code, /<MessageAlbum/);
  assert.match(code, /!isMessageAlbum && \(/);
});

test("administrator production transform exposes album types and the import panel", async () => {
  const code = await transformed("../src/client/AdminApp.jsx");
  assert.match(code, /import AdminMessagesPanel from "\.\/AdminMessagesPanel\.jsx"/);
  assert.match(code, /albumType: "album"/);
  assert.match(code, /相簿 \/ Album/);
  assert.match(code, /留言 \/ Message/);
  assert.match(code, /網誌 \/ Blog/);
  assert.match(code, /album\.albumType === "message"/);
  assert.match(code, /<AdminMessagesPanel/);
});
