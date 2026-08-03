import { adminResponsiveLayoutUiTransform } from "./admin-responsive-layout-ui-transform.mjs";
import { albumPhotoOrderUiTransform } from "./album-photo-order-ui-transform.mjs";

const ADMIN_APP_SUFFIX = "/src/client/AdminApp.jsx";
const ADMIN_WORKSPACE_SUFFIX = "/src/client/AdminPhotoWorkspace.jsx";
const UPLOAD_MODAL_SUFFIX = "/src/client/UploadModal.jsx";

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`Admin photo workspace transform could not find ${label}`);
  }
  return source.replace(search, replacement);
}

function replacePhotoTab(source) {
  const startMarker = `        {tab === "photos" && (`;
  const start = source.indexOf(startMarker);
  const end = source.indexOf(`\n      </main>`, start);
  if (start < 0 || end < 0) {
    throw new Error("Admin photo workspace transform could not find photo tab");
  }

  const replacement = `        {tab === "photos" && (
          <AdminPhotoWorkspace
            albums={albums}
            categories={orderedCategories}
            photos={photos}
            initialNextCursor={nextCursor}
            busy={busy}
            refreshToken={message || error}
            setPhotos={setPhotos}
            setPhotoDrafts={setPhotoDrafts}
            renderPhoto={(
              photo,
              photoBusy = false,
              photoLabels = orderedCategories,
            ) => (
              <PhotoEditor
                photo={photo}
                draft={photoDrafts[photo.id] ?? photoDraft(photo)}
                albums={albums}
                categories={photoLabels}
                busy={busy || photoBusy}
                onChange={(changes) => updatePhotoDraft(photo, changes)}
                onDelete={() => void deletePhoto(photo)}
              />
            )}
          />
        )}`;

  return `${source.slice(0, start)}${replacement}${source.slice(end)}`;
}

function transformDeleteFlow(source) {
  let code = replaceOnce(
    source,
    `      \`確定永久刪除「\${photo.displayName || photo.originalFilename}」嗎？\\n\\n原圖、縮圖與資料庫紀錄都會立即刪除，無法復原。\`,`,
    `      \`確定永久刪除「\${photo.displayName || photo.originalFilename}」嗎？\\n\\n若同一張照片同時存在多個相簿或子分類／標籤，所有位置都會一起刪除。原圖、縮圖與資料庫紀錄將立即刪除，無法復原。\`,`,
    "permanent deletion confirmation",
  );

  code = replaceOnce(
    code,
    `      await adminRequest(\`/admin/api/photos/\${encodeURIComponent(photo.id)}\`, {
        method: "DELETE",
        timeoutMs: 120_000,
      });
      setPhotos((current) => current.filter((item) => item.id !== photo.id));
      setPhotoDrafts((current) => {
        const next = { ...current };
        delete next[photo.id];
        return next;
      });
      setMessage("照片已永久刪除。");`,
    `      const deletion = await adminRequest(
        \`/admin/api/photos/\${encodeURIComponent(photo.id)}\`,
        {
          method: "DELETE",
          timeoutMs: 120_000,
        },
      );
      const deletedIds = new Set(
        Array.isArray(deletion.deletedIds) && deletion.deletedIds.length > 0
          ? deletion.deletedIds
          : [photo.id],
      );
      setPhotos((current) =>
        current.filter((item) => !deletedIds.has(item.id)),
      );
      setPhotoDrafts((current) => {
        const next = { ...current };
        for (const deletedId of deletedIds) delete next[deletedId];
        return next;
      });
      setMessage(
        deletedIds.size > 1
          ? \`同一張照片的 \${deletedIds.size} 筆分類紀錄已全部永久刪除。\`
          : "照片已從所有相簿與子分類／標籤永久刪除。",
      );`,
    "photo family deletion response",
  );

  return code;
}

function transformUploadModal(source) {
  let code = replaceOnce(
    source,
    `    uploading: "上傳中",`,
    `    uploading: "正在傳送到伺服器",\n    processing: "伺服器正在整理並儲存到 Google Drive",`,
    "visitor upload Chinese processing label",
  );
  code = replaceOnce(
    code,
    `    uploading: "Uploading",`,
    `    uploading: "Sending to the server",\n    processing: "Processing and storing in Google Drive",`,
    "visitor upload English processing label",
  );
  code = replaceOnce(
    code,
    `照片逐張傳送並使用固定識別碼，重新嘗試不會重複建立 Drive 檔案。`,
    `最多同時傳送 3 張；原圖會以可續傳分段儲存到 Drive，重新嘗試會從 Drive 已接受的位置繼續。`,
    "visitor upload Chinese hint",
  );
  return replaceOnce(
    code,
    `Stable upload IDs prevent duplicate Drive files when a request is retried.`,
    `Up to three photos transfer together. Resumable Drive chunks continue from the last accepted byte after a retry.`,
    "visitor upload English hint",
  );
}

