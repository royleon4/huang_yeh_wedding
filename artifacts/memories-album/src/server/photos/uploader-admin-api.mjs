import { sendAdminJson } from "../admin/auth.mjs";
import { readAdminJson, requireAdmin } from "../admin/request.mjs";

export const WEDDING_PHOTOGRAPHER_UPLOADER = "婚禮攝影";
const MAX_BULK_PHOTOS = 100;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeUploaderName(value, { required = true } = {}) {
  const normalized = String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
  if ((required && !normalized) || Array.from(normalized).length > 80) {
    const error = new Error("上傳者必填，且不可超過 80 個字元");
    error.status = 422;
    error.code = "INVALID_UPLOADER_NAME";
    throw error;
  }
  return normalized;
}

export function isWeddingPhotographerUploader(value) {
  return (
    normalizeUploaderName(value, { required: false }) ===
    WEDDING_PHOTOGRAPHER_UPLOADER
  );
}

export function normalizePhotoIds(value) {
  if (!Array.isArray(value)) {
    const error = new Error("照片 ID 必須是陣列");
    error.status = 422;
    error.code = "INVALID_PHOTO_IDS";
    throw error;
  }
  const ids = [
    ...new Set(value.map((id) => String(id ?? "").trim()).filter(Boolean)),
  ];
  if (
    ids.length === 0 ||
    ids.length > MAX_BULK_PHOTOS ||
    ids.some((id) => !UUID_PATTERN.test(id))
  ) {
    const error = new Error(`一次必須選擇 1 至 ${MAX_BULK_PHOTOS} 張有效照片`);
    error.status = 422;
    error.code = "INVALID_PHOTO_IDS";
    throw error;
  }
  return ids;
}

function uploaderPayload(photo) {
  return {
    id: photo.id,
    uploaderName: photo.uploaderName ?? "",
    deleteProtected: isWeddingPhotographerUploader(photo.uploaderName),
  };
}

export async function updatePhotoUploaders(repository, idsValue, uploaderNameValue) {
  const ids = normalizePhotoIds(idsValue);
  const uploaderName = normalizeUploaderName(uploaderNameValue);
  const result = await repository.pool.query(
    `UPDATE memories_photos
     SET uploader_name = $2, updated_at = now()
     WHERE id = ANY($1::uuid[]) AND visibility <> 'trashed'
     RETURNING id`,
    [ids, uploaderName],
  );
  const updatedIds = new Set(result.rows.map((row) => String(row.id)));
  return {
    uploaders: ids
      .filter((id) => updatedIds.has(id))
      .map((id) => ({
        id,
        uploaderName,
        deleteProtected: isWeddingPhotographerUploader(uploaderName),
      })),
    missingIds: ids.filter((id) => !updatedIds.has(id)),
  };
}

export function createAdminPhotoUploaderApi({ repository, adminToken }) {
  if (!repository?.findPhotoForAdmin || !repository?.pool?.query) {
    throw new Error("Photo repository with PostgreSQL access is required");
  }

  return async function handleAdminPhotoUploaderApi(
    request,
    response,
    url = new URL(request.url ?? "/", "http://localhost"),
  ) {
    const collectionPath = url.pathname === "/admin/api/photo-uploaders";
    const itemMatch = url.pathname.match(
      /^\/admin\/api\/photos\/([^/]+)\/uploader$/,
    );
    if (!collectionPath && !itemMatch) return false;

    try {
      if (
        !requireAdmin(request, response, adminToken, {
          mutate: request.method !== "GET",
        })
      ) {
        return true;
      }

      if (request.method === "GET" && collectionPath) {
        const ids = [
          ...new Set(
            String(url.searchParams.get("ids") ?? "")
              .split(",")
              .map((id) => id.trim())
              .filter(Boolean),
          ),
        ].slice(0, 100);
        const photos = await Promise.all(
          ids.map((id) => repository.findPhotoForAdmin(id)),
        );
        sendAdminJson(response, 200, {
          uploaders: photos.filter(Boolean).map(uploaderPayload),
        });
        return true;
      }

      if (request.method === "PATCH" && collectionPath) {
        const body = await readAdminJson(request, 32 * 1024);
        sendAdminJson(
          response,
          200,
          await updatePhotoUploaders(repository, body.ids, body.uploaderName),
        );
        return true;
      }

      if (request.method === "PATCH" && itemMatch) {
        const id = decodeURIComponent(itemMatch[1]);
        const existing = await repository.findPhotoForAdmin(id);
        if (!existing) {
          sendAdminJson(response, 404, {
            error: "Photo not found",
            code: "NOT_FOUND",
          });
          return true;
        }
        const body = await readAdminJson(request);
        const uploaderName = normalizeUploaderName(body.uploaderName);
        const result = await repository.pool.query(
          `UPDATE memories_photos
           SET uploader_name = $2, updated_at = now()
           WHERE id = $1 AND visibility <> 'trashed'
           RETURNING id`,
          [id, uploaderName],
        );
        if (!result.rows[0]) {
          sendAdminJson(response, 404, {
            error: "Photo not found",
            code: "NOT_FOUND",
          });
          return true;
        }
        sendAdminJson(response, 200, {
          uploader: {
            id,
            uploaderName,
            deleteProtected: isWeddingPhotographerUploader(uploaderName),
          },
        });
        return true;
      }

      sendAdminJson(response, 405, {
        error: "Method not allowed",
        code: "METHOD_NOT_ALLOWED",
      });
      return true;
    } catch (error) {
      if (error?.status && error?.code) {
        sendAdminJson(response, error.status, {
          error: error.message,
          code: error.code,
        });
        return true;
      }
      throw error;
    }
  };
}
