const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
const VERSION_PATTERN = /^[a-f0-9]{64}$/;

export const EMPTY_IMAGE_SETTING_METADATA = Object.freeze({
  configured: false,
  contentType: null,
  version: null,
  byteLength: 0,
  width: null,
  height: null,
});

function byteLengthFromBase64(value) {
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return Math.floor((value.length * 3) / 4) - padding;
}

export function isImageSettingVersion(value) {
  return VERSION_PATTERN.test(String(value ?? "").toLowerCase());
}

export function normalizeImageSettingMetadata(value, expected = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return EMPTY_IMAGE_SETTING_METADATA;
  }
  const contentType = String(value.contentType ?? "").toLowerCase();
  const version = String(value.version ?? "").toLowerCase();
  const byteLength = Number(value.byteLength);
  const width = value.width == null ? null : Number(value.width);
  const height = value.height == null ? null : Number(value.height);
  if (
    value.configured !== true ||
    (expected.contentType && contentType !== expected.contentType) ||
    !isImageSettingVersion(version) ||
    !Number.isInteger(byteLength) ||
    byteLength <= 0 ||
    (expected.width != null && width !== expected.width) ||
    (expected.height != null && height !== expected.height)
  ) {
    return EMPTY_IMAGE_SETTING_METADATA;
  }
  return { configured: true, contentType, version, byteLength, width, height };
}

export function normalizeStoredImageSetting(value, expected = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = String(value.data ?? "");
  const metadata = normalizeImageSettingMetadata(
    { configured: true, ...value },
    expected,
  );
  if (!metadata.configured || !data || !BASE64_PATTERN.test(data)) return null;
  if (byteLengthFromBase64(data) !== metadata.byteLength) return null;
  return { ...metadata, data, configured: undefined };
}

export function imageSettingMetadata(value, expected = {}) {
  const stored = normalizeStoredImageSetting(value, expected);
  if (!stored) return EMPTY_IMAGE_SETTING_METADATA;
  const { data: _data, configured: _configured, ...metadata } = stored;
  return { configured: true, ...metadata };
}

export function validateImageSettingFile(
  file,
  { acceptedContentTypes, maxBytes },
) {
  if (!file) return { valid: false, reason: "required" };
  const contentType = String(file.type ?? "").toLowerCase();
  if (!acceptedContentTypes.includes(contentType)) {
    return { valid: false, reason: "unsupported-type" };
  }
  const size = Number(file.size);
  if (!Number.isFinite(size) || size < 0 || size > maxBytes) {
    return { valid: false, reason: "too-large" };
  }
  return { valid: true, reason: null };
}

export function imageSettingUrl(path, version = null) {
  const normalized = String(version ?? "").trim();
  return normalized ? `${path}?v=${encodeURIComponent(normalized)}` : path;
}
