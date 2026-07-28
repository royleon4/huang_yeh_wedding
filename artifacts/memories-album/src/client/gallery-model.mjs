export const PROCESS_DEFINITIONS = [
  { id: "entrance", zh: "進場", en: "Entrance" },
  { id: "prayer", zh: "祈禱", en: "Prayer" },
  { id: "praise", zh: "讚美", en: "Praise" },
  { id: "scripture", zh: "聖經", en: "Scripture" },
  { id: "message", zh: "勉勵", en: "Message" },
  { id: "vows", zh: "證婚", en: "Vows" },
  { id: "parents", zh: "謝親恩", en: "Honouring Parents" },
  { id: "blessing", zh: "祝福", en: "Blessing" },
  { id: "response", zh: "答禮", en: "Response" },
  { id: "video", zh: "影片", en: "Film" },
  { id: "recessional", zh: "退場", en: "Recessional" },
  { id: "group-photo", zh: "分組照相", en: "Group Photos" },
];

export const NAV_ITEMS = [
  { id: "all", zh: "全部照片", en: "All photos", enabled: true },
  { id: "people", zh: "人物", en: "People", enabled: false },
  { id: "upload", zh: "上傳", en: "Upload", enabled: true },
  { id: "find", zh: "找找我", en: "Find me", enabled: false },
];

export function filterPhotos(photos, filterId) {
  if (filterId === "all") return photos;
  if (filterId === "guest") return photos.filter((photo) => photo.source === "guest");
  return photos.filter((photo) => photo.processIds.includes(filterId));
}

export function pagePhotos(photos, pageSize, cursor = 0) {
  const start = Number.isInteger(cursor) && cursor >= 0 ? cursor : 0;
  const items = photos.slice(start, start + pageSize);
  const nextCursor = start + items.length < photos.length ? start + items.length : null;
  return { items, nextCursor };
}

export function moveItem(items, index, direction) {
  const nextIndex = index + direction;
  if (index < 0 || index >= items.length || nextIndex < 0 || nextIndex >= items.length) return items;
  const copy = [...items];
  [copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]];
  return copy;
}
