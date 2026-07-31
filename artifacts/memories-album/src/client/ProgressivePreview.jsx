import { useCallback, useEffect, useMemo, useState } from "react";

export const ADMIN_PREVIEW_BATCH_SIZE = 10;

export function useProgressivePreview(
  items,
  { batchSize = ADMIN_PREVIEW_BATCH_SIZE, resetKey = "" } = {},
) {
  const sourceItems = Array.isArray(items) ? items : [];
  const normalizedBatchSize =
    Number.isInteger(batchSize) && batchSize > 0
      ? batchSize
      : ADMIN_PREVIEW_BATCH_SIZE;
  const [visibleCount, setVisibleCount] = useState(normalizedBatchSize);

  useEffect(() => {
    setVisibleCount(normalizedBatchSize);
  }, [normalizedBatchSize, resetKey]);

  const visibleItems = useMemo(
    () => sourceItems.slice(0, visibleCount),
    [sourceItems, visibleCount],
  );
  const bufferedRemaining = Math.max(0, sourceItems.length - visibleItems.length);
  const revealNext = useCallback(() => {
    setVisibleCount((current) => current + normalizedBatchSize);
  }, [normalizedBatchSize]);

  return {
    visibleItems,
    visibleCount,
    bufferedRemaining,
    hasBufferedItems: bufferedRemaining > 0,
    revealNext,
  };
}

export function ProgressivePreviewMoreButton({
  remaining = 0,
  hasNextPage = false,
  onClick,
  disabled = false,
  loading = false,
  label = "顯示更多",
}) {
  const bufferedRemaining = Math.max(0, Number(remaining) || 0);
  if (bufferedRemaining === 0 && !hasNextPage) return null;

  const nextCount = hasNextPage
    ? ADMIN_PREVIEW_BATCH_SIZE
    : Math.min(ADMIN_PREVIEW_BATCH_SIZE, bufferedRemaining);

  return (
    <button
      className="admin-load-more progressive-preview-more"
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? "載入中…" : `${label}（再顯示 ${nextCount} 張）`}
    </button>
  );
}
