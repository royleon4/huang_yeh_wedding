import { isValidGalleryMediaOrder } from "./media-order.mjs";
import { isValidPinnedPhotosByProcess } from "../../pinned-photo-settings.mjs";

function json(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

async function readJson(request, maxBytes = 8 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) {
      const error = new Error("Request body is too large");
      error.status = 413;
      error.code = "BODY_TOO_LARGE";
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    const error = new Error("Invalid JSON body");
    error.status = 400;
    error.code = "INVALID_JSON";
    throw error;
  }
}

export function createSettingsApi({ repository }) {
  if (!repository) throw new Error("Settings repository is required");

  return async function handleSettingsApi(
    request,
    response,
    url = new URL(request.url ?? "/", "http://localhost"),
  ) {
    if (request.method !== "GET" || url.pathname !== "/Memories/api/settings") {
      return false;
    }
    json(response, 200, await repository.getPublicSettings());
    return true;
  };
}

export function createAdminSettingsApi({ repository }) {
  if (!repository) throw new Error("Settings repository is required");

  return async function handleAdminSettingsApi(
    request,
    response,
    url = new URL(request.url ?? "/", "http://localhost"),
  ) {
    if (url.pathname !== "/admin/api/settings") return false;

    if (request.method === "GET") {
      json(response, 200, await repository.getPublicSettings());
      return true;
    }

    if (request.method !== "PATCH") return false;

    try {
      const body = await readJson(request);
      const hasWheelEnabled = Object.hasOwn(body, "processWheelEnabled");
      const hasWheelVisibleCount = Object.hasOwn(
        body,
        "processWheelVisibleCount",
      );
      const hasGalleryMediaOrder = Object.hasOwn(body, "galleryMediaOrder");
      const hasPinnedPhotoIds = Object.hasOwn(
        body,
        "pinnedPhotoIdsByProcess",
      );

      if (hasWheelEnabled && typeof body.processWheelEnabled !== "boolean") {
        json(response, 422, {
          error: "processWheelEnabled must be a boolean",
          code: "INVALID_SETTING",
        });
        return true;
      }

      const wheelVisibleCount = Number(body.processWheelVisibleCount);
      if (
        hasWheelVisibleCount &&
        (!Number.isInteger(wheelVisibleCount) ||
          wheelVisibleCount < 3 ||
          wheelVisibleCount > 8)
      ) {
        json(response, 422, {
          error: "processWheelVisibleCount must be an integer from 3 to 8",
          code: "INVALID_SETTING",
        });
        return true;
      }

      if (hasPinnedPhotoIds) {
        if (!isValidPinnedPhotosByProcess(body.pinnedPhotoIdsByProcess)) {
          json(response, 422, {
            error: "pinnedPhotoIdsByProcess must contain up to three unique photo IDs per process",
            code: "INVALID_SETTING",
          });
          return true;
        }
        json(
          response,
          200,
          await repository.setPinnedPhotoIdsByProcess(
            body.pinnedPhotoIdsByProcess,
          ),
        );
        return true;
      }

      if (hasGalleryMediaOrder) {
        if (!isValidGalleryMediaOrder(body.galleryMediaOrder)) {
          json(response, 422, {
            error: "galleryMediaOrder must contain each supported media block exactly once",
            code: "INVALID_SETTING",
          });
          return true;
        }
        json(
          response,
          200,
          await repository.setGalleryMediaOrder(body.galleryMediaOrder),
        );
        return true;
      }

      if (hasWheelEnabled || hasWheelVisibleCount) {
        const wheelUpdates = {};
        if (hasWheelEnabled) {
          Object.assign(
            wheelUpdates,
            await repository.setProcessWheelEnabled(body.processWheelEnabled),
          );
        }
        if (hasWheelVisibleCount) {
          Object.assign(
            wheelUpdates,
            await repository.setProcessWheelVisibleCount(wheelVisibleCount),
          );
        }
        json(response, 200, wheelUpdates);
        return true;
      }

      if (typeof body.guestUploadCategorySelectionEnabled !== "boolean") {
        json(response, 422, {
          error: "guestUploadCategorySelectionEnabled must be a boolean",
          code: "INVALID_SETTING",
        });
        return true;
      }
      json(
        response,
        200,
        await repository.setGuestUploadCategorySelectionEnabled(
          body.guestUploadCategorySelectionEnabled,
        ),
      );
    } catch (error) {
      json(response, error.status ?? 400, {
        error: error.message || "Invalid settings request",
        code: error.code || "INVALID_SETTINGS_REQUEST",
      });
    }
    return true;
  };
}
