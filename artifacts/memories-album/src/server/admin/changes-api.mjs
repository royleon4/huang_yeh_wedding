import { randomUUID } from "node:crypto";
import { sendAdminJson } from "./auth.mjs";
import { readAdminJson, requireAdmin } from "./request.mjs";

const ALLOWED_VISIBILITY = new Set(["public", "hidden"]);
const MAX_OPERATIONS = 500;

function apiError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function normalizeText(value, maxCharacters, { required = false, code } = {}) {
  const normalized = String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
  if (
    (required && !normalized) ||
    Array.from(normalized).length > maxCharacters
  ) {
    throw apiError(
      required
        ? `A value is required and must be ${maxCharacters} characters or fewer`
        : `The value must be ${maxCharacters} characters or fewer`,
      422,
      code,
    );
  }
  return normalized;
}

function normalizeId(value, field = "id") {
  const id = String(value ?? "").trim();
  if (!id || id.length > 160) {
    throw apiError(`${field} is required`, 422, "INVALID_ADMIN_CHANGES");
  }
  return id;
}

function arrayField(value, field, { fallback = [] } = {}) {
  const source = value === undefined ? fallback : value;
  if (!Array.isArray(source)) {
    throw apiError(`${field} must be an array`, 422, "INVALID_ADMIN_CHANGES");
  }
  const ids = source.map((item) => String(item).trim()).filter(Boolean);
  if (ids.length !== source.length || new Set(ids).size !== ids.length) {
    throw apiError(
      `${field} contains an empty or duplicate value`,
      422,
      "INVALID_ADMIN_CHANGES",
    );
  }
  return ids;
}

function operationArray(value, field) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw apiError(`${field} must be an array`, 422, "INVALID_ADMIN_CHANGES");
  }
  return value;
}

function albumPayload(album) {
  return {
    id: album.id,
    titleZh: album.titleZh,
    titleEn: album.titleEn,
    descriptionZh: album.descriptionZh,
    descriptionEn: album.descriptionEn,
    displayOrder: album.displayOrder,
    isVisible: album.isVisible,
    isSystem: album.isSystem,
  };
}

function categoryPayload(category) {
  return {
    id: category.id,
    labelZh: category.labelZh,
    labelEn: category.labelEn,
    displayOrder: category.displayOrder,
    syncState: category.syncState,
    lastSyncedAt: category.lastSyncedAt,
  };
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

function albumInput(changes, existing = null) {
  return {
    titleZh: normalizeText(changes.titleZh ?? existing?.titleZh, 80, {
      required: true,
      code: "INVALID_ALBUM",
    }),
    titleEn: normalizeText(changes.titleEn ?? existing?.titleEn, 80, {
      code: "INVALID_ALBUM",
    }),
    descriptionZh: normalizeText(
      changes.descriptionZh ?? existing?.descriptionZh,
      500,
      { code: "INVALID_ALBUM" },
    ),
    descriptionEn: normalizeText(
      changes.descriptionEn ?? existing?.descriptionEn,
      500,
      { code: "INVALID_ALBUM" },
    ),
    isVisible:
      typeof changes.isVisible === "boolean"
        ? changes.isVisible
        : existing?.isVisible !== false,
  };
}

function categoryInput(changes, existing = null) {
  return {
    labelZh: normalizeText(changes.labelZh ?? existing?.labelZh, 80, {
      required: true,
      code: "INVALID_CATEGORY",
    }),
    labelEn: normalizeText(changes.labelEn ?? existing?.labelEn, 80, {
      code: "INVALID_CATEGORY",
    }),
  };
}

function capturedAt(value, fallback) {
  const raw = value ?? fallback;
  const date = new Date(raw);
  if (!raw || !Number.isFinite(date.getTime())) {
    throw apiError(
      "capturedAt must be a valid date",
      422,
      "INVALID_CAPTURED_AT",
    );
  }
  return date.toISOString();
}

async function photoInput(
  changes,
  existing,
  { albumRepository, categoryRepository },
) {
  const albumIds = arrayField(changes.albumIds, "albumIds", {
    fallback: existing.albumIds ?? [],
  });
  if (albumIds.length === 0) {
    throw apiError("At least one album is required", 422, "ALBUM_REQUIRED");
  }
  const albums = await albumRepository.listAdminAlbums();
  const albumSet = new Set(albums.map((album) => album.id));
  if (albumIds.some((id) => !albumSet.has(id))) {
    throw apiError("An assigned album does not exist", 422, "INVALID_ALBUM");
  }

  const categoryIds = arrayField(changes.categoryIds, "categoryIds", {
    fallback: existing.processIds ?? [],
  });
  if (categoryIds.length > 1) {
    throw apiError(
      "A photo can belong to at most one Drive category",
      422,
      "INVALID_CATEGORY",
    );
  }
  const categories = await categoryRepository.listProcesses();
  const categorySet = new Set(categories.map((category) => category.id));
  if (categoryIds.some((id) => !categorySet.has(id))) {
    throw apiError(
      "An assigned category does not exist",
      422,
      "INVALID_CATEGORY",
    );
  }

  const visibility = changes.visibility ?? existing.visibility ?? "public";
  if (!ALLOWED_VISIBILITY.has(visibility)) {
    throw apiError(
      "visibility must be public or hidden",
      422,
      "INVALID_VISIBILITY",
    );
  }

  return {
    displayName: normalizeText(
      changes.displayName ?? existing.displayName ?? existing.originalFilename,
      160,
      { required: true, code: "INVALID_PHOTO" },
    ),
    visibility,
    albumIds,
    categoryIds,
    capturedAt: capturedAt(changes.capturedAt, existing.createdAt),
  };
}

function operationFailure(key, type, id, error) {
  return {
    key,
    type,
    ...(id ? { id } : {}),
    status: "error",
    error: error?.message || "Operation failed",
    code: error?.code || "ADMIN_CHANGE_FAILED",
  };
}

function operationSuccess(key, type, id, extra = {}) {
  return { key, type, ...(id ? { id } : {}), status: "ok", ...extra };
}

function validateTopLevel(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw apiError(
      "A JSON change set is required",
      422,
      "INVALID_ADMIN_CHANGES",
    );
  }
  const albums = body.albums ?? {};
  const categories = body.categories ?? {};
  const photos = body.photos ?? {};
  for (const [name, value] of Object.entries({ albums, categories, photos })) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw apiError(`${name} must be an object`, 422, "INVALID_ADMIN_CHANGES");
    }
  }

  const normalized = {
    albums: {
      create: operationArray(albums.create, "albums.create"),
      update: operationArray(albums.update, "albums.update"),
    },
    categories: {
      create: operationArray(categories.create, "categories.create"),
      update: operationArray(categories.update, "categories.update"),
      reorder:
        categories.reorder === undefined
          ? null
          : arrayField(categories.reorder, "categories.reorder"),
    },
    photos: {
      update: operationArray(photos.update, "photos.update"),
    },
  };

  const total =
    normalized.albums.create.length +
    normalized.albums.update.length +
    normalized.categories.create.length +
    normalized.categories.update.length +
    (normalized.categories.reorder ? 1 : 0) +
    normalized.photos.update.length;
  if (total === 0 || total > MAX_OPERATIONS) {
    throw apiError(
      `The change set must contain between 1 and ${MAX_OPERATIONS} operations`,
      422,
      "INVALID_ADMIN_CHANGES",
    );
  }
  return normalized;
}

