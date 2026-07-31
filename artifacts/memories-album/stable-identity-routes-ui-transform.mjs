const APP_SUFFIX = "/src/client/App.jsx";
const ADMIN_APP_SUFFIX = "/src/client/AdminApp.jsx";

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`Stable identity route transform could not find ${label}`);
  }
  return source.replace(search, replacement);
}

function replaceRange(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) {
    throw new Error(`Stable identity route transform could not find ${label}`);
  }
  return `${source.slice(0, start)}${replacement}${source.slice(end)}`;
}

function transformApp(source) {
  let code = replaceOnce(
    source,
    `import {\n  publicGalleryPath,\n  publicModalPath,\n  readPublicRoute,\n} from "./route-state.mjs";`,
    `import { publicModalPath } from "./route-state.mjs";\nimport {\n  readStablePublicRoute,\n  stableFilterIdFromLabelKey,\n  stablePublicGalleryPath,\n  stableRouteLabelKey,\n} from "./stable-route-state.mjs";`,
    "public route imports",
  );

  code = replaceOnce(
    code,
    `const initialRoute = readPublicRoute(window.location.pathname);`,
    `const initialRoute = readStablePublicRoute(window.location.pathname);`,
    "initial stable route",
  );

  code = replaceOnce(
    code,
    `initialPublicBootstrap.albums[initialRoute.groupIndex]?.id || "wedding"`,
    `initialRoute.albumKey ||\n      initialPublicBootstrap.albums[initialRoute.groupIndex]?.id ||\n      initialPublicBootstrap.albums[0]?.id ||\n      "wedding"`,
    "identity-backed initial album",
  );

  code = replaceOnce(
    code,
    `  const [activeFilter, setActiveFilter] = useState("all");`,
    `  const [activeFilter, setActiveFilter] = useState(() =>\n    initialRoute.labelKey\n      ? stableFilterIdFromLabelKey(initialRoute.albumKey, initialRoute.labelKey)\n      : "all",\n  );`,
    "identity-backed initial label",
  );

  const helpers = `  const writePublicPath = (\n    path,\n    { replace = false, state = {} } = {},\n  ) => {\n    const destination = path + window.location.search + window.location.hash;\n    window.history[replace ? "replaceState" : "pushState"](\n      state,\n      "",\n      destination,\n    );\n  };\n\n  const subgroupItemsFor = (collectionId) => {\n    if (collectionId === "wedding") return processes;\n    if (collectionId === "guest" && guestUploaderLabelsVisible) {\n      return [{ id: "__latest_guest_photos__" }, ...guestGroups];\n    }\n    return [];\n  };\n\n  const defaultAlbumId = () => albums[0]?.id || "wedding";\n\n  const currentGalleryPath = ({\n    language = lang,\n    collectionId = activeCollection,\n    filterId = activeFilter,\n    photoId = null,\n  } = {}) =>\n    stablePublicGalleryPath({\n      language,\n      albumKey: collectionId || defaultAlbumId(),\n      labelKey:\n        !filterId || filterId === "all"\n          ? null\n          : stableRouteLabelKey(filterId),\n      photoId,\n    });\n\n  const redirectMissingRoute = (fallbackPath) => {\n    const missingPath = window.location.pathname;\n    window.dispatchEvent(\n      new CustomEvent("memories:route-not-found", {\n        detail: { missingPath, fallbackPath },\n      }),\n    );\n    writePublicPath(fallbackPath, {\n      replace: true,\n      state: { status: 404, missingPath },\n    });\n    return applyPublicRoute(readStablePublicRoute(fallbackPath));\n  };\n\n  const applyPublicRoute = (route) => {\n    const nextLanguage = route.language === "en" ? "en" : "zh";\n    setLang(nextLanguage);\n    localStorage.setItem("memories-language", nextLanguage);\n\n    if (route.kind === "modal") {\n      setModal(route.modal);\n      setSelectedPhotoId(null);\n      return true;\n    }\n\n    if (route.kind === "root") {\n      const canonicalPath = stablePublicGalleryPath({\n        language: nextLanguage,\n        albumKey: defaultAlbumId(),\n      });\n      writePublicPath(canonicalPath, { replace: true });\n      return applyPublicRoute(readStablePublicRoute(canonicalPath));\n    }\n\n    if (route.kind === "legacyOrdinalGallery") {\n      const album = albums[route.groupIndex];\n      if (!album) return false;\n      const subgroup =\n        route.subgroupIndex === null\n          ? null\n          : subgroupItemsFor(album.id)[route.subgroupIndex];\n      if (route.subgroupIndex !== null && !subgroup) return false;\n      const canonicalPath = stablePublicGalleryPath({\n        language: nextLanguage,\n        albumKey: album.id,\n        labelKey: subgroup ? stableRouteLabelKey(subgroup.id) : null,\n        photoId: route.photoId,\n      });\n      writePublicPath(canonicalPath, { replace: true });\n      return applyPublicRoute(readStablePublicRoute(canonicalPath));\n    }\n\n    if (route.kind === "legacySemanticGallery") {\n      writePublicPath(route.canonicalPath, { replace: true });\n      return applyPublicRoute(readStablePublicRoute(route.canonicalPath));\n    }\n\n    if (route.kind !== "gallery") return false;\n    const album = albums.find((item) => item.id === route.albumKey);\n    if (!album) return false;\n    const filterId = route.labelKey\n      ? stableFilterIdFromLabelKey(album.id, route.labelKey)\n      : "all";\n    const subgroup =\n      filterId === "all"\n        ? null\n        : subgroupItemsFor(album.id).find((item) => item.id === filterId);\n    if (filterId !== "all" && !subgroup) return false;\n\n    setActiveCollection(album.id);\n    setActiveFilter(subgroup?.id || "all");\n    setSelectedPhotoId(route.photoId || null);\n    setModal(null);\n    setPageSize(12);\n\n    if (subgroup) {\n      const pathKey = route.canonicalPath;\n      if (lastAnchoredPathRef.current !== pathKey) {\n        lastAnchoredPathRef.current = pathKey;\n        requestGalleryStartScroll();\n      }\n    } else {\n      lastAnchoredPathRef.current = null;\n    }\n    return true;\n  };`;

  code = replaceRange(
    code,
    `  const writePublicPath = (path, { replace = false } = {}) => {`,
    `\n\n  useEffect(() => {`,
    helpers,
    "public route helper block",
  );

  const synchronization = `  useEffect(() => {\n    const syncFromLocation = () => {\n      const route = readStablePublicRoute(window.location.pathname);\n      const applied = applyPublicRoute(route);\n      if (\n        applied &&\n        route.kind === "gallery" &&\n        route.canonicalPath !== window.location.pathname.replace(/\\/+$/, "")\n      ) {\n        writePublicPath(route.canonicalPath, { replace: true });\n      }\n    };\n    syncFromLocation();\n    window.addEventListener("popstate", syncFromLocation);\n    return () => window.removeEventListener("popstate", syncFromLocation);\n  }, [\n    albums,\n    guestGroups,\n    guestUploaderLabelsVisible,\n    processes,\n    remotePhotos,\n    useMockFallback,\n  ]);\n\n  useEffect(() => {\n    if (!albumsResolved || albums.length === 0) return;\n    const route = readStablePublicRoute(window.location.pathname);\n    const defaultPath = stablePublicGalleryPath({\n      language: route.language,\n      albumKey: defaultAlbumId(),\n    });\n\n    if (route.kind === "invalid") {\n      redirectMissingRoute(defaultPath);\n      return;\n    }\n    if (route.kind === "root") {\n      applyPublicRoute(route);\n      return;\n    }\n    if (\n      route.kind === "legacyOrdinalGallery" ||\n      route.kind === "legacySemanticGallery"\n    ) {\n      if (!applyPublicRoute(route)) redirectMissingRoute(defaultPath);\n      return;\n    }\n    if (route.kind !== "gallery") return;\n\n    const album = albums.find((item) => item.id === route.albumKey);\n    if (!album) {\n      redirectMissingRoute(defaultPath);\n      return;\n    }\n\n    const parentPath = stablePublicGalleryPath({\n      language: route.language,\n      albumKey: album.id,\n    });\n    if (route.labelKey) {\n      const subgroupReady =\n        album.id !== "guest" || remotePhotos !== null || useMockFallback;\n      const filterId = stableFilterIdFromLabelKey(album.id, route.labelKey);\n      const subgroup = subgroupItemsFor(album.id).find(\n        (item) => item.id === filterId,\n      );\n      if (subgroupReady && !subgroup) {\n        redirectMissingRoute(parentPath);\n        return;\n      }\n    }\n\n    if (\n      route.photoId &&\n      (remotePhotos !== null || useMockFallback) &&\n      !filtered.some((photo) => photo.id === route.photoId)\n    ) {\n      redirectMissingRoute(\n        stablePublicGalleryPath({\n          language: route.language,\n          albumKey: album.id,\n          labelKey: route.labelKey,\n        }),\n      );\n    }\n  }, [\n    albums,\n    albumsResolved,\n    filtered,\n    guestGroups,\n    guestUploaderLabelsVisible,\n    processes,\n    remotePhotos,\n    useMockFallback,\n  ]);`;

  code = replaceRange(
    code,
    `  useEffect(() => {\n    const syncFromLocation = () => {`,
    `\n\n  const switchLanguage = () => {`,
    synchronization,
    "public route synchronization",
  );

  code = code.replaceAll(
    `readPublicRoute(window.location.pathname)`,
    `readStablePublicRoute(window.location.pathname)`,
  );

  code = replaceOnce(
    code,
    `    writePublicPath(\n      publicGalleryPath({\n        language: lang,\n        groupNumber: groupNumberFor(collectionId),\n      }),\n    );`,
    `    writePublicPath(\n      currentGalleryPath({ collectionId, filterId: "all" }),\n    );`,
    "stable album navigation",
  );

  return code;
}

function transformAdmin(source) {
  return replaceOnce(
    source,
    `import { adminTabPath, readAdminTab } from "./route-state.mjs";`,
    `import {\n  stableAdminTabPath as adminTabPath,\n  readStableAdminTab as readAdminTab,\n} from "./stable-route-state.mjs";`,
    "stable administrator routes",
  );
}

export function stableIdentityRoutesUiTransform() {
  return {
    name: "stable-identity-routes-ui",
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
