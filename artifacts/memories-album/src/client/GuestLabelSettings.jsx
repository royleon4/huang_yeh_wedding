import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_GUEST_LATEST_PHOTO_COUNT,
  GUEST_LABEL_VISIBILITY_KEYS,
  GUEST_LABEL_VISIBILITY_SETTING_KEYS,
  MAX_GUEST_LATEST_PHOTO_COUNT,
  MIN_GUEST_LATEST_PHOTO_COUNT,
  normalizeGuestLabelVisibilitySettings,
  normalizeGuestLatestPhotoCount,
  normalizeGuestUploaderLabelOrder,
} from "../guest-label-settings.mjs";
import { adminErrorMessage, adminRequest } from "./admin-client.mjs";
import { useAdminSaveSection } from "./AdminSaveCoordinator.jsx";
import "./guest-label-settings.css";

const VISIBILITY_CONTROLS = Object.freeze([
  {
    key: GUEST_LABEL_VISIBILITY_KEYS.latest,
    label: "顯示最新照片標籤",
  },
  {
    key: GUEST_LABEL_VISIBILITY_KEYS.all,
    label: "顯示所有訪客標籤",
  },
  {
    key: GUEST_LABEL_VISIBILITY_KEYS.names,
    label: "顯示姓名標籤",
  },
]);

function sameOrder(left, right) {
  return (
    left.length === right.length &&
    left.every((label, index) => label === right[index])
  );
}

function moveLabel(labels, fromIndex, toIndex) {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= labels.length ||
    toIndex >= labels.length ||
    fromIndex === toIndex
  ) {
    return labels;
  }
  const next = [...labels];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function normalizedSnapshot(settings = {}) {
  return {
    ...normalizeGuestLabelVisibilitySettings(settings),
    guestUploaderLabelOrder: normalizeGuestUploaderLabelOrder(
      settings.guestUploaderLabelOrder,
    ),
    guestLatestPhotoCount: normalizeGuestLatestPhotoCount(
      settings.guestLatestPhotoCount ?? DEFAULT_GUEST_LATEST_PHOTO_COUNT,
    ),
  };
}

function sameSnapshot(left, right) {
  return (
    GUEST_LABEL_VISIBILITY_SETTING_KEYS.every(
      (key) => left[key] === right[key],
    ) &&
    left.guestLatestPhotoCount === right.guestLatestPhotoCount &&
    sameOrder(left.guestUploaderLabelOrder, right.guestUploaderLabelOrder)
  );
}

function snapshotPayload(snapshot) {
  return {
    ...Object.fromEntries(
      GUEST_LABEL_VISIBILITY_SETTING_KEYS.map((key) => [key, snapshot[key]]),
    ),
    guestUploaderLabelOrder: snapshot.guestUploaderLabelOrder,
    guestLatestPhotoCount: snapshot.guestLatestPhotoCount,
  };
}

