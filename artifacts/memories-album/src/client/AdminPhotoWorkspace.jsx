import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { adminErrorMessage, adminRequest } from "./admin-client.mjs";
import {
  retryFailedUploads,
  summarizeUploadResults,
  uploadQueue,
} from "./upload-client.mjs";
import "./admin-photo-workspace.css";
import AdminPhotoBulkActions from "./AdminPhotoBulkActions.jsx";

const MAX_FILES = 30;

// 「子分類（標籤）」由相簿擁有；production transform 會把這個相容層的
// categoryId 欄位改成 labelId 查詢與相簿分組控制。
export function mergeAdminPhotos(current, incoming) {
  const existing = Array.isArray(current) ? current : [];
  const additions = Array.isArray(incoming) ? incoming : [];
  const byId = new Map(existing.map((photo) => [photo.id, photo]));
  for (const photo of additions) {
    if (photo?.id) byId.set(photo.id, { ...(byId.get(photo.id) ?? {}), ...photo });
  }
  const seen = new Set();
  return [...existing, ...additions]
    .filter((photo) => photo?.id && !seen.has(photo.id) && seen.add(photo.id))
    .map((photo) => byId.get(photo.id));
}

function buildPhotoQuery({ albumId, categoryId, uploaderName }, cursor = null) {
  const query = new URLSearchParams({ limit: "50" });
  if (albumId) query.set("albumId", albumId);
  if (categoryId) query.set("categoryId", categoryId);
  if (uploaderName) query.set("uploaderName", uploaderName);
  if (cursor) query.set("cursor", cursor);
  return `/admin/api/photos?${query}`;
}

function uploadClassification(albumIds, categoryId) {
  if (albumIds.includes("wedding") && categoryId) {
    return { classification: "wedding", processId: categoryId };
  }
  if (albumIds.includes("life")) return { classification: "life", processId: null };
  return { classification: "guest", processId: null };
}

function statusLabel(status) {
  return {
    queued: "等待中",
    uploading: "正在傳送到伺服器",
    processing: "伺服器正在整理並儲存到 Google Drive",
    retrying: "連線不穩，正在重試",
    success: "已上傳",
    failed: "尚未完成",
    cancelled: "已暫停",
  }[status] ?? status;
}

