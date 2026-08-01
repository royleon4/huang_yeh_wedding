import {
  HERO_BACKGROUND_ADMIN_PATH,
  normalizeHeroBackgroundMetadata,
} from "../site-style.mjs";
import { canonicalAdminRequestPath } from "../admin-route-paths.mjs";

async function requestHeroBackground({
  method,
  file = null,
  fetchImpl = globalThis.fetch,
}) {
  const response = await fetchImpl(
    canonicalAdminRequestPath(HERO_BACKGROUND_ADMIN_PATH),
    {
      method,
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(method !== "GET" ? { "X-Memories-Admin": "1" } : {}),
        ...(file?.type ? { "Content-Type": file.type } : {}),
      },
      ...(file ? { body: file } : {}),
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `Request failed (${response.status})`);
    error.status = response.status;
    error.code = payload.code;
    throw error;
  }
  return normalizeHeroBackgroundMetadata(payload);
}

export function replaceHeroBackground(file, options = {}) {
  return requestHeroBackground({ ...options, method: "PUT", file });
}

export function removeHeroBackground(options = {}) {
  return requestHeroBackground({ ...options, method: "DELETE" });
}
