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
export const EMPTY_SITE_ICON_METADATA = Object.freeze({
  configured: false,
  contentType: null,
  version: null,
  byteLength: 0,
});
export const SITE_ICON_FILE_ERROR_CODES = Object.freeze({
  required: "SITE_ICON_REQUIRED",
  unsupportedType: "UNSUPPORTED_SITE_ICON_TYPE",
  tooLarge: "SITE_ICON_TOO_LARGE",
});

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
const VERSION_PATTERN = /^[a-f0-9]{64}$/;

function byteLengthFromBase64(value) {
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return Math.floor((value.length * 3) / 4) - padding;
}

export function isSiteIconVersion(value) {
  return VERSION_PATTERN.test(String(value ?? "").toLowerCase());
}

export function normalizeSiteIconMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return EMPTY_SITE_ICON_METADATA;
  }
  const contentType = String(value.contentType ?? "").toLowerCase();
  const version = String(value.version ?? "").toLowerCase();
  const byteLength = Number(value.byteLength);
  if (
    value.configured !== true ||
    contentType !== SITE_ICON_OUTPUT_CONTENT_TYPE ||
    !isSiteIconVersion(version) ||
    !Number.isInteger(byteLength) ||
    byteLength <= 0
  ) {
    return EMPTY_SITE_ICON_METADATA;
  }
  return { configured: true, contentType, version, byteLength };
}

export function normalizeStoredSiteIcon(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = String(value.data ?? "");
  const metadata = normalizeSiteIconMetadata({
    configured: true,
    contentType: value.contentType,
    version: value.version,
    byteLength: value.byteLength,
  });
  if (!metadata.configured || !data || !BASE64_PATTERN.test(data)) return null;
  if (byteLengthFromBase64(data) !== metadata.byteLength) return null;
  return {
    contentType: metadata.contentType,
    data,
    version: metadata.version,
    byteLength: metadata.byteLength,
  };
}

export function siteIconMetadata(value) {
  const icon = normalizeStoredSiteIcon(value);
  return icon
    ? normalizeSiteIconMetadata({ configured: true, ...icon })
    : EMPTY_SITE_ICON_METADATA;
}

export function validateSiteIconFile(file) {
  if (!file) {
    return { valid: false, code: SITE_ICON_FILE_ERROR_CODES.required };
  }
  const contentType = String(file.type ?? "").toLowerCase();
  if (!SITE_ICON_ACCEPTED_CONTENT_TYPES.includes(contentType)) {
    return {
      valid: false,
      code: SITE_ICON_FILE_ERROR_CODES.unsupportedType,
    };
  }
  const size = Number(file.size);
  if (!Number.isFinite(size) || size < 0 || size > SITE_ICON_MAX_UPLOAD_BYTES) {
    return { valid: false, code: SITE_ICON_FILE_ERROR_CODES.tooLarge };
  }
  return { valid: true, code: null };
}

export function siteIconUrl(version = null) {
  const normalized = String(version ?? "").trim();
  return normalized
    ? `${SITE_ICON_PUBLIC_PATH}?v=${encodeURIComponent(normalized)}`
    : SITE_ICON_PUBLIC_PATH;
}
