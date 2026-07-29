import { randomUUID } from "node:crypto";
import { decodePhotoCursor, encodePhotoCursor } from "./cursor.mjs";

const SYSTEM_ALBUM_IDS = new Set(["wedding", "guest", "life"]);

function driveDate(file) {
  const value =
    file.imageMediaMetadata?.time ??
    file.createdTime ??
    file.modifiedTime ??
    null;
  const timestamp = new Date(value);
  return Number.isFinite(timestamp.getTime())
    ? timestamp.toISOString()
    : new Date().toISOString();
}

function compareNewestFirst(left, right) {
  const time =
    new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  return time || String(right.id).localeCompare(String(left.id));
}

function duplicateError() {
  const error = new Error("Duplicate photo");
  error.code = "DUPLICATE_PHOTO";
  return error;
}

export class MemoryPhotoRepository {
  #photos;
  #batches;

  constructor(seed = [], batches = []) {
    this.#photos = seed.map((photo) => ({
      ...photo,
      displayName: photo.displayName ?? photo.originalFilename,
      collection:
        photo.collection ?? (photo.source === "guest" ? "guest" : "wedding"),
      albumIds: [
        ...new Set(
          photo.albumIds ?? [
            photo.collection ??
              (photo.source === "guest" ? "guest" : "wedding"),
            ...(photo.source === "guest" ? ["guest"] : []),
          ],
        ),
      ],
      processIds: [...(photo.processIds ?? [])],
      capturedAtOverridden: Boolean(photo.capturedAtOverridden),
      albumMembershipsOverridden: Boolean(photo.albumMembershipsOverridden),
    }));
    this.#batches = new Map(
      batches.map((batch) => [
        batch.id,
        { ...batch, classification: batch.classification ?? "guest" },
      ]),
    );
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
      displayName: photo.displayName ?? photo.originalFilename,
      collection:
        photo.collection ?? (photo.source === "guest" ? "guest" : "wedding"),
      albumIds: [
        ...new Set(
          photo.albumIds ?? [
            photo.collection ??
              (photo.source === "guest" ? "guest" : "wedding"),
            ...(photo.source === "guest" ? ["guest"] : []),
          ],
        ),
      ],
      processIds: [...(photo.processIds ?? [])],
      capturedAtOverridden: Boolean(photo.capturedAtOverridden),
      albumMembershipsOverridden: Boolean(photo.albumMembershipsOverridden),
    };
    this.#photos.push(stored);
    return {
      ...stored,
      albumIds: [...stored.albumIds],
      processIds: [...stored.processIds],
    };
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
    albumId = null,
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
      .filter((photo) => !albumId || photo.albumIds.includes(albumId))
      .sort(compareNewestFirst);

    const afterCursor = decoded
      ? visible.filter((photo) => {
          const photoTime = new Date(photo.createdAt).getTime();
          const cursorTime = new Date(decoded.createdAt).getTime();
          return (
            photoTime < cursorTime ||
            (photoTime === cursorTime && String(photo.id) < decoded.id)
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
    return photo
      ? {
          ...photo,
          albumIds: [...(photo.albumIds ?? [])],
          processIds: [...photo.processIds],
        }
      : null;
  }

  async listAdminPhotos({ limit = 50 } = {}) {
    const boundedLimit = Math.max(1, Math.min(Number(limit) || 50, 100));
    const items = this.#photos
      .filter((photo) => photo.visibility !== "trashed")
      .sort((left, right) => {
        const time =
          new Date(left.createdAt).getTime() -
          new Date(right.createdAt).getTime();
        return time || String(left.id).localeCompare(String(right.id));
      })
      .slice(0, boundedLimit)
      .map((photo) => ({
        ...photo,
        albumIds: [...(photo.albumIds ?? [])],
        processIds: [...(photo.processIds ?? [])],
      }));
    return { items, nextCursor: null };
  }

  async findPhotoForAdmin(id) {
    const photo = this.#photos.find(
      (item) => item.id === id && item.visibility !== "trashed",
    );
    return photo
      ? {
          ...photo,
          albumIds: [...(photo.albumIds ?? [])],
          processIds: [...(photo.processIds ?? [])],
        }
      : null;
  }

  async updatePhotoForAdmin({
    id,
    displayName,
    visibility,
    createdAt,
    albumIds,
    processIds,
  }) {
    const index = this.#photos.findIndex(
      (item) => item.id === id && item.visibility !== "trashed",
    );
    if (index < 0) return null;
    this.#photos[index] = {
      ...this.#photos[index],
      displayName,
      visibility,
      createdAt,
      albumIds: [...albumIds],
      processIds: [...processIds],
      capturedAtOverridden: true,
      albumMembershipsOverridden: true,
      updatedAt: new Date().toISOString(),
    };
    return {
      ...this.#photos[index],
      albumIds: [...this.#photos[index].albumIds],
      processIds: [...this.#photos[index].processIds],
    };
  }

  async upsertDrivePhotoMetadata(
    file,
    {
      source = "official",
      parentFolderId = null,
      collection = source === "guest" ? "guest" : "wedding",
      preserveLogicalClassification = false,
    } = {},
  ) {
    const index = this.#photos.findIndex(
      (photo) => photo.driveFileId === file.id,
    );
    if (index < 0) {
      return this.insertPhoto({
        id: randomUUID(),
        batchId: null,
        driveFileId: file.id,
        thumbnailDriveFileId: null,
        driveParentFolderId: parentFolderId,
        originalFilename: file.name || "Google Drive photo",
        displayName: file.name || "Google Drive photo",
        mimeType: file.mimeType || "image/jpeg",
        byteSize: Number(file.size || 0),
        contentHash: `drive:${file.id}`,
        contentVersion: 1,
        source,
        uploaderName: source === "guest" ? "Google Drive guest" : "婚禮攝影",
        collection,
        visibility: "public",
        processingState: "ready",
        albumIds: [collection],
        processIds: [],
        createdAt: driveDate(file),
        updatedAt: driveDate(file),
      });
    }

    const current = this.#photos[index];
    const albumIds = current.albumMembershipsOverridden
      ? current.albumIds
      : preserveLogicalClassification
        ? [...new Set([...current.albumIds, "guest"])]
        : [
            ...current.albumIds.filter(
              (albumId) => !SYSTEM_ALBUM_IDS.has(albumId),
            ),
            collection,
          ];
    this.#photos[index] = {
      ...current,
      originalFilename: file.name || current.originalFilename,
      mimeType: file.mimeType || current.mimeType,
      byteSize: Number(file.size || current.byteSize || 0),
      driveParentFolderId: parentFolderId,
      collection:
        preserveLogicalClassification || current.albumMembershipsOverridden
          ? current.collection
          : collection,
      albumIds: [...new Set(albumIds)],
      createdAt: current.capturedAtOverridden
        ? current.createdAt
        : driveDate(file),
      updatedAt: new Date().toISOString(),
    };
    return this.findPhotoForAdmin(current.id);
  }

  async replacePhotoProcessByDriveFile(
    driveFileId,
    processId,
    parentFolderId,
    collection = "wedding",
  ) {
    const index = this.#photos.findIndex(
      (photo) => photo.driveFileId === driveFileId,
    );
    if (index < 0) return;
    const current = this.#photos[index];
    const albumIds = current.albumMembershipsOverridden
      ? current.albumIds
      : [
          ...current.albumIds.filter(
            (albumId) => !SYSTEM_ALBUM_IDS.has(albumId),
          ),
          collection,
        ];
    this.#photos[index] = {
      ...current,
      driveParentFolderId: parentFolderId,
      collection: current.albumMembershipsOverridden
        ? current.collection
        : collection,
      albumIds: [...new Set(albumIds)],
      processIds: processId ? [processId] : [],
      updatedAt: new Date().toISOString(),
    };
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
