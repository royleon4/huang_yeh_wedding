import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "memories_admin_session";

function safeEqual(left, right) {
  const expectedBytes = Buffer.from(left);
  const suppliedBytes = Buffer.from(right);
  return (
    expectedBytes.length === suppliedBytes.length &&
    timingSafeEqual(expectedBytes, suppliedBytes)
  );
}

export function adminPasswordMatches(request, configuredToken) {
  const header = request.headers.authorization;
  const supplied =
    typeof header === "string"
      ? (header.match(/^Bearer\s+(.+)$/i)?.[1] ?? "")
      : "";
  if (!configuredToken || !supplied) return false;

  return safeEqual(configuredToken, supplied);
}

function sign(encodedPayload, configuredToken) {
  return createHmac("sha256", configuredToken)
    .update(encodedPayload)
    .digest("base64url");
}

function cookieValue(request) {
  const header = request.headers.cookie;
  if (typeof header !== "string") return null;
  for (const part of header.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === ADMIN_SESSION_COOKIE) return value.join("=") || null;
  }
  return null;
}

export function createAdminSessionCookie({
  configuredToken,
  now = Date.now,
  ttlMs = 30 * 60 * 1000,
  createNonce = () => randomBytes(16).toString("base64url"),
}) {
  const issuedAt = now();
  const payload = Buffer.from(
    JSON.stringify({
      version: 1,
      issuedAt,
      expiresAt: issuedAt + ttlMs,
      nonce: createNonce(),
    }),
  ).toString("base64url");
  const value = `${payload}.${sign(payload, configuredToken)}`;
  return {
    value,
    header: `${ADMIN_SESSION_COOKIE}=${value}; Path=/admin; Max-Age=${Math.floor(
      ttlMs / 1000,
    )}; HttpOnly; Secure; SameSite=Strict`,
  };
}

export function clearAdminSessionCookie() {
  return `${ADMIN_SESSION_COOKIE}=; Path=/admin; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

export function adminAuthorized(
  request,
  configuredToken,
  { now = Date.now } = {},
) {
  if (!configuredToken) return false;
  const value = cookieValue(request);
  if (!value) return false;
  const [payload, suppliedSignature, extra] = value.split(".");
  if (!payload || !suppliedSignature || extra) return false;
  if (!safeEqual(sign(payload, configuredToken), suppliedSignature))
    return false;
  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    return (
      session.version === 1 &&
      Number.isFinite(session.expiresAt) &&
      now() < session.expiresAt
    );
  } catch {
    return false;
  }
}

export function sendAdminJson(response, status, body, headers = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    ...headers,
  });
  response.end(JSON.stringify(body));
}
