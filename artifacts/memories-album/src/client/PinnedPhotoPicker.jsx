import { useMemo, useState } from "react";
import { PINNED_PHOTO_LIMIT } from "../pinned-photo-settings.mjs";
import "./pinned-photo-admin.css";

function photoLabel(photo) {
  return photo.displayName || photo.originalFilename || photo.id;
}

export default function PinnedPhotoPicker({
  photos,
  selectedIds,
  onChange,
  busy,
  processKey,
}) {
  const [query, setQuery] = useState("");
  const selected = Array.isArray(selectedIds) ? selectedIds : [];
  const byId = useMemo(
    () => new Map((photos ?? []).map((photo) => [photo.id, photo])),
    [photos],
  );
  const selectedPhotos = selected.map((id) => byId.get(id)).filter(Boolean);
  const normalizedQuery = query.trim().toLocaleLowerCase("zh-Hant");
  const candidates = (photos ?? []).filter((photo) => {
    if (!normalizedQuery) return true;
    return `${photoLabel(photo)} ${photo.id}`
      .toLocaleLowerCase("zh-Hant")
      .includes(normalizedQuery);
  });

  const toggle = (photoId) => {
    if (selected.includes(photoId)) {
      onChange(selected.filter((id) => id !== photoId));
      return;
    }
    if (selected.length >= PINNED_PHOTO_LIMIT) return;
    onChange([...selected, photoId]);
  };

  const move = (photoId, direction) => {
    const index = selected.indexOf(photoId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= selected.length) return;
    const next = [...selected];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    onChange(next);
  };

  return (
    <details className="pinned-photo-details">
      <summary>置頂圖（{selected.length}/{PINNED_PHOTO_LIMIT}）</summary>
      <div className="pinned-photo-picker">
        <p className="admin-section-note">
          可選擇 1～3 張。前端會依此順序顯示在文字與附件下方、一般照片上方；未選擇時不顯示置頂區塊。
        </p>

        {selectedPhotos.length > 0 && (
          <div className="pinned-selected-list" aria-label="已選置頂圖">
            {selectedPhotos.map((photo, index) => (
              <article key={photo.id} className="pinned-selected-card">
                <img src={photo.thumbnailUrl} alt="" loading="lazy" />
                <div>
                  <strong>{index + 1}. {photoLabel(photo)}</strong>
                  <span>{processKey === "all" ? "全部流程" : "此流程"}</span>
                </div>
                <div className="pinned-order-actions">
                  <button
                    type="button"
                    onClick={() => move(photo.id, -1)}
                    disabled={busy || index === 0}
                    aria-label={`將 ${photoLabel(photo)} 往前移`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(photo.id, 1)}
                    disabled={busy || index === selectedPhotos.length - 1}
                    aria-label={`將 ${photoLabel(photo)} 往後移`}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => toggle(photo.id)}
                    disabled={busy}
                  >
                    移除
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        <label className="pinned-photo-search">
          搜尋照片
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="輸入照片名稱"
            disabled={busy}
          />
        </label>

        {candidates.length === 0 ? (
          <p className="admin-section-note">此流程目前沒有可選的公開婚禮照片。</p>
        ) : (
          <div className="pinned-candidate-grid">
            {candidates.map((photo) => {
              const index = selected.indexOf(photo.id);
              const active = index >= 0;
              const limitReached = !active && selected.length >= PINNED_PHOTO_LIMIT;
              return (
                <button
                  key={photo.id}
                  type="button"
                  className={active ? "selected" : ""}
                  onClick={() => toggle(photo.id)}
                  disabled={busy || limitReached}
                  aria-pressed={active}
                  title={photoLabel(photo)}
                >
                  <img src={photo.thumbnailUrl} alt="" loading="lazy" />
                  <span>{active ? `置頂 ${index + 1}` : photoLabel(photo)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </details>
  );
}
