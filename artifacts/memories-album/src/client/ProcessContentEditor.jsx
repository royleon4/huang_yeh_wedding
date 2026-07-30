import { useCallback, useEffect, useMemo, useState } from "react";
import { adminErrorMessage, adminRequest } from "./admin-client.mjs";
import RichTextEditor from "./RichTextEditor.jsx";
import PinnedPhotoPicker from "./PinnedPhotoPicker.jsx";
import {
  normalizePinnedPhotoIds,
  normalizePinnedPhotosByProcess,
} from "../pinned-photo-settings.mjs";

const EMPTY_CONTENT = {
  processKey: "",
  labelZh: "",
  labelEn: "",
  youtubeVideoId: "",
  youtubeAutoplay: false,
  showAllPhotos: true,
  contentHtmlZh: "",
  contentHtmlEn: "",
  dividerPaddingTop: 12,
  dividerPaddingBottom: 12,
  attachments: [],
  pinnedPhotoIds: [],
};

let adminPhotosPromise = null;

async function loadAllAdminPhotos() {
  if (adminPhotosPromise) return adminPhotosPromise;
  adminPhotosPromise = (async () => {
    const photos = [];
    let cursor = null;
    let pages = 0;
    do {
      const query = new URLSearchParams({ limit: "100" });
      if (cursor) query.set("cursor", cursor);
      const payload = await adminRequest(`/admin/api/photos?${query}`);
      photos.push(...(payload.photos ?? []));
      cursor = payload.nextCursor ?? null;
      pages += 1;
    } while (cursor && pages < 30);
    return photos;
  })().catch((error) => {
    adminPhotosPromise = null;
    throw error;
  });
  return adminPhotosPromise;
}

function youtubeInput(content) {
  return content.youtubeVideoId
    ? `https://www.youtube.com/watch?v=${content.youtubeVideoId}`
    : "";
}

function normalizeLoaded(content, processKey, pinnedPhotoIds = []) {
  return {
    ...EMPTY_CONTENT,
    ...content,
    processKey,
    labelZh: content?.labelZh ?? (processKey === "all" ? "全部流程" : ""),
    labelEn: content?.labelEn ?? (processKey === "all" ? "All moments" : ""),
    youtubeUrl: youtubeInput(content ?? {}),
    attachments: Array.isArray(content?.attachments) ? content.attachments : [],
    pinnedPhotoIds: normalizePinnedPhotoIds(pinnedPhotoIds),
  };
}

function ContentFields({
  content,
  setContent,
  busy,
  onUploadAttachment,
  onDeleteAttachment,
}) {
  const [language, setLanguage] = useState("zh");
  const htmlKey = language === "zh" ? "contentHtmlZh" : "contentHtmlEn";
  return (
    <details className="process-content-details">
      <summary>文字、圖片與附件</summary>
      <div className="process-content-expanded">
        <div className="process-language-tabs" role="tablist" aria-label="內容語言">
          <button
            type="button"
            className={language === "zh" ? "active" : ""}
            onClick={() => setLanguage("zh")}
            disabled={busy}
          >
            中文內容
          </button>
          <button
            type="button"
            className={language === "en" ? "active" : ""}
            onClick={() => setLanguage("en")}
            disabled={busy}
          >
            English content
          </button>
        </div>
        <RichTextEditor
          value={content[htmlKey]}
          onChange={(html) => setContent((current) => ({ ...current, [htmlKey]: html }))}
          disabled={busy}
          onUploadAttachment={onUploadAttachment}
          attachments={content.attachments}
          onDeleteAttachment={onDeleteAttachment}
          ariaLabel={language === "zh" ? "中文流程內容" : "English process content"}
        />
        <div className="process-padding-fields">
          <label>
            分隔線上方留白
            <span>
              <input
                type="number"
                min="0"
                max="96"
                step="1"
                value={content.dividerPaddingTop}
                onChange={(event) =>
                  setContent((current) => ({
                    ...current,
                    dividerPaddingTop: Number(event.target.value),
                  }))
                }
                disabled={busy}
              />
              px
            </span>
          </label>
          <label>
            分隔線下方留白
            <span>
              <input
                type="number"
                min="0"
                max="96"
                step="1"
                value={content.dividerPaddingBottom}
                onChange={(event) =>
                  setContent((current) => ({
                    ...current,
                    dividerPaddingBottom: Number(event.target.value),
                  }))
                }
                disabled={busy}
              />
              px
            </span>
          </label>
        </div>
        <p className="admin-section-note">
          內容空白時，前端不會保留區塊或空白。附件會儲存在 Google Drive 的「00 未分類」。
        </p>
      </div>
    </details>
  );
}

