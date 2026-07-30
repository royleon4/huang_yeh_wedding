import { sendAdminJson } from "../admin/auth.mjs";
import { requireAdmin } from "../admin/request.mjs";
import {
  deletePhotoRecordsPermanently,
  findPhotoRecordsForPermanentDeletion,
  removeDeletedPhotoIdsFromPinnedSettings,
} from "./permanent-delete.mjs";
import { isWeddingPhotographerUploader } from "./uploader-admin-api.mjs";

async function deleteDriveFile(drive, fileId) {
  if (!fileId) return;
  try {
    await drive.delete(fileId);
  } catch (error) {
    if (Number(error?.status) === 404) return;
    throw error;
  }
}

function uniqueFileIds(photos) {
  return [
    ...new Set(
      photos
        .flatMap((photo) => [photo.thumbnailDriveFileId, photo.driveFileId])
        .filter(Boolean),
    ),
  ];
}

export function createPermanentPhotoDeleteApi({
  repository,
  drive,
  adminToken,
}) {
  if (!repository || !drive) {
    throw new Error("Photo repository and Drive storage are required");
  }

  return async function handlePermanentPhotoDeleteApi(
    request,
    response,
    url = new URL(request.url ?? "/", "http://localhost"),
  ) {
    const match = url.pathname.match(/^\/admin\/api\/photos\/([^/]+)$/);
    if (!match || request.method !== "DELETE") return false;
    if (!requireAdmin(request, response, adminToken, { mutate: true })) return true;

    const id = decodeURIComponent(match[1]);
    const photos = await findPhotoRecordsForPermanentDeletion(repository, id);
    if (photos.length === 0) {
      sendAdminJson(response, 404, {
        error: "Photo not found",
        code: "NOT_FOUND",
      });
      return true;
    }

    if (photos.some((photo) => isWeddingPhotographerUploader(photo.uploaderName))) {
      sendAdminJson(response, 403, {
        error: "婚禮攝影照片受保護，不允許永久刪除。",
        code: "WEDDING_PHOTOGRAPHER_PHOTO_PROTECTED",
      });
      return true;
    }

    for (const fileId of uniqueFileIds(photos)) {
      await deleteDriveFile(drive, fileId);
    }

    const requestedIds = photos.map((photo) => photo.id);
    const deletedIds = await deletePhotoRecordsPermanently(repository, requestedIds);
    if (deletedIds.length === 0) {
      sendAdminJson(response, 404, {
        error: "Photo not found",
        code: "NOT_FOUND",
      });
      return true;
    }

    await removeDeletedPhotoIdsFromPinnedSettings(repository, deletedIds);

    sendAdminJson(response, 200, {
      deleted: true,
      id,
      deletedIds,
      deletedCount: deletedIds.length,
    });
    return true;
  };
}
