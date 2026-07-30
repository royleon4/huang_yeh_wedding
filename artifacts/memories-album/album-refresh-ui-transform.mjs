const APP_SUFFIX = "/src/client/App.jsx";
const ADMIN_APP_SUFFIX = "/src/client/AdminApp.jsx";

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`Album refresh UI transform could not find ${label}`);
  }
  return source.replace(search, replacement);
}

function transformGallery(source) {
  let code = replaceOnce(
    source,
    `    displayOrder: index + 1,\n  }));`,
    `    displayOrder: index + 1,\n    showSummary: true,\n  }));`,
    "fallback album summary setting",
  );

  code = replaceOnce(
    code,
    `          <div className="collection-summary">\n            <strong>\n              {activeCollectionDefinition?.[lang] ?? t.categories}\n            </strong>\n            {collectionNote && <p>{collectionNote}</p>}\n          </div>`,
    `          {activeCollectionDefinition?.showSummary !== false && (\n            <div className="collection-summary">\n              <strong>\n                {activeCollectionDefinition?.[lang] ?? t.categories}\n              </strong>\n              {collectionNote && <p>{collectionNote}</p>}\n            </div>\n          )}`,
    "public album summary block",
  );

  code = replaceOnce(
    code,
    `  const visibleWeddingPhotos = visible.filter(\n    (photo) => photoMediaKey(photo) === "weddingPhotos",\n  );\n  const visibleGuestPhotos = visible.filter(\n    (photo) => photoMediaKey(photo) === "guestPhotos",\n  );\n  const pinnedWeddingPhotos = pinnedPhotos.filter(\n    (photo) => photoMediaKey(photo) === "weddingPhotos",\n  );\n  const pinnedGuestPhotos = pinnedPhotos.filter(\n    (photo) => photoMediaKey(photo) === "guestPhotos",\n  );\n  const mediaAvailability = {\n    video: hasProcessVideo,\n    text: hasProcessContent,\n    weddingPhotos:\n      visibleWeddingPhotos.length > 0 || pinnedWeddingPhotos.length > 0,\n    guestPhotos: visibleGuestPhotos.length > 0 || pinnedGuestPhotos.length > 0,\n  };\n  const orderedAvailableMediaKeys = galleryMediaOrder.filter(\n    (key) => mediaAvailability[key],\n  );\n  const firstPhotoMediaKey = galleryMediaOrder.find(\n    (key) =>\n      (key === "weddingPhotos" || key === "guestPhotos") &&\n      mediaAvailability[key],\n  );`,
    `  const hasPhotoContent = visible.length > 0 || pinnedPhotos.length > 0;\n  const mediaAvailability = {\n    video: hasProcessVideo,\n    text: hasProcessContent,\n    photos: hasPhotoContent,\n  };\n  const mediaSequence = galleryMediaOrder.reduce((sequence, configuredKey) => {\n    const mediaKey =\n      configuredKey === "weddingPhotos" || configuredKey === "guestPhotos"\n        ? "photos"\n        : configuredKey;\n    if (mediaAvailability[mediaKey] && !sequence.includes(mediaKey)) {\n      sequence.push(mediaKey);\n    }\n    return sequence;\n  }, []);`,
    "continuous photo media state",
  );

  code = replaceOnce(
    code,
    `                  {galleryMediaOrder.map((mediaKey) => {\n                    if (!mediaAvailability[mediaKey]) return null;\n                    const showDivider =\n                      orderedAvailableMediaKeys[0] !== mediaKey;\n                    return (\n                      <div\n                        key={mediaKey}\n                        className={"process-media-item " + mediaKey}\n                        data-media-block={mediaKey}\n                      >\n                        {showDivider && (\n                          <ProcessDivider\n                            paddingTop={activeProcess?.dividerPaddingTop}\n                            paddingBottom={activeProcess?.dividerPaddingBottom}\n                          />\n                        )}\n                        {mediaKey === "video" && (\n                          <ProcessVideo process={activeProcess} lang={lang} />\n                        )}\n                        {mediaKey === "text" && (\n                          <ProcessRichContent html={activeProcessHtml} />\n                        )}\n                        {mediaKey === firstPhotoMediaKey && pinnedPhotos.length > 0 && (\n                          <PinnedPhotoStrip\n                            photos={pinnedPhotos}\n                            copy={t}\n                            onOpen={(photo, opener) => {\n                              openerRef.current = opener;\n                              setSelectedPhotoId(photo.id);\n                            }}\n                          />\n                        )}\n                        {mediaKey === "weddingPhotos" && (\n                          <PhotoGroupGrid\n                            photos={visibleWeddingPhotos}\n                            allVisiblePhotos={displayedPhotos}\n                            copy={t}\n                            getCollectionLabel={photoCollectionLabel}\n                            mediaKey={mediaKey}\n                            onOpen={(photo, opener) => {\n                              openerRef.current = opener;\n                              setSelectedPhotoId(photo.id);\n                            }}\n                          />\n                        )}\n                        {mediaKey === "guestPhotos" && (\n                          <PhotoGroupGrid\n                            photos={visibleGuestPhotos}\n                            allVisiblePhotos={displayedPhotos}\n                            copy={t}\n                            getCollectionLabel={photoCollectionLabel}\n                            mediaKey={mediaKey}\n                            onOpen={(photo, opener) => {\n                              openerRef.current = opener;\n                              setSelectedPhotoId(photo.id);\n                            }}\n                          />\n                        )}\n                      </div>\n                    );\n                  })}`,
    `                  {mediaSequence.map((mediaKey, index) => (\n                    <div\n                      key={mediaKey}\n                      className={"process-media-item " + mediaKey}\n                      data-media-block={mediaKey}\n                    >\n                      {index > 0 && (\n                        <ProcessDivider\n                          paddingTop={activeProcess?.dividerPaddingTop}\n                          paddingBottom={activeProcess?.dividerPaddingBottom}\n                        />\n                      )}\n                      {mediaKey === "video" && (\n                        <ProcessVideo process={activeProcess} lang={lang} />\n                      )}\n                      {mediaKey === "text" && (\n                        <ProcessRichContent html={activeProcessHtml} />\n                      )}\n                      {mediaKey === "photos" && (\n                        <>\n                          {pinnedPhotos.length > 0 && (\n                            <PinnedPhotoStrip\n                              photos={pinnedPhotos}\n                              copy={t}\n                              onOpen={(photo, opener) => {\n                                openerRef.current = opener;\n                                setSelectedPhotoId(photo.id);\n                              }}\n                            />\n                          )}\n                          <PhotoGroupGrid\n                            photos={visible}\n                            allVisiblePhotos={displayedPhotos}\n                            copy={t}\n                            getCollectionLabel={photoCollectionLabel}\n                            mediaKey="photos"\n                            onOpen={(photo, opener) => {\n                              openerRef.current = opener;\n                              setSelectedPhotoId(photo.id);\n                            }}\n                          />\n                        </>\n                      )}\n                    </div>\n                  ))}`,
    "single continuous photo grid",
  );

  return code;
}

