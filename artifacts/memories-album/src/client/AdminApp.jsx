import { useEffect, useState } from "react";
import {
  adminErrorMessage,
  adminRequest,
  logoutAdministrator,
} from "./admin-client.mjs";

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

function AlbumEditor({ album, busy, onSaved }) {
  const [draft, setDraft] = useState(album);

  const save = async (event) => {
    event.preventDefault();
    await onSaved({
      titleZh: draft.titleZh,
      titleEn: draft.titleEn,
      descriptionZh: draft.descriptionZh,
      descriptionEn: draft.descriptionEn,
      isVisible: draft.isVisible,
    });
  };

  return (
    <form className="admin-editor-card" onSubmit={save}>
      <div className="admin-editor-heading">
        <strong>{album.titleZh}</strong>
        <span>{album.isSystem ? "系統相簿" : "自訂相簿"}</span>
      </div>
      <div className="admin-field-grid">
        <label>
          中文名稱
          <input
            value={draft.titleZh}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                titleZh: event.target.value,
              }))
            }
            required
          />
        </label>
        <label>
          英文名稱
          <input
            value={draft.titleEn}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                titleEn: event.target.value,
              }))
            }
          />
        </label>
        <label className="admin-wide-field">
          中文說明
          <textarea
            value={draft.descriptionZh}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                descriptionZh: event.target.value,
              }))
            }
          />
        </label>
        <label className="admin-wide-field">
          英文說明
          <textarea
            value={draft.descriptionEn}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                descriptionEn: event.target.value,
              }))
            }
          />
        </label>
      </div>
      <div className="admin-card-actions">
        <label className="admin-check">
          <input
            type="checkbox"
            checked={draft.isVisible}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                isVisible: event.target.checked,
              }))
            }
          />
          對訪客顯示
        </label>
        <button type="submit" disabled={busy}>
          儲存相簿
        </button>
      </div>
    </form>
  );
}

function CategoryEditor({ category, busy, onSaved, onMove, first, last }) {
  const [labelZh, setLabelZh] = useState(category.labelZh);
  const [labelEn, setLabelEn] = useState(category.labelEn);

  const save = async (event) => {
    event.preventDefault();
    await onSaved({ labelZh, labelEn });
  };

  return (
    <form className="admin-editor-card admin-category-row" onSubmit={save}>
      <span className="admin-order-number">
        {String(category.displayOrder).padStart(2, "0")}
      </span>
      <label>
        中文分類
        <input
          value={labelZh}
          onChange={(event) => setLabelZh(event.target.value)}
          required
        />
      </label>
      <label>
        英文分類
        <input
          value={labelEn}
          onChange={(event) => setLabelEn(event.target.value)}
        />
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
        <button type="submit" disabled={busy}>
          儲存
        </button>
      </div>
    </form>
  );
}

function AlbumChoices({ albums, selected, onChange }) {
  return (
    <fieldset className="admin-album-choices">
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

function PhotoEditor({ photo, albums, categories, busy, onSaved }) {
  const [draft, setDraft] = useState({
    displayName: photo.displayName,
    visibility: photo.visibility,
    albumIds: photo.albumIds,
    categoryId: photo.categoryIds[0] ?? "",
    capturedAt: toLocalDateTime(photo.capturedAt),
  });

  const save = async (event) => {
    event.preventDefault();
    await onSaved({
      displayName: draft.displayName,
      visibility: draft.visibility,
      albumIds: draft.albumIds,
      categoryIds: draft.categoryId ? [draft.categoryId] : [],
      capturedAt: toIso(draft.capturedAt),
    });
  };

  return (
    <form className="admin-photo-card" onSubmit={save}>
      <div className="admin-photo-preview">
        <img src={photo.thumbnailUrl} alt="" loading="lazy" />
        <span>{photo.visibility === "public" ? "公開" : "隱藏"}</span>
      </div>
      <div className="admin-photo-fields">
        <label>
          顯示名稱
          <input
            value={draft.displayName}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                displayName: event.target.value,
              }))
            }
            required
          />
        </label>
        <label>
          拍攝時間
          <input
            type="datetime-local"
            value={draft.capturedAt}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                capturedAt: event.target.value,
              }))
            }
            required
          />
        </label>
        <label>
          流程分類
          <select
            value={draft.categoryId}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                categoryId: event.target.value,
              }))
            }
          >
            <option value="">不指定流程</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {String(category.displayOrder).padStart(2, "0")}{" "}
                {category.labelZh}
              </option>
            ))}
          </select>
        </label>
        <label>
          公開狀態
          <select
            value={draft.visibility}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                visibility: event.target.value,
              }))
            }
          >
            <option value="public">公開</option>
            <option value="hidden">隱藏</option>
          </select>
        </label>
        <AlbumChoices
          albums={albums}
          selected={draft.albumIds}
          onChange={(albumIds) =>
            setDraft((current) => ({ ...current, albumIds }))
          }
        />
        <button type="submit" disabled={busy || draft.albumIds.length === 0}>
          儲存照片
        </button>
      </div>
    </form>
  );
}

