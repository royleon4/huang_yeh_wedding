import { createMemoriesPhotoApi } from "./photos/api.mjs";
import { PostgresPhotoRepository } from "./photos/postgres-repository.mjs";
import { createReplitDriveStorage } from "./storage/replit-drive.mjs";
import { createGuestUploadApi } from "./uploads/api.mjs";
import { createImageProcessor } from "./uploads/image-processor.mjs";
import { PostgresProcessRepository } from "./processes/repository.mjs";
import { DriveProcessSynchronizer } from "./processes/sync.mjs";
import { createProcessApi } from "./processes/api.mjs";

let runtimePromise;

export function getMemoriesRuntime(env = process.env) {
  runtimePromise ??= createRuntime(env);
  return runtimePromise;
}

async function createRuntime(env) {
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
  const processRepository = new PostgresProcessRepository(pool);
  const synchronizer = new DriveProcessSynchronizer({
    drive,
    repository: processRepository,
    rootFolderId: env.MEMORIES_DRIVE_PHOTOS_FOLDER_ID,
  });

  const folders = await synchronizer.ensureStructure();
  drive.originalFolderId = folders.get("訪客上傳")?.id ?? drive.originalFolderId;
  drive.thumbnailFolderId = folders.get("系統縮圖")?.id ?? drive.thumbnailFolderId;

  const imageProcessor = createImageProcessor();
  const runtime = {
    pool,
    repository,
    processRepository,
    synchronizer,
    drive,
    imageProcessor,
    photoApi: createMemoriesPhotoApi({ repository, drive }),
    uploadApi: createGuestUploadApi({
      repository,
      drive,
      imageProcessor,
    }),
    processApi: createProcessApi({
      repository: processRepository,
      synchronizer,
      adminToken: env.MEMORIES_ADMIN_TOKEN,
    }),
  };

  await synchronizer.reconcileFromDrive();
  const intervalMs = Math.max(
    60_000,
    Number(env.MEMORIES_DRIVE_SYNC_INTERVAL_MS ?? 300_000),
  );
  const timer = setInterval(() => {
    void synchronizer.reconcileFromDrive().catch((error) => {
      console.warn("Memories Drive synchronization failed", {
        name: error instanceof Error ? error.name : "UnknownError",
        code: error?.code,
      });
    });
  }, intervalMs);
  timer.unref?.();

  return runtime;
}
