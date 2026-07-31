export const DEFAULT_GUEST_UPLOADER_LABELS_VISIBLE = true;
export const DEFAULT_GUEST_LATEST_PHOTO_COUNT = 40;
export const MIN_GUEST_LATEST_PHOTO_COUNT = 30;
export const MAX_GUEST_LATEST_PHOTO_COUNT = 50;
export const MAX_GUEST_UPLOADER_LABELS = 500;
export const MAX_GUEST_UPLOADER_LABEL_LENGTH = 80;
export const LATEST_GUEST_FILTER_ID = "__latest_guest_photos__";

export function normalizeGuestUploaderLabel(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeGuestUploaderLabelOrder(value) {
  if (!Array.isArray(value)) return [];
  const labels = [];
  const seen = new Set();
  for (const item of value) {
    const label = normalizeGuestUploaderLabel(item);
    if (!label || seen.has(label)) continue;
    if (Array.from(label).length > MAX_GUEST_UPLOADER_LABEL_LENGTH) continue;
    labels.push(label);
    seen.add(label);
    if (labels.length >= MAX_GUEST_UPLOADER_LABELS) break;
  }
  return labels;
}

export function mergeGuestUploaderLabelOrder(savedOrder, currentLabels) {
  const current = normalizeGuestUploaderLabelOrder(currentLabels);
  const available = new Set(current);
  const merged = normalizeGuestUploaderLabelOrder(savedOrder).filter((label) =>
    available.has(label),
  );
  const included = new Set(merged);
  for (const label of current) {
    if (included.has(label)) continue;
    merged.push(label);
    included.add(label);
  }
  return merged;
}

export function isValidGuestUploaderLabelOrder(value) {
  if (!Array.isArray(value) || value.length > MAX_GUEST_UPLOADER_LABELS) {
    return false;
  }
  const normalized = value.map(normalizeGuestUploaderLabel);
  return (
    normalized.every(
      (label) =>
        Boolean(label) &&
        Array.from(label).length <= MAX_GUEST_UPLOADER_LABEL_LENGTH,
    ) && new Set(normalized).size === normalized.length
  );
}

export function normalizeGuestLatestPhotoCount(value) {
  const count = Number(value);
  return Number.isInteger(count) &&
    count >= MIN_GUEST_LATEST_PHOTO_COUNT &&
    count <= MAX_GUEST_LATEST_PHOTO_COUNT
    ? count
    : DEFAULT_GUEST_LATEST_PHOTO_COUNT;
}

export function isValidGuestLatestPhotoCount(value) {
  const count = Number(value);
  return (
    Number.isInteger(count) &&
    count >= MIN_GUEST_LATEST_PHOTO_COUNT &&
    count <= MAX_GUEST_LATEST_PHOTO_COUNT
  );
}
