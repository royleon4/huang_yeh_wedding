import { useEffect, useMemo, useState } from "react";
import "./admin-save-bar.css";
import {
  adminErrorMessage,
  adminRequest,
  logoutAdministrator,
} from "./admin-client.mjs";
import {
  albumDraft,
  buildAdminChangeSet,
  categoryDraft,
  photoDraft,
  successfulResultKeys,
} from "./admin-change-set.mjs";

function toLocalDateTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toIso(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

function withoutSuccessfulDrafts(current, prefix, successful) {
  return Object.fromEntries(
    Object.entries(current).filter(([id]) => !successful.has(`${prefix}${id}`)),
  );
}

function normalizedVideoDraft(category) {
  return {
    youtubeUrl: category.youtubeUrl ?? "",
    youtubeAutoplay: Boolean(category.youtubeAutoplay),
  };
}

function AlbumEditor({ album, draft, busy, onChange }) {
  return (
    <form className="admin-editor-card" onSubmit={(event) => event.preventDefault()}>
      <div className="admin-editor-heading">
        <strong>{album.titleZh}</strong>
        <span>{album.isSystem ? "系統相簿" : "自訂相簿"}</span>
      </div>
      <div className="admin-field-grid">
        <label>
          中文名稱
          <input
            value={draft.titleZh}
            onChange={(event) => onChange({ titleZh: event.target.value })}
            required
            disabled={busy}
          />
        </label>
        <label>
          英文名稱
          <input
            value={draft.titleEn}
            onChange={(event) => onChange({ titleEn: event.target.value })}
            disabled={busy}
          />
        </label>
        <label className="admin-wide-field">
          中文說明
          <textarea
            value={draft.descriptionZh}
            onChange={(event) => onChange({ descriptionZh: event.target.value })}
            disabled={busy}
          />
        </label>
        <label className="admin-wide-field">
          英文說明
          <textarea
            value={draft.descriptionEn}
            onChange={(event) => onChange({ descriptionEn: event.target.value })}
            disabled={busy}
          />
        </label>
      </div>
      <div className="admin-card-actions">
        <label className="admin-check">
          <input
            type="checkbox"
            checked={draft.isVisible}
            onChange={(event) => onChange({ isVisible: event.target.checked })}
            disabled={busy}
          />
          對訪客顯示
        </label>
        <span className="admin-draft-hint">變更會由頁面底部統一儲存</span>
      </div>
    </form>
  );
}

function CategoryEditor({
  category,
  draft,
  videoDraft,
  busy,
  onChange,
  onVideoChange,
  onMove,
  first,
  last,
}) {
  return (
    <form
      className="admin-editor-card admin-category-row"
      onSubmit={(event) => event.preventDefault()}
    >
      <span className="admin-order-number">
        {String(category.displayOrder).padStart(2, "0")}
      </span>
      <label>
        中文分類
        <input
          value={draft.labelZh}
          onChange={(event) => onChange({ labelZh: event.target.value })}
          required
          disabled={busy}
        />
      </label>
      <label>
        英文分類
        <input
          value={draft.labelEn}
          onChange={(event) => onChange({ labelEn: event.target.value })}
          disabled={busy}
        />
      </label>
      <label className="admin-wide-field admin-youtube-field">
        YouTube 連結
        <input
          type="url"
          value={videoDraft.youtubeUrl}
          onChange={(event) => onVideoChange({ youtubeUrl: event.target.value })}
          placeholder="https://www.youtube.com/watch?v=..."
          disabled={busy}
        />
      </label>
      <label className="admin-check admin-youtube-autoplay">
        <input
          type="checkbox"
          checked={videoDraft.youtubeAutoplay}
          onChange={(event) =>
            onVideoChange({ youtubeAutoplay: event.target.checked })
          }
          disabled={busy || !videoDraft.youtubeUrl.trim()}
        />
        前端自動播放（會靜音以符合手機瀏覽器規則）
      </label>
      <div className="admin-row-actions">
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={busy || first}
          aria-label={`將 ${category.labelZh} 往前移`}
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={busy || last}
          aria-label={`將 ${category.labelZh} 往後移`}
        >
          ↓
        </button>
      </div>
    </form>
  );
}

function AlbumChoices({ albums, selected, onChange, disabled }) {
  return (
    <fieldset className="admin-album-choices" disabled={disabled}>
      <legend>所屬相簿</legend>
      {albums.map((album) => (
        <label key={album.id} className="admin-check">
          <input
            type="checkbox"
            checked={selected.includes(album.id)}
            onChange={(event) => {
              onChange(
                event.target.checked
                  ? [...selected, album.id]
                  : selected.filter((id) => id !== album.id),
              );
            }}
          />
          {album.titleZh}
        </label>
      ))}
    </fieldset>
  );
}

function PhotoEditor({
  photo,
  draft,
  albums,
  categories,
  busy,
  onChange,
  onDelete,
}) {
  return (
    <form className="admin-photo-card" onSubmit={(event) => event.preventDefault()}>
      <div className="admin-photo-preview">
        <img src={photo.thumbnailUrl} alt="" loading="lazy" />
        <span>{draft.visibility === "public" ? "公開" : "隱藏"}</span>
      </div>
      <div className="admin-photo-fields">
        <label>
          顯示名稱
          <input
            value={draft.displayName}
            onChange={(event) => onChange({ displayName: event.target.value })}
            required
            disabled={busy}
          />
        </label>
        <label>
          拍攝時間
          <input
            type="datetime-local"
            value={toLocalDateTime(draft.capturedAt)}
            onChange={(event) => onChange({ capturedAt: toIso(event.target.value) })}
            required
            disabled={busy}
          />
        </label>
        <label>
          流程分類
          <select
            value={draft.categoryIds[0] ?? ""}
            onChange={(event) =>
              onChange({ categoryIds: event.target.value ? [event.target.value] : [] })
            }
            disabled={busy}
          >
            <option value="">不指定流程</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {String(category.displayOrder).padStart(2, "0")} {category.labelZh}
              </option>
            ))}
          </select>
        </label>
        <label>
          公開狀態
          <select
            value={draft.visibility}
            onChange={(event) => onChange({ visibility: event.target.value })}
            disabled={busy}
          >
            <option value="public">公開</option>
            <option value="hidden">隱藏</option>
          </select>
        </label>
        <AlbumChoices
          albums={albums}
          selected={draft.albumIds}
          onChange={(albumIds) => onChange({ albumIds })}
          disabled={busy}
        />
        {draft.albumIds.length === 0 && (
          <p className="admin-form-error">照片至少必須屬於一個相簿。</p>
        )}
        <div className="admin-photo-actions">
          <span className="admin-draft-hint">變更會由頁面底部統一儲存</span>
          <button
            className="admin-permanent-delete"
            type="button"
            onClick={onDelete}
            disabled={busy}
            aria-label={`永久刪除 ${draft.displayName}`}
            title="永久刪除照片"
          >
            <span aria-hidden="true">🗑</span>
            永久刪除
          </button>
        </div>
      </div>
    </form>
  );
}

