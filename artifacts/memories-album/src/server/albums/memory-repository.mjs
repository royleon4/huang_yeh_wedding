import {
  DEFAULT_ALBUM_PHOTO_SORT_MODE,
  normalizeAlbumPhotoSortMode,
} from "../../../album-photo-order.mjs";
import { normalizeAlbumType } from "../../../album-types.mjs";

function clone(album) {
  return {
    ...album,
    albumType: normalizeAlbumType(album.albumType),
    showSummary: album.showSummary !== false,
    photoSortMode: normalizeAlbumPhotoSortMode(
      album.photoSortMode ?? DEFAULT_ALBUM_PHOTO_SORT_MODE,
    ),
  };
}

function assertMessageSingleton(albums, album, currentId = null) {
  if (normalizeAlbumType(album.albumType) !== "message") return;
  if (
    albums.some(
      (item) =>
        item.id !== currentId && normalizeAlbumType(item.albumType) === "message",
    )
  ) {
    const error = new Error("Only one Guestbook message album is allowed");
    error.code = "MESSAGE_ALBUM_EXISTS";
    throw error;
  }
}

export class MemoryAlbumRepository {
  #albums;

  constructor(seed = []) {
    this.#albums = seed.map(clone);
  }

  async listAdminAlbums() {
    return this.#albums
      .map(clone)
      .sort(
        (left, right) =>
          left.displayOrder - right.displayOrder ||
          String(left.id).localeCompare(String(right.id)),
      );
  }

  async listPublicAlbums() {
    return (await this.listAdminAlbums()).filter((album) => album.isVisible);
  }

  async createAlbum(album) {
    if (this.#albums.some((item) => item.id === album.id)) {
      const error = new Error("Album already exists");
      error.code = "ALBUM_EXISTS";
      throw error;
    }
    assertMessageSingleton(this.#albums, album);
    const nextOrder =
      this.#albums.reduce(
        (highest, item) => Math.max(highest, item.displayOrder),
        0,
      ) + 1;
    const stored = {
      ...album,
      albumType: normalizeAlbumType(album.albumType),
      displayOrder: nextOrder,
      isVisible: album.isVisible !== false,
      isSystem: album.isSystem === true,
      showSummary: album.showSummary !== false,
      photoSortMode: normalizeAlbumPhotoSortMode(album.photoSortMode),
    };
    this.#albums.push(stored);
    return clone(stored);
  }

  async updateAlbum(album) {
    const index = this.#albums.findIndex((item) => item.id === album.id);
    if (index < 0) return null;
    const existing = this.#albums[index];
    if (
      existing.isSystem &&
      normalizeAlbumType(existing.albumType) === "message" &&
      normalizeAlbumType(album.albumType) !== "message"
    ) {
      const error = new Error("The system Guestbook album type cannot be changed");
      error.code = "MESSAGE_ALBUM_REQUIRED";
      throw error;
    }
    assertMessageSingleton(this.#albums, album, album.id);
    this.#albums[index] = {
      ...existing,
      ...album,
      albumType: normalizeAlbumType(album.albumType),
      showSummary: album.showSummary !== false,
      photoSortMode: normalizeAlbumPhotoSortMode(album.photoSortMode),
    };
    return clone(this.#albums[index]);
  }
}
