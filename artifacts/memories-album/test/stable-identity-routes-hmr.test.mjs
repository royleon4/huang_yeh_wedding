import assert from "node:assert/strict";
import test from "node:test";
import { stableIdentityRoutesSafeUiTransform } from "../stable-identity-routes-safe-ui-transform.mjs";

test("public stable route transform is a no-op when Vite HMR re-enters transformed App code", () => {
  const plugin = stableIdentityRoutesSafeUiTransform();
  const source = `
import { publicModalPath } from "./route-state.mjs";
import {
  readStablePublicRoute,
  stableFilterIdFromLabelKey,
  stablePublicGalleryPath,
  stableRouteLabelKey,
} from "./stable-route-state.mjs";
const initialRoute = readStablePublicRoute(window.location.pathname);
`;

  assert.equal(
    plugin.transform(source, "/workspace/src/client/App.jsx?t=123456"),
    null,
  );
});

test("administrator stable route transform is a no-op after HMR re-entry", () => {
  const plugin = stableIdentityRoutesSafeUiTransform();
  const source = `
import {
  stableAdminTabPath as adminTabPath,
  readStableAdminTab as readAdminTab,
} from "./stable-route-state.mjs";
`;

  assert.equal(
    plugin.transform(source, "/workspace/src/client/AdminApp.jsx?t=123456"),
    null,
  );
});
