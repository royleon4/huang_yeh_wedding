const DEFAULT_MAX_ATTEMPTS = 7;
const DEFAULT_MAX_CONCURRENT = 3;
const MAX_BACKOFF_MS = 10_000;

export class UploadClientError extends Error {
  constructor(
    message,
    { code = "UPLOAD_FAILED", status = 0, retryAfterMs = 0 } = {},
  ) {
    super(message);
    this.name = "UploadClientError";
    this.code = code;
    this.status = status;
    this.retryAfterMs = Number(retryAfterMs || 0);
    this.retryable =
      status === 0 ||
      status === 408 ||
      status === 425 ||
      status === 429 ||
      status >= 500 ||
      code === "NETWORK_ERROR" ||
      code === "REQUEST_TIMEOUT" ||
      code === "DRIVE_RETRYABLE" ||
      code === "UPLOAD_IN_PROGRESS";
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
    throw new UploadClientError(body.error || "The upload request failed", {
      code: body.code,
      status: response.status,
      retryAfterMs: body.retryAfterMs,
    });
  }
  return body;
}

function createUploadId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(24);
  globalThis.crypto?.getRandomValues?.(bytes);
  if (bytes.some(Boolean)) {
    return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  }
  return `upload_${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random()
    .toString(36)
    .slice(2)}`;
}

function wait(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new UploadClientError("Upload cancelled", { code: "CANCELLED" }));
      return;
    }
    const cancel = () => {
      clearTimeout(timer);
      reject(new UploadClientError("Upload cancelled", { code: "CANCELLED" }));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", cancel);
      resolve();
    }, milliseconds);
    signal?.addEventListener("abort", cancel, { once: true });
  });
}

async function waitUntilOnline(signal) {
  if (typeof navigator === "undefined" || navigator.onLine !== false) return;
  await new Promise((resolve, reject) => {
    const online = () => {
      cleanup();
      resolve();
    };
    const cancel = () => {
      cleanup();
      reject(new UploadClientError("Upload cancelled", { code: "CANCELLED" }));
    };
    const cleanup = () => {
      globalThis.removeEventListener?.("online", online);
      signal?.removeEventListener("abort", cancel);
    };
    globalThis.addEventListener?.("online", online, { once: true });
    signal?.addEventListener("abort", cancel, { once: true });
  });
}

export async function createGuestBatch(
  uploaderName,
  {
    classification = "guest",
    processId = null,
    fetchImpl = fetch,
  } = {},
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
    body: JSON.stringify({
      uploaderName: normalized,
      classification,
      ...(classification === "wedding" && processId ? { processId } : {}),
    }),
  });
  return readResponse(response);
}

export function uploadGuestPhoto({
  batchId,
  managementToken,
  clientUploadId,
  file,
  signal,
  onProgress = () => {},
  onStage = () => {},
  xhrFactory = () => new XMLHttpRequest(),
  timeoutMs = 180_000,
}) {
  return new Promise((resolve, reject) => {
    const xhr = xhrFactory();
    const form = new FormData();
    form.append("photo", file, file.name);

    const cancel = () => xhr.abort();
    if (signal?.aborted) {
      reject(new UploadClientError("Upload cancelled", { code: "CANCELLED" }));
      return;
    }
    signal?.addEventListener("abort", cancel, { once: true });

    const cleanup = () => signal?.removeEventListener("abort", cancel);
    xhr.open(
      "POST",
      `/Memories/api/upload-batches/${encodeURIComponent(batchId)}/photos`,
    );
    xhr.setRequestHeader("Authorization", `Bearer ${managementToken}`);
    xhr.setRequestHeader("X-Memories-Upload-Id", clientUploadId);
    xhr.responseType = "json";
    xhr.timeout = timeoutMs;
    onStage("uploading");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.min(85, Math.round((event.loaded / event.total) * 85)));
      }
    };
    xhr.upload.onload = () => {
      onProgress(90);
      onStage("processing");
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
          retryAfterMs: body.retryAfterMs,
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
    xhr.ontimeout = () => {
      cleanup();
      reject(
        new UploadClientError("The upload took too long and will retry", {
          code: "REQUEST_TIMEOUT",
          status: 408,
        }),
      );
    };
    xhr.onabort = () => {
      cleanup();
      reject(new UploadClientError("Upload cancelled", { code: "CANCELLED" }));
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

async function uploadWithRetry({
  batch,
  item,
  signal,
  onAttempt,
  onProgress,
  onStage,
  uploadFileFn,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
}) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (signal?.aborted) {
      throw new UploadClientError("Upload cancelled", { code: "CANCELLED" });
    }
    await waitUntilOnline(signal);
    onAttempt(attempt);
    try {
      return await uploadFileFn({
        batchId: batch.batchId,
        managementToken: batch.managementToken,
        clientUploadId: item.clientUploadId,
        file: item.file,
        signal,
        onProgress,
        onStage,
      });
    } catch (error) {
      lastError = error;
      if (error?.code === "CANCELLED" || !error?.retryable || attempt === maxAttempts) {
        throw error;
      }
      const exponential = Math.min(MAX_BACKOFF_MS, 500 * 2 ** (attempt - 1));
      const jitter = Math.floor(Math.random() * 250);
      await wait(Math.max(error.retryAfterMs || 0, exponential + jitter), signal);
    }
  }
  throw lastError;
}

