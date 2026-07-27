import type { Readable } from "node:stream";
import type { DriveAdapter } from "../integrations/google-drive/types";
import type { PhotoRepository } from "./repository";

export type LegacyPhoto = {
  sourceKey: string;
  filename: string;
  contentType: string;
  byteSize: number;
  open: () => Readable | Promise<Readable>;
};

export interface LegacyPhotoSource {
  list(): AsyncIterable<LegacyPhoto>;
}

type LegacyImportDependencies = {
  source: LegacyPhotoSource;
  photos: PhotoRepository;
  drive: DriveAdapter;
};

export async function importLegacyPhotos(
  dependencies: LegacyImportDependencies,
): Promise<{ imported: number; skipped: number }> {
  let imported = 0;
  let skipped = 0;
  for await (const legacyPhoto of dependencies.source.list()) {
    const existing = await dependencies.photos.findByLegacySourceKey(
      legacyPhoto.sourceKey,
    );
    if (existing) {
      skipped += 1;
      continue;
    }
    const body = await streamToBuffer(await legacyPhoto.open());
    const uploaded = await dependencies.drive.upload({
      filename: legacyPhoto.filename,
      contentType: legacyPhoto.contentType,
      body,
    });
    try {
      await dependencies.photos.create({
        driveFileId: uploaded.fileId,
        legacySourceKey: legacyPhoto.sourceKey,
        originalFilename: legacyPhoto.filename,
        contentType: legacyPhoto.contentType,
        byteSize: legacyPhoto.byteSize,
      });
      imported += 1;
    } catch (error) {
      await dependencies.drive.delete(uploaded.fileId).catch(() => undefined);
      throw error;
    }
  }
  return { imported, skipped };
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