function transformAdmin(source) {
  let code = replaceOnce(
    source,
    `import GeneralSettings from "./GeneralSettings.jsx";`,
    `import GeneralSettings from "./GeneralSettings.jsx";\nimport AdminRefreshManagement from "./AdminRefreshManagement.jsx";`,
    "central refresh import",
  );

  code = replaceOnce(
    code,
    `        {tab === "general" && <GeneralSettings />}`,
    `        {tab === "general" && (\n          <>\n            <GeneralSettings />\n            <AdminRefreshManagement\n              albums={albums}\n              categories={orderedCategories}\n            />\n          </>\n        )}`,
    "central refresh panel",
  );

  code = replaceOnce(
    code,
    `        <label className="admin-check">\n          <input\n            type="checkbox"\n            checked={draft.isVisible}\n            onChange={(event) => onChange({ isVisible: event.target.checked })}\n            disabled={busy}\n          />\n          對訪客顯示\n        </label>\n        <span className="admin-draft-hint">變更會由頁面底部統一儲存</span>`,
    `        <label className="admin-check">\n          <input\n            type="checkbox"\n            checked={draft.isVisible}\n            onChange={(event) => onChange({ isVisible: event.target.checked })}\n            disabled={busy}\n          />\n          對訪客顯示\n        </label>\n        <label className="admin-check">\n          <input\n            type="checkbox"\n            checked={draft.showSummary !== false}\n            onChange={(event) => onChange({ showSummary: event.target.checked })}\n            disabled={busy}\n          />\n          在子流程上方顯示相簿名稱與介紹\n        </label>\n        <span className="admin-draft-hint">變更會由頁面底部統一儲存</span>`,
    "album visibility actions",
  );

  code = replaceOnce(
    code,
    `  descriptionEn: "",\n  isVisible: true,\n};`,
    `  descriptionEn: "",\n  isVisible: true,\n  showSummary: true,\n};`,
    "new album summary default",
  );

  return code;
}

export function albumRefreshUiTransform() {
  return {
    name: "album-refresh-ui",
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
