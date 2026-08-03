const ADMIN_APP_SUFFIX = "/src/client/AdminApp.jsx";
const ADMIN_WORKSPACE_SUFFIX = "/src/client/AdminPhotoWorkspace.jsx";

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`Album labels UI transform could not find ${label}`);
  }
  return source.replace(search, replacement);
}

function transformAdminApp(source) {
  let code = replaceOnce(
    source,
    `import "./admin-save-bar.css";`,
    `import "./admin-save-bar.css";\nimport AlbumLabelManager from "./AlbumLabelManager.jsx";\nimport {\n  buildAlbumLabelGroups,\n  findAlbumLabel,\n  validSelectedAlbumLabel,\n} from "./album-labels.mjs";`,
    "administrator album label imports",
  );

  code = replaceOnce(
    code,
    `    </form>\n  );\n}\n\nfunction CategoryEditor`,
    `      <AlbumLabelManager album={album} busy={busy} />\n    </form>\n  );\n}\n\nfunction CategoryEditor`,
    "album editor label manager",
  );

  code = replaceOnce(
    code,
    `function PhotoEditor({\n  photo,\n  draft,\n  albums,\n  categories,\n  busy,\n  onChange,\n  onDelete,\n}) {\n  return (`,
    `function PhotoEditor({\n  photo,\n  draft,\n  albums,\n  categories,\n  busy,\n  onChange,\n  onDelete,\n}) {\n  const labelGroups = buildAlbumLabelGroups(albums, categories);\n  const selectedLabel = validSelectedAlbumLabel(\n    categories,\n    draft.categoryIds[0],\n    draft.albumIds,\n  );\n  return (`,
    "individual photo label view model",
  );

  code = replaceOnce(
    code,
    `        <label>\n          流程分類\n          <select\n            value={draft.categoryIds[0] ?? ""}\n            onChange={(event) =>\n              onChange({ categoryIds: event.target.value ? [event.target.value] : [] })\n            }\n            disabled={busy}\n          >\n            <option value="">不指定流程</option>\n            {categories.map((category) => (\n              <option key={category.id} value={category.id}>\n                {String(category.displayOrder).padStart(2, "0")} {category.labelZh}\n              </option>\n            ))}\n          </select>\n        </label>`,
    `        <label>\n          子分類／標籤\n          <select\n            value={selectedLabel?.id ?? ""}\n            onChange={(event) => {\n              const nextLabel = findAlbumLabel(categories, event.target.value);\n              onChange({\n                categoryIds: nextLabel ? [nextLabel.id] : [],\n                albumIds: nextLabel\n                  ? [...new Set([...draft.albumIds, nextLabel.albumId])]\n                  : draft.albumIds,\n              });\n            }}\n            disabled={busy || labelGroups.length === 0}\n          >\n            <option value="">不指定子分類／標籤</option>\n            {labelGroups.map((group) => (\n              <optgroup key={group.album.id} label={group.album.titleZh}>\n                {group.labels.map((label) => (\n                  <option key={label.id} value={label.id}>\n                    {String(label.displayOrder).padStart(2, "0")} {label.labelZh}\n                  </option>\n                ))}\n              </optgroup>\n            ))}\n          </select>\n        </label>`,
    "individual photo album label selector",
  );

  code = replaceOnce(
    code,
    `          onChange={(albumIds) => onChange({ albumIds })}`,
    `          onChange={(albumIds) => {\n            const nextLabel = validSelectedAlbumLabel(\n              categories,\n              draft.categoryIds[0],\n              albumIds,\n            );\n            onChange({\n              albumIds,\n              categoryIds: nextLabel ? [nextLabel.id] : [],\n            });\n          }}`,
    "individual photo label cleanup after album changes",
  );

  return code;
}

