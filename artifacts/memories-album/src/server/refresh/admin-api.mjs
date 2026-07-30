import { sendAdminJson } from "../admin/auth.mjs";
import { requireAdmin } from "../admin/request.mjs";

function jobPayload(job) {
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
    failures: job.failures,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

export function createAdminRefreshApi({
  service,
  albumRepository,
  categoryRepository,
  adminToken,
}) {
  if (!service || !albumRepository || !categoryRepository) {
    throw new Error("Refresh service, album repository, and category repository are required");
  }

  return async function handleAdminRefreshApi(
    request,
    response,
    url = new URL(request.url ?? "/", "http://localhost"),
  ) {
    const startMatch = url.pathname.match(
      /^\/admin\/api\/(albums|categories)\/([^/]+)\/refresh$/,
    );
    const jobMatch = url.pathname.match(/^\/admin\/api\/refresh-jobs\/([^/]+)$/);
    if (!startMatch && !jobMatch) return false;

    if (
      !requireAdmin(request, response, adminToken, {
        mutate: request.method !== "GET",
      })
    ) {
      return true;
    }

    if (request.method === "GET" && jobMatch) {
      const job = service.getJob(decodeURIComponent(jobMatch[1]));
      if (!job) {
        sendAdminJson(response, 404, {
          error: "Refresh job not found",
          code: "REFRESH_JOB_NOT_FOUND",
        });
        return true;
      }
      sendAdminJson(response, 200, { job: jobPayload(job) });
      return true;
    }

    if (request.method === "POST" && startMatch) {
      const collection = startMatch[1];
      const id = decodeURIComponent(startMatch[2]);
      if (collection === "albums") {
        const album = (await albumRepository.listAdminAlbums()).find(
          (item) => item.id === id,
        );
        if (!album) {
          sendAdminJson(response, 404, {
            error: "Album not found",
            code: "NOT_FOUND",
          });
          return true;
        }
        const job = service.start({
          scopeType: "album",
          scopeId: album.id,
          scopeLabel: album.titleZh,
        });
        sendAdminJson(response, 202, { job: jobPayload(job) });
        return true;
      }

      const category = (await categoryRepository.listProcesses()).find(
        (item) => item.id === id,
      );
      if (!category) {
        sendAdminJson(response, 404, {
          error: "Wedding process not found",
          code: "NOT_FOUND",
        });
        return true;
      }
      const job = service.start({
        scopeType: "process",
        scopeId: category.id,
        scopeLabel: category.labelZh,
      });
      sendAdminJson(response, 202, { job: jobPayload(job) });
      return true;
    }

    sendAdminJson(response, 405, {
      error: "Method not allowed",
      code: "METHOD_NOT_ALLOWED",
    });
    return true;
  };
}
