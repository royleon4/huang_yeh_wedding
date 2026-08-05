const CACHE_PREFIX = "memories-shell-";
const CACHE_NAME = `${CACHE_PREFIX}2026-08-05-v1`;
const OFFLINE_URL = "/Memories/offline.html";
const CORE_ASSETS = [OFFLINE_URL, "/Memories/manifest.webmanifest"];

function isPrivateOrDataRequest(url) {
  return (
    url.pathname.startsWith("/Memories/admin") ||
    url.pathname.startsWith("/Memories/manage/") ||
    url.pathname.startsWith("/Memories/api/") ||
    url.pathname === "/Memories/sw.js"
  );
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/Memories/assets/") ||
    /\.(?:css|js|svg|png|jpe?g|webp|ico|woff2?)$/i.test(url.pathname)
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return (
      (await cache.match(request)) ||
      (await cache.match("/Memories/")) ||
      (await cache.match(OFFLINE_URL))
    );
  }
}

async function cacheFirstStatic(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isPrivateOrDataRequest(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirstStatic(request));
  }
});
