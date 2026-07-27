import { randomUUID } from "node:crypto";
import type {
  CreatePhoto,
  Photo,
  PhotoCursor,
  PhotoRepository,
  PublicPhotoPage,
} from "./repository";

export class InMemoryPhotoRepository implements PhotoRepository {
  readonly #photos: Photo[] = [];

  async create(input: CreatePhoto): Promise<Photo> {
    if (
      input.legacySourceKey &&
      this.#photos.some(
        (photo) => photo.legacySourceKey === input.legacySourceKey,
      )
    ) {
      throw new Error("Legacy source key already exists");
    }
    if (this.#photos.some((photo) => photo.driveFileId === input.driveFileId)) {
      throw new Error("Drive file ID already exists");
    }
    const createdAt = input.createdAt ?? new Date();
    const photo: Photo = {
      id: randomUUID(),
      driveFileId: input.driveFileId,
      legacySourceKey: input.legacySourceKey ?? null,
      originalFilename: input.originalFilename,
      contentType: input.contentType,
      byteSize: input.byteSize,
      width: input.width ?? null,
      height: input.height ?? null,
      visibility: input.visibility ?? "public",
      createdAt,
      updatedAt: createdAt,
    };
    this.#photos.push(photo);
    return photo;
  }

  async findByLegacySourceKey(sourceKey: string): Promise<Photo | null> {
    return (
      this.#photos.find((photo) => photo.legacySourceKey === sourceKey) ?? null
    );
  }

  async getPublicById(id: string): Promise<Photo | null> {
    return (
      this.#photos.find(
        (photo) => photo.id === id && photo.visibility === "public",
      ) ?? null
    );
  }

  async listPublic(options: {
    limit: number;
    cursor?: PhotoCursor;
  }): Promise<PublicPhotoPage> {
    const sorted = this.#photos
      .filter((photo) => photo.visibility === "public")
      .sort(compareNewestFirst)
      .filter((photo) =>
        options.cursor ? isAfterCursor(photo, options.cursor) : true,
      );
    const page = sorted.slice(0, options.limit + 1);
    const hasNextPage = page.length > options.limit;
    const items = hasNextPage ? page.slice(0, options.limit) : page;
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        hasNextPage && last ? { createdAt: last.createdAt, id: last.id } : null,
    };
  }
}

function compareNewestFirst(left: Photo, right: Photo): number {
  const dateOrder = right.createdAt.getTime() - left.createdAt.getTime();
  return dateOrder || right.id.localeCompare(left.id);
}

function isAfterCursor(photo: Photo, cursor: PhotoCursor): boolean {
  const timestamp = photo.createdAt.getTime();
  const cursorTimestamp = cursor.createdAt.getTime();
  return (
    timestamp < cursorTimestamp ||
    (timestamp === cursorTimestamp && photo.id.localeCompare(cursor.id) < 0)
  );
}
