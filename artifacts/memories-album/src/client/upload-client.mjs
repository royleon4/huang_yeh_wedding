import {
  UploadClientError,
  uploadQueue as uploadQueueBase,
} from "./upload-client-fair.mjs";
import { MAX_SUPPORTED_UPLOAD_PHOTOS } from "../upload-settings.mjs";

export * from "./upload-client-fair.mjs";

export const MAX_UPLOAD_PHOTOS = 10;

function resolvedUploadLimit(value) {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized < 1) return MAX_UPLOAD_PHOTOS;
  return Math.min(normalized, MAX_SUPPORTED_UPLOAD_PHOTOS);
}

export async function uploadQueue(options = {}) {
  const selected = Array.from(options.files ?? []);
  const maxPhotos = resolvedUploadLimit(options.maxPhotos);
  if (selected.length > maxPhotos) {
    throw new UploadClientError(
      `Select no more than ${maxPhotos} photos at a time`,
      {
        code: "TOO_MANY_PHOTOS",
        status: 422,
      },
    );
  }
  return uploadQueueBase({ ...options, files: selected, maxPhotos });
}
