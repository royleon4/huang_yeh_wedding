import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { toPublicPhoto } from "../photos/api.mjs";
import {
  deletePhotoRecordsPermanently,
  removeDeletedPhotoIdsFromPinnedSettings,
} from "../photos/permanent-delete.mjs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_TOKEN_CHARACTERS = 512;

function json(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  });
  response.end(JSON.stringify(body));
}

function bearerToken(request) {
  const header = request.headers.authorization;
  if (typeof header !== "string") return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1] ?? "";
  return token && token.length <= MAX_TOKEN_CHARACTERS ? token : null;
}

export function hashManagementToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function tokenHashesMatch(storedHash, suppliedToken) {
  if (typeof storedHash !== "string" || !suppliedToken) return false;
  const suppliedHash = hashManagementToken(suppliedToken);
  const stored = Buffer.from(storedHash, "hex");
  const supplied = Buffer.from(suppliedHash, "hex");
  return (
    stored.length === 32 &&
    supplied.length === stored.length &&
    timingSafeEqual(stored, supplied)
  );
}

export async function authorizeGuestBatch(request, repository, batchId) {
  const token = bearerToken(request);
  if (!UUID_PATTERN.test(batchId) || !token) return null;
  const batch = await repository.findUploadBatchForManagement(batchId);
  if (
    !batch ||
    batch.status !== "open" ||
    batch.uploaderType !== "guest" ||
    !tokenHashesMatch(batch.tokenHash, token)
  ) {
    return null;
  }
  return batch;
}

function notFound(response) {
  json(response, 404, {
    error: "Upload batch not found",
    code: "BATCH_NOT_FOUND",
  });
}

async function deleteDriveFile(drive, fileId) {
  if (!fileId) return;
  try {
    await drive.delete(fileId);
  } catch (error) {
    if (Number(error?.status) === 404) return;
    throw error;
  }
}

export function createGuestBatchManagementApi({
  repository,
  drive,
  now = () => new Date(),
  createToken = () => randomBytes(32).toString("base64url"),
}) {
  if (!repository || !drive) {
    throw new Error("Upload management repository and Drive storage are required");
  }

  return async function handleGuestBatchManagementApi(
    request,
    response,
    url = new URL(request.url ?? "/", "http://localhost"),
  ) {
    const rotateMatch = url.pathname.match(
      /^\/Memories\/api\/upload-batches\/([^/]+)\/management-token$/,
    );
    if (request.method === "POST" && rotateMatch) {
      const batch = await authorizeGuestBatch(
        request,
        repository,
        rotateMatch[1],
      );
      if (!batch) {
        notFound(response);
        return true;
      }

      const replacement = createToken();
      const rotated = await repository.rotateUploadBatchToken({
        id: batch.id,
        expectedTokenHash: batch.tokenHash,
        tokenHash: hashManagementToken(replacement),
        updatedAt: now().toISOString(),
      });
      if (!rotated) {
        notFound(response);
        return true;
      }
      json(response, 200, {
        manageUrl: `/Memories/manage/${batch.id}#token=${encodeURIComponent(replacement)}`,
      });
      return true;
    }

    const photoMatch = url.pathname.match(
      /^\/Memories\/api\/upload-batches\/([^/]+)\/photos\/([^/]+)$/,
    );
    if (request.method === "DELETE" && photoMatch) {
      const [batchId, photoId] = photoMatch.slice(1);
      const batch = await authorizeGuestBatch(request, repository, batchId);
      if (!batch || !UUID_PATTERN.test(photoId)) {
        notFound(response);
        return true;
      }

      const photo = await repository.findBatchPhotoForPermanentDeletion({
        batchId,
        photoId,
      });
      if (!photo) {
        notFound(response);
        return true;
      }

      const fileIds = [
        ...new Set(
          [photo.thumbnailDriveFileId, photo.driveFileId].filter(Boolean),
        ),
      ];
      for (const fileId of fileIds) {
        await deleteDriveFile(drive, fileId);
      }

      const deletedIds = await deletePhotoRecordsPermanently(repository, [photo.id]);
      if (!deletedIds.includes(String(photo.id))) {
        notFound(response);
        return true;
      }
      await removeDeletedPhotoIdsFromPinnedSettings(repository, deletedIds);

      json(response, 200, {
        deleted: true,
        photoId,
      });
      return true;
    }

    const batchMatch = url.pathname.match(
      /^\/Memories\/api\/upload-batches\/([^/]+)$/,
    );
    if (request.method === "GET" && batchMatch) {
      const batch = await authorizeGuestBatch(
        request,
        repository,
        batchMatch[1],
      );
      if (!batch) {
        notFound(response);
        return true;
      }
      const photos = await repository.listBatchPhotos(batch.id);
      json(response, 200, {
        batch: {
          id: batch.id,
          uploaderName: batch.uploaderName,
          status: batch.status,
          createdAt: batch.createdAt,
          photos: photos.map(toPublicPhoto),
        },
      });
      return true;
    }

    return false;
  };
}
