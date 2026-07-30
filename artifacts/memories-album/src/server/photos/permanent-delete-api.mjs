import { sendAdminJson } from "../admin/auth.mjs";
import { requireAdmin } from "../admin/request.mjs";
import { deletePhotoRecordPermanently } from "./permanent-delete.mjs";

async function deleteDriveFile(drive, fileId) {
  if (!fileId) return;
  try {
    await drive.delete(fileId);
  } catch (error) {
    if (Number(error?.status) === 404) return;
    throw error;
  }
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
    const photo = await repository.findPhotoForAdmin(id);
    if (!photo) {
      sendAdminJson(response, 404, {
        error: "Photo not found",
        code: "NOT_FOUND",
      });
      return true;
    }

    const fileIds = [photo.thumbnailDriveFileId, photo.driveFileId].filter(
      (fileId, index, values) => fileId && values.indexOf(fileId) === index,
    );
    for (const fileId of fileIds) await deleteDriveFile(drive, fileId);

    const deleted = await deletePhotoRecordPermanently(repository, id);
    if (!deleted) {
      sendAdminJson(response, 404, {
        error: "Photo not found",
        code: "NOT_FOUND",
      });
      return true;
    }

    sendAdminJson(response, 200, { deleted: true, id });
    return true;
  };
}
