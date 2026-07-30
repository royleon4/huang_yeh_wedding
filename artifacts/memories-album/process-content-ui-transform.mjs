const APP_SUFFIX = "/src/client/App.jsx";
const ADMIN_APP_SUFFIX = "/src/client/AdminApp.jsx";

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`Process content UI transform could not find ${label}`);
  }
  return source.replace(search, replacement);
}

function replaceBetween(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) {
    throw new Error(`Process content UI transform could not find ${label}`);
  }
  return `${source.slice(0, start)}${replacement}${source.slice(end)}`;
}

function transformGallery(source) {
  let code = replaceOnce(
    source,
    `  COLLECTION_DEFINITIONS,`,
    `  ALL_PROCESS_DEFINITION,\n  COLLECTION_DEFINITIONS,`,
    "all-process model import",
  );

  code = replaceOnce(
    code,
    `import BottomCollectionNav from "./BottomCollectionNav.jsx";`,
    `import BottomCollectionNav from "./BottomCollectionNav.jsx";\nimport PhotoGroupGrid from "./PhotoGroupGrid.jsx";\nimport PinnedPhotoStrip from "./PinnedPhotoStrip.jsx";\nimport ProcessSelector from "./ProcessSelector.jsx";\nimport ProcessRichContent, {\n  ProcessDivider,\n  hasRichContent,\n} from "./ProcessRichContent.jsx";\nimport {\n  DEFAULT_GALLERY_MEDIA_ORDER,\n  normalizeGalleryMediaOrder,\n  photoMediaKey,\n  sortPhotosByMediaOrder,\n} from "../gallery-media-order.mjs";\nimport { normalizePinnedPhotosByProcess } from "../pinned-photo-settings.mjs";\nimport "./gallery-media-order.css";`,
    "process rich content, pinned photo, and media order imports",
  );

  code = replaceOnce(
    code,
    `      <div className="process-video-divider" aria-hidden="true" />\n`,
    ``,
    "legacy process video divider",
  );

  code = replaceOnce(
    code,
    `  const [galleryError, setGalleryError] = useState(false);`,
    `  const [galleryError, setGalleryError] = useState(false);\n  const [galleryMediaOrder, setGalleryMediaOrder] = useState(() => [\n    ...DEFAULT_GALLERY_MEDIA_ORDER,\n  ]);\n  const [pinnedPhotoIdsByProcess, setPinnedPhotoIdsByProcess] = useState({});`,
    "gallery settings state",
  );

  code = replaceOnce(
    code,
    `  const sourcePhotos = remotePhotos ?? (useMockFallback ? MOCK_PHOTOS : []);`,
    `  useEffect(() => {\n    let cancelled = false;\n    void fetch("/Memories/api/settings", {\n      headers: { Accept: "application/json" },\n    })\n      .then((response) => (response.ok ? response.json() : {}))\n      .then((settings) => {\n        if (!cancelled) {\n          setGalleryMediaOrder(\n            normalizeGalleryMediaOrder(settings.galleryMediaOrder),\n          );\n          setPinnedPhotoIdsByProcess(\n            normalizePinnedPhotosByProcess(settings.pinnedPhotoIdsByProcess),\n          );\n        }\n      })\n      .catch(() => {\n        // The defaults remain available while settings recover.\n      });\n    return () => {\n      cancelled = true;\n    };\n  }, []);\n\n  const sourcePhotos = remotePhotos ?? (useMockFallback ? MOCK_PHOTOS : []);`,
    "public gallery settings hydration",
  );

  code = replaceOnce(
    code,
    `  const filtered = useMemo(\n    () => filterPhotos(photos, activeFilter, activeCollection),\n    [photos, activeFilter, activeCollection],\n  );`,
    `  const filtered = useMemo(\n    () =>\n      sortPhotosByMediaOrder(\n        filterPhotos(photos, activeFilter, activeCollection),\n        galleryMediaOrder,\n      ),\n    [photos, activeFilter, activeCollection, galleryMediaOrder],\n  );`,
    "photo group ordering",
  );

  code = replaceOnce(
    code,
    `  const visible = useMemo(\n    () => pagePhotos(filtered, pageSize, 0).items,\n    [filtered, pageSize],\n  );\n  const selectedIndex = selectedPhotoId\n    ? filtered.findIndex((photo) => photo.id === selectedPhotoId)\n    : -1;`,
    `  const activePinnedPhotoIds =\n    activeCollection === "wedding"\n      ? pinnedPhotoIdsByProcess[activeFilter] ?? []\n      : [];\n  const pinnedPhotos = useMemo(\n    () =>\n      activePinnedPhotoIds\n        .map((id) => filtered.find((photo) => photo.id === id))\n        .filter(Boolean),\n    [activePinnedPhotoIds, filtered],\n  );\n  const pinnedPhotoIdSet = useMemo(\n    () => new Set(pinnedPhotos.map((photo) => photo.id)),\n    [pinnedPhotos],\n  );\n  const regularFiltered = useMemo(\n    () => filtered.filter((photo) => !pinnedPhotoIdSet.has(photo.id)),\n    [filtered, pinnedPhotoIdSet],\n  );\n  const visible = useMemo(\n    () => pagePhotos(regularFiltered, pageSize, 0).items,\n    [regularFiltered, pageSize],\n  );\n  const displayedPhotos = useMemo(\n    () => [...pinnedPhotos, ...visible],\n    [pinnedPhotos, visible],\n  );\n  const lightboxPhotos = useMemo(\n    () => [...pinnedPhotos, ...regularFiltered],\n    [pinnedPhotos, regularFiltered],\n  );\n  const selectedIndex = selectedPhotoId\n    ? lightboxPhotos.findIndex((photo) => photo.id === selectedPhotoId)\n    : -1;`,
    "pinned and regular photo paging",
  );

  code = replaceOnce(
    code,
    `  const activeProcess =\n    activeCollection === "wedding" && activeFilter !== "all"\n      ? processes.find((process) => process.id === activeFilter)\n      : null;\n  const hasProcessVideo = Boolean(activeProcess?.youtubeVideoId);`,
    `  const activeProcess =\n    activeCollection === "wedding"\n      ? activeFilter === "all"\n        ? ALL_PROCESS_DEFINITION\n        : processes.find((process) => process.id === activeFilter)\n      : null;\n  const activeProcessHtml =\n    activeProcess?.[lang === "zh" ? "contentHtmlZh" : "contentHtmlEn"] ?? "";\n  const hasProcessVideo = Boolean(activeProcess?.youtubeVideoId);\n  const hasProcessContent = hasRichContent(activeProcessHtml);\n  const photosSuppressed =\n    activeCollection === "wedding" &&\n    activeFilter === "all" &&\n    !ALL_PROCESS_DEFINITION.showAllPhotos;\n  const visibleWeddingPhotos = visible.filter(\n    (photo) => photoMediaKey(photo) === "weddingPhotos",\n  );\n  const visibleGuestPhotos = visible.filter(\n    (photo) => photoMediaKey(photo) === "guestPhotos",\n  );\n  const pinnedWeddingPhotos = pinnedPhotos.filter(\n    (photo) => photoMediaKey(photo) === "weddingPhotos",\n  );\n  const pinnedGuestPhotos = pinnedPhotos.filter(\n    (photo) => photoMediaKey(photo) === "guestPhotos",\n  );\n  const mediaAvailability = {\n    video: hasProcessVideo,\n    text: hasProcessContent,\n    weddingPhotos:\n      visibleWeddingPhotos.length > 0 || pinnedWeddingPhotos.length > 0,\n    guestPhotos: visibleGuestPhotos.length > 0 || pinnedGuestPhotos.length > 0,\n  };\n  const orderedAvailableMediaKeys = galleryMediaOrder.filter(\n    (key) => mediaAvailability[key],\n  );\n  const firstPhotoMediaKey = galleryMediaOrder.find(\n    (key) =>\n      (key === "weddingPhotos" || key === "guestPhotos") &&\n      mediaAvailability[key],\n  );`,
    "active process content and pinned photo group state",
  );

  code = replaceOnce(
    code,
    `          {activeCollection === "wedding" && (\n            <div className="process-strip" role="list" aria-label={t.wedding}>\n              <button\n                type="button"\n                className={\`process-chip \${activeFilter === "all" ? "active" : ""}\`}\n                onClick={() => chooseFilter("all")}\n              >\n                {t.allProcesses}\n              </button>\n              {processes.map((process, index) => (\n                <button\n                  key={process.id}\n                  type="button"\n                  className={\`process-chip \${\n                    activeFilter === process.id ? "active" : ""\n                  }\`}\n                  onClick={() => chooseFilter(process.id)}\n                >\n                  <span>{String(index + 1).padStart(2, "0")}</span>\n                  {process[lang]}\n                </button>\n              ))}\n            </div>\n          )}`,
    `          {activeCollection === "wedding" && (\n            <ProcessSelector\n              ariaLabel={t.wedding}\n              activeId={activeFilter}\n              onSelect={chooseFilter}\n              items={[\n                {\n                  id: "all",\n                  number: "00",\n                  label: ALL_PROCESS_DEFINITION[lang] || t.allProcesses,\n                },\n                ...processes.map((process, index) => ({\n                  id: process.id,\n                  number: String(index + 1).padStart(2, "0"),\n                  label: process[lang],\n                })),\n              ]}\n            />\n          )}`,
    "wedding process selector",
  );

  code = replaceOnce(
    code,
    `          {activeCollection === "guest" && guestGroups.length > 0 && (\n            <div className="process-strip" role="list" aria-label={t.guest}>\n              <button\n                type="button"\n                className={\`process-chip \${activeFilter === "all" ? "active" : ""}\`}\n                onClick={() => chooseFilter("all")}\n              >\n                {t.allGuests} ({guestPhotoCount})\n              </button>\n              {guestGroups.map((group) => (\n                <button\n                  key={group.id}\n                  type="button"\n                  className={\`process-chip \${\n                    activeFilter === group.id ? "active" : ""\n                  }\`}\n                  onClick={() => chooseFilter(group.id)}\n                >\n                  {group.name} ({group.count})\n                </button>\n              ))}\n            </div>\n          )}`,
    `          {activeCollection === "guest" && guestGroups.length > 0 && (\n            <ProcessSelector\n              ariaLabel={t.guest}\n              activeId={activeFilter}\n              onSelect={chooseFilter}\n              variant="guest"\n              items={[\n                { id: "all", label: t.allGuests + " (" + guestPhotoCount + ")" },\n                ...guestGroups.map((group) => ({\n                  id: group.id,\n                  label: group.name + " (" + group.count + ")",\n                })),\n              ]}\n            />\n          )}`,
    "guest uploader selector",
  );

  code = replaceOnce(
    code,
    `        ] ?? t.allProcesses`,
    `        ] ?? ALL_PROCESS_DEFINITION[lang] ?? t.allProcesses`,
    "photo all-process label",
  );

  const mediaBody = `          {stateView ??
            (orderedAvailableMediaKeys.length === 0 && !photosSuppressed ? (
              <StateCard icon="✦" title={t.emptyTitle} body={t.emptyBody} />
            ) : (
              <>
                <div className="process-media-sequence">
                  {galleryMediaOrder.map((mediaKey) => {
                    if (!mediaAvailability[mediaKey]) return null;
                    const showDivider =
                      orderedAvailableMediaKeys[0] !== mediaKey;
                    return (
                      <div
                        key={mediaKey}
                        className={"process-media-item " + mediaKey}
                        data-media-block={mediaKey}
                      >
                        {showDivider && (
                          <ProcessDivider
                            paddingTop={activeProcess?.dividerPaddingTop}
                            paddingBottom={activeProcess?.dividerPaddingBottom}
                          />
                        )}
                        {mediaKey === "video" && (
                          <ProcessVideo process={activeProcess} lang={lang} />
                        )}
                        {mediaKey === "text" && (
                          <ProcessRichContent html={activeProcessHtml} />
                        )}
                        {mediaKey === firstPhotoMediaKey && pinnedPhotos.length > 0 && (
                          <PinnedPhotoStrip
                            photos={pinnedPhotos}
                            copy={t}
                            onOpen={(photo, opener) => {
                              openerRef.current = opener;
                              setSelectedPhotoId(photo.id);
                            }}
                          />
                        )}
                        {mediaKey === "weddingPhotos" && (
                          <PhotoGroupGrid
                            photos={visibleWeddingPhotos}
                            allVisiblePhotos={displayedPhotos}
                            copy={t}
                            getCollectionLabel={photoCollectionLabel}
                            mediaKey={mediaKey}
                            onOpen={(photo, opener) => {
                              openerRef.current = opener;
                              setSelectedPhotoId(photo.id);
                            }}
                          />
                        )}
                        {mediaKey === "guestPhotos" && (
                          <PhotoGroupGrid
                            photos={visibleGuestPhotos}
                            allVisiblePhotos={displayedPhotos}
                            copy={t}
                            getCollectionLabel={photoCollectionLabel}
                            mediaKey={mediaKey}
                            onOpen={(photo, opener) => {
                              openerRef.current = opener;
                              setSelectedPhotoId(photo.id);
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
                {visible.length < regularFiltered.length && (
                  <button
                    className="load-more"
                    type="button"
                    onClick={() => setPageSize((size) => size + 12)}
                  >
                    {t.loadMore}
                    <span>↓</span>
                  </button>
                )}
              </>
            ))}`;

  code = replaceBetween(
    code,
    `          {stateView ??`,
    `\n        </section>`,
    mediaBody,
    "gallery media body",
  );

  code = replaceOnce(
    code,
    `          photos={filtered}`,
    `          photos={lightboxPhotos}`,
    "pinned photo lightbox collection",
  );
  code = replaceOnce(
    code,
    `            setSelectedPhotoId(filtered[index]?.id ?? null)`,
    `            setSelectedPhotoId(lightboxPhotos[index]?.id ?? null)`,
    "pinned photo lightbox selection",
  );

  return code;
}

