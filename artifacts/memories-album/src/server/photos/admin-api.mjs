import { createHash, randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { sendAdminJson } from "../admin/auth.mjs";
import { readAdminJson, requireAdmin } from "../admin/request.mjs";
import { parsePhotoMultipart, UploadApiError } from "../uploads/api.mjs";
import { ImageValidationError } from "../uploads/image-processor.mjs";

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const ALLOWED_VISIBILITY = new Set(["public", "hidden"]);

function normalizeText(value, maxCharacters, { required = false } = {}) {
  const text = String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
  if ((required && !text) || Array.from(text).length > maxCharacters) {
    const error = new Error(
      required
        ? `A value is required and must be ${maxCharacters} characters or fewer`
        : `The value must be ${maxCharacters} characters or fewer`,
    );
    error.status = 422;
    error.code = "INVALID_PHOTO";
    throw error;
  }
  return text;
}

function capturedAt(value, fallback) {
  const raw = value ?? fallback;
  const timestamp = new Date(raw);
  if (!raw || !Number.isFinite(timestamp.getTime())) {
    const error = new Error("capturedAt must be a valid date");
    error.status = 422;
    error.code = "INVALID_CAPTURED_AT";
    throw error;
  }
  return timestamp.toISOString();
}

function stringIds(value, field) {
  if (!Array.isArray(value)) {
    const error = new Error(`${field} must be an array`);
    error.status = 422;
    error.code = "INVALID_PHOTO_CLASSIFICATION";
    throw error;
  }
  const ids = [...new Set(value.map((item) => String(item).trim()))].filter(
    Boolean,
  );
  if (ids.length !== value.length) {
    const error = new Error(`${field} contains an empty or duplicate value`);
    error.status = 422;
    error.code = "INVALID_PHOTO_CLASSIFICATION";
    throw error;
  }
  return ids;
}

async function validatedMetadata(
  body,
  { albumRepository, categoryRepository, existing = null, now },
) {
  const albumIds = stringIds(
    body.albumIds ?? existing?.albumIds ?? [],
    "albumIds",
  );
  if (albumIds.length === 0) {
    const error = new Error("At least one album is required");
    error.status = 422;
    error.code = "ALBUM_REQUIRED";
    throw error;
  }
  const albums = await albumRepository.listAdminAlbums();
  if (albumIds.some((id) => !albums.some((album) => album.id === id))) {
    const error = new Error("An assigned album does not exist");
    error.status = 422;
    error.code = "INVALID_ALBUM";
    throw error;
  }

  const categoryIds = stringIds(
    body.categoryIds ?? existing?.processIds ?? [],
    "categoryIds",
  );
  if (categoryIds.length > 1) {
    const error = new Error("A photo can belong to at most one Drive category");
    error.status = 422;
    error.code = "INVALID_CATEGORY";
    throw error;
  }
  const categories = await categoryRepository.listProcesses();
  if (
    categoryIds.some((id) => !categories.some((category) => category.id === id))
  ) {
    const error = new Error("An assigned category does not exist");
    error.status = 422;
    error.code = "INVALID_CATEGORY";
    throw error;
  }

  const visibility = body.visibility ?? existing?.visibility ?? "public";
  if (!ALLOWED_VISIBILITY.has(visibility)) {
    const error = new Error("visibility must be public or hidden");
    error.status = 422;
    error.code = "INVALID_VISIBILITY";
    throw error;
  }

  return {
    displayName: normalizeText(
      body.displayName ?? existing?.displayName ?? existing?.originalFilename,
      160,
      { required: true },
    ),
    albumIds,
    categoryIds,
    visibility,
    capturedAt: capturedAt(
      body.capturedAt,
      existing?.createdAt ?? now().toISOString(),
    ),
    category: categoryIds.length
      ? categories.find((category) => category.id === categoryIds[0])
      : null,
  };
}

function safeFilenamePart(filename) {
  const base = String(filename || "photo")
    .replace(/\.[^.]+$/, "")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "photo";
}

function photoPayload(photo) {
  return {
    id: photo.id,
    displayName: photo.displayName ?? photo.originalFilename,
    originalFilename: photo.originalFilename,
    source: photo.source,
    visibility: photo.visibility,
    albumIds: [...(photo.albumIds ?? [])],
    categoryIds: [...(photo.processIds ?? [])],
    capturedAt: photo.createdAt,
    width: photo.width ?? null,
    height: photo.height ?? null,
    thumbnailUrl: `/admin/api/photos/${photo.id}/thumbnail`,
  };
}

function sendPrivateImage(response, file) {
  response.writeHead(200, {
    "Content-Type": file.contentType ?? "application/octet-stream",
    ...(file.contentLength ? { "Content-Length": file.contentLength } : {}),
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'",
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

function parseMetadata(value) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    const error = new Error("metadata must be valid JSON");
    error.status = 400;
    error.code = "INVALID_JSON";
    throw error;
  }
}

async function removeUploadedFiles(drive, fileIds) {
  for (const fileId of fileIds.filter(Boolean).reverse()) {
    try {
      await drive.delete(fileId);
    } catch {
      // The failed request remains safe to retry; cleanup is best effort.
    }
  }
}

export function createAdminPhotoApi({
  repository,
  albumRepository,
  categoryRepository,
  drive,
  imageProcessor,
  synchronizer,
  adminToken,
  createId = randomUUID,
  now = () => new Date(),
}) {
  if (
    !repository ||
    !albumRepository ||
    !categoryRepository ||
    !drive ||
    !imageProcessor ||
    !synchronizer
  ) {
    throw new Error(
      "Photo, album, category, Drive, image, and synchronization services are required",
    );
  }

  return async function handleAdminPhotoApi(
    request,
    response,
    url = new URL(request.url ?? "/", "http://localhost"),
  ) {
    const collectionPath = url.pathname === "/admin/api/photos";
    const thumbnailMatch = url.pathname.match(
      /^\/admin\/api\/photos\/([^/]+)\/thumbnail$/,
    );
    const itemMatch = url.pathname.match(/^\/admin\/api\/photos\/([^/]+)$/);
    if (!collectionPath && !itemMatch && !thumbnailMatch) return false;

    try {
      if (
        !requireAdmin(request, response, adminToken, {
          mutate: request.method !== "GET",
        })
      ) {
        return true;
      }

      if (request.method === "GET" && collectionPath) {
        const page = await repository.listAdminPhotos({
          cursor: url.searchParams.get("cursor"),
          limit: url.searchParams.get("limit") ?? 50,
        });
        sendAdminJson(response, 200, {
          photos: page.items.map(photoPayload),
          nextCursor: page.nextCursor,
        });
        return true;
      }

      if (request.method === "GET" && thumbnailMatch) {
        const id = decodeURIComponent(thumbnailMatch[1]);
        const photo = await repository.findPhotoForAdmin(id);
        if (!photo) {
          sendAdminJson(response, 404, {
            error: "Photo not found",
            code: "NOT_FOUND",
          });
          return true;
        }
        const fileId = photo.thumbnailDriveFileId ?? photo.driveFileId;
        if (!fileId) {
          sendAdminJson(response, 503, {
            error: "Photo preview is unavailable",
            code: "PREVIEW_NOT_READY",
          });
          return true;
        }
        try {
          sendPrivateImage(response, await drive.download(fileId));
        } catch (error) {
          if (Number(error?.status) === 404) {
            sendAdminJson(response, 404, {
              error: "Photo preview was not found",
              code: "NOT_FOUND",
            });
          } else {
            throw error;
          }
        }
        return true;
      }

      if (request.method === "POST" && collectionPath) {
        const { file, fields } = await parsePhotoMultipart(request, {
          maxFileBytes: MAX_FILE_BYTES,
          allowedFields: ["metadata"],
        });
        const metadata = await validatedMetadata(
          parseMetadata(fields.metadata),
          {
            albumRepository,
            categoryRepository,
            now,
          },
        );
        const processed = await imageProcessor.process(file);
        const id = createId();
        const key = id.replace(/-/g, "");
        const originalFilename = `admin-${key}-${safeFilenamePart(
          file.filename,
        )}.${processed.originalExtension}`;
        const thumbnailFilename = `admin-${key}.webp`;
        const parentId =
          metadata.category?.driveFolderId ??
          (metadata.albumIds.includes("life")
            ? drive.lifeFolderId
            : drive.unclassifiedFolderId) ??
          drive.originalFolderId;
        const uploaded = [];

        try {
          const original = await drive.uploadOriginal({
            bytes: processed.originalBytes,
            filename: originalFilename,
            contentType: processed.originalContentType,
            parentId,
            appProperties: { photoId: id, uploader: "admin" },
          });
          if (!original.reused) uploaded.push(original.fileId);
          const thumbnail = await drive.uploadThumbnail({
            bytes: processed.thumbnailBytes,
            filename: thumbnailFilename,
            contentType: processed.thumbnailContentType,
            appProperties: { photoId: id, uploader: "admin" },
          });
          if (!thumbnail.reused) uploaded.push(thumbnail.fileId);

          const collection = metadata.albumIds.includes("life")
            ? "life"
            : metadata.albumIds.includes("guest")
              ? "guest"
              : "wedding";
          const photo = await repository.insertPhoto({
            id,
            batchId: null,
            driveFileId: original.fileId,
            thumbnailDriveFileId: thumbnail.fileId,
            driveParentFolderId: parentId,
            originalFilename,
            displayName: metadata.displayName,
            mimeType: processed.originalContentType,
            byteSize: processed.originalBytes.length,
            width: processed.width,
            height: processed.height,
            contentHash: createHash("sha256").update(file.bytes).digest("hex"),
            contentVersion: 1,
            source: "official",
            uploaderName: "管理員",
            collection,
            visibility: metadata.visibility,
            processingState: "ready",
            albumIds: metadata.albumIds,
            processIds: metadata.categoryIds,
            capturedAtOverridden: true,
            albumMembershipsOverridden: true,
            createdAt: metadata.capturedAt,
            updatedAt: now().toISOString(),
          });
          sendAdminJson(response, 201, { photo: photoPayload(photo) });
          return true;
        } catch (error) {
          await removeUploadedFiles(drive, uploaded);
          throw error;
        }
      }

      if (request.method === "PATCH" && itemMatch) {
        const id = decodeURIComponent(itemMatch[1]);
        const existing = await repository.findPhotoForAdmin(id);
        if (!existing) {
          sendAdminJson(response, 404, {
            error: "Photo not found",
            code: "NOT_FOUND",
          });
          return true;
        }
        const body = await readAdminJson(request);
        const metadata = await validatedMetadata(body, {
          albumRepository,
          categoryRepository,
          existing,
          now,
        });

        if (
          existing.source === "official" &&
          (String(existing.processIds?.[0] ?? "") !==
            String(metadata.categoryIds[0] ?? "") ||
            (existing.albumIds ?? []).includes("life") !==
              metadata.albumIds.includes("life"))
        ) {
          if (metadata.categoryIds[0] || !metadata.albumIds.includes("life")) {
            await synchronizer.movePhotoToProcess({
              driveFileId: existing.driveFileId,
              fromParentId: existing.driveParentFolderId,
              processId: metadata.categoryIds[0] ?? null,
            });
          } else {
            if (!drive.lifeFolderId) {
              const error = new Error("Life photo folder is unavailable");
              error.status = 503;
              error.code = "LIFE_FOLDER_UNAVAILABLE";
              throw error;
            }
            await drive.move(existing.driveFileId, {
              fromParentId: existing.driveParentFolderId,
              toParentId: drive.lifeFolderId,
            });
            await repository.replacePhotoProcessByDriveFile(
              existing.driveFileId,
              null,
              drive.lifeFolderId,
              "life",
            );
          }
        }

        const photo = await repository.updatePhotoForAdmin({
          id,
          displayName: metadata.displayName,
          visibility: metadata.visibility,
          createdAt: metadata.capturedAt,
          albumIds: metadata.albumIds,
          processIds: metadata.categoryIds,
        });
        sendAdminJson(response, 200, { photo: photoPayload(photo) });
        return true;
      }

      sendAdminJson(response, 405, {
        error: "Method not allowed",
        code: "METHOD_NOT_ALLOWED",
      });
      return true;
    } catch (error) {
      if (
        error instanceof UploadApiError ||
        error instanceof ImageValidationError
      ) {
        sendAdminJson(response, error.status ?? 422, {
          error: error.message,
          code: error.code,
        });
        return true;
      }
      if (error?.status && error?.code) {
        sendAdminJson(response, error.status, {
          error: error.message,
          code: error.code,
        });
        return true;
      }
      if (error?.code === "DUPLICATE_PHOTO") {
        sendAdminJson(response, 409, {
          error: "This photo already exists",
          code: "DUPLICATE_PHOTO",
        });
        return true;
      }
      throw error;
    }
  };
}
