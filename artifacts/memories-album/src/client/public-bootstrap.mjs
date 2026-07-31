import {
  ALL_PROCESS_DEFINITION,
  COLLECTION_DEFINITIONS,
  PROCESS_DEFINITIONS,
  normalizePublicAlbums,
} from "./gallery-model.mjs";
import {
  DEFAULT_GALLERY_MEDIA_ORDER,
  normalizeGalleryMediaOrder,
} from "../gallery-media-order.mjs";
import { normalizePinnedPhotosByProcess } from "../pinned-photo-settings.mjs";
import { normalizeSiteCopy } from "../site-copy.mjs";

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_WHEEL_VISIBLE_COUNT = 6;
const ALLOWED_WHEEL_VISIBLE_COUNTS = new Set([3, 4, 5, 6, 7, 8]);

function fallbackAlbums() {
  return COLLECTION_DEFINITIONS.map((album, index) => ({
    id: album.id,
    zh: album.zh,
    en: album.en,
    descriptionZh: "",
    descriptionEn: "",
    displayOrder: index + 1,
  }));
}

function fallbackProcessPayload() {
  return {
    processes: PROCESS_DEFINITIONS.map((process, index) => ({
      id: process.id,
      labelZh: process.zh,
      labelEn: process.en,
      displayOrder: Number(process.displayOrder) || index + 1,
      youtubeVideoId: process.youtubeVideoId ?? null,
      youtubeAutoplay: Boolean(process.youtubeAutoplay),
      contentHtmlZh: process.contentHtmlZh ?? "",
      contentHtmlEn: process.contentHtmlEn ?? "",
      dividerPaddingTop: Number(process.dividerPaddingTop ?? 12),
      dividerPaddingBottom: Number(process.dividerPaddingBottom ?? 12),
    })),
    allProcess: {
      id: "all",
      labelZh: ALL_PROCESS_DEFINITION.zh || "全部流程",
      labelEn:
        ALL_PROCESS_DEFINITION.en || ALL_PROCESS_DEFINITION.zh || "All moments",
      youtubeVideoId: ALL_PROCESS_DEFINITION.youtubeVideoId ?? null,
      youtubeAutoplay: Boolean(ALL_PROCESS_DEFINITION.youtubeAutoplay),
      showAllPhotos: ALL_PROCESS_DEFINITION.showAllPhotos !== false,
      contentHtmlZh: ALL_PROCESS_DEFINITION.contentHtmlZh ?? "",
      contentHtmlEn: ALL_PROCESS_DEFINITION.contentHtmlEn ?? "",
      dividerPaddingTop: Number(ALL_PROCESS_DEFINITION.dividerPaddingTop ?? 12),
      dividerPaddingBottom: Number(
        ALL_PROCESS_DEFINITION.dividerPaddingBottom ?? 12,
      ),
    },
  };
}

export function normalizePublicSettings(value) {
  const source = value && typeof value === "object" ? value : {};
  const requestedVisibleCount = Number(source.processWheelVisibleCount);
  return {
    ...source,
    galleryMediaOrder: normalizeGalleryMediaOrder(source.galleryMediaOrder),
    pinnedPhotoIdsByProcess: normalizePinnedPhotosByProcess(
      source.pinnedPhotoIdsByProcess,
    ),
    siteCopy: normalizeSiteCopy(source.siteCopy),
    processWheelEnabled: source.processWheelEnabled === true,
    processWheelVisibleCount: ALLOWED_WHEEL_VISIBLE_COUNTS.has(
      requestedVisibleCount,
    )
      ? requestedVisibleCount
      : DEFAULT_WHEEL_VISIBLE_COUNT,
    guestUploadCategorySelectionEnabled:
      source.guestUploadCategorySelectionEnabled !== false,
  };
}

function fallbackSnapshot() {
  const processPayload = fallbackProcessPayload();
  return {
    albums: fallbackAlbums(),
    settings: normalizePublicSettings({
      galleryMediaOrder: DEFAULT_GALLERY_MEDIA_ORDER,
    }),
    processes: processPayload.processes,
    allProcess: processPayload.allProcess,
    resolved: {
      albums: false,
      settings: false,
      processes: false,
    },
  };
}

async function fetchJson(fetchImpl, path, signal) {
  const response = await fetchImpl(path, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response?.ok) {
    throw new Error(`Public bootstrap request failed: ${path}`);
  }
  return response.json();
}

function normalizedAlbums(payload, fallback) {
  const albums = normalizePublicAlbums(payload?.albums);
  return albums.length > 0 ? albums : fallback;
}

function normalizedProcessPayload(payload, fallback) {
  if (!Array.isArray(payload?.processes)) return fallback;
  return {
    processes: payload.processes,
    allProcess:
      payload.allProcess && typeof payload.allProcess === "object"
        ? payload.allProcess
        : fallback.allProcess,
  };
}

export function createPublicBootstrapLoader({
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  let currentSnapshot = fallbackSnapshot();
  let loadPromise = null;

  const load = () => {
    if (loadPromise) return loadPromise;
    if (typeof fetchImpl !== "function") return Promise.resolve(currentSnapshot);

    loadPromise = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      const fallback = fallbackSnapshot();

      try {
        const [albumsResult, settingsResult, processesResult] =
          await Promise.allSettled([
            fetchJson(fetchImpl, "/Memories/api/albums", controller.signal),
            fetchJson(fetchImpl, "/Memories/api/settings", controller.signal),
            fetchJson(fetchImpl, "/Memories/api/processes", controller.signal),
          ]);

        const processPayload =
          processesResult.status === "fulfilled"
            ? normalizedProcessPayload(processesResult.value, fallback)
            : {
                processes: fallback.processes,
                allProcess: fallback.allProcess,
              };

        currentSnapshot = {
          albums:
            albumsResult.status === "fulfilled"
              ? normalizedAlbums(albumsResult.value, fallback.albums)
              : fallback.albums,
          settings:
            settingsResult.status === "fulfilled"
              ? normalizePublicSettings(settingsResult.value)
              : fallback.settings,
          processes: processPayload.processes,
          allProcess: processPayload.allProcess,
          resolved: {
            albums: albumsResult.status === "fulfilled",
            settings: settingsResult.status === "fulfilled",
            processes: processesResult.status === "fulfilled",
          },
        };
        return currentSnapshot;
      } finally {
        clearTimeout(timeout);
      }
    })();

    return loadPromise;
  };

  return {
    load,
    current: () => currentSnapshot,
  };
}

const publicBootstrapLoader = createPublicBootstrapLoader();

export function loadPublicBootstrap() {
  return publicBootstrapLoader.load();
}

export function getPublicBootstrap() {
  return publicBootstrapLoader.current();
}
