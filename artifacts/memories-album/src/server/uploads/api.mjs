import Busboy from "busboy";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { toPublicPhoto } from "../photos/api.mjs";
import { ImageValidationError } from "./image-processor.mjs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_NAME_CHARACTERS = 80;
const ALLOWED_CLASSIFICATIONS = new Set(["guest", "wedding", "life"]);

export class UploadApiError extends Error {
  constructor(status, message, code) {
    super(message);
    this.name = "UploadApiError";
    this.status = status;
    this.code = code;
  }
}

function json(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
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

export function parseSinglePhoto(
  request,
  { maxFileBytes = DEFAULT_MAX_FILE_BYTES } = {},
) {
  return new Promise((resolve, reject) => {
    let parser;
    try {
      parser = Busboy({
        headers: request.headers,
        limits: {
          files: 2,
          fields: 1,
          fileSize: maxFileBytes,
        },
      });
    } catch {
      reject(
        new UploadApiError(
          415,
          "Expected a multipart photo upload",
          "INVALID_MULTIPART",
        ),
      );
      return;
    }

    let settled = false;
    let fileSeen = false;
    let record = null;
    let problem = null;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    request.once("aborted", () => {
      fail(new UploadApiError(499, "Upload cancelled", "CANCELLED"));
    });

    parser.on("file", (fieldName, stream, info) => {
      if (fieldName !== "photo" || fileSeen) {
        problem = new UploadApiError(
          400,
          "Exactly one photo is required",
          "INVALID_FILE_COUNT",
        );
        stream.resume();
        return;
      }
      fileSeen = true;
      const chunks = [];
      let size = 0;
      let truncated = false;
      stream.on("limit", () => {
        truncated = true;
      });
      stream.on("data", (chunk) => {
        size += chunk.length;
        chunks.push(chunk);
      });
      stream.on("end", () => {
        record = {
          filename: info.filename || "photo",
          mimeType: info.mimeType || "application/octet-stream",
          bytes: Buffer.concat(chunks),
          size,
          truncated,
        };
      });
    });

    parser.on("field", () => {
      problem = new UploadApiError(
        400,
        "Unexpected multipart fields",
        "INVALID_MULTIPART",
      );
    });
    parser.on("filesLimit", () => {
      problem = new UploadApiError(
        400,
        "Exactly one photo is required",
        "INVALID_FILE_COUNT",
      );
    });
    parser.on("fieldsLimit", () => {
      problem = new UploadApiError(
        400,
        "Unexpected multipart fields",
        "INVALID_MULTIPART",
      );
    });
    parser.on("error", () => {
      fail(
        new UploadApiError(
          400,
          "The multipart upload could not be read",
          "INVALID_MULTIPART",
        ),
      );
    });
    parser.on("finish", () => {
      if (settled) return;
      if (problem) {
        fail(problem);
        return;
      }
      if (!record) {
        fail(new UploadApiError(400, "A photo is required", "PHOTO_REQUIRED"));
        return;
      }
      if (record.truncated) {
        fail(
          new UploadApiError(
            413,
            "The selected photo is too large",
            "PHOTO_TOO_LARGE",
          ),
        );
        return;
      }
      settled = true;
      resolve(record);
    });

    request.pipe(parser);
  });
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

function timestamp(value) {
  return new Date(value).toISOString().replace(/\D/g, "").slice(0, 14);
}

async function safeDelete(drive, fileId) {
  if (!fileId) return;
  try {
    await drive.delete(fileId);
  } catch {
    // Compensation cleanup is best-effort and never hides the primary failure.
  }
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

export function createGuestUploadApi({
  repository,
  processRepository = null,
  drive,
  imageProcessor,
  limits = {},
  now = () => new Date(),
  createId = randomUUID,
  createToken = () => randomBytes(32).toString("base64url"),
}) {
  if (!repository || !drive || !imageProcessor) {
    throw new Error(
      "Upload repository, Drive storage, and image processor are required",
    );
  }

  return async function handleGuestUploadApi(
    request,
    response,
    url = new URL(request.url ?? "/", "http://localhost"),
  ) {
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

        const input = await parseSinglePhoto(request, {
          maxFileBytes: limits.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES,
        });
        const processed = await imageProcessor.process(input);
        const photoId = createId();
        const createdAt = now().toISOString();
        const namePrefix = `${timestamp(createdAt)}-${photoId}-${safeFilenamePart(input.filename)}`;
        const originalFilename = `${namePrefix}.${processed.originalExtension}`;
        const thumbnailFilename = `${namePrefix}.webp`;
        const contentHash = hash(input.bytes);

        let originalFileId = null;
        let thumbnailFileId = null;
        try {
          // drive.originalFolderId is always the reserved 訪客上傳 folder.
          const original = await drive.uploadOriginal({
            bytes: processed.originalBytes,
            filename: originalFilename,
            contentType: processed.originalContentType,
          });
          originalFileId = original.fileId;

          const thumbnail = await drive.uploadThumbnail({
            bytes: processed.thumbnailBytes,
            filename: thumbnailFilename,
            contentType: processed.thumbnailContentType,
          });
          thumbnailFileId = thumbnail.fileId;

          const processIds =
            batch.classification === "wedding" &&
            batch.classificationProcessId
              ? [batch.classificationProcessId]
              : [];
          const photo = await repository.insertPhoto({
            id: photoId,
            batchId,
            driveFileId: originalFileId,
            thumbnailDriveFileId: thumbnailFileId,
            originalFilename,
            mimeType: processed.originalContentType,
            byteSize: processed.originalBytes.length,
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
            createdAt,
            updatedAt: createdAt,
          });
          json(response, 201, { photo: toPublicPhoto(photo) });
          return true;
        } catch (error) {
          await safeDelete(drive, thumbnailFileId);
          await safeDelete(drive, originalFileId);
          throw error;
        }
      }

      return false;
    } catch (error) {
      if (error instanceof UploadApiError) {
        json(response, error.status, {
          error: error.message,
          code: error.code,
        });
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
            "Google Drive is temporarily unavailable. Please retry this photo.",
          code: "DRIVE_RETRYABLE",
        });
        return true;
      }
      throw error;
    }
  };
}
