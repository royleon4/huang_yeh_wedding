export const TRASH_RETENTION_MS = 7 * 24 * 60 * 60 * 1_000;

export function trashRestoreDeadline(trashedAt) {
  return new Date(
    new Date(trashedAt).getTime() + TRASH_RETENTION_MS,
  ).toISOString();
}

function boundedCleanupErrorCode(error) {
  const code = String(error?.code ?? "");
  if (/^[A-Z][A-Z0-9_]{0,63}$/.test(code)) return code;
  return "TRASH_CLEANUP_FAILED";
}

async function deleteDriveFileIfPresent(drive, fileId) {
  if (!fileId) return;
  try {
    await drive.delete(fileId);
  } catch (error) {
    if (error?.status === 404 || error?.code === 404) return;
    throw error;
  }
}

export class TrashCleanupService {
  constructor({
    repository,
    drive,
    now = () => new Date(),
    batchSize = 20,
    leaseMs = 5 * 60 * 1_000,
  }) {
    if (!repository || !drive) {
      throw new Error("Trash cleanup requires a repository and Drive storage");
    }
    this.repository = repository;
    this.drive = drive;
    this.now = now;
    this.batchSize = Math.max(1, Math.min(Number(batchSize) || 20, 100));
    this.leaseMs = Math.max(30_000, Number(leaseMs) || 5 * 60 * 1_000);
  }

  async runOnce() {
    const now = this.now();
    const claimed = await this.repository.claimExpiredTrash({
      now: now.toISOString(),
      limit: this.batchSize,
      leaseExpiresAt: new Date(now.getTime() + this.leaseMs).toISOString(),
    });
    let deleted = 0;
    let retried = 0;

    for (const photo of claimed) {
      try {
        await deleteDriveFileIfPresent(this.drive, photo.thumbnailDriveFileId);
        await deleteDriveFileIfPresent(this.drive, photo.driveFileId);
        await this.repository.completeTrashCleanup(photo.id);
        deleted += 1;
      } catch (error) {
        await this.repository.retryTrashCleanup({
          photoId: photo.id,
          errorCode: boundedCleanupErrorCode(error),
          updatedAt: this.now().toISOString(),
        });
        retried += 1;
      }
    }

    return { claimed: claimed.length, deleted, retried };
  }
}
