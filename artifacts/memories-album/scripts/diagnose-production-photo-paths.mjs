import { writeFile } from "node:fs/promises";

const baseUrl = String(
  process.env.MEMORIES_PRODUCTION_URL ?? "https://leon-loves-yeh.com",
).replace(/\/$/u, "");
const timeoutMs = 45_000;
const maximumReadBytes = 1024 * 1024;

function groupOf(photo) {
  if (photo?.source === "guest") return "guest";
  if (photo?.collection === "life" || photo?.albumIds?.includes?.("life")) {
    return "life";
  }
  return "wedding";
}

async function request(url, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal,
    });
    const contentType = response.headers.get("content-type") ?? "";
    let bytes = 0;
    let truncated = false;
    let text = null;
    if (response.body) {
      const reader = response.body.getReader();
      const chunks = [];
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (contentType.includes("json") || contentType.startsWith("text/")) {
            chunks.push(Buffer.from(value));
          }
          if (bytes >= maximumReadBytes) {
            truncated = true;
            await reader.cancel("diagnostic limit").catch(() => {});
            break;
          }
        }
      } finally {
        reader.releaseLock?.();
      }
      if (chunks.length > 0) {
        text = Buffer.concat(chunks).toString("utf8").slice(0, 2000);
      }
    }
    return {
      status: response.status,
      ok: response.ok,
      elapsedMs: Date.now() - startedAt,
      contentType,
      contentLength: response.headers.get("content-length"),
      contentRange: response.headers.get("content-range"),
      acceptRanges: response.headers.get("accept-ranges"),
      cacheControl: response.headers.get("cache-control"),
      thumbnailFallback: response.headers.get("x-memories-thumbnail-fallback"),
      thumbnailCache: response.headers.get("x-memories-thumbnail-cache"),
      thumbnailDriveError: response.headers.get(
        "x-memories-thumbnail-drive-error",
      ),
      thumbnailRepaired: response.headers.get("x-memories-thumbnail-repaired"),
      bytesRead: bytes,
      truncated,
      bodyText: text,
    };
  } catch (error) {
    return {
      status: null,
      ok: false,
      elapsedMs: Date.now() - startedAt,
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

const pageResponse = await fetch(`${baseUrl}/Memories/api/photos?limit=100`, {
  headers: { Accept: "application/json" },
});
if (!pageResponse.ok) {
  throw new Error(`Photo page failed with status ${pageResponse.status}`);
}
const page = await pageResponse.json();
const photos = Array.isArray(page.photos) ? page.photos : [];
const wedding = photos.filter((photo) => groupOf(photo) === "wedding").slice(0, 3);
const guest = photos.filter((photo) => groupOf(photo) === "guest").slice(0, 3);

const results = [];
for (const photo of [...wedding, ...guest]) {
  const common = {
    id: photo.id,
    group: groupOf(photo),
    source: photo.source ?? null,
    collection: photo.collection ?? null,
    width: photo.width ?? null,
    height: photo.height ?? null,
  };
  results.push({
    ...common,
    variant: "thumbnail",
    ...(await request(new URL(photo.thumbnailUrl, baseUrl).href, {
      Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
    })),
  });
  results.push({
    ...common,
    variant: "media",
    ...(await request(new URL(photo.mediaUrl, baseUrl).href, {
      Accept: "image/*,*/*;q=0.8",
      Range: "bytes=0-1048575",
    })),
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  sampled: { wedding: wedding.length, guest: guest.length },
  results,
};

await writeFile(
  "production-photo-path-diagnostics.json",
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify(report, null, 2));
