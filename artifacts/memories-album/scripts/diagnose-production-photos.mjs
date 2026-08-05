import { writeFile } from "node:fs/promises";

const baseUrl = String(
  process.env.MEMORIES_PRODUCTION_URL ?? "https://leon-loves-yeh.com",
).replace(/\/$/u, "");
const pageLimit = 100;
const maximumPages = 100;
const samplePerGroup = 3;
const maximumThumbnailBytes = 5 * 1024 * 1024;
const requestTimeoutMs = 45_000;

function groupOf(photo) {
  if (photo?.source === "guest") return "guest";
  if (photo?.collection === "life" || photo?.albumIds?.includes?.("life")) {
    return "life";
  }
  if (
    photo?.source === "official" ||
    photo?.collection === "wedding" ||
    photo?.albumIds?.includes?.("wedding")
  ) {
    return "wedding";
  }
  return "other";
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function readBoundedBody(response) {
  if (!response.body) return { bytes: 0, truncated: false };
  const reader = response.body.getReader();
  let bytes = 0;
  let truncated = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maximumThumbnailBytes) {
        truncated = true;
        await reader.cancel("diagnostic size limit").catch(() => {});
        break;
      }
    }
  } finally {
    reader.releaseLock?.();
  }
  return { bytes, truncated };
}

async function diagnoseThumbnail(photo) {
  const url = new URL(photo.thumbnailUrl, baseUrl).href;
  const startedAt = Date.now();
  try {
    const response = await fetchWithTimeout(url, {
      headers: { Accept: "image/avif,image/webp,image/*,*/*;q=0.8" },
    });
    const body = await readBoundedBody(response);
    return {
      id: photo.id,
      group: groupOf(photo),
      collection: photo.collection ?? null,
      source: photo.source ?? null,
      width: photo.width ?? null,
      height: photo.height ?? null,
      thumbnailUrl: photo.thumbnailUrl,
      status: response.status,
      ok: response.ok,
      elapsedMs: Date.now() - startedAt,
      contentType: response.headers.get("content-type"),
      contentLength: response.headers.get("content-length"),
      cacheControl: response.headers.get("cache-control"),
      thumbnailFallback: response.headers.get("x-memories-thumbnail-fallback"),
      thumbnailCache: response.headers.get("x-memories-thumbnail-cache"),
      thumbnailDriveError: response.headers.get(
        "x-memories-thumbnail-drive-error",
      ),
      thumbnailRepaired: response.headers.get("x-memories-thumbnail-repaired"),
      downloadedBytes: body.bytes,
      truncatedAtFiveMiB: body.truncated,
    };
  } catch (error) {
    return {
      id: photo.id,
      group: groupOf(photo),
      collection: photo.collection ?? null,
      source: photo.source ?? null,
      width: photo.width ?? null,
      height: photo.height ?? null,
      thumbnailUrl: photo.thumbnailUrl,
      status: null,
      ok: false,
      elapsedMs: Date.now() - startedAt,
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    };
  }
}

const healthStartedAt = Date.now();
let health;
try {
  const response = await fetchWithTimeout(`${baseUrl}/Memories/api/health`, {
    headers: { Accept: "application/json" },
  });
  health = {
    status: response.status,
    elapsedMs: Date.now() - healthStartedAt,
    body: await response.text(),
  };
} catch (error) {
  health = {
    status: null,
    elapsedMs: Date.now() - healthStartedAt,
    error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
  };
}

const photos = [];
const pages = [];
const seenCursors = new Set();
let cursor = null;
for (let pageNumber = 1; pageNumber <= maximumPages; pageNumber += 1) {
  const query = new URLSearchParams({ limit: String(pageLimit) });
  if (cursor) query.set("cursor", cursor);
  const url = `${baseUrl}/Memories/api/photos?${query}`;
  const startedAt = Date.now();
  const response = await fetchWithTimeout(url, {
    headers: { Accept: "application/json" },
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  pages.push({
    page: pageNumber,
    status: response.status,
    elapsedMs: Date.now() - startedAt,
    count: Array.isArray(body?.photos) ? body.photos.length : null,
    nextCursor: body?.nextCursor ?? null,
    responsePrefix: body ? null : text.slice(0, 500),
  });
  if (!response.ok || !Array.isArray(body?.photos)) break;
  photos.push(...body.photos);
  const nextCursor = body.nextCursor;
  if (!nextCursor || seenCursors.has(nextCursor)) break;
  seenCursors.add(nextCursor);
  cursor = nextCursor;
}

const groups = { wedding: [], life: [], guest: [], other: [] };
for (const photo of photos) groups[groupOf(photo)].push(photo);

const samples = Object.fromEntries(
  Object.entries(groups).map(([group, items]) => [group, items.slice(0, samplePerGroup)]),
);
const thumbnailDiagnostics = [];
for (const group of ["wedding", "life", "guest", "other"]) {
  for (const photo of samples[group]) {
    thumbnailDiagnostics.push(await diagnoseThumbnail(photo));
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  health,
  pagination: {
    requestedPageLimit: pageLimit,
    pages,
    totalPhotos: photos.length,
    reachedMaximumPages: pages.length === maximumPages && Boolean(cursor),
  },
  counts: Object.fromEntries(
    Object.entries(groups).map(([group, items]) => [group, items.length]),
  ),
  dimensionCoverage: Object.fromEntries(
    Object.entries(groups).map(([group, items]) => [
      group,
      {
        total: items.length,
        withDimensions: items.filter(
          (photo) => Number(photo.width) > 0 && Number(photo.height) > 0,
        ).length,
        withoutDimensions: items.filter(
          (photo) => !(Number(photo.width) > 0 && Number(photo.height) > 0),
        ).length,
      },
    ]),
  ),
  firstPositions: Object.fromEntries(
    ["wedding", "life", "guest", "other"].map((group) => [
      group,
      photos.findIndex((photo) => groupOf(photo) === group),
    ]),
  ),
  sampleIds: Object.fromEntries(
    Object.entries(samples).map(([group, items]) => [
      group,
      items.map((photo) => photo.id),
    ]),
  ),
  thumbnailDiagnostics,
};

await writeFile("production-photo-diagnostics.json", `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

if (!health?.status || photos.length === 0) process.exitCode = 1;
