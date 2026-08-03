import { randomUUID } from "node:crypto";
import {
  ALBUM_PHOTO_SORT_MODES,
  DEFAULT_ALBUM_PHOTO_SORT_MODE,
  normalizeAlbumPhotoSortMode,
} from "../../../album-photo-order.mjs";
import {
  ALBUM_TYPES,
  isAlbumType,
  normalizeAlbumType,
} from "../../../album-types.mjs";
import { sendAdminJson } from "../admin/auth.mjs";
import { readAdminJson, requireAdmin } from "../admin/request.mjs";

const PHOTO_SORT_MODE_SET = new Set(ALBUM_PHOTO_SORT_MODES);

function apiError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function normalizeText(value, maxCharacters, { required = false } = {}) {
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
      "INVALID_ALBUM",
    );
  }
  return normalized;
}

function normalizePhotoSortMode(value, fallback = DEFAULT_ALBUM_PHOTO_SORT_MODE) {
  const candidate = String(value ?? fallback).trim();
  if (!PHOTO_SORT_MODE_SET.has(candidate)) {
    throw apiError("Invalid album photo sort mode", 422, "INVALID_ALBUM_SORT");
  }
  return normalizeAlbumPhotoSortMode(candidate);
}

function normalizeAlbumTypeInput(value, fallback = "album") {
  if (value === undefined || value === null || value === "") {
    return normalizeAlbumType(fallback);
  }
  if (!isAlbumType(value)) {
    throw apiError(
      `albumType must be one of: ${ALBUM_TYPES.join(", ")}`,
      422,
      "INVALID_ALBUM_TYPE",
    );
  }
  return normalizeAlbumType(value);
}

function normalizeFeaturedRange(body, existing = null) {
  const minimum = Number(
    body.featuredPhotoMin ?? existing?.featuredPhotoMin ?? 1,
  );
  const maximum = Number(
    body.featuredPhotoMax ?? existing?.featuredPhotoMax ?? 3,
  );
  if (
    !Number.isInteger(minimum) ||
    !Number.isInteger(maximum) ||
    minimum < 0 ||
    maximum < minimum
  ) {
    throw apiError(
      "Featured-photo range must contain non-negative integers and maximum must be greater than or equal to minimum",
      422,
      "INVALID_ALBUM_FEATURED_RANGE",
    );
  }
  return { minimum, maximum };
}

function albumPayload(album) {
  return {
    id: album.id,
    titleZh: album.titleZh,
    titleEn: album.titleEn,
    descriptionZh: album.descriptionZh,
    descriptionEn: album.descriptionEn,
    albumType: normalizeAlbumType(album.albumType),
    displayOrder: album.displayOrder,
    isVisible: album.isVisible,
    isSystem: album.isSystem,
    showSummary: album.showSummary !== false,
    photoSortMode: normalizeAlbumPhotoSortMode(album.photoSortMode),
    featuredPhotosEnabled: album.featuredPhotosEnabled === true,
    featuredPhotoMin: Number(album.featuredPhotoMin ?? 1),
    featuredPhotoMax: Number(album.featuredPhotoMax ?? 3),
  };
}

function inputFrom(body, existing = null) {
  const featuredRange = normalizeFeaturedRange(body, existing);
  const albumType = normalizeAlbumTypeInput(
    body.albumType,
    existing?.albumType ?? "album",
  );
  if (
    existing?.isSystem &&
    normalizeAlbumType(existing.albumType) === "message" &&
    albumType !== "message"
  ) {
    throw apiError(
      "The system Guestbook album type cannot be changed",
      409,
      "MESSAGE_ALBUM_REQUIRED",
    );
  }
  return {
    titleZh: normalizeText(body.titleZh ?? existing?.titleZh, 80, {
      required: true,
    }),
    titleEn: normalizeText(body.titleEn ?? existing?.titleEn, 80),
    descriptionZh: normalizeText(
      body.descriptionZh ?? existing?.descriptionZh,
      500,
    ),
    descriptionEn: normalizeText(
      body.descriptionEn ?? existing?.descriptionEn,
      500,
    ),
    albumType,
    isVisible:
      typeof body.isVisible === "boolean"
        ? body.isVisible
        : existing?.isVisible !== false,
    showSummary:
      typeof body.showSummary === "boolean"
        ? body.showSummary
        : existing?.showSummary !== false,
    photoSortMode: normalizePhotoSortMode(
      body.photoSortMode,
      existing?.photoSortMode ?? DEFAULT_ALBUM_PHOTO_SORT_MODE,
    ),
    featuredPhotosEnabled:
      typeof body.featuredPhotosEnabled === "boolean"
        ? body.featuredPhotosEnabled
        : existing?.featuredPhotosEnabled === true,
    featuredPhotoMin: featuredRange.minimum,
    featuredPhotoMax: featuredRange.maximum,
  };
}

function assertSingletonMessageAlbum(albums, albumType, currentId = null) {
  if (albumType !== "message") return;
  const existing = albums.find(
    (album) =>
      normalizeAlbumType(album.albumType) === "message" && album.id !== currentId,
  );
  if (existing) {
    throw apiError(
      "Only one Guestbook message album is allowed",
      409,
      "MESSAGE_ALBUM_EXISTS",
    );
  }
}

export function createAdminAlbumApi({
  repository,
  adminToken,
  createId = randomUUID,
}) {
  if (!repository) throw new Error("Album repository is required");

  return async function handleAdminAlbumApi(
    request,
    response,
    url = new URL(request.url ?? "/", "http://localhost"),
  ) {
    const collectionPath = url.pathname === "/admin/api/albums";
    const itemMatch = url.pathname.match(/^\/admin\/api\/albums\/([^/]+)$/);
    if (!collectionPath && !itemMatch) return false;

    try {
      if (
        !requireAdmin(request, response, adminToken, {
          mutate: request.method !== "GET",
        })
      ) {
        return true;
      }

      if (request.method === "GET" && collectionPath) {
        const albums = await repository.listAdminAlbums();
        sendAdminJson(response, 200, {
          albums: albums.map(albumPayload),
        });
        return true;
      }

      if (request.method === "POST" && collectionPath) {
        const body = await readAdminJson(request);
        const input = inputFrom(body);
        assertSingletonMessageAlbum(await repository.listAdminAlbums(), input.albumType);
        const album = await repository.createAlbum({
          id: createId(),
          ...input,
          isSystem: false,
        });
        sendAdminJson(response, 201, { album: albumPayload(album) });
        return true;
      }

      if (request.method === "PATCH" && itemMatch) {
        const id = decodeURIComponent(itemMatch[1]);
        const albums = await repository.listAdminAlbums();
        const existing = albums.find((album) => album.id === id);
        if (!existing) {
          sendAdminJson(response, 404, {
            error: "Album not found",
            code: "NOT_FOUND",
          });
          return true;
        }
        const body = await readAdminJson(request);
        const input = inputFrom(body, existing);
        assertSingletonMessageAlbum(albums, input.albumType, id);
        const album = await repository.updateAlbum({
          ...existing,
          ...input,
        });
        sendAdminJson(response, 200, { album: albumPayload(album) });
        return true;
      }

      sendAdminJson(response, 405, {
        error: "Method not allowed",
        code: "METHOD_NOT_ALLOWED",
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
