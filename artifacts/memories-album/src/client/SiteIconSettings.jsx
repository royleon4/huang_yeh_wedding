import { useEffect, useMemo, useState } from "react";
import {
  EMPTY_SITE_ICON_METADATA,
  SITE_ICON_ACCEPTED_CONTENT_TYPES,
  SITE_ICON_FILE_ERROR_CODES,
  SITE_ICON_MAX_UPLOAD_BYTES,
  siteIconUrl,
  validateSiteIconFile,
} from "../site-icon.mjs";
import { adminErrorMessage } from "./admin-client.mjs";
import { useAdminSaveSection } from "./AdminSaveCoordinator.jsx";
import {
  applySiteIcon,
  loadAdminSiteIcon,
  removeAdminSiteIcon,
  replaceAdminSiteIcon,
} from "./site-icon-client.mjs";
import "./site-icon-settings.css";

const UNCHANGED_DRAFT = Object.freeze({ kind: "unchanged", file: null });
const MAX_UPLOAD_MB = SITE_ICON_MAX_UPLOAD_BYTES / (1024 * 1024);

function useObjectUrl(file) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!file) {
      setUrl("");
      return undefined;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return url;
}

function fileValidationMessage(code) {
  if (code === SITE_ICON_FILE_ERROR_CODES.unsupportedType) {
    return "網站圖示只支援 PNG、JPEG 或 WebP。";
  }
  if (code === SITE_ICON_FILE_ERROR_CODES.tooLarge) {
    return `網站圖示不能超過 ${MAX_UPLOAD_MB} MB。`;
  }
  return "請選擇網站圖示檔案。";
}

function draftStatusLabel(draft, saved) {
  if (draft.kind === "replace") return draft.file.name;
  if (draft.kind === "remove") return "將移除自訂圖示";
  return saved.configured ? "目前使用自訂圖示" : "目前沒有自訂圖示";
}

export default function SiteIconSettings() {
  const [saved, setSaved] = useState(EMPTY_SITE_ICON_METADATA);
  const [draft, setDraft] = useState(UNCHANGED_DRAFT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedFile = draft.kind === "replace" ? draft.file : null;
  const localPreview = useObjectUrl(selectedFile);
  const changed = draft.kind !== "unchanged";
  const previewUrl = useMemo(() => {
    if (localPreview) return localPreview;
    if (draft.kind !== "remove" && saved.configured) {
      return siteIconUrl(saved.version);
    }
    return "";
  }, [draft.kind, localPreview, saved]);

  useEffect(() => {
    let cancelled = false;
    void loadAdminSiteIcon()
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

  const clearFeedback = () => {
    setMessage("");
    setError("");
  };

  const resetDraft = () => {
    setDraft(UNCHANGED_DRAFT);
    clearFeedback();
  };

  const chooseFile = (file) => {
    clearFeedback();
    const validation = validateSiteIconFile(file);
    if (!validation.valid) {
      setError(fileValidationMessage(validation.code));
      return;
    }
    setDraft({ kind: "replace", file });
  };

  const requestRemoval = () => {
    setDraft({ kind: "remove", file: null });
    clearFeedback();
  };

  const save = async () => {
    if (saving || !changed) return { succeeded: 0 };
    setSaving(true);
    clearFeedback();
    try {
      const next =
        draft.kind === "replace"
          ? await replaceAdminSiteIcon(draft.file)
          : await removeAdminSiteIcon();
      setSaved(next);
      setDraft(UNCHANGED_DRAFT);
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
              <strong>{draftStatusLabel(draft, saved)}</strong>
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
                onClick={requestRemoval}
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
