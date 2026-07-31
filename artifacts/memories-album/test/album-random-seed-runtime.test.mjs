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
import { publicBootstrapUiTransform } from "../public-bootstrap-ui-transform.mjs";
import { publicLayoutPolishUiTransform } from "../public-layout-polish-ui-transform.mjs";
import { stableIdentityRoutesUiTransform } from "../stable-identity-routes-ui-transform.mjs";
import { uploadSettingsUiTransform } from "../upload-settings-ui-transform.mjs";
import { websiteCopyUiTransform } from "../website-copy-ui-transform.mjs";

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
    adminPreviewPaginationUiTransform(),
    adminSettingsConsolidationUiTransform(),
    adminAccordionUiTransform(),
    publicLayoutPolishUiTransform(),
    publicBootstrapUiTransform(),
    guestLabelsUiTransform(),
    uploadSettingsUiTransform(),
    stableIdentityRoutesUiTransform(),
  ];
}

test("final production gallery keeps its random seed declaration beside album sorting", async () => {
  const id = "/workspace/src/client/App.jsx";
  let source = await readFile(new URL("../src/client/App.jsx", import.meta.url), "utf8");
  for (const plugin of productionTransforms()) source = run(plugin, source, id);

  const declaration = source.indexOf("const [albumRandomSeed] = useState(");
  const sorter = source.indexOf("sortAlbumPhotosWithinMediaOrder(");
  const seedArgument = source.indexOf("albumRandomSeed,", sorter);

  assert.ok(declaration >= 0, "the generated App must declare its random seed");
  assert.ok(sorter > declaration, "album sorting must follow the seed declaration");
  assert.ok(seedArgument > sorter, "album sorting must receive the declared seed");
  assert.doesNotMatch(
    source,
    /albumRandomSeedRef/,
    "the removed transform-fragile ref must not survive in generated code",
  );
});
