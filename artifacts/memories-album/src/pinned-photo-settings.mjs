export const PINNED_PHOTO_LIMIT = 3;

export function normalizePinnedPhotoIds(value) {
  if (!Array.isArray(value)) return [];
  const ids = [];
  for (const item of value) {
    const id = String(item ?? "").trim();
    if (!id || ids.includes(id)) continue;
    ids.push(id);
    if (ids.length >= PINNED_PHOTO_LIMIT) break;
  }
  return ids;
}

export function normalizePinnedPhotosByProcess(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const normalized = {};
  for (const [processKey, photoIds] of Object.entries(value)) {
    const key = String(processKey ?? "").trim();
    if (!key) continue;
    const ids = normalizePinnedPhotoIds(photoIds);
    if (ids.length > 0) normalized[key] = ids;
  }
  return normalized;
}

export function isValidPinnedPhotosByProcess(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  if (entries.length > 100) return false;
  return entries.every(([processKey, photoIds]) => {
    if (!String(processKey ?? "").trim() || !Array.isArray(photoIds)) return false;
    if (photoIds.length > PINNED_PHOTO_LIMIT) return false;
    const ids = photoIds.map((item) => String(item ?? "").trim());
    return ids.every(Boolean) && new Set(ids).size === ids.length;
  });
}
