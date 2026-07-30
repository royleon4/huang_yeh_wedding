import {
  DEFAULT_ALBUM_PHOTO_SORT_MODE,
  normalizeAlbumPhotoSortMode,
} from "../../../album-photo-order.mjs";

function clone(album) {
  return {
    ...album,
    showSummary: album.showSummary !== false,
    photoSortMode: normalizeAlbumPhotoSortMode(
      album.photoSortMode ?? DEFAULT_ALBUM_PHOTO_SORT_MODE,
    ),
  };
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
    const nextOrder =
      this.#albums.reduce(
        (highest, item) => Math.max(highest, item.displayOrder),
        0,
      ) + 1;
    const stored = {
      ...album,
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
    this.#albums[index] = {
      ...this.#albums[index],
      ...album,
      showSummary: album.showSummary !== false,
      photoSortMode: normalizeAlbumPhotoSortMode(album.photoSortMode),
    };
    return clone(this.#albums[index]);
  }
}
