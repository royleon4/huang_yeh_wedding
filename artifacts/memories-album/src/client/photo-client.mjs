const PHOTO_PAGE_SIZE = 12;

function chronologicalTime(photo) {
  const timestamp = Date.parse(photo?.capturedAt ?? photo?.createdAt ?? "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function mergeChronologicalPhotos(...photoLists) {
  const byId = new Map();
  for (const photos of photoLists) {
    for (const photo of photos ?? []) {
      if (photo?.id) byId.set(photo.id, photo);
    }
  }
  return [...byId.values()].sort((left, right) => {
    const timeDifference = chronologicalTime(left) - chronologicalTime(right);
    return timeDifference || String(left.id).localeCompare(String(right.id));
  });
}

export function buildPhotoPageUrl({
  collection,
  processId = null,
  limit = PHOTO_PAGE_SIZE,
  cursor = null,
}) {
  const query = new URLSearchParams({
    limit: String(Math.max(1, Math.min(Number(limit) || PHOTO_PAGE_SIZE, 100))),
  });
  if (collection) query.set("collection", collection);
  if (processId) query.set("process", processId);
  if (cursor) query.set("cursor", cursor);
  return `/Memories/api/photos?${query}`;
}

export async function fetchPhotoPage(
  options,
  { fetchFn = fetch, signal } = {},
) {
  const response = await fetchFn(buildPhotoPageUrl(options), {
    signal,
    headers: { Accept: "application/json" },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || "Photo listing failed");
    error.code = body.code;
    error.status = response.status;
    throw error;
  }
  return {
    photos: Array.isArray(body.photos) ? body.photos : [],
    nextCursor: body.nextCursor ?? null,
  };
}
