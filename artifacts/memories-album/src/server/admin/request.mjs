import { adminAuthorized, sendAdminJson } from "./auth.mjs";

const DEFAULT_MAX_JSON_BYTES = 32 * 1024;

function normalizedMaxBytes(value) {
  const candidate =
    typeof value === "object" && value !== null
      ? value.maxBytes ?? DEFAULT_MAX_JSON_BYTES
      : value;
  const limit = Number(candidate);
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new TypeError("JSON request limit must be a positive integer number of bytes");
  }
  return limit;
}

export async function readAdminJson(request, maxBytes = DEFAULT_MAX_JSON_BYTES) {
  const limit = normalizedMaxBytes(maxBytes);
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > limit) {
      const error = new Error("Request body exceeds the permitted size");
      error.status = 413;
      error.code = "BODY_TOO_LARGE";
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    const error = new Error("Request body must contain valid JSON");
    error.status = 400;
    error.code = "INVALID_JSON";
    throw error;
  }
}

export function requireAdmin(
  request,
  response,
  adminToken,
  { mutate = false } = {},
) {
  if (!adminAuthorized(request, adminToken)) {
    sendAdminJson(response, 401, {
      error: "Unauthorized",
      code: "UNAUTHORIZED",
    });
    return false;
  }
  if (mutate && request.headers["x-memories-admin"] !== "1") {
    sendAdminJson(response, 403, {
      error: "Administrator request verification failed",
      code: "ADMIN_REQUEST_REQUIRED",
    });
    return false;
  }
  return true;
}
