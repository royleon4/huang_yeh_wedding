import { useMemo, useRef, useState } from "react";
import { uploadQueue } from "./upload-client.mjs";

const COPY = {
  zh: {
    title: "把你的照片放進檔案館",
    intro: "請留下姓名並選擇照片。每張照片會獨立上傳；其中一張失敗時，其餘照片仍會繼續。",
    name: "你的姓名（必填）",
    namePlaceholder: "例如：小安",
    files: "選擇照片",
    choose: "選擇最多 30 張照片",
    hint: "支援 JPEG、PNG、WebP、HEIC／HEIF；每張上限 25 MB。訪客照片只會出現在「訪客上傳」。",
    start: "開始上傳",
    cancel: "取消上傳",
    close: "關閉",
    queued: "等待中",
    uploading: "上傳中",
    success: "已收藏",
    failed: "失敗",
    cancelled: "已取消",
    overall: "整體進度",
    required: "請填寫姓名並至少選擇一張照片。",
    completed: "上傳完成",
    partial: "部分照片已成功收藏",
    management: "請保存這個私人管理連結。之後可用它查看或撤回這批照片。",
    openManagement: "開啟私人管理連結",
    retryNote: "可關閉視窗後重新選擇失敗的照片上傳。",
  },
  en: {
    title: "Add your photos to the archive",
    intro: "Enter your name and choose photos. Every file uploads independently, so one failure will not stop the rest.",
    name: "Your name (required)",
    namePlaceholder: "For example: An",
    files: "Choose photos",
    choose: "Choose up to 30 photos",
    hint: "JPEG, PNG, WebP, HEIC and HEIF are accepted, up to 25 MB each. Guest photos appear only in Guest uploads.",
    start: "Start upload",
    cancel: "Cancel upload",
    close: "Close",
    queued: "Queued",
    uploading: "Uploading",
    success: "Collected",
    failed: "Failed",
    cancelled: "Cancelled",
    overall: "Overall progress",
    required: "Enter your name and select at least one photo.",
    completed: "Upload complete",
    partial: "Some photos were collected",
    management: "Save this private management link. It will let you view or withdraw this batch later.",
    openManagement: "Open private management link",
    retryNote: "Close this window and select failed photos again to retry them.",
  },
};

function statusLabel(copy, status) {
  return copy[status] ?? status;
}

export default function UploadModal({ lang, onClose, onUploaded }) {
  const t = COPY[lang] ?? COPY.zh;
  const [uploaderName, setUploaderName] = useState("");
  const [files, setFiles] = useState([]);
  const [items, setItems] = useState([]);
  const [phase, setPhase] = useState("idle");
  const [error, setError] = useState("");
  const [batch, setBatch] = useState(null);
  const [summary, setSummary] = useState(null);
  const controllerRef = useRef(null);

  const overallProgress = useMemo(() => {
    if (items.length === 0) return 0;
    return Math.round(
      items.reduce((total, item) => total + (item.progress ?? 0), 0) /
        items.length,
    );
  }, [items]);

  const handleFiles = (event) => {
    const selected = Array.from(event.target.files ?? []).slice(0, 30);
    setFiles(selected);
    setItems(
      selected.map((file) => ({
        file,
        status: "queued",
        progress: 0,
        error: null,
      })),
    );
    setError("");
    setSummary(null);
    setBatch(null);
  };

  const startUpload = async (event) => {
    event.preventDefault();
    if (!uploaderName.trim() || files.length === 0) {
      setError(t.required);
      return;
    }
    setError("");
    setPhase("uploading");
    const controller = new AbortController();
    controllerRef.current = controller;
    const uploadedIds = new Set();
    try {
      const result = await uploadQueue({
        uploaderName,
        files,
        signal: controller.signal,
        onUpdate(update) {
          if (update.type === "batch") setBatch(update.batch);
          if (update.type === "queue") setItems(update.results);
          if (update.type === "file") {
            setItems((current) => {
              const next = [...current];
              next[update.index] = update.item;
              return next;
            });
            if (
              update.item.status === "success" &&
              update.item.photo &&
              !uploadedIds.has(update.item.photo.id)
            ) {
              uploadedIds.add(update.item.photo.id);
              onUploaded(update.item.photo);
            }
          }
        },
      });
      setBatch(result.batch);
      setSummary(result.summary);
      setPhase("done");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed");
      setPhase("idle");
    } finally {
      controllerRef.current = null;
    }
  };

  const cancelUpload = () => controllerRef.current?.abort();
  const close = () => {
    controllerRef.current?.abort();
    onClose();
  };

  const completedTitle =
    summary?.failed || summary?.cancelled ? t.partial : t.completed;

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="paper-modal upload-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-dialog-title"
      >
        <button
          className="icon-button modal-close"
          type="button"
          onClick={close}
          aria-label={t.close}
        >
          ×
        </button>
        <p className="eyebrow">GUEST MEMORIES · 20 JUN 2026</p>
        <h2 id="upload-dialog-title">{t.title}</h2>
        <p>{t.intro}</p>

        <form className="upload-form" onSubmit={startUpload}>
          <label>
            <span>{t.name}</span>
            <input
              type="text"
              value={uploaderName}
              onChange={(event) => setUploaderName(event.target.value)}
              placeholder={t.namePlaceholder}
              maxLength={80}
              required
              disabled={phase === "uploading"}
              autoComplete="name"
            />
          </label>
          <label className="file-picker">
            <span>{t.files}</span>
            <strong>{t.choose}</strong>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              multiple
              onChange={handleFiles}
              disabled={phase === "uploading"}
            />
          </label>
          <small className="upload-hint">{t.hint}</small>

          {items.length > 0 && (
            <div className="upload-queue" aria-live="polite">
              <div className="overall-progress">
                <span>{t.overall}</span>
                <strong>{overallProgress}%</strong>
                <progress max="100" value={overallProgress} />
              </div>
              <ol>
                {items.map((item, index) => (
                  <li key={`${item.file.name}-${item.file.lastModified}-${index}`}>
                    <div>
                      <strong>{item.file.name}</strong>
                      <small>
                        {statusLabel(t, item.status)}
                        {item.error ? ` · ${item.error}` : ""}
                      </small>
                    </div>
                    <span>{item.progress ?? 0}%</span>
                    <progress max="100" value={item.progress ?? 0} />
                  </li>
                ))}
              </ol>
            </div>
          )}

          {error && <p className="upload-error" role="alert">{error}</p>}

          {phase === "done" && summary && (
            <section className="upload-result">
              <h3>{completedTitle}</h3>
              <p>
                {summary.success} ✓ · {summary.failed} ✕ · {summary.cancelled} —
              </p>
              {batch?.manageUrl && (
                <>
                  <p>{t.management}</p>
                  <a className="button primary" href={batch.manageUrl}>
                    {t.openManagement}
                  </a>
                </>
              )}
              {(summary.failed > 0 || summary.cancelled > 0) && (
                <small>{t.retryNote}</small>
              )}
            </section>
          )}

          <div className="upload-actions">
            {phase !== "uploading" && phase !== "done" && (
              <button className="button primary" type="submit">
                {t.start}
              </button>
            )}
            {phase === "uploading" && (
              <button className="button secondary" type="button" onClick={cancelUpload}>
                {t.cancel}
              </button>
            )}
            {phase === "done" && (
              <button className="button secondary" type="button" onClick={close}>
                {t.close}
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
