import { Readable } from "node:stream";
import { ReplitConnectors } from "@replit/connectors-sdk";
import type {
  DriveAdapter,
  DriveDownload,
  DriveUpload,
  DriveUploadResult,
} from "./types";

type DriveRequestOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Buffer;
};

export type DriveProxy = (
  connector: "google-drive",
  path: string,
  options?: DriveRequestOptions,
) => Promise<Response>;

type GoogleDriveAdapterOptions = {
  proxy: DriveProxy;
  folderId: string;
};

export class GoogleDriveAdapter implements DriveAdapter {
  readonly #proxy: DriveProxy;
  readonly #folderId: string;

  constructor(options: GoogleDriveAdapterOptions) {
    this.#proxy = options.proxy;
    this.#folderId = options.folderId;
  }

  async upload(file: DriveUpload): Promise<DriveUploadResult> {
    const boundary = `wedding_${crypto.randomUUID()}`;
    const metadata = JSON.stringify({
      name: file.filename,
      parents: [this.#folderId],
    });
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
          `--${boundary}\r\nContent-Type: ${file.contentType}\r\n\r\n`,
      ),
      file.body,
      Buffer.from(`\r\n--${boundary}--`),
    ]);
    const response = await this.#driveApi(
      "/upload/drive/v3/files?uploadType=multipart&fields=id&supportsAllDrives=true",
      {
        method: "POST",
        headers: {
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
      },
    );
    const data = (await response.json()) as { id?: unknown };
    if (typeof data.id !== "string" || data.id.length === 0) {
      throw new Error("Google Drive upload did not return a file ID");
    }
    return { fileId: data.id };
  }

  async download(fileId: string): Promise<DriveDownload> {
    const response = await this.#driveApi(
      `/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    );
    if (!response.body) {
      throw new Error("Google Drive returned an empty response body");
    }
    const contentLength = response.headers.get("content-length");
    const byteSize = contentLength ? Number(contentLength) : undefined;
    return {
      body: Readable.fromWeb(
        response.body as import("node:stream/web").ReadableStream,
      ),
      contentType: response.headers.get("content-type") ?? undefined,
      byteSize:
        byteSize !== undefined && Number.isSafeInteger(byteSize)
          ? byteSize
          : undefined,
    };
  }

  async delete(fileId: string): Promise<void> {
    await this.#driveApi(
      `/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`,
      { method: "DELETE" },
    );
  }

  async #driveApi(
    path: string,
    options?: DriveRequestOptions,
  ): Promise<Response> {
    const response = await this.#proxy("google-drive", path, options);
    if (!response.ok) {
      throw new Error(
        `Google Drive API request failed with status ${response.status}`,
      );
    }
    return response;
  }
}

export function createGoogleDriveAdapterFromEnv(): GoogleDriveAdapter {
  const folderId = process.env["GOOGLE_DRIVE_PHOTOS_FOLDER_ID"];
  if (!folderId) {
    throw new Error(
      "GOOGLE_DRIVE_PHOTOS_FOLDER_ID must be configured for photo storage",
    );
  }
  const connectors = new ReplitConnectors();
  const proxy: DriveProxy = (connector, path, options) =>
    connectors.proxy(connector, path, options);
  return new GoogleDriveAdapter({ proxy, folderId });
}