function transformAdminWorkspace(source) {
  let code = replaceOnce(
    source,
    `import "./admin-photo-workspace.css";`,
    `import "./admin-photo-workspace.css";\nimport AdminPhotoBulkActions from "./AdminPhotoBulkActions.jsx";`,
    "bulk action component import",
  );
  code = replaceOnce(
    code,
    `  setPhotos,\n  renderPhoto,\n}) {`,
    `  setPhotos,\n  setPhotoDrafts,\n  renderPhoto,\n}) {`,
    "photo draft setter property",
  );
  code = replaceOnce(
    code,
    `  const [photoError, setPhotoError] = useState("");`,
    `  const [photoError, setPhotoError] = useState("");\n  const [selectedIds, setSelectedIds] = useState([]);\n  const [bulkBusy, setBulkBusy] = useState(false);\n  const [selectingAllFiltered, setSelectingAllFiltered] = useState(false);\n  const [filteredCount, setFilteredCount] = useState(() => photos.length);`,
    "bulk selection state",
  );
  code = replaceOnce(
    code,
    `  const visiblePhotos = useMemo(\n    () => visibleIds.map((id) => photosById.get(id)).filter(Boolean),\n    [photosById, visibleIds],\n  );`,
    `  const visiblePhotos = useMemo(\n    () => visibleIds.map((id) => photosById.get(id)).filter(Boolean),\n    [photosById, visibleIds],\n  );\n  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);\n  const allFilteredSelected =\n    filteredCount > 0 && selectedIds.length === filteredCount;\n\n  useEffect(() => {\n    const available = new Set(photos.map((photo) => photo.id));\n    setSelectedIds((current) => {\n      const next = current.filter((id) => available.has(id));\n      return next.length === current.length ? current : next;\n    });\n  }, [photos]);`,
    "all loaded photo selection pruning",
  );
  code = replaceOnce(
    code,
    `  const controlsLocked = busy || uploading || Boolean(batch);`,
    `  const controlsLocked =\n    busy || uploading || bulkBusy || selectingAllFiltered || Boolean(batch);`,
    "bulk busy upload lock",
  );
  code = replaceOnce(
    code,
    `        const incoming = Array.isArray(payload.photos) ? payload.photos : [];\n        setPhotos((current) => mergeAdminPhotos(current, incoming));`,
    `        const incoming = Array.isArray(payload.photos) ? payload.photos : [];\n        if (Number.isInteger(payload.total)) {\n          setFilteredCount(payload.total);\n        } else if (!append) {\n          setFilteredCount(incoming.length);\n        }\n        setPhotos((current) => mergeAdminPhotos(current, incoming));`,
    "filtered photo count hydration",
  );
  code = replaceOnce(
    code,
    `  useEffect(() => {\n    if (firstFilterEffect.current) {\n      firstFilterEffect.current = false;\n      return;\n    }\n    void loadPhotos();\n  }, [albumId, categoryId, uploaderNameFilter, loadPhotos]);`,
    `  useEffect(() => {\n    if (firstFilterEffect.current) {\n      firstFilterEffect.current = false;\n      return;\n    }\n    setSelectedIds([]);\n    void loadPhotos();\n  }, [albumId, categoryId, uploaderNameFilter, loadPhotos]);`,
    "clear selection when filters change",
  );
  code = replaceOnce(
    code,
    `  const handleFiles = (event) => {`,
    `  const selectAllFilteredPhotos = async () => {\n    const requestId = ++requestRef.current;\n    setSelectingAllFiltered(true);\n    setPhotoError("");\n    try {\n      const selectedPhotos = [];\n      let cursor = null;\n      let total = 0;\n      do {\n        const payload = await adminRequest(\n          buildPhotoQuery(filters, cursor, { limit: 100, selection: true }),\n          { timeoutMs: 120_000 },\n        );\n        if (requestId !== requestRef.current) return;\n        const incoming = Array.isArray(payload.photos) ? payload.photos : [];\n        selectedPhotos.push(...incoming);\n        if (Number.isInteger(payload.total)) total = payload.total;\n        cursor = payload.nextCursor ?? null;\n      } while (cursor);\n\n      const uniquePhotos = [\n        ...new Map(selectedPhotos.map((photo) => [photo.id, photo])).values(),\n      ];\n      setPhotos((current) => mergeAdminPhotos(current, uniquePhotos));\n      setSelectedIds(uniquePhotos.map((photo) => photo.id));\n      setFilteredCount(total || uniquePhotos.length);\n    } catch (error) {\n      if (error?.status === 401) {\n        window.location.replace("/Memories/");\n        return;\n      }\n      if (requestId === requestRef.current) setPhotoError(adminErrorMessage(error));\n    } finally {\n      if (requestId === requestRef.current) setSelectingAllFiltered(false);\n    }\n  };\n\n  const handleFiles = (event) => {`,
    "select every filtered photo",
  );
  code = replaceOnce(
    code,
    `    uploading: "上傳中",`,
    `    uploading: "正在傳送到伺服器",\n    processing: "伺服器正在整理並儲存到 Google Drive",`,
    "administrator upload processing label",
  );
  code = replaceOnce(
    code,
    `        <span>{visiblePhotos.length} 張符合條件</span>`,
    `        <span>\n          {filteredCount} 張符合條件\n          {filteredCount > visiblePhotos.length\n            ? \`，目前顯示 \${visiblePhotos.length} 張\`\n            : ""}\n        </span>`,
    "filtered photo total heading",
  );
  code = replaceOnce(
    code,
    `      {visiblePhotos.length > 0 ? (\n        <div className="admin-photo-list">\n          {visiblePhotos.map((photo) => (\n            <Fragment key={photo.id}>{renderPhoto(photo)}</Fragment>\n          ))}\n        </div>`,
    `      <AdminPhotoBulkActions\n        albums={albums}\n        albumLabels={albumLabels}\n        photos={photos}\n        visiblePhotos={visiblePhotos}\n        selectedIds={selectedIds}\n        setSelectedIds={setSelectedIds}\n        setPhotos={setPhotos}\n        setPhotoDrafts={setPhotoDrafts}\n        disabled={busy || uploading || bulkBusy || selectingAllFiltered}\n        onBusyChange={setBulkBusy}\n        onReload={() => Promise.all([loadPhotos(), loadAuthors()])}\n        onSelectAllFiltered={selectAllFilteredPhotos}\n        selectingAllFiltered={selectingAllFiltered}\n        allFilteredSelected={allFilteredSelected}\n        filteredCount={filteredCount}\n      />\n\n      {visiblePhotos.length > 0 ? (\n        <div className="admin-photo-list">\n          {visiblePhotos.map((photo) => (\n            <div\n              className={\`admin-photo-selectable\${\n                selectedIdSet.has(photo.id) ? " is-selected" : ""\n              }\`}\n              key={photo.id}\n            >\n              <label className="admin-photo-select-control">\n                <input\n                  type="checkbox"\n                  checked={selectedIdSet.has(photo.id)}\n                  onChange={(event) =>\n                    setSelectedIds((current) =>\n                      event.target.checked\n                        ? [...new Set([...current, photo.id])]\n                        : current.filter((id) => id !== photo.id),\n                    )\n                  }\n                  disabled={busy || uploading || bulkBusy || selectingAllFiltered}\n                />\n                <span>選取</span>\n                {photo.deleteProtected && <small>婚禮攝影・不可刪除</small>}\n              </label>\n              {renderPhoto(photo, bulkBusy, albumLabels)}\n            </div>\n          ))}\n        </div>`,
    "selectable photo list",
  );
  return code;
}