async function runOne({
  batch,
  results,
  index,
  signal,
  onUpdate,
  uploadFileFn,
}) {
  if (signal?.aborted) return;
  results[index] = {
    ...results[index],
    status: "uploading",
    progress: Math.min(85, results[index].progress ?? 0),
    error: null,
  };
  onUpdate({ type: "file", index, item: results[index] });

  try {
    const photo = await uploadWithRetry({
      batch,
      item: results[index],
      signal,
      uploadFileFn,
      onAttempt(attempt) {
        results[index] = {
          ...results[index],
          status: attempt > 1 ? "retrying" : "uploading",
          attempts: attempt,
          error: null,
        };
        onUpdate({ type: "file", index, item: results[index] });
      },
      onProgress(progress) {
        results[index] = { ...results[index], progress };
        onUpdate({ type: "file", index, item: results[index] });
      },
      onStage(stage) {
        const retrying = results[index].attempts > 1 && stage === "uploading";
        results[index] = {
          ...results[index],
          status: retrying ? "retrying" : stage,
        };
        onUpdate({ type: "file", index, item: results[index] });
      },
    });
    results[index] = {
      ...results[index],
      status: "success",
      progress: 100,
      photo,
      error: null,
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
  }
}

async function runItems({
  batch,
  results,
  indexes,
  signal,
  onUpdate,
  uploadFileFn,
  maxConcurrent = DEFAULT_MAX_CONCURRENT,
}) {
  const concurrency = Math.max(
    1,
    Math.min(Number(maxConcurrent) || DEFAULT_MAX_CONCURRENT, 4, indexes.length || 1),
  );
  let cursor = 0;

  const worker = async () => {
    while (!signal?.aborted) {
      const position = cursor;
      cursor += 1;
      if (position >= indexes.length) return;
      await runOne({
        batch,
        results,
        index: indexes[position],
        signal,
        onUpdate,
        uploadFileFn,
      });
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  if (signal?.aborted) {
    for (const index of indexes) {
      if (results[index].status === "success" || results[index].status === "failed") {
        continue;
      }
      results[index] = {
        ...results[index],
        status: "cancelled",
        error: "Upload cancelled",
      };
      onUpdate({ type: "file", index, item: results[index] });
    }
  }
  return results;
}

export async function uploadQueue({
  uploaderName,
  files,
  classification = "guest",
  processId = null,
  signal,
  onUpdate = () => {},
  createBatchFn = createGuestBatch,
  uploadFileFn = uploadGuestPhoto,
  maxConcurrent = DEFAULT_MAX_CONCURRENT,
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

  const batch = await createBatchFn(uploaderName, { classification, processId });
  onUpdate({ type: "batch", batch });
  const results = selected.map((file) => ({
    file,
    clientUploadId: createUploadId(),
    status: "queued",
    progress: 0,
    attempts: 0,
    photo: null,
    error: null,
  }));
  onUpdate({ type: "queue", results: [...results] });

  await runItems({
    batch,
    results,
    indexes: results.map((_, index) => index),
    signal,
    onUpdate,
    uploadFileFn,
    maxConcurrent,
  });

  return {
    batch,
    results,
    summary: summarizeUploadResults(results),
  };
}

export async function retryFailedUploads({
  batch,
  results,
  signal,
  onUpdate = () => {},
  uploadFileFn = uploadGuestPhoto,
  maxConcurrent = DEFAULT_MAX_CONCURRENT,
}) {
  if (!batch?.batchId || !batch?.managementToken) {
    throw new UploadClientError("The upload batch can no longer be resumed", {
      code: "BATCH_NOT_FOUND",
      status: 404,
    });
  }
  const next = results.map((item) => ({ ...item }));
  const indexes = next
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.status !== "success")
    .map(({ index }) => index);

  await runItems({
    batch,
    results: next,
    indexes,
    signal,
    onUpdate,
    uploadFileFn,
    maxConcurrent,
  });

  return {
    batch,
    results: next,
    summary: summarizeUploadResults(next),
  };
}
