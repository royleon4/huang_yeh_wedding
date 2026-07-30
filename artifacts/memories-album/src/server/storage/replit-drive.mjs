import { GoogleDriveStorage } from "./drive-adapter.mjs";

const ORIGINAL_CHUNK_BYTES = 4 * 1024 * 1024;
const DIAGNOSTIC_SUBCHUNK_BYTES = 2 * 1024 * 1024;

function contentRange(value) {
  const match = String(value ?? "").match(/^bytes\s+(\d+)-(\d+)\/(\d+)$/i);
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  const total = Number(match[3]);
  if (![start, end, total].every(Number.isSafeInteger) || start < 0 || end < start || total <= end) {
    return null;
  }
  return { start, end, total };
}

function requestStage(path, options = {}) {
  const range = options.headers?.["Content-Range"] ?? options.headers?.["content-range"];
  if (options.method === "POST" && String(path).includes("uploadType=resumable")) {
    return "session-init";
  }
  if (options.method === "PUT" && /^bytes\s+\*\//i.test(String(range ?? ""))) {
    return "session-status";
  }
  if (options.method === "PUT" && contentRange(range)) {
    return "chunk-upload";
  }
  if (String(path).startsWith("/drive/v3/files?q=")) return "file-lookup";
  return "drive-request";
}

function safeDiagnostic({ stage, status, strategy, chunkBytes = null, offset = null, totalBytes = null }) {
  console.warn("Memories Drive request diagnostic", {
    stage,
    status,
    strategy,
    chunkBytes,
    offset,
    totalBytes,
  });
}

function chunkOptions(options, body, start, end, total) {
  return {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      "Content-Length": String(body.length),
      "Content-Range": `bytes ${start}-${end}/${total}`,
    },
    body,
  };
}

/**
 * Wraps Replit's connector proxy with a controlled A/B probe for the exact
 * production failure we observed. If a non-final 4 MiB Drive chunk is rejected
 * with HTTP 403, the same bytes are retried as two legal 2 MiB Drive chunks in
 * the same resumable session. No token, folder id, session URI, response body,
 * filename, or file bytes are logged.
 *
 * Interpretation:
 * - 4 MiB rejected, 2 MiB chunks accepted: connector request-body boundary.
 * - 4 MiB and 2 MiB both rejected: not explained by a 4 MiB body boundary.
 */
export function createReplitDriveProxy(connectors) {
  if (!connectors || typeof connectors.proxy !== "function") {
    throw new Error("Replit connector proxy is required");
  }

  return async function replitDriveProxy(connector, path, options = {}) {
    const response = await connectors.proxy(connector, path, options);
    const stage = requestStage(path, options);
    const rangeHeader = options.headers?.["Content-Range"] ?? options.headers?.["content-range"];
    const range = contentRange(rangeHeader);
    const body = Buffer.isBuffer(options.body)
      ? options.body
      : options.body instanceof Uint8Array
        ? Buffer.from(options.body)
        : null;

    const isFourMiBNonFinalChunk =
      connector === "google-drive" &&
      stage === "chunk-upload" &&
      Number(response?.status) === 403 &&
      body?.length === ORIGINAL_CHUNK_BYTES &&
      range &&
      range.end - range.start + 1 === ORIGINAL_CHUNK_BYTES &&
      range.end + 1 < range.total;

    if (!isFourMiBNonFinalChunk) {
      if (!response?.ok && Number(response?.status) !== 308) {
        safeDiagnostic({
          stage,
          status: Number(response?.status ?? 500),
          strategy: "original-request",
          chunkBytes: body?.length ?? null,
          offset: range?.start ?? null,
          totalBytes: range?.total ?? null,
        });
      }
      return response;
    }

    safeDiagnostic({
      stage,
      status: 403,
      strategy: "4mib-rejected-retry-2mib",
      chunkBytes: body.length,
      offset: range.start,
      totalBytes: range.total,
    });

    const firstBody = body.subarray(0, DIAGNOSTIC_SUBCHUNK_BYTES);
    const firstStart = range.start;
    const firstEnd = firstStart + firstBody.length - 1;
    const firstResponse = await connectors.proxy(
      connector,
      path,
      chunkOptions(options, firstBody, firstStart, firstEnd, range.total),
    );

    if (Number(firstResponse?.status) !== 308) {
      safeDiagnostic({
        stage,
        status: Number(firstResponse?.status ?? 500),
        strategy: "2mib-first-subchunk",
        chunkBytes: firstBody.length,
        offset: firstStart,
        totalBytes: range.total,
      });
      return firstResponse;
    }

    const secondBody = body.subarray(DIAGNOSTIC_SUBCHUNK_BYTES);
    const secondStart = firstEnd + 1;
    const secondEnd = secondStart + secondBody.length - 1;
    const secondResponse = await connectors.proxy(
      connector,
      path,
      chunkOptions(options, secondBody, secondStart, secondEnd, range.total),
    );

    safeDiagnostic({
      stage,
      status: Number(secondResponse?.status ?? 500),
      strategy:
        Number(secondResponse?.status) === 308 || secondResponse?.ok
          ? "2mib-subchunks-accepted"
          : "2mib-second-subchunk-rejected",
      chunkBytes: secondBody.length,
      offset: secondStart,
      totalBytes: range.total,
    });
    return secondResponse;
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
