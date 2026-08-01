const APP_SUFFIX = "/src/client/App.jsx";

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`Progressive photo loading transform could not find ${label}`);
  }
  return source.replace(search, replacement);
}

const LEGACY_FETCH_ALL_PHOTOS = `async function fetchAllPhotos() {
  const photos = [];
  let cursor = null;
  let pages = 0;
  do {
    const query = new URLSearchParams({ limit: "100" });
    if (cursor) query.set("cursor", cursor);
    const response = await fetch(\`/Memories/api/photos?\${query}\`);
    if (!response.ok) throw new Error("Photo listing failed");
    const page = await response.json();
    photos.push(...(page.photos ?? []));
    cursor = page.nextCursor ?? null;
    pages += 1;
  } while (cursor && pages < 20);
  return photos;
}`;

const PROGRESSIVE_FETCH_ALL_PHOTOS = `async function fetchAllPhotos() {
  const PAGE_LIMIT = 100;
  const INITIAL_PAGE_COUNT = 2;
  const MAX_PAGE_COUNT = 20;
  const controller = new AbortController();
  const { signal } = controller;
  const photos = [];
  const seenCursors = new Set();
  let cursor = null;
  let pages = 0;

  const createAbortError = () => {
    if (typeof DOMException === "function") {
      return new DOMException("Photo loading aborted", "AbortError");
    }
    const error = new Error("Photo loading aborted");
    error.name = "AbortError";
    return error;
  };

  const waitForIdle = () =>
    new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(createAbortError());
        return;
      }

      let handle = null;
      let scheduledWithIdleCallback = false;
      const cleanup = () => {
        signal.removeEventListener("abort", onAbort);
      };
      const finish = () => {
        cleanup();
        resolve();
      };
      const onAbort = () => {
        if (scheduledWithIdleCallback) {
          window.cancelIdleCallback?.(handle);
        } else {
          clearTimeout(handle);
        }
        cleanup();
        reject(createAbortError());
      };

      signal.addEventListener("abort", onAbort, { once: true });
      if (typeof window.requestIdleCallback === "function") {
        scheduledWithIdleCallback = true;
        handle = window.requestIdleCallback(finish, { timeout: 750 });
      } else {
        handle = setTimeout(finish, 0);
      }
    });

  const fetchNextPage = async () => {
    if (signal.aborted) throw createAbortError();
    const query = new URLSearchParams({ limit: String(PAGE_LIMIT) });
    if (cursor) query.set("cursor", cursor);
    const response = await fetch(\`/Memories/api/photos?\${query}\`, {
      headers: { Accept: "application/json" },
      signal,
    });
    if (!response.ok) throw new Error("Photo listing failed");
    const page = await response.json();
    photos.push(...(page.photos ?? []));
    pages += 1;

    const nextCursor = page.nextCursor ?? null;
    if (!nextCursor || seenCursors.has(nextCursor)) {
      cursor = null;
    } else {
      seenCursors.add(nextCursor);
      cursor = nextCursor;
    }
    return Boolean(cursor && pages < MAX_PAGE_COUNT);
  };

  const initialPhotos = (async () => {
    let hasMore = true;
    while (hasMore && pages < INITIAL_PAGE_COUNT) {
      hasMore = await fetchNextPage();
    }
    return [...photos];
  })();

  const continueLoading = async (onProgress) => {
    await initialPhotos;
    let hasMore = Boolean(cursor && pages < MAX_PAGE_COUNT);
    while (hasMore) {
      await waitForIdle();
      hasMore = await fetchNextPage();
      onProgress?.([...photos], { complete: !hasMore });
    }
    return [...photos];
  };

  return {
    initialPhotos,
    continueLoading,
    cancel: () => controller.abort(),
  };
}`;

const LEGACY_PHOTO_EFFECT = `    void fetchAllPhotos()
      .then((photos) => {
        if (cancelled) return;
        if (photos.length > 0 || !useMockFallback) setRemotePhotos(photos);
        setGalleryError(false);
      })
      .catch(() => {
        if (!cancelled && !useMockFallback) setGalleryError(true);
      });
    return () => {
      cancelled = true;
    };`;

const PROGRESSIVE_PHOTO_EFFECT = `    let cancelPhotoLoad = () => {};
    let initialPhotoWindowDelivered = false;
    const publishPhotos = (nextPhotos) => {
      if (nextPhotos.length === 0 && useMockFallback) return;
      setRemotePhotos((current) => {
        if (!current || current.length === 0) return nextPhotos;
        const nextIds = new Set(nextPhotos.map((photo) => photo.id));
        const localOnly = current.filter((photo) => !nextIds.has(photo.id));
        return localOnly.length > 0 ? [...localOnly, ...nextPhotos] : nextPhotos;
      });
    };

    void fetchAllPhotos()
      .then(({ initialPhotos, continueLoading, cancel }) => {
        cancelPhotoLoad = cancel;
        if (cancelled) {
          cancel();
          return undefined;
        }
        return initialPhotos.then((photos) => {
          if (cancelled) return undefined;
          initialPhotoWindowDelivered = true;
          publishPhotos(photos);
          setGalleryError(false);
          return continueLoading((nextPhotos) => {
            if (!cancelled) publishPhotos(nextPhotos);
          });
        });
      })
      .catch((error) => {
        if (cancelled || error?.name === "AbortError") return;
        if (!initialPhotoWindowDelivered && !useMockFallback) {
          setGalleryError(true);
          return;
        }
        console.warn("Memories background photo metadata loading stopped", {
          name: error instanceof Error ? error.name : "UnknownError",
        });
      });
    return () => {
      cancelled = true;
      cancelPhotoLoad();
    };`;

export function transformProgressivePhotoLoading(source) {
  let code = replaceOnce(
    source,
    LEGACY_FETCH_ALL_PHOTOS,
    PROGRESSIVE_FETCH_ALL_PHOTOS,
    "legacy all-photo request loop",
  );
  code = replaceOnce(
    code,
    LEGACY_PHOTO_EFFECT,
    PROGRESSIVE_PHOTO_EFFECT,
    "legacy blocking photo effect",
  );
  return code;
}

export function progressivePhotoLoadingUiTransform() {
  return {
    name: "progressive-photo-loading-ui",
    enforce: "pre",
    transform(source, id) {
      const normalizedId = id.split("?")[0].replace(/\\/g, "/");
      if (!normalizedId.endsWith(APP_SUFFIX)) return null;
      return {
        code: transformProgressivePhotoLoading(source),
        map: null,
      };
    },
  };
}
