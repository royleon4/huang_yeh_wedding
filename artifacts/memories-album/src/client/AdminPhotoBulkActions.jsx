import { useMemo, useState } from "react";
import { adminErrorMessage, adminRequest } from "./admin-client.mjs";
import { buildAlbumLabelGroups, findAlbumLabel } from "./album-labels.mjs";
import {
  buildBulkClassificationUpdates,
  buildBulkUploaderRequest,
  chunkBulkItems,
  isWeddingPhotographerProtected,
  successfulBulkPhotoResults,
  successfulBulkUploaderResults,
} from "./admin-photo-bulk-actions.mjs";
import "./admin-photo-bulk-actions.css";

function mergeUpdatedPhotos(current, updates) {
  const byId = new Map(updates.map((entry) => [entry.id, entry.photo]));
  return current.map((photo) => {
    const saved = byId.get(photo.id);
    return saved
      ? {
          ...photo,
          ...saved,
          uploaderName: photo.uploaderName ?? "",
          deleteProtected: Boolean(photo.deleteProtected),
        }
      : photo;
  });
}

function mergeUpdatedUploaders(current, updates) {
  const byId = new Map(updates.map((entry) => [entry.id, entry]));
  return current.map((photo) => {
    const saved = byId.get(photo.id);
    return saved
      ? {
          ...photo,
          uploaderName: saved.uploaderName,
          deleteProtected: saved.deleteProtected,
        }
      : photo;
  });
}

function mergeUploaderDrafts(setPhotoDrafts, updates) {
  if (typeof setPhotoDrafts !== "function" || updates.length === 0) return;
  const byId = new Map(updates.map((entry) => [entry.id, entry]));
  setPhotoDrafts((current) => {
    let changed = false;
    const next = { ...current };
    for (const [id, saved] of byId) {
      if (!next[id]) continue;
      next[id] = {
        ...next[id],
        uploaderName: saved.uploaderName,
        deleteProtected: saved.deleteProtected,
      };
      changed = true;
    }
    return changed ? next : current;
  });
}

function clearDrafts(setPhotoDrafts, ids) {
  if (typeof setPhotoDrafts !== "function" || ids.size === 0) return;
  setPhotoDrafts((current) => {
    const next = { ...current };
    for (const id of ids) delete next[id];
    return next;
  });
}

