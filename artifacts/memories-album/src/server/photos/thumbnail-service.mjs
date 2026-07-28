import { createHash } from "node:crypto";

const DEFAULT_BATCH_SIZE = 12;
const DEFAULT_MAX_PHOTOS_PER_RUN = 240;

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

export class ThumbnailService {
  #inFlight = new Map();
  #indexPromise = null;

  constructor({
    repository,
    drive,
    imageProcessor,
    thumbnailFolderId,
    batchSize = DEFAULT_BATCH_SIZE,
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
  }

  invalidateIndex() {
    this.#indexPromise = null;
  }

  async #thumbnailIndex() {
    this.#indexPromise ??= this.drive
      .listChildren(this.thumbnailFolderId)
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

    const original = await this.drive.download(photo.driveFileId);
    const originalBytes = await bodyToBuffer(original.body);
    const generated = await this.imageProcessor.createThumbnail({
      bytes: originalBytes,
      mimeType: photo.mimeType || original.contentType,
    });

    const uploaded = await this.drive.uploadThumbnail({
      bytes: generated.thumbnailBytes,
      filename,
      contentType: generated.thumbnailContentType,
      parentId: this.thumbnailFolderId,
    });
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
