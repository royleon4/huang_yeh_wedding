import { LATEST_GUEST_FILTER_ID } from "../guest-label-settings.mjs";

export const PUBLIC_PHOTO_PAGE_LIMIT = 100;
export const PUBLIC_PHOTO_PAGE_CAP = 20;
export const PUBLIC_THUMBNAIL_CONCURRENCY = 4;

function normalizedPhotoPage(body) {
  const source = body && typeof body === "object" ? body : {};
  return {
    photos: Array.isArray(source.photos) ? source.photos : [],
    nextCursor:
      typeof source.nextCursor === "string" && source.nextCursor.length > 0
        ? source.nextCursor
        : null,
  };
}

function normalizedText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

function photoTimestamp(photo) {
  const timestamp = Date.parse(photo?.createdAt ?? "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function comparePhotos(left, right) {
  return (
    photoTimestamp(left) - photoTimestamp(right) ||
    String(left?.id ?? "").localeCompare(String(right?.id ?? ""))
  );
}

function isOfficialPhoto(photo) {
  return photo?.source === "official";
}

function photoBelongsToAlbum(photo, albumId) {
  if (!albumId) return false;
  if (Array.isArray(photo?.albumIds)) return photo.albumIds.includes(albumId);
  const collection =
    photo?.collection ?? (photo?.source === "guest" ? "guest" : "wedding");
  return collection === albumId;
}

function normalizedContext(value = {}) {
  return {
    collectionId: normalizedText(value.collectionId) || "wedding",
    filterId: normalizedText(value.filterId) || "all",
  };
}

function thumbnailPriority(photo, context) {
  if (context.collectionId === "wedding") {
    if (
      context.filterId !== "all" &&
      isOfficialPhoto(photo) &&
      Array.isArray(photo?.processIds) &&
      photo.processIds.includes(context.filterId)
    ) {
      return 0;
    }
    return isOfficialPhoto(photo) ? 1 : 2;
  }

  if (!photoBelongsToAlbum(photo, context.collectionId)) return 2;
  if (
    context.collectionId === "guest" &&
    context.filterId !== "all" &&
    context.filterId !== LATEST_GUEST_FILTER_ID
  ) {
    return normalizedText(photo?.uploaderName) === context.filterId ? 0 : 1;
  }
  return 0;
}

function queryKey(parameters) {
  return (
    Object.entries(parameters)
      .filter(([, value]) => value !== null && value !== undefined && value !== "")
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${String(value)}`)
      .join("&") || "all"
  );
}

function queryUrl(parameters, cursor, pageLimit) {
  const query = new URLSearchParams({ limit: String(pageLimit) });
  for (const [key, value] of Object.entries(parameters)) {
    if (value !== null && value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  }
  if (cursor) query.set("cursor", cursor);
  return `/Memories/api/photos?${query}`;
}

export function preloadFirstPhotoThumbnail(
  photos,
  ImageConstructor = globalThis.Image,
) {
  const thumbnailUrl = photos?.[0]?.thumbnailUrl;
  if (!thumbnailUrl || typeof ImageConstructor !== "function") return null;

  const image = new ImageConstructor();
  image.decoding = "async";
  image.fetchPriority = "high";
  image.src = thumbnailUrl;
  return image;
}

export async function loadPublicPhotoFeed({
  fetchImpl = globalThis.fetch,
  signal,
  onInitialPage,
  pageLimit = PUBLIC_PHOTO_PAGE_LIMIT,
  pageCap = PUBLIC_PHOTO_PAGE_CAP,
  ImageConstructor = globalThis.Image,
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new TypeError("A fetch implementation is required");
  }

  const photos = [];
  let cursor = null;
  let pages = 0;

  do {
    const query = new URLSearchParams({ limit: String(pageLimit) });
    if (cursor) query.set("cursor", cursor);

    const response = await fetchImpl(`/Memories/api/photos?${query}`, {
      headers: { Accept: "application/json" },
      signal,
    });
    if (!response.ok) throw new Error("Photo listing failed");

    const page = normalizedPhotoPage(await response.json());
    photos.push(...page.photos);
    cursor = page.nextCursor;
    pages += 1;

    if (pages === 1) {
      preloadFirstPhotoThumbnail(photos, ImageConstructor);
      if (typeof onInitialPage === "function") onInitialPage([...photos]);
    }
  } while (cursor && pages < pageCap);

  return photos;
}

export function createPublicPhotoFeedLoader({
  fetchImpl = globalThis.fetch,
  ImageConstructor = globalThis.Image,
  pageLimit = PUBLIC_PHOTO_PAGE_LIMIT,
  pageCap = PUBLIC_PHOTO_PAGE_CAP,
  thumbnailConcurrency = PUBLIC_THUMBNAIL_CONCURRENCY,
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new TypeError("A fetch implementation is required");
  }

  const boundedPageLimit = Math.max(1, Math.min(Number(pageLimit) || 100, 100));
  const boundedPageCap = Math.max(1, Number(pageCap) || PUBLIC_PHOTO_PAGE_CAP);
  const boundedThumbnailConcurrency = Math.max(
    1,
    Math.min(Number(thumbnailConcurrency) || PUBLIC_THUMBNAIL_CONCURRENCY, 8),
  );
  const listeners = new Set();
  const photosById = new Map();
  const queries = new Map();
  const thumbnailStates = new Map();
  const thumbnailIdleWaiters = new Set();
  let context = normalizedContext();
  let querySequence = 0;
  let thumbnailSequence = 0;
  let metadataComplete = false;
  let photoSnapshot = [];
  let lastError = null;
  let metadataPump = null;
  let activeThumbnailLoads = 0;

  const thumbnailsComplete = () =>
    metadataComplete &&
    activeThumbnailLoads === 0 &&
    ![...thumbnailStates.values()].some((item) => item.state === "queued");

  const snapshot = () => ({
    photos: photoSnapshot,
    complete: metadataComplete,
    metadataComplete,
    thumbnailsComplete: thumbnailsComplete(),
    error: lastError,
  });

  const emit = () => {
    const next = snapshot();
    for (const listener of listeners) listener(next);
    if (next.thumbnailsComplete) {
      for (const resolve of thumbnailIdleWaiters) resolve(next);
      thumbnailIdleWaiters.clear();
    }
  };

  const reprioritizeThumbnails = () => {
    for (const item of thumbnailStates.values()) {
      if (item.state === "queued") {
        item.priority = thumbnailPriority(item.photo, context);
      }
    }
  };

  const pumpThumbnails = () => {
    if (typeof ImageConstructor !== "function") {
      emit();
      return;
    }
    while (activeThumbnailLoads < boundedThumbnailConcurrency) {
      const next = [...thumbnailStates.values()]
        .filter((item) => item.state === "queued")
        .sort(
          (left, right) =>
            left.priority - right.priority || left.sequence - right.sequence,
        )[0];
      if (!next) break;

      next.state = "loading";
      activeThumbnailLoads += 1;
      const image = new ImageConstructor();
      next.image = image;
      image.decoding = "async";
      image.fetchPriority = next.priority === 0 ? "high" : "auto";
      const settle = (state) => {
        if (next.state !== "loading") return;
        next.state = state;
        next.image = null;
        activeThumbnailLoads -= 1;
        pumpThumbnails();
        emit();
      };
      image.onload = () => settle("loaded");
      image.onerror = () => settle("failed");
      image.src = next.photo.thumbnailUrl;
    }
    emit();
  };

  const queueThumbnail = (photo) => {
    if (!photo?.id || !photo?.thumbnailUrl) return;
    const current = thumbnailStates.get(photo.id);
    if (current?.url === photo.thumbnailUrl) {
      current.photo = photo;
      if (current.state === "queued") {
        current.priority = thumbnailPriority(photo, context);
      }
      return;
    }
    thumbnailStates.set(photo.id, {
      id: photo.id,
      url: photo.thumbnailUrl,
      photo,
      state: "queued",
      priority: thumbnailPriority(photo, context),
      sequence: thumbnailSequence++,
      image: null,
    });
  };

  const mergePhotos = (photos) => {
    let changed = false;
    for (const photo of photos ?? []) {
      if (!photo?.id) continue;
      const previous = photosById.get(photo.id);
      if (previous !== photo) {
        photosById.set(photo.id, { ...previous, ...photo });
        changed = true;
      }
      queueThumbnail(photosById.get(photo.id));
    }
    if (changed) {
      photoSnapshot = [...photosById.values()].sort(comparePhotos);
      emit();
    }
    pumpThumbnails();
  };

  const ensureQuery = (parameters, priority, role) => {
    const key = queryKey(parameters);
    const existing = queries.get(key);
    if (existing) {
      existing.priority = priority;
      existing.role = role;
      if (existing.failed) existing.failed = false;
      return existing;
    }
    const created = {
      key,
      parameters,
      priority,
      role,
      cursor: null,
      pages: 0,
      complete: false,
      failed: false,
      running: false,
      sequence: querySequence++,
    };
    queries.set(key, created);
    return created;
  };

  const configureQueries = () => {
    if (metadataComplete) return;
    for (const query of queries.values()) {
      if (query.complete) continue;
      if (query.role === "all") query.priority = 2;
      else if (query.role === "official") {
        query.priority = context.collectionId === "wedding" ? 1 : 3;
      } else {
        query.priority = 3;
      }
    }

    if (context.collectionId === "wedding") {
      if (context.filterId !== "all") {
        ensureQuery(
          { process: context.filterId, source: "official" },
          0,
          "context",
        );
        ensureQuery({ source: "official" }, 1, "official");
      } else {
        ensureQuery({ source: "official" }, 0, "official");
      }
    } else {
      ensureQuery({ albumId: context.collectionId }, 0, "context");
    }
    ensureQuery({}, 2, "all");
  };

  const nextQuery = () =>
    [...queries.values()]
      .filter(
        (query) =>
          !query.complete &&
          !query.failed &&
          !query.running &&
          query.pages < boundedPageCap,
      )
      .sort(
        (left, right) =>
          left.priority - right.priority || left.sequence - right.sequence,
      )[0] ?? null;

  const pumpMetadata = () => {
    if (metadataPump) return metadataPump;
    metadataPump = (async () => {
      while (!metadataComplete) {
        const query = nextQuery();
        if (!query) break;
        query.running = true;
        try {
          const response = await fetchImpl(
            queryUrl(query.parameters, query.cursor, boundedPageLimit),
            { headers: { Accept: "application/json" } },
          );
          if (!response.ok) throw new Error("Photo listing failed");
          const page = normalizedPhotoPage(await response.json());
          query.pages += 1;
          query.cursor = page.nextCursor;
          if (!query.cursor || query.pages >= boundedPageCap) query.complete = true;
          mergePhotos(page.photos);
          lastError = null;
          if (query.role === "all" && query.complete) {
            metadataComplete = true;
          }
        } catch (error) {
          query.failed = true;
          lastError =
            error instanceof Error ? error : new Error("Photo listing failed");
        } finally {
          query.running = false;
          emit();
        }
      }
    })().finally(() => {
      metadataPump = null;
      emit();
    });
    return metadataPump;
  };

  const setContext = (nextContext) => {
    context = normalizedContext(nextContext);
    reprioritizeThumbnails();
    configureQueries();
    pumpThumbnails();
    void pumpMetadata();
  };

  return {
    subscribe(listener) {
      if (typeof listener !== "function") {
        throw new TypeError("A photo feed listener is required");
      }
      listeners.add(listener);
      listener(snapshot());
      return () => listeners.delete(listener);
    },
    setContext,
    addPhoto(photo) {
      mergePhotos([photo]);
    },
    getSnapshot: snapshot,
    whenMetadataIdle() {
      return metadataPump ?? Promise.resolve(snapshot());
    },
    whenThumbnailsIdle() {
      if (thumbnailsComplete()) return Promise.resolve(snapshot());
      return new Promise((resolve) => thumbnailIdleWaiters.add(resolve));
    },
    stats() {
      return {
        context: { ...context },
        metadataComplete,
        queryCount: queries.size,
        photoCount: photosById.size,
        thumbnails: [...thumbnailStates.values()].reduce(
          (counts, item) => {
            counts[item.state] = (counts[item.state] ?? 0) + 1;
            return counts;
          },
          {},
        ),
      };
    },
  };
}

let sharedPublicPhotoFeedLoader = null;

export function getPublicPhotoFeedLoader(options) {
  sharedPublicPhotoFeedLoader ??= createPublicPhotoFeedLoader(options);
  return sharedPublicPhotoFeedLoader;
}

export function resetPublicPhotoFeedLoaderForTests() {
  sharedPublicPhotoFeedLoader = null;
}
