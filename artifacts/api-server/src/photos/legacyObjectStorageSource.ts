import type { LegacyPhotoSource } from "./legacyImport";
import { objectStorageClient } from "../lib/objectStorage";

const IMAGE_FILENAME = /\.(?:gif|heic|jpe?g|png|webp)$/i;

export class ObjectStorageLegacyPhotoSource implements LegacyPhotoSource {
  readonly #bucketId: string;
  readonly #prefix: string;

  constructor(options: { bucketId: string; prefix?: string }) {
    this.#bucketId = options.bucketId;
    this.#prefix = options.prefix ?? "photos/wedding/";
  }

  async *list() {
    const [files] = await objectStorageClient.bucket(this.#bucketId).getFiles({
      prefix: this.#prefix,
    });
    for (const file of files) {
      if (!IMAGE_FILENAME.test(file.name)) {
        continue;
      }
      const [metadata] = await file.getMetadata();
      const filename = file.name.slice(this.#prefix.length);
      const byteSize = Number(metadata.size);
      if (!filename || !Number.isSafeInteger(byteSize) || byteSize < 0) {
        continue;
      }
      yield {
        sourceKey: file.name,
        filename,
        contentType:
          typeof metadata.contentType === "string"
            ? metadata.contentType
            : "application/octet-stream",
        byteSize,
        open: () => file.createReadStream(),
      };
    }
  }
}
