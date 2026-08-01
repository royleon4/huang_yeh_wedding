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
    `} from "../guest-label-settings.mjs";\nimport {\n  pageGuestFeaturedPhotos,\n  selectGuestFeaturedPhotoIds,\n  useGuestRandomFeaturedPhotosSettings,\n} from "./guest-featured-photos.mjs";\nimport "./guest-featured-photos.css";`,
    "guest featured-photo imports",
  );

  code = replaceOnce(
    code,
    `  const guestLatestPhotoCount =\n    initialPublicBootstrap.settings.guestLatestPhotoCount;`,
    `  const guestLatestPhotoCount =\n    initialPublicBootstrap.settings.guestLatestPhotoCount;\n  const guestFeaturedPhotoSettings =\n    useGuestRandomFeaturedPhotosSettings();`,
    "guest featured-photo setting hook",
  );

  code = replaceOnce(
    code,
    `      selectGuestFeaturedPhotoIds(regularFiltered, {\n        activeCollection,\n        activeFilter: effectiveFilter,\n        enabled: guestRandomFeaturedPhotosEnabled,\n      }),`,
    `      selectGuestFeaturedPhotoIds(regularFiltered, {\n        activeCollection,\n        activeFilter: effectiveFilter,\n        enabled: guestFeaturedPhotoSettings.enabled,\n        minimum: guestFeaturedPhotoSettings.minimum,\n        maximum: guestFeaturedPhotoSettings.maximum,\n      }),`,
    "guest featured-photo range",
  );

  code = replaceOnce(
    code,
    `      guestRandomFeaturedPhotosEnabled,\n`,
    `      guestFeaturedPhotoSettings.enabled,\n      guestFeaturedPhotoSettings.minimum,\n      guestFeaturedPhotoSettings.maximum,\n`,
    "guest featured-photo dependencies",
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
