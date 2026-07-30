import { useEffect, useRef, useState } from "react";
import { adminErrorMessage, adminRequest } from "./admin-client.mjs";
import "./admin-refresh.css";

const TERMINAL = new Set(["completed", "completed_with_errors", "failed"]);

function stageText(job) {
  if (!job) return "";
  if (job.status === "completed") {
    return `完成：已重新建立 ${job.rebuilt} 張縮圖。`;
  }
  if (job.status === "completed_with_errors") {
    return `完成 ${job.rebuilt} 張，另有 ${job.failures?.length ?? 0} 張未完成。`;
  }
  if (job.status === "failed") {
    return `重新整理失敗：${job.error?.message || job.error?.code || "請稍後再試"}`;
  }
  if (job.stage === "syncing_originals") return "正在重新掃描 Google Drive 原始資料夾…";
  if (job.stage === "clearing_thumbnails") return "正在移除舊縮圖與快取關聯…";
  if (job.stage === "rebuilding_thumbnails") {
    return `正在重建縮圖 ${job.processed ?? 0}／${job.total ?? 0}…`;
  }
  return "已排入重新整理工作…";
}

export default function AdminRefreshButton({
  scopeType,
  scopeId,
  label,
  disabled = false,
}) {
  const [job, setJob] = useState(null);
  const [error, setError] = useState("");
  const timerRef = useRef(null);
  const active = job && !TERMINAL.has(job.status);
  const collection = scopeType === "album" ? "albums" : "categories";

  useEffect(
    () => () => {
      globalThis.clearTimeout(timerRef.current);
    },
    [],
  );

  const poll = async (jobId) => {
    try {
      const result = await adminRequest(
        `/admin/api/refresh-jobs/${encodeURIComponent(jobId)}`,
        { timeoutMs: 30_000 },
      );
      setJob(result.job);
      if (!TERMINAL.has(result.job.status)) {
        timerRef.current = globalThis.setTimeout(() => void poll(jobId), 1_000);
      }
    } catch (pollError) {
      if (pollError?.status === 401) {
        window.location.replace("/Memories/");
        return;
      }
      setError(adminErrorMessage(pollError));
    }
  };

  const start = async () => {
    const confirmed = window.confirm(
      `確定重新整理「${label}」嗎？\n\n系統會重新掃描 Google Drive 原始資料夾，刪除這個範圍內的衍生縮圖並重新建立。原始照片不會被刪除。`,
    );
    if (!confirmed) return;
    setError("");
    setJob({ status: "queued", stage: "queued", processed: 0, total: 0 });
    try {
      const result = await adminRequest(
        `/admin/api/${collection}/${encodeURIComponent(scopeId)}/refresh`,
        { method: "POST", timeoutMs: 30_000 },
      );
      setJob(result.job);
      void poll(result.job.id);
    } catch (startError) {
      if (startError?.status === 401) {
        window.location.replace("/Memories/");
        return;
      }
      setJob(null);
      setError(adminErrorMessage(startError));
    }
  };

  return (
    <div className="admin-refresh-control">
      <button
        type="button"
        className="admin-refresh-button"
        onClick={() => void start()}
        disabled={disabled || active}
        title="重新掃描原始資料夾並重建縮圖"
      >
        <span aria-hidden="true">↻</span>
        {active ? "重新整理中…" : "重新整理"}
      </button>
      {(job || error) && (
        <p
          className={`admin-refresh-status${error || job?.status === "failed" ? " error" : ""}`}
          role={error || job?.status === "failed" ? "alert" : "status"}
        >
          {error || stageText(job)}
          {TERMINAL.has(job?.status) && job?.status !== "failed" && (
            <small>
              已刪除 {job.deletedThumbnails ?? 0} 個舊縮圖；前台重新載入後會使用新版本。
            </small>
          )}
        </p>
      )}
    </div>
  );
}
