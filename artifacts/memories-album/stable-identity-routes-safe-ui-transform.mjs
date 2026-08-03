import { stableIdentityRoutesUiTransform } from "./stable-identity-routes-ui-transform.mjs";

const APP_SUFFIX = "/src/client/App.jsx";
const ADMIN_APP_SUFFIX = "/src/client/AdminApp.jsx";

function normalizedModuleId(id) {
  return id.split("?")[0].replace(/\\/g, "/");
}

function alreadyHasStablePublicRoutes(source) {
  return (
    source.includes(`from "./stable-route-state.mjs";`) &&
    source.includes("readStablePublicRoute") &&
    source.includes("stablePublicGalleryPath")
  );
}

function alreadyHasStableAdminRoutes(source) {
  return (
    source.includes(`from "./stable-route-state.mjs";`) &&
    source.includes("stableAdminTabPath as adminTabPath") &&
    source.includes("readStableAdminTab as readAdminTab")
  );
}

export function stableIdentityRoutesSafeUiTransform() {
  const delegate = stableIdentityRoutesUiTransform();

  return {
    ...delegate,
    name: "stable-identity-routes-safe-ui",
    transform(source, id) {
      const normalizedId = normalizedModuleId(id);

      if (
        normalizedId.endsWith(APP_SUFFIX) &&
        alreadyHasStablePublicRoutes(source)
      ) {
        return null;
      }

      if (
        normalizedId.endsWith(ADMIN_APP_SUFFIX) &&
        alreadyHasStableAdminRoutes(source)
      ) {
        return null;
      }

      return delegate.transform(source, id);
    },
  };
}
