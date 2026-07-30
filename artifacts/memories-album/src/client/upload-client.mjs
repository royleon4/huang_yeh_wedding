import {
  UploadClientError,
  uploadQueue as uploadQueueBase,
} from "./upload-client-fair.mjs";

export * from "./upload-client-fair.mjs";

export const MAX_UPLOAD_PHOTOS = 10;

export async function uploadQueue(options = {}) {
  const selected = Array.from(options.files ?? []);
  if (selected.length > MAX_UPLOAD_PHOTOS) {
    throw new UploadClientError("Select no more than 10 photos at a time", {
      code: "TOO_MANY_PHOTOS",
      status: 422,
    });
  }
  return uploadQueueBase({ ...options, files: selected });
}
