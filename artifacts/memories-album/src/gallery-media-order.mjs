export const GALLERY_MEDIA_KEYS = [
  "video",
  "text",
  "weddingPhotos",
  "guestPhotos",
];

export const DEFAULT_GALLERY_MEDIA_ORDER = [...GALLERY_MEDIA_KEYS];

export function isValidGalleryMediaOrder(value) {
  return (
    Array.isArray(value) &&
    value.length === GALLERY_MEDIA_KEYS.length &&
    new Set(value).size === GALLERY_MEDIA_KEYS.length &&
    value.every((item) => GALLERY_MEDIA_KEYS.includes(item))
  );
}

export function normalizeGalleryMediaOrder(value) {
  return isValidGalleryMediaOrder(value)
    ? [...value]
    : [...DEFAULT_GALLERY_MEDIA_ORDER];
}

export function photoMediaKey(photo) {
  const uploaderName = String(photo?.uploaderName ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
  return uploaderName === "婚禮攝影" ? "weddingPhotos" : "guestPhotos";
}

export function sortPhotosByMediaOrder(photos, order) {
  const normalizedOrder = normalizeGalleryMediaOrder(order);
  const rank = new Map(normalizedOrder.map((key, index) => [key, index]));
  return Array.from(photos ?? [])
    .map((photo, originalIndex) => ({ photo, originalIndex }))
    .sort((left, right) => {
      const groupDifference =
        (rank.get(photoMediaKey(left.photo)) ?? normalizedOrder.length) -
        (rank.get(photoMediaKey(right.photo)) ?? normalizedOrder.length);
      return groupDifference || left.originalIndex - right.originalIndex;
    })
    .map(({ photo }) => photo);
}