export default function GuestLabelSettings() {
  const [saved, setSaved] = useState(() => normalizedSnapshot());
  const [draft, setDraft] = useState(() => normalizedSnapshot());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const changed = useMemo(() => !sameSnapshot(draft, saved), [draft, saved]);

  useEffect(() => {
    let cancelled = false;
    void adminRequest("/admin/api/settings")
      .then((settings) => {
        if (cancelled) return;
        const next = normalizedSnapshot(settings);
        setSaved(next);
        setDraft(next);
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

  const updateDraft = (patch) => {
    setDraft((current) => ({ ...current, ...patch }));
    setMessage("");
    setError("");
  };

  const updateOrder = (fromIndex, toIndex) => {
    setDraft((current) => ({
      ...current,
      guestUploaderLabelOrder: moveLabel(
        current.guestUploaderLabelOrder,
        fromIndex,
        toIndex,
      ),
    }));
    setMessage("");
    setError("");
  };

  const save = async () => {
    if (saving || !changed) return { succeeded: 0 };
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const requested = snapshotPayload(draft);
      const payload = await adminRequest("/admin/api/settings", {
        method: "PATCH",
        body: requested,
      });
      const next = normalizedSnapshot({ ...requested, ...payload });
      setSaved(next);
      setDraft(next);
      setMessage("訪客相簿標籤設定已儲存。");
      return { succeeded: 1 };
    } catch (saveError) {
      if (saveError?.status === 401) window.location.replace("/Memories/");
      setError(adminErrorMessage(saveError));
      throw saveError;
    } finally {
      setSaving(false);
    }
  };

  useAdminSaveSection("guest-uploader-labels", {
    pendingCount: changed ? 1 : 0,
    save,
  });

  return (
    <section
      className="guest-label-settings general-setting-card"
      aria-labelledby="guest-label-settings-title"
    >
      <div>
        <p className="admin-kicker">GUEST ALBUM LABELS</p>
        <h2 id="guest-label-settings-title">訪客相簿標籤</h2>
        <p>
          分別控制「最新照片」、「所有訪客」與姓名標籤是否顯示，並可調整姓名標籤順序與最新照片張數。新出現的姓名會自動加在目前排序的最後面，不會依姓名重新排序。
        </p>
      </div>

      {loading ? (
        <p className="guest-label-status">正在讀取訪客標籤…</p>
      ) : (
        <>
          <div className="guest-label-controls">
            {VISIBILITY_CONTROLS.map((control) => (
              <label className="admin-check" key={control.key}>
                <input
                  type="checkbox"
                  checked={draft[control.key]}
                  onChange={(event) =>
                    updateDraft({ [control.key]: event.target.checked })
                  }
                  disabled={saving}
                />
                {control.label}
              </label>
            ))}

            <label className="guest-latest-count-field">
              「最新照片」顯示張數
              <input
                type="number"
                min={MIN_GUEST_LATEST_PHOTO_COUNT}
                max={MAX_GUEST_LATEST_PHOTO_COUNT}
                step="1"
                value={draft.guestLatestPhotoCount}
                onChange={(event) =>
                  updateDraft({ guestLatestPhotoCount: Number(event.target.value) })
                }
                disabled={
                  saving || !draft[GUEST_LABEL_VISIBILITY_KEYS.latest]
                }
              />
              <small>
                可設定 {MIN_GUEST_LATEST_PHOTO_COUNT}～{MAX_GUEST_LATEST_PHOTO_COUNT} 張。
              </small>
            </label>
          </div>

          <div className="guest-label-order-heading">
            <div>
              <strong>姓名標籤排序</strong>
              <p>拖動標籤調整順序；手機也可以使用上下按鈕。</p>
            </div>
            <span>{draft.guestUploaderLabelOrder.length} 個姓名</span>
          </div>

          {draft.guestUploaderLabelOrder.length > 0 ? (
            <ol className="guest-label-order-list">
              {draft.guestUploaderLabelOrder.map((label, index) => (
                <li
                  key={label}
                  className={draggedIndex === index ? "is-dragging" : ""}
                  draggable={!saving}
                  onDragStart={(event) => {
                    setDraggedIndex(index);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", label);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (draggedIndex !== null) updateOrder(draggedIndex, index);
                    setDraggedIndex(null);
                  }}
                  onDragEnd={() => setDraggedIndex(null)}
                >
                  <span className="guest-label-drag-handle" aria-hidden="true">
                    ⋮⋮
                  </span>
                  <span className="guest-label-order-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <strong>{label}</strong>
                  <span className="guest-label-move-actions">
                    <button
                      type="button"
                      onClick={() => updateOrder(index, index - 1)}
                      disabled={saving || index === 0}
                      aria-label={`將 ${label} 往上移`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => updateOrder(index, index + 1)}
                      disabled={
                        saving ||
                        index === draft.guestUploaderLabelOrder.length - 1
                      }
                      aria-label={`將 ${label} 往下移`}
                    >
                      ↓
                    </button>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="guest-label-empty">目前還沒有訪客姓名標籤。</p>
          )}

          <span className="admin-draft-hint">
            {changed ? "訪客標籤設定有未儲存變更。" : "變更會由頁面底部統一儲存。"}
          </span>
        </>
      )}

      {(message || error) && (
        <p
          className={`guest-label-status${error ? " error" : ""}`}
          role={error ? "alert" : "status"}
        >
          {error || message}
        </p>
      )}
    </section>
  );
}
