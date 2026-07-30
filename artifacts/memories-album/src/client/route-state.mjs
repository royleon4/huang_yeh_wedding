const MEMORIES_ROOT = "/Memories";
const DEFAULT_LANGUAGE = "zh";
const DEFAULT_GROUP_NUMBER = 1;
const DEFAULT_ADMIN_TAB = "albums";

export const ADMIN_TAB_IDS = Object.freeze([
  "general",
  "albums",
  "photos",
  "categories",
  "subcategory-ui",
]);

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
  return encodeURIComponent(String(value ?? "").trim());
}

function positiveNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
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

export function publicGalleryPath({
  language = DEFAULT_LANGUAGE,
  groupNumber = DEFAULT_GROUP_NUMBER,
  subgroupNumber = null,
  photoId = null,
} = {}) {
  const safeGroupNumber = positiveNumber(groupNumber, DEFAULT_GROUP_NUMBER);
  const safeSubgroupNumber = positiveNumber(subgroupNumber);
  let path = `${languageRoot(language)}/group${safeGroupNumber}`;
  if (safeSubgroupNumber) path += `/subgroup${safeSubgroupNumber}`;
  if (photoId) path += `/photos/${encodeSegment(photoId)}`;
  return path;
}

export function publicModalPath(routeId, language = DEFAULT_LANGUAGE) {
  const normalized = String(routeId ?? "");
  return PUBLIC_MODAL_ROUTES.has(normalized)
    ? `${languageRoot(language)}/${normalized}`
    : publicGalleryPath({ language });
}

function legacyGalleryRoute(parts, language, normalized) {
  if (parts[0] !== "albums" || !parts[1]) return null;
  const albumId = decodeSegment(parts[1]);
  if (!albumId) return null;

  let index = 2;
  let filterId = "all";
  let filterKind = null;
  let photoId = null;

  if (["processes", "guests", "filters"].includes(parts[index])) {
    filterKind = parts[index];
    filterId = decodeSegment(parts[index + 1]);
    if (!filterId) return null;
    index += 2;
  }
  if (parts[index] === "photos") {
    photoId = decodeSegment(parts[index + 1]);
    if (!photoId) return null;
    index += 2;
  }
  if (index !== parts.length) return null;

  return {
    kind: "legacyGallery",
    language,
    albumId,
    filterId,
    filterKind,
    photoId,
    canonicalPath: normalized,
  };
}

export function readPublicRoute(pathname) {
  const { normalized, language, parts, validRoot } = languageParts(pathname);
  if (!validRoot) {
    return {
      kind: "invalid",
      language: DEFAULT_LANGUAGE,
      canonicalPath: publicGalleryPath(),
    };
  }

  if (parts.length === 0) {
    return {
      kind: "gallery",
      language,
      groupIndex: 0,
      subgroupIndex: null,
      photoId: null,
      canonicalPath: publicGalleryPath({ language }),
    };
  }

  const modalState = parts.length === 1 ? PUBLIC_MODAL_ROUTES.get(parts[0]) : null;
  if (modalState) {
    return {
      kind: "modal",
      language,
      routeId: parts[0],
      modal: modalState,
      groupIndex: 0,
      subgroupIndex: null,
      photoId: null,
      canonicalPath: publicModalPath(parts[0], language),
    };
  }

  const groupNumber = numberedSegment(parts[0], "group");
  if (!groupNumber) {
    const legacy = legacyGalleryRoute(parts, language, normalized);
    return (
      legacy ?? {
        kind: "invalid",
        language,
        canonicalPath: publicGalleryPath({ language }),
      }
    );
  }

  let index = 1;
  let subgroupNumber = null;
  let photoId = null;
  if (parts[index]?.startsWith("subgroup")) {
    subgroupNumber = numberedSegment(parts[index], "subgroup");
    if (!subgroupNumber) {
      return {
        kind: "invalid",
        language,
        canonicalPath: publicGalleryPath({ language, groupNumber }),
      };
    }
    index += 1;
  }
  if (parts[index] === "photos") {
    photoId = decodeSegment(parts[index + 1]);
    if (!photoId) {
      return {
        kind: "invalid",
        language,
        canonicalPath: publicGalleryPath({ language, groupNumber, subgroupNumber }),
      };
    }
    index += 2;
  }
  if (index !== parts.length) {
    return {
      kind: "invalid",
      language,
      canonicalPath: publicGalleryPath({ language, groupNumber }),
    };
  }

  return {
    kind: "gallery",
    language,
    groupIndex: groupNumber - 1,
    subgroupIndex: subgroupNumber ? subgroupNumber - 1 : null,
    photoId,
    canonicalPath: publicGalleryPath({
      language,
      groupNumber,
      subgroupNumber,
      photoId,
    }),
  };
}

export function adminTabPath(tabId = DEFAULT_ADMIN_TAB) {
  const index = ADMIN_TAB_IDS.indexOf(tabId);
  const groupNumber =
    (index >= 0 ? index : ADMIN_TAB_IDS.indexOf(DEFAULT_ADMIN_TAB)) + 1;
  return `${MEMORIES_ROOT}/admin/group${groupNumber}`;
}

export function readAdminTab(pathname) {
  const normalized = normalizedPathname(pathname);
  if (normalized === `${MEMORIES_ROOT}/admin`) return DEFAULT_ADMIN_TAB;
  const prefix = `${MEMORIES_ROOT}/admin/`;
  if (!normalized.startsWith(prefix)) return DEFAULT_ADMIN_TAB;
  const segment = normalized.slice(prefix.length).split("/")[0];
  const groupNumber = numberedSegment(segment, "group");
  if (groupNumber && ADMIN_TAB_IDS[groupNumber - 1]) {
    return ADMIN_TAB_IDS[groupNumber - 1];
  }
  const legacyTabId = decodeSegment(segment);
  return ADMIN_TAB_IDS.includes(legacyTabId) ? legacyTabId : DEFAULT_ADMIN_TAB;
}

export function routeSurface(pathname) {
  const normalized = normalizedPathname(pathname);
  if (
    normalized === `${MEMORIES_ROOT}/admin/login` ||
    normalized === "/admin/login"
  ) {
    return "login";
  }
  if (
    normalized === "/admin" ||
    normalized.startsWith("/admin/") ||
    normalized === `${MEMORIES_ROOT}/admin` ||
    normalized.startsWith(`${MEMORIES_ROOT}/admin/`)
  ) {
    return "admin";
  }
  return "memories";
}
