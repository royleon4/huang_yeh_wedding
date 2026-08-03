import { requestActiveContentScroll } from "./gallery-navigation.mjs";
import { suspendMasonryAnchorRestoration } from "./useMasonryLayout.mjs";

function browserDocument() {
  return typeof document === "undefined" ? null : document;
}

function browserWindow() {
  return typeof window === "undefined" ? null : window;
}

export const ALBUM_SELECTION_SELECTOR = [
  ".collection-tabs .collection-tab",
  ".bottom-collection-nav .bottom-nav-side button",
].join(", ");

export function isAlbumSelectionTarget(target) {
  return Boolean(target?.closest?.(ALBUM_SELECTION_SELECTOR));
}

export function requestAlbumContentPosition({
  documentRef = browserDocument(),
  windowRef = browserWindow(),
  behavior = "smooth",
  requestContentScroll = requestActiveContentScroll,
  suspendAnchor = suspendMasonryAnchorRestoration,
} = {}) {
  suspendAnchor();
  return requestContentScroll({ documentRef, windowRef, behavior });
}

export function installAlbumContentNavigation({
  documentRef = browserDocument(),
  windowRef = browserWindow(),
  requestPosition = requestAlbumContentPosition,
} = {}) {
  if (!documentRef?.addEventListener || !windowRef) return () => {};

  const onClick = (event) => {
    if (!isAlbumSelectionTarget(event.target)) return;
    requestPosition({ documentRef, windowRef });
  };

  documentRef.addEventListener("click", onClick);
  return () => documentRef.removeEventListener("click", onClick);
}

const disposeAlbumContentNavigation = installAlbumContentNavigation();
if (import.meta.hot) import.meta.hot.dispose(disposeAlbumContentNavigation);
