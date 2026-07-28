import { createHash } from "node:crypto";

const DEFAULT_BATCH_SIZE = 12;
const DEFAULT_MAX_PHOTOS_PER_RUN = 240;
const DEFAULT_MAX_CONCURRENT = 2;
const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 180;

export function thumbnailFilenameForDriveFileId(driveFileId) {
  const digest = createHash("sha256")
    .update(String(driveFileId))
    .digest("hex")
    .slice(0, 32);
  return `memories-thumb-${digest}.webp`;
}

async function bodyToBuffer(body) {
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);

  if (body?.getReader) {
    const reader = body.getReader();
    const chunks = [];
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(Buffer.from(value));
      }
    } finally {
      reader.releaseLock?.();
    }
    return Buffer.concat(chunks);
  }

  if (body?.[Symbol.asyncIterator]) {
    const chunks = [];
    for await (const chunk of body) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  }

  throw new Error("Unsupported Google Drive response body");
}

async function bestEffortDelete(drive, fileId) {
  if (!fileId) return;
  try {
    await drive.delete(fileId);
  } catch {
    // Another instance may already have cleaned up the duplicate derivative.
  }
}

function isRetryableDriveError(error) {
  return (
    error?.code === "DRIVE_RETRYABLE" ||
    error?.status === 429 ||
    (Number.isInteger(error?.status) && error.status >= 500)
  );
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function retryDriveOperation(
  operation,
  { attempts = DEFAULT_RETRY_ATTEMPTS, delayMs = DEFAULT_RETRY_DELAY_MS } = {},
) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryableDriveError(error) || attempt === attempts) throw error;
      await delay(delayMs * attempt);
    }
  }
  throw lastError;
}

export class ThumbnailService {
  #inFlight = new Map();
  #indexPromise = null;
  #activeGenerations = 0;
  #generationWaiters = [];

  constructor({
    repository,
    drive,
    imageProcessor,
    thumbnailFolderId,
    batchSize = DEFAULT_BATCH_SIZE,
    maxConcurrent = DEFAULT_MAX_CONCURRENT,
    retryAttempts = DEFAULT_RETRY_ATTEMPTS,
  }) {
    if (!repository || !drive || !imageProcessor || !thumbnailFolderId) {
      throw new Error(
        "Thumbnail repository, Drive storage, image processor, and folder are required",
      );
    }
    this.repository = repository;
    this.drive = drive;
    this.imageProcessor = imageProcessor;
    this.thumbnailFolderId = thumbnailFolderId;
    this.batchSize = Math.max(1, Math.min(Number(batchSize) || DEFAULT_BATCH_SIZE, 50));
    this.maxConcurrent = Math.max(
      1,
      Math.min(Number(maxConcurrent) || DEFAULT_MAX_CONCURRENT, 6),
    );
    this.retryAttempts = Math.max(
      1,
      Math.min(Number(retryAttempts) || DEFAULT_RETRY_ATTEMPTS, 5),
    );
  }

  invalidateIndex() {
    this.#indexPromise = null;
  }

  async #thumbnailIndex() {
    this.#indexPromise ??= retryDriveOperation(
      () => this.drive.listChildren(this.thumbnailFolderId),
      { attempts: this.retryAttempts },
    )
      .then(
        (files) =>
          new Map(
            files
              .filter((file) => file?.id && file?.name)
              .map((file) => [file.name, file]),
          ),
      )
      .catch((error) => {
        this.#indexPromise = null;
        throw error;
      });
    return this.#indexPromise;
  }

  async #withGenerationSlot(operation) {
    if (this.#activeGenerations >= this.maxConcurrent) {
      await new Promise((resolve) => this.#generationWaiters.push(resolve));
    }
    this.#activeGenerations += 1;
    try {
      return await operation();
    } finally {
      this.#activeGenerations -= 1;
      this.#generationWaiters.shift()?.();
    }
  }

  async ensurePhotoThumbnail(photo) {
    if (photo?.thumbnailDriveFileId) return photo;
    if (!photo?.id || !photo?.driveFileId) {
      const error = new Error("Photo is missing its Drive identity");
      error.code = "PHOTO_DRIVE_ID_MISSING";
      throw error;
    }

    const key = String(photo.driveFileId);
    if (this.#inFlight.has(key)) return this.#inFlight.get(key);

    const operation = this.#ensurePhotoThumbnail(photo).finally(() => {
      this.#inFlight.delete(key);
    });
    this.#inFlight.set(key, operation);
    return operation;
  }

  async #ensurePhotoThumbnail(photo) {
    const filename = thumbnailFilenameForDriveFileId(photo.driveFileId);
    const index = await this.#thumbnailIndex();
    const existing = index.get(filename);
    if (existing?.id) {
      return this.repository.attachThumbnail(photo.id, existing.id);
    }

    return this.#withGenerationSlot(async () => {
      const existingAfterWait = index.get(filename);
      if (existingAfterWait?.id) {
        return this.repository.attachThumbnail(photo.id, existingAfterWait.id);
      }

      const original = await retryDriveOperation(
        () => this.drive.download(photo.driveFileId),
        { attempts: this.retryAttempts },
      );
      const originalBytes = await bodyToBuffer(original.body);
      const generated = await this.imageProcessor.createThumbnail({
        bytes: originalBytes,
        mimeType: photo.mimeType || original.contentType,
      });

      const uploaded = await retryDriveOperation(
        () =>
          this.drive.uploadThumbnail({
            bytes: generated.thumbnailBytes,
            filename,
            contentType: generated.thumbnailContentType,
            parentId: this.thumbnailFolderId,
          }),
        { attempts: this.retryAttempts },
      );
      index.set(filename, {
        id: uploaded.fileId,
        name: filename,
        mimeType: generated.thumbnailContentType,
      });

      try {
        const attached = await this.repository.attachThumbnail(
          photo.id,
          uploaded.fileId,
        );
        if (
          attached?.thumbnailDriveFileId &&
          attached.thumbnailDriveFileId !== uploaded.fileId
        ) {
          await bestEffortDelete(this.drive, uploaded.fileId);
          index.set(filename, {
            id: attached.thumbnailDriveFileId,
            name: filename,
            mimeType: generated.thumbnailContentType,
          });
        }
        return attached;
      } catch (error) {
        // Keep the deterministically named file. A later run can discover and attach it
        // without uploading a second derivative.
        throw error;
      }
    });
  }

  async backfillMissing({ maxPhotos = DEFAULT_MAX_PHOTOS_PER_RUN } = {}) {
    const cap = Math.max(1, Number(maxPhotos) || DEFAULT_MAX_PHOTOS_PER_RUN);
    let attempted = 0;
    let createdOrAttached = 0;
    const failures = [];

    while (attempted < cap) {
      const photos = await this.repository.listPhotosMissingThumbnails({
        limit: Math.min(this.batchSize, cap - attempted),
      });
      if (photos.length === 0) break;

      let batchSuccesses = 0;
      for (const photo of photos) {
        attempted += 1;
        try {
          await this.ensurePhotoThumbnail(photo);
          createdOrAttached += 1;
          batchSuccesses += 1;
        } catch (error) {
          failures.push({
            photoId: photo.id,
            code: error?.code ?? error?.name ?? "THUMBNAIL_FAILED",
          });
        }
      }

      // Avoid repeatedly selecting the same failed rows in one run.
      if (batchSuccesses === 0) break;
    }

    return { attempted, createdOrAttached, failures };
  }
}
