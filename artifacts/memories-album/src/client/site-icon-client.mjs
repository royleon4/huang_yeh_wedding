import {
  SITE_ICON_ADMIN_PATH,
  SITE_ICON_PUBLIC_PATH,
  normalizeSiteIconMetadata,
  siteIconUrl,
} from "../site-icon.mjs";
import { canonicalAdminRequestPath } from "../admin-route-paths.mjs";

const SITE_ICON_LINKS = Object.freeze([
  { rel: "icon", type: "image/png" },
  { rel: "apple-touch-icon", type: null },
]);

function ensureSiteIconLink(documentRef, { rel, type }) {
  let link = documentRef.head.querySelector(
    `link[rel="${rel}"][data-memories-site-icon]`,
  );
  if (!link) {
    link = documentRef.createElement("link");
    link.rel = rel;
    link.dataset.memoriesSiteIcon = "true";
    documentRef.head.append(link);
  }
  if (type) link.type = type;
  return link;
}

export function applySiteIcon(
  metadata,
  documentRef = globalThis.document,
  now = Date.now,
) {
  if (!documentRef?.head) return;
  const normalized = normalizeSiteIconMetadata(metadata);
  const href = normalized.configured
    ? siteIconUrl(normalized.version)
    : `${SITE_ICON_PUBLIC_PATH}?removed=${now()}`;
  for (const definition of SITE_ICON_LINKS) {
    ensureSiteIconLink(documentRef, definition).href = href;
  }
}

async function requestAdminSiteIcon({
  method,
  file = null,
  fetchImpl = globalThis.fetch,
}) {
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
  return normalizeSiteIconMetadata(payload);
}

export function loadAdminSiteIcon(options = {}) {
  return requestAdminSiteIcon({ ...options, method: "GET" });
}

export function replaceAdminSiteIcon(file, options = {}) {
  return requestAdminSiteIcon({ ...options, method: "PUT", file });
}

export function removeAdminSiteIcon(options = {}) {
  return requestAdminSiteIcon({ ...options, method: "DELETE" });
}
