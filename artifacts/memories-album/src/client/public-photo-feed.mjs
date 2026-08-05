export const PUBLIC_PHOTO_PAGE_LIMIT = 24;
export const PUBLIC_PHOTO_PAGE_CAP = 20;

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

export async function yieldToBackgroundTurn({
  signal,
  requestIdleCallbackImpl = globalThis.requestIdleCallback,
  cancelIdleCallbackImpl = globalThis.cancelIdleCallback,
  setTimeoutImpl = globalThis.setTimeout,
  clearTimeoutImpl = globalThis.clearTimeout,
} = {}) {
  if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");

  await new Promise((resolve, reject) => {
    let handle;
    let mode;
    const cleanup = () => {
      signal?.removeEventListener("abort", onAbort);
    };
    const finish = () => {
      cleanup();
      resolve();
    };
    const onAbort = () => {
      if (mode === "idle") cancelIdleCallbackImpl?.(handle);
      if (mode === "timeout") clearTimeoutImpl?.(handle);
      cleanup();
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    };

    signal?.addEventListener("abort", onAbort, { once: true });
    if (typeof requestIdleCallbackImpl === "function") {
      mode = "idle";
      handle = requestIdleCallbackImpl(finish, { timeout: 250 });
      return;
    }
    mode = "timeout";
    handle = setTimeoutImpl(finish, 0);
  });
}

export async function loadPublicPhotoFeed({
  fetchImpl = globalThis.fetch,
  signal,
  onInitialPage,
  onPage,
  pageLimit = PUBLIC_PHOTO_PAGE_LIMIT,
  pageCap = PUBLIC_PHOTO_PAGE_CAP,
  ImageConstructor = globalThis.Image,
  yieldImpl = yieldToBackgroundTurn,
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

    const complete = !cursor || pages >= pageCap;
    if (typeof onPage === "function") {
      onPage([...photos], { page: pages, complete });
    }
    if (!complete) await yieldImpl({ signal });
  } while (cursor && pages < pageCap);

  return photos;
}
