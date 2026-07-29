import { adminAuthorized } from "../admin/auth.mjs";
import { createFixedWindowRateLimiter } from "../admin/rate-limit.mjs";

function json(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

async function readJson(request, maxBytes = 8 * 1024) {
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

export function createSettingsApi({
  repository,
  adminToken,
  auditRepository = null,
  now = () => new Date(),
  rateLimiter = createFixedWindowRateLimiter({
    limit: 60,
    windowMs: 60_000,
  }),
}) {
  if (!repository) throw new Error("Settings repository is required");

  return async function handleSettingsApi(
    request,
    response,
    url = new URL(request.url ?? "/", "http://localhost"),
  ) {
    try {
      if (
        request.method === "GET" &&
        url.pathname === "/Memories/api/settings"
      ) {
        json(response, 200, await repository.getPublicSettings());
        return true;
      }

      if (
        request.method === "PATCH" &&
        url.pathname === "/Memories/api/admin/settings"
      ) {
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
        const body = await readJson(request);
        const patch = {};
        if (typeof body.primaryNavigationVisible === "boolean") {
          patch.primaryNavigationVisible = body.primaryNavigationVisible;
        }
        if (typeof body.albumOpen === "boolean") {
          patch.albumOpen = body.albumOpen;
        }
        if (Object.keys(patch).length === 0) {
          json(response, 422, {
            error: "primaryNavigationVisible or albumOpen must be boolean",
            code: "INVALID_SETTING",
          });
          return true;
        }
        const before = await repository.getPublicSettings();
        const after = await repository.updateSettings(patch);
        await auditRepository?.record({
          actor: "shared-secret-admin",
          action: "settings.update",
          targetType: "album",
          targetId: "memories",
          before,
          after,
          createdAt: now().toISOString(),
        });
        json(response, 200, after);
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
