const APP_SUFFIX = "/src/client/App.jsx";
const ADMIN_APP_SUFFIX = "/src/client/AdminApp.jsx";

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`Album featured photos UI transform could not find ${label}`);
  }
  return source.replace(search, replacement);
}

function transformApp(source) {
  let code = replaceOnce(
    source,
    `} from "../guest-label-settings.mjs";`,
    `} from "../guest-label-settings.mjs";\nimport {\n  createFeaturedPhotoSelectionSession,\n  pageFeaturedPhotos,\n} from "./guest-featured-photos.mjs";\nimport "./guest-featured-photos.css";\n\nconst featuredPhotoSelectionSession =\n  createFeaturedPhotoSelectionSession();`,
    "album featured-photo imports",
  );

  code = replaceOnce(
    code,
    `  const visible = useMemo(\n    () => pagePhotos(regularFiltered, pageSize, 0).items,\n    [regularFiltered, pageSize],\n  );`,
    `  const featuredAlbumDefinition =\n    albums.find((album) => album.id === activeCollection) ?? albums[0];\n  const featuredPhotoIds = useMemo(\n    () =>\n      featuredPhotoSelectionSession.select(regularFiltered, {\n        activeCollection,\n        activeFilter: effectiveFilter,\n        enabled: featuredAlbumDefinition?.featuredPhotosEnabled === true,\n        minimum: Number(featuredAlbumDefinition?.featuredPhotoMin ?? 1),\n        maximum: Number(featuredAlbumDefinition?.featuredPhotoMax ?? 3),\n      }),\n    [\n      regularFiltered,\n      activeCollection,\n      effectiveFilter,\n      featuredAlbumDefinition?.featuredPhotosEnabled,\n      featuredAlbumDefinition?.featuredPhotoMin,\n      featuredAlbumDefinition?.featuredPhotoMax,\n    ],\n  );\n  const visible = useMemo(\n    () => pageFeaturedPhotos(regularFiltered, pageSize, featuredPhotoIds),\n    [regularFiltered, pageSize, featuredPhotoIds],\n  );`,
    "album featured-photo paging",
  );

  return code;
}

function transformAdmin(source) {
  let code = replaceOnce(
    source,
    `      <div className="admin-card-actions">`,
    `      <section className="album-featured-setting" aria-label="隨機置頂照片設定">\n        <label className="admin-check">\n          <input\n            type="checkbox"\n            checked={draft.featuredPhotosEnabled === true}\n            onChange={(event) =>\n              onChange({ featuredPhotosEnabled: event.target.checked })\n            }\n            disabled={busy}\n          />\n          啟用隨機置頂照片\n        </label>\n        <div className="album-featured-range">\n          <label>\n            最少張數\n            <input\n              type="number"\n              min="0"\n              step="1"\n              inputMode="numeric"\n              value={draft.featuredPhotoMin}\n              onChange={(event) =>\n                onChange({ featuredPhotoMin: Number(event.target.value) })\n              }\n              disabled={busy}\n            />\n          </label>\n          <label>\n            最多張數\n            <input\n              type="number"\n              min="0"\n              step="1"\n              inputMode="numeric"\n              value={draft.featuredPhotoMax}\n              onChange={(event) =>\n                onChange({ featuredPhotoMax: Number(event.target.value) })\n              }\n              disabled={busy}\n            />\n          </label>\n        </div>\n        <small>只能輸入非負整數，且最多張數不得小於最少張數，例如 1～4、2～6 或 0～3。此設定套用於本相簿內的所有標籤。</small>\n      </section>\n      <div className="admin-card-actions">`,
    "per-album featured-photo controls",
  );

  code = replaceOnce(
    code,
    `import "./admin-save-bar.css";`,
    `import "./admin-save-bar.css";\nimport "./guest-featured-photos.css";`,
    "album featured-photo styles",
  );

  return code;
}

export function guestFeaturedPhotosUiTransform() {
  return {
    name: "album-featured-photos-ui",
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
