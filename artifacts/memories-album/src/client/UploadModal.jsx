import { useEffect, useMemo, useRef, useState } from "react";
import { retryFailedUploads, uploadQueue } from "./upload-client.mjs";

const MAX_UPLOAD_PHOTOS = 10;

const COPY = {
  zh: {
    title: "把你的照片放進檔案館",
    introEnabled:
      "請留下姓名、選擇照片，並可替這批照片選擇網站分類。你的姓名只會用來自動整理「訪客上傳」，不會出現在可選分類中。",
    introDisabled:
      "請留下姓名並選擇照片。上傳完成後，系統會依照姓名自動整理在「訪客上傳」分類中。",
    name: "你的姓名（必填）",
    namePlaceholder: "例如：小安",
    classification: "照片分類（選填）",
    guestOnly: "不指定分類，只顯示在訪客上傳",
    life: "生活照",
    weddingGroup: "婚禮流程",
    files: "選擇照片",
    choose: "選擇最多 10 張照片",
    hint: "支援 JPEG、PNG、WebP、HEIC／HEIF；每張上限 25 MB。照片逐張傳送並使用固定識別碼，重新嘗試不會重複建立 Drive 檔案。",
    tooMany: "一次最多只能選擇 10 張照片，已保留前 10 張。",
    start: "開始上傳",
    retryFailed: "繼續未完成照片",
    cancel: "暫停上傳",
    close: "關閉",
    queued: "等待中",
    uploading: "上傳中",
    retrying: "連線不穩，正在自動重試",
    success: "已收藏",
    failed: "尚未完成",
    cancelled: "已暫停",
    overall: "整體進度",
    required: "請填寫姓名並至少選擇一張照片。",
    completed: "上傳完成",
    partial: "部分照片尚未完成",
    management: "請保存這個私人管理連結。之後可用它查看或撤回這批照片。",
    openManagement: "開啟私人管理連結",
    retryNote:
      "已完成的照片不會重傳；按下「繼續未完成照片」會沿用同一批次與同一 Drive 檔案安全續傳。",
  },
  en: {
    title: "Add your photos to the archive",
    introEnabled:
      "Enter your name, choose photos, and optionally select where they appear. Your name only groups the Guest uploads view and is never offered as a selectable category.",
    introDisabled:
      "Enter your name and choose photos. The archive groups completed uploads automatically by that name.",
    name: "Your name (required)",
    namePlaceholder: "For example: An",
    classification: "Photo category (optional)",
    guestOnly: "No category — Guest uploads only",
    life: "Life photos",
    weddingGroup: "Wedding moments",
    files: "Choose photos",
    choose: "Choose up to 10 photos",
    hint: "JPEG, PNG, WebP, HEIC and HEIF are accepted, up to 25 MB each. Stable upload IDs prevent duplicate Drive files when a request is retried.",
    tooMany: "You can upload up to 10 photos at a time. The first 10 were kept.",
    start: "Start upload",
    retryFailed: "Continue unfinished photos",
    cancel: "Pause upload",
    close: "Close",
    queued: "Queued",
    uploading: "Uploading",
    retrying: "Connection interrupted — retrying automatically",
    success: "Collected",
    failed: "Not finished",
    cancelled: "Paused",
    overall: "Overall progress",
    required: "Enter your name and select at least one photo.",
    completed: "Upload complete",
    partial: "Some photos are not finished",
    management:
      "Save this private management link. It will let you view or withdraw this batch later.",
    openManagement: "Open private management link",
    retryNote:
      "Completed photos are never resent. Continue unfinished photos safely resumes the same batch and Drive files.",
  },
};

function statusLabel(copy, status) {
  return copy[status] ?? status;
}

function normalizeProcesses(value) {
  return Array.isArray(value)
    ? value
        .map((process) => ({
          id: process.id,
          zh: process.labelZh,
          en: process.labelEn || process.labelZh,
          displayOrder: Number(process.displayOrder) || 0,
        }))
        .filter((process) => process.id && process.zh)
        .sort(
          (left, right) =>
            left.displayOrder - right.displayOrder ||
            left.id.localeCompare(right.id),
        )
    : [];
}

