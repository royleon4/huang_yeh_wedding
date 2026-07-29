function json(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

async function readJson(request, maxBytes = 32 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > maxBytes) {
      const error = new Error("Request body too large");
      error.status = 413;
      error.code = "BODY_TOO_LARGE";
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    const error = new Error("Invalid JSON body");
    error.status = 400;
    error.code = "INVALID_JSON";
    throw error;
  }
}

function publicProcess(process) {
  return {
    id: process.id,
    labelZh: process.labelZh,
    labelEn: process.labelEn,
    displayOrder: process.displayOrder,
    syncState: process.syncState,
    lastSyncedAt: process.lastSyncedAt,
  };
}

function driveItemMissing(error) {
  return Number(error?.status) === 404;
}

async function processesAfterDeletion(repository, synchronizer) {
  try {
    const remaining = await synchronizer.syncProcessFoldersFromDrive();
    if (remaining.length === 0) return [];
    return await synchronizer.reorderProcesses(
      remaining.map((item) => item.id),
    );
  } catch {
    // The deletion has already been committed. A temporary Drive failure must
    // not turn a successful/idempotent delete back into a visible error.
    return repository.listProcesses();
  }
}

export function createProcessApi({
  repository,
  synchronizer,
  adminToken,
  auditRepository = null,
  now = () => new Date(),
  rateLimiter = createFixedWindowRateLimiter({
    limit: 60,
    windowMs: 60_000,
  }),
}) {
  if (!repository || !synchronizer) {
    throw new Error("Process repository and synchronizer are required");
  }

  const authorize = (request, response) => {
    if (!adminAuthorized(request, adminToken)) {
      json(response, 401, { error: "Unauthorized", code: "UNAUTHORIZED" });
      return false;
    }
    const rate = rateLimiter.consume(request);
    if (!rate.allowed) {
      json(response, 429, {
        error: "Too many administrator requests",
        code: "RATE_LIMITED",
      });
      return false;
    }
    return true;
  };
  const audit = (action, targetType, targetId, before, after) =>
    auditRepository?.record({
      actor: "shared-secret-admin",
      action,
      targetType,
      targetId,
      before,
      after,
      createdAt: now().toISOString(),
    });

  return async function handleProcessApi(
    request,
    response,
    url = new URL(request.url ?? "/", "http://localhost"),
  ) {
    try {
      if (
        request.method === "GET" &&
        url.pathname === "/Memories/api/processes"
      ) {
        const processes = await repository.listProcesses();
        json(response, 200, { processes: processes.map(publicProcess) });
        return true;
      }

      if (
        request.method === "POST" &&
        url.pathname === "/Memories/api/admin/processes/sync"
      ) {
        if (!authorize(request, response)) return true;
        const before = (await repository.listProcesses()).map(publicProcess);
        const processes = await synchronizer.reconcileFromDrive();
        await audit(
          "processes.sync",
          "album",
          "memories",
          before,
          processes.map(publicProcess),
        );
        json(response, 200, { processes: processes.map(publicProcess) });
        return true;
      }

      if (
        request.method === "POST" &&
        url.pathname === "/Memories/api/admin/processes"
      ) {
        if (!authorize(request, response)) return true;
        const body = await readJson(request);
        const labelZh = String(body.labelZh ?? "")
          .normalize("NFKC")
          .trim();
        const labelEn = String(body.labelEn ?? "")
          .normalize("NFKC")
          .trim();
        if (!labelZh || labelZh.length > 80) {
          json(response, 422, {
            error:
              "Process name is required and must be 80 characters or fewer",
            code: "INVALID_PROCESS_NAME",
          });
          return true;
        }
        const process = await synchronizer.createProcess({ labelZh, labelEn });
        await audit(
          "process.create",
          "process",
          process.id,
          null,
          publicProcess(process),
        );
        json(response, 201, { process: publicProcess(process) });
        return true;
      }

      if (
        request.method === "PUT" &&
        url.pathname === "/Memories/api/admin/processes/order"
      ) {
        if (!authorize(request, response)) return true;
        const body = await readJson(request);
        if (!Array.isArray(body.processIds)) {
          json(response, 422, {
            error: "processIds must be an array",
            code: "INVALID_PROCESS_ORDER",
          });
          return true;
        }
        const before = (await repository.listProcesses()).map(publicProcess);
        const processes = await synchronizer.reorderProcesses(body.processIds);
        await audit(
          "processes.reorder",
          "album",
          "memories",
          before,
          processes.map(publicProcess),
        );
        json(response, 200, { processes: processes.map(publicProcess) });
        return true;
      }

      const processMatch = url.pathname.match(
        /^\/Memories\/api\/admin\/processes\/([^/]+)$/,
      );
      const processId = processMatch
        ? decodeURIComponent(processMatch[1])
        : null;

      if (request.method === "PATCH" && processId) {
        if (!authorize(request, response)) return true;
        const processes = await repository.listProcesses();
        const process = processes.find((item) => item.id === processId);
        if (!process) {
          json(response, 404, {
            error: "Process not found",
            code: "NOT_FOUND",
          });
          return true;
        }
        const body = await readJson(request);
        const labelZh = String(body.labelZh ?? "")
          .normalize("NFKC")
          .trim();
        const labelEn = String(body.labelEn ?? "")
          .normalize("NFKC")
          .trim();
        if (!labelZh || labelZh.length > 80) {
          json(response, 422, {
            error:
              "Process name is required and must be 80 characters or fewer",
            code: "INVALID_PROCESS_NAME",
          });
          return true;
        }
        const before = publicProcess(process);
        const updated = await synchronizer.renameProcess(
          process,
          labelZh,
          labelEn,
        );
        await audit(
          "process.rename",
          "process",
          process.id,
          before,
          publicProcess(updated),
        );
        json(response, 200, { process: publicProcess(updated) });
        return true;
      }

      if (request.method === "DELETE" && processId) {
        if (!authorize(request, response)) return true;

        const process =
          (await repository.findProcessById?.(processId)) ??
          (await repository.listProcesses()).find(
            (item) => item.id === processId,
          ) ??
          null;

        // DELETE is idempotent. A record already removed by another tab or a
        // prior sync is a successful outcome, never a blocking 404.
        if (!process || process.isActive === false) {
          const processes = await repository.listProcesses();
          await audit(
            "process.delete",
            "process",
            processId,
            process ? publicProcess(process) : null,
            { deleted: true, alreadyDeleted: true },
          );
          json(response, 200, {
            deletedProcessId: processId,
            alreadyDeleted: true,
            processes: processes.map(publicProcess),
          });
          return true;
        }

        // Legacy rows such as entrance/group-photo never had a Drive folder.
        // Remove their associations and deactivate them locally without
        // touching Drive, so this works even while Drive is unavailable.
        if (!process.driveFolderId) {
          await repository.deactivateProcess?.(process.id, "legacy-deleted");
          const processes = await repository.listProcesses();
          await audit(
            "process.delete",
            "process",
            process.id,
            publicProcess(process),
            { deleted: true, ghostCleaned: true },
          );
          json(response, 200, {
            deletedProcessId: process.id,
            ghostCleaned: true,
            processes: processes.map(publicProcess),
          });
          return true;
        }

        let children = [];
        let folderAlreadyMissing = false;
        try {
          children = await synchronizer.drive.listChildren(
            process.driveFolderId,
          );
        } catch (error) {
          if (!driveItemMissing(error)) throw error;
          folderAlreadyMissing = true;
        }

        if (!folderAlreadyMissing && children.length > 0) {
          json(response, 409, {
            error: `此分類仍有 ${children.length} 個檔案，請先移動或刪除其中照片。`,
            code: "PROCESS_NOT_EMPTY",
            itemCount: children.length,
          });
          return true;
        }

        if (!folderAlreadyMissing) {
          try {
            await synchronizer.drive.delete(process.driveFolderId);
          } catch (error) {
            if (!driveItemMissing(error)) throw error;
            folderAlreadyMissing = true;
          }
        }

        await repository.deactivateProcess?.(
          process.id,
          folderAlreadyMissing ? "missing-deleted" : "deleted",
        );
        const processes = await processesAfterDeletion(
          repository,
          synchronizer,
        );
        await audit(
          "process.delete",
          "process",
          process.id,
          publicProcess(process),
          { deleted: true, alreadyDeleted: folderAlreadyMissing },
        );
        json(response, 200, {
          deletedProcessId: process.id,
          alreadyDeleted: folderAlreadyMissing,
          processes: processes.map(publicProcess),
        });
        return true;
      }

      return false;
    } catch (error) {
      if (error?.status && error?.code) {
        json(response, error.status, {
          error: error.message,
          code: error.code,
        });
        return true;
      }
      throw error;
    }
  };
}
import { adminAuthorized } from "../admin/auth.mjs";
import { createFixedWindowRateLimiter } from "../admin/rate-limit.mjs";
