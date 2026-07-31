import { createMemoriesPhotoApi } from "./photos/api.mjs";
import { createAdminPhotoApi } from "./photos/admin-with-changes-api.mjs";
import { PostgresPhotoRepository } from "./photos/postgres-repository.mjs";
import { ThumbnailService } from "./photos/thumbnail-service.mjs";
import { AdminRefreshService } from "./refresh/service.mjs";
import { createReplitDriveStorage } from "./storage/replit-drive.mjs";
import { uploadOriginalSingleRequest } from "./storage/single-request-upload.mjs";
import { createGuestUploadApi, UploadApiError } from "./uploads/api.mjs";
import { PostgresDurableUploadRepository } from "./uploads/durable-repository.mjs";
import {
  createGuestUploadRepositoryGuard,
  RESERVED_GUEST_UPLOADER_ERROR_CODE,
  RESERVED_GUEST_UPLOADER_MESSAGE,
} from "./uploads/guest-uploader-guard.mjs";
import { createImageProcessor } from "./uploads/image-processor.mjs";
import { createGuestBatchManagementApi } from "./uploads/management-api.mjs";
import { PostgresUploadManagementRepository } from "./uploads/management-repository.mjs";
import { PostgresProcessRepository } from "./processes/repository.mjs";
import { DriveProcessSynchronizer } from "./processes/sync.mjs";
import { createProcessApi } from "./processes/api.mjs";
import { PostgresProcessContentRepository } from "./process-content/repository.mjs";
import {
  createAdminProcessContentApi,
  createProcessContentApi,
} from "./process-content/api.mjs";
import { PostgresSettingsRepository } from "./settings/repository.mjs";
import {
  createAdminSettingsApi,
  createSettingsApi,
} from "./settings/api.mjs";
import { createAlbumApi } from "./albums/api.mjs";
import { createAdminAlbumApi } from "./albums/admin-api.mjs";
import { PostgresAlbumRepository } from "./albums/postgres-repository.mjs";
import { createAdminCategoryApi } from "./categories/admin-api.mjs";
import {
  runMemoriesMigrations,
  shouldRunProductionMigrations,
} from "./migrations.mjs";

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

  if (shouldRunProductionMigrations(env)) {
    await runMemoriesMigrations({ databaseUrl: env.DATABASE_URL });
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
      const current = await repository.findPhotoForAdmin(photoId);
      if (current && !current.thumbnailDriveFileId) return current;
      const error = new Error("Thumbnail reference changed during repair");
      error.code = "THUMBNAIL_REPAIR_CONFLICT";
      throw error;
    }
    return repository.findPhotoForAdmin(photoId);
  };
  const durableUploadRepository = new PostgresDurableUploadRepository(pool);
  const uploadManagementRepository = new PostgresUploadManagementRepository(pool);
  const processRepository = new PostgresProcessRepository(pool);
  const processContentRepository = new PostgresProcessContentRepository(pool);
  const settingsRepository = new PostgresSettingsRepository(pool);
  const chunkedUploadOriginal = drive.uploadOriginal.bind(drive);
  drive.uploadOriginal = async (options) => {
    const uploadMode = await settingsRepository.getDriveUploadMode();
    if (uploadMode === "chunked") return chunkedUploadOriginal(options);
    return uploadOriginalSingleRequest({ drive, ...options });
  };
  const albumRepository = new PostgresAlbumRepository(pool);
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
  drive.unclassifiedFolderId =
    folders.get("00 未分類")?.id ?? drive.unclassifiedFolderId;
  drive.lifeFolderId = folders.get("生活照")?.id ?? drive.lifeFolderId;
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
  const refreshService = new AdminRefreshService({
    repository,
    drive,
    synchronizer,
    thumbnailService,
  });

  const guestUploadRepository = createGuestUploadRepositoryGuard(repository, {
    createReservedNameError: () =>
      new UploadApiError(
        422,
        RESERVED_GUEST_UPLOADER_MESSAGE,
        RESERVED_GUEST_UPLOADER_ERROR_CODE,
      ),
  });
  const guestUploadApi = createGuestUploadApi({
    repository: guestUploadRepository,
    durableUploadRepository,
    processRepository,
    drive,
    imageProcessor,
    thumbnailService,
  });
  const guestBatchManagementApi = createGuestBatchManagementApi({
    repository: uploadManagementRepository,
    drive,
  });
  const uploadApi = async (request, response, url) => {
    if (await guestBatchManagementApi(request, response, url)) return true;
    return guestUploadApi(request, response, url);
  };

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
    uploadManagementRepository,
    processRepository,
    processContentRepository,
    settingsRepository,
    albumRepository,
    synchronizer,
    thumbnailService,
    refreshService,
    drive,
    imageProcessor,
    photoApi: createMemoriesPhotoApi({
      repository,
      drive,
      thumbnailService,
    }),
    albumApi: createAlbumApi({
      repository: albumRepository,
    }),
    adminAlbumApi: createAdminAlbumApi({
      repository: albumRepository,
      adminToken: env.MEMORIES_ADMIN_TOKEN,
    }),
    adminCategoryApi: createAdminCategoryApi({
      repository: processRepository,
      synchronizer,
      adminToken: env.MEMORIES_ADMIN_TOKEN,
    }),
    adminProcessContentApi: createAdminProcessContentApi({
      repository: processContentRepository,
      processRepository,
      drive,
      adminToken: env.MEMORIES_ADMIN_TOKEN,
    }),
    adminPhotoApi: createAdminPhotoApi({
      repository,
      albumRepository,
      categoryRepository: processRepository,
      drive,
      imageProcessor,
      synchronizer,
      refreshService,
      adminToken: env.MEMORIES_ADMIN_TOKEN,
    }),
    adminSettingsApi: createAdminSettingsApi({
      repository: settingsRepository,
    }),
    uploadApi,
    processApi: createProcessApi({
      repository: processRepository,
      contentRepository: processContentRepository,
    }),
    processContentApi: createProcessContentApi({
      repository: processContentRepository,
      drive,
    }),
    settingsApi: createSettingsApi({
      repository: settingsRepository,
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
