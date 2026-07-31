import { useEffect, useState } from "react";
import {
  DEFAULT_GALLERY_MEDIA_ORDER,
  normalizeGalleryMediaOrder,
} from "../gallery-media-order.mjs";
import { adminErrorMessage, adminRequest } from "./admin-client.mjs";
import { useAdminSaveSection } from "./AdminSaveCoordinator.jsx";

const LABELS = {
  video: {
    title: "影片",
    description: "目前流程設定的 YouTube 影片。",
  },
  text: {
    title: "文字與附件",
    description: "Rich Text 內容、內嵌圖片與可下載附件。",
  },
  weddingPhotos: {
    title: "婚禮攝影照片",
    description: "上傳者／作者為「婚禮攝影」的照片。",
  },
  guestPhotos: {
    title: "訪客上傳照片",
    description: "其他作者與訪客上傳的照片。",
  },
};

export default function GalleryMediaOrderSettings() {
  const [savedOrder, setSavedOrder] = useState(DEFAULT_GALLERY_MEDIA_ORDER);
  const [draftOrder, setDraftOrder] = useState(DEFAULT_GALLERY_MEDIA_ORDER);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const hasChanges = draftOrder.join("|") !== savedOrder.join("|");

  useEffect(() => {
    let cancelled = false;
    void adminRequest("/admin/api/settings")
      .then((settings) => {
        if (cancelled) return;
        const order = normalizeGalleryMediaOrder(settings.galleryMediaOrder);
        setSavedOrder(order);
        setDraftOrder(order);
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

  const move = (index, direction) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= draftOrder.length) return;
    setDraftOrder((current) => {
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
    setMessage("");
    setError("");
  };

  const save = async () => {
    if (saving || !hasChanges) return { succeeded: 0 };
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const result = await adminRequest("/admin/api/settings", {
        method: "PATCH",
        body: { galleryMediaOrder: draftOrder },
      });
      const order = normalizeGalleryMediaOrder(result.galleryMediaOrder);
      setSavedOrder(order);
      setDraftOrder(order);
      setMessage("前台內容順序已更新。");
      return { succeeded: 1 };
    } catch (saveError) {
      if (saveError?.status === 401) window.location.replace("/Memories/");
      setError(adminErrorMessage(saveError));
      throw saveError;
    } finally {
      setSaving(false);
    }
  };

  useAdminSaveSection("gallery-media-order", {
    pendingCount: hasChanges ? 1 : 0,
    save,
  });

  return (
    <section className="general-setting-card" aria-labelledby="media-order-title">
      <div className="general-setting-heading">
        <div>
          <p className="admin-kicker">FRONTEND CONTENT ORDER</p>
          <h3 id="media-order-title">相簿內容顯示順序</h3>
        </div>
        <span>由上到下</span>
      </div>
      <p className="admin-section-note">
        此順序套用到所有相簿與婚禮流程。沒有內容的區塊會自動略過，也不會留下空白。
      </p>

      {loading ? (
        <p className="general-setting-status">正在讀取設定…</p>
      ) : (
        <>
          <ol className="media-order-list">
            {draftOrder.map((key, index) => (
              <li key={key}>
                <span className="media-order-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <strong>{LABELS[key].title}</strong>
                  <p>{LABELS[key].description}</p>
                </div>
                <div className="media-order-actions">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={saving || index === 0}
                    aria-label={`將${LABELS[key].title}往前移`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={saving || index === draftOrder.length - 1}
                    aria-label={`將${LABELS[key].title}往後移`}
                  >
                    ↓
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <div className="general-setting-actions">
            <span>
              {hasChanges
                ? "顯示順序有未儲存變更。"
                : "變更會由頁面底部統一儲存。"}
            </span>
          </div>
        </>
      )}

      {(message || error) && (
        <p
          className={`general-setting-status${error ? " error" : ""}`}
          role={error ? "alert" : "status"}
        >
          {error || message}
        </p>
      )}
    </section>
  );
}
