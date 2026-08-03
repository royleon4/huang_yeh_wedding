export const PUBLIC_PHOTO_PAGE_LIMIT = 100;
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

export async function loadPublicPhotoFeed({
  fetchImpl = globalThis.fetch,
  signal,
  onInitialPage,
  pageLimit = PUBLIC_PHOTO_PAGE_LIMIT,
  pageCap = PUBLIC_PHOTO_PAGE_CAP,
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

    if (pages === 1 && typeof onInitialPage === "function") {
      onInitialPage([...photos]);
    }
  } while (cursor && pages < pageCap);

  return photos;
}
