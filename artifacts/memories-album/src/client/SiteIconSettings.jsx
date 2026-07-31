import { useEffect, useMemo, useState } from "react";
import {
  SITE_ICON_ACCEPTED_CONTENT_TYPES,
  SITE_ICON_MAX_UPLOAD_BYTES,
  siteIconMetadata,
  siteIconUrl,
} from "../site-icon.mjs";
import { adminErrorMessage } from "./admin-client.mjs";
import { useAdminSaveSection } from "./AdminSaveCoordinator.jsx";
import {
  applySiteIcon,
  requestAdminSiteIcon,
} from "./site-icon-client.mjs";
import "./site-icon-settings.css";

const EMPTY_ICON = siteIconMetadata(null);
const MAX_UPLOAD_MB = SITE_ICON_MAX_UPLOAD_BYTES / (1024 * 1024);

export default function SiteIconSettings() {
  const [saved, setSaved] = useState(EMPTY_ICON);
  const [selectedFile, setSelectedFile] = useState(null);
  const [removeRequested, setRemoveRequested] = useState(false);
  const [localPreview, setLocalPreview] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const changed = Boolean(selectedFile) || removeRequested;
  const previewUrl = useMemo(() => {
    if (localPreview) return localPreview;
    if (!removeRequested && saved.configured) return siteIconUrl(saved.version);
    return "";
  }, [localPreview, removeRequested, saved]);

  useEffect(() => {
    let cancelled = false;
    void requestAdminSiteIcon()
      .then((metadata) => {
        if (cancelled) return;
        setSaved(metadata);
        applySiteIcon(metadata);
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

  useEffect(() => {
    if (!selectedFile) {
      setLocalPreview("");
      return undefined;
    }
    const objectUrl = URL.createObjectURL(selectedFile);
    setLocalPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile]);

  const resetDraft = () => {
    setSelectedFile(null);
    setRemoveRequested(false);
    setMessage("");
    setError("");
  };

  const chooseFile = (file) => {
    setMessage("");
    setError("");
    if (!file) return;
    if (!SITE_ICON_ACCEPTED_CONTENT_TYPES.includes(file.type)) {
      setError("網站圖示只支援 PNG、JPEG 或 WebP。");
      return;
    }
    if (file.size > SITE_ICON_MAX_UPLOAD_BYTES) {
      setError(`網站圖示不能超過 ${MAX_UPLOAD_MB} MB。`);
      return;
    }
    setSelectedFile(file);
    setRemoveRequested(false);
  };

  const save = async () => {
    if (saving || !changed) return { succeeded: 0 };
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const next = selectedFile
        ? await requestAdminSiteIcon({ method: "PUT", file: selectedFile })
        : await requestAdminSiteIcon({ method: "DELETE" });
      setSaved(next);
      setSelectedFile(null);
      setRemoveRequested(false);
      applySiteIcon(next);
      setMessage(
        next.configured
          ? "網站圖示已儲存；重新整理公開網站後，瀏覽器分頁與加入主畫面的圖示會更新。"
          : "自訂網站圖示已移除。",
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

  useAdminSaveSection("site-icon", {
    pendingCount: changed ? 1 : 0,
    save,
  });

  return (
    <section
      className="site-icon-settings general-setting-card"
      aria-labelledby="site-icon-settings-title"
    >
      <div className="site-icon-heading">
        <div>
          <p className="admin-kicker">WEBSITE ICON</p>
          <h2 id="site-icon-settings-title">網站圖示</h2>
          <p>
            上傳瀏覽器分頁與手機加入主畫面使用的圖示。系統會保留完整圖片並轉成 192 × 192 的 PNG。
          </p>
        </div>
      </div>

      {loading ? (
        <p className="admin-feature-status">正在讀取網站圖示…</p>
      ) : (
        <div className="site-icon-editor">
          <div className="site-icon-preview" aria-label="網站圖示預覽">
            {previewUrl ? (
              <img src={previewUrl} alt="目前選擇的網站圖示" />
            ) : (
              <span aria-hidden="true">LY</span>
            )}
          </div>

          <div className="site-icon-controls">
            <div>
              <strong>
                {selectedFile
                  ? selectedFile.name
                  : removeRequested
                    ? "將移除自訂圖示"
                    : saved.configured
                      ? "目前使用自訂圖示"
                      : "目前沒有自訂圖示"}
              </strong>
              <p>
                支援 PNG、JPEG、WebP，檔案上限 {MAX_UPLOAD_MB} MB。建議使用正方形、有透明背景的圖片。
              </p>
            </div>

            <div className="site-icon-actions">
              <label className="site-icon-file-button">
                <input
                  type="file"
                  accept={SITE_ICON_ACCEPTED_CONTENT_TYPES.join(",")}
                  onChange={(event) => chooseFile(event.target.files?.[0])}
                  disabled={saving}
                />
                {saved.configured || selectedFile ? "更換圖示" : "選擇圖示"}
              </label>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setSelectedFile(null);
                  setRemoveRequested(true);
                  setMessage("");
                  setError("");
                }}
                disabled={saving || (!saved.configured && !selectedFile)}
              >
                移除自訂圖示
              </button>
              {changed && (
                <button
                  type="button"
                  className="secondary"
                  onClick={resetDraft}
                  disabled={saving}
                >
                  取消變更
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <p className="admin-draft-hint">
        {changed ? "網站圖示有未儲存變更。" : "變更會由頁面底部統一儲存。"}
      </p>

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
