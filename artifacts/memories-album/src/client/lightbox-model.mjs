export const MIN_ZOOM = 1;
export const MAX_ZOOM = 5;
export const ZOOM_STEP = 0.5;

export function clampZoom(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return MIN_ZOOM;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, numeric));
}

export function adjacentPhotoIndex(currentIndex, photoCount, direction) {
  if (!Number.isInteger(currentIndex) || photoCount <= 0) return -1;
  const next = currentIndex + Math.sign(direction || 0);
  return next >= 0 && next < photoCount ? next : currentIndex;
}

export function isHorizontalSwipe({
  startX,
  startY,
  endX,
  endY,
  threshold = 55,
}) {
  const horizontal = Number(endX) - Number(startX);
  const vertical = Number(endY) - Number(startY);
  return (
    Number.isFinite(horizontal) &&
    Number.isFinite(vertical) &&
    Math.abs(horizontal) >= threshold &&
    Math.abs(horizontal) > Math.abs(vertical) * 1.2
  );
}