const EMPTY_ALBUM = {
  titleZh: "",
  titleEn: "",
  descriptionZh: "",
  descriptionEn: "",
  isVisible: true,
};
const EMPTY_CATEGORY = {
  labelZh: "",
  labelEn: "",
  youtubeUrl: "",
  youtubeAutoplay: false,
};

export default function AdminApp() {
  const [tab, setTab] = useState("albums");
  const [albums, setAlbums] = useState([]);
  const [categories, setCategories] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [albumDrafts, setAlbumDrafts] = useState({});
  const [categoryDrafts, setCategoryDrafts] = useState({});
  const [categoryVideoDrafts, setCategoryVideoDrafts] = useState({});
  const [photoDrafts, setPhotoDrafts] = useState({});
  const [categoryOrder, setCategoryOrder] = useState([]);
  const [newAlbum, setNewAlbum] = useState(EMPTY_ALBUM);
  const [newCategory, setNewCategory] = useState(EMPTY_CATEGORY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const orderedCategories = useMemo(() => {
    const byId = new Map(categories.map((category) => [category.id, category]));
    const ordered = categoryOrder.map((id) => byId.get(id)).filter(Boolean);
    for (const category of categories) {
      if (!categoryOrder.includes(category.id)) ordered.push(category);
    }
    return ordered.map((category, index) => ({
      ...category,
      displayOrder: index + 1,
    }));
  }, [categories, categoryOrder]);

  const changeSet = useMemo(
    () =>
      buildAdminChangeSet({
        albums,
        albumDrafts,
        newAlbum,
        categories,
        categoryDrafts,
        categoryOrder,
        newCategory,
        photos,
        photoDrafts,
      }),
    [
      albums,
      albumDrafts,
      newAlbum,
      categories,
      categoryDrafts,
      categoryOrder,
      newCategory,
      photos,
      photoDrafts,
    ],
  );

  const categoryVideoChanges = useMemo(
    () =>
      categories
        .map((category) => {
          const draft = categoryVideoDrafts[category.id];
          if (!draft) return null;
          const original = normalizedVideoDraft(category);
          const next = {
            youtubeUrl: String(draft.youtubeUrl ?? "").trim(),
            youtubeAutoplay: Boolean(draft.youtubeAutoplay),
          };
          return original.youtubeUrl.trim() !== next.youtubeUrl ||
            original.youtubeAutoplay !== next.youtubeAutoplay
            ? { id: category.id, values: next }
            : null;
        })
        .filter(Boolean),
    [categories, categoryVideoDrafts],
  );

  const pendingCount = changeSet.count + categoryVideoChanges.length;

  const replaceUnauthorized = (loadError) => {
    if (loadError?.status !== 401) return false;
    window.location.replace("/Memories/");
    return true;
  };

  const loadCanonical = async ({ preserveCategoryOrder = false } = {}) => {
    const [albumData, categoryData, photoData] = await Promise.all([
      adminRequest("/admin/api/albums"),
      adminRequest("/admin/api/categories"),
      adminRequest("/admin/api/photos?limit=50"),
    ]);
    setAlbums(albumData.albums);
    setCategories(categoryData.categories);
    setPhotos(photoData.photos);
    setNextCursor(photoData.nextCursor);
    if (!preserveCategoryOrder) {
      setCategoryOrder(categoryData.categories.map((category) => category.id));
    }
  };

  useEffect(() => {
    document.documentElement.lang = "zh-Hant";
    document.title = "管理後台｜詠葉婚禮照片檔案館";
    let cancelled = false;
    void adminRequest("/admin/api/session")
      .then(() => loadCanonical())
      .catch((loadError) => {
        if (replaceUnauthorized(loadError)) return;
        if (!cancelled) setError(adminErrorMessage(loadError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (pendingCount === 0) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pendingCount]);

  const confirmDiscard = () =>
    pendingCount === 0 || window.confirm("尚有未儲存的變更，確定要離開嗎？");

  const updateAlbumDraft = (album, changes) => {
    setAlbumDrafts((current) => ({
      ...current,
      [album.id]: { ...(current[album.id] ?? albumDraft(album)), ...changes },
    }));
  };

  const updateCategoryDraft = (category, changes) => {
    setCategoryDrafts((current) => ({
      ...current,
      [category.id]: {
        ...(current[category.id] ?? categoryDraft(category)),
        ...changes,
      },
    }));
  };

  const updateCategoryVideoDraft = (category, changes) => {
    setCategoryVideoDrafts((current) => ({
      ...current,
      [category.id]: {
        ...(current[category.id] ?? normalizedVideoDraft(category)),
        ...changes,
      },
    }));
  };

  const updatePhotoDraft = (photo, changes) => {
    setPhotoDrafts((current) => ({
      ...current,
      [photo.id]: { ...(current[photo.id] ?? photoDraft(photo)), ...changes },
    }));
  };

  const moveCategory = (index, direction) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= orderedCategories.length) return;
    const reordered = orderedCategories.map((category) => category.id);
    [reordered[index], reordered[nextIndex]] = [
      reordered[nextIndex],
      reordered[index],
    ];
    setCategoryOrder(reordered);
  };

  const saveAll = async () => {
    if (busy || pendingCount === 0) return;
    setBusy(true);
    setMessage("");
    setError("");
    const failures = [];
    let succeeded = 0;
    let preserveCategoryOrder = changeSet.reordered;
    let failedCreatedVideo = null;

    try {
      if (changeSet.count > 0) {
        const payload = await adminRequest("/admin/api/changes", {
          method: "PATCH",
          body: changeSet.payload,
          timeoutMs: 120_000,
        });
        const successful = successfulResultKeys(payload.results);
        succeeded += payload.summary?.succeeded ?? successful.size;
        failures.push(
          ...(payload.results ?? [])
            .filter((result) => result.status === "error")
            .map((result) => result.error || result.code || "變更儲存失敗"),
        );

        setAlbumDrafts((current) =>
          withoutSuccessfulDrafts(current, "album:update:", successful),
        );
        setCategoryDrafts((current) =>
          withoutSuccessfulDrafts(current, "category:update:", successful),
        );
        setPhotoDrafts((current) =>
          withoutSuccessfulDrafts(current, "photo:update:", successful),
        );
        if (successful.has("album:create:new-album")) setNewAlbum(EMPTY_ALBUM);
        if (successful.has("category:create:new-category")) {
          const created = (payload.results ?? []).find(
            (result) => result.key === "category:create:new-category" && result.status === "ok",
          );
          const requestedVideo = {
            youtubeUrl: String(newCategory.youtubeUrl ?? "").trim(),
            youtubeAutoplay: Boolean(newCategory.youtubeAutoplay),
          };
          setNewCategory(EMPTY_CATEGORY);
          if (created?.id && requestedVideo.youtubeUrl) {
            try {
              await adminRequest(`/admin/api/categories/${encodeURIComponent(created.id)}`, {
                method: "PATCH",
                body: requestedVideo,
              });
              succeeded += 1;
            } catch (videoError) {
              failures.push(adminErrorMessage(videoError));
              failedCreatedVideo = { id: created.id, values: requestedVideo };
            }
          }
        }
        if (successful.has("category:reorder")) preserveCategoryOrder = false;
      }

      for (const change of categoryVideoChanges) {
        try {
          await adminRequest(`/admin/api/categories/${encodeURIComponent(change.id)}`, {
            method: "PATCH",
            body: change.values,
          });
          succeeded += 1;
          setCategoryVideoDrafts((current) => {
            const next = { ...current };
            delete next[change.id];
            return next;
          });
        } catch (videoError) {
          if (replaceUnauthorized(videoError)) return;
          failures.push(adminErrorMessage(videoError));
        }
      }


      await loadCanonical({ preserveCategoryOrder });
      if (failedCreatedVideo) {
        setCategoryVideoDrafts((current) => ({
          ...current,
          [failedCreatedVideo.id]: failedCreatedVideo.values,
        }));
      }
      if (failures.length > 0) {
        setError(
          `${succeeded} 項已儲存，${failures.length} 項仍待處理：${[
            ...new Set(failures),
          ].join("；")}`,
        );
      } else {
        setMessage(`已儲存全部 ${succeeded} 項變更。`);
      }
    } catch (saveError) {
      if (replaceUnauthorized(saveError)) return;
      setError(adminErrorMessage(saveError));
    } finally {
      setBusy(false);
    }
  };

  const deletePhoto = async (photo) => {
    if (busy) return;
    const confirmed = window.confirm(
      `確定永久刪除「${photo.displayName || photo.originalFilename}」嗎？\n\n原圖、縮圖與資料庫紀錄都會立即刪除，無法復原。`,
    );
    if (!confirmed) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await adminRequest(`/admin/api/photos/${encodeURIComponent(photo.id)}`, {
        method: "DELETE",
        timeoutMs: 120_000,
      });
      setPhotos((current) => current.filter((item) => item.id !== photo.id));
      setPhotoDrafts((current) => {
        const next = { ...current };
        delete next[photo.id];
        return next;
      });
      setMessage("照片已永久刪除。");
    } catch (deleteError) {
      if (!replaceUnauthorized(deleteError)) setError(adminErrorMessage(deleteError));
    } finally {
      setBusy(false);
    }
  };


  const logout = async () => {
    if (busy || !confirmDiscard()) return;
    setBusy(true);
    setError("");
    try {
      await logoutAdministrator();
    } catch (logoutError) {
      setError(adminErrorMessage(logoutError));
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <main className="admin-loading" aria-live="polite">
        正在開啟管理後台…
      </main>
    );
  }

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="admin-kicker">LEON & YEHY · MEMORIES</p>
          <h1>婚禮相簿管理</h1>
          <p>可跨相簿、照片與分類修改，最後一次儲存全部變更。</p>
        </div>
        <div className="admin-header-actions">
          <a
            href="/Memories/"
            onClick={(event) => {
              if (!confirmDiscard()) event.preventDefault();
            }}
          >
            查看相簿
          </a>
          <button type="button" onClick={() => void logout()} disabled={busy}>
            登出
          </button>
        </div>
      </header>

      <nav className="admin-tabs" aria-label="管理功能">
        {[
          ["albums", "相簿"],
          ["photos", "照片"],
          ["categories", "分類與影片"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {(message || error) && (
        <div
          className={error ? "admin-banner error" : "admin-banner"}
          role={error ? "alert" : "status"}
        >
          {error || message}
        </div>
      )}

      <main className="admin-content">
        {tab === "albums" && (
          <section aria-labelledby="albums-title">
            <div className="admin-section-heading">
              <div>
                <p className="admin-kicker">ALBUMS</p>
                <h2 id="albums-title">相簿</h2>
              </div>
              <span>{albums.length} 個相簿</span>
            </div>
            <form className="admin-create-card" onSubmit={(event) => event.preventDefault()}>
              <h3>新增相簿</h3>
              <p className="admin-section-note">
                填寫名稱後，這筆新相簿會加入頁面底部的待儲存項目。
              </p>
              <div className="admin-field-grid">
                <label>
                  中文名稱
                  <input
                    value={newAlbum.titleZh}
                    onChange={(event) =>
                      setNewAlbum((current) => ({ ...current, titleZh: event.target.value }))
                    }
                    disabled={busy}
                  />
                </label>
                <label>
                  英文名稱
                  <input
                    value={newAlbum.titleEn}
                    onChange={(event) =>
                      setNewAlbum((current) => ({ ...current, titleEn: event.target.value }))
                    }
                    disabled={busy}
                  />
                </label>
                <label className="admin-wide-field">
                  中文說明
                  <textarea
                    value={newAlbum.descriptionZh}
                    onChange={(event) =>
                      setNewAlbum((current) => ({ ...current, descriptionZh: event.target.value }))
                    }
                    disabled={busy}
                  />
                </label>
                <label className="admin-wide-field">
                  英文說明
                  <textarea
                    value={newAlbum.descriptionEn}
                    onChange={(event) =>
                      setNewAlbum((current) => ({ ...current, descriptionEn: event.target.value }))
                    }
                    disabled={busy}
                  />
                </label>
              </div>
            </form>
            <div className="admin-editor-list">
              {albums.map((album) => (
                <AlbumEditor
                  key={album.id}
                  album={album}
                  draft={albumDrafts[album.id] ?? albumDraft(album)}
                  busy={busy}
                  onChange={(changes) => updateAlbumDraft(album, changes)}
                />
              ))}
            </div>
          </section>
        )}

        {tab === "categories" && (
          <section aria-labelledby="categories-title">
            <div className="admin-section-heading">
              <div>
                <p className="admin-kicker">CATEGORIES & VIDEO</p>
                <h2 id="categories-title">婚禮流程分類與影片</h2>
              </div>
              <span>{categories.length} 個分類</span>
            </div>
            <p className="admin-section-note">
              分類名稱與排序會同步 Google Drive。YouTube 影片只在訪客選取該流程時顯示。
            </p>
            <form className="admin-create-card" onSubmit={(event) => event.preventDefault()}>
              <h3>新增分類</h3>
              <div className="admin-field-grid">
                <label>
                  中文名稱
                  <input
                    value={newCategory.labelZh}
                    onChange={(event) =>
                      setNewCategory((current) => ({ ...current, labelZh: event.target.value }))
                    }
                    disabled={busy}
                  />
                </label>
                <label>
                  英文名稱
                  <input
                    value={newCategory.labelEn}
                    onChange={(event) =>
                      setNewCategory((current) => ({ ...current, labelEn: event.target.value }))
                    }
                    disabled={busy}
                  />
                </label>
                <label className="admin-wide-field">
                  YouTube 連結（選填）
                  <input
                    type="url"
                    value={newCategory.youtubeUrl}
                    onChange={(event) =>
                      setNewCategory((current) => ({ ...current, youtubeUrl: event.target.value }))
                    }
                    placeholder="https://www.youtube.com/watch?v=..."
                    disabled={busy}
                  />
                </label>
                <label className="admin-check admin-wide-field">
                  <input
                    type="checkbox"
                    checked={newCategory.youtubeAutoplay}
                    onChange={(event) =>
                      setNewCategory((current) => ({
                        ...current,
                        youtubeAutoplay: event.target.checked,
                      }))
                    }
                    disabled={busy || !newCategory.youtubeUrl.trim()}
                  />
                  自動播放（靜音）
                </label>
              </div>
            </form>
            <div className="admin-editor-list">
              {orderedCategories.map((category, index) => (
                <CategoryEditor
                  key={category.id}
                  category={category}
                  draft={categoryDrafts[category.id] ?? categoryDraft(category)}
                  videoDraft={
                    categoryVideoDrafts[category.id] ?? normalizedVideoDraft(category)
                  }
                  busy={busy}
                  first={index === 0}
                  last={index === orderedCategories.length - 1}
                  onMove={(direction) => moveCategory(index, direction)}
                  onChange={(changes) => updateCategoryDraft(category, changes)}
                  onVideoChange={(changes) =>
                    updateCategoryVideoDraft(category, changes)
                  }
                />
              ))}
            </div>
          </section>
        )}

        {tab === "photos" && (
          <div data-admin-photo-workspace-placeholder />
        )}
      </main>

      <aside className="admin-save-bar" aria-live="polite">
        <div>
          <strong>
            {pendingCount > 0 ? `${pendingCount} 項變更尚未儲存` : "沒有未儲存的變更"}
          </strong>
          <span>只會送出實際變動的欄位；失敗項目會保留供重試。</span>
        </div>
        <button
          type="button"
          onClick={() => void saveAll()}
          disabled={
            busy ||
            pendingCount === 0
          }
        >
          {busy ? "儲存中…" : `儲存所有變更${pendingCount ? `（${pendingCount}）` : ""}`}
        </button>
      </aside>
    </div>
  );
}
