import { useEffect, useState } from "react";
import { adminErrorMessage, adminRequest } from "./admin-client.mjs";
import { useAdminSaveSection } from "./AdminSaveCoordinator.jsx";

export default function AdminFeatureSettings() {
  const [enabled, setEnabled] = useState(true);
  const [draft, setDraft] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const changed = draft !== enabled;

  useEffect(() => {
    let cancelled = false;
    void adminRequest("/admin/api/settings")
      .then((settings) => {
        if (cancelled) return;
        const next = settings.guestUploadCategorySelectionEnabled !== false;
        setEnabled(next);
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

  const save = async () => {
    if (saving || !changed) return { succeeded: 0 };
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const result = await adminRequest("/admin/api/settings", {
        method: "PATCH",
        body: { guestUploadCategorySelectionEnabled: draft },
      });
      const next = result.guestUploadCategorySelectionEnabled === true;
      setEnabled(next);
      setDraft(next);
      setMessage(next ? "訪客分類選擇已開啟。" : "訪客分類選擇已關閉。");
      return { succeeded: 1 };
    } catch (saveError) {
      if (saveError?.status === 401) window.location.replace("/Memories/");
      setError(adminErrorMessage(saveError));
      throw saveError;
    } finally {
      setSaving(false);
    }
  };

  useAdminSaveSection("guest-upload-category-selection", {
    pendingCount: changed ? 1 : 0,
    save,
  });

  return (
    <section
      className="admin-feature-settings general-setting-card"
      aria-labelledby="feature-settings-title"
    >
      <div>
        <p className="admin-kicker">FEATURE SETTINGS</p>
        <h2 id="feature-settings-title">訪客上傳設定</h2>
        <p>
          開啟後，訪客上傳照片時可以選擇「生活照」或婚禮流程分類；訪客姓名標籤不會出現在選項中，仍由系統依填寫姓名自動分組。
        </p>
      </div>

      {loading ? (
        <p className="admin-feature-status">正在讀取設定…</p>
      ) : (
        <div className="admin-feature-control">
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
            允許訪客上傳時選擇照片分類
          </label>
          <span className="admin-draft-hint">
            {changed ? "訪客上傳設定有未儲存變更。" : "變更會由頁面底部統一儲存。"}
          </span>
        </div>
      )}

      {(message || error) && (
        <p
          className={`admin-feature-status${error ? " error" : ""}`}
          role={error ? "alert" : "status"}
        >
          {error || message}
        </p>
      )}
    </section>
  );
}
