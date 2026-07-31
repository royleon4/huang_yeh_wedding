import {
  SITE_ICON_ADMIN_PATH,
  SITE_ICON_PUBLIC_PATH,
  siteIconMetadata,
  siteIconUrl,
} from "../site-icon.mjs";
import { canonicalAdminRequestPath } from "../admin-route-paths.mjs";

export function applySiteIcon(metadata, documentRef = globalThis.document) {
  if (!documentRef?.head) return;
  const normalized = siteIconMetadata(
    metadata?.configured
      ? {
          contentType: metadata.contentType,
          data: "AA==",
          version: metadata.version,
          byteLength: 1,
        }
      : null,
  );
  const href = normalized.configured
    ? siteIconUrl(normalized.version)
    : `${SITE_ICON_PUBLIC_PATH}?removed=${Date.now()}`;
  for (const rel of ["icon", "apple-touch-icon"]) {
    let link = documentRef.head.querySelector(
      `link[rel="${rel}"][data-memories-site-icon]`,
    );
    if (!link) {
      link = documentRef.createElement("link");
      link.rel = rel;
      link.dataset.memoriesSiteIcon = "true";
      documentRef.head.append(link);
    }
    link.href = href;
    if (rel === "icon") link.type = "image/png";
  }
}

export async function requestAdminSiteIcon({
  method = "GET",
  file = null,
  fetchImpl = globalThis.fetch,
} = {}) {
  const response = await fetchImpl(canonicalAdminRequestPath(SITE_ICON_ADMIN_PATH), {
    method,
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(method !== "GET" ? { "X-Memories-Admin": "1" } : {}),
      ...(file?.type ? { "Content-Type": file.type } : {}),
    },
    ...(file ? { body: file } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `Request failed (${response.status})`);
    error.status = response.status;
    error.code = payload.code;
    throw error;
  }
  return payload;
}
