export const DEFAULT_PROCESS_SELECTOR_SETTINGS = Object.freeze({
  processWheelEnabled: false,
  processWheelVisibleCount: 6,
  processWheelLoopAlbumIds: [],
  processLabelAutoScrollEnabled: true,
});

export const PROCESS_WHEEL_VISIBLE_COUNTS = Object.freeze([3, 4, 5, 6, 7, 8]);
export const PROCESS_WHEEL_LOOP_SUPPORTED_ALBUMS = Object.freeze([
  { id: "wedding", labelZh: "婚禮流程", labelEn: "Wedding moments" },
  { id: "guest", labelZh: "訪客上傳", labelEn: "Guest uploads" },
]);

const SUPPORTED_LOOP_IDS = new Set(
  PROCESS_WHEEL_LOOP_SUPPORTED_ALBUMS.map((album) => album.id),
);

export function normalizeProcessWheelLoopAlbumIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item ?? "").trim()))].filter(
    (id) => SUPPORTED_LOOP_IDS.has(id),
  );
}

export function normalizeProcessSelectorSettings(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const visibleCount = Number(source.processWheelVisibleCount);
  return {
    processWheelEnabled: source.processWheelEnabled === true,
    processWheelVisibleCount: PROCESS_WHEEL_VISIBLE_COUNTS.includes(visibleCount)
      ? visibleCount
      : DEFAULT_PROCESS_SELECTOR_SETTINGS.processWheelVisibleCount,
    processWheelLoopAlbumIds: normalizeProcessWheelLoopAlbumIds(
      source.processWheelLoopAlbumIds,
    ),
    processLabelAutoScrollEnabled:
      source.processLabelAutoScrollEnabled !== false,
  };
}

export function isValidProcessWheelLoopAlbumIds(value) {
  return (
    Array.isArray(value) &&
    value.length <= PROCESS_WHEEL_LOOP_SUPPORTED_ALBUMS.length &&
    value.every((item) => SUPPORTED_LOOP_IDS.has(String(item ?? "").trim())) &&
    new Set(value.map((item) => String(item ?? "").trim())).size === value.length
  );
}

export function processWheelLoopsForAlbum(settings, albumId) {
  return normalizeProcessSelectorSettings(settings).processWheelLoopAlbumIds.includes(
    String(albumId ?? ""),
  );
}
