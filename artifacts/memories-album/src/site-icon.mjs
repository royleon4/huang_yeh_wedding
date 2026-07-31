export const SITE_ICON_PUBLIC_PATH = "/Memories/api/settings/site-icon";
export const SITE_ICON_ADMIN_PATH = "/admin/api/settings/site-icon";
export const SITE_ICON_OUTPUT_CONTENT_TYPE = "image/png";
export const SITE_ICON_OUTPUT_SIZE = 192;
export const SITE_ICON_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const SITE_ICON_ACCEPTED_CONTENT_TYPES = Object.freeze([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
const VERSION_PATTERN = /^[a-f0-9]{64}$/;

function byteLengthFromBase64(value) {
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return Math.floor((value.length * 3) / 4) - padding;
}

export function normalizeStoredSiteIcon(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const contentType = String(value.contentType ?? "").toLowerCase();
  const data = String(value.data ?? "");
  const version = String(value.version ?? "").toLowerCase();
  const byteLength = Number(value.byteLength);
  if (contentType !== SITE_ICON_OUTPUT_CONTENT_TYPE) return null;
  if (!data || !BASE64_PATTERN.test(data)) return null;
  if (!VERSION_PATTERN.test(version)) return null;
  if (!Number.isInteger(byteLength) || byteLength <= 0) return null;
  if (byteLengthFromBase64(data) !== byteLength) return null;
  return { contentType, data, version, byteLength };
}

export function siteIconMetadata(value) {
  const icon = normalizeStoredSiteIcon(value);
  return icon
    ? {
        configured: true,
        contentType: icon.contentType,
        version: icon.version,
        byteLength: icon.byteLength,
      }
    : {
        configured: false,
        contentType: null,
        version: null,
        byteLength: 0,
      };
}

export function siteIconUrl(version = null) {
  const normalized = String(version ?? "").trim();
  return normalized
    ? `${SITE_ICON_PUBLIC_PATH}?v=${encodeURIComponent(normalized)}`
    : SITE_ICON_PUBLIC_PATH;
}
