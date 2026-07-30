import { randomUUID } from "node:crypto";
import {
  ALBUM_PHOTO_SORT_MODES,
  DEFAULT_ALBUM_PHOTO_SORT_MODE,
  normalizeAlbumPhotoSortMode,
} from "../../../album-photo-order.mjs";
import { sendAdminJson } from "../admin/auth.mjs";
import { readAdminJson, requireAdmin } from "../admin/request.mjs";

const PHOTO_SORT_MODE_SET = new Set(ALBUM_PHOTO_SORT_MODES);

function normalizeText(value, maxCharacters, { required = false } = {}) {
  const normalized = String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
  if (
    (required && !normalized) ||
    Array.from(normalized).length > maxCharacters
  ) {
    const error = new Error(
      required
        ? `A value is required and must be ${maxCharacters} characters or fewer`
        : `The value must be ${maxCharacters} characters or fewer`,
    );
    error.status = 422;
    error.code = "INVALID_ALBUM";
    throw error;
  }
  return normalized;
}

function normalizePhotoSortMode(value, fallback = DEFAULT_ALBUM_PHOTO_SORT_MODE) {
  const candidate = String(value ?? fallback).trim();
  if (!PHOTO_SORT_MODE_SET.has(candidate)) {
    const error = new Error("Invalid album photo sort mode");
    error.status = 422;
    error.code = "INVALID_ALBUM_SORT";
    throw error;
  }
  return normalizeAlbumPhotoSortMode(candidate);
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
    showSummary: album.showSummary !== false,
    photoSortMode: normalizeAlbumPhotoSortMode(album.photoSortMode),
  };
}

function inputFrom(body, existing = null) {
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
  };
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
        const album = await repository.createAlbum({
          id: createId(),
          ...inputFrom(body),
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
        const album = await repository.updateAlbum({
          ...existing,
          ...inputFrom(body, existing),
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
