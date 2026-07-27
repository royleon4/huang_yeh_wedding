import { pool } from "@workspace/db";
import { createGoogleDriveAdapterFromEnv } from "../integrations/google-drive/client";
import { importLegacyPhotos } from "../photos/legacyImport";
import { ObjectStorageLegacyPhotoSource } from "../photos/legacyObjectStorageSource";
import { PostgresPhotoRepository } from "../photos/repository.postgres";

const bucketId = process.env["DEFAULT_OBJECT_STORAGE_BUCKET_ID"];
if (!bucketId) {
  throw new Error(
    "DEFAULT_OBJECT_STORAGE_BUCKET_ID must be configured for legacy import",
  );
}

try {
  const result = await importLegacyPhotos({
    source: new ObjectStorageLegacyPhotoSource({ bucketId }),
    photos: new PostgresPhotoRepository(),
    drive: createGoogleDriveAdapterFromEnv(),
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
} finally {
  await pool.end();
}
