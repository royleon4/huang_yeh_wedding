import { useEffect, useMemo, useState } from "react";
import { adminErrorMessage, adminRequest } from "./admin-client.mjs";
import { useAdminSaveSection } from "./AdminSaveCoordinator.jsx";

const DEFAULT_SETTINGS = Object.freeze({
  enabled: false,
  minimum: 1,
  maximum: 3,
});

function normalizeSettings(body = {}) {
  const minimum = Number(body.guestRandomFeaturedPhotosMin);
  const maximum = Number(body.guestRandomFeaturedPhotosMax);
  return {
    enabled: body.guestRandomFeaturedPhotosEnabled === true,
    minimum: Number.isInteger(minimum) && minimum >= 0 ? minimum : 1,
    maximum:
      Number.isInteger(maximum) && maximum >= Math.max(0, minimum)
        ? maximum
        : 3,
  };
}

function sameSettings(left, right) {
  return (
    left.enabled === right.enabled &&
    left.minimum === right.minimum &&
    left.maximum === right.maximum
  );
}

export default function GuestFeaturedPhotoSettings() {
  const [saved, setSaved] = useState(DEFAULT_SETTINGS);
  const [draft, setDraft] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const changed = useMemo(() => !sameSettings(draft, saved), [draft, saved]);
  const rangeValid =
    Number.isInteger(draft.minimum) &&
    Number.isInteger(draft.maximum) &&
    draft.minimum >= 0 &&
    draft.maximum >= draft.minimum;

  useEffect(() => {
    let cancelled = false;
    void adminRequest("/admin/api/settings/guest-featured")
      .then((body) => {
        if (cancelled) return;
        const next = normalizeSettings(body);
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

  const save = async () => {
    if (saving || !changed || !rangeValid) return { succeeded: 0 };
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const body = await adminRequest("/admin/api/settings/guest-featured", {
        method: "PATCH",
        body: {
          guestRandomFeaturedPhotosEnabled: draft.enabled,
          guestRandomFeaturedPhotosMin: draft.minimum,
          guestRandomFeaturedPhotosMax: draft.maximum,
        },
      });
      const next = normalizeSettings(body);
      setSaved(next);
      setDraft(next);
      setMessage("訪客相簿隨機置頂照片設定已儲存。");
      return { succeeded: 1 };
    } catch (saveError) {
      if (saveError?.status === 401) window.location.replace("/Memories/");
      setError(adminErrorMessage(saveError));
      throw saveError;
    } finally {
      setSaving(false);
    }
  };

  useAdminSaveSection("guest-random-featured-photos", {
    pendingCount: changed ? 1 : 0,
    save,
  });

  return (
    <section className="guest-featured-setting" aria-labelledby="guest-featured-title">
      <div>
        <strong id="guest-featured-title">訪客相簿隨機置頂照片</strong>
        <p>
          開啟後，所有訪客標籤都會依設定範圍隨機挑選照片置頂，並以兩倍卡片寬度顯示，包含「全部訪客」、「最新照片」與個別姓名標籤。
        </p>
      </div>
      {loading ? (
        <span className="guest-featured-status">正在讀取設定…</span>
      ) : (
        <div className="guest-label-controls">
          <label className="admin-check">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(event) => updateDraft({ enabled: event.target.checked })}
              disabled={saving}
            />
            啟用訪客相簿隨機置頂照片
          </label>
          <label className="guest-latest-count-field">
            最少張數
            <input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={draft.minimum}
              onChange={(event) =>
                updateDraft({ minimum: Number(event.target.value) })
              }
              disabled={saving}
              aria-invalid={!rangeValid}
            />
          </label>
          <label className="guest-latest-count-field">
            最多張數
            <input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={draft.maximum}
              onChange={(event) =>
                updateDraft({ maximum: Number(event.target.value) })
              }
              disabled={saving}
              aria-invalid={!rangeValid}
            />
          </label>
          <small>
            只能輸入非負整數，且最多張數不得小於最少張數，例如 1～4、2～6 或 0～3。
          </small>
        </div>
      )}
      {!rangeValid && (
        <p className="guest-featured-status error" role="alert">
          請輸入有效的數字範圍。
        </p>
      )}
      <span className="admin-draft-hint">
        {changed ? "此設定有未儲存變更。" : "變更會由頁面底部統一儲存。"}
      </span>
      {(message || error) && (
        <p
          className={`guest-featured-status${error ? " error" : ""}`}
          role={error ? "alert" : "status"}
        >
          {error || message}
        </p>
      )}
    </section>
  );
}