export default function AdminApp() {
  const [tab, setTab] = useState("albums");
  const [albums, setAlbums] = useState([]);
  const [categories, setCategories] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [newAlbum, setNewAlbum] = useState({
    titleZh: "",
    titleEn: "",
    descriptionZh: "",
    descriptionEn: "",
  });
  const [newCategory, setNewCategory] = useState({
    labelZh: "",
    labelEn: "",
  });
  const [upload, setUpload] = useState({
    file: null,
    displayName: "",
    capturedAt: toLocalDateTime(new Date()),
    albumIds: [],
    categoryId: "",
  });

  useEffect(() => {
    document.documentElement.lang = "zh-Hant";
    document.title = "管理後台｜詠葉婚禮照片檔案館";
    let cancelled = false;
    void Promise.all([
      adminRequest("/admin/api/session"),
      adminRequest("/admin/api/albums"),
      adminRequest("/admin/api/categories"),
      adminRequest("/admin/api/photos?limit=50"),
    ])
      .then(([, albumData, categoryData, photoData]) => {
        if (cancelled) return;
        setAlbums(albumData.albums);
        setCategories(categoryData.categories);
        setPhotos(photoData.photos);
        setNextCursor(photoData.nextCursor);
        setUpload((current) => ({
          ...current,
          albumIds: albumData.albums[0]?.id ? [albumData.albums[0].id] : [],
        }));
      })
      .catch((loadError) => {
        if (loadError?.status === 401) {
          window.location.replace("/Memories/");
          return;
        }
        if (!cancelled) setError(adminErrorMessage(loadError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const run = async (operation, success) => {
    if (busy) return null;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const value = await operation();
      setMessage(success);
      return value;
    } catch (operationError) {
      if (operationError?.status === 401) {
        window.location.replace("/Memories/");
        return null;
      }
      setError(adminErrorMessage(operationError));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const createAlbum = async (event) => {
    event.preventDefault();
    const payload = await run(
      () =>
        adminRequest("/admin/api/albums", {
          method: "POST",
          body: newAlbum,
        }),
      "相簿已新增。",
    );
    if (!payload) return;
    setAlbums((current) => [...current, payload.album]);
    setNewAlbum({
      titleZh: "",
      titleEn: "",
      descriptionZh: "",
      descriptionEn: "",
    });
  };

  const createCategory = async (event) => {
    event.preventDefault();
    const payload = await run(
      () =>
        adminRequest("/admin/api/categories", {
          method: "POST",
          body: newCategory,
        }),
      "分類已新增並同步至 Google Drive。",
    );
    if (!payload) return;
    setCategories((current) => [...current, payload.category]);
    setNewCategory({ labelZh: "", labelEn: "" });
  };

  const moveCategory = async (index, direction) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= categories.length) return;
    const reordered = [...categories];
    [reordered[index], reordered[nextIndex]] = [
      reordered[nextIndex],
      reordered[index],
    ];
    const payload = await run(
      () =>
        adminRequest("/admin/api/categories/order", {
          method: "PUT",
          body: { categoryIds: reordered.map((category) => category.id) },
        }),
      "分類順序已同步至 Google Drive。",
    );
    if (payload) setCategories(payload.categories);
  };

  const uploadPhoto = async (event) => {
    event.preventDefault();
    if (!upload.file) return;
    const formElement = event.currentTarget;
    const form = new FormData();
    form.append("photo", upload.file);
    form.append(
      "metadata",
      JSON.stringify({
        displayName: upload.displayName || upload.file.name,
        capturedAt: toIso(upload.capturedAt),
        albumIds: upload.albumIds,
        categoryIds: upload.categoryId ? [upload.categoryId] : [],
        visibility: "public",
      }),
    );
    const payload = await run(
      () =>
        adminRequest("/admin/api/photos", {
          method: "POST",
          form,
          timeoutMs: 60_000,
        }),
      "照片已新增。",
    );
    if (!payload) return;
    setPhotos((current) =>
      [...current, payload.photo].sort((left, right) =>
        left.capturedAt.localeCompare(right.capturedAt),
      ),
    );
    setUpload((current) => ({
      ...current,
      file: null,
      displayName: "",
      capturedAt: toLocalDateTime(new Date()),
    }));
    formElement.reset();
  };

  const loadMorePhotos = async () => {
    if (!nextCursor) return;
    const payload = await run(
      () =>
        adminRequest(
          `/admin/api/photos?limit=50&cursor=${encodeURIComponent(nextCursor)}`,
        ),
      "已載入更多照片。",
    );
    if (!payload) return;
    setPhotos((current) => [...current, ...payload.photos]);
    setNextCursor(payload.nextCursor);
  };

  const logout = async () => {
    if (busy) return;
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
          <p>相簿、照片與分類均在這個獨立路由管理。</p>
        </div>
        <div className="admin-header-actions">
          <a href="/Memories/">查看相簿</a>
          <button type="button" onClick={() => void logout()} disabled={busy}>
            登出
          </button>
        </div>
      </header>

      <nav className="admin-tabs" aria-label="管理功能">
        {[
          ["albums", "相簿"],
          ["photos", "照片"],
          ["categories", "分類"],
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
            <form className="admin-create-card" onSubmit={createAlbum}>
              <h3>新增相簿</h3>
              <div className="admin-field-grid">
                <label>
                  中文名稱
                  <input
                    value={newAlbum.titleZh}
                    onChange={(event) =>
                      setNewAlbum((current) => ({
                        ...current,
                        titleZh: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label>
                  英文名稱
                  <input
                    value={newAlbum.titleEn}
                    onChange={(event) =>
                      setNewAlbum((current) => ({
                        ...current,
                        titleEn: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="admin-wide-field">
                  中文說明
                  <textarea
                    value={newAlbum.descriptionZh}
                    onChange={(event) =>
                      setNewAlbum((current) => ({
                        ...current,
                        descriptionZh: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <button type="submit" disabled={busy}>
                新增相簿
              </button>
            </form>
            <div className="admin-editor-list">
              {albums.map((album) => (
                <AlbumEditor
                  key={album.id}
                  album={album}
                  busy={busy}
                  onSaved={(changes) =>
                    run(async () => {
                      const payload = await adminRequest(
                        `/admin/api/albums/${encodeURIComponent(album.id)}`,
                        { method: "PATCH", body: changes },
                      );
                      const saved = payload.album;
                      setAlbums((current) =>
                        current.map((item) =>
                          item.id === saved.id ? saved : item,
                        ),
                      );
                      return saved;
                    }, "相簿已更新。")
                  }
                />
              ))}
            </div>
          </section>
        )}

        {tab === "categories" && (
          <section aria-labelledby="categories-title">
            <div className="admin-section-heading">
              <div>
                <p className="admin-kicker">CATEGORIES</p>
                <h2 id="categories-title">婚禮流程分類</h2>
              </div>
              <span>{categories.length} 個分類</span>
            </div>
            <p className="admin-section-note">
              新增、改名與排序會同步變更 Google Drive 的編號資料夾。
            </p>
            <form className="admin-create-card" onSubmit={createCategory}>
              <h3>新增分類</h3>
              <div className="admin-field-grid">
                <label>
                  中文名稱
                  <input
                    value={newCategory.labelZh}
                    onChange={(event) =>
                      setNewCategory((current) => ({
                        ...current,
                        labelZh: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label>
                  英文名稱
                  <input
                    value={newCategory.labelEn}
                    onChange={(event) =>
                      setNewCategory((current) => ({
                        ...current,
                        labelEn: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <button type="submit" disabled={busy}>
                新增分類
              </button>
            </form>
            <div className="admin-editor-list">
              {categories.map((category, index) => (
                <CategoryEditor
                  key={category.id}
                  category={category}
                  busy={busy}
                  first={index === 0}
                  last={index === categories.length - 1}
                  onMove={(direction) => void moveCategory(index, direction)}
                  onSaved={(changes) =>
                    run(async () => {
                      const payload = await adminRequest(
                        `/admin/api/categories/${encodeURIComponent(category.id)}`,
                        { method: "PATCH", body: changes },
                      );
                      const saved = payload.category;
                      setCategories((current) =>
                        current.map((item) =>
                          item.id === saved.id ? saved : item,
                        ),
                      );
                      return saved;
                    }, "分類已更新。")
                  }
                />
              ))}
            </div>
          </section>
        )}

        {tab === "photos" && (
          <section aria-labelledby="photos-title">
            <div className="admin-section-heading">
              <div>
                <p className="admin-kicker">PHOTOS</p>
                <h2 id="photos-title">照片</h2>
              </div>
              <span>{photos.length} 張已載入</span>
            </div>
            <form className="admin-create-card" onSubmit={uploadPhoto}>
              <h3>新增照片</h3>
              <div className="admin-field-grid">
                <label className="admin-wide-field">
                  選擇照片
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      setUpload((current) => ({
                        ...current,
                        file,
                        displayName: current.displayName || file?.name || "",
                      }));
                    }}
                    required
                  />
                </label>
                <label>
                  顯示名稱
                  <input
                    value={upload.displayName}
                    onChange={(event) =>
                      setUpload((current) => ({
                        ...current,
                        displayName: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label>
                  拍攝時間
                  <input
                    type="datetime-local"
                    value={upload.capturedAt}
                    onChange={(event) =>
                      setUpload((current) => ({
                        ...current,
                        capturedAt: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label>
                  流程分類
                  <select
                    value={upload.categoryId}
                    onChange={(event) =>
                      setUpload((current) => ({
                        ...current,
                        categoryId: event.target.value,
                      }))
                    }
                  >
                    <option value="">不指定流程</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {String(category.displayOrder).padStart(2, "0")}{" "}
                        {category.labelZh}
                      </option>
                    ))}
                  </select>
                </label>
                <AlbumChoices
                  albums={albums}
                  selected={upload.albumIds}
                  onChange={(albumIds) =>
                    setUpload((current) => ({ ...current, albumIds }))
                  }
                />
              </div>
              <button
                type="submit"
                disabled={busy || !upload.file || upload.albumIds.length === 0}
              >
                {busy ? "處理中…" : "上傳照片"}
              </button>
            </form>
            <div className="admin-photo-list">
              {photos.map((photo) => (
                <PhotoEditor
                  key={photo.id}
                  photo={photo}
                  albums={albums}
                  categories={categories}
                  busy={busy}
                  onSaved={(changes) =>
                    run(async () => {
                      const payload = await adminRequest(
                        `/admin/api/photos/${encodeURIComponent(photo.id)}`,
                        { method: "PATCH", body: changes },
                      );
                      const saved = payload.photo;
                      setPhotos((current) =>
                        current.map((item) =>
                          item.id === saved.id ? saved : item,
                        ),
                      );
                      return saved;
                    }, "照片已更新。")
                  }
                />
              ))}
            </div>
            {nextCursor && (
              <button
                className="admin-load-more"
                type="button"
                onClick={() => void loadMorePhotos()}
                disabled={busy}
              >
                載入更多照片
              </button>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
