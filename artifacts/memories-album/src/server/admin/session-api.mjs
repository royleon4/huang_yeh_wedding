import {
  adminAuthorized,
  adminPasswordMatches,
  clearAdminSessionCookie,
  createAdminSessionCookie,
  sendAdminJson,
} from "./auth.mjs";
import { createFixedWindowRateLimiter } from "./rate-limit.mjs";

const sharedLoginRateLimiter = createFixedWindowRateLimiter({
  limit: 10,
  windowMs: 10 * 60 * 1000,
});

export function createAdminSessionApi({
  adminToken,
  now = Date.now,
  ttlMs = 30 * 60 * 1000,
  createNonce,
  rateLimiter = sharedLoginRateLimiter,
}) {
  return function handleAdminSession(
    request,
    response,
    url = new URL(request.url ?? "/", "http://localhost"),
  ) {
    if (url.pathname !== "/Memories/api/admin/session") {
      return false;
    }

    if (request.method === "DELETE") {
      sendAdminJson(
        response,
        200,
        { authenticated: false },
        { "Set-Cookie": clearAdminSessionCookie() },
      );
      return true;
    }

    if (request.method !== "GET" && request.method !== "POST") return false;

    if (!adminToken) {
      sendAdminJson(response, 503, {
        error: "Administrator access is not configured",
        code: "ADMIN_TOKEN_NOT_CONFIGURED",
      });
      return true;
    }

    if (request.method === "GET") {
      const authenticated = adminAuthorized(request, adminToken, { now });
      sendAdminJson(response, authenticated ? 200 : 401, {
        authenticated,
        ...(!authenticated ? { code: "UNAUTHORIZED" } : {}),
      });
      return true;
    }

    const rate = rateLimiter.consume(request);
    if (!rate.allowed) {
      sendAdminJson(
        response,
        429,
        {
          error: "Too many administrator requests",
          code: "RATE_LIMITED",
        },
        { "Retry-After": String(rate.retryAfterSeconds) },
      );
      return true;
    }

    if (!adminPasswordMatches(request, adminToken)) {
      sendAdminJson(response, 401, {
        error: "Unauthorized",
        code: "UNAUTHORIZED",
      });
      return true;
    }

    const session = createAdminSessionCookie({
      configuredToken: adminToken,
      now,
      ttlMs,
      createNonce,
    });
    sendAdminJson(
      response,
      200,
      {
        authenticated: true,
        expiresInSeconds: Math.floor(ttlMs / 1000),
      },
      { "Set-Cookie": session.header },
    );
    return true;
  };
}
