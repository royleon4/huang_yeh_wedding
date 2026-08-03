import {
  ALBUM_PHOTO_SORT_MODES,
  normalizeAlbumPhotoSortMode,
} from "../../album-photo-order.mjs";

export const MESSAGE_SORT_QUERY_KEY = "sort";

const MESSAGE_SORT_MODE_SET = new Set(ALBUM_PHOTO_SORT_MODES);

function normalizedSearch(search) {
  const value = String(search ?? "");
  return value.startsWith("?") ? value.slice(1) : value;
}

export function messageSortModeFromSearch(search, fallbackMode) {
  const params = new URLSearchParams(normalizedSearch(search));
  const requestedMode = params.get(MESSAGE_SORT_QUERY_KEY);
  return MESSAGE_SORT_MODE_SET.has(requestedMode)
    ? requestedMode
    : normalizeAlbumPhotoSortMode(fallbackMode);
}

export function messageSortRoute(locationLike, sortMode) {
  const pathname = String(locationLike?.pathname ?? "");
  const hash = String(locationLike?.hash ?? "");
  const params = new URLSearchParams(
    normalizedSearch(locationLike?.search),
  );
  params.set(
    MESSAGE_SORT_QUERY_KEY,
    normalizeAlbumPhotoSortMode(sortMode),
  );
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}${hash}`;
}
