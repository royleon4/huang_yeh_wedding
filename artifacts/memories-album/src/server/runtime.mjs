import { createMemoriesPhotoApi } from "./photos/api.mjs";
import { PostgresPhotoRepository } from "./photos/postgres-repository.mjs";
import { createReplitDriveStorage } from "./storage/replit-drive.mjs";
import { createGuestUploadApi } from "./uploads/api.mjs";
import { createImageProcessor } from "./uploads/image-processor.mjs";

let runtimePromise;

export function getMemoriesRuntime(env = process.env) {
  runtimePromise ??= createRuntime(env);
  return runtimePromise;
}

async function createRuntime(env) {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for Memories");
  }
  const [{ Pool }, drive] = await Promise.all([
    import("pg"),
    createReplitDriveStorage(env),
  ]);
  const pool = new Pool({ connectionString: env.DATABASE_URL, max: 5 });
  const repository = new PostgresPhotoRepository(pool);
  const imageProcessor = createImageProcessor();
  return {
    pool,
    repository,
    drive,
    imageProcessor,
    photoApi: createMemoriesPhotoApi({ repository, drive }),
    uploadApi: createGuestUploadApi({
      repository,
      drive,
      imageProcessor,
    }),
  };
}
