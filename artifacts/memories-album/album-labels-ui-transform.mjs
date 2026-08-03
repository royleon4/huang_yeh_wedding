const APP_SUFFIX = "/src/client/App.jsx";
const MAIN_SUFFIX = "/src/client/main.jsx";
const ADMIN_APP_SUFFIX = "/src/client/AdminApp.jsx";
const ADMIN_WORKSPACE_SUFFIX = "/src/client/AdminPhotoWorkspace.jsx";

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`Album labels UI transform could not find ${label}`);
  }
  return source.replace(search, replacement);
}

function replaceIfPresent(source, search, replacement) {
  return source.includes(search) ? source.replace(search, replacement) : source;
}

function transformAdminApp(source) {
  let code = replaceOnce(
    source,
    `import "./admin-save-bar.css";`,
    `import "./admin-save-bar.css";\nimport AlbumLabelManager from "./AlbumLabelManager.jsx";`,
    "administrator album label import",
  );
  return replaceOnce(
    code,
    `    </form>\n  );\n}\n\nfunction CategoryEditor`,
    `      <AlbumLabelManager album={album} busy={busy} />\n    </form>\n  );\n}\n\nfunction CategoryEditor`,
    "album editor label manager",
  );
}

function transformAdminWorkspace(source) {
  let code = replaceOnce(
    source,
    `import { adminErrorMessage, adminRequest } from "./admin-client.mjs";`,
    `import { adminErrorMessage, adminRequest } from "./admin-client.mjs";\nimport {\n  buildAlbumLabelGroups,\n  validSelectedAlbumLabel,\n} from "./album-labels.mjs";`,
    "album label helpers",
  );

  code = replaceOnce(
    code,
    `function uploadClassification(albumIds, categoryId) {\n  if (albumIds.includes("wedding") && categoryId) {\n    return { classification: "wedding", processId: categoryId };\n  }\n  if (albumIds.includes("life")) return { classification: "life", processId: null };\n  return { classification: "guest", processId: null };\n}`,
    `function uploadClassification(albumIds, label) {\n  if (label?.albumId === "wedding") {\n    return { classification: "wedding", processId: label.id };\n  }\n  if (albumIds.includes("life")) return { classification: "life", processId: null };\n  return { classification: "guest", processId: null };\n}`,
    "upload classification by label album",
  );

  code = replaceOnce(
    code,
    `  const [photoError, setPhotoError] = useState("");`,
    `  const [photoError, setPhotoError] = useState("");\n  const [albumLabels, setAlbumLabels] = useState([]);\n  const [albumLabelError, setAlbumLabelError] = useState("");`,
    "album label state",
  );

  code = replaceOnce(
    code,
    `  const visiblePhotos = useMemo(\n    () => visibleIds.map((id) => photosById.get(id)).filter(Boolean),\n    [photosById, visibleIds],\n  );`,
    `  const visiblePhotos = useMemo(\n    () => visibleIds.map((id) => photosById.get(id)).filter(Boolean),\n    [photosById, visibleIds],\n  );\n  const albumLabelGroups = useMemo(\n    () => buildAlbumLabelGroups(albums, albumLabels),\n    [albums, albumLabels],\n  );\n  const selectableAlbumLabelGroups = useMemo(\n    () =>\n      albumLabelGroups.filter((group) =>\n        uploadAlbumIds.includes(group.album.id),\n      ),\n    [albumLabelGroups, uploadAlbumIds],\n  );\n  const selectedUploadLabel = useMemo(\n    () =>\n      validSelectedAlbumLabel(\n        albumLabels,\n        uploadCategoryId,\n        uploadAlbumIds,\n      ),\n    [albumLabels, uploadCategoryId, uploadAlbumIds],\n  );`,
    "grouped album labels",
  );

  code = replaceOnce(
    code,
    `  useEffect(() => {\n    if (!uploadAlbumIds.includes("wedding") && uploadCategoryId) {\n      setUploadCategoryId("");\n    }\n  }, [uploadAlbumIds, uploadCategoryId]);`,
    `  useEffect(() => {\n    if (\n      uploadCategoryId &&\n      !validSelectedAlbumLabel(albumLabels, uploadCategoryId, uploadAlbumIds)\n    ) {\n      setUploadCategoryId("");\n    }\n  }, [albumLabels, uploadAlbumIds, uploadCategoryId]);`,
    "clear label after its album is removed",
  );

  code = replaceOnce(
    code,
    `  useEffect(() => {\n    void loadAuthors();\n  }, [loadAuthors]);`,
    `  useEffect(() => {\n    void loadAuthors();\n  }, [loadAuthors]);\n\n  useEffect(() => {\n    let cancelled = false;\n    setAlbumLabelError("");\n    void adminRequest("/admin/api/album-labels")\n      .then((payload) => {\n        if (!cancelled) {\n          setAlbumLabels(Array.isArray(payload.labels) ? payload.labels : []);\n        }\n      })\n      .catch((error) => {\n        if (error?.status === 401) {\n          window.location.replace("/Memories/");\n          return;\n        }\n        if (!cancelled) setAlbumLabelError(adminErrorMessage(error));\n      });\n    return () => {\n      cancelled = true;\n    };\n  }, [refreshToken]);`,
    "load administrator album labels",
  );

  code = replaceOnce(
    code,
    `    const selectedCategory = selectedAlbums.includes("wedding")\n      ? uploadCategoryId\n      : "";`,
    `    const selectedLabel = validSelectedAlbumLabel(\n      albumLabels,\n      uploadCategoryId,\n      selectedAlbums,\n    );\n    const selectedCategory = selectedLabel?.id ?? "";`,
    "new upload selected label",
  );

  code = replaceOnce(
    code,
    `    const classification = uploadClassification(selectedAlbums, selectedCategory);`,
    `    const classification = uploadClassification(selectedAlbums, selectedLabel);`,
    "new upload label classification",
  );

  code = replaceOnce(
    code,
    `  const retryUnfinished = () => {\n    const selection = {\n      albumIds: [...uploadAlbumIds],\n      categoryId: uploadAlbumIds.includes("wedding") ? uploadCategoryId : "",\n    };`,
    `  const retryUnfinished = () => {\n    const selectedLabel = validSelectedAlbumLabel(\n      albumLabels,\n      uploadCategoryId,\n      uploadAlbumIds,\n    );\n    const selection = {\n      albumIds: [...uploadAlbumIds],\n      categoryId: selectedLabel?.id ?? "",\n    };`,
    "retry selected album label",
  );

  code = replaceOnce(
    code,
    `        <label className="admin-photo-process-field">\n          流程分類\n          <select\n            value={uploadCategoryId}\n            onChange={(event) => setUploadCategoryId(event.target.value)}\n            disabled={controlsLocked || !uploadAlbumIds.includes("wedding")}\n          >\n            <option value="">不指定流程</option>\n            {categories.map((category) => (\n              <option key={category.id} value={category.id}>\n                {String(category.displayOrder).padStart(2, "0")} {category.labelZh}\n              </option>\n            ))}\n          </select>\n          {!uploadAlbumIds.includes("wedding") && (\n            <small>勾選「婚禮流程」相簿後才可選擇。</small>\n          )}\n        </label>`,
    `        <label className="admin-photo-process-field">\n          子分類（標籤）\n          <select\n            value={selectedUploadLabel?.id ?? ""}\n            onChange={(event) => setUploadCategoryId(event.target.value)}\n            disabled={\n              controlsLocked ||\n              albumLabelGroups.length === 0 ||\n              selectableAlbumLabelGroups.length === 0\n            }\n          >\n            <option value="">\n              {albumLabelGroups.length === 0 ? "沒有可選標籤" : "不指定標籤"}\n            </option>\n            {albumLabelGroups.map((group) => (\n              <optgroup\n                key={group.album.id}\n                label={group.album.titleZh}\n                disabled={!uploadAlbumIds.includes(group.album.id)}\n              >\n                {group.labels.map((label) => (\n                  <option key={label.id} value={label.id}>\n                    {String(label.displayOrder).padStart(2, "0")} {label.labelZh}\n                  </option>\n                ))}\n              </optgroup>\n            ))}\n          </select>\n          {albumLabelError ? (\n            <small role="alert">{albumLabelError}</small>\n          ) : albumLabelGroups.length === 0 ? (\n            <small>目前沒有可供新增照片使用的標籤。</small>\n          ) : selectableAlbumLabelGroups.length === 0 ? (\n            <small>請先勾選一個已有標籤的相簿。</small>\n          ) : (\n            <small>只顯示已有標籤的相簿；訪客相簿不提供標籤。</small>\n          )}\n        </label>`,
    "grouped new-photo label selector",
  );

  return code;
}

