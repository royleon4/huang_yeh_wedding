const MEMORIES_ROOT = "/Memories";
const DEFAULT_LANGUAGE = "zh";
const DEFAULT_ADMIN_TAB = "albums";

export const STABLE_ADMIN_TAB_IDS = Object.freeze([
  "general",
  "albums",
  "photos",
  "categories",
]);

const LEGACY_ADMIN_TAB_ALIASES = new Map([["subcategory-ui", "general"]]);
const PUBLIC_MODAL_ROUTES = new Map([
  ["upload", "upload"],
  ["people", "coming"],
  ["find", "coming"],
]);

function normalizedPathname(value) {
  const pathname = String(value || "/").split(/[?#]/, 1)[0] || "/";
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

function decodeSegment(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function encodeSegment(value) {
  return encodeURIComponent(String(value ?? "").normalize("NFKC").trim());
}

function numberedSegment(value, prefix) {
  const match = new RegExp(`^${prefix}([1-9]\\d*)$`).exec(String(value || ""));
  return match ? Number(match[1]) : null;
}

function languageParts(pathname) {
  const normalized = normalizedPathname(pathname);
  if (!normalized.startsWith(MEMORIES_ROOT)) {
    return { normalized, language: DEFAULT_LANGUAGE, parts: [], validRoot: false };
  }
  const suffix = normalized.slice(MEMORIES_ROOT.length).replace(/^\/+/, "");
  const parts = suffix ? suffix.split("/") : [];
  const language = parts[0] === "en" ? "en" : DEFAULT_LANGUAGE;
  if (language === "en") parts.shift();
  return { normalized, language, parts, validRoot: true };
}

function languageRoot(language = DEFAULT_LANGUAGE) {
  return language === "en" ? `${MEMORIES_ROOT}/en` : MEMORIES_ROOT;
}

export function stablePublicGalleryPath({
  language = DEFAULT_LANGUAGE,
  albumKey,
  labelKey = null,
  photoId = null,
} = {}) {
  const normalizedAlbumKey = String(albumKey ?? "").normalize("NFKC").trim();
  if (!normalizedAlbumKey) return languageRoot(language);
  let path = `${languageRoot(language)}/albums/${encodeSegment(normalizedAlbumKey)}`;
  const normalizedLabelKey = String(labelKey ?? "").normalize("NFKC").trim();
  if (normalizedLabelKey) path += `/labels/${encodeSegment(normalizedLabelKey)}`;
  if (photoId) path += `/photos/${encodeSegment(photoId)}`;
  return path;
}

export function stablePublicModalPath(routeId, language = DEFAULT_LANGUAGE) {
  const normalized = String(routeId ?? "");
  return PUBLIC_MODAL_ROUTES.has(normalized)
    ? `${languageRoot(language)}/${normalized}`
    : languageRoot(language);
}

function legacySemanticRoute(parts, language, normalized) {
  if (parts[0] !== "albums" || !parts[1]) return null;
  const albumKey = decodeSegment(parts[1]);
  if (!albumKey) return null;

  if (parts.length === 2) {
    return {
      kind: "gallery",
      language,
      albumKey,
      labelKey: null,
      photoId: null,
      canonicalPath: stablePublicGalleryPath({ language, albumKey }),
    };
  }

  let index = 2;
  let labelKey = null;
  let photoId = null;
  let legacy = false;

  if (parts[index] === "labels") {
    labelKey = decodeSegment(parts[index + 1]);
    if (!labelKey) return null;
    index += 2;
  } else if (["processes", "guests", "filters"].includes(parts[index])) {
    labelKey = decodeSegment(parts[index + 1]);
    if (!labelKey) return null;
    legacy = true;
    index += 2;
  }

  if (parts[index] === "photos") {
    photoId = decodeSegment(parts[index + 1]);
    if (!photoId) return null;
    index += 2;
  }
  if (index !== parts.length) return null;

  const canonicalPath = stablePublicGalleryPath({
    language,
    albumKey,
    labelKey,
    photoId,
  });
  return {
    kind: legacy ? "legacySemanticGallery" : "gallery",
    language,
    albumKey,
    labelKey,
    photoId,
    canonicalPath,
    requestedPath: normalized,
  };
}

function legacyOrdinalRoute(parts, language, normalized) {
  const groupNumber = numberedSegment(parts[0], "group");
  if (!groupNumber) return null;
  let index = 1;
  let subgroupNumber = null;
  let photoId = null;
  if (parts[index]?.startsWith("subgroup")) {
    subgroupNumber = numberedSegment(parts[index], "subgroup");
    if (!subgroupNumber) return null;
    index += 1;
  }
  if (parts[index] === "photos") {
    photoId = decodeSegment(parts[index + 1]);
    if (!photoId) return null;
    index += 2;
  }
  if (index !== parts.length) return null;
  return {
    kind: "legacyOrdinalGallery",
    language,
    groupIndex: groupNumber - 1,
    subgroupIndex: subgroupNumber ? subgroupNumber - 1 : null,
    photoId,
    canonicalPath: normalized,
  };
}

export function readStablePublicRoute(pathname) {
  const { normalized, language, parts, validRoot } = languageParts(pathname);
  if (!validRoot) {
    return {
      kind: "invalid",
      language: DEFAULT_LANGUAGE,
      canonicalPath: languageRoot(DEFAULT_LANGUAGE),
    };
  }

  if (parts.length === 0) {
    return {
      kind: "root",
      language,
      canonicalPath: languageRoot(language),
    };
  }

  const modalState = parts.length === 1 ? PUBLIC_MODAL_ROUTES.get(parts[0]) : null;
  if (modalState) {
    return {
      kind: "modal",
      language,
      routeId: parts[0],
      modal: modalState,
      canonicalPath: stablePublicModalPath(parts[0], language),
    };
  }

  const semantic = legacySemanticRoute(parts, language, normalized);
  if (semantic) return semantic;
  const ordinal = legacyOrdinalRoute(parts, language, normalized);
  if (ordinal) return ordinal;

  return {
    kind: "invalid",
    language,
    canonicalPath: languageRoot(language),
  };
}

export function stableAdminTabPath(tabId = DEFAULT_ADMIN_TAB) {
  const aliased = LEGACY_ADMIN_TAB_ALIASES.get(tabId) ?? tabId;
  const normalized = STABLE_ADMIN_TAB_IDS.includes(aliased)
    ? aliased
    : DEFAULT_ADMIN_TAB;
  return `${MEMORIES_ROOT}/admin/${encodeSegment(normalized)}`;
}

export function readStableAdminTab(pathname) {
  const normalized = normalizedPathname(pathname);
  if (normalized === `${MEMORIES_ROOT}/admin`) return DEFAULT_ADMIN_TAB;
  const prefix = `${MEMORIES_ROOT}/admin/`;
  if (!normalized.startsWith(prefix)) return DEFAULT_ADMIN_TAB;
  const segment = normalized.slice(prefix.length).split("/")[0];
  const ordinal = numberedSegment(segment, "group");
  if (ordinal && STABLE_ADMIN_TAB_IDS[ordinal - 1]) {
    return STABLE_ADMIN_TAB_IDS[ordinal - 1];
  }
  if (ordinal === 5) return "general";
  const decoded = decodeSegment(segment);
  const aliased = LEGACY_ADMIN_TAB_ALIASES.get(decoded) ?? decoded;
  return STABLE_ADMIN_TAB_IDS.includes(aliased) ? aliased : DEFAULT_ADMIN_TAB;
}

export function stableRouteLabelKey(filterId) {
  const normalized = String(filterId ?? "").normalize("NFKC").trim();
  return normalized === "__latest_guest_photos__" ? "latest" : normalized;
}

export function stableFilterIdFromLabelKey(collectionId, labelKey) {
  const normalized = String(labelKey ?? "").normalize("NFKC").trim();
  if (collectionId === "guest" && normalized === "latest") {
    return "__latest_guest_photos__";
  }
  return normalized;
}
