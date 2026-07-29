import { Readable } from "node:stream";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

export function toPublicPhoto(photo) {
  const version = encodeURIComponent(photo.contentVersion ?? 1);
  const thumbnailBase = `/Memories/api/photos/${photo.id}/thumbnail?v=${version}`;
  return {
    id: photo.id,
    thumbnailUrl: `${thumbnailBase}&width=960`,
    thumbnailSrcSet: `${thumbnailBase}&width=480 480w, ${thumbnailBase}&width=960 960w`,
    mediaUrl: `/Memories/api/photos/${photo.id}/media?v=${version}`,
    width: photo.width ?? null,
    height: photo.height ?? null,
    source: photo.source,
    collection:
      photo.collection ?? (photo.source === "guest" ? "guest" : "wedding"),
    uploaderName:
      photo.source === "guest" ? null : (photo.uploaderName ?? null),
    processIds: photo.processIds ?? [],
    createdAt: photo.createdAt,
  };
}

async function pipeBody(
  response,
  file,
  cacheControl = "private, no-store",
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

function shouldRepairThumbnail(error) {
  return (
    error?.status === 404 ||
    error?.code === "DRIVE_AUTHORIZATION_REQUIRED" ||
    error?.code === "DRIVE_REQUEST_FAILED" ||
    error?.code === "DRIVE_RETRYABLE"
  );
}

async function serveThumbnail({
  response,
  photo,
  drive,
  thumbnailService,
  publicMediaService,
  width = null,
}) {
  let current = photo;
  let lastError = null;

  try {
    if (!current.thumbnailDriveFileId) {
      if (!thumbnailService) {
        const error = new Error("Thumbnail service is unavailable");
        error.code = "THUMBNAIL_NOT_READY";
        throw error;
      }
      current = await thumbnailService.ensurePhotoThumbnail(current);
    }
    if (width && thumbnailService?.createResponsiveVariant) {
      await pipeBody(
        response,
        await thumbnailService.createResponsiveVariant(current, width),
        "private, no-store",
      );
      return true;
    }
    await pipeBody(
      response,
      await drive.download(current.thumbnailDriveFileId),
      "private, no-store",
    );
    return true;
  } catch (error) {
    lastError = error;
  }

  if (thumbnailService && shouldRepairThumbnail(lastError)) {
    try {
      current = await thumbnailService.repairPhotoThumbnail(current);
      await pipeBody(
        response,
        await drive.download(current.thumbnailDriveFileId),
        "private, no-store",
        { "X-Memories-Thumbnail-Repaired": "1" },
      );
      return true;
    } catch (error) {
      lastError = error;
    }
  }

  // A broken derivative must not leave a permanent blank card. Serve the original
  // for this request only; because it is not cached, the next request tries the
  // repair path again and persists a real WebP thumbnail when Drive is available.
  try {
    await pipeBody(
      response,
      publicMediaService
        ? await publicMediaService.getSanitizedMedia(photo)
        : await drive.download(photo.driveFileId),
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
  publicMediaService = null,
}) {
  if (!repository || !drive) {
    throw new Error("Photo repository and Drive storage are required");
  }

  return async function handlePhotoApi(
    request,
    response,
    url = new URL(request.url ?? "/", "http://localhost"),
  ) {
    if (request.method === "GET" && url.pathname === "/Memories/api/photos") {
      try {
        const collection = url.searchParams.get("collection");
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
        const page = await repository.listPublicPhotos({
          cursor: url.searchParams.get("cursor"),
          limit: Number(url.searchParams.get("limit") ?? 24),
          processId: url.searchParams.get("process"),
          source: url.searchParams.get("source"),
          collection,
        });
        json(response, 200, {
          photos: page.items.map(toPublicPhoto),
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
        const widthParameter = url.searchParams.get("width");
        const width = widthParameter ? Number(widthParameter) : null;
        if (widthParameter && !new Set([480, 960]).has(width)) {
          json(response, 400, {
            error: "Invalid thumbnail width",
            code: "INVALID_THUMBNAIL_WIDTH",
          });
          return true;
        }
        return serveThumbnail({
          response,
          photo,
          drive,
          thumbnailService,
          publicMediaService,
          width,
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
        if (publicMediaService) {
          await pipeBody(
            response,
            await publicMediaService.getSanitizedMedia(photo),
            "private, no-store",
          );
          return true;
        }
        await pipeBody(
          response,
          await drive.download(photo.driveFileId),
          "private, no-store",
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
