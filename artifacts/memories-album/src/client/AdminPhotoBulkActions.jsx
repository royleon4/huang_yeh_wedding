import { useMemo, useState } from "react";
import { adminErrorMessage, adminRequest } from "./admin-client.mjs";
import {
  buildBulkClassificationUpdates,
  buildBulkUploaderRequest,
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
  categories,
  visiblePhotos,
  selectedIds,
  setSelectedIds,
  setPhotos,
  setPhotoDrafts,
  disabled,
  onBusyChange,
  onReload,
}) {
  const [albumMode, setAlbumMode] = useState("keep");
  const [albumIds, setAlbumIds] = useState([]);
  const [categoryMode, setCategoryMode] = useState("keep");
  const [categoryId, setCategoryId] = useState("");
  const [bulkUploaderName, setBulkUploaderName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedPhotos = useMemo(
    () => visiblePhotos.filter((photo) => selectedSet.has(photo.id)),
    [selectedSet, visiblePhotos],
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
      const request = buildBulkUploaderRequest({
        photos: selectedPhotos,
        uploaderName: bulkUploaderName,
      });
      const payload = await adminRequest("/admin/api/photo-uploaders", {
        method: "PATCH",
        body: request,
        timeoutMs: 120_000,
      });
      const saved = successfulBulkUploaderResults(payload);
      const savedIds = new Set(saved.map((entry) => entry.id));
      const missingIds = Array.isArray(payload.missingIds)
        ? payload.missingIds.map(String)
        : [];

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
        setMessage(`已將 ${saved.length} 張照片的上傳者改為「${request.uploaderName}」。`);
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
        categoryMode,
        categoryId,
      });
      if (updates.length === 0) {
        setMessage("所選照片已經符合這些分類設定。");
        return;
      }

      const payload = await adminRequest("/admin/api/changes", {
        method: "PATCH",
        body: {
          albums: { create: [], update: [] },
          categories: { create: [], update: [] },
          photos: { update: updates },
        },
        timeoutMs: 120_000,
      });
      const saved = successfulBulkPhotoResults(payload);
      const savedIds = new Set(saved.map((entry) => entry.id));
      const failed = (payload.results ?? []).filter((result) => result.status === "error");

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
        setMessage(`已更新 ${saved.length} 張照片的分類。`);
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
        `確定永久刪除 ${targets.length} 張照片嗎？\n\n原圖、縮圖、所有相簿／流程關聯與資料庫紀錄都會立即刪除，無法復原。${protectedNote}`,
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
            {allVisibleSelected ? "取消全選" : "全選目前結果"}
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
          流程分類動作
          <select
            value={categoryMode}
            onChange={(event) => setCategoryMode(event.target.value)}
            disabled={disabled}
          >
            <option value="keep">保留目前流程分類</option>
            <option value="replace">更改流程分類</option>
          </select>
        </label>
        <label>
          新的流程分類
          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            disabled={disabled || categoryMode !== "replace"}
          >
            <option value="">清除流程分類</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {String(category.displayOrder).padStart(2, "0")} {category.labelZh}
              </option>
            ))}
          </select>
        </label>
      </div>

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
            (albumMode === "keep" && categoryMode === "keep")
          }
        >
          套用分類到 {selectedPhotos.length || ""} 張
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
