import { defineConfig } from "vite";
import baseConfig from "./vite.config.js";
import { logicalRouteUiTransform } from "./logical-route-ui-transform.mjs";
import { websiteCopyUiTransform } from "./website-copy-ui-transform.mjs";
import { adminPreviewPaginationUiTransform } from "./admin-preview-pagination-ui-transform.mjs";
import { adminSettingsConsolidationUiTransform } from "./admin-settings-consolidation-ui-transform.mjs";

export default defineConfig({
  ...baseConfig,
  plugins: [
    ...(baseConfig.plugins ?? []),
    logicalRouteUiTransform(),
    websiteCopyUiTransform(),
    adminPreviewPaginationUiTransform(),
    adminSettingsConsolidationUiTransform(),
  ],
});
