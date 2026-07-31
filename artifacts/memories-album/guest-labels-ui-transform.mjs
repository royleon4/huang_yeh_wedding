const APP_SUFFIX = "/src/client/App.jsx";

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`Guest labels UI transform could not find ${label}`);
  }
  return source.replace(search, replacement);
}

function transformApp(source) {
  let code = replaceOnce(
    source,
    `  filterPhotos,\n  guestUploaderGroups,`,
    `  filterPhotos,\n  guestUploaderGroups,\n  LATEST_GUEST_FILTER_ID,`,
    "guest gallery model imports",
  );

  code = replaceOnce(
    code,
    `  const initialPublicBootstrap = getPublicBootstrap();\n  const [albums] = useState(() => initialPublicBootstrap.albums);\n  const albumsResolved = true;`,
    `  const initialPublicBootstrap = getPublicBootstrap();\n  const guestUploaderLabelsVisible =\n    initialPublicBootstrap.settings.guestUploaderLabelsVisible !== false;\n  const guestUploaderLabelOrder =\n    initialPublicBootstrap.settings.guestUploaderLabelOrder ?? [];\n  const guestLatestPhotoCount =\n    initialPublicBootstrap.settings.guestLatestPhotoCount;\n  const [albums] = useState(() => initialPublicBootstrap.albums);\n  const albumsResolved = true;`,
    "preloaded guest label settings",
  );

  code = replaceOnce(
    code,
    `  const guestGroups = useMemo(() => guestUploaderGroups(photos), [photos]);`,
    `  const guestGroups = useMemo(\n    () => guestUploaderGroups(photos, guestUploaderLabelOrder),\n    [photos, guestUploaderLabelOrder],\n  );`,
    "configured guest label order",
  );

  code = replaceOnce(
    code,
    `  const filtered = useMemo(`,
    `  const effectiveFilter =\n    activeCollection === "guest" && !guestUploaderLabelsVisible\n      ? "all"\n      : activeFilter;\n  const filtered = useMemo(`,
    "hidden guest label filter fallback",
  );

  code = replaceOnce(
    code,
    `        filterPhotos(photos, activeFilter, activeCollection),`,
    `        filterPhotos(photos, effectiveFilter, activeCollection, {\n          latestGuestPhotoCount: guestLatestPhotoCount,\n        }),`,
    "guest latest-photo filter",
  );

  code = replaceOnce(
    code,
    `        activeCollectionDefinition?.photoSortMode,`,
    `        activeCollection === "guest" &&\n        effectiveFilter === LATEST_GUEST_FILTER_ID\n          ? "time-desc"\n          : activeCollectionDefinition?.photoSortMode,`,
    "latest guest photo ordering",
  );

  code = replaceOnce(
    code,
    `      activeFilter,\n      activeCollection,\n      galleryMediaOrder,`,
    `      activeFilter,\n      effectiveFilter,\n      activeCollection,\n      galleryMediaOrder,\n      guestLatestPhotoCount,`,
    "guest filter memo dependencies",
  );

  code = replaceOnce(
    code,
    `          {activeCollection === "guest" && guestGroups.length > 0 && (\n            <ProcessSelector\n              ariaLabel={t.guest}\n              activeId={activeFilter}\n              onSelect={chooseFilter}\n              variant="guest"\n              items={[\n                { id: "all", label: t.allGuests + " (" + guestPhotoCount + ")" },\n                ...guestGroups.map((group) => ({\n                  id: group.id,\n                  label: group.name + " (" + group.count + ")",\n                })),\n              ]}\n            />\n          )}`,
    `          {activeCollection === "guest" &&\n            guestUploaderLabelsVisible &&\n            guestGroups.length > 0 && (\n              <ProcessSelector\n                ariaLabel={t.guest}\n                activeId={effectiveFilter}\n                onSelect={chooseFilter}\n                variant="guest"\n                items={[\n                  {\n                    id: "all",\n                    label: t.allGuests + " (" + guestPhotoCount + ")",\n                  },\n                  {\n                    id: LATEST_GUEST_FILTER_ID,\n                    label:\n                      (lang === "zh" ? "最新照片" : "Latest photos") +\n                      " (" +\n                      Math.min(guestPhotoCount, guestLatestPhotoCount) +\n                      ")",\n                  },\n                  ...guestGroups.map((group) => ({\n                    id: group.id,\n                    label: group.name + " (" + group.count + ")",\n                  })),\n                ]}\n              />\n            )}`,
    "guest selector visibility latest tab and order",
  );

  return code;
}

export function guestLabelsUiTransform() {
  return {
    name: "guest-labels-ui",
    enforce: "pre",
    transform(source, id) {
      const normalizedId = id.split("?")[0].replace(/\\/g, "/");
      if (!normalizedId.endsWith(APP_SUFFIX)) return null;
      return { code: transformApp(source), map: null };
    },
  };
}
