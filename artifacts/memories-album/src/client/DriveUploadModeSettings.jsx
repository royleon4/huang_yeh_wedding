import { useEffect, useState } from "react";
import { adminErrorMessage, adminRequest } from "./admin-client.mjs";
import { useAdminSaveSection } from "./AdminSaveCoordinator.jsx";

const MODES = [
  {
    value: "single",
    title: "不分塊上傳",
    description:
      "建立 Google Drive resumable session 後，整個原始檔案只送出一次。這是目前預設模式。",
  },
  {
    value: "chunked",
    title: "分塊上傳",
    description:
      "使用原有的 4 MiB chunk 機制。只建議除錯或確認 Replit connector 已修復後再開啟。",
  },
];

export default function DriveUploadModeSettings() {
  const [savedMode, setSavedMode] = useState("single");
  const [draftMode, setDraftMode] = useState("single");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const changed = draftMode !== savedMode;

  useEffect(() => {
    let cancelled = false;
    void adminRequest("/admin/api/settings")
      .then((settings) => {
        if (cancelled) return;
        const mode = settings.driveUploadMode === "chunked" ? "chunked" : "single";
        setSavedMode(mode);
        setDraftMode(mode);
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
        body: { driveUploadMode: draftMode },
      });
      const mode = result.driveUploadMode === "chunked" ? "chunked" : "single";
      setSavedMode(mode);
      setDraftMode(mode);
      setMessage(
        mode === "single"
          ? "已改為不分塊上傳。新的上傳會整個檔案一次送出。"
          : "已開啟分塊上傳。新的上傳會使用原有 chunk 機制。",
      );
      return { succeeded: 1 };
    } catch (saveError) {
      if (saveError?.status === 401) window.location.replace("/Memories/");
      setError(adminErrorMessage(saveError));
      throw saveError;
    } finally {
      setSaving(false);
    }
  };

  useAdminSaveSection("drive-upload-mode", {
    pendingCount: changed ? 1 : 0,
    save,
  });

  return (
    <section className="general-setting-card" aria-labelledby="drive-upload-mode-title">
      <div className="general-setting-heading">
        <div>
          <p className="admin-kicker">GOOGLE DRIVE UPLOAD</p>
          <h3 id="drive-upload-mode-title">原始檔案上傳模式</h3>
        </div>
        <span>{savedMode === "single" ? "目前：不分塊" : "目前：分塊"}</span>
      </div>

      <p className="admin-section-note">
        只影響儲存到 Google Drive 的原始圖片。切換後只套用到新的上傳；已經進行中的檔案不會被中途改變。
      </p>

      {loading ? (
        <p className="general-setting-status">正在讀取設定…</p>
      ) : (
        <>
          <div className="upload-mode-options" role="radiogroup" aria-label="原始檔案上傳模式">
            {MODES.map((mode) => (
              <label
                key={mode.value}
                className={`upload-mode-option${draftMode === mode.value ? " selected" : ""}`}
              >
                <input
                  type="radio"
                  name="drive-upload-mode"
                  value={mode.value}
                  checked={draftMode === mode.value}
                  onChange={() => {
                    setDraftMode(mode.value);
                    setMessage("");
                    setError("");
                  }}
                  disabled={saving}
                />
                <span>
                  <strong>{mode.title}</strong>
                  <small>{mode.description}</small>
                </span>
              </label>
            ))}
          </div>

          <div className="general-setting-actions">
            <span>
              {changed
                ? "上傳模式有未儲存變更。"
                : "變更會由頁面底部統一儲存；目前預設為不分塊上傳。"}
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
