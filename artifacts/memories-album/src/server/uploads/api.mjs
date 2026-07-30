import { createHash, randomBytes, randomUUID } from "node:crypto";
import { toPublicPhoto } from "../photos/api.mjs";
import { ImageValidationError } from "./image-processor.mjs";
import {
  parsePhotoToTemporaryFile,
  TemporaryPhotoError,
} from "./temp-photo.mjs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLIENT_UPLOAD_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const DEFAULT_MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_NAME_CHARACTERS = 80;
const ALLOWED_CLASSIFICATIONS = new Set(["guest", "wedding", "life"]);
const DRIVE_RETRY_ATTEMPTS = 4;

export class UploadApiError extends Error {
  constructor(status, message, code, details = {}) {
    super(message);
    this.name = "UploadApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function json(response, status, body, headers = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  response.end(JSON.stringify(body));
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeUploaderName(value) {
  if (typeof value !== "string") return "";
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function bearerToken(request) {
  const header = request.headers.authorization;
  if (typeof header !== "string") return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function requestedClientUploadId(request, contentHash) {
  const supplied = request.headers["x-memories-upload-id"];
  if (typeof supplied === "string" && CLIENT_UPLOAD_ID_PATTERN.test(supplied)) {
    return supplied;
  }
  return `legacy_${contentHash.slice(0, 48)}`;
}

async function readJson(request, maxBytes = 8 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) {
      throw new UploadApiError(
        413,
        "Request body is too large",
        "BODY_TOO_LARGE",
      );
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw new UploadApiError(400, "Invalid JSON body", "INVALID_JSON");
  }
}

// Compatibility helpers for existing server tests and one-off administrator code.
// The production guest path below keeps the file on disk instead of buffering it.
export async function parsePhotoMultipart(request, options = {}) {
  const temporary = await parsePhotoToTemporaryFile(request, options);
  try {
    return {
      file: {
        filename: temporary.filename,
        mimeType: temporary.mimeType,
        bytes: await temporary.readBytes(),
        size: temporary.size,
        truncated: false,
      },
      fields: {},
    };
  } finally {
    await temporary.cleanup();
  }
}

export async function parseSinglePhoto(request, options = {}) {
  const parsed = await parsePhotoMultipart(request, options);
  return parsed.file;
}

function safeFilenamePart(filename) {
  const base = String(filename || "photo")
    .replace(/\.[^.]+$/, "")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "photo";
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function retryableDriveError(error) {
  return (
    error?.code === "DRIVE_RETRYABLE" ||
    error?.status === 429 ||
    (Number.isInteger(error?.status) && error.status >= 500)
  );
}

async function withDriveRetry(operation) {
  let lastError;
  for (let attempt = 1; attempt <= DRIVE_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!retryableDriveError(error) || attempt === DRIVE_RETRY_ATTEMPTS) {
        throw error;
      }
      await wait(250 * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}

function createMemoryDurableRepository() {
  const items = new Map();
  return {
    async claim(input) {
      const key = `${input.batchId}:${input.clientUploadId}`;
      const current = items.get(key);
      if (current?.status === "ready") {
        return { state: "ready", photoId: current.photoId };
      }
      if (current?.status === "processing") {
        return { state: "busy", retryAfterMs: 500 };
      }
      const item = {
        ...current,
        ...input,
        status: "processing",
        originalDriveFileId: current?.originalDriveFileId ?? null,
        thumbnailDriveFileId: current?.thumbnailDriveFileId ?? null,
        originalUploadSessionUri: current?.originalUploadSessionUri ?? null,
        originalUploadOffset: current?.originalUploadOffset ?? 0,
      };
      items.set(key, item);
      return { state: "claimed", item };
    },
    async recordOriginalUploadSession(input) {
      const key = `${input.batchId}:${input.clientUploadId}`;
      const next = {
        ...(items.get(key) ?? {}),
        originalUploadSessionUri: input.sessionUri,
        originalUploadOffset: Number(input.uploadedBytes ?? 0),
      };
      items.set(key, next);
      return next;
    },
    async recordFiles(input) {
      const key = `${input.batchId}:${input.clientUploadId}`;
      const current = items.get(key) ?? {};
      const next = {
        ...current,
        originalDriveFileId:
          input.originalDriveFileId ?? current.originalDriveFileId ?? null,
        thumbnailDriveFileId:
          input.thumbnailDriveFileId ?? current.thumbnailDriveFileId ?? null,
        ...(input.originalDriveFileId
          ? { originalUploadSessionUri: null, originalUploadOffset: 0 }
          : {}),
      };
      items.set(key, next);
      return next;
    },
    async markReady(input) {
      const key = `${input.batchId}:${input.clientUploadId}`;
      items.set(key, {
        ...(items.get(key) ?? {}),
        ...input,
        status: "ready",
        originalUploadSessionUri: null,
        originalUploadOffset: 0,
      });
    },
    async markFailed(input) {
      const key = `${input.batchId}:${input.clientUploadId}`;
      items.set(key, { ...(items.get(key) ?? {}), status: "failed" });
    },
  };
}

async function validateClassification(body, processRepository) {
  const classification = String(body.classification ?? "guest").trim();
  if (!ALLOWED_CLASSIFICATIONS.has(classification)) {
    throw new UploadApiError(
      422,
      "Invalid photo classification",
      "INVALID_CLASSIFICATION",
    );
  }
  if (classification !== "wedding") {
    return { classification, classificationProcessId: null };
  }

  const processId = String(body.processId ?? "").trim();
  if (!processId || !processRepository?.listProcesses) {
    throw new UploadApiError(
      422,
      "A wedding process is required",
      "INVALID_PROCESS_CLASSIFICATION",
    );
  }
  const processes = await processRepository.listProcesses();
  if (!processes.some((process) => process.id === processId)) {
    throw new UploadApiError(
      422,
      "The selected wedding process does not exist",
      "INVALID_PROCESS_CLASSIFICATION",
    );
  }
  return { classification, classificationProcessId: processId };
}

async function prepareOriginal(temporary, imageProcessor) {
  if (typeof imageProcessor.processFile === "function") {
    const processed = await imageProcessor.processFile({
      filePath: temporary.filePath,
      mimeType: temporary.mimeType,
    });
    return {
      filePath: processed.originalPath,
      bytes: null,
      byteSize: processed.originalByteSize,
      originalContentType: processed.originalContentType,
      originalExtension: processed.originalExtension,
      width: processed.width,
      height: processed.height,
      thumbnailBytes: null,
      thumbnailContentType: null,
    };
  }

  const processed = await imageProcessor.process({
    bytes: await temporary.readBytes(),
    mimeType: temporary.mimeType,
  });
  return {
    filePath: null,
    bytes: processed.originalBytes,
    byteSize: processed.originalBytes.length,
    originalContentType: processed.originalContentType,
    originalExtension: processed.originalExtension,
    width: processed.width,
    height: processed.height,
    thumbnailBytes: processed.thumbnailBytes ?? null,
    thumbnailContentType: processed.thumbnailContentType ?? null,
  };
}

function scheduleThumbnailCreation(thumbnailService, photo) {
  if (!thumbnailService || photo.thumbnailDriveFileId) return;
  setImmediate(() => {
    void thumbnailService.ensurePhotoThumbnail(photo).catch((error) => {
      console.warn("Memories deferred thumbnail generation failed", {
        photoId: photo.id,
        name: error instanceof Error ? error.name : "UnknownError",
        code: error?.code,
      });
    });
  });
}

export function createGuestUploadApi({
  repository,
  durableUploadRepository = createMemoryDurableRepository(),
  processRepository = null,
  drive,
  imageProcessor,
  thumbnailService = null,
  limits = {},
  now = () => new Date(),
  createId = randomUUID,
  createToken = () => randomBytes(32).toString("base64url"),
}) {
  if (!repository || !drive || !imageProcessor || !durableUploadRepository) {
    throw new Error(
      "Upload repository, durable state, Drive storage, and image processor are required",
    );
  }

  return async function handleGuestUploadApi(
    request,
    response,
    url = new URL(request.url ?? "/", "http://localhost"),
  ) {
    let activeUpload = null;
    let temporary = null;
    try {
      if (
        request.method === "POST" &&
        url.pathname === "/Memories/api/upload-batches"
      ) {
        const body = await readJson(request);
        const uploaderName = normalizeUploaderName(body.uploaderName);
        if (
          !uploaderName ||
          Array.from(uploaderName).length > MAX_NAME_CHARACTERS
        ) {
          throw new UploadApiError(
            422,
            "Uploader name is required and must be 80 characters or fewer",
            "INVALID_UPLOADER_NAME",
          );
        }
        const classification = await validateClassification(
          body,
          processRepository,
        );

        const id = createId();
        const managementToken = createToken();
        const createdAt = now().toISOString();
        await repository.createUploadBatch({
          id,
          uploaderType: "guest",
          uploaderName,
          tokenHash: hash(managementToken),
          status: "open",
          classification: classification.classification,
          classificationProcessId: classification.classificationProcessId,
          createdAt,
          updatedAt: createdAt,
        });
        json(response, 201, {
          batchId: id,
          managementToken,
          manageUrl: `/Memories/manage/${id}#token=${encodeURIComponent(managementToken)}`,
        });
        return true;
      }

      const photoMatch = url.pathname.match(
        /^\/Memories\/api\/upload-batches\/([^/]+)\/photos$/,
      );
      if (request.method === "POST" && photoMatch) {
        const batchId = photoMatch[1];
        const token = bearerToken(request);
        if (!UUID_PATTERN.test(batchId) || !token) {
          throw new UploadApiError(
            404,
            "Upload batch not found",
            "BATCH_NOT_FOUND",
          );
        }
        const batch = await repository.findUploadBatchByToken(
          batchId,
          hash(token),
        );
        if (!batch) {
          throw new UploadApiError(
            404,
            "Upload batch not found",
            "BATCH_NOT_FOUND",
          );
        }

        temporary = await parsePhotoToTemporaryFile(request, {
          maxFileBytes: limits.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES,
        });
        const contentHash = temporary.contentHash;
        const clientUploadId = requestedClientUploadId(request, contentHash);
        const proposedPhotoId = createId();
        const claimed = await durableUploadRepository.claim({
          batchId,
          clientUploadId,
          contentHash,
          originalFilename: temporary.filename,
          photoId: proposedPhotoId,
          now: now(),
        });
        activeUpload = { batchId, clientUploadId };

        if (claimed.state === "ready") {
          const existing = await repository.findPublicPhoto(claimed.photoId);
          if (!existing) {
            throw new UploadApiError(
              409,
              "The upload is being finalized. Please retry shortly.",
              "UPLOAD_IN_PROGRESS",
              { retryAfterMs: 1000 },
            );
          }
          activeUpload = null;
          json(response, 200, { photo: toPublicPhoto(existing), reused: true });
          return true;
        }
        if (claimed.state === "busy") {
          throw new UploadApiError(
            409,
            "This photo is already being uploaded. Please retry shortly.",
            "UPLOAD_IN_PROGRESS",
            { retryAfterMs: claimed.retryAfterMs ?? 1000 },
          );
        }

        const item = claimed.item;
        const photoId = item.photoId ?? proposedPhotoId;
        const processed = await prepareOriginal(temporary, imageProcessor);
        const stableKey = hash(`${batchId}:${clientUploadId}`).slice(0, 32);
        const originalFilename = `guest-${stableKey}-${safeFilenamePart(temporary.filename)}.${processed.originalExtension}`;
        const thumbnailFilename = `guest-${stableKey}.webp`;
        const appProperties = {
          batchId,
          uploadId: clientUploadId.slice(0, 120),
        };

        let sessionUri = item.originalUploadSessionUri ?? null;
        let uploadedBytes = Number(item.originalUploadOffset ?? 0);
        const recordSession = async (progress) => {
          sessionUri = progress.sessionUri;
          uploadedBytes = Number(progress.uploadedBytes ?? 0);
          await durableUploadRepository.recordOriginalUploadSession?.({
            batchId,
            clientUploadId,
            sessionUri,
            uploadedBytes,
          });
        };

        let originalFileId = item.originalDriveFileId ?? null;
        if (!originalFileId) {
          const original = await withDriveRetry(() =>
            drive.uploadOriginal({
              bytes: processed.bytes,
              filePath: processed.filePath,
              byteSize: processed.byteSize,
              filename: originalFilename,
              contentType: processed.originalContentType,
              appProperties,
              resumeSessionUri: sessionUri,
              resumeOffset: uploadedBytes,
              onSession: recordSession,
              onProgress: recordSession,
            }),
          );
          originalFileId = original.fileId;
        }
        await durableUploadRepository.recordFiles({
          batchId,
          clientUploadId,
          originalDriveFileId: originalFileId,
        });

        let thumbnailFileId = item.thumbnailDriveFileId ?? null;
        if (
          !thumbnailService &&
          !thumbnailFileId &&
          processed.thumbnailBytes
        ) {
          const thumbnail = await withDriveRetry(() =>
            drive.uploadThumbnail({
              bytes: processed.thumbnailBytes,
              filename: thumbnailFilename,
              contentType: processed.thumbnailContentType,
              appProperties,
            }),
          );
          thumbnailFileId = thumbnail.fileId;
          await durableUploadRepository.recordFiles({
            batchId,
            clientUploadId,
            thumbnailDriveFileId: thumbnailFileId,
          });
        }

        const processIds =
          batch.classification === "wedding" && batch.classificationProcessId
            ? [batch.classificationProcessId]
            : [];
        const timestamp = now().toISOString();
        const photo = await repository.insertPhoto({
          id: photoId,
          batchId,
          clientUploadId,
          driveFileId: originalFileId,
          thumbnailDriveFileId: thumbnailFileId,
          originalFilename,
          mimeType: processed.originalContentType,
          byteSize: processed.byteSize,
          width: processed.width,
          height: processed.height,
          contentHash,
          contentVersion: 1,
          source: "guest",
          uploaderName: batch.uploaderName,
          collection: batch.classification ?? "guest",
          visibility: "public",
          processingState: "ready",
          processIds,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        await durableUploadRepository.markReady({
          batchId,
          clientUploadId,
          photoId: photo.id,
        });
        activeUpload = null;
        json(response, 201, {
          photo: toPublicPhoto(photo),
          reused: false,
          thumbnailPending: !photo.thumbnailDriveFileId,
        });
        scheduleThumbnailCreation(thumbnailService, photo);
        return true;
      }

      return false;
    } catch (error) {
      if (activeUpload) {
        await durableUploadRepository
          .markFailed({
            ...activeUpload,
            code: error?.code ?? error?.name ?? "UPLOAD_FAILED",
          })
          .catch(() => {});
      }
      if (error instanceof TemporaryPhotoError) {
        json(response, error.status, { error: error.message, code: error.code });
        return true;
      }
      if (error instanceof UploadApiError) {
        const retryAfterMs = Number(error.details?.retryAfterMs ?? 0);
        json(
          response,
          error.status,
          {
            error: error.message,
            code: error.code,
            ...(retryAfterMs ? { retryAfterMs } : {}),
          },
          retryAfterMs
            ? {
                "Retry-After": String(
                  Math.max(1, Math.ceil(retryAfterMs / 1000)),
                ),
              }
            : {},
        );
        return true;
      }
      if (error instanceof ImageValidationError) {
        json(response, 422, { error: error.message, code: error.code });
        return true;
      }
      if (error?.code === "DUPLICATE_PHOTO") {
        json(response, 409, {
          error: "This photo has already been uploaded",
          code: "DUPLICATE_PHOTO",
        });
        return true;
      }
      if (error?.code === "DRIVE_AUTHORIZATION_REQUIRED") {
        json(response, 503, {
          error:
            "Google Drive authorization is required. Please reconnect the integration.",
          code: "DRIVE_AUTHORIZATION_REQUIRED",
        });
        return true;
      }
      if (error?.code === "DRIVE_RETRYABLE") {
        json(response, 503, {
          error:
            "Google Drive is temporarily unavailable. This photo will retry safely.",
          code: "DRIVE_RETRYABLE",
        });
        return true;
      }
      if (error?.code === "DRIVE_REQUEST_FAILED") {
        json(response, 502, {
          error: "Google Drive rejected the upload request.",
          code: "DRIVE_REQUEST_FAILED",
        });
        return true;
      }
      throw error;
    } finally {
      await temporary?.cleanup?.().catch(() => {});
    }
  };
}
