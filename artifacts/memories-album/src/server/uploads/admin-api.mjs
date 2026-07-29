import { randomBytes } from "node:crypto";
import { adminAuthorized } from "../admin/auth.mjs";
import { createFixedWindowRateLimiter } from "../admin/rate-limit.mjs";
import { hashManagementToken } from "./management-api.mjs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  });
  response.end(JSON.stringify(body));
}

function publicBatch(batch) {
  return {
    id: batch.id,
    uploaderType: batch.uploaderType,
    uploaderName: batch.uploaderName,
    status: batch.status,
    classification: batch.classification,
    classificationProcessId: batch.classificationProcessId,
    photoCount: batch.photoCount,
    visiblePhotoCount: batch.visiblePhotoCount,
    uploadStatusCounts: batch.uploadStatusCounts,
    createdAt: batch.createdAt,
    updatedAt: batch.updatedAt,
  };
}

export function createAdminBatchApi({
  repository,
  adminToken,
  auditRepository = null,
  now = () => new Date(),
  createToken = () => randomBytes(32).toString("base64url"),
  rateLimiter = createFixedWindowRateLimiter({
    limit: 60,
    windowMs: 60_000,
  }),
}) {
  if (!repository) throw new Error("A photo repository is required");

  return async function handleAdminBatchApi(
    request,
    response,
    url = new URL(request.url ?? "/", "http://localhost"),
  ) {
    if (!url.pathname.startsWith("/Memories/api/admin/upload-batches")) {
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

    if (
      request.method === "GET" &&
      url.pathname === "/Memories/api/admin/upload-batches"
    ) {
      const batches = await repository.listAdminUploadBatches({
        limit: url.searchParams.get("limit"),
      });
      json(response, 200, { batches: batches.map(publicBatch) });
      return true;
    }

    const revokeMatch = url.pathname.match(
      /^\/Memories\/api\/admin\/upload-batches\/([^/]+)\/revoke$/,
    );
    if (request.method === "POST" && revokeMatch) {
      const id = revokeMatch[1];
      if (!UUID_PATTERN.test(id)) {
        json(response, 404, { error: "Batch not found", code: "NOT_FOUND" });
        return true;
      }
      const before = await repository.findUploadBatchForManagement(id);
      const after = await repository.setUploadBatchStatus({
        id,
        status: "revoked",
        updatedAt: now().toISOString(),
      });
      if (!before || !after) {
        json(response, 404, { error: "Batch not found", code: "NOT_FOUND" });
        return true;
      }
      await auditRepository?.record({
        actor: "shared-secret-admin",
        action: "upload-batch.revoke",
        targetType: "upload-batch",
        targetId: id,
        before: publicBatch(before),
        after: publicBatch(after),
        createdAt: now().toISOString(),
      });
      json(response, 200, { batch: publicBatch(after) });
      return true;
    }

    const regenerateMatch = url.pathname.match(
      /^\/Memories\/api\/admin\/upload-batches\/([^/]+)\/management-token$/,
    );
    if (request.method === "POST" && regenerateMatch) {
      const id = regenerateMatch[1];
      if (!UUID_PATTERN.test(id)) {
        json(response, 404, { error: "Batch not found", code: "NOT_FOUND" });
        return true;
      }
      const before = await repository.findUploadBatchForManagement(id);
      const replacement = createToken();
      const after = await repository.regenerateUploadBatchToken({
        id,
        tokenHash: hashManagementToken(replacement),
        updatedAt: now().toISOString(),
      });
      if (!before || !after) {
        json(response, 404, { error: "Batch not found", code: "NOT_FOUND" });
        return true;
      }
      await auditRepository?.record({
        actor: "shared-secret-admin",
        action: "upload-batch.regenerate-link",
        targetType: "upload-batch",
        targetId: id,
        before: publicBatch(before),
        after: publicBatch(after),
        createdAt: now().toISOString(),
      });
      json(response, 200, {
        manageUrl: `/Memories/manage/${id}#token=${encodeURIComponent(replacement)}`,
      });
      return true;
    }

    return false;
  };
}
