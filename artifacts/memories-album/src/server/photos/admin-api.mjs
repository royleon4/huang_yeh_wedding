import { adminAuthorized } from "../admin/auth.mjs";
import { createFixedWindowRateLimiter } from "../admin/rate-limit.mjs";

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

function notFound(response) {
  json(response, 404, { error: "Photo not found", code: "NOT_FOUND" });
}

function adminPhoto(photo) {
  return {
    id: photo.id,
    originalFilename: photo.originalFilename,
    uploaderName: photo.uploaderName,
    source: photo.source,
    batchId: photo.batchId,
    trashedAt: photo.trashedAt,
    restoreUntil: photo.restoreUntil,
    cleanupStatus: photo.cleanupStatus,
    cleanupAttemptCount: photo.cleanupAttemptCount,
  };
}

export function createAdminPhotoApi({
  repository,
  adminToken,
  auditRepository = null,
  now = () => new Date(),
  rateLimiter = createFixedWindowRateLimiter({
    limit: 60,
    windowMs: 60_000,
  }),
}) {
  if (!repository) throw new Error("A photo repository is required");

  return async function handleAdminPhotoApi(
    request,
    response,
    url = new URL(request.url ?? "/", "http://localhost"),
  ) {
    const trashList =
      request.method === "GET" && url.pathname === "/Memories/api/admin/trash";
    const photoMatch = url.pathname.match(
      /^\/Memories\/api\/admin\/photos\/([^/]+)$/,
    );
    const restoreMatch = url.pathname.match(
      /^\/Memories\/api\/admin\/photos\/([^/]+)\/restore$/,
    );
    if (!trashList && !photoMatch && !restoreMatch) return false;
    if (
      !trashList &&
      !(
        (request.method === "DELETE" && photoMatch) ||
        (request.method === "POST" && restoreMatch)
      )
    ) {
      return false;
    }

    if (!adminAuthorized(request, adminToken)) {
      json(response, 401, { error: "Unauthorized", code: "UNAUTHORIZED" });
      return true;
    }
    const rate = rateLimiter.consume(request);
    if (!rate.allowed) {
      json(response, 429, {
        error: "Too many administrator requests",
        code: "RATE_LIMITED",
      });
      return true;
    }

    if (trashList) {
      const photos = await repository.listTrashedPhotos({ limit: 100 });
      json(response, 200, { photos: photos.map(adminPhoto) });
      return true;
    }

    const photoId = (restoreMatch ?? photoMatch)[1];
    if (!UUID_PATTERN.test(photoId)) {
      notFound(response);
      return true;
    }

    if (request.method === "DELETE") {
      const trashedAt = now().toISOString();
      const trashed = await repository.trashPhotoForRetention({
        photoId,
        trashedAt,
      });
      if (!trashed) {
        notFound(response);
        return true;
      }
      await auditRepository?.record({
        actor: "shared-secret-admin",
        action: "photo.trash",
        targetType: "photo",
        targetId: photoId,
        before: { visibility: "public" },
        after: {
          visibility: "trashed",
          restoreUntil: trashed.restoreUntil,
        },
        createdAt: trashedAt,
      });
      json(response, 200, {
        trashed: true,
        photoId,
        restoreUntil: trashed.restoreUntil,
      });
      return true;
    }

    const current = await repository.findTrashedPhotoForAdmin(photoId);
    if (!current) {
      notFound(response);
      return true;
    }
    const restoredAt = now().toISOString();
    if (new Date(restoredAt) >= new Date(current.restoreUntil)) {
      json(response, 409, {
        error: "The seven-day restore period has ended",
        code: "TRASH_RETENTION_EXPIRED",
      });
      return true;
    }
    const restored = await repository.restoreTrashedPhoto({
      photoId,
      now: restoredAt,
    });
    if (!restored) {
      json(response, 409, {
        error: "The photo could not be restored",
        code: "RESTORE_CONFLICT",
      });
      return true;
    }
    await auditRepository?.record({
      actor: "shared-secret-admin",
      action: "photo.restore",
      targetType: "photo",
      targetId: photoId,
      before: { visibility: "trashed" },
      after: { visibility: "public" },
      createdAt: restoredAt,
    });
    json(response, 200, { restored: true, photoId });
    return true;
  };
}
