export const DEFAULT_GALLERY_MEDIA_ORDER = [
  "video",
  "text",
  "weddingPhotos",
  "guestPhotos",
];

export function isValidGalleryMediaOrder(value) {
  return (
    Array.isArray(value) &&
    value.length === DEFAULT_GALLERY_MEDIA_ORDER.length &&
    new Set(value).size === DEFAULT_GALLERY_MEDIA_ORDER.length &&
    value.every((item) => DEFAULT_GALLERY_MEDIA_ORDER.includes(item))
  );
}

export function normalizeGalleryMediaOrder(value) {
  return isValidGalleryMediaOrder(value)
    ? [...value]
    : [...DEFAULT_GALLERY_MEDIA_ORDER];
}
