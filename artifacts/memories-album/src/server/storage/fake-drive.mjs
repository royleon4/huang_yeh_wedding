export class FakeDriveStorage {
  constructor(seed = []) {
    this.files = new Map(seed.map((file) => [file.fileId, { ...file, bytes: Buffer.from(file.bytes) }]));
    this.calls = [];
    this.nextId = seed.length + 1;
  }

  async uploadOriginal(input) {
    return this.#store("original", input);
  }

  async uploadThumbnail(input) {
    return this.#store("thumbnail", input);
  }

  async #store(kind, input) {
    const fileId = `drive-${kind}-${this.nextId++}`;
    this.calls.push({ operation: "upload", kind, filename: input.filename });
    this.files.set(fileId, { fileId, bytes: Buffer.from(input.bytes), contentType: input.contentType, filename: input.filename });
    return { fileId, name: input.filename, size: input.bytes.length };
  }

  async download(fileId) {
    this.calls.push({ operation: "download", fileId });
    const file = this.files.get(fileId);
    if (!file) {
      const error = new Error("Not found");
      error.status = 404;
      throw error;
    }
    return { body: file.bytes, contentType: file.contentType, contentLength: file.bytes.length };
  }

  async delete(fileId) {
    this.calls.push({ operation: "delete", fileId });
    this.files.delete(fileId);
  }
}