export default function AdminPhotoWorkspace({
  albums,
  categories,
  photos,
  initialNextCursor,
  busy,
  refreshToken,
  setPhotos,
  setPhotoDrafts,
  renderPhoto,
}) {
  const [albumId, setAlbumId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [uploaderNameFilter, setUploaderNameFilter] = useState("");
  const [authors, setAuthors] = useState([]);
  const [visibleIds, setVisibleIds] = useState(() => photos.map((photo) => photo.id));
  const [pageCursor, setPageCursor] = useState(initialNextCursor ?? null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selectingAllFiltered, setSelectingAllFiltered] = useState(false);
  const [filteredCount, setFilteredCount] = useState(() => photos.length);

  const [uploadInputKey, setUploadInputKey] = useState(0);
  const [uploaderName, setUploaderName] = useState("");
  const [uploadAlbumIds, setUploadAlbumIds] = useState([]);
  const [uploadCategoryId, setUploadCategoryId] = useState("");
  const [files, setFiles] = useState([]);
  const [items, setItems] = useState([]);
  const [batch, setBatch] = useState(null);
  const [summary, setSummary] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const controllerRef = useRef(null);
  const requestRef = useRef(0);
  const firstFilterEffect = useRef(true);
  const previousRefreshToken = useRef(refreshToken);

  const filters = useMemo(
    () => ({ albumId, categoryId, uploaderName: uploaderNameFilter }),
    [albumId, categoryId, uploaderNameFilter],
  );
  const photosById = useMemo(
    () => new Map(photos.map((photo) => [photo.id, photo])),
    [photos],
  );
  const visiblePhotos = useMemo(
    () => visibleIds.map((id) => photosById.get(id)).filter(Boolean),
    [photosById, visibleIds],
  );
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allFilteredSelected =
    filteredCount > 0 && selectedIds.length === filteredCount;

  useEffect(() => {
    const available = new Set(photos.map((photo) => photo.id));
    setSelectedIds((current) => {
      const next = current.filter((id) => available.has(id));
      return next.length === current.length ? current : next;
    });
  }, [photos]);
  const overallProgress = useMemo(() => {
    if (items.length === 0) return 0;
    return Math.round(
      items.reduce((total, item) => total + Number(item.progress ?? 0), 0) /
        items.length,
    );
  }, [items]);
  const controlsLocked =
    busy || uploading || bulkBusy || selectingAllFiltered || Boolean(batch);
  const hasUnfinished = Boolean(summary?.failed || summary?.cancelled);

  useEffect(() => {
    setUploadAlbumIds((current) => {
      const valid = current.filter((id) => albums.some((album) => album.id === id));
      if (valid.length > 0) return valid;
      const preferred =
        albums.find((album) => album.id === "guest") ?? albums[0] ?? null;
      return preferred ? [preferred.id] : [];
    });
  }, [albums]);

  useEffect(() => {
    if (!uploadAlbumIds.includes("wedding") && uploadCategoryId) {
      setUploadCategoryId("");
    }
  }, [uploadAlbumIds, uploadCategoryId]);

  const loadAuthors = useCallback(async () => {
    try {
      const payload = await adminRequest("/admin/api/photo-authors");
      setAuthors(Array.isArray(payload.authors) ? payload.authors : []);
    } catch (error) {
      if (error?.status === 401) {
        window.location.replace("/Memories/");
      }
    }
  }, []);

  const loadPhotos = useCallback(
    async ({ append = false, cursor = null } = {}) => {
      const requestId = ++requestRef.current;
      setPhotoLoading(true);
      setPhotoError("");
      try {
        const payload = await adminRequest(buildPhotoQuery(filters, cursor));
        if (requestId !== requestRef.current) return;
        const incoming = Array.isArray(payload.photos) ? payload.photos : [];
        if (Number.isInteger(payload.total)) {
          setFilteredCount(payload.total);
        } else if (!append) {
          setFilteredCount(incoming.length);
        }
        setPhotos((current) => mergeAdminPhotos(current, incoming));
        setVisibleIds((current) => {
          const ids = incoming.map((photo) => photo.id);
          return append ? [...new Set([...current, ...ids])] : ids;
        });
        setPageCursor(payload.nextCursor ?? null);
      } catch (error) {
        if (error?.status === 401) {
          window.location.replace("/Memories/");
          return;
        }
        if (requestId === requestRef.current) setPhotoError(adminErrorMessage(error));
      } finally {
        if (requestId === requestRef.current) setPhotoLoading(false);
      }
    },
    [filters, setPhotos],
  );

  useEffect(() => {
    void loadAuthors();
  }, [loadAuthors]);

  useEffect(() => {
    if (firstFilterEffect.current) {
      firstFilterEffect.current = false;
      return;
    }
    setSelectedIds([]);
    void loadPhotos();
  }, [albumId, categoryId, uploaderNameFilter, loadPhotos]);

  useEffect(() => {
    if (previousRefreshToken.current === refreshToken) return;
    previousRefreshToken.current = refreshToken;
    if (refreshToken) void loadPhotos();
  }, [refreshToken, loadPhotos]);

  useEffect(() => {
    if (!albumId && !categoryId && !uploaderNameFilter) {
      setPageCursor(initialNextCursor ?? null);
    }
  }, [initialNextCursor, albumId, categoryId, uploaderNameFilter]);

  useEffect(
    () => () => {
      controllerRef.current?.abort();
      requestRef.current += 1;
    },
    [],
  );

  const selectAllFilteredPhotos = async () => {
    const requestId = ++requestRef.current;
    setSelectingAllFiltered(true);
    setPhotoError("");
    try {
      const selectedPhotos = [];
      let cursor = null;
      let total = 0;
      do {
        const payload = await adminRequest(
          buildPhotoQuery(filters, cursor, { limit: 100, selection: true }),
          { timeoutMs: 120_000 },
        );
        if (requestId !== requestRef.current) return;
        const incoming = Array.isArray(payload.photos) ? payload.photos : [];
        selectedPhotos.push(...incoming);
        if (Number.isInteger(payload.total)) total = payload.total;
        cursor = payload.nextCursor ?? null;
      } while (cursor);

      const uniquePhotos = [
        ...new Map(selectedPhotos.map((photo) => [photo.id, photo])).values(),
      ];
      setPhotos((current) => mergeAdminPhotos(current, uniquePhotos));
      setSelectedIds(uniquePhotos.map((photo) => photo.id));
      setFilteredCount(total || uniquePhotos.length);
    } catch (error) {
      if (error?.status === 401) {
        window.location.replace("/Memories/");
        return;
      }
      if (requestId === requestRef.current) setPhotoError(adminErrorMessage(error));
    } finally {
      if (requestId === requestRef.current) setSelectingAllFiltered(false);
    }
  };

  const handleFiles = (event) => {
    const selected = Array.from(event.target.files ?? []).slice(0, MAX_FILES);
    setFiles(selected);
    setItems(
      selected.map((file) => ({
        file,
        status: "queued",
        progress: 0,
        attempts: 0,
        error: null,
      })),
    );
    setBatch(null);
    setSummary(null);
    setUploadError("");
  };

  const handleUploadUpdate = (update) => {
    if (update.type === "batch") setBatch(update.batch);
    if (update.type === "queue") setItems(update.results);
    if (update.type === "file") {
      setItems((current) => {
        const next = [...current];
        next[update.index] = update.item;
        return next;
      });
    }
  };

  const finalizeUploadedPhotos = async (result, selection) => {
    const finalized = result.results.map((item) => ({ ...item }));
    for (let index = 0; index < finalized.length; index += 1) {
      const item = finalized[index];
      if (item.status !== "success" || !item.photo?.id) continue;
      try {
        await adminRequest(`/admin/api/photos/${encodeURIComponent(item.photo.id)}`, {
          method: "PATCH",
          body: {
            albumIds: selection.albumIds,
            categoryIds: selection.categoryId ? [selection.categoryId] : [],
          },
          timeoutMs: 120_000,
        });
      } catch (error) {
        finalized[index] = {
          ...item,
          status: "failed",
          retryable: true,
          code: error?.code || "ADMIN_CLASSIFICATION_FAILED",
          error: `照片已傳送，但分類尚未完成：${adminErrorMessage(error)}`,
        };
      }
    }
    return finalized;
  };

  const runUpload = async (operation, selection) => {
    setUploading(true);
    setUploadError("");
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const result = await operation(controller.signal);
      const finalized = await finalizeUploadedPhotos(result, selection);
      const nextSummary = summarizeUploadResults(finalized);
      setBatch(result.batch);
      setItems(finalized);
      setSummary(nextSummary);
      if (nextSummary.success > 0) {
        await Promise.all([loadPhotos(), loadAuthors()]);
      }
      if (nextSummary.failed === 0 && nextSummary.cancelled === 0) {
        setBatch(null);
        setFiles([]);
        setUploadInputKey((current) => current + 1);
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "照片上傳失敗");
    } finally {
      controllerRef.current = null;
      setUploading(false);
    }
  };

  const startUpload = async (event) => {
    event.preventDefault();
    const normalizedUploader = uploaderName.replace(/\s+/g, " ").trim();
    const selectedAlbums = [...new Set(uploadAlbumIds)].filter(Boolean);
    const selectedCategory = selectedAlbums.includes("wedding")
      ? uploadCategoryId
      : "";
    if (!normalizedUploader || files.length === 0 || selectedAlbums.length === 0) {
      setUploadError("請填寫上傳者、選擇至少一張照片，並指定至少一個相簿。");
      return;
    }
    const classification = uploadClassification(selectedAlbums, selectedCategory);
    const selection = { albumIds: selectedAlbums, categoryId: selectedCategory };
    await runUpload(
      (signal) =>
        uploadQueue({
          uploaderName: normalizedUploader,
          files,
          classification: classification.classification,
          processId: classification.processId,
          signal,
          onUpdate: handleUploadUpdate,
        }),
      selection,
    );
  };

  const retryUnfinished = () => {
    const selection = {
      albumIds: [...uploadAlbumIds],
      categoryId: uploadAlbumIds.includes("wedding") ? uploadCategoryId : "",
    };
    return runUpload(
      (signal) =>
        retryFailedUploads({
          batch,
          results: items,
          signal,
          onUpdate: handleUploadUpdate,
        }),
      selection,
    );
  };

  return (
    <section aria-labelledby="photos-title" className="admin-photo-workspace">
      <div className="admin-section-heading">
        <div>
          <p className="admin-kicker">PHOTOS</p>
          <h2 id="photos-title">照片</h2>
        </div>
        <span>
          {filteredCount} 張符合條件
          {filteredCount > visiblePhotos.length
            ? `，目前顯示 ${visiblePhotos.length} 張`
            : ""}
        </span>
      </div>

      <div className="admin-photo-filter-card" aria-label="照片篩選">
        <div className="admin-photo-filter-heading">
          <div>
            <strong>篩選照片</strong>
            <p>相簿、流程分類與作者可以同時套用。</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setAlbumId("");
              setCategoryId("");
              setUploaderNameFilter("");
            }}
            disabled={busy || (!albumId && !categoryId && !uploaderNameFilter)}
          >
            清除篩選
          </button>
        </div>
        <div className="admin-photo-filter-grid">
          <label>
            所屬相簿
            <select
              value={albumId}
              onChange={(event) => setAlbumId(event.target.value)}
              disabled={busy}
            >
              <option value="">全部相簿</option>
              {albums.map((album) => (
                <option key={album.id} value={album.id}>
                  {album.titleZh}
                </option>
              ))}
            </select>
          </label>
          <label>
            流程分類
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              disabled={busy}
            >
              <option value="">全部流程</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {String(category.displayOrder).padStart(2, "0")} {category.labelZh}
                </option>
              ))}
            </select>
          </label>
          <label>
            作者／上傳者
            <select
              value={uploaderNameFilter}
              onChange={(event) => setUploaderNameFilter(event.target.value)}
              disabled={busy}
            >
              <option value="">全部作者</option>
              {authors.map((author) => (
                <option key={author} value={author}>
                  {author}
                </option>
              ))}
            </select>
          </label>
        </div>
        {photoLoading && <p className="admin-photo-inline-status">正在篩選照片…</p>}
        {photoError && (
          <p className="admin-photo-inline-status error" role="alert">
            {photoError}
          </p>
        )}
      </div>

      <form className="admin-photo-batch-card" onSubmit={startUpload}>
        <div className="admin-photo-batch-heading">
          <div>
            <h3>新增照片</h3>
            <p>沿用訪客端的可靠批次上傳流程，一次最多 30 張。</p>
          </div>
          {items.length > 0 && <strong>{overallProgress}%</strong>}
        </div>

        <div className="admin-photo-upload-grid">
          <label>
            上傳者／作者
            <input
              type="text"
              value={uploaderName}
              onChange={(event) => setUploaderName(event.target.value)}
              placeholder="例如：婚禮攝影、小安"
              maxLength={80}
              required
              disabled={controlsLocked}
            />
          </label>
          <label className="admin-photo-file-field">
            選擇照片
            <input
              key={uploadInputKey}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              multiple
              onChange={handleFiles}
              disabled={controlsLocked}
            />
            <small>JPEG、PNG、WebP、HEIC／HEIF；每張上限 25 MB。</small>
          </label>
        </div>

        <fieldset className="admin-photo-upload-albums" disabled={controlsLocked}>
          <legend>所屬相簿</legend>
          {albums.map((album) => (
            <label key={album.id} className="admin-check">
              <input
                type="checkbox"
                checked={uploadAlbumIds.includes(album.id)}
                onChange={(event) => {
                  setUploadAlbumIds((current) =>
                    event.target.checked
                      ? [...new Set([...current, album.id])]
                      : current.filter((id) => id !== album.id),
                  );
                }}
              />
              {album.titleZh}
            </label>
          ))}
        </fieldset>

        <label className="admin-photo-process-field">
          流程分類
          <select
            value={uploadCategoryId}
            onChange={(event) => setUploadCategoryId(event.target.value)}
            disabled={controlsLocked || !uploadAlbumIds.includes("wedding")}
          >
            <option value="">不指定流程</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {String(category.displayOrder).padStart(2, "0")} {category.labelZh}
              </option>
            ))}
          </select>
          {!uploadAlbumIds.includes("wedding") && (
            <small>勾選「婚禮流程」相簿後才可選擇。</small>
          )}
        </label>

        {items.length > 0 && (
          <div className="admin-photo-upload-queue" aria-live="polite">
            <progress max="100" value={overallProgress} />
            <ol>
              {items.map((item, index) => (
                <li key={`${item.file.name}-${item.file.lastModified}-${index}`}>
                  <div>
                    <strong>{item.file.name}</strong>
                    <small>
                      {statusLabel(item.status)}
                      {item.attempts > 1 ? ` · 第 ${item.attempts} 次` : ""}
                      {item.error ? ` · ${item.error}` : ""}
                    </small>
                  </div>
                  <span>{item.progress ?? 0}%</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {uploadError && (
          <p className="admin-photo-inline-status error" role="alert">
            {uploadError}
          </p>
        )}
        {summary && (
          <p className="admin-photo-inline-status" role="status">
            完成 {summary.success} 張
            {summary.failed ? `，${summary.failed} 張尚未完成` : ""}
            {summary.cancelled ? `，${summary.cancelled} 張已暫停` : ""}。
          </p>
        )}

        <div className="admin-photo-upload-actions">
          {!uploading && !hasUnfinished && (
            <button
              type="submit"
              disabled={
                busy ||
                files.length === 0 ||
                !uploaderName.trim() ||
                uploadAlbumIds.length === 0
              }
            >
              上傳 {files.length || ""} 張照片
            </button>
          )}
          {uploading && (
            <button type="button" onClick={() => controllerRef.current?.abort()}>
              暫停上傳
            </button>
          )}
          {!uploading && hasUnfinished && batch && (
            <button type="button" onClick={() => void retryUnfinished()} disabled={busy}>
              繼續未完成照片
            </button>
          )}
        </div>
      </form>

      <AdminPhotoBulkActions
        albums={albums}
        albumLabels={albumLabels}
        photos={photos}
        visiblePhotos={visiblePhotos}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        setPhotos={setPhotos}
        setPhotoDrafts={setPhotoDrafts}
        disabled={busy || uploading || bulkBusy || selectingAllFiltered}
        onBusyChange={setBulkBusy}
        onReload={() => Promise.all([loadPhotos(), loadAuthors()])}
        onSelectAllFiltered={selectAllFilteredPhotos}
        selectingAllFiltered={selectingAllFiltered}
        allFilteredSelected={allFilteredSelected}
        filteredCount={filteredCount}
      />

      {visiblePhotos.length > 0 ? (
        <div className="admin-photo-list">
          {visiblePhotos.map((photo) => (
            <div
              className={`admin-photo-selectable${
                selectedIdSet.has(photo.id) ? " is-selected" : ""
              }`}
              key={photo.id}
            >
              <label className="admin-photo-select-control">
                <input
                  type="checkbox"
                  checked={selectedIdSet.has(photo.id)}
                  onChange={(event) =>
                    setSelectedIds((current) =>
                      event.target.checked
                        ? [...new Set([...current, photo.id])]
                        : current.filter((id) => id !== photo.id),
                    )
                  }
                  disabled={busy || uploading || bulkBusy || selectingAllFiltered}
                />
                <span>選取</span>
                {photo.deleteProtected && <small>婚禮攝影・不可刪除</small>}
              </label>
              {renderPhoto(photo, bulkBusy, albumLabels)}
            </div>
          ))}
        </div>
      ) : (
        !photoLoading && (
          <div className="admin-photo-empty">
            <strong>沒有符合目前條件的照片</strong>
            <p>可調整或清除上方篩選條件。</p>
          </div>
        )
      )}

      {pageCursor && (
        <button
          className="admin-load-more"
          type="button"
          onClick={() => void loadPhotos({ append: true, cursor: pageCursor })}
          disabled={busy || photoLoading}
        >
          {photoLoading ? "載入中…" : "載入更多照片"}
        </button>
      )}
    </section>
  );
}