function assertUniqueOperations(batch) {
  const keys = [];
  for (const item of batch.albums.create) {
    keys.push(`album:create:${normalizeId(item.clientId, "clientId")}`);
  }
  for (const item of batch.albums.update) {
    keys.push(`album:update:${normalizeId(item.id)}`);
  }
  for (const item of batch.categories.create) {
    keys.push(`category:create:${normalizeId(item.clientId, "clientId")}`);
  }
  for (const item of batch.categories.update) {
    keys.push(`category:update:${normalizeId(item.id)}`);
  }
  for (const item of batch.photos.update) {
    keys.push(`photo:update:${normalizeId(item.id)}`);
  }
  if (new Set(keys).size !== keys.length) {
    throw apiError(
      "The change set contains duplicate operations",
      422,
      "INVALID_ADMIN_CHANGES",
    );
  }
}

async function applyPhotoUpdate({
  item,
  photoRepository,
  albumRepository,
  categoryRepository,
  synchronizer,
  drive,
}) {
  const id = normalizeId(item.id);
  const existing = await photoRepository.findPhotoForAdmin(id);
  if (!existing) throw apiError("Photo not found", 404, "NOT_FOUND");
  const changes =
    item.changes && typeof item.changes === "object" ? item.changes : {};
  const metadata = await photoInput(changes, existing, {
    albumRepository,
    categoryRepository,
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
        throw apiError(
          "Life photo folder is unavailable",
          503,
          "LIFE_FOLDER_UNAVAILABLE",
        );
      }
      await drive.move(existing.driveFileId, {
        fromParentId: existing.driveParentFolderId,
        toParentId: drive.lifeFolderId,
      });
      await photoRepository.replacePhotoProcessByDriveFile(
        existing.driveFileId,
        null,
        drive.lifeFolderId,
        "life",
      );
    }
  }

  const saved = await photoRepository.updatePhotoForAdmin({
    id,
    displayName: metadata.displayName,
    visibility: metadata.visibility,
    createdAt: metadata.capturedAt,
    albumIds: metadata.albumIds,
    processIds: metadata.categoryIds,
  });
  if (!saved) throw apiError("Photo not found", 404, "NOT_FOUND");
  return saved;
}

