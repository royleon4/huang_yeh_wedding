export class UploadClientError extends Error {
  constructor(message, { code = "UPLOAD_FAILED", status = 0 } = {}) {
    super(message);
    this.name = "UploadClientError";
    this.code = code;
    this.status = status;
    this.retryable = status >= 500 || code === "DRIVE_RETRYABLE";
  }
}

async function readResponse(response) {
  let body = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }
  if (!response.ok) {
    throw new UploadClientError(
      body.error || "The upload request failed",
      { code: body.code, status: response.status },
    );
  }
  return body;
}

export async function createGuestBatch(
  uploaderName,
  { fetchImpl = fetch } = {},
) {
  const normalized = String(uploaderName ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    throw new UploadClientError("Uploader name is required", {
      code: "INVALID_UPLOADER_NAME",
      status: 422,
    });
  }
  const response = await fetchImpl("/Memories/api/upload-batches", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uploaderName: normalized }),
  });
  return readResponse(response);
}

export function uploadGuestPhoto({
  batchId,
  managementToken,
  file,
  signal,
  onProgress = () => {},
  xhrFactory = () => new XMLHttpRequest(),
}) {
  return new Promise((resolve, reject) => {
    const xhr = xhrFactory();
    const form = new FormData();
    form.append("photo", file, file.name);

    const cancel = () => xhr.abort();
    if (signal?.aborted) {
      reject(
        new UploadClientError("Upload cancelled", {
          code: "CANCELLED",
        }),
      );
      return;
    }
    signal?.addEventListener("abort", cancel, { once: true });

    const cleanup = () => signal?.removeEventListener("abort", cancel);
    xhr.open(
      "POST",
      `/Memories/api/upload-batches/${encodeURIComponent(batchId)}/photos`,
    );
    xhr.setRequestHeader("Authorization", `Bearer ${managementToken}`);
    xhr.responseType = "json";
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      cleanup();
      const body = xhr.response || {};
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve(body.photo);
        return;
      }
      reject(
        new UploadClientError(body.error || "The photo could not be uploaded", {
          code: body.code,
          status: xhr.status,
        }),
      );
    };
    xhr.onerror = () => {
      cleanup();
      reject(
        new UploadClientError("Network error while uploading the photo", {
          code: "NETWORK_ERROR",
        }),
      );
    };
    xhr.onabort = () => {
      cleanup();
      reject(
        new UploadClientError("Upload cancelled", {
          code: "CANCELLED",
        }),
      );
    };
    xhr.send(form);
  });
}

export function summarizeUploadResults(results) {
  return results.reduce(
    (summary, item) => {
      if (item.status === "success") summary.success += 1;
      if (item.status === "failed") summary.failed += 1;
      if (item.status === "cancelled") summary.cancelled += 1;
      return summary;
    },
    { success: 0, failed: 0, cancelled: 0 },
  );
}

export async function uploadQueue({
  uploaderName,
  files,
  signal,
  onUpdate = () => {},
  createBatchFn = createGuestBatch,
  uploadFileFn = uploadGuestPhoto,
}) {
  const selected = Array.from(files ?? []);
  if (selected.length === 0) {
    throw new UploadClientError("Select at least one photo", {
      code: "PHOTO_REQUIRED",
      status: 422,
    });
  }
  if (selected.length > 30) {
    throw new UploadClientError("Select no more than 30 photos at a time", {
      code: "TOO_MANY_PHOTOS",
      status: 422,
    });
  }

  const batch = await createBatchFn(uploaderName);
  onUpdate({ type: "batch", batch });
  const results = selected.map((file) => ({
    file,
    status: "queued",
    progress: 0,
    photo: null,
    error: null,
  }));
  onUpdate({ type: "queue", results: [...results] });

  for (let index = 0; index < selected.length; index += 1) {
    if (signal?.aborted) {
      for (let pending = index; pending < results.length; pending += 1) {
        results[pending] = {
          ...results[pending],
          status: "cancelled",
          error: "Upload cancelled",
        };
        onUpdate({ type: "file", index: pending, item: results[pending] });
      }
      break;
    }

    results[index] = { ...results[index], status: "uploading" };
    onUpdate({ type: "file", index, item: results[index] });
    try {
      const photo = await uploadFileFn({
        batchId: batch.batchId,
        managementToken: batch.managementToken,
        file: selected[index],
        signal,
        onProgress: (progress) => {
          results[index] = { ...results[index], progress };
          onUpdate({ type: "file", index, item: results[index] });
        },
      });
      results[index] = {
        ...results[index],
        status: "success",
        progress: 100,
        photo,
      };
      onUpdate({ type: "file", index, item: results[index] });
    } catch (error) {
      const cancelled = error?.code === "CANCELLED";
      results[index] = {
        ...results[index],
        status: cancelled ? "cancelled" : "failed",
        error: error instanceof Error ? error.message : "Upload failed",
        code: error?.code,
        retryable: Boolean(error?.retryable),
      };
      onUpdate({ type: "file", index, item: results[index] });
      if (cancelled) {
        for (let pending = index + 1; pending < results.length; pending += 1) {
          results[pending] = {
            ...results[pending],
            status: "cancelled",
            error: "Upload cancelled",
          };
          onUpdate({ type: "file", index: pending, item: results[pending] });
        }
        break;
      }
    }
  }

  return {
    batch,
    results,
    summary: summarizeUploadResults(results),
  };
}
