import { useEffect, useMemo, useState } from "react";
import {
  ADMIN_UPLOAD_LIMIT_OPTIONS,
  GUEST_UPLOAD_LIMIT_OPTIONS,
  UPLOAD_DESCRIPTION_MAX_LENGTH,
  normalizeUploadSettings,
} from "../upload-settings.mjs";
import { adminErrorMessage, adminRequest } from "./admin-client.mjs";
import { useAdminSaveSection } from "./AdminSaveCoordinator.jsx";
import "./upload-settings.css";

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

function normalizedCardSettings(value) {
  const upload = normalizeUploadSettings(value);
  return {
    driveUploadMode: value?.driveUploadMode === "chunked" ? "chunked" : "single",
    ...upload,
  };
}

function descriptionsEqual(left, right) {
  return left?.zh === right?.zh && left?.en === right?.en;
}

export default function DriveUploadModeSettings() {
  const initial = useMemo(() => normalizedCardSettings({}), []);
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const changedFields = [
    draft.driveUploadMode !== saved.driveUploadMode,
    draft.guestUploadMaxPhotos !== saved.guestUploadMaxPhotos,
    draft.adminUploadMaxPhotos !== saved.adminUploadMaxPhotos,
    !descriptionsEqual(draft.uploadDescription, saved.uploadDescription),
  ].filter(Boolean).length;
  const changed = changedFields > 0;

  useEffect(() => {
    let cancelled = false;
    void adminRequest("/admin/api/settings")
      .then((settings) => {
        if (cancelled) return;
        const next = normalizedCardSettings(settings);
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

  const updateDescription = (language, value) => {
    setDraft((current) => ({
      ...current,
      uploadDescription: {
        ...current.uploadDescription,
        [language]: value,
      },
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
      const result = await adminRequest("/admin/api/settings", {
        method: "PATCH",
        body: {
          driveUploadMode: draft.driveUploadMode,
          guestUploadMaxPhotos: draft.guestUploadMaxPhotos,
          adminUploadMaxPhotos: draft.adminUploadMaxPhotos,
          uploadDescription: draft.uploadDescription,
        },
      });
      const echoed = normalizedCardSettings(result);
      const verified =
        result.driveUploadMode === draft.driveUploadMode &&
        Number(result.guestUploadMaxPhotos) === draft.guestUploadMaxPhotos &&
        Number(result.adminUploadMaxPhotos) === draft.adminUploadMaxPhotos &&
        descriptionsEqual(result.uploadDescription, draft.uploadDescription);
      if (!verified) {
        throw new Error("伺服器沒有完整回傳已儲存的上傳設定，草稿已保留。");
      }
      setSaved(echoed);
      setDraft(echoed);
      setMessage(
        `已儲存：訪客每次 ${echoed.guestUploadMaxPhotos} 張，管理員每次 ${echoed.adminUploadMaxPhotos} 張。`,
      );
      return { succeeded: changedFields };
    } catch (saveError) {
      if (saveError?.status === 401) window.location.replace("/Memories/");
      setError(adminErrorMessage(saveError));
      throw saveError;
    } finally {
      setSaving(false);
    }
  };

  useAdminSaveSection("drive-upload-mode", {
    pendingCount: changedFields,
    save,
  });

  return (
    <section className="general-setting-card" aria-labelledby="upload-method-title">
      <div className="general-setting-heading">
        <div>
          <p className="admin-kicker">UPLOAD METHOD</p>
          <h3 id="upload-method-title">上傳方式</h3>
        </div>
        <span>
          訪客 {saved.guestUploadMaxPhotos}｜後台 {saved.adminUploadMaxPhotos}
        </span>
      </div>

      <p className="admin-section-note">
        在同一張卡片管理 Google Drive 傳送方式、訪客與管理員一次可選的照片數量，以及上傳介面顯示的中英文說明。數量只允許使用經過測試的選項。
      </p>

      {loading ? (
        <p className="general-setting-status">正在讀取設定…</p>
      ) : (
        <>
          <div className="upload-settings-block">
            <h4>Google Drive 原始檔案</h4>
            <div className="upload-mode-options" role="radiogroup" aria-label="原始檔案上傳模式">
              {MODES.map((mode) => (
                <label
                  key={mode.value}
                  className={`upload-mode-option${draft.driveUploadMode === mode.value ? " selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="drive-upload-mode"
                    value={mode.value}
                    checked={draft.driveUploadMode === mode.value}
                    onChange={() => updateDraft({ driveUploadMode: mode.value })}
                    disabled={saving}
                  />
                  <span>
                    <strong>{mode.title}</strong>
                    <small>{mode.description}</small>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="upload-settings-block">
            <h4>一次可選照片數量</h4>
            <div className="upload-limit-grid">
              <label>
                訪客上傳
                <select
                  value={draft.guestUploadMaxPhotos}
                  onChange={(event) =>
                    updateDraft({ guestUploadMaxPhotos: Number(event.target.value) })
                  }
                  disabled={saving}
                >
                  {GUEST_UPLOAD_LIMIT_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      每次最多 {value} 張
                    </option>
                  ))}
                </select>
                <small>可選 10 或 100 張。</small>
              </label>
              <label>
                管理員後台上傳
                <select
                  value={draft.adminUploadMaxPhotos}
                  onChange={(event) =>
                    updateDraft({ adminUploadMaxPhotos: Number(event.target.value) })
                  }
                  disabled={saving}
                >
                  {ADMIN_UPLOAD_LIMIT_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      每次最多 {value} 張
                    </option>
                  ))}
                </select>
                <small>可選 30 或 100 張。</small>
              </label>
            </div>
          </div>

          <div className="upload-settings-block">
            <h4>上傳說明文字</h4>
            <p className="admin-section-note">
              這段文字顯示在選擇照片欄位下方；可換行。照片數量會由介面自動顯示，不必寫進說明。
            </p>
            <div className="upload-description-grid">
              <label>
                中文說明
                <textarea
                  value={draft.uploadDescription.zh}
                  onChange={(event) => updateDescription("zh", event.target.value)}
                  maxLength={UPLOAD_DESCRIPTION_MAX_LENGTH}
                  rows={4}
                  disabled={saving}
                />
              </label>
              <label>
                English description
                <textarea
                  value={draft.uploadDescription.en}
                  onChange={(event) => updateDescription("en", event.target.value)}
                  maxLength={UPLOAD_DESCRIPTION_MAX_LENGTH}
                  rows={4}
                  disabled={saving}
                />
              </label>
            </div>
          </div>

          <div className="general-setting-actions">
            <span>
              {changed
                ? `上傳方式有 ${changedFields} 項未儲存變更。`
                : "變更會由頁面底部的「儲存所有變更」統一儲存。"}
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
