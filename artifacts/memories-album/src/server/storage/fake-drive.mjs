import { readFile } from "node:fs/promises";

export class FakeDriveStorage {
  constructor(seed = []) {
    this.originalFolderId = "fake-original-folder";
    this.thumbnailFolderId = "fake-thumbnail-folder";
    this.files = new Map(
      seed.map((file) => [
        file.fileId,
        { ...file, bytes: Buffer.from(file.bytes) },
      ]),
    );
    this.calls = [];
    this.nextId = seed.length + 1;
  }

  async findChildByName(parentId, filename) {
    this.calls.push({ operation: "find", parentId, filename });
    return (
      [...this.files.values()].find(
        (file) => file.parentId === parentId && file.filename === filename,
      ) ?? null
    );
  }

  async uploadOriginal(input) {
    return this.#store("original", {
      ...input,
      parentId: input.parentId ?? this.originalFolderId,
    });
  }

  async uploadThumbnail(input) {
    return this.#store("thumbnail", {
      ...input,
      parentId: input.parentId ?? this.thumbnailFolderId,
    });
  }

  async #store(kind, input) {
    const existing = await this.findChildByName(input.parentId, input.filename);
    if (existing) {
      return {
        fileId: existing.fileId,
        name: existing.filename,
        size: existing.bytes.length,
        reused: true,
      };
    }
    const bytes = input.filePath ? await readFile(input.filePath) : Buffer.from(input.bytes);
    const fileId = `drive-${kind}-${this.nextId++}`;
    this.calls.push({ operation: "upload", kind, filename: input.filename });
    this.files.set(fileId, {
      fileId,
      bytes,
      contentType: input.contentType,
      filename: input.filename,
      parentId: input.parentId,
    });
    await input.onSession?.({ sessionUri: `fake://${fileId}`, uploadedBytes: 0 });
    await input.onProgress?.({
      sessionUri: `fake://${fileId}`,
      uploadedBytes: bytes.length,
    });
    return { fileId, name: input.filename, size: bytes.length, reused: false };
  }

  async download(fileId) {
    this.calls.push({ operation: "download", fileId });
    const file = this.files.get(fileId);
    if (!file) {
      const error = new Error("Not found");
      error.status = 404;
      throw error;
    }
    return {
      body: file.bytes,
      contentType: file.contentType,
      contentLength: file.bytes.length,
    };
  }

  async delete(fileId) {
    this.calls.push({ operation: "delete", fileId });
    this.files.delete(fileId);
  }
}
