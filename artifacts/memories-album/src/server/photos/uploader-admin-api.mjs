import { sendAdminJson } from "../admin/auth.mjs";
import { readAdminJson, requireAdmin } from "../admin/request.mjs";

export const WEDDING_PHOTOGRAPHER_UPLOADER = "婚禮攝影";

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
  return normalizeUploaderName(value, { required: false }) === WEDDING_PHOTOGRAPHER_UPLOADER;
}

function uploaderPayload(photo) {
  return {
    id: photo.id,
    uploaderName: photo.uploaderName ?? "",
    deleteProtected: isWeddingPhotographerUploader(photo.uploaderName),
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
