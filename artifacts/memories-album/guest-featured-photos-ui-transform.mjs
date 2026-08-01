const APP_SUFFIX = "/src/client/App.jsx";
const ADMIN_APP_SUFFIX = "/src/client/AdminApp.jsx";

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`Guest featured photos UI transform could not find ${label}`);
  }
  return source.replace(search, replacement);
}

function transformApp(source) {
  let code = replaceOnce(
    source,
    `} from "../guest-label-settings.mjs";`,
    `} from "../guest-label-settings.mjs";\nimport {\n  pageGuestFeaturedPhotos,\n  selectGuestFeaturedPhotoIds,\n  useGuestRandomFeaturedPhotosEnabled,\n} from "./guest-featured-photos.mjs";\nimport "./guest-featured-photos.css";`,
    "guest featured-photo imports",
  );

  code = replaceOnce(
    code,
    `  const guestLatestPhotoCount =\n    initialPublicBootstrap.settings.guestLatestPhotoCount;`,
    `  const guestLatestPhotoCount =\n    initialPublicBootstrap.settings.guestLatestPhotoCount;\n  const guestRandomFeaturedPhotosEnabled =\n    useGuestRandomFeaturedPhotosEnabled();`,
    "guest featured-photo setting hook",
  );

  code = replaceOnce(
    code,
    `  const visible = useMemo(\n    () => pagePhotos(regularFiltered, pageSize, 0).items,\n    [regularFiltered, pageSize],\n  );`,
    `  const guestFeaturedPhotoIds = useMemo(\n    () =>\n      selectGuestFeaturedPhotoIds(regularFiltered, {\n        activeCollection,\n        activeFilter: effectiveFilter,\n        enabled: guestRandomFeaturedPhotosEnabled,\n      }),\n    [\n      regularFiltered,\n      activeCollection,\n      effectiveFilter,\n      guestRandomFeaturedPhotosEnabled,\n    ],\n  );\n  const visible = useMemo(\n    () =>\n      pageGuestFeaturedPhotos(\n        regularFiltered,\n        pageSize,\n        guestFeaturedPhotoIds,\n      ),\n    [regularFiltered, pageSize, guestFeaturedPhotoIds],\n  );`,
    "guest featured-photo paging",
  );

  return code;
}

function transformAdmin(source) {
  let code = replaceOnce(
    source,
    `import GuestLabelSettings from "./GuestLabelSettings.jsx";`,
    `import GuestLabelSettings from "./GuestLabelSettings.jsx";\nimport GuestFeaturedPhotoSettings from "./GuestFeaturedPhotoSettings.jsx";`,
    "guest featured-photo administrator import",
  );

  code = replaceOnce(
    code,
    `              <GuestLabelSettings />`,
    `              <GuestLabelSettings />\n              <GuestFeaturedPhotoSettings />`,
    "guest featured-photo administrator control",
  );
  return code;
}

export function guestFeaturedPhotosUiTransform() {
  return {
    name: "guest-featured-photos-ui",
    enforce: "pre",
    transform(source, id) {
      const normalizedId = id.split("?")[0].replace(/\\/g, "/");
      if (normalizedId.endsWith(APP_SUFFIX)) {
        return { code: transformApp(source), map: null };
      }
      if (normalizedId.endsWith(ADMIN_APP_SUFFIX)) {
        return { code: transformAdmin(source), map: null };
      }
      return null;
    },
  };
}
