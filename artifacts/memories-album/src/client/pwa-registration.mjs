const PUBLIC_SCOPE = "/Memories/";

function isSecureContextForServiceWorker(locationLike = globalThis.location) {
  if (!locationLike) return false;
  return (
    locationLike.protocol === "https:" ||
    locationLike.hostname === "localhost" ||
    locationLike.hostname === "127.0.0.1"
  );
}

function isPrivateSurface(pathname = globalThis.location?.pathname ?? "") {
  return (
    pathname.startsWith("/Memories/admin") ||
    pathname.startsWith("/Memories/manage/")
  );
}

export async function registerMemoriesServiceWorker({
  navigatorLike = globalThis.navigator,
  locationLike = globalThis.location,
} = {}) {
  if (
    !navigatorLike?.serviceWorker ||
    !isSecureContextForServiceWorker(locationLike) ||
    isPrivateSurface(locationLike?.pathname)
  ) {
    return null;
  }

  return navigatorLike.serviceWorker.register("/Memories/sw.js", {
    scope: PUBLIC_SCOPE,
    updateViaCache: "none",
  });
}

export function scheduleMemoriesServiceWorkerRegistration(options) {
  if (typeof window === "undefined") return;
  window.addEventListener(
    "load",
    () => {
      void registerMemoriesServiceWorker(options).catch((error) => {
        console.warn("[Memories] Service worker registration failed", {
          name: error instanceof Error ? error.name : "UnknownError",
        });
      });
    },
    { once: true },
  );
}
