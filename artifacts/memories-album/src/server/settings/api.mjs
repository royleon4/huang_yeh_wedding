import { adminAuthorized } from "../admin/auth.mjs";

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

export function createSettingsApi({ repository, adminToken }) {
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
        const body = await readJson(request);
        if (typeof body.primaryNavigationVisible !== "boolean") {
          json(response, 422, {
            error: "primaryNavigationVisible must be boolean",
            code: "INVALID_SETTING",
          });
          return true;
        }
        json(
          response,
          200,
          await repository.setPrimaryNavigationVisible(
            body.primaryNavigationVisible,
          ),
        );
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
