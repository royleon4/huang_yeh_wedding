import { useEffect, useMemo, useState } from "react";
import { PINNED_PHOTO_LIMIT } from "../pinned-photo-settings.mjs";
import AbortableThumbnail from "./AbortableThumbnail.jsx";
import LazyImage from "./LazyImage.jsx";
import "./pinned-photo-admin.css";

const PREVIEW_PAGE_SIZE = 10;

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
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
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
  const pageCount = Math.max(1, Math.ceil(candidates.length / PREVIEW_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageCandidates = candidates.slice(
    currentPage * PREVIEW_PAGE_SIZE,
    (currentPage + 1) * PREVIEW_PAGE_SIZE,
  );

  useEffect(() => {
    setPage(0);
  }, [expanded, normalizedQuery, processKey]);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount - 1));
  }, [pageCount]);

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
    <details
      className="pinned-photo-details"
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>置頂圖（{selected.length}/{PINNED_PHOTO_LIMIT}）</summary>
      {expanded && (
        <div className="pinned-photo-picker">
          <p className="admin-section-note">
            可選擇 1～3 張。候選照片每頁只載入 10 張；切換頁面時，上一頁尚未完成的縮圖請求會立即中止。
          </p>

          {selectedPhotos.length > 0 && (
            <div className="pinned-selected-list" aria-label="已選置頂圖">
              {selectedPhotos.map((photo, index) => (
                <article key={photo.id} className="pinned-selected-card">
                  <LazyImage
                    src={photo.thumbnailUrl}
                    alt=""
                    width={photo.width}
                    height={photo.height}
                  />
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
            <>
              <div
                className="pinned-candidate-grid"
                key={`${processKey}:${normalizedQuery}:${currentPage}`}
              >
                {pageCandidates.map((photo) => {
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
                      <AbortableThumbnail
                        src={photo.thumbnailUrl}
                        alt=""
                        width={photo.width}
                        height={photo.height}
                      />
                      <span>{active ? `置頂 ${index + 1}` : photoLabel(photo)}</span>
                    </button>
                  );
                })}
              </div>

              <nav className="pinned-photo-pagination" aria-label="置頂圖片候選頁面">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                  disabled={busy || currentPage === 0}
                >
                  上一頁
                </button>
                <span aria-live="polite">
                  第 {currentPage + 1} / {pageCount} 頁
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setPage((current) => Math.min(pageCount - 1, current + 1))
                  }
                  disabled={busy || currentPage >= pageCount - 1}
                >
                  下一頁
                </button>
              </nav>
            </>
          )}
        </div>
      )}
    </details>
  );
}