export default function AdminPhotoBulkActions({
  albums,
  albumLabels,
  photos,
  visiblePhotos,
  selectedIds,
  setSelectedIds,
  setPhotos,
  setPhotoDrafts,
  disabled,
  onBusyChange,
  onReload,
  onSelectAllFiltered,
  selectingAllFiltered = false,
  allFilteredSelected = false,
  filteredCount = 0,
}) {
  const [albumMode, setAlbumMode] = useState("keep");
  const [albumIds, setAlbumIds] = useState([]);
  const [labelMode, setLabelMode] = useState("keep");
  const [labelId, setLabelId] = useState("");
  const [bulkUploaderName, setBulkUploaderName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedPhotos = useMemo(
    () => photos.filter((photo) => selectedSet.has(photo.id)),
    [photos, selectedSet],
  );
  const labelGroups = useMemo(
    () => buildAlbumLabelGroups(albums, albumLabels),
    [albums, albumLabels],
  );
  const selectedLabel = useMemo(
    () => findAlbumLabel(albumLabels, labelId),
    [albumLabels, labelId],
  );
  const protectedCount = selectedPhotos.filter(isWeddingPhotographerProtected).length;
  const deletableCount = selectedPhotos.length - protectedCount;
  const allVisibleSelected =
    visiblePhotos.length > 0 && visiblePhotos.every((photo) => selectedSet.has(photo.id));

  const toggleAlbum = (id, checked) => {
    setAlbumIds((current) =>
      checked ? [...new Set([...current, id])] : current.filter((item) => item !== id),
    );
  };

  const runBusy = async (operation) => {
    onBusyChange?.(true);
    setMessage("");
    setError("");
    try {
      await operation();
    } catch (operationError) {
      if (operationError?.status === 401) {
        window.location.replace("/Memories/");
        return;
      }
      setError(adminErrorMessage(operationError));
    } finally {
      onBusyChange?.(false);
    }
  };

  const applyUploaderName = () =>
    runBusy(async () => {
      if (selectedPhotos.length === 0) {
        setError("請先選取至少一張照片。");
        return;
      }

      const saved = [];
      const missingIds = [];
      let normalizedUploaderName = "";
      for (const photoChunk of chunkBulkItems(selectedPhotos, 100)) {
        const request = buildBulkUploaderRequest({
          photos: photoChunk,
          uploaderName: bulkUploaderName,
        });
        normalizedUploaderName = request.uploaderName;
        const payload = await adminRequest("/admin/api/photo-uploaders", {
          method: "PATCH",
          body: request,
          timeoutMs: 120_000,
        });
        saved.push(...successfulBulkUploaderResults(payload));
        if (Array.isArray(payload.missingIds)) {
          missingIds.push(...payload.missingIds.map(String));
        }
      }

      const savedIds = new Set(saved.map((entry) => entry.id));
      if (saved.length > 0) {
        setPhotos((current) => mergeUpdatedUploaders(current, saved));
        mergeUploaderDrafts(setPhotoDrafts, saved);
        setSelectedIds((current) => current.filter((id) => !savedIds.has(id)));
      }
      setBulkUploaderName("");
      await onReload?.();

      if (missingIds.length > 0) {
        setError(
          `${saved.length} 張已更新，${missingIds.length} 張已不存在或無法修改。`,
        );
      } else {
        setMessage(
          `已將 ${saved.length} 張照片的上傳者改為「${normalizedUploaderName}」。`,
        );
      }
    });

  const applyClassification = () =>
    runBusy(async () => {
      if (selectedPhotos.length === 0) {
        setError("請先選取至少一張照片。");
        return;
      }
      const updates = buildBulkClassificationUpdates({
        photos: selectedPhotos,
        albumMode,
        albumIds,
        labelMode,
        labelId,
        selectedLabel,
      });
      if (updates.length === 0) {
        setMessage("所選照片已經符合這些相簿與子分類／標籤設定。");
        return;
      }

      const saved = [];
      const failed = [];
      for (const updateChunk of chunkBulkItems(updates, 500)) {
        const payload = await adminRequest("/admin/api/changes", {
          method: "PATCH",
          body: {
            albums: { create: [], update: [] },
            categories: { create: [], update: [] },
            photos: { update: updateChunk },
          },
          timeoutMs: 120_000,
        });
        saved.push(...successfulBulkPhotoResults(payload));
        failed.push(
          ...(payload.results ?? []).filter((result) => result.status === "error"),
        );
      }

      const savedIds = new Set(saved.map((entry) => entry.id));
      if (saved.length > 0) {
        setPhotos((current) => mergeUpdatedPhotos(current, saved));
        clearDrafts(setPhotoDrafts, savedIds);
      }
      setSelectedIds((current) => current.filter((id) => !savedIds.has(id)));
      await onReload?.();

      if (failed.length > 0) {
        setError(
          `${saved.length} 張已更新，${failed.length} 張失敗：${[
            ...new Set(failed.map((item) => item.error || item.code || "分類更新失敗")),
          ].join("；")}`,
        );
      } else {
        setMessage(`已更新 ${saved.length} 張照片的相簿與子分類／標籤。`);
      }
    });

  const deleteSelected = () =>
    runBusy(async () => {
      const targets = selectedPhotos.filter(
        (photo) => !isWeddingPhotographerProtected(photo),
      );
      if (targets.length === 0) {
        setError(
          selectedPhotos.length > 0
            ? "所選照片皆為婚禮攝影照片，受保護且不可永久刪除。"
            : "請先選取至少一張照片。",
        );
        return;
      }

      const protectedNote = protectedCount
        ? `\n\n另有 ${protectedCount} 張婚禮攝影照片受保護，將自動略過。`
        : "";
      const confirmed = window.confirm(
        `確定永久刪除 ${targets.length} 張照片嗎？\n\n原圖、縮圖、所有相簿／子分類標籤關聯與資料庫紀錄都會立即刪除，無法復原。${protectedNote}`,
      );
      if (!confirmed) return;

      const deletedIds = new Set();
      const failures = [];
      const pending = new Map(targets.map((photo) => [photo.id, photo]));
      for (const photo of targets) {
        if (!pending.has(photo.id)) continue;
        try {
          const deletion = await adminRequest(
            `/admin/api/photos/${encodeURIComponent(photo.id)}`,
            { method: "DELETE", timeoutMs: 120_000 },
          );
          const familyIds =
            Array.isArray(deletion.deletedIds) && deletion.deletedIds.length > 0
              ? deletion.deletedIds.map(String)
              : [String(photo.id)];
          for (const id of familyIds) {
            deletedIds.add(id);
            pending.delete(id);
          }
        } catch (deleteError) {
          if (deleteError?.status === 401) throw deleteError;
          failures.push(
            `${photo.displayName || photo.originalFilename || photo.id}：${adminErrorMessage(
              deleteError,
            )}`,
          );
          pending.delete(photo.id);
        }
      }

      if (deletedIds.size > 0) {
        setPhotos((current) => current.filter((photo) => !deletedIds.has(photo.id)));
        clearDrafts(setPhotoDrafts, deletedIds);
      }
      setSelectedIds((current) => current.filter((id) => !deletedIds.has(id)));
      await onReload?.();

      if (failures.length > 0) {
        setError(
          `${deletedIds.size} 筆照片紀錄已永久刪除，${failures.length} 項失敗：${failures.join(
            "；",
          )}`,
        );
      } else {
        setMessage(
          protectedCount
            ? `已永久刪除 ${deletedIds.size} 筆照片紀錄；${protectedCount} 張婚禮攝影照片已略過。`
            : `已永久刪除 ${deletedIds.size} 筆照片紀錄。`,
        );
      }
    });

  return (
    <section className="admin-photo-bulk-card" aria-label="批次處理照片">
      <div className="admin-photo-bulk-heading">
        <div>
          <strong>批次處理</strong>
          <p>
            已選取 {selectedPhotos.length} 張
            {allFilteredSelected ? "（包含尚未顯示的所有篩選結果）" : ""}
            {protectedCount ? `，其中 ${protectedCount} 張婚禮攝影照片不可刪除` : ""}。
          </p>
        </div>
        <div className="admin-photo-selection-actions">
          <button
            type="button"
            onClick={() =>
              setSelectedIds(allVisibleSelected ? [] : visiblePhotos.map((photo) => photo.id))
            }
            disabled={disabled || visiblePhotos.length === 0}
          >
            {allVisibleSelected ? "取消全選目前結果" : "全選目前已顯示結果"}
          </button>
          <button
            type="button"
            onClick={() => void onSelectAllFiltered?.()}
            disabled={disabled || selectingAllFiltered || filteredCount === 0}
          >
            {selectingAllFiltered
              ? "正在選取所有篩選照片…"
              : allFilteredSelected
                ? `已選取所有 ${filteredCount} 張篩選照片`
                : "套用設定到所有篩選照片"}
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds([])}
            disabled={disabled || selectedPhotos.length === 0}
          >
            清除選取
          </button>
        </div>
      </div>

      <div className="admin-photo-bulk-uploader">
        <label>
          批次更改上傳者／作者
          <input
            type="text"
            value={bulkUploaderName}
            onChange={(event) => setBulkUploaderName(event.target.value)}
            placeholder="輸入要套用到所選照片的名稱"
            maxLength={80}
            disabled={disabled}
          />
        </label>
        <button
          type="button"
          onClick={() => void applyUploaderName()}
          disabled={
            disabled ||
            selectedPhotos.length === 0 ||
            !bulkUploaderName.replace(/\s+/g, " ").trim()
          }
        >
          更改 {selectedPhotos.length || ""} 張上傳者
        </button>
        <p>輸入「婚禮攝影」會將所選照片設為受保護的婚禮攝影照片。</p>
      </div>

      <div className="admin-photo-bulk-grid">
        <label>
          相簿動作
          <select
            value={albumMode}
            onChange={(event) => setAlbumMode(event.target.value)}
            disabled={disabled}
          >
            <option value="keep">保留目前相簿</option>
            <option value="add">增加到所選相簿</option>
            <option value="replace">改為所選相簿</option>
          </select>
        </label>
        <label>
          子分類／標籤動作
          <select
            value={labelMode}
            onChange={(event) => setLabelMode(event.target.value)}
            disabled={disabled}
          >
            <option value="keep">保留目前子分類／標籤</option>
            <option value="replace">更改子分類／標籤</option>
          </select>
        </label>
        <label>
          新的子分類／標籤
          <select
            value={labelId}
            onChange={(event) => setLabelId(event.target.value)}
            disabled={disabled || labelMode !== "replace"}
          >
            <option value="">清除子分類／標籤</option>
            {labelGroups.map((group) => (
              <optgroup key={group.album.id} label={group.album.titleZh}>
                {group.labels.map((label) => (
                  <option key={label.id} value={label.id}>
                    {String(label.displayOrder).padStart(2, "0")} {label.labelZh}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      </div>

      {labelMode === "replace" && selectedLabel && (
        <p className="admin-photo-inline-status">
          選取此標籤時，系統會確保照片同時屬於「
          {albums.find((album) => album.id === selectedLabel.albumId)?.titleZh ||
            selectedLabel.albumId}
          」相簿。
        </p>
      )}

      {albumMode !== "keep" && (
        <fieldset className="admin-photo-bulk-albums" disabled={disabled}>
          <legend>{albumMode === "add" ? "要增加的相簿" : "新的相簿"}</legend>
          {albums.map((album) => (
            <label key={album.id} className="admin-check">
              <input
                type="checkbox"
                checked={albumIds.includes(album.id)}
                onChange={(event) => toggleAlbum(album.id, event.target.checked)}
              />
              {album.titleZh}
            </label>
          ))}
        </fieldset>
      )}

      <div className="admin-photo-bulk-actions">
        <button
          type="button"
          onClick={() => void applyClassification()}
          disabled={
            disabled ||
            selectedPhotos.length === 0 ||
            (albumMode === "keep" && labelMode === "keep")
          }
        >
          套用設定到 {selectedPhotos.length || ""} 張
        </button>
        <button
          className="danger"
          type="button"
          onClick={() => void deleteSelected()}
          disabled={disabled || deletableCount === 0}
        >
          永久刪除 {deletableCount || ""} 張
        </button>
      </div>

      {message && (
        <p className="admin-photo-inline-status" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="admin-photo-inline-status error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
