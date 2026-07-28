const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

function adminAuthorized(request, token) {
  if (!token) return false;
  const header = request.headers.authorization;
  return typeof header === "string" && header === `Bearer ${token}`;
}

async function deleteDriveFileIfPresent(drive, fileId) {
  if (!fileId) return;
  try {
    await drive.delete(fileId);
  } catch (error) {
    if (error?.status === 404) return;
    throw error;
  }
}

export function createAdminPhotoApi({ repository, drive, adminToken }) {
  if (!repository || !drive) {
    throw new Error("Photo repository and Drive storage are required");
  }

  return async function handleAdminPhotoApi(
    request,
    response,
    url = new URL(request.url ?? "/", "http://localhost"),
  ) {
    const match = url.pathname.match(
      /^\/Memories\/api\/admin\/photos\/([^/]+)$/,
    );
    if (request.method !== "DELETE" || !match) return false;

    if (!adminAuthorized(request, adminToken)) {
      json(response, 401, { error: "Unauthorized", code: "UNAUTHORIZED" });
      return true;
    }

    const photoId = match[1];
    if (!UUID_PATTERN.test(photoId)) {
      json(response, 404, { error: "Photo not found", code: "NOT_FOUND" });
      return true;
    }

    const photo = await repository.findPhotoForAdmin(photoId);
    if (!photo) {
      json(response, 404, { error: "Photo not found", code: "NOT_FOUND" });
      return true;
    }

    let thumbnailRemoved = false;
    try {
      if (photo.thumbnailDriveFileId) {
        await deleteDriveFileIfPresent(drive, photo.thumbnailDriveFileId);
        thumbnailRemoved = true;
      }

      await deleteDriveFileIfPresent(drive, photo.driveFileId);
    } catch (error) {
      if (thumbnailRemoved && photo.thumbnailDriveFileId) {
        try {
          await repository.clearThumbnail(photo.id, photo.thumbnailDriveFileId);
        } catch {
          // A later thumbnail request will verify and repair the stale derivative.
        }
      }
      throw error;
    }

    try {
      await repository.deletePhotoRecord(photo.id);
    } catch (error) {
      // The original is already gone, so never leave a broken public card behind.
      try {
        await repository.trashPhoto(photo.id);
      } catch {
        // Preserve the original database failure for the shared bounded error handler.
      }
      throw error;
    }

    json(response, 200, { deleted: true, photoId: photo.id });
    return true;
  };
}