function transformAdminWorkspace(source) {
  let code = replaceOnce(
    source,
    `import { adminErrorMessage, adminRequest } from "./admin-client.mjs";`,
    `import { adminErrorMessage, adminRequest } from "./admin-client.mjs";\nimport {\n  buildAlbumLabelGroups,\n  findAlbumLabel,\n  validSelectedAlbumLabel,\n} from "./album-labels.mjs";`,
    "album label helpers",
  );

  code = replaceOnce(
    code,
    `function buildPhotoQuery({ albumId, categoryId, uploaderName }, cursor = null) {\n  const query = new URLSearchParams({ limit: "50" });\n  if (albumId) query.set("albumId", albumId);\n  if (categoryId) query.set("categoryId", categoryId);\n  if (uploaderName) query.set("uploaderName", uploaderName);\n  if (cursor) query.set("cursor", cursor);\n  return \`/admin/api/photos?\${query}\`;\n}`,
    `function buildPhotoQuery(\n  { albumId, categoryId, uploaderName },\n  cursor = null,\n  { limit = 50, selection = false } = {},\n) {\n  const query = new URLSearchParams({ limit: String(limit) });\n  if (albumId) query.set("albumId", albumId);\n  if (categoryId) query.set("labelId", categoryId);\n  if (uploaderName) query.set("uploaderName", uploaderName);\n  if (cursor) query.set("cursor", cursor);\n  if (selection) query.set("selection", "all");\n  return \`/admin/api/photos?\${query}\`;\n}`,
    "label-aware photo query",
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
    `  const visiblePhotos = useMemo(\n    () => visibleIds.map((id) => photosById.get(id)).filter(Boolean),\n    [photosById, visibleIds],\n  );\n  const albumLabelGroups = useMemo(\n    () => buildAlbumLabelGroups(albums, albumLabels),\n    [albums, albumLabels],\n  );\n  const filterLabelGroups = useMemo(\n    () =>\n      albumId\n        ? albumLabelGroups.filter((group) => group.album.id === albumId)\n        : albumLabelGroups,\n    [albumId, albumLabelGroups],\n  );\n  const selectableAlbumLabelGroups = useMemo(\n    () =>\n      albumLabelGroups.filter((group) =>\n        uploadAlbumIds.includes(group.album.id),\n      ),\n    [albumLabelGroups, uploadAlbumIds],\n  );\n  const selectedUploadLabel = useMemo(\n    () =>\n      validSelectedAlbumLabel(\n        albumLabels,\n        uploadCategoryId,\n        uploadAlbumIds,\n      ),\n    [albumLabels, uploadCategoryId, uploadAlbumIds],\n  );`,
    "grouped album labels",
  );

  code = replaceOnce(
    code,
    `  useEffect(() => {\n    if (!uploadAlbumIds.includes("wedding") && uploadCategoryId) {\n      setUploadCategoryId("");\n    }\n  }, [uploadAlbumIds, uploadCategoryId]);`,
    `  useEffect(() => {\n    if (\n      uploadCategoryId &&\n      !validSelectedAlbumLabel(albumLabels, uploadCategoryId, uploadAlbumIds)\n    ) {\n      setUploadCategoryId("");\n    }\n  }, [albumLabels, uploadAlbumIds, uploadCategoryId]);\n\n  useEffect(() => {\n    if (!categoryId || !albumId) return;\n    const selectedFilterLabel = findAlbumLabel(albumLabels, categoryId);\n    if (!selectedFilterLabel || selectedFilterLabel.albumId !== albumId) {\n      setCategoryId("");\n    }\n  }, [albumId, albumLabels, categoryId]);`,
    "clear labels after album changes",
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
    `            <p>相簿、流程分類與作者可以同時套用。</p>`,
    `            <p>相簿、子分類／標籤與作者可以同時套用。</p>`,
    "photo filter description",
  );

  code = replaceOnce(
    code,
    `          <label>\n            流程分類\n            <select\n              value={categoryId}\n              onChange={(event) => setCategoryId(event.target.value)}\n              disabled={busy}\n            >\n              <option value="">全部流程</option>\n              {categories.map((category) => (\n                <option key={category.id} value={category.id}>\n                  {String(category.displayOrder).padStart(2, "0")} {category.labelZh}\n                </option>\n              ))}\n            </select>\n          </label>`,
    `          <label>\n            子分類／標籤\n            <select\n              value={categoryId}\n              onChange={(event) => setCategoryId(event.target.value)}\n              disabled={busy || filterLabelGroups.length === 0}\n            >\n              <option value="">全部子分類／標籤</option>\n              {filterLabelGroups.map((group) => (\n                <optgroup key={group.album.id} label={group.album.titleZh}>\n                  {group.labels.map((label) => (\n                    <option key={label.id} value={label.id}>\n                      {String(label.displayOrder).padStart(2, "0")} {label.labelZh}\n                    </option>\n                  ))}\n                </optgroup>\n              ))}\n            </select>\n          </label>`,
    "photo filter album label selector",
  );

  code = replaceOnce(
    code,
    `        <label className="admin-photo-process-field">\n          流程分類\n          <select\n            value={uploadCategoryId}\n            onChange={(event) => setUploadCategoryId(event.target.value)}\n            disabled={controlsLocked || !uploadAlbumIds.includes("wedding")}\n          >\n            <option value="">不指定流程</option>\n            {categories.map((category) => (\n              <option key={category.id} value={category.id}>\n                {String(category.displayOrder).padStart(2, "0")} {category.labelZh}\n              </option>\n            ))}\n          </select>\n          {!uploadAlbumIds.includes("wedding") && (\n            <small>勾選「婚禮流程」相簿後才可選擇。</small>\n          )}\n        </label>`,
    `        <label className="admin-photo-process-field">\n          子分類／標籤\n          <select\n            value={selectedUploadLabel?.id ?? ""}\n            onChange={(event) => setUploadCategoryId(event.target.value)}\n            disabled={\n              controlsLocked ||\n              albumLabelGroups.length === 0 ||\n              selectableAlbumLabelGroups.length === 0\n            }\n          >\n            <option value="">\n              {albumLabelGroups.length === 0 ? "沒有可選標籤" : "不指定標籤"}\n            </option>\n            {albumLabelGroups.map((group) => (\n              <optgroup\n                key={group.album.id}\n                label={group.album.titleZh}\n                disabled={!uploadAlbumIds.includes(group.album.id)}\n              >\n                {group.labels.map((label) => (\n                  <option key={label.id} value={label.id}>\n                    {String(label.displayOrder).padStart(2, "0")} {label.labelZh}\n                  </option>\n                ))}\n              </optgroup>\n            ))}\n          </select>\n          {albumLabelError ? (\n            <small role="alert">{albumLabelError}</small>\n          ) : albumLabelGroups.length === 0 ? (\n            <small>目前沒有可供新增照片使用的標籤。</small>\n          ) : selectableAlbumLabelGroups.length === 0 ? (\n            <small>請先勾選一個已有標籤的相簿。</small>\n          ) : (\n            <small>只顯示已有標籤的相簿；訪客相簿不提供標籤。</small>\n          )}\n        </label>`,
    "grouped new-photo label selector",
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
      return null;
    },
  };
}
