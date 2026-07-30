const MEMORIES_ROOT = "/Memories";
const DEFAULT_ALBUM_ID = "wedding";
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

function filterKindForAlbum(albumId) {
  if (albumId === "wedding") return "processes";
  if (albumId === "guest") return "guests";
  return "filters";
}

export function publicGalleryPath({
  albumId = DEFAULT_ALBUM_ID,
  filterId = "all",
  filterKind,
  photoId = null,
} = {}) {
  const normalizedAlbumId = String(albumId || DEFAULT_ALBUM_ID);
  const normalizedFilterId = String(filterId || "all");
  let path = `${MEMORIES_ROOT}/albums/${encodeSegment(normalizedAlbumId)}`;

  if (normalizedFilterId !== "all") {
    path += `/${filterKind || filterKindForAlbum(normalizedAlbumId)}/${encodeSegment(
      normalizedFilterId,
    )}`;
  }
  if (photoId) path += `/photos/${encodeSegment(photoId)}`;
  return path;
}

export function publicModalPath(routeId) {
  const normalized = String(routeId ?? "");
  return PUBLIC_MODAL_ROUTES.has(normalized)
    ? `${MEMORIES_ROOT}/${normalized}`
    : publicGalleryPath();
}

export function readPublicRoute(pathname) {
  const normalized = normalizedPathname(pathname);
  if (normalized === MEMORIES_ROOT || normalized === `${MEMORIES_ROOT}/`) {
    const canonicalPath = publicGalleryPath();
    return {
      kind: "gallery",
      albumId: DEFAULT_ALBUM_ID,
      filterId: "all",
      filterKind: null,
      photoId: null,
      canonicalPath,
    };
  }

  if (!normalized.startsWith(`${MEMORIES_ROOT}/`)) {
    return { kind: "invalid", canonicalPath: publicGalleryPath() };
  }

  const parts = normalized.slice(MEMORIES_ROOT.length + 1).split("/");
  const modalState = parts.length === 1 ? PUBLIC_MODAL_ROUTES.get(parts[0]) : null;
  if (modalState) {
    return {
      kind: "modal",
      routeId: parts[0],
      modal: modalState,
      albumId: DEFAULT_ALBUM_ID,
      filterId: "all",
      filterKind: null,
      photoId: null,
      canonicalPath: publicModalPath(parts[0]),
    };
  }

  if (parts[0] !== "albums" || !parts[1]) {
    return { kind: "invalid", canonicalPath: publicGalleryPath() };
  }

  const albumId = decodeSegment(parts[1]);
  if (!albumId) return { kind: "invalid", canonicalPath: publicGalleryPath() };

  let index = 2;
  let filterId = "all";
  let filterKind = null;
  let photoId = null;

  if (["processes", "guests", "filters"].includes(parts[index])) {
    filterKind = parts[index];
    filterId = decodeSegment(parts[index + 1]);
    if (!filterId) return { kind: "invalid", canonicalPath: publicGalleryPath() };
    index += 2;
  }

  if (parts[index] === "photos") {
    photoId = decodeSegment(parts[index + 1]);
    if (!photoId) return { kind: "invalid", canonicalPath: publicGalleryPath() };
    index += 2;
  }

  if (index !== parts.length) {
    return { kind: "invalid", canonicalPath: publicGalleryPath() };
  }

  const canonicalPath = publicGalleryPath({
    albumId,
    filterId,
    filterKind,
    photoId,
  });
  return {
    kind: "gallery",
    albumId,
    filterId,
    filterKind,
    photoId,
    canonicalPath,
  };
}

export function adminTabPath(tabId = DEFAULT_ADMIN_TAB) {
  const normalized = ADMIN_TAB_IDS.includes(tabId) ? tabId : DEFAULT_ADMIN_TAB;
  return `${MEMORIES_ROOT}/admin/${normalized}`;
}

export function readAdminTab(pathname) {
  const normalized = normalizedPathname(pathname);
  if (normalized === `${MEMORIES_ROOT}/admin`) return DEFAULT_ADMIN_TAB;
  const prefix = `${MEMORIES_ROOT}/admin/`;
  if (!normalized.startsWith(prefix)) return DEFAULT_ADMIN_TAB;
  const tabId = decodeSegment(normalized.slice(prefix.length).split("/")[0]);
  return ADMIN_TAB_IDS.includes(tabId) ? tabId : DEFAULT_ADMIN_TAB;
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
