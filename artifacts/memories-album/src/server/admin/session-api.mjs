import { timingSafeEqual } from "node:crypto";

function json(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

function bearerToken(request) {
  const header = request.headers.authorization;
  if (typeof header !== "string") return "";
  return header.match(/^Bearer\s+(.+)$/i)?.[1] ?? "";
}

function authorized(request, configuredToken) {
  const supplied = bearerToken(request);
  if (!configuredToken || !supplied) return false;
  const expectedBytes = Buffer.from(configuredToken);
  const suppliedBytes = Buffer.from(supplied);
  return (
    expectedBytes.length === suppliedBytes.length &&
    timingSafeEqual(expectedBytes, suppliedBytes)
  );
}

export function createAdminSessionApi({ adminToken }) {
  return function handleAdminSession(
    request,
    response,
    url = new URL(request.url ?? "/", "http://localhost"),
  ) {
    if (
      request.method !== "POST" ||
      url.pathname !== "/Memories/api/admin/session"
    ) {
      return false;
    }

    if (!adminToken) {
      json(response, 503, {
        error: "Administrator access is not configured",
        code: "ADMIN_TOKEN_NOT_CONFIGURED",
      });
      return true;
    }

    if (!authorized(request, adminToken)) {
      json(response, 401, { error: "Unauthorized", code: "UNAUTHORIZED" });
      return true;
    }

    json(response, 200, { authenticated: true });
    return true;
  };
}
