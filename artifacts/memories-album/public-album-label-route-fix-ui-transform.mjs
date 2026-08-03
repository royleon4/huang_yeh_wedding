const APP_SUFFIX = "/src/client/App.jsx";

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`Public album label route fix could not find ${label}`);
  }
  return source.replace(search, replacement);
}

function transformApp(source) {
  let code = replaceOnce(
    source,
    `  const subgroupItemsFor = (collectionId) => {\n    if (collectionId === "wedding") return processes;\n    if (collectionId !== "guest") return [];\n    return guestLabelRouteItems(guestLabelVisibility, guestGroups);\n  };`,
    `  const subgroupItemsFor = (collectionId) => {\n    if (collectionId === "guest") {\n      return guestLabelRouteItems(guestLabelVisibility, guestGroups);\n    }\n    return labelsForAlbum(processes, collectionId);\n  };`,
    "stable route subgroup resolver",
  );

  code = replaceOnce(
    code,
    `            <ProcessSelector\n              language={lang}\n              ariaLabel={activeCollectionDefinition?.[lang] ?? t.categories}`,
    `            <ProcessSelector\n              language={lang}\n              albumId={activeCollection}\n              ariaLabel={activeCollectionDefinition?.[lang] ?? t.categories}`,
    "album-owned label selector",
  );

  return code;
}

export function publicAlbumLabelRouteFixUiTransform() {
  return {
    name: "public-album-label-route-fix-ui",
    enforce: "pre",
    transform(source, id) {
      const normalizedId = id.split("?")[0].replace(/\\/g, "/");
      if (!normalizedId.endsWith(APP_SUFFIX)) return null;
      return { code: transformApp(source), map: null };
    },
  };
}
