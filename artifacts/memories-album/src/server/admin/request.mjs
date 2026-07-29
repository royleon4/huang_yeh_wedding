import { adminAuthorized, sendAdminJson } from "./auth.mjs";

export async function readAdminJson(request, maxBytes = 32 * 1024) {
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
