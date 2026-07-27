import type { Readable } from "node:stream";

export type DriveUpload = {
  filename: string;
  contentType: string;
  body: Buffer;
};

export type DriveUploadResult = {
  fileId: string;
};

export type DriveDownload = {
  body: Readable;
  contentType?: string;
  byteSize?: number;
};

export interface DriveAdapter {
  upload(file: DriveUpload): Promise<DriveUploadResult>;
  download(fileId: string): Promise<DriveDownload>;
  delete(fileId: string): Promise<void>;
}
