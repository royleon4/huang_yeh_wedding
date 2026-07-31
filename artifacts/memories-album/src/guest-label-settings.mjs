export const DEFAULT_GUEST_UPLOADER_LABELS_VISIBLE = true;
export const DEFAULT_GUEST_LATEST_PHOTOS_LABEL_VISIBLE = true;
export const DEFAULT_GUEST_ALL_VISITORS_LABEL_VISIBLE = true;
export const DEFAULT_GUEST_NAME_LABELS_VISIBLE = true;
export const DEFAULT_GUEST_LATEST_PHOTO_COUNT = 40;
export const MIN_GUEST_LATEST_PHOTO_COUNT = 30;
export const MAX_GUEST_LATEST_PHOTO_COUNT = 50;
export const MAX_GUEST_UPLOADER_LABELS = 500;
export const MAX_GUEST_UPLOADER_LABEL_LENGTH = 80;
export const LATEST_GUEST_FILTER_ID = "__latest_guest_photos__";
export const LEGACY_GUEST_LABEL_VISIBILITY_KEY =
  "guestUploaderLabelsVisible";
export const GUEST_LABEL_VISIBILITY_KEYS = Object.freeze({
  latest: "guestLatestPhotosLabelVisible",
  all: "guestAllVisitorsLabelVisible",
  names: "guestNameLabelsVisible",
});
export const GUEST_LABEL_VISIBILITY_SETTING_KEYS = Object.freeze(
  Object.values(GUEST_LABEL_VISIBILITY_KEYS),
);

export function normalizeGuestLabelVisibilitySettings(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const legacyVisible =
    source[LEGACY_GUEST_LABEL_VISIBILITY_KEY] === undefined
      ? DEFAULT_GUEST_UPLOADER_LABELS_VISIBLE
      : source[LEGACY_GUEST_LABEL_VISIBILITY_KEY] === true;
  return {
    [GUEST_LABEL_VISIBILITY_KEYS.latest]:
      source[GUEST_LABEL_VISIBILITY_KEYS.latest] === undefined
        ? legacyVisible
        : source[GUEST_LABEL_VISIBILITY_KEYS.latest] === true,
    [GUEST_LABEL_VISIBILITY_KEYS.all]:
      source[GUEST_LABEL_VISIBILITY_KEYS.all] === undefined
        ? legacyVisible
        : source[GUEST_LABEL_VISIBILITY_KEYS.all] === true,
    [GUEST_LABEL_VISIBILITY_KEYS.names]:
      source[GUEST_LABEL_VISIBILITY_KEYS.names] === undefined
        ? legacyVisible
        : source[GUEST_LABEL_VISIBILITY_KEYS.names] === true,
  };
}

export function isGuestLabelFilterVisible(filterId, settings = {}) {
  const visibility = normalizeGuestLabelVisibilitySettings(settings);
  if (filterId === LATEST_GUEST_FILTER_ID) {
    return visibility[GUEST_LABEL_VISIBILITY_KEYS.latest];
  }
  if (filterId === "all") {
    return visibility[GUEST_LABEL_VISIBILITY_KEYS.all];
  }
  return visibility[GUEST_LABEL_VISIBILITY_KEYS.names];
}

export function buildGuestLabelSelectorItems({
  settings,
  allGuestsLabel,
  latestPhotosLabel,
  guestPhotoCount,
  guestLatestPhotoCount,
  guestGroups,
}) {
  const visibility = normalizeGuestLabelVisibilitySettings(settings);
  const groups = Array.isArray(guestGroups) ? guestGroups : [];
  const items = [];

  if (visibility[GUEST_LABEL_VISIBILITY_KEYS.all]) {
    items.push({
      id: "all",
      label: `${allGuestsLabel} (${guestPhotoCount})`,
    });
  }

  if (visibility[GUEST_LABEL_VISIBILITY_KEYS.latest]) {
    items.push({
      id: LATEST_GUEST_FILTER_ID,
      label: `${latestPhotosLabel} (${Math.min(
        guestPhotoCount,
        guestLatestPhotoCount,
      )})`,
    });
  }

  if (visibility[GUEST_LABEL_VISIBILITY_KEYS.names]) {
    items.push(
      ...groups.map((group) => ({
        id: group.id,
        label: `${group.name} (${group.count})`,
      })),
    );
  }

  return items;
}

export function guestLabelRouteItems(settings, guestGroups) {
  const visibility = normalizeGuestLabelVisibilitySettings(settings);
  const groups = Array.isArray(guestGroups) ? guestGroups : [];
  const items = [];

  if (visibility[GUEST_LABEL_VISIBILITY_KEYS.latest]) {
    items.push({ id: LATEST_GUEST_FILTER_ID });
  }
  if (visibility[GUEST_LABEL_VISIBILITY_KEYS.names]) {
    items.push(...groups);
  }

  return items;
}

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
