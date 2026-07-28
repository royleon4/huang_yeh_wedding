import { createMemoriesPhotoApi } from "./photos/api.mjs";
import { PostgresPhotoRepository } from "./photos/postgres-repository.mjs";
import { ThumbnailService } from "./photos/thumbnail-service.mjs";
import { createReplitDriveStorage } from "./storage/replit-drive.mjs";
import { createGuestUploadApi } from "./uploads/api.mjs";
import { PostgresDurableUploadRepository } from "./uploads/durable-repository.mjs";
import { createImageProcessor } from "./uploads/image-processor.mjs";
import { PostgresProcessRepository } from "./processes/repository.mjs";
import { DriveProcessSynchronizer } from "./processes/sync.mjs";
import { createProcessApi } from "./processes/api.mjs";
import { PostgresSettingsRepository } from "./settings/repository.mjs";
import { createSettingsApi } from "./settings/api.mjs";

let runtimePromise;

export function getMemoriesRuntime(env = process.env) {
  runtimePromise ??= createRuntime(env);
  return runtimePromise;
}

async function createRuntime(env) {
  const startedAt = Date.now();
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for Memories");
  }
  if (!env.MEMORIES_DRIVE_PHOTOS_FOLDER_ID) {
    const error = new Error("MEMORIES_DRIVE_PHOTOS_FOLDER_ID is required");
    error.code = "MEMORIES_ROOT_FOLDER_MISSING";
    throw error;
  }

  const [{ Pool }, drive] = await Promise.all([
    import("pg"),
    createReplitDriveStorage(env),
  ]);
  const pool = new Pool({ connectionString: env.DATABASE_URL, max: 5 });
  const repository = new PostgresPhotoRepository(pool);
  repository.clearThumbnail = async (photoId, expectedFileId = null) => {
    const result = await pool.query(
      `UPDATE memories_photos
       SET thumbnail_drive_file_id = NULL, updated_at = now()
       WHERE id = $1
         AND ($2::text IS NULL OR thumbnail_drive_file_id = $2)
       RETURNING id`,
      [photoId, expectedFileId],
    );
    if (!result.rows[0]) {
      const current = await repository.findPublicPhoto(photoId);
      if (current && !current.thumbnailDriveFileId) return current;
      const error = new Error("Thumbnail reference changed during repair");
      error.code = "THUMBNAIL_REPAIR_CONFLICT";
      throw error;
    }
    return repository.findPublicPhoto(photoId);
  };
  const durableUploadRepository = new PostgresDurableUploadRepository(pool);
  const processRepository = new PostgresProcessRepository(pool);
  const settingsRepository = new PostgresSettingsRepository(pool);
  const synchronizer = new DriveProcessSynchronizer({
    drive,
    processRepository,
    photoRepository: repository,
    rootFolderId: env.MEMORIES_DRIVE_PHOTOS_FOLDER_ID,
  });

  // Only the small root-folder lookup is required before serving requests. The
  // expensive scan of every process folder and photo runs after the API is ready.
  const folders = await synchronizer.ensureStructure();
  drive.originalFolderId =
    folders.get("訪客上傳")?.id ?? drive.originalFolderId;
  drive.thumbnailFolderId =
    folders.get("系統縮圖")?.id ?? drive.thumbnailFolderId;

  if (!drive.thumbnailFolderId) {
    const error = new Error("Memories thumbnail folder is unavailable");
    error.code = "THUMBNAIL_FOLDER_NOT_CONFIGURED";
    throw error;
  }

  const imageProcessor = createImageProcessor();
  const thumbnailService = new ThumbnailService({
    repository,
    drive,
    imageProcessor,
    thumbnailFolderId: drive.thumbnailFolderId,
    batchSize: Number(env.MEMORIES_THUMBNAIL_BATCH_SIZE ?? 12),
  });

  let backfillPromise = null;
  const runThumbnailBackfill = () => {
    if (backfillPromise) return backfillPromise;
    thumbnailService.invalidateIndex();
    backfillPromise = thumbnailService
      .backfillMissing({
        maxPhotos: Number(env.MEMORIES_THUMBNAIL_MAX_PER_RUN ?? 240),
      })
      .then((result) => {
        if (result.failures.length > 0) {
          console.warn("Memories thumbnail backfill completed with failures", {
            attempted: result.attempted,
            createdOrAttached: result.createdOrAttached,
            failureCount: result.failures.length,
            failureCodes: [
              ...new Set(result.failures.map((failure) => failure.code)),
            ],
          });
        }
        return result;
      })
      .catch((error) => {
        console.warn("Memories thumbnail backfill failed", {
          name: error instanceof Error ? error.name : "UnknownError",
          code: error?.code,
        });
      })
      .finally(() => {
        backfillPromise = null;
      });
    return backfillPromise;
  };

  const runtime = {
    pool,
    repository,
    durableUploadRepository,
    processRepository,
    settingsRepository,
    synchronizer,
    thumbnailService,
    drive,
    imageProcessor,
    photoApi: createMemoriesPhotoApi({
      repository,
      drive,
      thumbnailService,
    }),
    uploadApi: createGuestUploadApi({
      repository,
      durableUploadRepository,
      processRepository,
      drive,
      imageProcessor,
    }),
    processApi: createProcessApi({
      repository: processRepository,
      synchronizer,
      adminToken: env.MEMORIES_ADMIN_TOKEN,
    }),
    settingsApi: createSettingsApi({
      repository: settingsRepository,
      adminToken: env.MEMORIES_ADMIN_TOKEN,
    }),
  };

  let synchronizationPromise = null;
  const runBackgroundSynchronization = () => {
    if (synchronizationPromise) return synchronizationPromise;
    const syncStartedAt = Date.now();
    synchronizationPromise = synchronizer
      .reconcileFromDrive()
      .then(() => runThumbnailBackfill())
      .then(() => {
        console.log("Memories background synchronization completed", {
          durationMs: Date.now() - syncStartedAt,
        });
      })
      .catch((error) => {
        console.warn("Memories Drive synchronization failed", {
          name: error instanceof Error ? error.name : "UnknownError",
          code: error?.code,
          durationMs: Date.now() - syncStartedAt,
        });
      })
      .finally(() => {
        synchronizationPromise = null;
      });
    return synchronizationPromise;
  };

  console.log("Memories runtime ready", {
    durationMs: Date.now() - startedAt,
    backgroundDriveSync: true,
  });
  setImmediate(() => void runBackgroundSynchronization());

  const intervalMs = Math.max(
    60_000,
    Number(env.MEMORIES_DRIVE_SYNC_INTERVAL_MS ?? 300_000),
  );
  const timer = setInterval(() => {
    void runBackgroundSynchronization();
  }, intervalMs);
  timer.unref?.();

  return runtime;
}
