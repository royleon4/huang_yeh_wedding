import { randomUUID } from "node:crypto";
import { sendAdminJson } from "../admin/auth.mjs";
import { readAdminJson, requireAdmin } from "../admin/request.mjs";
import { decodePathSegment } from "../http/path-segment.mjs";
import {
  normalizeYoutubeVideoId,
  youtubeWatchUrl,
} from "../processes/youtube.mjs";

function apiError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function categoryPayload(category) {
  return {
    id: category.id,
    albumId: category.albumId ?? "wedding",
    labelZh: category.labelZh,
    labelEn: category.labelEn,
    displayOrder: category.displayOrder,
    youtubeUrl: youtubeWatchUrl(category.youtubeVideoId),
    youtubeVideoId: category.youtubeVideoId ?? null,
    youtubeAutoplay: Boolean(category.youtubeAutoplay),
    syncState: category.syncState,
    lastSyncedAt: category.lastSyncedAt,
  };
}

function normalizeLabel(value, { required = false } = {}) {
  if (value == null && !required) return "";
  if (typeof value !== "string") {
    throw apiError("Category name must be text", 422, "INVALID_CATEGORY");
  }
  const label = value.normalize("NFKC").replace(/\s+/g, " ").trim();
  if ((required && !label) || Array.from(label).length > 80) {
    throw apiError(
      required
        ? "Category name is required and must be 80 characters or fewer"
        : "Category name must be 80 characters or fewer",
      422,
      "INVALID_CATEGORY",
    );
  }
  return label;
}

function strictOptionalBoolean(body, key, fallback) {
  if (!Object.hasOwn(body, key)) return fallback;
  if (typeof body[key] !== "boolean") {
    throw apiError(`${key} must be a boolean`, 422, "INVALID_CATEGORY");
  }
  return body[key];
}

function videoSettings(body, existing = null) {
  const youtubeVideoId = Object.hasOwn(body, "youtubeUrl")
    ? normalizeYoutubeVideoId(body.youtubeUrl)
    : (existing?.youtubeVideoId ?? null);
  const youtubeAutoplay = youtubeVideoId
    ? strictOptionalBoolean(
        body,
        "youtubeAutoplay",
        Boolean(existing?.youtubeAutoplay),
      )
    : false;
  return { youtubeVideoId, youtubeAutoplay };
}

async function saveVideoSettings(repository, category, settings) {
  if (typeof repository.updateProcessVideo === "function") {
    return repository.updateProcessVideo(category.id, settings);
  }
  return { ...category, ...settings };
}

async function eligibleAlbumMap(repository) {
  if (typeof repository.listEligibleLabelAlbums !== "function") {
    throw new Error("Album-scoped label repository support is required");
  }
  return new Map(
    (await repository.listEligibleLabelAlbums()).map((album) => [album.id, album]),
  );
}

function normalizedCategoryOrder(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw apiError(
      "categoryIds must be a non-empty array of strings without duplicates",
      422,
      "INVALID_CATEGORY_ORDER",
    );
  }
  if (
    value.some((id) => typeof id !== "string" || !id.trim()) ||
    new Set(value.map((id) => id.trim())).size !== value.length
  ) {
    throw apiError(
      "categoryIds must be a non-empty array of strings without duplicates",
      422,
      "INVALID_CATEGORY_ORDER",
    );
  }
  return value.map((id) => id.trim());
}

