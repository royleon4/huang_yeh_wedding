export const DEFAULT_FEATURED_PHOTO_MIN = 1;
export const DEFAULT_FEATURED_PHOTO_MAX = 3;

export function normalizeFeaturedPhotoRange(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const minimum = Number(source.featuredPhotoMin);
  const maximum = Number(source.featuredPhotoMax);
  if (
    Number.isInteger(minimum) &&
    Number.isInteger(maximum) &&
    minimum >= 0 &&
    maximum >= minimum
  ) {
    return { minimum, maximum };
  }
  return {
    minimum: DEFAULT_FEATURED_PHOTO_MIN,
    maximum: DEFAULT_FEATURED_PHOTO_MAX,
  };
}

export function isAlbumFilter(activeCollection, activeFilter) {
  return Boolean(activeCollection) && Boolean(activeFilter);
}

export function selectFeaturedPhotoIds(
  photos,
  {
    activeCollection,
    activeFilter,
    enabled,
    minimum = DEFAULT_FEATURED_PHOTO_MIN,
    maximum = DEFAULT_FEATURED_PHOTO_MAX,
    random = Math.random,
  } = {},
) {
  const items = Array.isArray(photos) ? photos : [];
  if (!enabled || !isAlbumFilter(activeCollection, activeFilter)) return [];
  if (items.length === 0) return [];

  const minCount = Math.max(0, Number.isInteger(minimum) ? minimum : 0);
  const maxCount = Math.max(
    minCount,
    Number.isInteger(maximum) ? maximum : minCount,
  );
  if (maxCount === 0) return [];

  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }

  const requestedCount =
    minCount + Math.floor(random() * (maxCount - minCount + 1));
  return shuffled
    .slice(0, Math.min(requestedCount, shuffled.length))
    .map((photo) => photo.id);
}

export function pageFeaturedPhotos(photos, pageSize, featuredIds) {
  const items = Array.isArray(photos) ? photos : [];
  const limit = Math.max(0, Number(pageSize) || 0);
  const featuredSet = new Set(Array.isArray(featuredIds) ? featuredIds : []);
  const featured = items
    .filter((photo) => featuredSet.has(photo.id))
    .map((photo) => ({ ...photo, albumFeatured: true }));
  const regular = items
    .filter((photo) => !featuredSet.has(photo.id))
    .map((photo) => ({ ...photo, albumFeatured: false }));
  return [...featured, ...regular].slice(0, limit);
}
