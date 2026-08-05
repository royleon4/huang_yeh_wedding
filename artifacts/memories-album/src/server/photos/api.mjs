import { Readable } from "node:stream";
import { createPublicImageCache } from "./public-image-cache.mjs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SORT_RANK_CACHE_MS = 2_000;
const GENERATED_THUMBNAIL_CONCURRENCY = 2;
const collator = new Intl.Collator(["zh-Hant", "en"], {
  numeric: true,
  sensitivity: "base",
});

function json(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

function normalizedText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

function rankPhotos(photos, valueOf) {
  return new Map(
    [...photos]
      .sort((left, right) => {
        const compared = collator.compare(valueOf(left), valueOf(right));
        return compared || String(left.id).localeCompare(String(right.id));
      })
      .map((photo, index) => [photo.id, index + 1]),
  );
}

export function toPublicPhoto(photo, sortRanks = null) {
  return {
    id: photo.id,
    thumbnailUrl: `/Memories/api/photos/${photo.id}/thumbnail`,
    mediaUrl: `/Memories/api/photos/${photo.id}/media`,
    width: photo.width ?? null,
    height: photo.height ?? null,
    source: photo.source,
    collection:
      photo.collection ?? (photo.source === "guest" ? "guest" : "wedding"),
    albumIds: [...(photo.albumIds ?? [])],
    uploaderName: photo.uploaderName ?? null,
    nameSortRank: sortRanks?.name?.get(photo.id) ?? null,
    authorSortRank: sortRanks?.author?.get(photo.id) ?? null,
    processIds: photo.processIds ?? [],
    createdAt: photo.createdAt,
  };
}

async function pipeBody(
  response,
  file,
  cacheControl = "public, max-age=3600, stale-while-revalidate=86400",
  extraHeaders = {},
) {
  response.writeHead(200, {
    "Content-Type": file.contentType,
    ...(file.contentLength ? { "Content-Length": file.contentLength } : {}),
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'",
    ...extraHeaders,
  });
  if (Buffer.isBuffer(file.body) || file.body instanceof Uint8Array) {
    response.end(file.body);
    return;
  }
  if (typeof file.body?.pipe === "function") {
    file.body.pipe(response);
    return;
  }
  if (file.body?.getReader) {
    Readable.fromWeb(file.body).pipe(response);
    return;
  }
  throw new Error("Unsupported file body");
}

function thumbnailFailure(response, error) {
  const retryableCodes = new Set([
    "DRIVE_AUTHORIZATION_REQUIRED",
    "DRIVE_RETRYABLE",
    "DRIVE_REQUEST_FAILED",
    "THUMBNAIL_FOLDER_NOT_CONFIGURED",
  ]);
  const code = retryableCodes.has(error?.code)
    ? error.code
    : "THUMBNAIL_NOT_READY";
  json(response, 503, {
    error: "The compressed thumbnail is not ready. Please retry shortly.",
    code,
  });
}

function canGenerateThumbnailFallback(error) {
  return (
    error?.status === 404 ||
    error?.code === "DRIVE_AUTHORIZATION_REQUIRED" ||
    error?.code === "DRIVE_REQUEST_FAILED" ||
    error?.code === "DRIVE_RETRYABLE"
  );
}

async function bodyToBuffer(body) {
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);

  if (body?.getReader) {
    const reader = body.getReader();
    const chunks = [];
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(Buffer.from(value));
      }
    } finally {
      reader.releaseLock?.();
    }
    return Buffer.concat(chunks);
  }

  if (body?.[Symbol.asyncIterator]) {
    const chunks = [];
    for await (const chunk of body) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  }

  throw new Error("Unsupported Google Drive response body");
}

function createConcurrencyGate(maxConcurrent) {
  const limit = Math.max(1, Number(maxConcurrent) || 1);
  let active = 0;
  const waiters = [];

  return async function run(operation) {
    if (active >= limit) {
      await new Promise((resolve) => waiters.push(resolve));
    }
    active += 1;
    try {
      return await operation();
    } finally {
      active -= 1;
      waiters.shift()?.();
    }
  };
}

async function generateTransientThumbnail({
  photo,
  drive,
  thumbnailService,
  runGeneration,
}) {
  if (!thumbnailService?.imageProcessor) {
    const error = new Error("Thumbnail image processor is unavailable");
    error.code = "THUMBNAIL_NOT_READY";
    throw error;
  }

  return runGeneration(async () => {
    const original = await drive.download(photo.driveFileId);
    const originalBytes = await bodyToBuffer(original.body);
    const generated = await thumbnailService.imageProcessor.createThumbnail({
      bytes: originalBytes,
      mimeType: photo.mimeType || original.contentType,
    });
    const body = Buffer.from(generated.thumbnailBytes);
    return {
      body,
      contentType: generated.thumbnailContentType,
      contentLength: body.length,
      thumbnailSource: "generated",
    };
  });
}

function thumbnailCacheKey(photo) {
  if (photo.thumbnailDriveFileId) {
    return `drive:${photo.thumbnailDriveFileId}`;
  }
  return `generated:${photo.driveFileId}:${photo.contentVersion ?? 1}`;
}