function transformAdmin(source) {
  let code = replaceOnce(
    source,
    `import "./admin-save-bar.css";`,
    `import "./admin-save-bar.css";\nimport GeneralSettings from "./GeneralSettings.jsx";\nimport ProcessContentEditor, { AllProcessEditor } from "./ProcessContentEditor.jsx";\nimport ProcessSelectorSettings from "./ProcessSelectorSettings.jsx";\nimport "./process-content-admin.css";`,
    "admin process content imports",
  );

  code = replaceOnce(
    code,
    `      <div className="admin-row-actions">`,
    `      <ProcessContentEditor processKey={category.id} />\n      <div className="admin-row-actions">`,
    "category rich content editor",
  );

  code = replaceOnce(
    code,
    `          ["albums", "相簿"],`,
    `          ["general", "通用"],\n          ["albums", "相簿"],`,
    "general settings tab",
  );

  code = replaceOnce(
    code,
    `          ["categories", "分類與影片"],`,
    `          ["categories", "分類與影片"],\n          ["subcategory-ui", "子分類操作"],`,
    "subcategory settings tab",
  );

  code = replaceOnce(
    code,
    `      <main className="admin-content">\n        {tab === "albums" && (`,
    `      <main className="admin-content">\n        {tab === "general" && <GeneralSettings />}\n        {tab === "subcategory-ui" && <ProcessSelectorSettings />}\n        {tab === "albums" && (`,
    "general and subcategory settings panels",
  );

  code = replaceOnce(
    code,
    `              <span>{categories.length} 個分類</span>`,
    `              <span>{categories.length + 1} 個分類</span>`,
    "category count",
  );

  code = replaceOnce(
    code,
    `            <div className="admin-editor-list">\n              {orderedCategories.map((category, index) => (`,
    `            <div className="admin-editor-list">\n              <AllProcessEditor />\n              {orderedCategories.map((category, index) => (`,
    "fixed all-process editor",
  );

  code = replaceOnce(
    code,
    `                    value={upload.categoryId}\n                    onChange={(event) =>\n                      setUpload((current) => ({ ...current, categoryId: event.target.value }))\n                    }\n                    disabled={busy}`,
    `                    value={upload.categoryId}\n                    onChange={(event) =>\n                      setUpload((current) => ({ ...current, categoryId: event.target.value }))\n                    }\n                    disabled={busy || !upload.albumIds.includes("wedding")}`,
    "new-photo wedding category guard",
  );

  code = replaceOnce(
    code,
    `                  onChange={(albumIds) =>\n                    setUpload((current) => ({ ...current, albumIds }))\n                  }`,
    `                  onChange={(albumIds) =>\n                    setUpload((current) => ({\n                      ...current,\n                      albumIds,\n                      categoryId: albumIds.includes("wedding") ? current.categoryId : "",\n                    }))\n                  }`,
    "new-photo category clearing",
  );

  return code;
}

export function processContentUiTransform() {
  return {
    name: "process-content-ui",
    enforce: "pre",
    transform(source, id) {
      const normalizedId = id.split("?")[0].replace(/\\/g, "/");
      if (normalizedId.endsWith(APP_SUFFIX)) {
        return { code: transformGallery(source), map: null };
      }
      if (normalizedId.endsWith(ADMIN_APP_SUFFIX)) {
        return { code: transformAdmin(source), map: null };
      }
      return null;
    },
  };
}
