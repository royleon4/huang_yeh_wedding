import { useEffect, useMemo, useState } from "react";
import { adminErrorMessage, adminRequest } from "./admin-client.mjs";
import { useAdminSaveSection } from "./AdminSaveCoordinator.jsx";

export default function GuestFeaturedPhotoSettings() {
  const [saved, setSaved] = useState(false);
  const [draft, setDraft] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const changed = useMemo(() => draft !== saved, [draft, saved]);

  useEffect(() => {
    let cancelled = false;
    void adminRequest("/admin/api/settings/guest-featured")
      .then((body) => {
        if (cancelled) return;
        const enabled = body.guestRandomFeaturedPhotosEnabled === true;
        setSaved(enabled);
        setDraft(enabled);
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

  const save = async () => {
    if (saving || !changed) return { succeeded: 0 };
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const body = await adminRequest("/admin/api/settings/guest-featured", {
        method: "PATCH",
        body: { guestRandomFeaturedPhotosEnabled: draft },
      });
      const enabled = body.guestRandomFeaturedPhotosEnabled === true;
      setSaved(enabled);
      setDraft(enabled);
      setMessage("訪客姓名標籤置頂照片設定已儲存。");
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
        <strong id="guest-featured-title">姓名標籤隨機置頂照片</strong>
        <p>
          開啟後，進入個別訪客姓名標籤時，會隨機挑選 1～3 張照片置頂，並以兩倍卡片寬度顯示。此功能不套用於「全部訪客」與「最新照片」。
        </p>
      </div>
      {loading ? (
        <span className="guest-featured-status">正在讀取設定…</span>
      ) : (
        <label className="admin-check">
          <input
            type="checkbox"
            checked={draft}
            onChange={(event) => {
              setDraft(event.target.checked);
              setMessage("");
              setError("");
            }}
            disabled={saving}
          />
          啟用姓名標籤隨機置頂照片
        </label>
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
