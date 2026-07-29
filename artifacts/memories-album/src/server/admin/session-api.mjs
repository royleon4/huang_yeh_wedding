import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import {
  adminAuthorized,
  adminPasswordMatches,
  clearAdminSessionCookie,
  createAdminSessionCookie,
  sendAdminJson,
} from "./auth.mjs";
import { MemoryLoginFailureStore } from "./login-failure-store.mjs";

function normalizedClientAddress(value) {
  let candidate = String(value ?? "")
    .split(",", 1)[0]
    .trim()
    .replace(/^"|"$/g, "");
  const bracketed = candidate.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketed) candidate = bracketed[1];
  if (/^[0-9.]+:\d+$/.test(candidate)) {
    candidate = candidate.replace(/:\d+$/, "");
  }
  return isIP(candidate) ? candidate : null;
}

function clientKey(request, trustProxy) {
  if (trustProxy) {
    const forwarded = normalizedClientAddress(
      request.headers?.["x-forwarded-for"],
    );
    if (forwarded) return forwarded;
  }
  return request.socket?.remoteAddress ?? "unknown";
}

function privateClientKey(request, trustProxy, adminToken) {
  return createHmac("sha256", adminToken)
    .update(clientKey(request, trustProxy))
    .digest("hex");
}

export function createAdminSessionApi({
  adminToken,
  now = Date.now,
  ttlMs = 30 * 60 * 1000,
  createNonce,
  failureWindowMs = 60_000,
  maxFailures = 5,
  maxTrackedClients = 1_000,
  trustProxy = false,
  failureStore = new MemoryLoginFailureStore({ maxTrackedClients }),
}) {
  return async function handleAdminSession(
    request,
    response,
    url = new URL(request.url ?? "/", "http://localhost"),
  ) {
    if (url.pathname !== "/admin/api/session") return false;

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

    const timestamp = now();
    const key = privateClientKey(request, trustProxy, adminToken);
    try {
      const failure = await failureStore.claim(key, timestamp, failureWindowMs);
      if (failure.count > maxFailures) {
        const retryAfter = Math.max(
          1,
          Math.ceil((failure.resetAt - timestamp) / 1_000),
        );
        sendAdminJson(
          response,
          429,
          {
            error: "Too many administrator login attempts",
            code: "RATE_LIMITED",
          },
          { "Retry-After": retryAfter },
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

      await failureStore.clear(key);
    } catch (error) {
      console.warn("Administrator login rate limit unavailable", {
        name: error instanceof Error ? error.name : "UnknownError",
        code: error?.code,
      });
      sendAdminJson(response, 503, {
        error: "Administrator login is temporarily unavailable",
        code: "ADMIN_RATE_LIMIT_UNAVAILABLE",
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
      { authenticated: true },
      { "Set-Cookie": session.header },
    );
    return true;
  };
}
