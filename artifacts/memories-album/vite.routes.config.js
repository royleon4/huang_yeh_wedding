import { defineConfig } from "vite";
import baseConfig from "./vite.config.js";
import { logicalRouteUiTransform } from "./logical-route-ui-transform.mjs";
import { websiteCopyUiTransform } from "./website-copy-ui-transform.mjs";
import { adminPreviewPaginationUiTransform } from "./admin-preview-pagination-ui-transform.mjs";
import { adminSettingsConsolidationUiTransform } from "./admin-settings-consolidation-ui-transform.mjs";
import { adminAccordionUiTransform } from "./admin-accordion-ui-transform.mjs";
import { publicLayoutPolishUiTransform } from "./public-layout-polish-ui-transform.mjs";
import { publicBootstrapUiTransform } from "./public-bootstrap-ui-transform.mjs";
import { guestLabelsUiTransform } from "./guest-labels-ui-transform.mjs";
import { guestFeaturedPhotosUiTransform } from "./guest-featured-photos-ui-transform.mjs";
import { uploadSettingsUiTransform } from "./upload-settings-ui-transform.mjs";
import { messageAlbumUiTransform } from "./message-album-ui-transform.mjs";
import { stableIdentityRoutesUiTransform } from "./stable-identity-routes-ui-transform.mjs";

const basePlugins = (baseConfig.plugins ?? []).flat(Infinity);

const reactPlugins = basePlugins.filter((plugin) =>
  String(plugin?.name ?? "").startsWith("vite:react"),
);

const nonReactBasePlugins = basePlugins.filter(
  (plugin) => !String(plugin?.name ?? "").startsWith("vite:react"),
);

export default defineConfig({
  ...baseConfig,
  plugins: [
    ...nonReactBasePlugins,
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
    ...reactPlugins,
    stableIdentityRoutesUiTransform(),
  ],
});