export function createAdminChangesApi({
  albumRepository,
  categoryRepository,
  photoRepository,
  synchronizer,
  drive,
  adminToken,
  createId = randomUUID,
}) {
  if (
    !albumRepository ||
    !categoryRepository ||
    !photoRepository ||
    !synchronizer ||
    !drive
  ) {
    throw new Error(
      "Album, category, photo, synchronization, and Drive services are required",
    );
  }

  return async function handleAdminChangesApi(
    request,
    response,
    url = new URL(request.url ?? "/", "http://localhost"),
  ) {
    if (url.pathname !== "/admin/api/changes") return false;
    if (!requireAdmin(request, response, adminToken, { mutate: true })) return true;
    if (request.method !== "PATCH") {
      sendAdminJson(response, 405, {
        error: "Method not allowed",
        code: "METHOD_NOT_ALLOWED",
      });
      return true;
    }

    try {
      const batch = validateTopLevel(await readAdminJson(request, 256 * 1024));
      assertUniqueOperations(batch);
      const results = [];

      for (const item of batch.albums.create) {
        const clientId = normalizeId(item.clientId, "clientId");
        const key = `album:create:${clientId}`;
        try {
          const values = albumInput(item.values ?? {});
          const album = await albumRepository.createAlbum({
            id: createId(),
            ...values,
            isSystem: false,
          });
          results.push(
            operationSuccess(key, "album.create", album.id, {
              clientId,
              album: albumPayload(album),
            }),
          );
        } catch (error) {
          results.push(operationFailure(key, "album.create", null, error));
        }
      }

      for (const item of batch.albums.update) {
        const id = normalizeId(item.id);
        const key = `album:update:${id}`;
        try {
          const existing = (await albumRepository.listAdminAlbums()).find(
            (album) => album.id === id,
          );
          if (!existing) throw apiError("Album not found", 404, "NOT_FOUND");
          const album = await albumRepository.updateAlbum({
            ...existing,
            ...albumInput(item.changes ?? {}, existing),
          });
          if (!album) throw apiError("Album not found", 404, "NOT_FOUND");
          results.push(
            operationSuccess(key, "album.update", id, {
              album: albumPayload(album),
            }),
          );
        } catch (error) {
          results.push(operationFailure(key, "album.update", id, error));
        }
      }

      for (const item of batch.categories.create) {
        const clientId = normalizeId(item.clientId, "clientId");
        const key = `category:create:${clientId}`;
        try {
          const values = categoryInput(item.values ?? {});
          const category = await synchronizer.createProcess(values);
          results.push(
            operationSuccess(key, "category.create", category.id, {
              clientId,
              category: categoryPayload(category),
            }),
          );
        } catch (error) {
          results.push(operationFailure(key, "category.create", null, error));
        }
      }

      for (const item of batch.categories.update) {
        const id = normalizeId(item.id);
        const key = `category:update:${id}`;
        try {
          const existing = (await categoryRepository.listProcesses()).find(
            (category) => category.id === id,
          );
          if (!existing) {
            throw apiError("Category not found", 404, "NOT_FOUND");
          }
          const values = categoryInput(item.changes ?? {}, existing);
          const category = await synchronizer.renameProcess(
            existing,
            values.labelZh,
            values.labelEn,
          );
          results.push(
            operationSuccess(key, "category.update", id, {
              category: categoryPayload(category),
            }),
          );
        } catch (error) {
          results.push(operationFailure(key, "category.update", id, error));
        }
      }

      if (batch.categories.reorder) {
        const key = "category:reorder";
        try {
          const categories = await synchronizer.reorderProcesses(
            batch.categories.reorder,
          );
          results.push(
            operationSuccess(key, "category.reorder", null, {
              categories: categories.map(categoryPayload),
            }),
          );
        } catch (error) {
          results.push(operationFailure(key, "category.reorder", null, error));
        }
      }

      for (const item of batch.photos.update) {
        const id = normalizeId(item.id);
        const key = `photo:update:${id}`;
        try {
          const photo = await applyPhotoUpdate({
            item,
            photoRepository,
            albumRepository,
            categoryRepository,
            synchronizer,
            drive,
          });
          results.push(
            operationSuccess(key, "photo.update", id, {
              photo: photoPayload(photo),
            }),
          );
        } catch (error) {
          results.push(operationFailure(key, "photo.update", id, error));
        }
      }

      const failed = results.filter((result) => result.status === "error").length;
      sendAdminJson(response, 200, {
        results,
        summary: {
          attempted: results.length,
          succeeded: results.length - failed,
          failed,
        },
      });
      return true;
    } catch (error) {
      if (error?.status && error?.code) {
        sendAdminJson(response, error.status, {
          error: error.message,
          code: error.code,
        });
        return true;
      }
      throw error;
    }
  };
}
