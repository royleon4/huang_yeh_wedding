import { decodePhotoCursor, encodePhotoCursor } from "./cursor.mjs";
import { trashRestoreDeadline } from "./trash-cleanup-service.mjs";

function compareOldestFirst(left, right) {
  const time =
    new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  return time || String(left.id).localeCompare(String(right.id));
}

function duplicateError() {
  const error = new Error("Duplicate photo");
  error.code = "DUPLICATE_PHOTO";
  return error;
}

export class MemoryPhotoRepository {
  #photos;
  #batches;
  #trashJobs;

  constructor(seed = [], batches = []) {
    this.#photos = seed.map((photo) => ({
      ...photo,
      collection:
        photo.collection ?? (photo.source === "guest" ? "guest" : "wedding"),
      processIds: [...(photo.processIds ?? [])],
    }));
    this.#batches = new Map(
      batches.map((batch) => [
        batch.id,
        { ...batch, classification: batch.classification ?? "guest" },
      ]),
    );
    this.#trashJobs = new Map();
  }

  async createUploadBatch(batch) {
    if (this.#batches.has(batch.id)) throw new Error("Duplicate batch id");
    this.#batches.set(batch.id, {
      ...batch,
      status: batch.status ?? "open",
      classification: batch.classification ?? "guest",
      classificationProcessId: batch.classificationProcessId ?? null,
    });
    return { ...this.#batches.get(batch.id) };
  }

  async findUploadBatchByToken(id, tokenHash) {
    const batch = this.#batches.get(id);
    if (
      !batch ||
      batch.status !== "open" ||
      batch.tokenHash !== tokenHash ||
      batch.uploaderType !== "guest"
    ) {
      return null;
    }
    return { ...batch };
  }

  async findUploadBatchForManagement(id) {
    const batch = this.#batches.get(id);
    return batch ? { ...batch } : null;
  }

  async rotateUploadBatchToken({
    id,
    expectedTokenHash,
    tokenHash,
    updatedAt,
  }) {
    const batch = this.#batches.get(id);
    if (
      !batch ||
      batch.status !== "open" ||
      batch.tokenHash !== expectedTokenHash
    ) {
      return null;
    }
    const updated = { ...batch, tokenHash, updatedAt };
    this.#batches.set(id, updated);
    return { ...updated };
  }

  async listAdminUploadBatches({ limit = 50 } = {}) {
    const boundedLimit = Math.max(1, Math.min(Number(limit) || 50, 100));
    return [...this.#batches.values()]
      .sort((left, right) =>
        String(right.createdAt).localeCompare(String(left.createdAt)),
      )
      .slice(0, boundedLimit)
      .map((batch) => ({
        id: batch.id,
        uploaderType: batch.uploaderType,
        uploaderName: batch.uploaderName,
        status: batch.status,
        classification: batch.classification,
        classificationProcessId: batch.classificationProcessId,
        photoCount: this.#photos.filter((photo) => photo.batchId === batch.id)
          .length,
        visiblePhotoCount: this.#photos.filter(
          (photo) =>
            photo.batchId === batch.id && photo.visibility === "public",
        ).length,
        uploadStatusCounts: {},
        createdAt: batch.createdAt,
        updatedAt: batch.updatedAt,
      }));
  }

  async setUploadBatchStatus({ id, status, updatedAt }) {
    const batch = this.#batches.get(id);
    if (!batch || batch.uploaderType !== "guest") return null;
    const updated = { ...batch, status, updatedAt };
    this.#batches.set(id, updated);
    return { ...updated };
  }

  async regenerateUploadBatchToken({ id, tokenHash, updatedAt }) {
    const batch = this.#batches.get(id);
    if (!batch || batch.uploaderType !== "guest") return null;
    const updated = {
      ...batch,
      tokenHash,
      status: "open",
      updatedAt,
    };
    this.#batches.set(id, updated);
    return { ...updated };
  }

  async listBatchPhotos(batchId) {
    return this.#photos
      .filter(
        (photo) => photo.batchId === batchId && photo.visibility === "public",
      )
      .sort((left, right) =>
        String(left.createdAt).localeCompare(String(right.createdAt)),
      )
      .map((photo) => ({
        ...photo,
        processIds: [...(photo.processIds ?? [])],
      }));
  }

  async trashBatchPhoto({ batchId, photoId, trashedAt }) {
    const index = this.#photos.findIndex(
      (photo) =>
        photo.id === photoId &&
        photo.batchId === batchId &&
        photo.visibility === "public",
    );
    if (index < 0) return null;
    return this.#trashPhotoAtIndex(index, trashedAt);
  }

  async trashPhotoForRetention({ photoId, trashedAt }) {
    const index = this.#photos.findIndex(
      (photo) => photo.id === photoId && photo.visibility !== "trashed",
    );
    if (index < 0) return null;
    return this.#trashPhotoAtIndex(index, trashedAt);
  }

  async listTrashedPhotos({ limit = 100 } = {}) {
    const boundedLimit = Math.max(1, Math.min(Number(limit) || 100, 100));
    return this.#photos
      .filter((photo) => photo.visibility === "trashed")
      .map((photo) => {
        const job = this.#trashJobs.get(photo.id);
        return {
          ...photo,
          processIds: [...(photo.processIds ?? [])],
          restoreUntil:
            job?.eligibleAt ?? trashRestoreDeadline(photo.trashedAt),
          cleanupStatus: job?.status ?? "pending",
          cleanupAttemptCount: job?.attemptCount ?? 0,
        };
      })
      .sort((left, right) =>
        String(right.trashedAt).localeCompare(String(left.trashedAt)),
      )
      .slice(0, boundedLimit);
  }

  async findTrashedPhotoForAdmin(photoId) {
    const photo = (await this.listTrashedPhotos()).find(
      (item) => item.id === photoId,
    );
    return photo ?? null;
  }

  async restoreTrashedPhoto({ photoId, now }) {
    const job = this.#trashJobs.get(photoId);
    const index = this.#photos.findIndex(
      (photo) => photo.id === photoId && photo.visibility === "trashed",
    );
    if (!job || index < 0 || new Date(now) >= new Date(job.eligibleAt)) {
      return null;
    }
    this.#photos[index] = {
      ...this.#photos[index],
      visibility: "public",
      trashedAt: null,
      updatedAt: now,
    };
    this.#trashJobs.delete(photoId);
    return {
      ...this.#photos[index],
      processIds: [...(this.#photos[index].processIds ?? [])],
    };
  }

  async claimExpiredTrash({
    now,
    limit = 20,
    leaseExpiresAt = new Date(new Date(now).getTime() + 300_000).toISOString(),
  }) {
    const boundedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
    const claimed = [];
    for (const job of [...this.#trashJobs.values()].sort((left, right) =>
      String(left.eligibleAt).localeCompare(String(right.eligibleAt)),
    )) {
      if (claimed.length >= boundedLimit) break;
      const leaseExpired =
        job.status !== "processing" ||
        !job.leaseExpiresAt ||
        new Date(job.leaseExpiresAt) <= new Date(now);
      if (new Date(job.eligibleAt) > new Date(now) || !leaseExpired) continue;
      const index = this.#photos.findIndex(
        (photo) => photo.id === job.photoId && photo.visibility === "trashed",
      );
      if (index < 0) {
        this.#trashJobs.delete(job.photoId);
        continue;
      }
      this.#trashJobs.set(job.photoId, {
        ...job,
        status: "processing",
        attemptCount: job.attemptCount + 1,
        leaseExpiresAt,
        updatedAt: now,
      });
      claimed.push({
        ...this.#photos[index],
        processIds: [...(this.#photos[index].processIds ?? [])],
        restoreUntil: job.eligibleAt,
      });
    }
    return claimed;
  }

  async retryTrashCleanup({ photoId, errorCode, updatedAt }) {
    const job = this.#trashJobs.get(photoId);
    if (!job) return null;
    const updated = {
      ...job,
      status: "retry",
      leaseExpiresAt: null,
      lastErrorCode: errorCode,
      updatedAt,
    };
    this.#trashJobs.set(photoId, updated);
    return { ...updated };
  }

  async completeTrashCleanup(photoId) {
    const index = this.#photos.findIndex((photo) => photo.id === photoId);
    if (index >= 0) this.#photos.splice(index, 1);
    this.#trashJobs.delete(photoId);
    return index >= 0;
  }

  #trashPhotoAtIndex(index, trashedAt) {
    const photo = {
      ...this.#photos[index],
      visibility: "trashed",
      trashedAt,
      updatedAt: trashedAt,
    };
    const restoreUntil = trashRestoreDeadline(trashedAt);
    this.#photos[index] = photo;
    this.#trashJobs.set(photo.id, {
      photoId: photo.id,
      eligibleAt: restoreUntil,
      status: "pending",
      attemptCount: 0,
      leaseExpiresAt: null,
      lastErrorCode: null,
      createdAt: trashedAt,
      updatedAt: trashedAt,
    });
    return {
      photo: {
        ...photo,
        processIds: [...(photo.processIds ?? [])],
      },
      restoreUntil,
    };
  }

  async insertPhoto(photo) {
    if (
      this.#photos.some(
        (item) =>
          item.id === photo.id ||
          (photo.contentHash && item.contentHash === photo.contentHash),
      )
    ) {
      throw duplicateError();
    }
    const stored = {
      ...photo,
      collection:
        photo.collection ?? (photo.source === "guest" ? "guest" : "wedding"),
      processIds: [...(photo.processIds ?? [])],
    };
    this.#photos.push(stored);
    return { ...stored, processIds: [...stored.processIds] };
  }

  async listPhotosMissingThumbnails({ limit = 12 } = {}) {
    const boundedLimit = Math.max(1, Math.min(Number(limit) || 12, 50));
    return this.#photos
      .filter(
        (photo) =>
          !photo.thumbnailDriveFileId &&
          photo.driveFileId &&
          photo.processingState === "ready" &&
          photo.visibility !== "trashed",
      )
      .sort((left, right) =>
        String(left.createdAt).localeCompare(String(right.createdAt)),
      )
      .slice(0, boundedLimit)
      .map((photo) => ({
        ...photo,
        processIds: [...(photo.processIds ?? [])],
      }));
  }

  async attachThumbnail(photoId, thumbnailDriveFileId) {
    const index = this.#photos.findIndex((photo) => photo.id === photoId);
    if (index < 0) {
      const error = new Error("Photo not found while attaching thumbnail");
      error.code = "PHOTO_NOT_FOUND";
      throw error;
    }
    this.#photos[index] = {
      ...this.#photos[index],
      thumbnailDriveFileId:
        this.#photos[index].thumbnailDriveFileId ?? thumbnailDriveFileId,
      updatedAt: new Date().toISOString(),
    };
    return {
      ...this.#photos[index],
      processIds: [...(this.#photos[index].processIds ?? [])],
    };
  }

  async clearThumbnail(photoId, expectedFileId = null) {
    const index = this.#photos.findIndex((photo) => photo.id === photoId);
    if (index < 0) {
      const error = new Error("Photo not found while clearing thumbnail");
      error.code = "PHOTO_NOT_FOUND";
      throw error;
    }
    const current = this.#photos[index];
    if (
      expectedFileId &&
      current.thumbnailDriveFileId &&
      current.thumbnailDriveFileId !== expectedFileId
    ) {
      const error = new Error("Thumbnail reference changed during repair");
      error.code = "THUMBNAIL_REPAIR_CONFLICT";
      throw error;
    }
    this.#photos[index] = {
      ...current,
      thumbnailDriveFileId: null,
      updatedAt: new Date().toISOString(),
    };
    return {
      ...this.#photos[index],
      processIds: [...(this.#photos[index].processIds ?? [])],
    };
  }

  async listPublicPhotos({
    cursor = null,
    limit = 24,
    processId = null,
    source = null,
    collection = null,
  } = {}) {
    const decoded = decodePhotoCursor(cursor);
    const visible = this.#photos
      .filter((photo) => photo.visibility === "public")
      .filter((photo) => !processId || photo.processIds.includes(processId))
      .filter((photo) => !source || photo.source === source)
      .filter((photo) => {
        if (!collection) return true;
        if (collection === "guest") return photo.source === "guest";
        return photo.collection === collection;
      })
      .sort(compareOldestFirst);

    const afterCursor = decoded
      ? visible.filter((photo) => {
          const photoTime = new Date(photo.createdAt).getTime();
          const cursorTime = new Date(decoded.createdAt).getTime();
          return (
            photoTime > cursorTime ||
            (photoTime === cursorTime && String(photo.id) > decoded.id)
          );
        })
      : visible;

    const boundedLimit = Math.max(1, Math.min(Number(limit) || 24, 100));
    const items = afterCursor.slice(0, boundedLimit);
    return {
      items: items.map((photo) => ({
        ...photo,
        processIds: [...photo.processIds],
      })),
      nextCursor:
        afterCursor.length > items.length
          ? encodePhotoCursor(items.at(-1))
          : null,
    };
  }

  async findPublicPhoto(id) {
    const photo = this.#photos.find(
      (item) => item.id === id && item.visibility === "public",
    );
    return photo ? { ...photo, processIds: [...photo.processIds] } : null;
  }

  async updateDriveParentByDriveFile(driveFileId, parentFolderId) {
    const index = this.#photos.findIndex(
      (photo) => photo.driveFileId === driveFileId,
    );
    if (index >= 0) {
      this.#photos[index] = {
        ...this.#photos[index],
        driveParentFolderId: parentFolderId,
        updatedAt: new Date().toISOString(),
      };
    }
  }

  async setVisibility(id, visibility) {
    const index = this.#photos.findIndex((item) => item.id === id);
    if (index < 0) return null;
    this.#photos[index] = {
      ...this.#photos[index],
      visibility,
      updatedAt: new Date().toISOString(),
    };
    return { ...this.#photos[index] };
  }
}
