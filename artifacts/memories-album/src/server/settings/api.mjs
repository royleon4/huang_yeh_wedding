import { isValidGalleryMediaOrder } from "./media-order.mjs";
import { isValidPinnedPhotosByProcess } from "../../pinned-photo-settings.mjs";
import { isValidSiteCopy } from "../../site-copy.mjs";
import {
  MAX_GUEST_LATEST_PHOTO_COUNT,
  MIN_GUEST_LATEST_PHOTO_COUNT,
  isValidGuestLatestPhotoCount,
  isValidGuestUploaderLabelOrder,
} from "../../guest-label-settings.mjs";
import {
  MAX_SUPPORTED_UPLOAD_PHOTOS,
  MIN_UPLOAD_PHOTOS,
  isValidAdminUploadMaxPhotos,
  isValidGuestUploadMaxPhotos,
  isValidUploadDescription,
} from "../../upload-settings.mjs";
import { isValidDriveUploadMode } from "./upload-mode.mjs";

function json(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

async function readJson(request, maxBytes = 32 * 1024) {
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
      const hasSiteCopy = Object.hasOwn(body, "siteCopy");
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
      const hasDriveUploadMode = Object.hasOwn(body, "driveUploadMode");
      const hasGuestUploadMaxPhotos = Object.hasOwn(
        body,
        "guestUploadMaxPhotos",
      );
      const hasAdminUploadMaxPhotos = Object.hasOwn(
        body,
        "adminUploadMaxPhotos",
      );
      const hasUploadDescription = Object.hasOwn(body, "uploadDescription");
      const hasGuestUploaderLabelsVisible = Object.hasOwn(
        body,
        "guestUploaderLabelsVisible",
      );
      const hasGuestLatestPhotosLabelVisible = Object.hasOwn(
        body,
        "guestLatestPhotosLabelVisible",
      );
      const hasGuestAllVisitorsLabelVisible = Object.hasOwn(
        body,
        "guestAllVisitorsLabelVisible",
      );
      const hasGuestNameLabelsVisible = Object.hasOwn(
        body,
        "guestNameLabelsVisible",
      );
      const hasGuestUploaderLabelOrder = Object.hasOwn(
        body,
        "guestUploaderLabelOrder",
      );
      const hasGuestLatestPhotoCount = Object.hasOwn(
        body,
        "guestLatestPhotoCount",
      );
      const hasUploadCardSetting =
        hasDriveUploadMode ||
        hasGuestUploadMaxPhotos ||
        hasAdminUploadMaxPhotos ||
        hasUploadDescription;
      const hasGuestLabelSetting =
        hasGuestUploaderLabelsVisible ||
        hasGuestLatestPhotosLabelVisible ||
        hasGuestAllVisitorsLabelVisible ||
        hasGuestNameLabelsVisible ||
        hasGuestUploaderLabelOrder ||
        hasGuestLatestPhotoCount;

      if (hasSiteCopy) {
        if (!isValidSiteCopy(body.siteCopy)) {
          json(response, 422, {
            error: "siteCopy must contain all supported Chinese and English text fields",
            code: "INVALID_SETTING",
          });
          return true;
        }
        json(response, 200, await repository.setSiteCopy(body.siteCopy));
        return true;
      }

      if (hasUploadCardSetting) {
        if (
          hasDriveUploadMode &&
          !isValidDriveUploadMode(body.driveUploadMode)
        ) {
          json(response, 422, {
            error: "driveUploadMode must be either single or chunked",
            code: "INVALID_SETTING",
          });
          return true;
        }
        if (
          hasGuestUploadMaxPhotos &&
          !isValidGuestUploadMaxPhotos(body.guestUploadMaxPhotos)
        ) {
          json(response, 422, {
            error: `guestUploadMaxPhotos must be an integer from ${MIN_UPLOAD_PHOTOS} to ${MAX_SUPPORTED_UPLOAD_PHOTOS}`,
            code: "INVALID_SETTING",
          });
          return true;
        }
        if (
          hasAdminUploadMaxPhotos &&
          !isValidAdminUploadMaxPhotos(body.adminUploadMaxPhotos)
        ) {
          json(response, 422, {
            error: `adminUploadMaxPhotos must be an integer from ${MIN_UPLOAD_PHOTOS} to ${MAX_SUPPORTED_UPLOAD_PHOTOS}`,
            code: "INVALID_SETTING",
          });
          return true;
        }
        if (
          hasUploadDescription &&
          !isValidUploadDescription(body.uploadDescription)
        ) {
          json(response, 422, {
            error: "uploadDescription must contain Chinese and English text up to 800 characters each",
            code: "INVALID_SETTING",
          });
          return true;
        }

        const uploadUpdates = {};
        if (hasDriveUploadMode) {
          Object.assign(
            uploadUpdates,
            await repository.setDriveUploadMode(body.driveUploadMode),
          );
        }
        if (hasGuestUploadMaxPhotos) {
          Object.assign(
            uploadUpdates,
            await repository.setGuestUploadMaxPhotos(
              Number(body.guestUploadMaxPhotos),
            ),
          );
        }
        if (hasAdminUploadMaxPhotos) {
          Object.assign(
            uploadUpdates,
            await repository.setAdminUploadMaxPhotos(
              Number(body.adminUploadMaxPhotos),
            ),
          );
        }
        if (hasUploadDescription) {
          Object.assign(
            uploadUpdates,
            await repository.setUploadDescription(body.uploadDescription),
          );
        }
        json(response, 200, uploadUpdates);
        return true;
      }

      if (hasGuestLabelSetting) {
        const booleanGuestLabelSettings = [
          [hasGuestUploaderLabelsVisible, body.guestUploaderLabelsVisible],
          [
            hasGuestLatestPhotosLabelVisible,
            body.guestLatestPhotosLabelVisible,
          ],
          [
            hasGuestAllVisitorsLabelVisible,
            body.guestAllVisitorsLabelVisible,
          ],
          [hasGuestNameLabelsVisible, body.guestNameLabelsVisible],
        ];
        if (
          booleanGuestLabelSettings.some(
            ([present, value]) => present && typeof value !== "boolean",
          )
        ) {
          json(response, 422, {
            error: "Guest label visibility settings must be boolean values",
            code: "INVALID_SETTING",
          });
          return true;
        }
        if (
          hasGuestUploaderLabelOrder &&
          !isValidGuestUploaderLabelOrder(body.guestUploaderLabelOrder)
        ) {
          json(response, 422, {
            error: "guestUploaderLabelOrder must contain unique non-empty names up to 80 characters",
            code: "INVALID_SETTING",
          });
          return true;
        }
        if (
          hasGuestLatestPhotoCount &&
          !isValidGuestLatestPhotoCount(body.guestLatestPhotoCount)
        ) {
          json(response, 422, {
            error: `guestLatestPhotoCount must be an integer from ${MIN_GUEST_LATEST_PHOTO_COUNT} to ${MAX_GUEST_LATEST_PHOTO_COUNT}`,
            code: "INVALID_SETTING",
          });
          return true;
        }

        const guestLabelUpdates = {};
        if (hasGuestUploaderLabelsVisible) {
          Object.assign(
            guestLabelUpdates,
            await repository.setGuestUploaderLabelsVisible(
              body.guestUploaderLabelsVisible,
            ),
            await repository.setGuestLatestPhotosLabelVisible(
              body.guestUploaderLabelsVisible,
            ),
            await repository.setGuestAllVisitorsLabelVisible(
              body.guestUploaderLabelsVisible,
            ),
            await repository.setGuestNameLabelsVisible(
              body.guestUploaderLabelsVisible,
            ),
          );
        }
        if (hasGuestLatestPhotosLabelVisible) {
          Object.assign(
            guestLabelUpdates,
            await repository.setGuestLatestPhotosLabelVisible(
              body.guestLatestPhotosLabelVisible,
            ),
          );
        }
        if (hasGuestAllVisitorsLabelVisible) {
          Object.assign(
            guestLabelUpdates,
            await repository.setGuestAllVisitorsLabelVisible(
              body.guestAllVisitorsLabelVisible,
            ),
          );
        }
        if (hasGuestNameLabelsVisible) {
          Object.assign(
            guestLabelUpdates,
            await repository.setGuestNameLabelsVisible(
              body.guestNameLabelsVisible,
            ),
          );
        }
        if (hasGuestUploaderLabelOrder) {
          Object.assign(
            guestLabelUpdates,
            await repository.setGuestUploaderLabelOrder(
              body.guestUploaderLabelOrder,
            ),
          );
        }
        if (hasGuestLatestPhotoCount) {
          Object.assign(
            guestLabelUpdates,
            await repository.setGuestLatestPhotoCount(
              Number(body.guestLatestPhotoCount),
            ),
          );
        }
        json(response, 200, guestLabelUpdates);
        return true;
      }

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
