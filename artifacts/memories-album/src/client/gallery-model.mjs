// Wedding process categories are populated from PostgreSQL, which is synchronized
// from Google Drive. Keep this mutable array empty at build time so a deployment
// can never overwrite the owner's Drive folder names with bundled defaults.
export const PROCESS_DEFINITIONS = [];

// "All processes" is a virtual category. It is editable but never participates
// in Google Drive folder synchronization or process ordering.
export const ALL_PROCESS_DEFINITION = {
  id: "all",
  zh: "全部流程",
  en: "All moments",
  displayOrder: 0,
  youtubeVideoId: null,
  youtubeAutoplay: false,
  showAllPhotos: true,
  contentHtmlZh: "",
  contentHtmlEn: "",
  dividerPaddingTop: 12,
  dividerPaddingBottom: 12,
};

export const COLLECTION_DEFINITIONS = [
  { id: "wedding", zh: "婚禮流程", en: "Wedding moments" },
  { id: "guest", zh: "訪客上傳", en: "Guest uploads" },
  { id: "life", zh: "生活照", en: "Life photos" },
];

export const NAV_ITEMS = [
  { id: "all", zh: "相簿分類", en: "Archive", enabled: true },
  { id: "people", zh: "人物", en: "People", enabled: false },
  { id: "upload", zh: "上傳", en: "Upload", enabled: true },
  { id: "find", zh: "找找我", en: "Find me", enabled: false },
];

export function normalizePublicAlbums(albums) {
  if (!Array.isArray(albums)) {
    throw new TypeError("Public albums must be an array");
  }
  return albums.map((album) => ({
    ...album,
    zh: album.titleZh,
    en: album.titleEn || album.titleZh,
  }));
}

function collectionForPhoto(photo) {
  return photo.collection ?? (photo.source === "guest" ? "guest" : "wedding");
}

export function normalizedUploaderName(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

export function guestUploaderGroups(photos) {
  const counts = new Map();
  for (const photo of photos ?? []) {
    const albumIds = Array.isArray(photo.albumIds) ? photo.albumIds : [];
    if (!albumIds.includes("guest")) continue;
    const name = normalizedUploaderName(photo.uploaderName);
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ id: name, name, count }))
    .sort((left, right) => left.name.localeCompare(right.name, "zh-Hant"));
}

export function filterPhotos(
  photos,
  filterId = "all",
  collectionId = "wedding",
) {
  const inCollection = photos.filter((photo) => {
    if (Array.isArray(photo.albumIds)) {
      return photo.albumIds.includes(collectionId);
    }
    if (collectionId === "guest") return photo.source === "guest";
    return collectionForPhoto(photo) === collectionId;
  });
  if (filterId === "all") {
    if (collectionId === "wedding" && !ALL_PROCESS_DEFINITION.showAllPhotos) {
      return [];
    }
    return inCollection;
  }
  if (collectionId === "wedding") {
    return inCollection.filter((photo) => photo.processIds.includes(filterId));
  }
  if (collectionId === "guest") {
    return inCollection.filter(
      (photo) => normalizedUploaderName(photo.uploaderName) === filterId,
    );
  }
  return inCollection;
}

export function youtubeEmbedUrl(videoId, autoplay = false) {
  const normalized = String(videoId ?? "").trim();
  if (!/^[A-Za-z0-9_-]{11}$/.test(normalized)) return "";
  const query = new URLSearchParams({ rel: "0", playsinline: "1" });
  if (autoplay) {
    query.set("autoplay", "1");
    query.set("mute", "1");
  }
  return `https://www.youtube-nocookie.com/embed/${normalized}?${query}`;
}

export function pagePhotos(photos, pageSize, cursor = 0) {
  const start = Number.isInteger(cursor) && cursor >= 0 ? cursor : 0;
  const items = photos.slice(start, start + pageSize);
  const nextCursor =
    start + items.length < photos.length ? start + items.length : null;
  return { items, nextCursor };
}

export function moveItem(items, index, direction) {
  const nextIndex = index + direction;
  if (
    index < 0 ||
    index >= items.length ||
    nextIndex < 0 ||
    nextIndex >= items.length
  )
    return items;
  const copy = [...items];
  [copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]];
  return copy;
}
