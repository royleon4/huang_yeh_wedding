export const ALBUM_TYPES = Object.freeze(["album", "message", "blog"]);

const ALBUM_TYPE_SET = new Set(ALBUM_TYPES);

export function normalizeAlbumType(value, fallback = "album") {
  const candidate = String(value ?? "").trim().toLowerCase();
  if (ALBUM_TYPE_SET.has(candidate)) return candidate;
  return ALBUM_TYPE_SET.has(fallback) ? fallback : "album";
}

export function isAlbumType(value) {
  return ALBUM_TYPE_SET.has(String(value ?? "").trim().toLowerCase());
}
