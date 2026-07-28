import { decodePhotoCursor, encodePhotoCursor } from "./cursor.mjs";

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
      processIds: [...(photo.processIds ?? [])],
    }));
    this.#batches = new Map(
      batches.map((batch) => [batch.id, { ...batch }]),
    );
  }

  async createUploadBatch(batch) {
    if (this.#batches.has(batch.id)) throw new Error("Duplicate batch id");
    this.#batches.set(batch.id, { ...batch, status: batch.status ?? "open" });
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
    this.#photos.push({
      ...photo,
      processIds: [...(photo.processIds ?? [])],
    });
    return { ...photo, processIds: [...(photo.processIds ?? [])] };
  }

  async listPublicPhotos({
    cursor = null,
    limit = 24,
    processId = null,
    source = null,
  } = {}) {
    const decoded = decodePhotoCursor(cursor);
    const visible = this.#photos
      .filter((photo) => photo.visibility === "public")
      .filter((photo) => !processId || photo.processIds.includes(processId))
      .filter((photo) => !source || photo.source === source)
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
      ? { ...photo, processIds: [...photo.processIds] }
      : null;
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
