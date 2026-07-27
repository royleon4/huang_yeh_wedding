import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import type {
  DriveAdapter,
  DriveDownload,
  DriveUpload,
  DriveUploadResult,
} from "./types";

type StoredFakeFile = {
  contentType: string;
  body: Buffer;
};

export class InMemoryDriveAdapter implements DriveAdapter {
  readonly #files = new Map<string, StoredFakeFile>();
  readonly uploadedFiles: Array<DriveUpload & { fileId: string }> = [];
  readonly downloadedFileIds: string[] = [];
  readonly deletedFileIds: string[] = [];

  async upload(file: DriveUpload): Promise<DriveUploadResult> {
    const fileId = randomUUID();
    const stored = { ...file, body: Buffer.from(file.body), fileId };
    this.#files.set(fileId, {
      contentType: file.contentType,
      body: stored.body,
    });
    this.uploadedFiles.push(stored);
    return { fileId };
  }

  async download(fileId: string): Promise<DriveDownload> {
    this.downloadedFileIds.push(fileId);
    const file = this.#files.get(fileId);
    if (!file) {
      throw new Error("Fake Drive file not found");
    }
    return {
      body: Readable.from(file.body),
      contentType: file.contentType,
      byteSize: file.body.length,
    };
  }

  async delete(fileId: string): Promise<void> {
    this.deletedFileIds.push(fileId);
    this.#files.delete(fileId);
  }
}
