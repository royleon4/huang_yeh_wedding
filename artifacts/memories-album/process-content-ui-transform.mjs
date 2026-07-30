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
    `import BottomCollectionNav from "./BottomCollectionNav.jsx";\nimport PhotoGroupGrid from "./PhotoGroupGrid.jsx";\nimport ProcessSelector from "./ProcessSelector.jsx";\nimport ProcessRichContent, {\n  ProcessDivider,\n  hasRichContent,\n} from "./ProcessRichContent.jsx";\nimport {\n  DEFAULT_GALLERY_MEDIA_ORDER,\n  normalizeGalleryMediaOrder,\n  photoMediaKey,\n  sortPhotosByMediaOrder,\n} from "../gallery-media-order.mjs";\nimport "./gallery-media-order.css";`,
    "process rich content and media order imports",
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
    `  const [galleryError, setGalleryError] = useState(false);\n  const [galleryMediaOrder, setGalleryMediaOrder] = useState(() => [\n    ...DEFAULT_GALLERY_MEDIA_ORDER,\n  ]);`,
    "gallery media order state",
  );

  code = replaceOnce(
    code,
    `  const sourcePhotos = remotePhotos ?? (useMockFallback ? MOCK_PHOTOS : []);`,
    `  useEffect(() => {\n    let cancelled = false;\n    void fetch("/Memories/api/settings", {\n      headers: { Accept: "application/json" },\n    })\n      .then((response) => (response.ok ? response.json() : {}))\n      .then((settings) => {\n        if (!cancelled) {\n          setGalleryMediaOrder(\n            normalizeGalleryMediaOrder(settings.galleryMediaOrder),\n          );\n        }\n      })\n      .catch(() => {\n        // The default order remains available while settings recover.\n      });\n    return () => {\n      cancelled = true;\n    };\n  }, []);\n\n  const sourcePhotos = remotePhotos ?? (useMockFallback ? MOCK_PHOTOS : []);`,
    "public gallery media order hydration",
  );

  code = replaceOnce(
    code,
    `  const filtered = useMemo(\n    () => filterPhotos(photos, activeFilter, activeCollection),\n    [photos, activeFilter, activeCollection],\n  );`,
    `  const filtered = useMemo(\n    () =>\n      sortPhotosByMediaOrder(\n        filterPhotos(photos, activeFilter, activeCollection),\n        galleryMediaOrder,\n      ),\n    [photos, activeFilter, activeCollection, galleryMediaOrder],\n  );`,
    "photo group ordering",
  );

  code = replaceOnce(
    code,
    `  const activeProcess =\n    activeCollection === "wedding" && activeFilter !== "all"\n      ? processes.find((process) => process.id === activeFilter)\n      : null;\n  const hasProcessVideo = Boolean(activeProcess?.youtubeVideoId);`,
    `  const activeProcess =\n    activeCollection === "wedding"\n      ? activeFilter === "all"\n        ? ALL_PROCESS_DEFINITION\n        : processes.find((process) => process.id === activeFilter)\n      : null;\n  const activeProcessHtml =\n    activeProcess?.[lang === "zh" ? "contentHtmlZh" : "contentHtmlEn"] ?? "";\n  const hasProcessVideo = Boolean(activeProcess?.youtubeVideoId);\n  const hasProcessContent = hasRichContent(activeProcessHtml);\n  const photosSuppressed =\n    activeCollection === "wedding" &&\n    activeFilter === "all" &&\n    !ALL_PROCESS_DEFINITION.showAllPhotos;\n  const visibleWeddingPhotos = visible.filter(\n    (photo) => photoMediaKey(photo) === "weddingPhotos",\n  );\n  const visibleGuestPhotos = visible.filter(\n    (photo) => photoMediaKey(photo) === "guestPhotos",\n  );\n  const mediaAvailability = {\n    video: hasProcessVideo,\n    text: hasProcessContent,\n    weddingPhotos: visibleWeddingPhotos.length > 0,\n    guestPhotos: visibleGuestPhotos.length > 0,\n  };\n  const orderedAvailableMediaKeys = galleryMediaOrder.filter(\n    (key) => mediaAvailability[key],\n  );`,
    "active process content and photo group state",
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

  const mediaBody = `          {stateView ??\n            (orderedAvailableMediaKeys.length === 0 && !photosSuppressed ? (\n              <StateCard icon="✦" title={t.emptyTitle} body={t.emptyBody} />\n            ) : (\n              <>\n                <div className="process-media-sequence">\n                  {galleryMediaOrder.map((mediaKey) => {\n                    if (!mediaAvailability[mediaKey]) return null;\n                    const showDivider =\n                      orderedAvailableMediaKeys[0] !== mediaKey;\n                    return (\n                      <div\n                        key={mediaKey}\n                        className={"process-media-item " + mediaKey}\n                        data-media-block={mediaKey}\n                      >\n                        {showDivider && (\n                          <ProcessDivider\n                            paddingTop={activeProcess?.dividerPaddingTop}\n                            paddingBottom={activeProcess?.dividerPaddingBottom}\n                          />\n                        )}\n                        {mediaKey === "video" && (\n                          <ProcessVideo process={activeProcess} lang={lang} />\n                        )}\n                        {mediaKey === "text" && (\n                          <ProcessRichContent html={activeProcessHtml} />\n                        )}\n                        {mediaKey === "weddingPhotos" && (\n                          <PhotoGroupGrid\n                            photos={visibleWeddingPhotos}\n                            allVisiblePhotos={visible}\n                            copy={t}\n                            getCollectionLabel={photoCollectionLabel}\n                            mediaKey={mediaKey}\n                            onOpen={(photo, opener) => {\n                              openerRef.current = opener;\n                              setSelectedPhotoId(photo.id);\n                            }}\n                          />\n                        )}\n                        {mediaKey === "guestPhotos" && (\n                          <PhotoGroupGrid\n                            photos={visibleGuestPhotos}\n                            allVisiblePhotos={visible}\n                            copy={t}\n                            getCollectionLabel={photoCollectionLabel}\n                            mediaKey={mediaKey}\n                            onOpen={(photo, opener) => {\n                              openerRef.current = opener;\n                              setSelectedPhotoId(photo.id);\n                            }}\n                          />\n                        )}\n                      </div>\n                    );\n                  })}\n                </div>\n                {visible.length < filtered.length && (\n                  <button\n                    className="load-more"\n                    type="button"\n                    onClick={() => setPageSize((size) => size + 12)}\n                  >\n                    {t.loadMore}\n                    <span>↓</span>\n                  </button>\n                )}\n              </>\n            ))}`;

  code = replaceBetween(
    code,
    `          {stateView ??`,
    `\n        </section>`,
    mediaBody,
    "gallery media body",
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
