import { adminAuthorized, sendAdminJson } from "./auth.mjs";

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
      sendAdminJson(response, 503, {
        error: "Administrator access is not configured",
        code: "ADMIN_TOKEN_NOT_CONFIGURED",
      });
      return true;
    }

    if (!adminAuthorized(request, adminToken)) {
      sendAdminJson(response, 401, {
        error: "Unauthorized",
        code: "UNAUTHORIZED",
      });
      return true;
    }

    sendAdminJson(response, 200, { authenticated: true });
    return true;
  };
}