export function createAdminCategoryApi({
  repository,
  synchronizer,
  adminToken,
  createId = randomUUID,
}) {
  if (!repository || !synchronizer) {
    throw new Error("Category repository and synchronizer are required");
  }

  return async function handleAdminCategoryApi(
    request,
    response,
    url = new URL(request.url ?? "/", "http://localhost"),
  ) {
    const collectionPath = url.pathname === "/admin/api/categories";
    const labelCollectionPath = url.pathname === "/admin/api/album-labels";
    const orderPath = url.pathname === "/admin/api/categories/order";
    const itemMatch = !orderPath
      ? url.pathname.match(/^\/admin\/api\/categories\/([^/]+)$/)
      : null;
    if (!collectionPath && !labelCollectionPath && !orderPath && !itemMatch) {
      return false;
    }

    try {
      if (
        !requireAdmin(request, response, adminToken, {
          mutate: request.method !== "GET",
        })
      ) {
        return true;
      }

      if (request.method === "GET" && collectionPath) {
        const categories = await repository.listProcesses();
        sendAdminJson(response, 200, {
          categories: categories.map(categoryPayload),
        });
        return true;
      }

      if (request.method === "GET" && labelCollectionPath) {
        const albums = await eligibleAlbumMap(repository);
        const requestedAlbumId = String(url.searchParams.get("albumId") ?? "").trim();
        if (requestedAlbumId && !albums.has(requestedAlbumId)) {
          sendAdminJson(response, 422, {
            error: "This album cannot contain photo labels",
            code: "INVALID_LABEL_ALBUM",
          });
          return true;
        }
        const labels = await repository.listLabels({
          albumId: requestedAlbumId || null,
        });
        sendAdminJson(response, 200, {
          labels: labels
            .filter((label) => albums.has(label.albumId))
            .map(categoryPayload),
        });
        return true;
      }

      if (request.method === "POST" && labelCollectionPath) {
        const body = await readAdminJson(request);
        const albumId = typeof body.albumId === "string" ? body.albumId.trim() : "";
        const albums = await eligibleAlbumMap(repository);
        if (!albums.has(albumId)) {
          sendAdminJson(response, 422, {
            error: "This album cannot contain photo labels",
            code: "INVALID_LABEL_ALBUM",
          });
          return true;
        }
        const values = {
          labelZh: normalizeLabel(body.labelZh, { required: true }),
          labelEn: normalizeLabel(body.labelEn),
        };
        const label =
          albumId === "wedding"
            ? await synchronizer.createProcess(values)
            : await repository.createAlbumLabel({
                id: createId(),
                albumId,
                ...values,
              });
        sendAdminJson(response, 201, {
          label: categoryPayload(label),
        });
        return true;
      }

      if (request.method === "POST" && collectionPath) {
        const body = await readAdminJson(request);
        let category = await synchronizer.createProcess({
          labelZh: normalizeLabel(body.labelZh, { required: true }),
          labelEn: normalizeLabel(body.labelEn),
        });
        category = await saveVideoSettings(
          repository,
          category,
          videoSettings(body),
        );
        sendAdminJson(response, 201, {
          category: categoryPayload(category),
        });
        return true;
      }

      if (request.method === "PATCH" && itemMatch) {
        const id = decodePathSegment(itemMatch[1]);
        const categories = await repository.listProcesses();
        const existing = categories.find((category) => category.id === id);
        if (!existing) {
          sendAdminJson(response, 404, {
            error: "Category not found",
            code: "NOT_FOUND",
          });
          return true;
        }
        const body = await readAdminJson(request);
        const labelZh = normalizeLabel(body.labelZh ?? existing.labelZh, {
          required: true,
        });
        const labelEn = normalizeLabel(body.labelEn ?? existing.labelEn);
        let category = existing;
        if (labelZh !== existing.labelZh || labelEn !== existing.labelEn) {
          category = await synchronizer.renameProcess(
            existing,
            labelZh,
            labelEn,
          );
        }
        category = await saveVideoSettings(
          repository,
          category,
          videoSettings(body, category),
        );
        sendAdminJson(response, 200, {
          category: categoryPayload(category),
        });
        return true;
      }

      if (request.method === "PUT" && orderPath) {
        const body = await readAdminJson(request);
        const categories = await synchronizer.reorderProcesses(
          normalizedCategoryOrder(body.categoryIds),
        );
        sendAdminJson(response, 200, {
          categories: categories.map(categoryPayload),
        });
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
