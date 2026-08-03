import { GoogleDriveStorage } from "./drive-adapter.mjs";

function contentRange(value) {
  const match = String(value ?? "").match(/^bytes\s+(\d+)-(\d+)\/(\d+)$/i);
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  const total = Number(match[3]);
  if (
    ![start, end, total].every(Number.isSafeInteger) ||
    start < 0 ||
    end < start ||
    total <= end
  ) {
    return null;
  }
  return { start, end, total };
}

function requestStage(path, options = {}) {
  const range =
    options.headers?.["Content-Range"] ?? options.headers?.["content-range"];
  const requestPath = String(path);

  if (options.method === "POST" && requestPath.includes("uploadType=resumable")) {
    return "session-init";
  }
  if (options.method === "POST" && requestPath.includes("uploadType=multipart")) {
    const uploadKind =
      options.headers?.["X-Memories-Upload-Kind"] ??
      options.headers?.["x-memories-upload-kind"];
    return uploadKind === "attachment" ? "attachment-upload" : "thumbnail-upload";
  }
  if (options.method === "PUT" && /^bytes\s+\*\//i.test(String(range ?? ""))) {
    return "session-status";
  }
  if (options.method === "PUT" && contentRange(range)) {
    return "chunk-upload";
  }
  if (requestPath.startsWith("/drive/v3/files?q=")) return "file-lookup";
  if (options.method === "GET" && requestPath.includes("alt=media")) {
    return "file-download";
  }
  if (options.method === "DELETE") return "file-delete";
  return "drive-request";
}

function safeDiagnostic({
  stage,
  status,
  strategy,
  chunkBytes = null,
  offset = null,
  totalBytes = null,
}) {
  console.warn("Memories Drive request diagnostic", {
    stage,
    status,
    strategy,
    chunkBytes,
    offset,
    totalBytes,
  });
}

function unusableSessionResponse(response) {
  return {
    ...response,
    ok: false,
    status: 410,
    headers:
      response?.headers ??
      ({
        get() {
          return null;
        },
      }),
  };
}

/**
 * Wraps Replit's Drive proxy with bounded diagnostics and one compatibility
 * recovery. Production evidence showed that the connector can return HTTP 403
 * when checking a previously persisted resumable-session URI with an empty PUT.
 * That response concerns the old upload session, not necessarily the account or
 * target folder. Convert only that exact response into 410 so the Drive adapter
 * discards the stale session and creates a fresh one.
 *
 * No token, folder id, session URI, filename, response body, or file bytes are
 * logged.
 */
export function createReplitDriveProxy(connectors) {
  if (!connectors || typeof connectors.proxy !== "function") {
    throw new Error("Replit connector proxy is required");
  }

  return async function replitDriveProxy(connector, path, options = {}) {
    const stage = requestStage(path, options);
    const forwardedHeaders = { ...(options.headers ?? {}) };
    delete forwardedHeaders["X-Memories-Upload-Kind"];
    delete forwardedHeaders["x-memories-upload-kind"];
    const response = await connectors.proxy(connector, path, {
      ...options,
      headers: forwardedHeaders,
    });
    const rangeHeader =
      options.headers?.["Content-Range"] ?? options.headers?.["content-range"];
    const range = contentRange(rangeHeader);
    const body = Buffer.isBuffer(options.body)
      ? options.body
      : options.body instanceof Uint8Array
        ? Buffer.from(options.body)
        : null;
    const status = Number(response?.status ?? 500);

    if (
      connector === "google-drive" &&
      stage === "session-status" &&
      status === 403
    ) {
      safeDiagnostic({
        stage,
        status,
        strategy: "discard-stale-session",
        chunkBytes: body?.length ?? 0,
        offset: null,
        totalBytes: null,
      });
      return unusableSessionResponse(response);
    }

    if (!response?.ok && status !== 308) {
      safeDiagnostic({
        stage,
        status,
        strategy: "original-request",
        chunkBytes: body?.length ?? null,
        offset: range?.start ?? null,
        totalBytes: range?.total ?? null,
      });
    }
    return response;
  };
}

export async function createReplitDriveStorage(env = process.env) {
  const originalFolderId = env.MEMORIES_DRIVE_PHOTOS_FOLDER_ID;
  if (!originalFolderId) {
    throw new Error("MEMORIES_DRIVE_PHOTOS_FOLDER_ID is required");
  }

  const { ReplitConnectors } = await import("@replit/connectors-sdk");
  const connectors = new ReplitConnectors();
  return new GoogleDriveStorage({
    originalFolderId,
    thumbnailFolderId: env.MEMORIES_DRIVE_THUMBNAILS_FOLDER_ID || null,
    proxy: createReplitDriveProxy(connectors),
  });
}
