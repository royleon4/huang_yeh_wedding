import { createMemoriesPhotoApi } from "./photos/api.mjs";
import { createAdminPhotoApi } from "./photos/admin-api.mjs";
import { PostgresAuditRepository } from "./admin/audit-repository.mjs";
import { PostgresPhotoRepository } from "./photos/postgres-repository.mjs";
import { ThumbnailService } from "./photos/thumbnail-service.mjs";
import { TrashCleanupService } from "./photos/trash-cleanup-service.mjs";
import { PublicMediaService } from "./photos/public-media-service.mjs";
import { createReplitDriveStorage } from "./storage/replit-drive.mjs";
import { createGuestUploadApi } from "./uploads/api.mjs";
import { createAdminBatchApi } from "./uploads/admin-api.mjs";
import { PostgresDurableUploadRepository } from "./uploads/durable-repository.mjs";
import { createImageProcessor } from "./uploads/image-processor.mjs";
import { createGuestBatchManagementApi } from "./uploads/management-api.mjs";
import { PostgresProcessRepository } from "./processes/repository.mjs";
import { DriveProcessSynchronizer } from "./processes/sync.mjs";
import { createProcessApi } from "./processes/api.mjs";
import { PostgresSettingsRepository } from "./settings/repository.mjs";
import { createSettingsApi } from "./settings/api.mjs";

const SAFE_RUNTIME_ERROR_CODES = new Set([
  "DATABASE_CONNECTION_FAILED",
  "DATABASE_URL_REQUIRED",
  "DRIVE_AUTHORIZATION_REQUIRED",
  "DRIVE_REQUEST_FAILED",
  "DRIVE_RETRYABLE",
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEDOUT",
  "MEMORIES_ROOT_FOLDER_MISSING",
  "THUMBNAIL_FOLDER_NOT_CONFIGURED",
]);

export function boundedRuntimeErrorCode(error) {
  const code = String(error?.code ?? "");
  return SAFE_RUNTIME_ERROR_CODES.has(code)
    ? code
    : "MEMORIES_RUNTIME_INITIALIZATION_FAILED";
}

function configuredRetryDelay(env) {
  const requested = Number(env.MEMORIES_RUNTIME_RETRY_DELAY_MS ?? 1_000);
  if (!Number.isFinite(requested)) return 1_000;
  return Math.min(60_000, Math.max(250, requested));
}

export function createMemoriesRuntimeManager({
  create = createRuntime,
  now = Date.now,
  logger = console,
  retryDelayMs = configuredRetryDelay,
} = {}) {
  let runtime;
  let inFlight;
  let lastFailure;
  let retryNotBefore = 0;
  let attempt = 0;

  return {
    getRuntime(env = process.env) {
      if (runtime) return Promise.resolve(runtime);
      if (inFlight) return inFlight;
      if (lastFailure && now() < retryNotBefore) {
        return Promise.reject(lastFailure);
      }

      attempt += 1;
      const currentAttempt = attempt;
      const startedAt = now();
      logger.info("Memories runtime initialization started", {
        attempt: currentAttempt,
      });

      inFlight = Promise.resolve()
        .then(() => create(env))
        .then(
          (createdRuntime) => {
            runtime = createdRuntime;
            lastFailure = undefined;
            retryNotBefore = 0;
            logger.info("Memories runtime initialization completed", {
              attempt: currentAttempt,
              durationMs: now() - startedAt,
            });
            return createdRuntime;
          },
          (error) => {
            const delay = retryDelayMs(env);
            lastFailure = error;
            retryNotBefore = now() + delay;
            logger.warn("Memories runtime initialization failed", {
              attempt: currentAttempt,
              durationMs: now() - startedAt,
              code: boundedRuntimeErrorCode(error),
              retryAfterMs: delay,
            });
            throw error;
          },
        )
        .finally(() => {
          inFlight = undefined;
        });

      return inFlight;
    },
  };
}

const runtimeManager = createMemoriesRuntimeManager();

export function getMemoriesRuntime(env = process.env) {
  return runtimeManager.getRuntime(env);
}