function transformPublicMain(source) {
  let code = source;
  code = replaceIfPresent(
    code,
    `          id: process.id,\n          zh: process.labelZh,`,
    `          id: process.id,\n          albumId: process.albumId ?? "wedding",\n          zh: process.labelZh,`,
  );
  code = replaceIfPresent(
    code,
    `          (left, right) =>\n            left.displayOrder - right.displayOrder ||\n            left.id.localeCompare(right.id),`,
    `          (left, right) =>\n            left.albumId.localeCompare(right.albumId) ||\n            left.displayOrder - right.displayOrder ||\n            left.id.localeCompare(right.id),`,
  );
  return code;
}

function transformPublicApp(source) {
  let code = source;

  if (
    code.includes(
      `import { normalizePinnedPhotosByProcess } from "../pinned-photo-settings.mjs";`,
    ) &&
    !code.includes(`from "./public-album-labels.mjs"`)
  ) {
    code = code.replace(
      `import { normalizePinnedPhotosByProcess } from "../pinned-photo-settings.mjs";`,
      `import { normalizePinnedPhotosByProcess } from "../pinned-photo-settings.mjs";\nimport {\n  allAlbumLabel,\n  filterPhotosByAlbumLabel,\n  labelsForAlbum,\n} from "./public-album-labels.mjs";`,
    );
  }

  code = replaceIfPresent(
    code,
    `        filterPhotos(photos, activeFilter, activeCollection),`,
    `        filterPhotosByAlbumLabel(\n          filterPhotos(photos, activeFilter, activeCollection),\n          activeFilter,\n          activeCollection,\n        ),`,
  );

  code = replaceIfPresent(
    code,
    `  const activeProcess =\n    activeCollection === "wedding"\n      ? activeFilter === "all"\n        ? ALL_PROCESS_DEFINITION\n        : processes.find((process) => process.id === activeFilter)\n      : null;\n  const activeProcessHtml =`,
    `  const activeLabels = labelsForAlbum(processes, activeCollection);\n  const activeAllLabel = allAlbumLabel(activeCollectionDefinition, lang);\n  const activeProcess =\n    activeCollection === "wedding"\n      ? activeFilter === "all"\n        ? ALL_PROCESS_DEFINITION\n        : activeLabels.find((process) => process.id === activeFilter)\n      : activeFilter === "all"\n        ? null\n        : activeLabels.find((process) => process.id === activeFilter);\n  const activeProcessHtml =`,
  );

  code = replaceIfPresent(
    code,
    `          {activeCollection === "wedding" && (\n            <ProcessSelector\n              ariaLabel={t.wedding}\n              activeId={activeFilter}\n              onSelect={chooseFilter}\n              items={[\n                {\n                  id: "all",\n                  number: "00",\n                  label: ALL_PROCESS_DEFINITION[lang] || t.allProcesses,\n                },\n                ...processes.map((process, index) => ({\n                  id: process.id,\n                  number: String(index + 1).padStart(2, "0"),\n                  label: process[lang],\n                })),\n              ]}\n            />\n          )}`,
    `          {activeCollection !== "guest" && activeLabels.length > 0 && (\n            <ProcessSelector\n              ariaLabel={activeCollectionDefinition?.[lang] ?? t.categories}\n              activeId={activeFilter}\n              onSelect={chooseFilter}\n              items={[\n                { id: "all", number: "00", label: activeAllLabel },\n                ...activeLabels.map((label, index) => ({\n                  id: label.id,\n                  number: String(index + 1).padStart(2, "0"),\n                  label: label[lang],\n                })),\n              ]}\n            />\n          )}`,
  );

  code = replaceIfPresent(
    code,
    `  const photoCollectionLabel = (photo) => {\n    if (activeCollection === "wedding") {\n      return (\n        processes.find((process) => photo.processIds.includes(process.id))?.[\n          lang\n        ] ?? ALL_PROCESS_DEFINITION[lang] ?? t.allProcesses\n      );\n    }\n    return activeCollectionDefinition?.[lang] ?? t.categories;\n  };`,
    `  const photoCollectionLabel = (photo) => {\n    if (activeCollection !== "guest") {\n      return (\n        activeLabels.find((label) => photo.processIds.includes(label.id))?.[lang] ??\n        activeAllLabel\n      );\n    }\n    return activeCollectionDefinition?.[lang] ?? t.categories;\n  };`,
  );

  code = replaceIfPresent(
    code,
    `  const subgroupItemsFor = (collectionId) => {\n    if (collectionId === "wedding") return processes;\n    if (collectionId === "guest") return guestGroups;\n    return [];\n  };`,
    `  const subgroupItemsFor = (collectionId) => {\n    if (collectionId === "guest") return guestGroups;\n    return labelsForAlbum(processes, collectionId);\n  };`,
  );

  return code;
}

export function albumLabelsUiTransform() {
  return {
    name: "album-labels-ui",
    enforce: "pre",
    transform(source, id) {
      const normalizedId = id.split("?")[0].replace(/\\/g, "/");
      if (normalizedId.endsWith(ADMIN_APP_SUFFIX)) {
        return { code: transformAdminApp(source), map: null };
      }
      if (normalizedId.endsWith(ADMIN_WORKSPACE_SUFFIX)) {
        return { code: transformAdminWorkspace(source), map: null };
      }
      if (normalizedId.endsWith(MAIN_SUFFIX)) {
        const code = transformPublicMain(source);
        return code === source ? null : { code, map: null };
      }
      if (normalizedId.endsWith(APP_SUFFIX)) {
        const code = transformPublicApp(source);
        return code === source ? null : { code, map: null };
      }
      return null;
    },
  };
}