export default function UploadModal({ lang, onClose, onUploaded }) {
  const t = COPY[lang] ?? COPY.zh;
  const [uploaderName, setUploaderName] = useState("");
  const [classificationChoice, setClassificationChoice] = useState("guest");
  const [categorySelectionEnabled, setCategorySelectionEnabled] =
    useState(true);
  const [processes, setProcesses] = useState([]);
  const [files, setFiles] = useState([]);
  const [items, setItems] = useState([]);
  const [phase, setPhase] = useState("idle");
  const [error, setError] = useState("");
  const [batch, setBatch] = useState(null);
  const [summary, setSummary] = useState(null);
  const controllerRef = useRef(null);
  const uploadedIdsRef = useRef(new Set());

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    void Promise.all([
      fetch("/Memories/api/settings", {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      }).then((response) => (response.ok ? response.json() : {})),
      fetch("/Memories/api/processes", {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      }).then((response) => (response.ok ? response.json() : {})),
    ])
      .then(([settings, processData]) => {
        if (cancelled) return;
        const enabled = settings.guestUploadCategorySelectionEnabled !== false;
        setCategorySelectionEnabled(enabled);
        if (!enabled) setClassificationChoice("guest");
        setProcesses(normalizeProcesses(processData.processes));
      })
      .catch(() => {
        // Restored behavior remains available while settings temporarily recover.
      })
      .finally(() => clearTimeout(timer));

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, []);

  const overallProgress = useMemo(() => {
    if (items.length === 0) return 0;
    return Math.round(
      items.reduce((total, item) => total + (item.progress ?? 0), 0) /
        items.length,
    );
  }, [items]);

  const handleFiles = (event) => {
    const allSelected = Array.from(event.target.files ?? []);
    const selected = allSelected.slice(0, MAX_UPLOAD_PHOTOS);
    setFiles(selected);
    setItems(
      selected.map((file) => ({
        file,
        status: "queued",
        progress: 0,
        error: null,
      })),
    );
    setError(allSelected.length > MAX_UPLOAD_PHOTOS ? t.tooMany : "");
    setSummary(null);
    setBatch(null);
    uploadedIdsRef.current.clear();
  };

  const handleUpdate = (update) => {
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
        !uploadedIdsRef.current.has(update.item.photo.id)
      ) {
        uploadedIdsRef.current.add(update.item.photo.id);
        onUploaded(update.item.photo);
      }
    }
  };

  const runUpload = async (operation) => {
    setError("");
    setPhase("uploading");
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const result = await operation(controller.signal);
      setBatch(result.batch);
      setItems(result.results);
      setSummary(result.summary);
      setPhase("done");
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Upload failed",
      );
      setPhase("done");
    } finally {
      controllerRef.current = null;
    }
  };

  const startUpload = async (event) => {
    event.preventDefault();
    if (!uploaderName.trim() || files.length === 0) {
      setError(t.required);
      return;
    }
    const choice = categorySelectionEnabled ? classificationChoice : "guest";
    const [classification, processId] = choice.startsWith("wedding:")
      ? ["wedding", choice.slice("wedding:".length)]
      : [choice, null];
    await runUpload((signal) =>
      uploadQueue({
        uploaderName,
        files,
        classification,
        processId,
        signal,
        onUpdate: handleUpdate,
      }),
    );
  };

  const retryUnfinished = () =>
    runUpload((signal) =>
      retryFailedUploads({
        batch,
        results: items,
        signal,
        onUpdate: handleUpdate,
      }),
    );

  const cancelUpload = () => controllerRef.current?.abort();
  const close = () => {
    controllerRef.current?.abort();
    onClose();
  };

  const hasUnfinished = Boolean(summary?.failed || summary?.cancelled);
  const completedTitle = hasUnfinished ? t.partial : t.completed;

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
        <p>{categorySelectionEnabled ? t.introEnabled : t.introDisabled}</p>

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
              disabled={phase === "uploading" || Boolean(batch)}
              autoComplete="name"
            />
          </label>
          {categorySelectionEnabled && (
            <label>
              <span>{t.classification}</span>
              <select
                value={classificationChoice}
                onChange={(event) =>
                  setClassificationChoice(event.target.value)
                }
                disabled={phase === "uploading" || Boolean(batch)}
              >
                <option value="guest">{t.guestOnly}</option>
                <option value="life">{t.life}</option>
                {processes.length > 0 && (
                  <optgroup label={t.weddingGroup}>
                    {processes.map((process, index) => (
                      <option key={process.id} value={`wedding:${process.id}`}>
                        {String(index + 1).padStart(2, "0")} · {process[lang]}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </label>
          )}
          <label className="file-picker">
            <span>{t.files}</span>
            <strong>{t.choose}</strong>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              multiple
              onChange={handleFiles}
              disabled={phase === "uploading" || Boolean(batch)}
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
                  <li
                    key={`${item.file.name}-${item.file.lastModified}-${index}`}
                  >
                    <div>
                      <strong>{item.file.name}</strong>
                      <small>
                        {statusLabel(t, item.status)}
                        {item.attempts > 1 ? ` · ${item.attempts}` : ""}
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

          {error && (
            <p className="upload-error" role="alert">
              {error}
            </p>
          )}

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
              {hasUnfinished && <small>{t.retryNote}</small>}
            </section>
          )}

          <div className="upload-actions">
            {phase !== "uploading" && !batch && (
              <button className="button primary" type="submit">
                {t.start}
              </button>
            )}
            {phase === "uploading" && (
              <button
                className="button secondary"
                type="button"
                onClick={cancelUpload}
              >
                {t.cancel}
              </button>
            )}
            {phase === "done" && hasUnfinished && (
              <button
                className="button primary"
                type="button"
                onClick={retryUnfinished}
              >
                {t.retryFailed}
              </button>
            )}
            {phase === "done" && (
              <button
                className="button secondary"
                type="button"
                onClick={close}
              >
                {t.close}
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
