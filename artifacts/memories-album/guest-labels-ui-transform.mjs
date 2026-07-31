const APP_SUFFIX = "/src/client/App.jsx";
const ADMIN_APP_SUFFIX = "/src/client/AdminApp.jsx";

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`Guest labels UI transform could not find ${label}`);
  }
  return source.replace(search, replacement);
}

function transformRegion(source, startMarker, endMarker, transform, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) {
    throw new Error(`Guest labels UI transform could not find ${label}`);
  }
  return `${source.slice(0, start)}${transform(source.slice(start, end))}${source.slice(end)}`;
}

function replaceLast(source, search, replacement, label) {
  const index = source.lastIndexOf(search);
  if (index < 0) {
    throw new Error(`Guest labels UI transform could not find ${label}`);
  }
  return `${source.slice(0, index)}${replacement}${source.slice(index + search.length)}`;
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
    `  const initialPublicBootstrap = getPublicBootstrap();\n  const guestLatestPhotosLabelVisible =\n    initialPublicBootstrap.settings.guestLatestPhotosLabelVisible !== false;\n  const guestAllVisitorsLabelVisible =\n    initialPublicBootstrap.settings.guestAllVisitorsLabelVisible !== false;\n  const guestNameLabelsVisible =\n    initialPublicBootstrap.settings.guestNameLabelsVisible !== false;\n  const guestUploaderLabelOrder =\n    initialPublicBootstrap.settings.guestUploaderLabelOrder ?? [];\n  const guestLatestPhotoCount =\n    initialPublicBootstrap.settings.guestLatestPhotoCount;\n  const [albums] = useState(() => initialPublicBootstrap.albums);\n  const albumsResolved = true;`,
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
    `  const activeGuestFilterVisible =\n    activeFilter === "all"\n      ? guestAllVisitorsLabelVisible\n      : activeFilter === LATEST_GUEST_FILTER_ID\n        ? guestLatestPhotosLabelVisible\n        : guestNameLabelsVisible;\n  const effectiveFilter =\n    activeCollection === "guest" && !activeGuestFilterVisible\n      ? "all"\n      : activeFilter;\n  const filtered = useMemo(`,
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
    `          {activeCollection === "guest" &&\n            guestPhotoCount > 0 &&\n            (guestAllVisitorsLabelVisible ||\n              guestLatestPhotosLabelVisible ||\n              (guestNameLabelsVisible && guestGroups.length > 0)) && (\n              <ProcessSelector\n                ariaLabel={t.guest}\n                activeId={effectiveFilter}\n                onSelect={chooseFilter}\n                variant="guest"\n                items={[\n                  ...(guestAllVisitorsLabelVisible\n                    ? [\n                        {\n                          id: "all",\n                          label: t.allGuests + " (" + guestPhotoCount + ")",\n                        },\n                      ]\n                    : []),\n                  ...(guestLatestPhotosLabelVisible\n                    ? [\n                        {\n                          id: LATEST_GUEST_FILTER_ID,\n                          label:\n                            (lang === "zh" ? "最新照片" : "Latest photos") +\n                            " (" +\n                            Math.min(guestPhotoCount, guestLatestPhotoCount) +\n                            ")",\n                        },\n                      ]\n                    : []),\n                  ...(guestNameLabelsVisible\n                    ? guestGroups.map((group) => ({\n                        id: group.id,\n                        label: group.name + " (" + group.count + ")",\n                      }))\n                    : []),\n                ]}\n              />\n            )}`,
    "independent guest selector visibility latest tab and order",
  );

  return code;
}

function transformAdmin(source) {
  let code = replaceOnce(
    source,
    `import "./admin-save-bar.css";`,
    `import "./admin-save-bar.css";\nimport GuestLabelSettings from "./GuestLabelSettings.jsx";`,
    "guest label administrator import",
  );

  code = transformRegion(
    code,
    "function AlbumEditor(",
    "\nfunction CategoryEditor(",
    (region) =>
      replaceLast(
        region,
        `      </form>\n    </details>\n  );`,
        `        {album.id === "guest" && (\n          <details className="admin-accordion admin-guest-label-accordion">\n            <summary className="admin-accordion-summary">\n              <span className="admin-accordion-title">訪客相簿標籤</span>\n              <span className="admin-accordion-secondary">顯示、排序與最新照片</span>\n            </summary>\n            <div className="admin-accordion-body">\n              <GuestLabelSettings />\n            </div>\n          </details>\n        )}\n      </form>\n    </details>\n  );`,
        "guest album nested accordion",
      ),
    "album editor",
  );
  return code;
}

export function guestLabelsUiTransform() {
  return {
    name: "guest-labels-ui",
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