function ProcessContentPanel({ processKey, special = false }) {
  const [content, setContent] = useState(() => normalizeLoaded({}, processKey));
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const candidatePhotos = useMemo(
    () =>
      photos.filter(
        (photo) =>
          photo.visibility === "public" &&
          photo.albumIds?.includes("wedding") &&
          (processKey === "all" || photo.categoryIds?.includes(processKey)),
      ),
    [photos, processKey],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [payload, settings, loadedPhotos] = await Promise.all([
        adminRequest(`/admin/api/process-content/${encodeURIComponent(processKey)}`),
        adminRequest("/admin/api/settings"),
        loadAllAdminPhotos(),
      ]);
      const pinnedMap = normalizePinnedPhotosByProcess(
        settings.pinnedPhotoIdsByProcess,
      );
      setContent(
        normalizeLoaded(payload.content, processKey, pinnedMap[processKey]),
      );
      setPhotos(loadedPhotos);
    } catch (loadError) {
      setError(adminErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [processKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const uploadAttachment = async (file) => {
    const form = new FormData();
    form.append("attachment", file);
    const payload = await adminRequest(
      `/admin/api/process-content/${encodeURIComponent(processKey)}/attachments`,
      { method: "POST", form, timeoutMs: 120_000 },
    );
    setContent((current) => ({
      ...current,
      attachments: [payload.attachment, ...current.attachments],
    }));
    return payload.attachment;
  };

  const deleteAttachment = async (attachment) => {
    if (!window.confirm(`確定移除附件「${attachment.name}」嗎？`)) return;
    setBusy(true);
    setError("");
    try {
      await adminRequest(
        `/admin/api/process-content/attachments/${encodeURIComponent(attachment.id)}`,
        { method: "DELETE", timeoutMs: 120_000 },
      );
      setContent((current) => ({
        ...current,
        attachments: current.attachments.filter((item) => item.id !== attachment.id),
      }));
      setMessage("附件已移除。請確認內文中不再使用該附件。");
    } catch (deleteError) {
      setError(adminErrorMessage(deleteError));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const payload = await adminRequest(
        `/admin/api/process-content/${encodeURIComponent(processKey)}`,
        {
          method: "PATCH",
          timeoutMs: 120_000,
          body: {
            labelZh: content.labelZh,
            labelEn: content.labelEn,
            youtubeUrl: content.youtubeUrl,
            youtubeAutoplay: content.youtubeAutoplay,
            showAllPhotos: content.showAllPhotos,
            contentHtmlZh: content.contentHtmlZh,
            contentHtmlEn: content.contentHtmlEn,
            dividerPaddingTop: content.dividerPaddingTop,
            dividerPaddingBottom: content.dividerPaddingBottom,
          },
        },
      );

      const latestSettings = await adminRequest("/admin/api/settings");
      const pinnedMap = normalizePinnedPhotosByProcess(
        latestSettings.pinnedPhotoIdsByProcess,
      );
      const pinnedPhotoIds = normalizePinnedPhotoIds(content.pinnedPhotoIds);
      if (pinnedPhotoIds.length > 0) {
        pinnedMap[processKey] = pinnedPhotoIds;
      } else {
        delete pinnedMap[processKey];
      }
      const savedSettings = await adminRequest("/admin/api/settings", {
        method: "PATCH",
        body: { pinnedPhotoIdsByProcess: pinnedMap },
      });
      const savedPinnedMap = normalizePinnedPhotosByProcess(
        savedSettings.pinnedPhotoIdsByProcess,
      );
      setContent(
        normalizeLoaded(payload.content, processKey, savedPinnedMap[processKey]),
      );
      setMessage("流程內容與置頂圖已儲存。");
    } catch (saveError) {
      setError(adminErrorMessage(saveError));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="process-content-loading">正在載入文字、附件與置頂圖…</div>;
  }

  const fields = (
    <>
      <ContentFields
        content={content}
        setContent={setContent}
        busy={busy}
        onUploadAttachment={uploadAttachment}
        onDeleteAttachment={deleteAttachment}
      />
      <PinnedPhotoPicker
        photos={candidatePhotos}
        selectedIds={content.pinnedPhotoIds}
        onChange={(pinnedPhotoIds) =>
          setContent((current) => ({ ...current, pinnedPhotoIds }))
        }
        busy={busy}
        processKey={processKey}
      />
    </>
  );

  if (!special) {
    return (
      <div className="process-content-inline-editor">
        {fields}
        {(message || error) && (
          <p className={error ? "admin-form-error" : "process-content-success"}>
            {error || message}
          </p>
        )}
        <button
          className="process-content-save"
          type="button"
          onClick={() => void save()}
          disabled={busy}
        >
          {busy ? "儲存中…" : "儲存文字、附件與置頂圖"}
        </button>
      </div>
    );
  }

  return (
    <div className="admin-editor-card admin-category-row all-process-editor">
      <span className="admin-order-number">00</span>
      <label>
        中文分類
        <input
          value={content.labelZh}
          onChange={(event) =>
            setContent((current) => ({ ...current, labelZh: event.target.value }))
          }
          required
          disabled={busy}
        />
      </label>
      <label>
        英文分類
        <input
          value={content.labelEn}
          onChange={(event) =>
            setContent((current) => ({ ...current, labelEn: event.target.value }))
          }
          disabled={busy}
        />
      </label>
      <label className="admin-wide-field admin-youtube-field">
        YouTube 連結
        <input
          type="url"
          value={content.youtubeUrl}
          onChange={(event) =>
            setContent((current) => ({ ...current, youtubeUrl: event.target.value }))
          }
          placeholder="https://www.youtube.com/watch?v=..."
          disabled={busy}
        />
      </label>
      <label className="admin-check admin-youtube-autoplay">
        <input
          type="checkbox"
          checked={content.youtubeAutoplay}
          onChange={(event) =>
            setContent((current) => ({
              ...current,
              youtubeAutoplay: event.target.checked,
            }))
          }
          disabled={busy || !content.youtubeUrl.trim()}
        />
        前端自動播放（靜音）
      </label>
      <label className="admin-check all-process-photo-toggle">
        <input
          type="checkbox"
          checked={content.showAllPhotos}
          onChange={(event) =>
            setContent((current) => ({
              ...current,
              showAllPhotos: event.target.checked,
            }))
          }
          disabled={busy}
        />
        選擇「全部流程」時顯示所有婚禮相片
      </label>
      {fields}
      {(message || error) && (
        <p className={error ? "admin-form-error" : "process-content-success"}>
          {error || message}
        </p>
      )}
      <div className="all-process-actions">
        <span>固定在最上層，不參與其他分類的排序。</span>
        <button type="button" onClick={() => void save()} disabled={busy}>
          {busy ? "儲存中…" : "儲存全部流程"}
        </button>
      </div>
    </div>
  );
}

export function AllProcessEditor() {
  return <ProcessContentPanel processKey="all" special />;
}

export default function ProcessContentEditor({ processKey }) {
  return <ProcessContentPanel processKey={processKey} />;
}