export function adminPhotoWorkspaceUiTransform() {
  const responsiveLayout = adminResponsiveLayoutUiTransform();
  const albumPhotoOrder = albumPhotoOrderUiTransform();
  return {
    name: "admin-photo-workspace-ui",
    enforce: "pre",
    transform(source, id) {
      const normalizedId = id.split("?")[0].replace(/\\/g, "/");
      const albumOrderResult = albumPhotoOrder.transform(source, id);
      let code = albumOrderResult?.code ?? source;

      if (normalizedId.endsWith(UPLOAD_MODAL_SUFFIX)) {
        return { code: transformUploadModal(code), map: null };
      }
      if (normalizedId.endsWith(ADMIN_WORKSPACE_SUFFIX)) {
        return { code: transformAdminWorkspace(code), map: null };
      }
      if (!normalizedId.endsWith(ADMIN_APP_SUFFIX)) {
        return albumOrderResult ? { code, map: null } : null;
      }

      code = replaceOnce(
        code,
        `import "./admin-save-bar.css";`,
        `import "./admin-save-bar.css";\nimport LazyImage from "./LazyImage.jsx";\nimport AdminPhotoWorkspace, { mergeAdminPhotos } from "./AdminPhotoWorkspace.jsx";`,
        "AdminApp stylesheet import",
      );
      code = replaceOnce(
        code,
        `        <img src={photo.thumbnailUrl} alt="" loading="lazy" />`,
        `        <LazyImage\n          src={photo.thumbnailUrl}\n          alt=""\n          width={photo.width}\n          height={photo.height}\n        />`,
        "administrator photo lazy preview",
      );
      code = replaceOnce(
        code,
        `    setPhotos(photoData.photos);`,
        `    setPhotos((current) => mergeAdminPhotos(current, photoData.photos));`,
        "canonical photo merge",
      );
      code = transformDeleteFlow(code);
      code = replacePhotoTab(code);
      return responsiveLayout.transform(code, id);
    },
  };
}
