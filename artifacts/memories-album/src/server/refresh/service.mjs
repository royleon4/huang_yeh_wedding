import { randomUUID } from "node:crypto";
import { thumbnailFilenameForDriveFileId } from "../photos/thumbnail-service.mjs";

const TERMINAL_STATUSES = new Set(["completed", "completed_with_errors", "failed"]);
const MAX_RETAINED_JOBS = 50;

function cloneJob(job) {
  return {
    id: job.id,
    scopeType: job.scopeType,
    scopeId: job.scopeId,
    scopeLabel: job.scopeLabel,
    status: job.status,
    stage: job.stage,
    total: job.total,
    processed: job.processed,
    rebuilt: job.rebuilt,
    deletedThumbnails: job.deletedThumbnails,
    failures: [...job.failures],
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

function photoFromRow(row) {
  return {
    id: row.id,
    driveFileId: row.drive_file_id,
    thumbnailDriveFileId: row.thumbnail_drive_file_id,
    mimeType: row.mime_type,
    processingState: row.processing_state,
    visibility: row.visibility,
  };
}

async function listScopePhotos(repository, scopeType, scopeId) {
  if (repository.pool?.query) {
    const relation =
      scopeType === "album"
        ? {
            table: "memories_photo_albums",
            photoColumn: "photo_id",
            scopeColumn: "album_id",
          }
        : {
            table: "memories_photo_processes",
            photoColumn: "photo_id",
            scopeColumn: "process_id",
          };
    const result = await repository.pool.query(
      `SELECT p.id, p.drive_file_id, p.thumbnail_drive_file_id,
              p.mime_type, p.processing_state, p.visibility
       FROM memories_photos p
       WHERE p.visibility <> 'trashed'
         AND p.drive_file_id IS NOT NULL
         AND EXISTS (
           SELECT 1
           FROM ${relation.table} membership
           WHERE membership.${relation.photoColumn} = p.id
             AND membership.${relation.scopeColumn} = $1
         )
       ORDER BY p.created_at ASC, p.id ASC`,
      [scopeId],
    );
    return result.rows.map(photoFromRow);
  }

  const page = await repository.listAdminPhotos({ limit: 100 });
  return page.items.filter((photo) =>
    scopeType === "album"
      ? photo.albumIds?.includes(scopeId)
      : photo.processIds?.includes(scopeId),
  );
}

function active(job) {
  return !TERMINAL_STATUSES.has(job.status);
}

function setStage(job, stage) {
  job.stage = stage;
  job.updatedAt = new Date().toISOString();
}

function scopeKey(scopeType, scopeId) {
  return `${scopeType}:${scopeId}`;
}

async function deleteDerivative(drive, fileId) {
  if (!fileId) return false;
  try {
    await drive.delete(fileId);
    return true;
  } catch (error) {
    if (error?.status === 404) return false;
    throw error;
  }
}

export class AdminRefreshService {
  #jobs = new Map();
  #activeByScope = new Map();

  constructor({ repository, drive, synchronizer, thumbnailService }) {
    if (!repository || !drive || !synchronizer || !thumbnailService) {
      throw new Error(
        "Photo repository, Drive, synchronizer, and thumbnail service are required",
      );
    }
    this.repository = repository;
    this.drive = drive;
    this.synchronizer = synchronizer;
    this.thumbnailService = thumbnailService;
  }

  getJob(id) {
    const job = this.#jobs.get(id);
    return job ? cloneJob(job) : null;
  }

  start({ scopeType, scopeId, scopeLabel }) {
    if (!new Set(["album", "process"]).has(scopeType) || !scopeId) {
      const error = new Error("A valid refresh scope is required");
      error.status = 422;
      error.code = "INVALID_REFRESH_SCOPE";
      throw error;
    }

    const key = scopeKey(scopeType, scopeId);
    const existingId = this.#activeByScope.get(key);
    const existing = existingId ? this.#jobs.get(existingId) : null;
    if (existing && active(existing)) return cloneJob(existing);

    const now = new Date().toISOString();
    const job = {
      id: randomUUID(),
      scopeType,
      scopeId,
      scopeLabel: String(scopeLabel || scopeId),
      status: "queued",
      stage: "queued",
      total: 0,
      processed: 0,
      rebuilt: 0,
      deletedThumbnails: 0,
      failures: [],
      error: null,
      createdAt: now,
      updatedAt: now,
    };
    this.#jobs.set(job.id, job);
    this.#activeByScope.set(key, job.id);
    this.#trimJobs();
    setImmediate(() => void this.#run(job, key));
    return cloneJob(job);
  }

  #trimJobs() {
    if (this.#jobs.size <= MAX_RETAINED_JOBS) return;
    const completed = [...this.#jobs.values()]
      .filter((job) => !active(job))
      .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt));
    while (this.#jobs.size > MAX_RETAINED_JOBS && completed.length > 0) {
      this.#jobs.delete(completed.shift().id);
    }
  }

  async #run(job, key) {
    job.status = "running";
    try {
      setStage(job, "syncing_originals");
      await this.synchronizer.reconcileFromDrive();

      const photos = await listScopePhotos(
        this.repository,
        job.scopeType,
        job.scopeId,
      );
      job.total = photos.length;
      job.updatedAt = new Date().toISOString();

      setStage(job, "clearing_thumbnails");
      const thumbnailFiles = await this.drive.listChildren(
        this.thumbnailService.thumbnailFolderId,
      );
      const thumbnailByName = new Map(
        thumbnailFiles
          .filter((file) => file?.id && file?.name)
          .map((file) => [file.name, file.id]),
      );
      const clearedPhotos = [];
      const derivativeIds = new Set();

      for (const photo of photos) {
        const staleFileId = photo.thumbnailDriveFileId ?? null;
        if (staleFileId) derivativeIds.add(staleFileId);
        const deterministicId = thumbnailByName.get(
          thumbnailFilenameForDriveFileId(photo.driveFileId),
        );
        if (deterministicId) derivativeIds.add(deterministicId);
        const cleared = await this.repository.clearThumbnail(photo.id, staleFileId);
        clearedPhotos.push({ photo: cleared, staleFileId });
      }

      for (const fileId of derivativeIds) {
        if (await deleteDerivative(this.drive, fileId)) {
          job.deletedThumbnails += 1;
          job.updatedAt = new Date().toISOString();
        }
      }
      this.thumbnailService.invalidateIndex();

      setStage(job, "rebuilding_thumbnails");
      for (const entry of clearedPhotos) {
        try {
          await this.thumbnailService.ensurePhotoThumbnail(entry.photo, {
            ignoreFileId: entry.staleFileId,
          });
          job.rebuilt += 1;
        } catch (error) {
          job.failures.push({
            photoId: entry.photo.id,
            code: error?.code ?? error?.name ?? "THUMBNAIL_FAILED",
          });
        } finally {
          job.processed += 1;
          job.updatedAt = new Date().toISOString();
        }
      }

      job.status = job.failures.length > 0 ? "completed_with_errors" : "completed";
      setStage(job, "finished");
    } catch (error) {
      job.status = "failed";
      job.error = {
        code: error?.code ?? error?.name ?? "REFRESH_FAILED",
        message: error instanceof Error ? error.message : "Refresh failed",
      };
      setStage(job, "failed");
    } finally {
      if (this.#activeByScope.get(key) === job.id) {
        this.#activeByScope.delete(key);
      }
    }
  }
}
