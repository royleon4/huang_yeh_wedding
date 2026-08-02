function browserDocument() {
  return typeof document === "undefined" ? null : document;
}

function browserWindow() {
  return typeof window === "undefined" ? null : window;
}

export function galleryStartTop({
  documentRef = browserDocument(),
  windowRef = browserWindow(),
} = {}) {
  const gallery = documentRef?.getElementById("archive-gallery");
  if (!gallery || !windowRef) return null;
  const stickyControls = documentRef.querySelector(".process-section");
  const stickyHeight = stickyControls?.getBoundingClientRect().height ?? 0;
  return Math.max(
    0,
    windowRef.scrollY +
      gallery.getBoundingClientRect().top -
      stickyHeight -
      10,
  );
}

export function scrollToGalleryStart({
  documentRef = browserDocument(),
  windowRef = browserWindow(),
  behavior = "smooth",
} = {}) {
  const top = galleryStartTop({ documentRef, windowRef });
  if (top === null || !windowRef) return false;
  windowRef.scrollTo({ top, behavior });
  return true;
}

export function requestGalleryStartScroll({
  documentRef = browserDocument(),
  windowRef = browserWindow(),
  behavior = "smooth",
} = {}) {
  if (!windowRef?.requestAnimationFrame) return false;
  windowRef.requestAnimationFrame(() =>
    windowRef.requestAnimationFrame(() =>
      scrollToGalleryStart({ documentRef, windowRef, behavior }),
    ),
  );
  return true;
}
