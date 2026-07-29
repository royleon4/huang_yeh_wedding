function clone(album) {
  return { ...album };
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
    };
    this.#albums.push(stored);
    return clone(stored);
  }

  async updateAlbum(album) {
    const index = this.#albums.findIndex((item) => item.id === album.id);
    if (index < 0) return null;
    this.#albums[index] = { ...this.#albums[index], ...album };
    return clone(this.#albums[index]);
  }
}