async function createRuntime(env) {
  if (!env.DATABASE_URL) {
    const error = new Error("DATABASE_URL is required for Memories");
    error.code = "DATABASE_URL_REQUIRED";
    throw error;
  }
  if (!env.MEMORIES_DRIVE_PHOTOS_FOLDER_ID) {
    const error = new Error("MEMORIES_DRIVE_PHOTOS_FOLDER_ID is required");
    error.code = "MEMORIES_ROOT_FOLDER_MISSING";
    throw error;
  }

  let pool;
  try {
    const [{ Pool }, drive] = await Promise.all([
      import("pg"),
      createReplitDriveStorage(env),
    ]);
    pool = new Pool({ connectionString: env.DATABASE_URL, max: 5 });
    const repository = new PostgresPhotoRepository(pool);
    const durableUploadRepository = new PostgresDurableUploadRepository(pool);
    const processRepository = new PostgresProcessRepository(pool);
    const settingsRepository = new PostgresSettingsRepository(pool);
    const auditRepository = new PostgresAuditRepository(pool);
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
    const trashCleanupService = new TrashCleanupService({
      repository,
      drive,
      batchSize: Number(env.MEMORIES_TRASH_CLEANUP_BATCH_SIZE ?? 20),
      leaseMs: Number(env.MEMORIES_TRASH_CLEANUP_LEASE_MS ?? 300_000),
    });
    const publicMediaService = new PublicMediaService({
      drive,
      imageProcessor,
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
            console.warn(
              "Memories thumbnail backfill completed with failures",
              {
                attempted: result.attempted,
                createdOrAttached: result.createdOrAttached,
                failureCount: result.failures.length,
                failureCodes: [
                  ...new Set(result.failures.map((failure) => failure.code)),
                ],
              },
            );
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
      auditRepository,
      synchronizer,
      thumbnailService,
      publicMediaService,
      trashCleanupService,
      drive,
      imageProcessor,
      photoApi: createMemoriesPhotoApi({
        repository,
        drive,
        thumbnailService,
        publicMediaService,
      }),
      adminPhotoApi: createAdminPhotoApi({
        repository,
        adminToken: env.MEMORIES_ADMIN_TOKEN,
        auditRepository,
      }),
      adminBatchApi: createAdminBatchApi({
        repository,
        adminToken: env.MEMORIES_ADMIN_TOKEN,
        auditRepository,
      }),
      uploadApi: createGuestUploadApi({
        repository,
        durableUploadRepository,
        processRepository,
        drive,
        imageProcessor,
      }),
      managementApi: createGuestBatchManagementApi({
        repository,
        auditRepository,
      }),
      processApi: createProcessApi({
        repository: processRepository,
        synchronizer,
        adminToken: env.MEMORIES_ADMIN_TOKEN,
        auditRepository,
      }),
      settingsApi: createSettingsApi({
        repository: settingsRepository,
        adminToken: env.MEMORIES_ADMIN_TOKEN,
        auditRepository,
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

    let cleanupPromise = null;
    const runTrashCleanup = () => {
      if (cleanupPromise) return cleanupPromise;
      cleanupPromise = trashCleanupService
        .runOnce()
        .then((result) => {
          if (result.claimed > 0) {
            console.info("Memories trash cleanup completed", result);
          }
          return result;
        })
        .catch((error) => {
          console.warn("Memories trash cleanup failed", {
            code: boundedRuntimeErrorCode(error),
          });
        })
        .finally(() => {
          cleanupPromise = null;
        });
      return cleanupPromise;
    };

    setImmediate(() => {
      void runBackgroundSynchronization();
      void runTrashCleanup();
    });

    const intervalMs = Math.max(
      60_000,
      Number(env.MEMORIES_DRIVE_SYNC_INTERVAL_MS ?? 300_000),
    );
    const timer = setInterval(() => {
      void runBackgroundSynchronization();
    }, intervalMs);
    timer.unref?.();
    const cleanupIntervalMs = Math.max(
      60_000,
      Number(env.MEMORIES_TRASH_CLEANUP_INTERVAL_MS ?? 300_000),
    );
    const cleanupTimer = setInterval(() => {
      void runTrashCleanup();
    }, cleanupIntervalMs);
    cleanupTimer.unref?.();

    return runtime;
  } catch (error) {
    if (pool) {
      try {
        await pool.end();
      } catch (cleanupError) {
        console.warn("Memories failed runtime pool cleanup", {
          code: boundedRuntimeErrorCode(cleanupError),
        });
      }
    }
    throw error;
  }
}
