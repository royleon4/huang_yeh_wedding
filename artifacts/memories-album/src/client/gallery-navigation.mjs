function browserDocument() {
  return typeof document === "undefined" ? null : document;
}

function browserWindow() {
  return typeof window === "undefined" ? null : window;
}

let latestScrollRequest = 0;

function isActuallyVisible(element, windowRef) {
  if (!element?.getBoundingClientRect) return false;
  const rect = element.getBoundingClientRect();
  const style = windowRef?.getComputedStyle?.(element);
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style?.display !== "none" &&
    style?.visibility !== "hidden"
  );
}

export function resolveActiveContentTarget({
  documentRef = browserDocument(),
  windowRef = browserWindow(),
} = {}) {
  const gallery = documentRef?.getElementById("archive-gallery");
  if (!gallery || !windowRef) return null;

  const mediaItems = [
    ...(gallery.querySelectorAll?.(
      ".process-media-sequence > .process-media-item[data-media-block]",
    ) ?? []),
  ];
  const firstVisibleMedia = mediaItems.find((element) =>
    isActuallyVisible(element, windowRef),
  );
  if (firstVisibleMedia) return firstVisibleMedia;

  const firstVisibleChild = [...(gallery.children ?? [])].find((element) =>
    isActuallyVisible(element, windowRef),
  );
  return firstVisibleChild ?? gallery;
}

export function activeContentStartTop({
  documentRef = browserDocument(),
  windowRef = browserWindow(),
} = {}) {
  const target = resolveActiveContentTarget({ documentRef, windowRef });
  if (!target || !windowRef) return null;
  const stickyControls = documentRef.querySelector(".process-section");
  const stickyHeight = stickyControls?.getBoundingClientRect().height ?? 0;
  return Math.max(
    0,
    windowRef.scrollY +
      target.getBoundingClientRect().top -
      stickyHeight -
      10,
  );
}

export function scrollToActiveContentStart({
  documentRef = browserDocument(),
  windowRef = browserWindow(),
  behavior = "smooth",
} = {}) {
  const top = activeContentStartTop({ documentRef, windowRef });
  if (top === null || !windowRef) return false;
  windowRef.scrollTo({ top, behavior });
  return true;
}

export function requestActiveContentScroll({
  documentRef = browserDocument(),
  windowRef = browserWindow(),
  behavior = "smooth",
} = {}) {
  if (!windowRef?.requestAnimationFrame) return false;
  const requestId = ++latestScrollRequest;
  windowRef.requestAnimationFrame(() =>
    windowRef.requestAnimationFrame(() => {
      if (requestId !== latestScrollRequest) return;
      scrollToActiveContentStart({ documentRef, windowRef, behavior });
    }),
  );
  return true;
}

export const galleryStartTop = activeContentStartTop;
export const scrollToGalleryStart = scrollToActiveContentStart;
export const requestGalleryStartScroll = requestActiveContentScroll;