async function serveThumbnail({
  response,
  photo,
  drive,
  thumbnailService,
  thumbnailCache,
  runGeneration,
}) {
  let lastError = null;

  try {
    const cached = await thumbnailCache.load(thumbnailCacheKey(photo), async () => {
      if (photo.thumbnailDriveFileId) {
        try {
          return {
            ...(await drive.download(photo.thumbnailDriveFileId)),
            thumbnailSource: "drive",
          };
        } catch (error) {
          lastError = error;
          if (!canGenerateThumbnailFallback(error)) throw error;
        }
      }

      return generateTransientThumbnail({
        photo,
        drive,
        thumbnailService,
        runGeneration,
      });
    });

    const generated = cached.file?.thumbnailSource === "generated";
    await pipeBody(
      response,
      cached.file,
      generated
        ? "public, max-age=3600, stale-while-revalidate=86400"
        : "public, max-age=31536000, immutable",
      {
        "X-Memories-Thumbnail-Cache": cached.status,
        ...(generated
          ? {
              "X-Memories-Thumbnail-Fallback": "generated",
              ...(lastError?.code
                ? { "X-Memories-Thumbnail-Drive-Error": lastError.code }
                : {}),
            }
          : {}),
      },
    );
    return true;
  } catch (error) {
    lastError = error;
  }

  // The image processor may be unavailable in a degraded environment. Preserve
  // the legacy final fallback for that case only. Normal production requests
  // return a generated WebP and never send a 25–30 MB original into the grid.
  try {
    await pipeBody(
      response,
      await drive.download(photo.driveFileId),
      "no-store",
      { "X-Memories-Thumbnail-Fallback": "original" },
    );
    return true;
  } catch {
    thumbnailFailure(response, lastError);
    return true;
  }
}

export function createMemoriesPhotoApi({
  repository,
  drive,
  thumbnailService = null,
  thumbnailCache = createPublicImageCache(),
}) {
  if (!repository || !drive) {
    throw new Error("Photo repository and Drive storage are required");
  }
  if (!thumbnailCache || typeof thumbnailCache.load !== "function") {
    throw new Error("A public thumbnail cache is required");
  }

  const runThumbnailGeneration = createConcurrencyGate(
    GENERATED_THUMBNAIL_CONCURRENCY,
  );
  let sortRankCache = null;
  const loadSortRanks = async () => {
    const now = Date.now();
    if (sortRankCache && sortRankCache.expiresAt > now) {
      return sortRankCache.ranks;
    }

    const photos = [];
    const seenCursors = new Set();
    let cursor = null;
    let pages = 0;
    do {
      const page = await repository.listPublicPhotos({ cursor, limit: 100 });
      photos.push(...page.items);
      const nextCursor = page.nextCursor ?? null;
      if (!nextCursor || seenCursors.has(nextCursor)) {
        cursor = null;
      } else {
        seenCursors.add(nextCursor);
        cursor = nextCursor;
      }
      pages += 1;
    } while (cursor && pages < 100);

    const ranks = {
      name: rankPhotos(photos, (photo) =>
        normalizedText(photo.displayName || photo.originalFilename),
      ),
      author: rankPhotos(photos, (photo) => normalizedText(photo.uploaderName)),
    };
    sortRankCache = { ranks, expiresAt: now + SORT_RANK_CACHE_MS };
    return ranks;
  };

  return async function handlePhotoApi(
    request,
    response,
    url = new URL(request.url ?? "/", "http://localhost"),
  ) {
    if (request.method === "GET" && url.pathname === "/Memories/api/photos") {
      try {
        const collection = url.searchParams.get("collection");
        const albumId = url.searchParams.get("albumId");
        const includeSortRanks = url.searchParams.get("includeSortRanks") === "1";
        if (
          collection &&
          !new Set(["wedding", "guest", "life"]).has(collection)
        ) {
          json(response, 400, {
            error: "Invalid collection",
            code: "INVALID_COLLECTION",
          });
          return true;
        }
        const pagePromise = repository.listPublicPhotos({
          cursor: url.searchParams.get("cursor"),
          limit: Number(url.searchParams.get("limit") ?? 24),
          processId: url.searchParams.get("process"),
          source: url.searchParams.get("source"),
          collection,
          albumId,
        });
        const [page, sortRanks] = await Promise.all([
          pagePromise,
          includeSortRanks ? loadSortRanks() : Promise.resolve(null),
        ]);
        json(response, 200, {
          photos: page.items.map((photo) => toPublicPhoto(photo, sortRanks)),
          nextCursor: page.nextCursor,
        });
      } catch (error) {
        if (error?.code === "INVALID_CURSOR") {
          json(response, 400, { error: "Invalid cursor" });
        } else {
          throw error;
        }
      }
      return true;
    }

    const mediaMatch = url.pathname.match(
      /^\/Memories\/api\/photos\/([^/]+)\/(thumbnail|media)$/,
    );
    if (request.method === "GET" && mediaMatch) {
      const [, id, variant] = mediaMatch;
      if (!UUID_PATTERN.test(id)) {
        json(response, 404, { error: "Not found" });
        return true;
      }
      const photo = await repository.findPublicPhoto(id);
      if (!photo) {
        json(response, 404, { error: "Not found" });
        return true;
      }

      if (variant === "thumbnail") {
        return serveThumbnail({
          response,
          photo,
          drive,
          thumbnailService,
          thumbnailCache,
          runGeneration: runThumbnailGeneration,
        });
      }

      if (!photo.driveFileId) {
        json(response, 503, {
          error: "The requested image is not ready.",
          code: "ORIGINAL_NOT_READY",
        });
        return true;
      }

      try {
        await pipeBody(
          response,
          await drive.download(photo.driveFileId),
          "public, max-age=3600, stale-while-revalidate=86400",
        );
      } catch (error) {
        if (error?.status === 404) {
          json(response, 404, { error: "Not found" });
        } else {
          throw error;
        }
      }
      return true;
    }

    return false;
  };
}
